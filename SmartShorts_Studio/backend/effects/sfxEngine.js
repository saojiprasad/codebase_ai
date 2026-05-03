const fs = require('fs');
const path = require('path');

const SFX_DIR = path.resolve(__dirname, '../assets/sfx');
const SFX_FILE_CANDIDATES = {
  boom: ['boom.mp3'],
  whoosh: ['swoosh.mp3', 'whoosh.mp3'],
  swoosh: ['swoosh.mp3', 'whoosh.mp3'],
  click: ['click.mp3'],
  clap: ['clap.mp3'],
  laugh: ['laugh.mp3']
};

function escapeFilterPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function inferCueType(clip, index) {
  const text = `${clip.hookText || ''} ${clip.reason || ''}`.toLowerCase();
  if (index === 0) return 'boom';
  if (/\b(fun|laugh|joke|hilarious|ridiculous)\b/.test(text)) return 'laugh';
  if (/\b(clap|applause|win|success)\b/.test(text)) return 'clap';
  return index % 2 ? 'whoosh' : 'click';
}

function resolveSfxFile(type) {
  const candidates = SFX_FILE_CANDIDATES[type] || SFX_FILE_CANDIDATES.click;
  for (const file of candidates) {
    const filePath = path.join(SFX_DIR, file);
    if (fs.existsSync(filePath)) return filePath;
  }
  return path.join(SFX_DIR, candidates[0]);
}

function buildCueList(clip = {}) {
  const duration = Math.max(0.1, Number(clip.duration) || 0.1);
  const resets = clip.editPlan?.pacing?.attentionResetCount || Math.floor(duration / 3.2);
  const cues = [{ at: 0.12, type: 'boom' }, { at: Math.min(duration - 0.35, 2.2), type: 'whoosh' }];

  for (let i = 1; i <= Math.min(6, resets); i++) {
    cues.push({ at: Math.min(duration - 0.25, i * 3.1), type: inferCueType(clip, i) });
  }

  if ((clip.details?.energyScore || 0) > 55) {
    cues.push({ at: Math.min(duration - 0.3, duration * 0.45), type: 'boom' });
  }

  return cues.filter(cue => cue.at >= 0 && cue.at < duration).slice(0, 9);
}

function buildSyntheticFilter(type, delay, label) {
  if (type === 'boom') {
    return `sine=frequency=58:duration=0.28,volume=0.24,afade=t=out:st=0.12:d=0.16,adelay=${delay}|${delay}[${label}]`;
  }
  if (type === 'whoosh') {
    return `anoisesrc=color=pink:duration=0.34,highpass=f=850,lowpass=f=3600,volume=0.06,afade=t=in:st=0:d=0.05,afade=t=out:st=0.22:d=0.12,adelay=${delay}|${delay}[${label}]`;
  }
  if (type === 'laugh') {
    return `sine=frequency=520:duration=0.22,volume=0.055,tremolo=f=9:d=0.65,adelay=${delay}|${delay}[${label}]`;
  }
  if (type === 'clap') {
    return `anoisesrc=color=white:duration=0.07,highpass=f=1800,volume=0.09,adelay=${delay}|${delay}[${label}]`;
  }
  return `sine=frequency=1450:duration=0.055,volume=0.08,adelay=${delay}|${delay}[${label}]`;
}

function buildFileFilter(filePath, delay, label) {
  return `amovie='${escapeFilterPath(filePath)}',atrim=0:0.75,asetpts=PTS-STARTPTS,volume=0.16,adelay=${delay}|${delay}[${label}]`;
}

function buildSfxTracks(clip = {}) {
  return buildCueList(clip).map((cue, index) => {
    const label = `sfx${index}`;
    const delay = Math.round(cue.at * 1000);
    const filePath = resolveSfxFile(cue.type);
    return {
      label,
      filter: fs.existsSync(filePath)
        ? buildFileFilter(filePath, delay, label)
        : buildSyntheticFilter(cue.type, delay, label)
    };
  });
}

module.exports = {
  buildSfxTracks,
  SFX_DIR
};
