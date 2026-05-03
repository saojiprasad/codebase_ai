const fs = require('fs');
const { detectSceneChanges, findHighActivityRegions } = require('./sceneDetector');
const { detectSilence, detectEnergyPeaks, findTopEnergyMoments } = require('./audioAnalyzer');
const { analyzeTranscript, scoreTimeRange } = require('./transcriptAnalyzer');
const { scoreClipViral } = require('./viralScorer');
const { buildSeoPackage } = require('./seoEngine');
const { normalizeMode } = require('./retentionOptimizer');
const { getVideoDuration } = require('../utils/ffmpeg');
const { logAi } = require('../utils/logger');

const MODE_CONFIGS = {
  auto_viral: {
    targetDurations: [15, 30, 45, 60],
    hookWeight: 0.34,
    energyWeight: 0.23,
    sceneWeight: 0.14,
    pacingWeight: 0.17,
    retentionWeight: 0.12,
    minClipDuration: 14,
    maxClipDuration: 72,
    maxClips: 16
  },
  podcast: {
    targetDurations: [30, 45, 60, 75],
    hookWeight: 0.28,
    energyWeight: 0.14,
    sceneWeight: 0.08,
    pacingWeight: 0.28,
    retentionWeight: 0.22,
    minClipDuration: 24,
    maxClipDuration: 90,
    maxClips: 14
  },
  podcast_viral: {
    targetDurations: [20, 30, 45, 60],
    hookWeight: 0.35,
    energyWeight: 0.20,
    sceneWeight: 0.10,
    pacingWeight: 0.20,
    retentionWeight: 0.15,
    minClipDuration: 18,
    maxClipDuration: 75,
    maxClips: 18
  },
  debate: {
    targetDurations: [15, 30, 45, 60],
    hookWeight: 0.30,
    energyWeight: 0.30,
    sceneWeight: 0.12,
    pacingWeight: 0.18,
    retentionWeight: 0.10,
    minClipDuration: 12,
    maxClipDuration: 70,
    maxClips: 20
  },
  motivational: {
    targetDurations: [20, 30, 45, 60],
    hookWeight: 0.34,
    energyWeight: 0.18,
    sceneWeight: 0.08,
    pacingWeight: 0.22,
    retentionWeight: 0.18,
    minClipDuration: 18,
    maxClipDuration: 75,
    maxClips: 15
  },
  educational: {
    targetDurations: [30, 45, 60, 90],
    hookWeight: 0.27,
    energyWeight: 0.10,
    sceneWeight: 0.10,
    pacingWeight: 0.24,
    retentionWeight: 0.29,
    minClipDuration: 25,
    maxClipDuration: 100,
    maxClips: 14
  },
  storytelling: {
    targetDurations: [30, 45, 60, 75],
    hookWeight: 0.31,
    energyWeight: 0.14,
    sceneWeight: 0.10,
    pacingWeight: 0.20,
    retentionWeight: 0.25,
    minClipDuration: 24,
    maxClipDuration: 95,
    maxClips: 14
  },
  gaming: {
    targetDurations: [12, 20, 30, 45],
    hookWeight: 0.20,
    energyWeight: 0.36,
    sceneWeight: 0.24,
    pacingWeight: 0.15,
    retentionWeight: 0.05,
    minClipDuration: 10,
    maxClipDuration: 55,
    maxClips: 22
  },
  finance: {
    targetDurations: [20, 30, 45, 60],
    hookWeight: 0.36,
    energyWeight: 0.12,
    sceneWeight: 0.08,
    pacingWeight: 0.20,
    retentionWeight: 0.24,
    minClipDuration: 18,
    maxClipDuration: 75,
    maxClips: 15
  },
  dark_documentary: {
    targetDurations: [30, 45, 60],
    hookWeight: 0.34,
    energyWeight: 0.16,
    sceneWeight: 0.15,
    pacingWeight: 0.14,
    retentionWeight: 0.21,
    minClipDuration: 24,
    maxClipDuration: 85,
    maxClips: 14
  },
  comedy: {
    targetDurations: [12, 20, 30, 45],
    hookWeight: 0.26,
    energyWeight: 0.26,
    sceneWeight: 0.14,
    pacingWeight: 0.22,
    retentionWeight: 0.12,
    minClipDuration: 10,
    maxClipDuration: 55,
    maxClips: 22
  },
  documentary: {
    targetDurations: [30, 45, 60, 75],
    hookWeight: 0.30,
    energyWeight: 0.12,
    sceneWeight: 0.16,
    pacingWeight: 0.14,
    retentionWeight: 0.28,
    minClipDuration: 24,
    maxClipDuration: 95,
    maxClips: 14
  },
  meme_style: {
    targetDurations: [10, 15, 25, 35],
    hookWeight: 0.24,
    energyWeight: 0.30,
    sceneWeight: 0.16,
    pacingWeight: 0.24,
    retentionWeight: 0.06,
    minClipDuration: 8,
    maxClipDuration: 45,
    maxClips: 24
  },
  cinematic_storytelling: {
    targetDurations: [30, 45, 60, 75],
    hookWeight: 0.32,
    energyWeight: 0.14,
    sceneWeight: 0.12,
    pacingWeight: 0.18,
    retentionWeight: 0.24,
    minClipDuration: 24,
    maxClipDuration: 90,
    maxClips: 14
  }
};

