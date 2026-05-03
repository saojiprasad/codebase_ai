/**
 * Scene Detector — FFmpeg-based scene change detection
 * 
 * Uses FFmpeg's scene detection filter to find timestamps where
 * significant visual changes occur. No Python required.
 */

const { spawn } = require('child_process');
const { getFfmpegCommand } = require('../utils/ffmpeg');

/**
 * Detect scene changes in a video using FFmpeg's scene filter.
 * 
 * @param {string} inputPath - Path to the video file
 * @param {number} threshold - Scene change threshold (0.0-1.0, lower = more sensitive). Default 0.3
 * @returns {Promise<Array<{timestamp: number, score: number}>>}
 */
async function detectSceneChanges(inputPath, threshold = 0.3) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-vf', `select='gt(scene,${threshold})',metadata=print:file=-`,
      '-an', '-f', 'null', '-'
    ];

    const proc = spawn(getFfmpegCommand(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    proc.stdout.on('data', chunk => { output += chunk.toString(); });
    proc.stderr.on('data', chunk => { output += chunk.toString(); });

    proc.on('close', () => {
      const scenes = [];
      const lines = output.split('\n');

      let currentTime = null;
      for (const line of lines) {
        // Look for pts_time
        const timeMatch = line.match(/pts_time:(\d+\.?\d*)/);
        if (timeMatch) {
          currentTime = parseFloat(timeMatch[1]);
        }
        // Look for scene_score
        const scoreMatch = line.match(/scene_score=(\d+\.?\d*)/);
        if (scoreMatch && currentTime !== null) {
          scenes.push({
            timestamp: currentTime,
            score: parseFloat(scoreMatch[1])
          });
          currentTime = null;
        }
      }

      resolve(scenes);
    });

    proc.on('error', () => resolve([]));
  });
}

/**
 * Get scene density — how many scene changes per minute.
 * Higher density = more dynamic/energetic content.
 * 
 * @param {Array<{timestamp: number}>} scenes
 * @param {number} totalDuration - Total video duration in seconds
 * @returns {number} Scene changes per minute
 */
function getSceneDensity(scenes, totalDuration) {
  if (totalDuration <= 0) return 0;
  return (scenes.length / totalDuration) * 60;
}

/**
 * Find high-activity regions based on scene changes.
 * Returns time windows where scene changes are clustered.
 * 
 * @param {Array<{timestamp: number, score: number}>} scenes
 * @param {number} windowSize - Window size in seconds (default 30)
 * @param {number} minChanges - Minimum scene changes to qualify (default 3)
 * @returns {Array<{start: number, end: number, changes: number, avgScore: number}>}
 */
function findHighActivityRegions(scenes, windowSize = 30, minChanges = 3) {
  if (scenes.length === 0) return [];

  const regions = [];
  const maxTime = scenes[scenes.length - 1].timestamp;

  for (let start = 0; start <= maxTime; start += windowSize / 2) {
    const end = start + windowSize;
    const windowScenes = scenes.filter(s => s.timestamp >= start && s.timestamp < end);

    if (windowScenes.length >= minChanges) {
      const avgScore = windowScenes.reduce((sum, s) => sum + s.score, 0) / windowScenes.length;
      regions.push({ start, end, changes: windowScenes.length, avgScore });
    }
  }

  // Merge overlapping regions
  const merged = [];
  for (const region of regions) {
    const last = merged[merged.length - 1];
    if (last && region.start < last.end) {
      last.end = Math.max(last.end, region.end);
      last.changes = Math.max(last.changes, region.changes);
      last.avgScore = (last.avgScore + region.avgScore) / 2;
    } else {
      merged.push({ ...region });
    }
  }

  return merged;
}

module.exports = {
  detectSceneChanges,
  getSceneDensity,
  findHighActivityRegions
};
