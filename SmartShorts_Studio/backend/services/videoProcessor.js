const path = require('path');
const fs = require('fs');
const { runPipeline } = require('./pipelineManager');
const { getVideoDuration, splitVideo, cutClip, processSegment, processSubtitleOnlySegment } = require('../utils/ffmpeg');
const { getVideoMetadata } = require('../utils/ffprobe');
const { generateSubtitles, isWhisperAvailable } = require('../utils/whisper');
const { generateSmartClips } = require('../ai/smartClipper');
const { buildSeoPackage } = require('../ai/seoEngine');
const { createEditPlan, normalizeMode } = require('../ai/retentionOptimizer');
const { scoreClipViral, generateTips } = require('../ai/viralScorer');
const { generateStyledSubtitles, generateFallbackSubtitles } = require('../effects/subtitleStyler');
const { renderFinalClip } = require('../effects/finalRenderer');
const { generateThumbnailPack } = require('../effects/thumbnailGenerator');
const { updateJob } = require('./jobStore');
const { transcribeWithPythonAi } = require('./pythonAiClient');
const { logAi, logRender } = require('../utils/logger');

const OUTPUT_DIR = path.resolve(process.env.OUTPUT_DIR || './outputs');

function buildFixedClip(file, index, options, actualDuration = null) {
  const targetDuration = Number(options.clipDuration) || 45;
  const duration = Number(actualDuration) || targetDuration;
  const start = index * targetDuration;
  const clip = {
    index,
    path: file,
    start,
    end: start + duration,
    duration,
    viralScore: 0,
    hookText: '',
    emotion: 'neutral',
    reason: options?.clippingMode === 'subtitle_only' ? 'Subtitle-only fixed duration split' : 'Fixed duration split',
    details: {
      hookScore: 0,
      energyScore: 0,
      sceneScore: 0,
      pacingScore: 0,
      retentionScore: 0,
      engagementPrediction: 0,
      replayPotential: 0
    }
  };

  if (options?.clippingMode !== 'smart') {
    return {
      ...clip,
      grade: 'C',
      title: `Clip ${String(index + 1).padStart(2, '0')}`,
      description: '',
      hashtags: [],
      seo: null
    };
  }

  const scored = scoreClipViral(clip);
  const seo = buildSeoPackage({ ...clip, viralScore: scored.viralScore }, normalizeMode(options.mode || 'auto_viral'));
  return {
    ...clip,
    viralScore: scored.viralScore,
    grade: scored.grade,
    title: seo.title,
    description: seo.description,
    hashtags: seo.hashtags,
    seo
  };
}

function dedupeClipsForRender(clips, maxClips = 20) {
  const selected = [];
  const sorted = [...clips].sort((a, b) => (b.viralScore || 0) - (a.viralScore || 0));

  for (const clip of sorted) {
    const duplicate = selected.some(existing => {
      const overlap = Math.max(0, Math.min(existing.end, clip.end) - Math.max(existing.start, clip.start));
      const smallerDuration = Math.max(1, Math.min(existing.duration, clip.duration));
      const centerDistance = Math.abs(((existing.start + existing.end) / 2) - ((clip.start + clip.end) / 2));
      return overlap / smallerDuration > 0.12 || centerDistance < 15;
    });

    if (!duplicate) selected.push(clip);
    if (selected.length >= maxClips) break;
  }

  return selected.sort((a, b) => a.start - b.start);
}

