const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { getFfprobeCommand } = require('../utils/ffmpeg');

const ASSET_ROOT = path.resolve(__dirname, '../assets');
const INDEX_PATH = path.join(ASSET_ROOT, 'index.json');
const PREVIEW_DIR = path.join(ASSET_ROOT, '.previews');

const ASSET_TREE = {
  sfx: ['impacts', 'whooshes', 'risers', 'bass_drops', 'glitches', 'cinematic', 'crowd', 'laugh', 'meme', 'transitions'],
  bgm: ['lofi', 'cinematic', 'motivational', 'dark', 'gaming', 'emotional'],
  overlays: ['particles', 'fire', 'smoke', 'light_leaks', 'glitches', 'lens_flares', 'flashes', 'rain', 'anime', 'speed_lines'],
  transitions: ['zoom', 'whip', 'blur', 'spin', 'shake', 'flash'],
  broll: ['gameplay', 'satisfying', 'luxury', 'finance', 'podcast', 'cinematic', 'city', 'nature', 'memes', 'anime', 'technology'],
  reactions: ['shocked', 'laughing', 'crowd', 'meme'],
  stickers: ['arrows', 'emojis', 'subscribe', 'engagement'],
  emojis: ['fire', 'skull', 'crying', 'shocked', 'money', 'clap', 'explosion'],
  fonts: ['creator']
};

const MEDIA_EXTENSIONS = new Set([
  '.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg',
  '.mp4', '.mov', '.webm', '.mkv', '.avi',
  '.png', '.jpg', '.jpeg', '.webp'
]);

function ensureAssetTree() {
  fs.mkdirSync(ASSET_ROOT, { recursive: true });
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  Object.entries(ASSET_TREE).forEach(([type, categories]) => {
    categories.forEach(category => {
      fs.mkdirSync(path.join(ASSET_ROOT, type, category), { recursive: true });
    });
  });
  if (!fs.existsSync(INDEX_PATH)) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify({}, null, 2));
  }
}

function readIndex() {
  ensureAssetTree();
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch (error) {
    return {};
  }
}

