const path = require('path');
const { runFFmpeg } = require('../utils/ffmpeg');
const fs = require('fs');

/**
 * Effects Engine
 * 
 * Takes an input video and applies visual effects using complex FFmpeg filter graphs.
 */

const EFFECTS = {
  zoom_in: "zoompan=z='min(zoom+0.0015,1.5)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920",
  zoom_out: "zoompan=z='max(1.5-0.0015*n,1)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920",
  ken_burns: "zoompan=z='1.1':x='if(eq(sign(sin(n/100)),1),x+1,x-1)':y='if(eq(sign(sin(n/150)),1),y+1,y-1)':d=125:s=1080x1920",
  glitch: "glitch=color=0.1:block=0.2"
};

/**
 * Apply a specific effect to a video
 */
async function applyEffect(inputPath, outputPath, effectName) {
  if (!EFFECTS[effectName]) {
    throw new Error(`Effect ${effectName} not found`);
  }

  const args = [
    '-y',
    '-i', inputPath,
    '-vf', EFFECTS[effectName],
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'copy',
    outputPath
  ];

  await runFFmpeg(args, 'Effect');
  return outputPath;
}

/**
 * Add a B-Roll overlay to a video (Split Screen)
 */
async function addBRoll(mainVideoPath, bRollVideoPath, outputPath) {
  // TikTok split-screen style: 
  // Main video top half (1080x960)
  // B-roll video bottom half (1080x960)
  
  // Filter graph:
  // 1. Scale main video to 1080x960, crop to center
  // 2. Scale b-roll to 1080x960, crop to center
  // 3. Vstack them to form 1080x1920
  
  const filterGraph = `[0:v]scale='max(1080,a*960)':'max(960,1080/a)',crop=1080:960:(in_w-1080)/2:(in_h-960)/2[top]; \
                       [1:v]scale='max(1080,a*960)':'max(960,1080/a)',crop=1080:960:(in_w-1080)/2:(in_h-960)/2[bottom]; \
                       [top][bottom]vstack=inputs=2[outv]`;

  const args = [
    '-y',
    '-i', mainVideoPath,
    '-stream_loop', '-1', // Loop broll if it's shorter than main clip
    '-i', bRollVideoPath,
    '-filter_complex', filterGraph,
    '-map', '[outv]',
    '-map', '0:a?', // keep original audio when present
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'copy',
    '-shortest', // cut when main video ends
    outputPath
  ];

  await runFFmpeg(args, 'B-Roll Injection');
  return outputPath;
}

module.exports = {
  applyEffect,
  addBRoll,
  EFFECTS
};