function resolveConfig(mode) {
  const normalized = normalizeMode(mode);
  const config = MODE_CONFIGS[normalized] || MODE_CONFIGS.auto_viral;
  const targetDurations = [...new Set(config.targetDurations.map(duration => Math.min(duration, 58)))]
    .filter(duration => duration >= config.minClipDuration);

  return {
    ...config,
    targetDurations: targetDurations.length ? targetDurations : [Math.min(45, Math.max(config.minClipDuration, 30))],
    maxClipDuration: Math.min(config.maxClipDuration, 59)
  };
}

async function generateSmartClips(inputPath, srtPath, mode = 'auto_viral', onProgress = () => {}) {
  const normalizedMode = normalizeMode(mode);
  const config = resolveConfig(mode);

  logAi('SmartClipper started', { mode: normalizedMode });
  onProgress(5);

  const totalDuration = await getVideoDuration(inputPath);
  if (!totalDuration || totalDuration < 3) {
    logAi('SmartClipper stopped: video too short or duration unavailable', { totalDuration });
    return [];
  }
  onProgress(12);

  const scenes = await detectSceneChanges(inputPath, 0.28);
  const highActivity = findHighActivityRegions(scenes, 24, 2);
  logAi('SmartClipper visual analysis complete', {
    sceneChanges: scenes.length,
    highActivityRegions: highActivity.length
  });
  onProgress(28);

  const silences = await detectSilence(inputPath, -30, 0.45);
  const energyPeaks = await detectEnergyPeaks(inputPath, 2, totalDuration);
  console.log(`  [SmartClipper] Detected ${scenes.length} scene changes and ${energyPeaks.length} energy peaks.`);
  const topEnergy = findTopEnergyMoments(energyPeaks, 40);
  logAi('SmartClipper audio analysis complete', {
    silences: silences.length,
    energyPeaks: energyPeaks.length,
    topEnergyMoments: topEnergy.length
  });
  onProgress(48);

  let transcriptSegments = [];
  let transcriptSummary = null;
  if (srtPath && fs.existsSync(srtPath)) {
    console.log(`  [SmartClipper] Analyzing transcript for hooks: ${srtPath}`);
    const analysis = analyzeTranscript(fs.readFileSync(srtPath, 'utf-8'));
    console.log(`  [SmartClipper] Transcript analysis complete. Segments: ${analysis.segments.length}, Best hook score: ${analysis.overallHookScore}`);
    transcriptSegments = analysis.segments;
    transcriptSummary = {
      overallHookScore: analysis.overallHookScore,
      bestHook: analysis.bestHookSegment?.text || '',
      emotionMap: analysis.emotionMap
    };
    logAi('SmartClipper transcript analysis complete', {
      segments: transcriptSegments.length,
      bestHook: transcriptSummary.bestHook,
      overallHookScore: transcriptSummary.overallHookScore
    });
  } else {
    logAi('SmartClipper transcript unavailable, using audio/scene fallback');
  }
  onProgress(60);

  let candidates = generateCandidates(
    totalDuration,
    config,
    scenes,
    silences,
    topEnergy,
    transcriptSegments,
    highActivity
  );

  if (candidates.length === 0) {
    candidates = generateFallbackCandidates(totalDuration, config);
  }
  logAi('SmartClipper candidates generated', { candidates: candidates.length });
  onProgress(76);

  const scored = candidates.map(candidate => scoreCandidate(
    candidate,
    config,
    normalizedMode,
    scenes,
    silences,
    energyPeaks,
    transcriptSegments
  ));

  scored.sort((a, b) => b.viralScore - a.viralScore);
  const selected = removeOverlaps(scored, config.maxClips);
  const finalClips = (selected.length ? selected : scored.slice(0, config.maxClips))
    .sort((a, b) => a.start - b.start)
    .map((clip, index) => ({
      ...clip,
      seriesPart: index + 1,
      totalSeriesParts: Math.min(selected.length || scored.length, config.maxClips),
      analysisSummary: transcriptSummary
    }));

  logAi('SmartClipper final clips selected', {
    selected: finalClips.length,
    candidates: candidates.length,
    scores: finalClips.map(clip => ({
      start: clip.start,
      end: clip.end,
      viralScore: clip.viralScore,
      hookScore: clip.details?.hookScore,
      retentionScore: clip.details?.retentionScore
    }))
  });
  onProgress(100);
  return finalClips;
}

