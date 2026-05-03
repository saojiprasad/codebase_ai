const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '../..');
const LOCAL_FFMPEG = process.platform === 'win32'
  ? path.join(ROOT_DIR, 'ffmpeg', 'ffmpeg.exe')
  : path.join(ROOT_DIR, 'ffmpeg', 'ffmpeg');
const LOCAL_FFPROBE = process.platform === 'win32'
  ? path.join(ROOT_DIR, 'ffmpeg', 'ffprobe.exe')
  : path.join(ROOT_DIR, 'ffmpeg', 'ffprobe');

const RESOLUTION_MAP = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 }
};

function getFfmpegCommand() {
  return fs.existsSync(LOCAL_FFMPEG) ? LOCAL_FFMPEG : 'ffmpeg';
}

function getFfprobeCommand() {
  return fs.existsSync(LOCAL_FFPROBE) ? LOCAL_FFPROBE : 'ffprobe';
}

function runFFmpeg(args, label = 'FFmpeg') {
  return new Promise((resolve, reject) => {
    const command = getFfmpegCommand();
    console.log(`  [${label}] ${path.basename(command)} ${args.join(' ')}`);

    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    proc.on('close', code => {
      if (code === 0) {
        console.log(`  [${label}] Success.`);
        resolve();
      } else {
        const errorMsg = `[${label}] FFmpeg exited with code ${code}.\nArgs: ${args.join(' ')}\nError: ${stderr.slice(-600)}`;
        console.error(errorMsg);
        reject(new Error(errorMsg));
      }
    });

    proc.on('error', err => {
      reject(new Error(`[${label}] Failed to spawn FFmpeg: ${err.message}`));
    });
  });
}

function getVideoDuration(inputPath) {
  return new Promise(resolve => {
    const proc = spawn(getFfprobeCommand(), [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ]);

    let output = '';
    proc.stdout.on('data', chunk => {
      output += chunk.toString();
    });

    proc.on('close', () => {
      const duration = parseFloat(output.trim());
      resolve(Number.isFinite(duration) ? duration : 0);
    });

    proc.on('error', () => resolve(0));
  });
}

async function splitVideo(inputPath, outputDir, duration = 90) {
  fs.mkdirSync(outputDir, { recursive: true });
  const pattern = path.join(outputDir, 'segment_%03d.mp4');

  await runFFmpeg([
    '-i', inputPath,
    '-c', 'copy',
    '-map', '0:v:0',
    '-map', '0:a?',
    '-segment_time', String(duration),
    '-f', 'segment',
    '-reset_timestamps', '1',
    '-y',
    pattern
  ], 'Fixed split');

  return fs.readdirSync(outputDir)
    .filter(file => file.startsWith('segment_') && file.endsWith('.mp4'))
    .sort()
    .map(file => path.join(outputDir, file));
}

async function cutClip(inputPath, outputPath, startSec, durationSec) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  try {
    await runFFmpeg([
      '-ss', String(Math.max(0, startSec)),
      '-i', inputPath,
      '-t', String(durationSec),
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      '-map', '0:v:0',
      '-map', '0:a?',
      '-y',
      outputPath
    ], `Fast cut ${durationSec.toFixed(1)}s`);
  } catch (error) {
    console.warn(`  [Cut] Stream-copy cut failed; retrying precise encode. ${error.message}`);
    await runFFmpeg([
      '-ss', String(Math.max(0, startSec)),
      '-i', inputPath,
      '-t', String(durationSec),
      '-map', '0:v:0',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ], `Precise cut ${durationSec.toFixed(1)}s`);
  }

  return outputPath;
}

function getFaceFocus(videoPath) {
  return new Promise(resolve => {
    const pythonScript = path.join(__dirname, '../ai/face_tracker.py');
    const proc = spawn('python', [pythonScript, videoPath]);
    let output = '';

    proc.stdout.on('data', data => {
      output += data.toString();
    });

    proc.on('close', () => {
      try {
        const result = JSON.parse(output.trim());
        if (!result.success || !result.face_found) {
          resolve(null);
          return;
        }

        const xRatio = typeof result.target_x_ratio === 'number'
          ? result.target_x_ratio
          : (result.source_width ? result.target_x / result.source_width : null);

        resolve(xRatio === null ? null : {
          xRatio: Math.max(0, Math.min(1, xRatio))
        });
      } catch (error) {
        resolve(null);
      }
    });

    proc.on('error', () => resolve(null));
  });
}

