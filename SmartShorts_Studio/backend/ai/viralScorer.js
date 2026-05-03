function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreClipViral(clip, metadata = {}) {
  const hookScore = clip.details?.hookScore ?? clip.viralScore ?? 0;
  const energyScore = clip.details?.energyScore ?? 30;
  const sceneScore = clip.details?.sceneScore ?? 20;
  const pacingScore = clip.details?.pacingScore ?? 25;

  let durationBonus = 0;
  if (clip.duration >= 15 && clip.duration <= 60) durationBonus = 10;
  else if (clip.duration > 60 && clip.duration <= 90) durationBonus = 5;

  const openingBonus = hookScore > 30 ? 10 : 0;
  const viralScore = clamp(Math.round(
    hookScore * 0.30 +
    energyScore * 0.25 +
    sceneScore * 0.15 +
    pacingScore * 0.15 +
    durationBonus +
    openingBonus
  ));

  const retentionScore = clamp(Math.round(
    (hookScore * 0.4 + pacingScore * 0.3 + energyScore * 0.3) * 0.8 + durationBonus
  ));

  let grade = 'D';
  if (viralScore >= 80) grade = 'S';
  else if (viralScore >= 65) grade = 'A';
  else if (viralScore >= 50) grade = 'B';
  else if (viralScore >= 35) grade = 'C';

  return {
    viralScore,
    hookScore,
    energyScore,
    sceneScore,
    pacingScore,
    retentionScore,
    engagementPrediction: clip.details?.engagementPrediction ?? viralScore,
    replayPotential: clip.details?.replayPotential ?? retentionScore,
    grade
  };
}

function generateTips(scores) {
  const tips = [];
  if (scores.hookScore < 30) tips.push('Weak hook: use a stronger first line or open closer to the peak.');
  if (scores.energyScore < 30) tips.push('Low energy: keep music/sound design enabled for more lift.');
  if (scores.pacingScore < 30) tips.push('Slow pacing: shorten dead air or add more attention resets.');
  if (scores.retentionScore < 40) tips.push('Retention risk: use a shorter clip or stronger subtitle emphasis.');
  if (scores.viralScore >= 70) tips.push('High viral potential: prioritize this clip first.');
  return tips;
}

module.exports = { scoreClipViral, generateTips };
