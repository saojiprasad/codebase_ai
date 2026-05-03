function buildTransitionFilters(clip = {}) {
  const duration = Math.max(0.1, Number(clip.duration) || 0.1);
  const resetEvery = Math.max(2.2, Math.min(4.0, clip.editPlan?.pacing?.cutEverySeconds || 3.1));
  const energy = clip.details?.energyScore || 35;
  const hookScore = clip.details?.hookScore || 35;
  const effectScale = ({ low: 0.55, medium: 0.82, aggressive: 1.08 })[clip.effectsLevel || 'aggressive'] || 1;
  const flashStrength = Math.min(0.24, (energy > 65 || hookScore > 65 ? 0.18 : 0.11) * effectScale);
  const darkFrameStrength = Math.min(0.20, (energy > 70 ? 0.16 : 0.09) * effectScale);
  const resetWindow = Math.min(0.13, (energy > 65 ? 0.10 : 0.07) * effectScale);
  const progressHeight = energy > 65 ? 14 : 10;

  return [
    `drawbox=x=0:y=0:w=iw:h=ih:color=white@${flashStrength}:t=fill:enable='between(t\\,0\\,0.10)'`,
    `drawbox=x=0:y=0:w=iw:h=ih:color=white@0.10:t=fill:enable='lt(mod(t\\,${resetEvery.toFixed(2)})\\,${resetWindow.toFixed(2)})'`,
    `drawbox=x=0:y=0:w=iw:h=ih:color=black@${darkFrameStrength}:t=fill:enable='between(mod(t\\,${(resetEvery * 2).toFixed(2)})\\,0.12\\,0.17)'`,
    `drawbox=x=0:y=0:w=iw:h=12:color=white@0.25:t=fill:enable='lt(mod(t\\,${resetEvery.toFixed(2)})\\,${resetWindow.toFixed(2)})'`,
    `drawbox=x=0:y=ih-12:w=iw:h=12:color=white@0.20:t=fill:enable='lt(mod(t\\,${resetEvery.toFixed(2)})\\,${resetWindow.toFixed(2)})'`,
    `drawbox=x=0:y=ih-${progressHeight}:w='iw*(t/${duration})':h=${progressHeight}:color=0xffd400@0.95:t=fill`
  ];
}

module.exports = {
  buildTransitionFilters
};
