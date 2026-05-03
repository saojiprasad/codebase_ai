const fs = require('fs');
const { runFFmpeg, RESOLUTION_MAP, getFaceFocus } = require('../utils/ffmpeg');
const { buildZoomAndCropFilters } = require('./zoomEngine');
const { buildVisualEnhancementFilters } = require('./visualEnhancer');
const { buildTransitionFilters } = require('./transitionEngine');
const { buildHookOverlayFilters } = require('./hookOverlayEngine');
const { buildSubtitleBurnFilter } = require('./subtitleEngine');
const { buildSfxTracks } = require('./sfxEngine');
const { selectMusicPath } = require('./musicEngine');
const { logRender } = require('../utils/logger');

function buildVideoFilters({ subtitlePath, aspectRatio, cropMode, faceFocus, clip, partNumber }) {
  const { h } = RESOLUTION_MAP[aspectRatio] || RESOLUTION_MAP['9:16'];
  const filters = [
    ...buildZoomAndCropFilters({ aspectRatio, cropMode, faceFocus, clip }),
    ...buildVisualEnhancementFilters(clip),
    ...buildTransitionFilters(clip),
    ...buildHookOverlayFilters(clip)
  ];

  const subtitleFilter = buildSubtitleBurnFilter(subtitlePath);
  if (subtitleFilter) filters.push(subtitleFilter);

  filters.push(
    `drawtext=text='PART ${partNumber}':fontsize=${Math.round(h * 0.026)}:fontcolor=white:x=(w-text_w)/2:y=${Math.round(h * 0.028)}:borderw=4:bordercolor=black@0.9:box=1:boxcolor=black@0.42:boxborderw=14`,
    'format=yuv420p'
  );

  return `[0:v]${filters.join(',')}[vout]`;
}

function buildAudioFilters({ hasAudio, hasMusic, clip, musicVolume, enableSfx }) {
  const duration = Math.max(0.1, Number(clip.duration) || 0.1);
  const filters = [];
  const sfx = enableSfx ? buildSfxTracks(clip) : [];

  if (hasAudio && hasMusic) {
    filters.push('[0:a]volume=1.08,loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[voice][voice_side]');
  } else if (hasAudio) {
    filters.push('[0:a]volume=1.08,loudnorm=I=-16:TP=-1.5:LRA=11[voice]');
  } else if (hasMusic) {
    filters.push(`anullsrc=channel_layout=stereo:sample_rate=44100:d=${duration},asplit=2[voice][voice_side]`);
  } else {
    filters.push(`anullsrc=channel_layout=stereo:sample_rate=44100:d=${duration}[voice]`);
  }

  if (hasMusic) {
    const fadeOutStart = Math.max(0, duration - 0.85).toFixed(2);
    filters.push(`[1:a]volume=${musicVolume},afade=t=in:st=0:d=0.45,afade=t=out:st=${fadeOutStart}:d=0.8[bgm_raw]`);
    filters.push('[bgm_raw][voice_side]sidechaincompress=threshold=0.045:ratio=9:attack=30:release=520[bgm]');
  }

  sfx.forEach(item => filters.push(item.filter));

  const inputs = ['[voice]'];
  if (hasMusic) inputs.push('[bgm]');
  sfx.forEach(item => inputs.push(`[${item.label}]`));
  filters.push(`${inputs.join('')}amix=inputs=${inputs.length}:duration=first:dropout_transition=0,loudnorm=I=-15:TP=-1.2:LRA=10[aout]`);

  return filters.join(';');
}

async function renderFinalClip({
  inputPath,
  outputPath,
  subtitlePath,
  musicPath,
  partNumber,
  clip,
  options = {},
  metadata = {}
}) {
  const aspectRatio = options.aspectRatio || '9:16';
  const cropMode = options.cropMode || 'smart_crop';
  const renderClip = { ...clip, effectsLevel: options.effectsLevel || clip.effectsLevel || 'aggressive' };
  const faceFocus = cropMode === 'smart_crop' ? await getFaceFocus(inputPath) : null;
  const selectedMusic = musicPath || selectMusicPath(renderClip);
  const enableBgm = options.enableAudio !== false && options.enableBgm !== false;
  const enableSfx = options.enableAudio !== false && options.enableSfx !== false;
  const hasMusic = enableBgm && selectedMusic && fs.existsSync(selectedMusic);
  const hasAudio = (metadata.audioChannels || 0) > 0;
  const musicVolume = typeof options.musicVolume === 'number' ? options.musicVolume : 0.14;

  const filterGraph = [
    buildVideoFilters({ subtitlePath, aspectRatio, cropMode, faceFocus, clip: renderClip, partNumber }),
    buildAudioFilters({ hasAudio, hasMusic, clip: renderClip, musicVolume, enableSfx })
  ].join(';');
  const sfxCount = enableSfx ? buildSfxTracks(renderClip).length : 0;
  logRender('Final renderer assembled FFmpeg graph', {
    input: inputPath,
    output: outputPath,
    aspectRatio,
    cropMode,
    faceTracking: Boolean(faceFocus),
    subtitles: Boolean(subtitlePath && fs.existsSync(subtitlePath)),
    music: hasMusic ? selectedMusic : 'missing_or_disabled',
    bgmEnabled: enableBgm,
    sfxEnabled: enableSfx,
    sfxCount,
    hasSourceAudio: hasAudio,
    effectsLevel: renderClip.effectsLevel,
    humanEditorLayer: true,
    hookOverlay: Boolean(renderClip.hookText || renderClip.title || renderClip.reason),
    visualEffects: 'zoom_flash_focus_grade_caption_burn'
  });

  const args = ['-y', '-i', inputPath];
  if (hasMusic) {
    args.push('-stream_loop', '-1', '-i', selectedMusic);
  }

  args.push(
    '-filter_complex', filterGraph,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', process.env.FFMPEG_PRESET || 'fast',
    '-crf', process.env.FFMPEG_CRF || '22',
    '-threads', process.env.FFMPEG_THREADS || '0',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    outputPath
  );

  await runFFmpeg(args, 'Final viral render');
  return outputPath;
}

module.exports = {
  renderFinalClip
};
