const fs = require('fs');
const { runFFmpeg } = require('../utils/ffmpeg');

/**
 * Overlay Service
 * Generates dynamic TikTok-style overlays like progress bars, watermark texts, etc.
 */

async function applyProgressOverlay(inputVideo, outputPath, durationStr) {
  // TikTok-style progress bar at the bottom
  // Disabled as per user request (identified as "shitty line at the bottom")
  console.log('[Overlay] Progress bar skipped (disabled by request)');
  try {
    fs.copyFileSync(inputVideo, outputPath);
  } catch (e) {
    return inputVideo;
  }
  return outputPath;
}

module.exports = {
  applyProgressOverlay
};
