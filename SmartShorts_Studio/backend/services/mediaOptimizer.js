const fs = require('fs');
const path = require('path');

const { runFFmpeg } = require('../utils/ffmpeg');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function replaceExt(filePath, suffix, ext) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${suffix}${ext}`);
}

async function optimizeAudio(inputPath, outputPath = null) {
  const target = outputPath || replaceExt(inputPath, '_normalized', '.mp3');
  await runFFmpeg([
    '-y',
    '-i', inputPath,
    '-af', 'silenceremove=start_periods=1:start_duration=0.06:start_threshold=-45dB,loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:a', target.toLowerCase().endsWith('.wav') ? 'pcm_s16le' : 'libmp3lame',
    target.toLowerCase().endsWith('.wav') ? '-ar' : '-b:a',
    target.toLowerCase().endsWith('.wav') ? '44100' : '192k',
    target
  ], 'Optimize audio asset');
  return target;
}

async function optimizeVideo(inputPath, outputPath = null, options = {}) {
  const target = outputPath || replaceExt(inputPath, '_optimized', '.mp4');
  const maxDuration = Number(options.maxDuration || process.env.ASSET_VIDEO_LOOP_SECONDS || 12);
  await runFFmpeg([
    '-y',
    '-i', inputPath,
    '-t', String(maxDuration),
    '-vf', 'fps=30,scale=1080:-2:force_original_aspect_ratio=decrease,format=yuv420p',
    '-c:v', 'libx264',
    '-preset', process.env.FFMPEG_PRESET || 'fast',
    '-crf', process.env.FFMPEG_CRF || '23',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    target
  ], 'Optimize video asset');
  return target;
}

async function generateThumbnail(inputPath, outputPath) {
  await runFFmpeg([
    '-y',
    '-ss', '00:00:01',
    '-i', inputPath,
    '-frames:v', '1',
    '-vf', 'scale=480:-1',
    outputPath
  ], 'Asset thumbnail');
  return outputPath;
}

async function optimizeAsset(inputPath, type, options = {}) {
  const ext = path.extname(inputPath).toLowerCase();
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Asset not found: ${inputPath}`);
  }

  if (AUDIO_EXTENSIONS.has(ext)) {
    return { optimizedPath: await optimizeAudio(inputPath, options.outputPath), previewPath: null };
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    const optimizedPath = await optimizeVideo(inputPath, options.outputPath, options);
    const previewPath = replaceExt(optimizedPath, '_preview', '.jpg');
    try {
      await generateThumbnail(optimizedPath, previewPath);
    } catch (error) {
      return { optimizedPath, previewPath: null, warning: error.message };
    }
    return { optimizedPath, previewPath };
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    return { optimizedPath: inputPath, previewPath: inputPath };
  }

  return { optimizedPath: inputPath, previewPath: null };
}

module.exports = {
  optimizeAsset,
  optimizeAudio,
  optimizeVideo,
  generateThumbnail
};
