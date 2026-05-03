const KEYWORD_CUES = [
  { pattern: /\b(money|cash|revenue|profit|million|billion)\b/i, overlay: 'money', visual: 'money burst' },
  { pattern: /\b(ai|robot|automation|machine learning)\b/i, overlay: 'ai', visual: 'futuristic hud' },
  { pattern: /\b(danger|risk|warning|mistake|destroyed|failed)\b/i, overlay: 'warning', visual: 'red alert' },
  { pattern: /\b(success|win|growth|victory|breakthrough)\b/i, overlay: 'success', visual: 'glow pulse' },
  { pattern: /\b(explosion|blew up|viral|crazy|insane)\b/i, overlay: 'impact', visual: 'impact flash' }
];

const MODE_PRESETS = {
  auto_viral: { mood: 'high_retention', cutEvery: 3.2, zoom: 'mixed', music: 'energetic' },
  podcast: { mood: 'conversational', cutEvery: 4.5, zoom: 'speaker_focus', music: 'subtle' },
  podcast_viral: { mood: 'high_retention', cutEvery: 3.4, zoom: 'speaker_focus', music: 'energetic' },
  debate: { mood: 'tense', cutEvery: 2.6, zoom: 'reaction', music: 'tension' },
  motivational: { mood: 'uplifting', cutEvery: 4.0, zoom: 'slow_push', music: 'cinematic' },
  educational: { mood: 'clear', cutEvery: 4.8, zoom: 'clean', music: 'light' },
  storytelling: { mood: 'narrative', cutEvery: 4.4, zoom: 'slow_push', music: 'cinematic' },
  gaming: { mood: 'aggressive', cutEvery: 2.2, zoom: 'fast', music: 'high_energy' },
  finance: { mood: 'premium', cutEvery: 3.8, zoom: 'clean', music: 'premium' },
  dark_documentary: { mood: 'suspense', cutEvery: 4.2, zoom: 'slow_push', music: 'dark' },
  comedy: { mood: 'funny', cutEvery: 2.8, zoom: 'reaction', music: 'meme' },
  documentary: { mood: 'documentary', cutEvery: 4.6, zoom: 'slow_push', music: 'cinematic' },
  meme_style: { mood: 'meme', cutEvery: 2.4, zoom: 'reaction', music: 'meme' },
  cinematic_storytelling: { mood: 'cinematic', cutEvery: 4.4, zoom: 'slow_push', music: 'cinematic' }
};

function normalizeMode(mode = 'auto_viral') {
  const aliases = {
    podcast_viral: 'podcast_viral',
    finance_guru: 'finance',
    gaming_streamer: 'gaming',
    educational_tutor: 'educational',
    luxury_alpha: 'finance'
  };
  return aliases[mode] || mode;
}

function clampTime(time, duration) {
  return Math.max(0, Math.min(Number(time.toFixed(2)), Math.max(0, duration - 0.2)));
}

function getPreset(mode) {
  return MODE_PRESETS[normalizeMode(mode)] || MODE_PRESETS.auto_viral;
}

function applyEmotionOverrides(clip, preset) {
  const emotion = String(clip.emotion || '').toLowerCase();
  const reason = String(clip.reason || '').toLowerCase();
  const energy = clip.details?.energyScore || 0;
  const text = `${clip.hookText || ''} ${clip.title || ''} ${reason}`.toLowerCase();
  const next = { ...preset };

  if (emotion.includes('funny') || /\b(fun|laugh|joke|hilarious|ridiculous)\b/.test(text)) {
    next.mood = 'funny';
    next.zoom = 'reaction';
    next.cutEvery = Math.min(next.cutEvery, 2.8);
    next.music = 'meme';
  } else if (emotion.includes('negative') || emotion.includes('sad')) {
    next.mood = 'suspense';
    next.zoom = 'slow_push';
    next.cutEvery = Math.max(next.cutEvery, 4.0);
    next.music = 'dark';
  } else if (emotion.includes('positive') || /\b(motivat|inspire|changed my life|success)\b/.test(text)) {
    next.mood = 'uplifting';
    next.zoom = 'slow_push';
    next.music = 'cinematic';
  } else if (emotion.includes('tense') || emotion.includes('exciting') || energy > 70 || reason.includes('high-energy')) {
    next.mood = 'aggressive';
    next.zoom = 'reaction';
    next.cutEvery = Math.min(next.cutEvery, 2.7);
    next.music = 'high_energy';
  }

  return next;
}

function buildAttentionResets(duration, preset) {
  const resets = [];
  for (let t = preset.cutEvery; t < duration; t += preset.cutEvery) {
    resets.push({
      at: clampTime(t, duration),
      type: t % (preset.cutEvery * 2) < preset.cutEvery ? 'punch_zoom' : 'motion_shift',
      intensity: preset.mood === 'meme' || preset.mood === 'aggressive' ? 'high' : 'medium'
    });
  }
  return resets;
}

function buildSoundCues(clip, preset) {
  const duration = Number(clip.duration) || 0;
  const cues = [
    { at: 0.15, type: 'hook_hit', sound: preset.mood === 'suspense' ? 'tension_hit' : 'soft_impact' }
  ];

  if ((clip.details?.energyScore || 0) > 60) {
    cues.push({ at: clampTime(duration * 0.35, duration), type: 'impact', sound: 'bass_hit' });
  }
  if ((clip.details?.hookScore || 0) > 45) {
    cues.push({ at: clampTime(1.2, duration), type: 'suspense', sound: 'riser' });
  }

  return cues;
}

function buildBrollCues(clip) {
  const text = `${clip.hookText || ''} ${clip.reason || ''}`;
  return KEYWORD_CUES
    .filter(cue => cue.pattern.test(text))
    .map((cue, index) => ({
      at: 2 + index * 4,
      keyword: cue.overlay,
      visual: cue.visual,
      source: 'local_broll_library'
    }));
}

function createEditPlan(clip = {}, mode = 'auto_viral') {
  const duration = Number(clip.duration) || 0;
  const preset = applyEmotionOverrides(clip, getPreset(mode));
  const attentionResets = buildAttentionResets(duration, preset);
  const brollCues = buildBrollCues(clip);
  const soundCues = buildSoundCues(clip, preset);

  const effects = [
    { at: 0, type: 'opening_push', style: preset.zoom },
    ...attentionResets.map(reset => ({ at: reset.at, type: reset.type, intensity: reset.intensity }))
  ];

  return {
    mood: preset.mood,
    pacing: {
      cutEverySeconds: preset.cutEvery,
      attentionResetCount: attentionResets.length,
      retentionStrategy: duration <= 35 ? 'fast_hook' : 'hook_then_pattern_interrupts'
    },
    visual: {
      colorGrade: preset.mood,
      zoomStyle: preset.zoom,
      effects
    },
    audio: {
      musicMood: preset.music,
      ducking: true,
      cues: soundCues
    },
    subtitles: {
      emphasis: true,
      karaoke: true,
      autoCapsHook: (clip.details?.hookScore || 0) > 35
    },
    broll: brollCues,
    layers: [
      { type: 'video', name: 'primary_clip' },
      { type: 'subtitles', name: 'animated_captions' },
      { type: 'overlay', name: 'progress_and_impacts' },
      { type: 'audio', name: 'voice_music_sfx' },
      { type: 'thumbnail', name: 'cover_frames' }
    ]
  };
}

module.exports = {
  createEditPlan,
  getPreset,
  normalizeMode
};
