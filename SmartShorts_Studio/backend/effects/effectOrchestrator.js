const fs = require('fs');
const path = require('path');

const { runFFmpeg, RESOLUTION_MAP } = require('../utils/ffmpeg');
const { searchAssets, ASSET_ROOT } = require('../services/assetLibrary');

const SOUND_CATEGORY = {
  whoosh: ['whooshes', 'transitions'],
  impact: ['impacts', 'cinematic'],
  bassdrop: ['bass_drops', 'impacts'],
  pop: ['meme', 'transitions'],
  glitch: ['glitches'],
  laugh: ['laugh', 'meme'],
  clap: ['crowd', 'cinematic'],
  cash: ['meme', 'impacts']
};

function assetFile(asset) {
  if (!asset) return null;
  const filePath = path.resolve(ASSET_ROOT, asset.relativePath);
  return fs.existsSync(filePath) ? filePath : null;
}

function pickSound(name) {
  const categories = SOUND_CATEGORY[name] || ['impacts'];
  return searchAssets({ type: 'sfx', enabledOnly: true })
    .find(asset => categories.includes(asset.category));
}

function pickMusic(clip = {}) {
  const text = `${clip.hookText || ''} ${clip.reason || ''}`.toLowerCase();
  const categories = /\b(game|hype|crazy|insane)\b/.test(text)
    ? ['gaming', 'motivational']
    : /\b(sad|story|feel|emotional)\b/.test(text)
      ? ['emotional', 'lofi']
      : /\b(warning|dark|truth|secret)\b/.test(text)
        ? ['dark', 'cinematic']
        : ['lofi', 'cinematic', 'motivational'];
  return searchAssets({ type: 'bgm', enabledOnly: true }).find(asset => categories.includes(asset.category));
}

function enableBetween(time, duration) {
  return `between(t\\,${Number(time).toFixed(2)}\\,${Number(time + duration).toFixed(2)})`;
}

