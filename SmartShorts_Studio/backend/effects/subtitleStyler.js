const fs = require('fs');
const { EMPHASIS_WORDS } = require('../ai/transcriptAnalyzer');

const STYLES = {
  default: {
    line: 'Style: Default,Arial Black,64,&H00FFFFFF,&H0000FFFF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,6,2,2,80,80,220,1',
    upper: false,
    primary: '&H00FFFFFF&',
    accent: '&H0000FFFF&',
    fontSize: 68
  },
  hormozi: {
    line: 'Style: Default,Arial Black,74,&H00FFFFFF,&H0000D7FF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,6,2,2,70,70,220,1',
    upper: true,
    primary: '&H00FFFFFF&',
    accent: '&H0000E6FF&',
    fontSize: 76
  },
  mrbeast: {
    line: 'Style: Default,Arial Black,78,&H00FFFFFF,&H0000FFFF,&H00000000,&HAA000000,1,0,0,0,100,100,0,0,1,7,2,2,60,60,220,1',
    upper: true,
    primary: '&H00FFFFFF&',
    accent: '&H0000FFFF&',
    fontSize: 80
  },
  iman: {
    line: 'Style: Default,Arial Black,66,&H00F6F1EA,&H00C8A15A,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,6,2,2,72,72,220,1',
    upper: false,
    primary: '&H00F6F1EA&',
    accent: '&H00C8A15A&',
    fontSize: 70
  },
  gaming: {
    line: 'Style: Default,Arial Black,78,&H0000FFFF,&H00FFFFFF,&H00000000,&HAA000000,1,0,0,0,100,100,0,0,1,7,3,2,58,58,210,1',
    upper: true,
    primary: '&H0000FFFF&',
    accent: '&H000080FF&',
    fontSize: 80
  },
  podcast: {
    line: 'Style: Default,Arial Black,62,&H00FFFFFF,&H0000FFFF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,6,2,2,84,84,220,1',
    upper: false,
    primary: '&H00FFFFFF&',
    accent: '&H0000D7FF&',
    fontSize: 66
  },
  documentary: {
    line: 'Style: Default,Georgia,60,&H00F5F5F5,&H0000C8FF,&H00000000,&H99000000,1,0,0,0,100,100,0,0,1,5,2,2,92,92,220,1',
    upper: false,
    primary: '&H00F5F5F5&',
    accent: '&H0000C8FF&',
    fontSize: 64
  },
  cinematic: {
    line: 'Style: Default,Arial Black,60,&H00FFFFFF,&H00C8C8C8,&H00000000,&H88000000,1,0,0,0,100,100,0,0,1,5,2,2,92,92,220,1',
    upper: false,
    primary: '&H00FFFFFF&',
    accent: '&H00D7D7D7&',
    fontSize: 64
  },
  anime: {
    line: 'Style: Default,Arial Black,76,&H00FFFFFF,&H00FF77FF,&H001D0030,&HAA000000,1,0,0,0,100,100,0,0,1,7,3,2,58,58,210,1',
    upper: true,
    primary: '&H00FFFFFF&',
    accent: '&H00FF77FF&',
    fontSize: 78
  },
  luxury_alpha: {
    line: 'Style: Default,Georgia,62,&H00F5F1EA,&H00C7A35A,&H00151412,&H99000000,1,0,0,0,100,100,0,0,1,5,2,2,88,88,230,1',
    upper: false,
    primary: '&H00F5F1EA&',
    accent: '&H00C7A35A&',
    fontSize: 66
  },
  minimalist: {
    line: 'Style: Default,Arial,58,&H00FFFFFF,&H00FFFFFF,&H00000000,&H66000000,1,0,0,0,100,100,0,0,1,5,1,2,104,104,220,1',
    upper: false,
    primary: '&H00FFFFFF&',
    accent: '&H00FFFFFF&',
    fontSize: 60
  }
};

function buildHeader(styleDef) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleDef.line}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

function toAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function parseSrtBlocks(srtContent) {
  return srtContent.trim().split(/\n\s*\n/).map(block => {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 3) return null;

    const match = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!match) return null;

    const start = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
    const end = Number(match[5]) * 3600 + Number(match[6]) * 60 + Number(match[7]) + Number(match[8]) / 1000;
    const text = lines.slice(2).join(' ').replace(/\s+/g, ' ').trim();
    return { start, end, text };
  }).filter(Boolean);
}

function escapeAssText(text) {
  return text.replace(/[{}]/g, '').replace(/\\/g, '');
}

