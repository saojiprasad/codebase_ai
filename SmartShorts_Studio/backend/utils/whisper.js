const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { logWhisper } = require('./logger');

function isWhisperAvailable() {
  return new Promise(resolve => {
    if (String(process.env.WHISPER_ENABLED || '').toLowerCase() === 'force_off') {
      resolve(false);
      return;
    }

    // On Windows, Whisper might crash on --help due to encoding issues. Force UTF8.
    const env = { ...process.env, PYTHONUTF8: '1' };
    const proc = spawn('whisper', ['--help'], { stdio: 'ignore', env });
    proc.on('close', code => {
      logWhisper('Availability check complete', { available: code === 0 });
      resolve(code === 0);
    });
    proc.on('error', () => {
      logWhisper('Availability check failed', { available: false });
      resolve(false);
    });
  });
}

async function generateSubtitles(videoPath, outputDir, model = 'large-v3') {
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const expectedSrt = path.join(outputDir, `${baseName}.srt`);
  const firstTry = await runWhisper(videoPath, outputDir, expectedSrt, model, { wordTimestamps: true });
  if (firstTry) return firstTry;

  const compatibilityTry = await runWhisper(videoPath, outputDir, expectedSrt, model, { wordTimestamps: false });
  if (compatibilityTry || model === 'base') return compatibilityTry;

  console.warn(`  [Whisper] Retrying ${path.basename(videoPath)} with base model.`);
  return runWhisper(videoPath, outputDir, expectedSrt, 'base', { wordTimestamps: true })
    .then(result => result || runWhisper(videoPath, outputDir, expectedSrt, 'base', { wordTimestamps: false }));
}


function runWhisper(videoPath, outputDir, expectedSrt, model, { wordTimestamps = false } = {}) {
  return new Promise(resolve => {
    logWhisper('Transcribing video/audio', {
      file: path.basename(videoPath),
      model,
      wordTimestamps
    });

    const args = [
      videoPath,
      '--model', model,
      '--output_format', wordTimestamps ? 'all' : 'srt',
      '--output_dir', outputDir
    ];

    if (wordTimestamps) {
      args.push('--word_timestamps', 'True');
    }

    const env = { ...process.env, PYTHONUTF8: '1' };
    const proc = spawn('whisper', args, { stdio: ['ignore', 'pipe', 'pipe'], env });

    // Pipe Whisper output to the main process so we can see real-time progress
    proc.stdout.on('data', data => {
      const line = data.toString().trim();
      if (line) console.log(`    [Whisper Progress] ${line}`);
    });

    proc.stderr.on('data', data => {
      const line = data.toString().trim();
      // Filter out some noise if necessary, but keep errors and warnings
      if (line && !line.includes('detect_language')) {
        console.warn(`    [Whisper Details] ${line}`);
      }
    });

    proc.on('close', code => {
      if (code === 0 && fs.existsSync(expectedSrt)) {
        logWhisper('Subtitle file generated', { srt: path.basename(expectedSrt), model });
        resolve(expectedSrt);
      } else {
        console.warn(`[WHISPER] Failed with model ${model} (code ${code}).`);
        resolve(null);
      }
    });

    proc.on('error', err => {
      console.warn(`[WHISPER] Not available: ${err.message}.`);
      resolve(null);
    });
  });
}

module.exports = {
  isWhisperAvailable,
  generateSubtitles
};
