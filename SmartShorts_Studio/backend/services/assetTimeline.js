const fs = require('fs');
const path = require('path');

function clampTime(value, duration) {
  return Number(Math.max(0, Math.min(Math.max(0.1, duration - 0.12), value)).toFixed(2));
}

function publicAsset(asset) {
  if (!asset) return null;
  return {
    name: asset.name,
    type: asset.type,
    category: asset.category,
    path: asset.publicUrl,
    mood: asset.mood,
    energy: asset.energy
  };
}

function buildEffectTimeline(clip = {}, selection = {}) {
  const duration = Math.max(0.1, Number(clip.duration) || 0.1);
  const moment = selection.moment || 'high_retention';
  const timeline = [];

  timeline.push({ time: 0, effect: 'punch_zoom', intensity: moment === 'shocking' ? 0.12 : 0.07 });
  timeline.push({ time: clampTime(Math.min(2.8, duration * 0.18), duration), effect: 'attention_reset' });

  if (selection.sfx?.[0]) {
    timeline.push({ time: clampTime(moment === 'funny' ? 0.45 : 0.14, duration), sound: publicAsset(selection.sfx[0]) });
  }
  if (selection.transitions?.[0]) {
    timeline.push({ time: clampTime(duration * 0.33, duration), transition: publicAsset(selection.transitions[0]) });
  }
  if (selection.overlays?.[0]) {
    timeline.push({ time: clampTime(moment === 'emotional' ? duration * 0.18 : duration * 0.12, duration), overlay: publicAsset(selection.overlays[0]) });
  }
  if (selection.broll) {
    timeline.push({
      time: clampTime(Math.max(1.2, duration * 0.38), duration),
      broll: publicAsset(selection.broll),
      duration: Number(Math.min(3.5, duration * 0.28).toFixed(2))
    });
  }
  if (selection.stickers?.[0]) {
    timeline.push({ time: clampTime(duration * 0.72, duration), sticker: publicAsset(selection.stickers[0]), action: 'cta_pop' });
  }

  timeline.push({ time: clampTime(duration - 0.8, duration), effect: 'replay_loop_ending' });
  return timeline.sort((a, b) => a.time - b.time);
}

function writeClipTimeline(jobOutputDir, partNumber, timeline) {
  const filePath = path.join(jobOutputDir, `Part_${String(partNumber).padStart(2, '0')}_timeline.json`);
  fs.writeFileSync(filePath, JSON.stringify(timeline, null, 2));
  return filePath;
}

function writeJobTimeline(jobOutputDir, clipTimelines) {
  const filePath = path.join(jobOutputDir, 'timeline.json');
  fs.writeFileSync(filePath, JSON.stringify(clipTimelines, null, 2));
  return filePath;
}

module.exports = {
  buildEffectTimeline,
  writeClipTimeline,
  writeJobTimeline
};
