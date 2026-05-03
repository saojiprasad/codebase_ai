const EMOJI_MAP = {
  money: '$$$',
  funny: 'LOL',
  shocking: 'WOW',
  hype: 'FIRE',
  success: 'CLAP',
  controversy: 'BOOM'
};

function getText(clip = {}) {
  return `${clip.hookText || ''} ${clip.reason || ''} ${clip.title || ''} ${(clip.hashtags || []).join(' ')}`.toLowerCase();
}

function classifyTriggers(clip = {}) {
  const text = getText(clip);
  const triggers = new Set();
  const energy = clip.details?.energyScore || clip.viralScore || 0;

  if (energy > 65 || /\b(insane|crazy|secret|shocking|unbelievable|exposed|warning)\b/.test(text)) triggers.add('shocking');
  if (/\b(money|cash|million|billion|rich|business|sales|profit|finance)\b/.test(text)) triggers.add('money');
  if (/\b(fun|funny|laugh|joke|hilarious|ridiculous|meme)\b/.test(text)) triggers.add('funny');
  if (/\b(win|success|growth|best|achieve|finally)\b/.test(text)) triggers.add('success');
  if (/\b(wrong|fight|debate|argument|controversy|truth)\b/.test(text)) triggers.add('controversy');
  if (/\b(game|gaming|anime|speed|stream)\b/.test(text)) triggers.add('hype');
  if (!triggers.size) triggers.add('hype');
  return Array.from(triggers);
}

function clamp(time, duration) {
  return Number(Math.max(0, Math.min(Math.max(0.1, duration - 0.08), time)).toFixed(2));
}

function buildTimedResets(duration, cutEvery) {
  const events = [];
  for (let t = cutEvery; t < duration - 0.4; t += cutEvery) {
    events.push({ type: 'flash', time: clamp(t, duration), duration: 0.08, intensity: 0.12 });
    events.push({ type: 'zoom', time: clamp(t + 0.03, duration), duration: 0.42, intensity: 0.07 });
    events.push({ type: 'sfx', sound: 'whoosh', time: clamp(t + 0.02, duration) });
  }
  return events;
}

function buildAiTimeline(clip = {}, editPlan = {}) {
  const duration = Math.max(0.1, Number(clip.duration) || 0.1);
  const cutEvery = Math.max(2.2, Math.min(4.0, editPlan.pacing?.cutEverySeconds || 3.1));
  const triggers = classifyTriggers(clip);
  const timeline = [
    { type: 'zoom', time: 0.05, duration: 0.55, intensity: 0.09 },
    { type: 'sfx', sound: triggers.includes('shocking') ? 'impact' : 'pop', time: 0.12 },
    { type: 'caption_pop', time: 0.16, duration: 0.5 }
  ];

  timeline.push(...buildTimedResets(duration, cutEvery));

  triggers.forEach((trigger, index) => {
    const anchor = clamp(0.65 + index * Math.max(0.75, duration / (triggers.length + 2)), duration);
    if (trigger === 'money') {
      timeline.push({ type: 'emoji', emoji: EMOJI_MAP.money, time: anchor, duration: 1.1 });
      timeline.push({ type: 'broll', topic: 'finance', time: clamp(duration * 0.42, duration), duration: Math.min(3.2, duration * 0.24) });
      timeline.push({ type: 'sfx', sound: 'cash', time: clamp(anchor + 0.02, duration) });
    }
    if (trigger === 'funny') {
      timeline.push({ type: 'emoji', emoji: EMOJI_MAP.funny, time: anchor, duration: 1.0 });
      timeline.push({ type: 'sfx', sound: 'laugh', time: clamp(anchor + 0.02, duration) });
      timeline.push({ type: 'shake', time: anchor, duration: 0.32, intensity: 10 });
    }
    if (trigger === 'shocking') {
      timeline.push({ type: 'flash', time: anchor, duration: 0.09, intensity: 0.28 });
      timeline.push({ type: 'shake', time: anchor, duration: 0.38, intensity: 14 });
      timeline.push({ type: 'rgb_split', time: anchor, duration: 0.18 });
      timeline.push({ type: 'sfx', sound: 'bassdrop', time: clamp(anchor + 0.01, duration) });
      timeline.push({ type: 'emoji', emoji: EMOJI_MAP.shocking, time: clamp(anchor + 0.08, duration), duration: 0.9 });
    }
    if (trigger === 'success') {
      timeline.push({ type: 'emoji', emoji: EMOJI_MAP.success, time: anchor, duration: 1.0 });
      timeline.push({ type: 'sfx', sound: 'clap', time: clamp(anchor + 0.04, duration) });
    }
    if (trigger === 'controversy') {
      timeline.push({ type: 'rgb_split', time: anchor, duration: 0.28 });
      timeline.push({ type: 'sfx', sound: 'glitch', time: clamp(anchor + 0.02, duration) });
    }
    if (trigger === 'hype') {
      timeline.push({ type: 'emoji', emoji: EMOJI_MAP.hype, time: anchor, duration: 0.9 });
    }
  });

  timeline.push({ type: 'speed_ramp', time: clamp(duration * 0.72, duration), duration: Math.min(0.7, duration * 0.12) });
  timeline.push({ type: 'replay_loop', time: clamp(duration - 0.7, duration), duration: 0.55 });
  return timeline.sort((a, b) => a.time - b.time);
}

function buildJobTimelines(clips = []) {
  return clips.map(clip => ({
    clipIndex: clip.index,
    start: clip.start,
    end: clip.end,
    timeline: buildAiTimeline(clip, clip.editPlan || {})
  }));
}

module.exports = {
  buildAiTimeline,
  buildJobTimelines,
  classifyTriggers
};
