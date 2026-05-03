const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { ASSET_ROOT, ASSET_TREE, rebuildAssetIndex, readIndex } = require('./assetLibrary');
const { optimizeAsset } = require('./mediaOptimizer');

const FREE_SOURCES = {
  pixabay: {
    needsKey: 'PIXABAY_API_KEY',
    searchUrl: (query, type) => {
      const media = ['sfx', 'bgm'].includes(type) ? 'music' : 'videos';
      return `https://pixabay.com/api/${media === 'videos' ? 'videos/' : ''}?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=10&safesearch=true`;
    }
  },
  pexels: {
    needsKey: 'PEXELS_API_KEY',
    searchUrl: (query) => `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10`
  },
  freesound: {
    needsKey: 'FREESOUND_API_KEY',
    searchUrl: (query) => `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&fields=id,name,previews,license,duration&filter=license:%22Creative%20Commons%200%22`
  },
  mixkit: { manifestOnly: true },
  coverr: { manifestOnly: true },
  productioncrate: { manifestOnly: true }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeName(name) {
  return String(name || 'asset')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90);
}

function getCategoryDir(type, category) {
  if (!ASSET_TREE[type] || !ASSET_TREE[type].includes(category)) {
    throw new Error(`Unsupported asset category: ${type}/${category}`);
  }
  const dir = path.join(ASSET_ROOT, type, category);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function inferExtension(url, fallback = '.bin') {
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return ext || fallback;
  } catch (error) {
    return fallback;
  }
}

function isDuplicateHash(buffer) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const existing = Object.values(readIndex()).find(asset => asset.hash === hash);
  return { duplicate: Boolean(existing), hash, existing };
}

async function fetchWithRetries(url, options = {}, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(450 * attempt);
    }
  }
  throw lastError;
}

async function downloadFile({ url, type, category, name, license = 'royalty_free_source', source = 'manual_url', optimize = true }) {
  const dir = getCategoryDir(type, category);
  const response = await fetchWithRetries(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  const duplicate = isDuplicateHash(buffer);

  if (duplicate.duplicate) {
    return {
      skipped: true,
      reason: 'duplicate',
      duplicateOf: duplicate.existing.name,
      hash: duplicate.hash
    };
  }

  const ext = inferExtension(url, type === 'sfx' ? '.mp3' : '.mp4');
  const fileName = `${safeName(name || `${source}_${category}`)}_${duplicate.hash.slice(0, 8)}${ext}`;
  const rawPath = path.join(dir, fileName);
  fs.writeFileSync(rawPath, buffer);

  let finalPath = rawPath;
  let optimization = null;
  if (optimize) {
    try {
      optimization = await optimizeAsset(rawPath, type);
      finalPath = optimization.optimizedPath || rawPath;
      if (finalPath !== rawPath && fs.existsSync(finalPath)) {
        fs.unlinkSync(rawPath);
      }
    } catch (error) {
      optimization = { warning: error.message };
    }
  }

  const index = await rebuildAssetIndex();
  const asset = Object.values(index).find(item => path.resolve(ASSET_ROOT, item.relativePath) === path.resolve(finalPath));
  if (asset) {
    asset.license = license;
    asset.source = source;
    const next = readIndex();
    next[asset.name] = asset;
    fs.writeFileSync(path.join(ASSET_ROOT, 'index.json'), JSON.stringify(next, null, 2));
  }

  return { skipped: false, path: finalPath, asset, optimization };
}

function extractDownloadCandidates(source, payload, type) {
  if (source === 'pixabay') {
    const hits = payload.hits || [];
    return hits.map(hit => {
      const video = hit.videos?.medium || hit.videos?.small || hit.videos?.tiny;
      return {
        url: type === 'sfx' || type === 'bgm' ? hit.audio : video?.url,
        name: hit.tags || hit.user || `pixabay_${hit.id}`,
        license: 'Pixabay Content License'
      };
    }).filter(item => item.url);
  }

  if (source === 'pexels') {
    return (payload.videos || []).map(video => {
      const file = [...(video.video_files || [])].sort((a, b) => (a.width || 0) - (b.width || 0)).find(item => item.link);
      return { url: file?.link, name: `pexels_${video.id}`, license: 'Pexels License' };
    }).filter(item => item.url);
  }

  if (source === 'freesound') {
    return (payload.results || []).map(item => ({
      url: item.previews?.['preview-hq-mp3'] || item.previews?.['preview-lq-mp3'],
      name: item.name,
      license: item.license || 'Creative Commons'
    })).filter(item => item.url);
  }

  return [];
}

async function searchSource(source, query, type) {
  const config = FREE_SOURCES[source];
  if (!config) throw new Error(`Unsupported source: ${source}`);
  if (config.manifestOnly) {
    return {
      source,
      skipped: true,
      reason: 'This source is supported through user-provided free asset URLs/manifests only; no scraping is performed.'
    };
  }
  if (config.needsKey && !process.env[config.needsKey]) {
    return { source, skipped: true, reason: `Missing ${config.needsKey}` };
  }

  const headers = {};
  if (source === 'pexels') headers.Authorization = process.env.PEXELS_API_KEY;
  if (source === 'freesound') headers.Authorization = `Token ${process.env.FREESOUND_API_KEY}`;

  const response = await fetchWithRetries(config.searchUrl(query, type), { headers });
  const payload = await response.json();
  return { source, candidates: extractDownloadCandidates(source, payload, type) };
}

async function downloadBatch({ source = 'pixabay', query, type, category, limit = 5, urls = [] }) {
  const downloads = [];
  const candidates = [];

  urls.forEach((url, index) => {
    candidates.push({ url, name: `${source}_${category}_${index + 1}`, license: 'user_verified_free_source' });
  });

  if (query && candidates.length < limit) {
    const searched = await searchSource(source, query, type);
    if (searched.skipped) {
      return { source, skipped: true, reason: searched.reason, downloads };
    }
    candidates.push(...searched.candidates);
  }

  for (const candidate of candidates.slice(0, limit)) {
    try {
      downloads.push(await downloadFile({
        ...candidate,
        type,
        category,
        source
      }));
    } catch (error) {
      downloads.push({ skipped: true, reason: error.message, url: candidate.url });
    }
  }

  return { source, downloads, index: await rebuildAssetIndex() };
}

module.exports = {
  FREE_SOURCES,
  downloadFile,
  downloadBatch,
  searchSource
};