function buildFramingFilters(aspectRatio, cropMode, faceFocus) {
  const { w, h } = RESOLUTION_MAP[aspectRatio] || RESOLUTION_MAP['9:16'];

  if (cropMode === 'smart_crop' && faceFocus) {
    const xRatio = Number(faceFocus.xRatio.toFixed(4));
    return [
      `scale=-1:${h}`,
      `crop=${w}:${h}:'max(0,min(iw-${w},${xRatio}*iw-${w}/2))':0`
    ];
  }

  if (cropMode === 'smart_crop' || cropMode === 'center_crop') {
    return [
      `scale='max(${w},a*${h})':'max(${h},${w}/a)'`,
      `crop=${w}:${h}:(in_w-${w})/2:(in_h-${h})/2`
    ];
  }

  return [
    `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`
  ];
}

function escapeSubtitleFilterPath(subtitlePath) {
  return subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

async function processSubtitleOnlySegment(inputPath, outputPath, subtitlePath, aspectRatio = '9:16', cropMode = 'smart_crop') {
  const faceFocus = cropMode === 'smart_crop' ? await getFaceFocus(inputPath) : null;
  const filters = buildFramingFilters(aspectRatio, cropMode, faceFocus);

  if (subtitlePath && fs.existsSync(subtitlePath)) {
    const escapedPath = escapeSubtitleFilterPath(subtitlePath);
    filters.push(subtitlePath.endsWith('.ass')
      ? `ass='${escapedPath}'`
      : `subtitles='${escapedPath}':force_style='FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Alignment=2,MarginV=80'`);
  }

  filters.push('format=yuv420p');

  await runFFmpeg([
    '-i', inputPath,
    '-vf', filters.join(','),
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', process.env.FFMPEG_PRESET || 'fast',
    '-crf', process.env.FFMPEG_CRF || '23',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    '-y',
    outputPath
  ], 'Subtitle-only render');
}

async function processSegment(inputPath, outputPath, partNumber, subtitlePath = null, aspectRatio = '9:16', cropMode = 'smart_crop') {
  const { w, h } = RESOLUTION_MAP[aspectRatio] || RESOLUTION_MAP['9:16'];
  const faceFocus = cropMode === 'smart_crop' ? await getFaceFocus(inputPath) : null;
  const filters = buildFramingFilters(aspectRatio, cropMode, faceFocus);

  filters.push(
    `drawtext=text='PART ${partNumber}':fontsize=50:fontcolor=white:` +
    `x=(w-text_w)/2:y=54:borderw=3:bordercolor=black@0.8:` +
    `box=1:boxcolor=black@0.42:boxborderw=12`
  );

  if (subtitlePath && fs.existsSync(subtitlePath)) {
    const escapedPath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
    if (subtitlePath.endsWith('.ass')) {
      filters.push(`ass='${escapedPath}'`);
    } else {
      filters.push(
        `subtitles='${escapedPath}':force_style='FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Alignment=2,MarginV=80'`
      );
    }
  }

  await runFFmpeg([
    '-i', inputPath,
    '-vf', filters.join(','),
    '-c:v', 'libx264',
    '-preset', process.env.FFMPEG_PRESET || 'fast',
    '-crf', process.env.FFMPEG_CRF || '23',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    '-y',
    outputPath
  ], `Render part ${partNumber} (${w}x${h})`);
}

module.exports = {
  getFfmpegCommand,
  getFfprobeCommand,
  getFaceFocus,
  buildFramingFilters,
  runFFmpeg,
  getVideoDuration,
  splitVideo,
  cutClip,
  processSegment,
  processSubtitleOnlySegment,
  RESOLUTION_MAP
};
