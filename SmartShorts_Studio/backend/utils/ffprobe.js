/**
 * FFprobe Utility — Video metadata extraction
 * 
 * Uses ffprobe to extract detailed information about video files:
 * resolution, fps, codec, bitrate, audio channels, keyframes, etc.
 */

const { spawn } = require('child_process');
const { getFfprobeCommand } = require('./ffmpeg');

/**
 * Run ffprobe and return parsed JSON output.
 * @param {string[]} args
 * @returns {Promise<object>}
 */
function runProbe(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFfprobeCommand(), [
      '-v', 'quiet',
      '-print_format', 'json',
      ...args
    ]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
    proc.on('close', code => {
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({});
      }
    });
    proc.on('error', () => resolve({}));
  });
}

/**
 * Get comprehensive metadata for a video file.
 * @param {string} inputPath
 * @returns {Promise<object>} { width, height, fps, duration, codec, bitrate, audioCodec, audioChannels }
 */
async function getVideoMetadata(inputPath) {
  const data = await runProbe([
    '-show_format', '-show_streams', inputPath
  ]);

  const videoStream = (data.streams || []).find(s => s.codec_type === 'video') || {};
  const audioStream = (data.streams || []).find(s => s.codec_type === 'audio') || {};
  const format = data.format || {};

  // Parse framerate from ratio string like "30/1" or "24000/1001"
  let fps = 30;
  if (videoStream.r_frame_rate) {
    const parts = videoStream.r_frame_rate.split('/');
    fps = parts.length === 2 ? parseInt(parts[0]) / parseInt(parts[1]) : parseFloat(parts[0]);
  }

  return {
    width: parseInt(videoStream.width) || 0,
    height: parseInt(videoStream.height) || 0,
    fps: Math.round(fps * 100) / 100,
    duration: parseFloat(format.duration) || 0,
    codec: videoStream.codec_name || 'unknown',
    bitrate: parseInt(format.bit_rate) || 0,
    audioCodec: audioStream.codec_name || 'none',
    audioChannels: parseInt(audioStream.channels) || 0,
    audioSampleRate: parseInt(audioStream.sample_rate) || 0,
    totalStreams: (data.streams || []).length,
    fileSize: parseInt(format.size) || 0
  };
}

/**
 * Get keyframe timestamps for accurate cutting.
 * @param {string} inputPath
 * @returns {Promise<number[]>} Array of keyframe timestamps in seconds
 */
async function getKeyframes(inputPath) {
  const data = await runProbe([
    '-select_streams', 'v:0',
    '-show_entries', 'packet=pts_time,flags',
    '-of', 'json',
    inputPath
  ]);

  const packets = data.packets || [];
  return packets
    .filter(p => p.flags && p.flags.includes('K'))
    .map(p => parseFloat(p.pts_time))
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b);
}

module.exports = {
  getVideoMetadata,
  getKeyframes
};