const PIPELINE_STEPS = [
  {
    name: 'analyze',
    description: 'Analyzing source video, audio, and format',
    execute: async (ctx, progress) => {
      progress(15);
      logAi(`Job ${ctx.jobId}: probing source video`);
      const metadata = await getVideoMetadata(ctx.originalFile);
      progress(60);
      const totalDuration = await getVideoDuration(ctx.originalFile);
      console.log(`[Job ${ctx.jobId}] Step 1: Complete - Duration: ${totalDuration}s, Mode: ${ctx.options.mode || 'auto_viral'}, Clipping: ${ctx.options.clippingMode}`);
      logAi(`Job ${ctx.jobId}: source analysis complete`, {
        durationSeconds: Number(totalDuration.toFixed(2)),
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
        audioChannels: metadata.audioChannels
      });
      const analysis = {
        metadata,
        totalDuration,
        source: path.basename(ctx.originalFile),
        mode: normalizeMode(ctx.options.mode || 'auto_viral')
      };
      updateJob(ctx.jobId, { analysis });
      progress(100);
      return { metadata, totalDuration, analysis };
    }
  },
  {
    name: 'transcribe_full',
    description: 'Creating transcript for hook and subtitle analysis',
    execute: async (ctx, progress) => {
      if (ctx.options.clippingMode === 'fixed') {
        progress(100);
        return { fullSrt: null, whisperAvailable: false };
      }

      progress(10);
      const model = process.env.WHISPER_MODEL || 'large-v3';

      if (ctx.options.clippingMode === 'subtitle_only') {
        const whisperAvailable = await isWhisperAvailable();
        logAi(`Job ${ctx.jobId}: subtitle-only mode will caption each fixed segment`, {
          localWhisperAvailable: whisperAvailable,
          pythonAiFallback: process.env.PYTHON_AI_ENABLED === 'true'
        });
        progress(100);
        return { fullSrt: null, whisperAvailable };
      }
      logAi(`Job ${ctx.jobId}: trying Python AI transcription`, { model });
      const pythonSrt = await transcribeWithPythonAi(ctx.originalFile, ctx.segmentsDir, model);
      if (pythonSrt) {
        logAi(`Job ${ctx.jobId}: Python AI transcript ready`, { srt: path.basename(pythonSrt) });
        progress(100);
        return { fullSrt: pythonSrt, whisperAvailable: true };
      }

      const whisperAvailable = await isWhisperAvailable();
      if (!whisperAvailable) {
        logAi(`Job ${ctx.jobId}: Whisper unavailable, fallback captions will be used`);
        progress(100);
        return { fullSrt: null, whisperAvailable: false };
      }

      logAi(`Job ${ctx.jobId}: running local Whisper`, { model });
      const fullSrt = await generateSubtitles(ctx.originalFile, ctx.segmentsDir, model);
      if (fullSrt) {
        console.log(`[Job ${ctx.jobId}] Step 2: Transcription success. SRT saved at: ${fullSrt}`);
      } else {
        console.error(`[Job ${ctx.jobId}] Step 2: Transcription FAILED or returned no result.`);
      }
      logAi(`Job ${ctx.jobId}: local Whisper finished`, {
        transcript: fullSrt ? path.basename(fullSrt) : 'not_created',
        fallbackCaptions: !fullSrt
      });
      progress(100);
      return { fullSrt, whisperAvailable };
    }
  },
  {
    name: 'detect_viral_moments',
    description: 'Scoring hooks, emotion, pacing, and retention windows',
    execute: async (ctx, progress) => {
      let clipsToProcess = [];
      const mode = ctx.options.clippingMode === 'smart' ? normalizeMode(ctx.options.mode || 'auto_viral') : ctx.options.mode;
      logAi(`Job ${ctx.jobId}: selecting clip windows`, { mode, clippingMode: ctx.options.clippingMode });

      if (ctx.options.clippingMode === 'smart') {
        const smartClips = await generateSmartClips(
          ctx.originalFile,
          ctx.fullSrt,
          mode,
          percent => progress(5 + percent * 0.75)
        );

        for (let i = 0; i < smartClips.length; i++) {
          const clip = smartClips[i];
          const segmentPath = path.join(ctx.segmentsDir, `segment_${String(i).padStart(3, '0')}.mp4`);
          logAi(`Job ${ctx.jobId}: cutting clip candidate ${i + 1}/${smartClips.length}`, {
            start: clip.start,
            end: clip.end,
            duration: clip.duration,
            viralScore: clip.viralScore,
            reason: clip.reason
          });
          await cutClip(ctx.originalFile, segmentPath, clip.start, clip.duration);
          clipsToProcess.push({ index: i, path: segmentPath, ...clip });
          progress(80 + ((i + 1) / Math.max(1, smartClips.length)) * 18);
        }
      } else {
        const segmentFiles = await splitVideo(ctx.originalFile, ctx.segmentsDir, ctx.options.clipDuration);
        for (let index = 0; index < segmentFiles.length; index++) {
          const file = segmentFiles[index];
          const actualDuration = await getVideoDuration(file);
          clipsToProcess.push(buildFixedClip(file, index, ctx.options, actualDuration));
        }
      }

      if (ctx.options.clippingMode === 'smart') {
        clipsToProcess = dedupeClipsForRender(clipsToProcess, 20);
      }
      logAi(`Job ${ctx.jobId}: unique clips selected`, {
        count: clipsToProcess.length,
        clips: clipsToProcess.map(clip => ({
          start: clip.start,
          end: clip.end,
          score: clip.viralScore,
          reason: clip.reason
        }))
      });

      updateJob(ctx.jobId, {
        totalClips: clipsToProcess.length,
        analysis: {
          ...ctx.analysis,
          selectedMoments: clipsToProcess.map(clip => ({
            start: clip.start,
            end: clip.end,
            duration: clip.duration,
            viralScore: clip.viralScore,
            reason: clip.reason,
            hookText: clip.hookText
          }))
        }
      });

      progress(100);
      return { clipsToProcess };
    }
  },
  {
    name: 'render_creator_edits',
    description: 'Rendering captions, effects, audio mix, thumbnails, and SEO',
    execute: async (ctx, progress) => {
      const processedClips = [];
      const thumbnails = [];
      const titles = [];
      const total = ctx.clipsToProcess.length;
      const mode = ctx.options.clippingMode === 'smart' ? normalizeMode(ctx.options.mode || 'auto_viral') : ctx.options.mode;
      const fixedOnly = ctx.options.clippingMode === 'fixed';
      const subtitleOnly = ctx.options.clippingMode === 'subtitle_only';

      if (total === 0) {
        progress(100);
        return { processedClips: [] };
      }

      if (fixedOnly) {
        for (let i = 0; i < total; i++) {
          const clip = ctx.clipsToProcess[i];
          const partNumber = i + 1;
          const partPrefix = `Part_${String(partNumber).padStart(2, '0')}`;
          const finalPath = path.join(ctx.jobOutputDir, `${partPrefix}.mp4`);
          const finalOutputName = `${partPrefix}.mp4`;

          fs.copyFileSync(clip.path, finalPath);

          const stats = fs.statSync(finalPath);
          const publicBasePath = `/outputs/${ctx.jobId}`;
          const outputClip = {
            name: finalOutputName,
            partNumber,
            path: `${publicBasePath}/${finalOutputName}`,
            size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            sizeBytes: stats.size,
            duration: Number(clip.duration).toFixed(1),
            start: clip.start,
            end: clip.end,
            viralScore: 0,
            grade: 'C',
            hookText: '',
            title: `Clip ${String(partNumber).padStart(2, '0')}`,
            description: '',
            hashtags: [],
            seo: null,
            reason: clip.reason,
            emotion: 'neutral',
            details: clip.details || {},
            tips: [],
            editPlan: null,
            effectsLevel: 'off',
            thumbnails: {}
          };

          processedClips.push(outputClip);
          titles.push(outputClip.title);
          updateJob(ctx.jobId, {
            clips: [...processedClips],
            processedClips: partNumber,
            totalClips: total,
            thumbnails: [...thumbnails],
            titles: [...titles]
          });
          progress(((i + 1) / total) * 100);
        }

        return { processedClips, thumbnails, titles };
      }

      if (subtitleOnly) {
        for (let i = 0; i < total; i++) {
          const clip = ctx.clipsToProcess[i];
          const partNumber = i + 1;
          const partPrefix = `Part_${String(partNumber).padStart(2, '0')}`;
          const finalPath = path.join(ctx.jobOutputDir, `${partPrefix}.mp4`);
          const finalOutputName = `${partPrefix}.mp4`;
          const enrichedClip = {
            ...clip,
            title: `Subtitle Clip ${String(partNumber).padStart(2, '0')}`,
            description: '',
            hashtags: [],
            seo: null
          };

          let subtitlePath = path.join(ctx.segmentsDir, `${partPrefix}_subtitle_only.ass`);
          const clipModel = process.env.WHISPER_CLIP_MODEL || process.env.WHISPER_MODEL || 'large-v3';
          logAi(`Job ${ctx.jobId}: creating subtitle-only captions for clip ${partNumber}/${total}`, { model: clipModel });
          const pythonSrt = await transcribeWithPythonAi(clip.path, ctx.segmentsDir, clipModel);
          const segSrt = pythonSrt || (ctx.whisperAvailable ? await generateSubtitles(clip.path, ctx.segmentsDir, clipModel) : null);
          if (segSrt) {
            subtitlePath = generateStyledSubtitles(segSrt, subtitlePath, ctx.options.subtitleStyle || 'hormozi') || subtitlePath;
          }

          if (!subtitlePath || !fs.existsSync(subtitlePath)) {
            logAi(`Job ${ctx.jobId}: using fallback subtitle-only captions for clip ${partNumber}/${total}`);
            subtitlePath = generateFallbackSubtitles(
              path.join(ctx.segmentsDir, `${partPrefix}_subtitle_only_fallback.ass`),
              enrichedClip,
              ctx.options.subtitleStyle || 'hormozi'
            );
          }

          try {
            logRender(`Job ${ctx.jobId}: subtitle-only render ${partNumber}/${total}`, {
              output: finalOutputName,
              subtitles: path.basename(subtitlePath)
            });
            await processSubtitleOnlySegment(
              clip.path,
              finalPath,
              subtitlePath,
              ctx.options.aspectRatio,
              ctx.options.cropMode
            );
          } catch (error) {
            console.warn(`[SubtitleOnly] Caption render failed for part ${partNumber}; copying source segment. ${error.message}`);
            fs.copyFileSync(clip.path, finalPath);
          }

          const stats = fs.statSync(finalPath);
          const publicBasePath = `/outputs/${ctx.jobId}`;
          const outputClip = {
            name: finalOutputName,
            partNumber,
            path: `${publicBasePath}/${finalOutputName}`,
            size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            sizeBytes: stats.size,
            duration: Number(clip.duration).toFixed(1),
            start: clip.start,
            end: clip.end,
            viralScore: 0,
            grade: 'C',
            hookText: '',
            title: enrichedClip.title,
            description: '',
            hashtags: [],
            seo: null,
            reason: clip.reason,
            emotion: 'neutral',
            details: clip.details || {},
            tips: [],
            editPlan: null,
            effectsLevel: 'off',
            thumbnails: {}
          };

          processedClips.push(outputClip);
          titles.push(outputClip.title);
          updateJob(ctx.jobId, {
            clips: [...processedClips],
            processedClips: partNumber,
            totalClips: total,
            thumbnails: [...thumbnails],
            titles: [...titles]
          });
          progress(((i + 1) / total) * 100);
        }

        return { processedClips, thumbnails, titles };
      }

      for (let i = 0; i < total; i++) {
        const clip = ctx.clipsToProcess[i];
        const partNumber = i + 1;
        const partPrefix = `Part_${String(partNumber).padStart(2, '0')}`;
        const finalPath = path.join(ctx.jobOutputDir, `${partPrefix}.mp4`);
        const finalOutputName = `${partPrefix}.mp4`;

        const editPlan = createEditPlan(clip, mode);
        const seo = clip.seo || buildSeoPackage(clip, mode);
        const enrichedClip = {
          ...clip,
          effectsLevel: ctx.options.effectsLevel || 'aggressive',
          editPlan,
          seo,
          title: seo.title,
          description: seo.description,
          hashtags: seo.hashtags
        };
        logAi(`Job ${ctx.jobId}: AI editor plan for clip ${partNumber}/${total}`, {
          mood: editPlan.mood,
          emotion: enrichedClip.emotion,
          zoomStyle: editPlan.visual?.zoomStyle,
          pacingSeconds: editPlan.pacing?.cutEverySeconds,
          attentionResets: editPlan.pacing?.attentionResetCount,
          soundCues: editPlan.audio?.cues?.length || 0,
          brollCallouts: editPlan.broll?.length || 0,
          effectsLevel: enrichedClip.effectsLevel,
          sfxEnabled: ctx.options.enableSfx !== false,
          bgmEnabled: ctx.options.enableBgm !== false,
          subtitles: 'forced_fancy_ass'
        });

        let subtitlePath = path.join(ctx.segmentsDir, `${partPrefix}_forced.ass`);
        if (ctx.whisperAvailable) {
          const clipModel = process.env.WHISPER_CLIP_MODEL || process.env.WHISPER_MODEL || 'large-v3';
          logAi(`Job ${ctx.jobId}: creating fancy subtitles for clip ${partNumber}/${total}`, { model: clipModel });
          const segSrt = await generateSubtitles(clip.path, ctx.segmentsDir, clipModel);
          if (segSrt) {
            subtitlePath = generateStyledSubtitles(segSrt, subtitlePath, ctx.options.subtitleStyle || 'hormozi') || subtitlePath;
          }
        }

        if (!subtitlePath || !fs.existsSync(subtitlePath)) {
          logAi(`Job ${ctx.jobId}: using fallback fancy captions for clip ${partNumber}/${total}`);
          subtitlePath = generateFallbackSubtitles(
            path.join(ctx.segmentsDir, `${partPrefix}_fallback.ass`),
            enrichedClip,
            ctx.options.subtitleStyle || 'hormozi'
          );
        }

        try {
          logRender(`Job ${ctx.jobId}: final AI edit render ${partNumber}/${total}`, {
            output: finalOutputName,
            subtitles: path.basename(subtitlePath),
            mood: editPlan.mood,
            attentionResets: editPlan.pacing?.attentionResetCount || 0,
            viralScore: enrichedClip.viralScore
          });
          await renderFinalClip({
            inputPath: clip.path,
            outputPath: finalPath,
            subtitlePath,
            partNumber,
            clip: enrichedClip,
            options: {
              ...ctx.options,
              addSubtitles: true,
              enableEffects: true,
              enableSfx: ctx.options.enableSfx !== false,
              enableBgm: ctx.options.enableBgm !== false,
              effectsLevel: enrichedClip.effectsLevel
            },
            metadata: ctx.metadata
          });
        } catch (error) {
          console.warn(`[FinalRender] Full edit render failed for part ${partNumber}; rendering safe captioned fallback. ${error.message}`);
          try {
            await processSegment(
              clip.path,
              finalPath,
              partNumber,
              subtitlePath,
              ctx.options.aspectRatio,
              ctx.options.cropMode
            );
          } catch (fallbackError) {
            console.warn(`[FinalRender] Captioned fallback failed for part ${partNumber}; copying source segment. ${fallbackError.message}`);
            fs.copyFileSync(clip.path, finalPath);
          }
        }

        const publicBasePath = `/outputs/${ctx.jobId}`;
        let thumbnailPack = {};
        try {
          thumbnailPack = await generateThumbnailPack(finalPath, ctx.jobOutputDir, publicBasePath, enrichedClip, partNumber);
          thumbnails.push(thumbnailPack);
        } catch (error) {
          console.warn(`[Thumbnail] Thumbnail generation skipped for part ${partNumber}: ${error.message}`);
        }

        const stats = fs.statSync(finalPath);
        logRender(`Job ${ctx.jobId}: clip ready`, {
          file: finalOutputName,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          title: seo.title
        });
        const scores = scoreClipViral(enrichedClip);
        const tips = generateTips(scores);
        const outputClip = {
          name: finalOutputName,
          partNumber,
          path: `${publicBasePath}/${finalOutputName}`,
          size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
          sizeBytes: stats.size,
          duration: Number(clip.duration).toFixed(1),
          start: clip.start,
          end: clip.end,
          viralScore: Math.max(clip.viralScore || 0, scores.viralScore),
          grade: scores.grade,
          hookText: enrichedClip.hookText,
          title: seo.title,
          description: seo.description,
          hashtags: seo.hashtags,
          seo,
          reason: enrichedClip.reason,
          emotion: enrichedClip.emotion,
          details: {
            ...enrichedClip.details,
            retentionScore: enrichedClip.details?.retentionScore || scores.retentionScore
          },
          tips,
          editPlan,
          effectsLevel: enrichedClip.effectsLevel,
          thumbnails: thumbnailPack
        };

        processedClips.push(outputClip);
        titles.push(seo.title);
        updateJob(ctx.jobId, {
          clips: [...processedClips],
          processedClips: partNumber,
          totalClips: total,
          thumbnails: [...thumbnails],
          titles: [...titles]
        });
        progress(((i + 1) / total) * 100);
      }

      return { processedClips, thumbnails, titles };
    }
  },
  {
    name: 'cleanup',
    description: 'Cleaning temporary render files',
    execute: async (ctx, progress) => {
      try {
        fs.rmSync(ctx.segmentsDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`[Cleanup] ${error.message}`);
      }
      progress(100);
      return {};
    }
  }
];

async function processVideo(job) {
  const { jobId, originalFile, options } = job;
  const jobOutputDir = path.join(OUTPUT_DIR, jobId);
  const segmentsDir = path.join(jobOutputDir, 'segments');
  fs.mkdirSync(segmentsDir, { recursive: true });
  logAi(`Job ${jobId}: pipeline started`, {
    file: path.basename(originalFile),
    mode: options.mode,
    clippingMode: options.clippingMode,
    aspectRatio: options.aspectRatio,
    subtitles: 'forced_on',
    audio: options.enableAudio !== false,
    sfx: options.enableSfx !== false,
    bgm: options.enableBgm !== false,
    effectsLevel: options.effectsLevel || 'aggressive'
  });

  const context = {
    jobId,
    originalFile,
    options,
    jobOutputDir,
    segmentsDir
  };

  try {
    const finalCtx = await runPipeline(jobId, context, PIPELINE_STEPS);
    console.log(`[Job ${jobId}] Pipeline complete. Generated ${finalCtx.processedClips?.length || 0} clips.`);
  } catch (error) {
    console.error(`[Job ${jobId}] Pipeline aborted: ${error.message}`);
  }
}

module.exports = { processVideo };
