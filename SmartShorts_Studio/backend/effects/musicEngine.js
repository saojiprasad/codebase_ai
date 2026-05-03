const fs = require('fs');
const path = require('path');

const MUSIC_DIR = path.resolve(__dirname, '../assets/music');
const LEGACY_MUSIC = path.resolve(__dirname, '../assets/lofi_beat.mp3');

const MOOD_FILES = {
  suspense: ['suspense.mp3', 'dark.mp3'],
  tense: ['suspense.mp3', 'dark.mp3'],
  cinematic: ['cinematic.mp3', 'inspire.mp3'],
  uplifting: ['inspire.mp3', 'cinematic.mp3'],
  funny: ['fun.mp3', 'upbeat.mp3'],
  meme: ['meme.mp3', 'upbeat.mp3'],
  aggressive: ['hype.mp3', 'upbeat.mp3'],
  premium: ['premium.mp3', 'lofi.mp3'],
  high_retention: ['hype.mp3', 'upbeat.mp3', 'lofi.mp3']
};

function selectMusicPath(clip = {}) {
  const mood = clip.editPlan?.mood || 'high_retention';
  const candidates = [...(MOOD_FILES[mood] || MOOD_FILES.high_retention)];

  for (const file of candidates) {
    const candidate = path.join(MUSIC_DIR, file);
    if (fs.existsSync(candidate)) return candidate;
  }

  if (fs.existsSync(LEGACY_MUSIC)) return LEGACY_MUSIC;

  if (fs.existsSync(MUSIC_DIR)) {
    const firstMp3 = fs.readdirSync(MUSIC_DIR).find(file => file.toLowerCase().endsWith('.mp3'));
    if (firstMp3) return path.join(MUSIC_DIR, firstMp3);
  }

  return null;
}

module.exports = {
  selectMusicPath,
  MUSIC_DIR
};
