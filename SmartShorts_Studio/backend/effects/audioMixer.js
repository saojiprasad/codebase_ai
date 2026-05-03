const path = require('path');
const { runFFmpeg } = require('../utils/ffmpeg');

/**
 * Audio Mixer Service
 * Handles layering background music and normalizing audio for the final clip.
 */

async function applyAudioMix(inputVideo, outputPath, musicPath, volumeLevel = 0.1) {
  const filterGraph = [
    `[0:a]volume=1.05,loudnorm=I=-16:TP=-1.5:LRA=11,asplit=2[voice_mix][voice_side]`,
    `[1:a]volume=${volumeLevel},aloop=loop=-1:size=2147483647[bgm_raw]`,
    `[bgm_raw][voice_side]sidechaincompress=threshold=0.045:ratio=8:attack=35:release=550[bgm_ducked]`,
    `[voice_mix][bgm_ducked]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-15:TP=-1.2:LRA=10[aout]`
  ].join(';');

  const args = [
    '-y',
    '-i', inputVideo,
    '-stream_loop', '-1', // Loop background music infinitely
    '-i', musicPath,
    '-filter_complex', filterGraph,
    '-map', '0:v', // Take video stream from first input
    '-map', '[aout]', // Take mixed audio
    '-c:v', 'copy', // Don't re-encode video! This makes it extremely fast.
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest', // Cut at the shortest input (which is the video since music loops)
    outputPath
  ];

  await runFFmpeg(args, 'Audio Mix');
  return outputPath;
}

module.exports = {
  applyAudioMix
};