function generateCandidates(totalDuration, config, scenes, silences, topEnergy, transcriptSegments, highActivity) {
  const naturalBreaks = buildNaturalBreaks(totalDuration, scenes, silences, transcriptSegments);
  const seeds = new Set([0]);

  for (const seg of transcriptSegments) {
    if (seg.hookScore >= 8 || seg.hooks?.length) {
      seeds.add(Math.max(0, seg.start - 2.2));
    }
  }

  for (const peak of topEnergy) {
    seeds.add(Math.max(0, peak.timestamp - 4));
    seeds.add(Math.max(0, peak.timestamp - 9));
  }

  for (const scene of scenes) {
    seeds.add(Math.max(0, scene.timestamp - 1.2));
  }

  for (const region of highActivity) {
    seeds.add(Math.max(0, region.start - 1));
  }

  for (let t = 0; t < totalDuration; t += 30) {
    seeds.add(t);
  }

  const candidates = [];
  const seen = new Set();

  for (const rawStart of [...seeds].sort((a, b) => a - b)) {
    const start = snapToBreak(rawStart, naturalBreaks, 3, 'start');
    for (const targetDuration of config.targetDurations) {
      const roughEnd = start + targetDuration;
      if (roughEnd > totalDuration + 1) continue;
      const end = snapToBreak(Math.min(roughEnd, totalDuration), naturalBreaks, 6, 'end');
      const duration = end - start;
      if (duration < config.minClipDuration || duration > config.maxClipDuration) continue;

      const tightened = tightenDeadSpace({ start, end, duration }, silences, totalDuration, config);
      const key = `${Math.round(tightened.start * 10)}:${Math.round(tightened.end * 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        start: roundTime(tightened.start),
        end: roundTime(tightened.end),
        duration: roundTime(tightened.end - tightened.start)
      });
    }
  }

  return candidates.slice(0, 900);
}

function tightenDeadSpace(candidate, silences, totalDuration, config) {
  let start = candidate.start;
  let end = candidate.end;

  for (const silence of silences) {
    if (silence.start <= start + 0.25 && silence.end > start && silence.end - start <= 2.8) {
      start = Math.min(silence.end, end - config.minClipDuration);
    }
    if (silence.end >= end - 0.25 && silence.start < end && end - silence.start <= 2.8) {
      end = Math.max(silence.start, start + config.minClipDuration);
    }
  }

  start = Math.max(0, Math.min(start, totalDuration));
  end = Math.max(start + config.minClipDuration, Math.min(end, totalDuration));
  return { start, end };
}

function buildNaturalBreaks(totalDuration, scenes, silences, transcriptSegments) {
  const breaks = [0, totalDuration];
  silences.forEach(silence => {
    breaks.push(silence.start, silence.end);
  });
  scenes.forEach(scene => breaks.push(scene.timestamp));
  transcriptSegments.forEach(seg => {
    breaks.push(seg.start, seg.end);
  });

  return [...new Set(breaks
    .filter(time => Number.isFinite(time) && time >= 0 && time <= totalDuration)
    .map(time => roundTime(time)))]
    .sort((a, b) => a - b);
}

function generateFallbackCandidates(totalDuration, config) {
  const target = config.targetDurations[Math.min(1, config.targetDurations.length - 1)] || 45;
  const duration = Math.min(Math.max(target, config.minClipDuration), Math.min(config.maxClipDuration, totalDuration));
  const stride = Math.max(10, duration * 0.75);
  const candidates = [];

  for (let start = 0; start + config.minClipDuration <= totalDuration; start += stride) {
    const end = Math.min(totalDuration, start + duration);
    candidates.push({
      start: roundTime(start),
      end: roundTime(end),
      duration: roundTime(end - start)
    });
  }

  return candidates;
}

function snapToBreak(time, breakPoints, maxSnap = 5, direction = 'nearest') {
  let best = time;
  let bestDistance = maxSnap;

  for (const point of breakPoints) {
    if (direction === 'start' && point > time + maxSnap) continue;
    if (direction === 'end' && point < time - maxSnap) continue;

    const distance = Math.abs(point - time);
    if (distance <= bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }

  return Math.max(0, best);
}

function energyToScore(dbValue) {
  if (!Number.isFinite(dbValue)) return 20;
  return clamp(Math.round(105 - Math.abs(dbValue) * 2.35), 0, 100);
}

function scoreCandidate(clip, config, mode, scenes, silences, energyPeaks, transcriptSegments) {
  const { start, end, duration } = clip;
  const hookResult = transcriptSegments.length
    ? scoreTimeRange(transcriptSegments, start, end)
    : { score: 0, bestHook: '', emotion: 'neutral' };

  const inRangeEnergy = energyPeaks.filter(point => point.timestamp >= start && point.timestamp <= end);
  const energyScore = inRangeEnergy.length
    ? Math.round(inRangeEnergy.reduce((sum, point) => sum + energyToScore(point.energy), 0) / inRangeEnergy.length)
    : 24;

  const sceneCount = scenes.filter(scene => scene.timestamp >= start && scene.timestamp <= end).length;
  const sceneScore = clamp(Math.round((sceneCount / Math.max(1, duration / 12)) * 18), 0, 100);

  const openingEnd = start + Math.min(8, duration * 0.28);
  const openingHook = transcriptSegments
    .filter(seg => seg.start >= start && seg.start <= openingEnd)
    .reduce((sum, seg) => sum + (seg.hookScore || 0), 0);
  const pacingScore = clamp(Math.round(openingHook * 2.4 + sceneCount * 4 + (duration <= 45 ? 14 : 4)), 0, 100);

  const silenceSeconds = silences
    .filter(silence => silence.end > start && silence.start < end)
    .reduce((sum, silence) => sum + Math.min(silence.end, end) - Math.max(silence.start, start), 0);
  const silencePenalty = clamp(Math.round((silenceSeconds / duration) * 35), 0, 35);

  const completionScore = transcriptSegments.length
    ? scoreStoryCompletion(start, end, transcriptSegments)
    : 45;
  const retentionScore = clamp(Math.round(
    hookResult.score * 0.32 +
    pacingScore * 0.26 +
    energyScore * 0.18 +
    completionScore * 0.24 -
    silencePenalty
  ), 0, 100);

  const engagementPrediction = clamp(Math.round(
    hookResult.score * 0.35 + energyScore * 0.25 + pacingScore * 0.25 + sceneScore * 0.15
  ), 0, 100);
  const replayPotential = clamp(Math.round(
    hookResult.score * 0.34 + retentionScore * 0.28 + (duration <= 35 ? 24 : 10) + sceneScore * 0.12
  ), 0, 100);

  const weightedScore = clamp(Math.round(
    hookResult.score * config.hookWeight +
    energyScore * config.energyWeight +
    sceneScore * config.sceneWeight +
    pacingScore * config.pacingWeight +
    retentionScore * config.retentionWeight -
    silencePenalty
  ), 0, 100);

  const baseClip = {
    ...clip,
    viralScore: weightedScore,
    hookText: hookResult.bestHook,
    emotion: hookResult.emotion,
    reason: buildReason(hookResult.score, energyScore, sceneScore, retentionScore, transcriptSegments, start, end),
    details: {
      hookScore: hookResult.score,
      energyScore,
      sceneScore,
      pacingScore,
      retentionScore,
      engagementPrediction,
      replayPotential,
      completionScore,
      silencePenalty
    }
  };

  const viral = scoreClipViral(baseClip);
  const seo = buildSeoPackage({ ...baseClip, viralScore: viral.viralScore }, mode);

  return {
    ...baseClip,
    viralScore: Math.max(weightedScore, viral.viralScore),
    grade: viral.grade,
    title: seo.title,
    description: seo.description,
    hashtags: seo.hashtags,
    seo
  };
}

function scoreStoryCompletion(start, end, transcriptSegments) {
  const inRange = transcriptSegments.filter(seg => seg.start >= start && seg.end <= end);
  if (!inRange.length) return 35;

  const firstGap = Math.abs(inRange[0].start - start);
  const lastGap = Math.abs(end - inRange[inRange.length - 1].end);
  const boundaryScore = clamp(100 - Math.round((firstGap + lastGap) * 10), 0, 100);
  const sentenceEndBonus = /[.!?]"?$/.test(inRange[inRange.length - 1].text.trim()) ? 15 : 0;
  return clamp(boundaryScore + sentenceEndBonus, 0, 100);
}

function buildReason(hookScore, energyScore, sceneScore, retentionScore, segments, start, end) {
  const text = segments
    .filter(seg => seg.start >= start && seg.end <= end)
    .map(seg => seg.text)
    .join(' ')
    .toLowerCase();

  if (/\b(wrong|truth|lie|fake|scam|controversial|argument)\b/.test(text)) return 'Controversial truth or argument';
  if (/\b(laugh|funny|joke|hilarious)\b/.test(text)) return 'Funny replayable moment';
  if (hookScore >= 55) return 'Strong hook detected';
  if (retentionScore >= 70) return 'High retention story arc';
  if (energyScore >= 65) return 'High-energy emotional peak';
  if (sceneScore >= 55) return 'Dynamic visual activity';
  return 'Clean short-form story moment';
}

function removeOverlaps(sortedByScore, maxClips) {
  const selected = [];

  for (const clip of sortedByScore) {
    if (selected.length >= maxClips) break;
    const isDuplicate = selected.some(existing => {
      const overlapStart = Math.max(existing.start, clip.start);
      const overlapEnd = Math.min(existing.end, clip.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      const smallerDuration = Math.min(existing.duration, clip.duration);
      const largerDuration = Math.max(existing.duration, clip.duration);
      const overlapRatio = overlap / Math.max(1, smallerDuration);
      const centerDistance = Math.abs(((existing.start + existing.end) / 2) - ((clip.start + clip.end) / 2));
      const startDistance = Math.abs(existing.start - clip.start);
      const endDistance = Math.abs(existing.end - clip.end);
      const sameWindow = startDistance < 8 && endDistance < 8;
      const sameStoryBeat = centerDistance < Math.min(18, largerDuration * 0.35);
      return overlapRatio > 0.18 || sameWindow || sameStoryBeat;
    });

    if (!isDuplicate) selected.push(clip);
  }

  return selected;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundTime(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  generateSmartClips,
  MODE_CONFIGS,
  resolveConfig
};