function isEmphasisWord(word) {
  const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  return EMPHASIS_WORDS.has(normalized) || /^\d+[kmb]?$/.test(normalized);
}

function emojiForWord(word) {
  const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['money', 'cash', 'million', 'billion', 'profit'].includes(normalized)) return ' \u{1F4B0}';
  if (['fire', 'insane', 'crazy', 'viral', 'explode'].includes(normalized)) return ' \u{1F525}';
  if (['danger', 'risk', 'warning', 'mistake'].includes(normalized)) return ' \u26A0';
  if (['funny', 'laugh', 'hilarious'].includes(normalized)) return ' \u{1F602}';
  if (['ai', 'robot', 'future'].includes(normalized)) return ' \u26A1';
  return '';
}

function buildKaraokeText(text, duration, styleDef) {
  const words = escapeAssText(styleDef.upper ? text.toUpperCase() : text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const centiseconds = Math.max(8, Math.floor((duration * 100) / words.length));
  const lineAnchor = '{\\an2\\pos(540,1510)\\bord6\\shad2\\blur0.45\\3c&H000000&\\4c&H99000000&}';
  return lineAnchor + words.map((word, index) => {
    const isHot = isEmphasisWord(word);
    const color = isHot ? styleDef.accent : styleDef.primary;
    const size = isHot ? styleDef.fontSize + 8 : styleDef.fontSize;
    const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isFunny = ['funny', 'laugh', 'hilarious', 'joke', 'ridiculous'].includes(normalized);
    const isLoud = ['never', 'stop', 'wait', 'wrong', 'destroy', 'explode', 'crazy'].includes(normalized);
    const pop = isHot || isFunny
      ? '\\t(0,110,\\fscx124\\fscy124)\\t(110,260,\\fscx100\\fscy100)'
      : '\\t(0,100,\\fscx108\\fscy108)';
    const shake = isLoud ? '\\t(0,90,\\frz-2)\\t(90,180,\\frz2)\\t(180,270,\\frz0)' : '';
    const leadingBreak = index > 0 && index % 4 === 0 ? '\\N' : '';
    return `${leadingBreak}{\\k${centiseconds}\\c${color}\\fs${size}${pop}${shake}}${word}${emojiForWord(word)} `;
  }).join('').trim();
}

function convertToASS(srtContent, styleName = 'default') {
  const styleDef = STYLES[styleName] || STYLES.default;
  const blocks = parseSrtBlocks(srtContent);
  let assContent = buildHeader(styleDef);

  for (const block of blocks) {
    const duration = Math.max(0.4, block.end - block.start);
    const text = buildKaraokeText(block.text, duration, styleDef);
    if (!text) continue;
    assContent += `Dialogue: 0,${toAssTime(block.start)},${toAssTime(block.end)},Default,,0,0,0,,${text}\n`;
  }

  return assContent;
}

function generateStyledSubtitles(srtPath, outputPath, styleName = 'default') {
  if (!fs.existsSync(srtPath)) return null;
  const srtContent = fs.readFileSync(srtPath, 'utf-8');
  const assContent = convertToASS(srtContent, styleName);
  if (!assContent.includes('Dialogue:')) return null;
  fs.writeFileSync(outputPath, assContent, 'utf-8');
  return outputPath;
}

function splitFallbackLines(text) {
  const words = escapeAssText(text).replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ['WATCH THIS PART'];

  const lines = [];
  for (let i = 0; i < words.length; i += 6) {
    lines.push(words.slice(i, i + 6).join(' '));
  }
  return lines.slice(0, 5);
}

function generateFallbackSubtitles(outputPath, clip = {}, styleName = 'hormozi') {
  const duration = Math.max(3, Number(clip.duration) || 12);
  const styleDef = STYLES[styleName] || STYLES.hormozi;
  const sourceText = clip.hookText || clip.title || clip.reason || 'Watch this moment';
  const lines = splitFallbackLines(sourceText);
  const segmentDuration = duration / lines.length;
  let assContent = buildHeader(styleDef);

  lines.forEach((line, index) => {
    const start = index * segmentDuration;
    const end = index === lines.length - 1 ? duration : (index + 1) * segmentDuration;
    const text = buildKaraokeText(line, Math.max(0.8, end - start), { ...styleDef, upper: true });
    assContent += `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Default,,0,0,0,,${text}\n`;
  });

  fs.writeFileSync(outputPath, assContent, 'utf-8');
  return outputPath;
}

module.exports = {
  generateStyledSubtitles,
  generateFallbackSubtitles,
  convertToASS,
  STYLES
};