function writeIndex(index) {
  ensureAssetTree();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

function listAssetFiles() {
  ensureAssetTree();
  const files = [];
  Object.entries(ASSET_TREE).forEach(([type, categories]) => {
    categories.forEach(category => {
      const dir = path.join(ASSET_ROOT, type, category);
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .forEach(entry => {
          const ext = path.extname(entry.name).toLowerCase();
          if (MEDIA_EXTENSIONS.has(ext)) {
            files.push({
              name: entry.name,
              type,
              category,
              filePath: path.join(dir, entry.name),
              relativePath: path.relative(ASSET_ROOT, path.join(dir, entry.name)).replace(/\\/g, '/')
            });
          }
        });
    });
  });
  return files;
}

function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function probeDuration(filePath) {
  return new Promise(resolve => {
    const proc = spawn(getFfprobeCommand(), [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    let output = '';
    proc.stdout.on('data', chunk => {
      output += chunk.toString();
    });
    proc.on('close', () => {
      const duration = Number.parseFloat(output.trim());
      resolve(Number.isFinite(duration) ? Number(duration.toFixed(3)) : 0);
    });
    proc.on('error', () => resolve(0));
  });
}

function inferTags({ name, type, category }) {
  const text = `${name} ${type} ${category}`.toLowerCase();
  const tags = new Set([type, category]);
  const rules = {
    shocking: ['shock', 'hit', 'impact', 'boom', 'flash'],
    funny: ['laugh', 'meme', 'funny', 'comic'],
    cinematic: ['cinematic', 'film', 'riser', 'light', 'lens'],
    luxury: ['luxury', 'city', 'finance', 'business', 'premium'],
    gaming: ['gaming', 'glitch', 'speed', 'anime'],
    emotional: ['emotional', 'lofi', 'soft', 'sad', 'warm'],
    transition: ['whoosh', 'whip', 'spin', 'zoom', 'shake', 'transition']
  };
  Object.entries(rules).forEach(([tag, words]) => {
    if (words.some(word => text.includes(word))) tags.add(tag);
  });
  return Array.from(tags);
}

function inferMood(tags, category) {
  if (tags.includes('funny')) return 'funny';
  if (tags.includes('luxury')) return 'premium';
  if (tags.includes('gaming')) return 'aggressive';
  if (tags.includes('emotional')) return 'emotional';
  if (tags.includes('shocking')) return 'dramatic';
  if (category === 'dark') return 'dark';
  if (category === 'cinematic') return 'cinematic';
  return 'high_retention';
}

function inferEnergy(type, category, tags) {
  if (type === 'sfx' && ['impacts', 'bass_drops', 'glitches'].includes(category)) return 9;
  if (tags.includes('shocking') || tags.includes('gaming')) return 8;
  if (tags.includes('emotional') || category === 'lofi') return 4;
  if (type === 'bgm') return 6;
  return 5;
}

async function buildMetadata(file) {
  const stats = fs.statSync(file.filePath);
  const ext = path.extname(file.name).toLowerCase();
  const hash = hashFile(file.filePath);
  const tags = inferTags(file);
  return {
    id: hash.slice(0, 16),
    name: file.name,
    type: file.type,
    category: file.category,
    relativePath: file.relativePath,
    publicUrl: `/assets/${file.relativePath}`,
    extension: ext,
    hash,
    sizeBytes: stats.size,
    duration: ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(ext)
      ? await probeDuration(file.filePath)
      : 0,
    energy: inferEnergy(file.type, file.category, tags),
    mood: inferMood(tags, file.category),
    tags,
    enabled: true,
    source: 'local',
    license: 'local_or_user_provided',
    updatedAt: new Date().toISOString()
  };
}

async function rebuildAssetIndex() {
  ensureAssetTree();
  const existing = readIndex();
  const next = {};
  const seenHashes = new Map();

  for (const file of listAssetFiles()) {
    const previous = Object.values(existing).find(item => item.relativePath === file.relativePath);
    const metadata = previous && fs.existsSync(file.filePath)
      ? { ...previous, ...await buildMetadata(file), enabled: previous.enabled !== false }
      : await buildMetadata(file);

    if (seenHashes.has(metadata.hash)) {
      metadata.duplicateOf = seenHashes.get(metadata.hash);
      metadata.enabled = false;
    } else {
      seenHashes.set(metadata.hash, metadata.name);
    }

    next[metadata.name] = metadata;
  }

  writeIndex(next);
  return next;
}

function searchAssets(query = {}) {
  const index = readIndex();
  const term = String(query.q || '').trim().toLowerCase();
  return Object.values(index)
    .filter(asset => query.enabledOnly ? asset.enabled !== false : true)
    .filter(asset => query.type ? asset.type === query.type : true)
    .filter(asset => query.category ? asset.category === query.category : true)
    .filter(asset => {
      if (!term) return true;
      const haystack = [asset.name, asset.type, asset.category, asset.mood, ...(asset.tags || [])].join(' ').toLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => (b.energy || 0) - (a.energy || 0));
}

function setAssetEnabled(name, enabled) {
  const index = readIndex();
  if (!index[name]) return null;
  index[name].enabled = Boolean(enabled);
  index[name].updatedAt = new Date().toISOString();
  writeIndex(index);
  return index[name];
}

function getAssetSummary() {
  const assets = Object.values(readIndex());
  const byType = {};
  const byCategory = {};
  assets.forEach(asset => {
    byType[asset.type] = (byType[asset.type] || 0) + 1;
    const key = `${asset.type}/${asset.category}`;
    byCategory[key] = (byCategory[key] || 0) + 1;
  });
  return {
    root: ASSET_ROOT,
    total: assets.length,
    enabled: assets.filter(asset => asset.enabled !== false).length,
    byType,
    byCategory,
    categories: ASSET_TREE
  };
}

module.exports = {
  ASSET_ROOT,
  ASSET_TREE,
  INDEX_PATH,
  ensureAssetTree,
  readIndex,
  writeIndex,
  rebuildAssetIndex,
  searchAssets,
  setAssetEnabled,
  getAssetSummary
};
