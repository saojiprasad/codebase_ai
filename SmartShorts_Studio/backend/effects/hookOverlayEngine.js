function escapeDrawText(text = '') {
  return text
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/'/g, "\\'")
    .replace(/%/g, '')
    .replace(/\[/g, '')
    .replace(/\]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortHookText(clip = {}) {
  const source = clip.hookText || clip.title || clip.reason || 'WATCH THIS';
  const words = source.split(/\s+/).filter(Boolean);
  return escapeDrawText(words.slice(0, 7).join(' ').toUpperCase());
}

function between(start, end) {
  return `between(t\\,${Number(start).toFixed(2)}\\,${Number(end).toFixed(2)})`;
}

function fadeAlpha(start, end) {
  const fadeInEnd = Number(start + 0.22).toFixed(2);
  const fadeOutStart = Number(end - 0.28).toFixed(2);
  return `if(lt(t\\,${fadeInEnd})\\,(t-${Number(start).toFixed(2)})/0.22\\,if(gt(t\\,${fadeOutStart})\\,(${Number(end).toFixed(2)}-t)/0.28\\,1))`;
}

const CALLOUTS = [
  { pattern: /\b(money|cash|revenue|profit|million|billion)\b/i, text: 'MONEY MOVE', color: '0x22d3ee' },
  { pattern: /\b(ai|automation|robot|machine learning)\b/i, text: 'AI MOMENT', color: '0x8b5cf6' },
  { pattern: /\b(danger|risk|warning|mistake|failed|destroyed)\b/i, text: 'WATCH THIS', color: '0xef4444' },
  { pattern: /\b(success|win|growth|breakthrough|victory)\b/i, text: 'BIG WIN', color: '0x22c55e' },
  { pattern: /\b(crazy|insane|shocking|viral|explosion|blew up)\b/i, text: 'IMPACT', color: '0xffd400' },
  { pattern: /\b(secret|truth|nobody|mistake|changed)\b/i, text: 'THE POINT', color: '0xffd400' }
];

function buildKeywordCallouts(clip = {}) {
  const duration = Math.max(0.1, Number(clip.duration) || 0.1);
  const text = `${clip.hookText || ''} ${clip.title || ''} ${clip.reason || ''}`;
  const matched = CALLOUTS.filter(callout => callout.pattern.test(text)).slice(0, 2);

  return matched.flatMap((callout, index) => {
    const start = Math.min(duration - 0.8, 2.55 + index * 4.1);
    const end = Math.min(duration - 0.2, start + 1.5);
    if (start < 0.4 || end <= start) return [];

    const enable = between(start, end);
    const alpha = fadeAlpha(start, end);
    const y = index % 2 === 0 ? 404 : 498;

    return [
      `drawbox=x=66:y=${y}:w=396:h=76:color=black@0.50:t=fill:enable='${enable}'`,
      `drawbox=x=66:y=${y}:w=8:h=76:color=${callout.color}@1:t=fill:enable='${enable}'`,
      `drawtext=text='${escapeDrawText(callout.text)}':fontsize=42:fontcolor=white:borderw=4:bordercolor=black@0.90:x=92:y=${y + 17}:enable='${enable}':alpha='${alpha}'`
    ];
  });
}

function reactionForClip(clip = {}) {
  const text = `${clip.emotion || ''} ${clip.hookText || ''} ${clip.title || ''} ${clip.reason || ''}`.toLowerCase();
  if (/\b(fun|laugh|joke|hilarious|ridiculous)\b/.test(text)) return { text: 'LOL', color: '0x22d3ee' };
  if (/\b(wrong|truth|lie|fake|debate|argument)\b/.test(text)) return { text: 'FACTS', color: '0xffd400' };
  if (/\b(shock|crazy|insane|unbelievable|wait|nobody)\b/.test(text)) return { text: 'WAIT', color: '0xef4444' };
  if (/\b(success|win|growth|breakthrough)\b/.test(text)) return { text: 'WIN', color: '0x22c55e' };
  return { text: 'NO WAY', color: '0xffd400' };
}

function buildReactionStickerFilters(clip = {}) {
  const duration = Math.max(0.1, Number(clip.duration) || 0.1);
  const sticker = reactionForClip(clip);
  const start = Math.min(duration - 0.75, 1.15);
  const end = Math.min(duration - 0.2, start + 1.35);
  if (start < 0 || end <= start) return [];

  const enable = between(start, end);
  const alpha = fadeAlpha(start, end);
  return [
    `drawbox=x=iw-328:y=390:w=250:h=96:color=black@0.48:t=fill:enable='${enable}'`,
    `drawbox=x=iw-328:y=390:w=250:h=96:color=${sticker.color}@0.18:t=fill:enable='${enable}'`,
    `drawtext=text='${escapeDrawText(sticker.text)}':fontsize=54:fontcolor=white:borderw=5:bordercolor=black@0.92:x=iw-286:y=410:enable='${enable}':alpha='${alpha}'`
  ];
}

function buildHookOverlayFilters(clip = {}) {
  const hook = shortHookText(clip);
  if (!hook) return [];

  return [
    `drawbox=x=54:y=214:w=iw-108:h=168:color=black@0.62:t=fill:enable='${between(0, 2.35)}'`,
    `drawbox=x=54:y=214:w=10:h=168:color=0xffd400@1:t=fill:enable='${between(0, 2.35)}'`,
    `drawtext=text='VIRAL MOMENT':fontsize=30:fontcolor=0xffd400:borderw=3:bordercolor=black@0.92:x=86:y=232:enable='${between(0, 2.35)}':alpha='${fadeAlpha(0, 2.35)}'`,
    `drawtext=text='${hook}':fontsize=58:fontcolor=white:borderw=5:bordercolor=black@0.95:x=86:y=270:enable='${between(0, 2.35)}':alpha='${fadeAlpha(0, 2.35)}'`,
    ...buildReactionStickerFilters(clip),
    ...buildKeywordCallouts(clip)
  ];
}

module.exports = {
  buildHookOverlayFilters
};
