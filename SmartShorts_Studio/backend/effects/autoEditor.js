const { runFFmpeg, RESOLUTION_MAP } = require('../utils/ffmpeg');

const MOOD_GRADES = {
  high_retention: { contrast: 1.08, saturation: 1.16, brightness: 0.01 },
  conversational: { contrast: 1.04, saturation: 1.06, brightness: 0.005 },
  tense: { contrast: 1.12, saturation: 1.02, brightness: -0.01 },
  uplifting: { contrast: 1.07, saturation: 1.14, brightness: 0.015 },
  clear: { contrast: 1.05, saturation: 1.08, brightness: 0.01 },
  narrative: { contrast: 1.06, saturation: 1.08, brightness: 0 },
  aggressive: { contrast: 1.13, saturation: 1.22, brightness: 0.005 },
  premium: { contrast: 1.08, saturation: 0.98, brightness: 0.005 },
  suspense: { contrast: 1.12, saturation: 0.92, brightness: -0.018 },
  funny: { contrast: 1.08, saturation: 1.20, brightness: 0.01 },
  meme: { contrast: 1.14, saturation: 1.26, brightness: 0.015 },
  documentary: { contrast: 1.08, saturation: 1.00, brightness: -0.004 },
  cinematic: { contrast: 1.10, saturation: 0.96, brightness: -0.006 }
};

function getMoodGrade(mood) {
  return MOOD_GRADES[mood] || MOOD_GRADES.high_retention;
}

function buildPolishFilter(aspectRatio, editPlan = {}) {
  const { w, h } = RESOLUTION_MAP[aspectRatio] || RESOLUTION_MAP['9:16'];
  const grade = getMoodGrade(editPlan.mood);
  const scaledW = Math.ceil((w * 1.032) / 2) * 2;
  const scaledH = Math.ceil((h * 1.032) / 2) * 2;
  const wiggleX = Math.max(4, Math.round((scaledW - w) * 0.18));
  const wiggleY = Math.max(4, Math.round((scaledH - h) * 0.18));
  const resetFlash = "drawbox=x=0:y=0:w=iw:h=ih:color=white@0.06:t=fill:enable='lt(mod(t\\,7.2)\\,0.055)'";

  return [
    `scale=${scaledW}:${scaledH}`,
    `crop=${w}:${h}:x='(in_w-${w})/2+sin(t*1.7)*${wiggleX}':y='(in_h-${h})/2+cos(t*1.25)*${wiggleY}'`,
    `eq=contrast=${grade.contrast}:saturation=${grade.saturation}:brightness=${grade.brightness}`,
    'unsharp=5:5:0.45:3:3:0.20',
    resetFlash,
    'format=yuv420p'
  ].join(',');
}

async function applyCreatorPolish(inputPath, outputPath, options = {}, clip = {}) {
  const filter = buildPolishFilter(options.aspectRatio || '9:16', clip.editPlan || {});

  await runFFmpeg([
    '-y',
    '-i', inputPath,
    '-vf', filter,
    '-c:v', 'libx264',
    '-preset', process.env.FFMPEG_PRESET || 'fast',
    '-crf', process.env.FFMPEG_CRF || '22',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    outputPath
  ], 'AI auto edit');

  return outputPath;
}

module.exports = {
  applyCreatorPolish,
  buildPolishFilter
};
