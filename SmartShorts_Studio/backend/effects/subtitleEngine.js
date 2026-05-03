const fs = require('fs');

function escapeFilterPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function buildSubtitleBurnFilter(subtitlePath) {
  if (!subtitlePath || !fs.existsSync(subtitlePath)) return null;
  return `ass='${escapeFilterPath(subtitlePath)}'`;
}

module.exports = {
  buildSubtitleBurnFilter
};
