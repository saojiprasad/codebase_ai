const fs = require('fs');
const path = require('path');

const { addBRoll } = require('./effectsEngine');
const { searchAssets, ASSET_ROOT } = require('../services/assetLibrary');

const TOPIC_CATEGORIES = {
  money: ['finance', 'luxury', 'city'],
  finance: ['finance', 'luxury', 'city'],
  business: ['finance', 'technology', 'city'],
  coding: ['technology'],
  gaming: ['gaming'],
  motivation: ['cinematic', 'nature', 'luxury'],
  luxury: ['luxury', 'city'],
  cars: ['luxury'],
  war: ['cinematic'],
  default: ['cinematic', 'city', 'nature']
};

function inferBrollTopics(clip = {}, timeline = []) {
  const text = `${clip.hookText || ''} ${clip.reason || ''} ${clip.title || ''}`.toLowerCase();
  const topics = new Set();
  if (/\b(money|cash|million|billion|profit|finance)\b/.test(text)) topics.add('finance');
  if (/\b(business|startup|sales|market)\b/.test(text)) topics.add('business');
  if (/\b(code|coding|software|ai|tech)\b/.test(text)) topics.add('coding');
  if (/\b(game|gaming|stream)\b/.test(text)) topics.add('gaming');
  if (/\b(motivation|success|discipline|dream)\b/.test(text)) topics.add('motivation');
  if (/\b(luxury|rich|car|cars|watch)\b/.test(text)) topics.add('luxury');
  timeline.filter(event => event.type === 'broll' && event.topic).forEach(event => topics.add(event.topic));
  if (!topics.size) topics.add('default');
  return Array.from(topics);
}

function selectSmartBroll(clip = {}, timeline = []) {
  const topics = inferBrollTopics(clip, timeline);
  const categories = topics.flatMap(topic => TOPIC_CATEGORIES[topic] || TOPIC_CATEGORIES.default);
  const asset = searchAssets({ type: 'broll', enabledOnly: true })
    .find(item => categories.includes(item.category));
  if (!asset) return null;
  const filePath = path.resolve(ASSET_ROOT, asset.relativePath);
  return fs.existsSync(filePath) ? { asset, filePath } : null;
}

async function applySmartBroll(inputPath, outputPath, clip = {}, timeline = []) {
  const selected = selectSmartBroll(clip, timeline);
  if (!selected) {
    fs.copyFileSync(inputPath, outputPath);
    return { outputPath, selected: null };
  }
  await addBRoll(inputPath, selected.filePath, outputPath);
  return { outputPath, selected: selected.asset };
}

module.exports = {
  inferBrollTopics,
  selectSmartBroll,
  applySmartBroll
};
