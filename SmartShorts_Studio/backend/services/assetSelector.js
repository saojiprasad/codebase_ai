const path = require('path');

const { ASSET_ROOT, searchAssets } = require('./assetLibrary');

function clipText(clip = {}) {
  return `${clip.hookText || ''} ${clip.reason || ''} ${clip.emotion || ''} ${(clip.seo?.hashtags || []).join(' ')}`.toLowerCase();
}

function classifyMoment(clip = {}) {
  const text = clipText(clip);
  const energy = clip.details?.energyScore || clip.viralScore || 0;

  if (/\b(shock|crazy|secret|unbelievable|warning|truth|exposed|mistake)\b/.test(text) || energy > 78) return 'shocking';
  if (/\b(fun|funny|laugh|meme|joke|ridiculous|hilarious)\b/.test(text) || clip.emotion === 'funny') return 'funny';
  if (/\b(sad|love|heart|story|feel|emotional|dream|pain)\b/.test(text) || clip.emotion === 'sad') return 'emotional';
  if (/\b(money|finance|business|rich|luxury|startup|market|sales)\b/.test(text)) return 'finance';
  if (/\b(game|gaming|stream|anime|speed)\b/.test(text)) return 'gaming';
  if (/\b(city|film|cinematic|beautiful|travel)\b/.test(text)) return 'cinematic';
  return 'high_retention';
}

function pickAsset({ type, categories = [], tags = [], mood = null }) {
  const candidates = searchAssets({ type, enabledOnly: true })
    .filter(asset => categories.length ? categories.includes(asset.category) : true)
    .filter(asset => mood ? asset.mood === mood || asset.tags?.includes(mood) : true)
    .filter(asset => tags.length ? tags.some(tag => asset.tags?.includes(tag)) : true);

  if (!candidates.length) return null;
  return candidates[0];
}

function absoluteAssetPath(asset) {
  if (!asset) return null;
  return path.resolve(ASSET_ROOT, asset.relativePath);
}

function selectAssetsForClip(clip = {}, editPlan = {}) {
  const moment = classifyMoment(clip);
  const selection = {
    moment,
    sfx: [],
    overlays: [],
    transitions: [],
    broll: null,
    music: null,
    stickers: []
  };

  if (moment === 'shocking') {
    selection.sfx.push(pickAsset({ type: 'sfx', categories: ['impacts', 'bass_drops'], tags: ['shocking'] }));
    selection.overlays.push(pickAsset({ type: 'overlays', categories: ['flashes', 'glitches'], tags: ['shocking'] }));
    selection.transitions.push(pickAsset({ type: 'transitions', categories: ['zoom', 'flash', 'shake'] }));
  } else if (moment === 'funny') {
    selection.sfx.push(pickAsset({ type: 'sfx', categories: ['meme', 'laugh'], tags: ['funny'] }));
    selection.overlays.push(pickAsset({ type: 'reactions', categories: ['laughing', 'meme'], tags: ['funny'] }));
    selection.stickers.push(pickAsset({ type: 'stickers', categories: ['emojis', 'engagement'] }));
  } else if (moment === 'emotional') {
    selection.sfx.push(pickAsset({ type: 'sfx', categories: ['risers', 'cinematic'], tags: ['cinematic'] }));
    selection.overlays.push(pickAsset({ type: 'overlays', categories: ['light_leaks', 'particles'] }));
    selection.music = pickAsset({ type: 'bgm', categories: ['emotional', 'cinematic', 'lofi'] });
  } else if (moment === 'finance') {
    selection.broll = pickAsset({ type: 'broll', categories: ['finance', 'luxury', 'city', 'technology'], tags: ['luxury'] });
    selection.music = pickAsset({ type: 'bgm', categories: ['cinematic', 'motivational', 'lofi'] });
  } else if (moment === 'gaming') {
    selection.sfx.push(pickAsset({ type: 'sfx', categories: ['glitches', 'whooshes'], tags: ['gaming'] }));
    selection.overlays.push(pickAsset({ type: 'overlays', categories: ['glitches', 'speed_lines', 'anime'] }));
    selection.music = pickAsset({ type: 'bgm', categories: ['gaming', 'dark'] });
  } else {
    selection.sfx.push(pickAsset({ type: 'sfx', categories: ['whooshes', 'impacts', 'transitions'] }));
    selection.overlays.push(pickAsset({ type: 'overlays', categories: ['particles', 'light_leaks', 'flashes'] }));
    selection.transitions.push(pickAsset({ type: 'transitions', categories: ['zoom', 'whip', 'blur'] }));
  }

  if (!selection.music) {
    const mood = editPlan.mood || clip.mood;
    const musicCategories = mood === 'premium'
      ? ['lofi', 'cinematic']
      : mood === 'suspense'
        ? ['dark', 'cinematic']
        : ['motivational', 'lofi', 'cinematic'];
    selection.music = pickAsset({ type: 'bgm', categories: musicCategories });
  }

  Object.keys(selection).forEach(key => {
    if (Array.isArray(selection[key])) selection[key] = selection[key].filter(Boolean);
  });

  return selection;
}

module.exports = {
  classifyMoment,
  selectAssetsForClip,
  absoluteAssetPath
};