function buildVideoFilter(timeline = [], options = {}) {
  const { w, h } = RESOLUTION_MAP[options.aspectRatio || '9:16'] || RESOLUTION_MAP['9:16'];
  const filters = [
    'eq=contrast=1.07:saturation=1.12:brightness=0.006',
    'unsharp=5:5:0.38:3:3:0.15'
  ];

  const shakeEvents = timeline.filter(event => event.type === 'shake' || event.type === 'zoom');
  if (shakeEvents.length) {
    const expr = shakeEvents.map(event => `${Math.round(event.intensity || 8)}*${enableBetween(event.time, event.duration || 0.35)}`).join('+');
    filters.push(`scale=${w + 60}:${h + 90}`);
    filters.push(`crop=${w}:${h}:x='30+sin(t*48)*(${expr})':y='45+cos(t*38)*(${expr}*0.55)'`);
  }

  timeline.filter(event => event.type === 'flash').forEach(event => {
    filters.push(`drawbox=x=0:y=0:w=iw:h=ih:color=white@${event.intensity || 0.16}:t=fill:enable='${enableBetween(event.time, event.duration || 0.08)}'`);
  });

  timeline.filter(event => event.type === 'rgb_split').forEach(event => {
    filters.push(`drawbox=x=0:y=0:w=iw:h=ih:color=0x00ffff@0.10:t=fill:enable='${enableBetween(event.time, event.duration || 0.18)}'`);
    filters.push(`drawbox=x=18:y=0:w=iw-18:h=ih:color=0xff0044@0.08:t=fill:enable='${enableBetween(event.time, event.duration || 0.18)}'`);
  });

  timeline.filter(event => event.type === 'emoji').forEach((event, index) => {
    const y = index % 2 ? Math.round(h * 0.24) : Math.round(h * 0.17);
    const x = index % 2 ? Math.round(w * 0.62) : Math.round(w * 0.12);
    const text = String(event.emoji || 'FIRE').replace(/:/g, '').replace(/'/g, '');
    filters.push(`drawtext=text='${text}':x='${x}+sin((t-${event.time})*9)*18':y='${y}-abs(sin((t-${event.time})*5))*35':fontsize=72:fontcolor=white:borderw=6:bordercolor=black@0.82:enable='${enableBetween(event.time, event.duration || 0.9)}'`);
  });

  timeline.filter(event => event.type === 'caption_pop').forEach(event => {
    filters.push(`drawbox=x=54:y=${Math.round(h * 0.78)}:w=${w - 108}:h=8:color=0xffd400@0.9:t=fill:enable='${enableBetween(event.time, event.duration || 0.4)}'`);
  });

  timeline.filter(event => event.type === 'replay_loop').forEach(event => {
    filters.push(`drawtext=text='WATCH AGAIN':x=(w-text_w)/2:y=${Math.round(h * 0.08)}:fontsize=54:fontcolor=white:borderw=5:bordercolor=black@0.85:enable='${enableBetween(event.time, event.duration || 0.55)}'`);
  });

  filters.push('format=yuv420p');
  return `[0:v]${filters.join(',')}[vout]`;
}

function buildAudioGraph({ timeline = [], hasVoice, hasMusic, musicVolume }) {
  const filters = [];
  if (hasVoice && hasMusic) {
    filters.push('[0:a]volume=1.08,loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[voice][voice_side]');
  } else if (hasVoice) {
    filters.push('[0:a]volume=1.08,loudnorm=I=-16:TP=-1.5:LRA=11[voice]');
  } else {
    filters.push('anullsrc=channel_layout=stereo:sample_rate=44100:d=60,asplit=2[voice][voice_side]');
  }

  if (hasMusic) {
    filters.push(`[1:a]volume=${musicVolume},afade=t=in:st=0:d=0.4[bgm_raw]`);
    filters.push('[bgm_raw][voice_side]sidechaincompress=threshold=0.04:ratio=9:attack=24:release=480[bgm]');
  }

  const audioInputs = ['[voice]'];
  if (hasMusic) audioInputs.push('[bgm]');

  timeline.filter(event => event.type === 'sfx' && event.filePath).forEach((event, index) => {
    const label = `sfx${index}`;
    const delay = Math.max(0, Math.round(event.time * 1000));
    const escaped = event.filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/ /g, '\\ ').replace(/'/g, "\\'");
    filters.push(`amovie='${escaped}',atrim=0:1.2,asetpts=PTS-STARTPTS,volume=0.28,adelay=${delay}|${delay}[${label}]`);
    audioInputs.push(`[${label}]`);
  });

  filters.push(`${audioInputs.join('')}amix=inputs=${audioInputs.length}:duration=first:dropout_transition=0,loudnorm=I=-15:TP=-1.2:LRA=10[aout]`);
  return filters.join(';');
}

async function applyEffectOrchestration({ inputPath, outputPath, clip = {}, timeline = [], options = {}, metadata = {} }) {
  const timelineWithFiles = timeline.map(event => {
    if (event.type !== 'sfx') return event;
    return { ...event, filePath: assetFile(pickSound(event.sound)) };
  });
  const musicPath = assetFile(pickMusic(clip));
  const hasMusic = options.enableAudio !== false && Boolean(musicPath);
  const hasVoice = metadata.audioChannels === undefined ? true : (metadata.audioChannels || 0) > 0;
  const musicVolume = typeof options.musicVolume === 'number' ? options.musicVolume : 0.13;

  const args = ['-y', '-i', inputPath];
  if (hasMusic) args.push('-stream_loop', '-1', '-i', musicPath);

  const filterGraph = [
    buildVideoFilter(timelineWithFiles, options),
    buildAudioGraph({ timeline: timelineWithFiles, hasVoice, hasMusic, musicVolume })
  ].join(';');

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

  await runFFmpeg(args, 'AI effect orchestration');
  return outputPath;
}

module.exports = {
  applyEffectOrchestration,
  pickSound,
  pickMusic
};
