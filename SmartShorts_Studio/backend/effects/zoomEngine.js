const { RESOLUTION_MAP } = require('../utils/ffmpeg');

function even(value) {
  return Math.ceil(value / 2) * 2;
}

function buildZoomAndCropFilters({ aspectRatio = '9:16', cropMode = 'smart_crop', faceFocus = null, clip = {} }) {
  const { w, h } = RESOLUTION_MAP[aspectRatio] || RESOLUTION_MAP['9:16'];
  const energy = clip.details?.energyScore || 35;
  const retention = clip.details?.retentionScore || 35;
  const zoomStyle = clip.editPlan?.visual?.zoomStyle || 'mixed';
  const cutEvery = Math.max(2.2, Math.min(4.2, clip.editPlan?.pacing?.cutEverySeconds || 3.0));
  const effectScale = ({ low: 0.62, medium: 0.88, aggressive: 1.12 })[clip.effectsLevel || 'aggressive'] || 1;
  const baseZoomMultiplier = energy > 65 || zoomStyle === 'reaction' || zoomStyle === 'fast'
    ? 1.22
    : retention > 65 || zoomStyle === 'slow_push'
      ? 1.17
      : 1.13;
  const zoomMultiplier = 1 + ((baseZoomMultiplier - 1) * effectScale);
  const zoomW = even(w * zoomMultiplier);
  const zoomH = even(h * zoomMultiplier);
  const shakeX = Math.max(3, Math.round(w * (energy > 65 || zoomStyle === 'reaction' ? 0.020 : 0.010) * effectScale));
  const shakeY = Math.max(3, Math.round(h * (energy > 65 || zoomStyle === 'reaction' ? 0.013 : 0.007) * effectScale));

  let xExpression = `(in_w-${w})/2`;
  if (cropMode === 'smart_crop' && faceFocus) {
    const xRatio = Number(faceFocus.xRatio.toFixed(4));
    xExpression = `max(0,min(in_w-${w},${xRatio}*in_w-${w}/2))`;
  }

  const yExpression = `(in_h-${h})/2`;
  const punchPulse = `lt(mod(t\\,${cutEvery.toFixed(2)})\\,0.18)`;
  const slowDrift = `sin(t*0.55)*${Math.max(2, Math.round(w * 0.007))}`;
  const slowPush = zoomStyle === 'slow_push' || zoomStyle === 'cinematic'
    ? `+sin(t*0.22)*${Math.max(2, Math.round(w * 0.008))}`
    : '';
  const moveX = `${xExpression}+${slowDrift}${slowPush}+sin(t*10)*${shakeX}*${punchPulse}`;
  const moveY = `${yExpression}+cos(t*8)*${shakeY}*${punchPulse}`;

  return [
    `scale='trunc(max(${zoomW},a*${zoomH})/2)*2':'trunc(max(${zoomH},${zoomW}/a)/2)*2'`,
    `crop=${w}:${h}:x='max(0,min(in_w-${w},${moveX}))':y='max(0,min(in_h-${h},${moveY}))'`
  ];
}

module.exports = {
  buildZoomAndCropFilters
};
