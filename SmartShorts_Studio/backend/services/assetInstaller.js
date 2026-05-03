const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const { ASSET_ROOT, ensureAssetTree, rebuildAssetIndex } = require('./assetLibrary');
const { runFFmpeg } = require('../utils/ffmpeg');

const REQUIRED_ASSETS = [
  { type: 'sfx', category: 'whooshes', name: 'whoosh.wav', kind: 'sfx', recipe: 'whoosh' },
  { type: 'sfx', category: 'impacts', name: 'impact.wav', kind: 'sfx', recipe: 'impact' },
  { type: 'sfx', category: 'bass_drops', name: 'bassdrop.wav', kind: 'sfx', recipe: 'bassdrop' },
  { type: 'sfx', category: 'meme', name: 'pop.wav', kind: 'sfx', recipe: 'pop' },
  { type: 'sfx', category: 'glitches', name: 'glitch.wav', kind: 'sfx', recipe: 'glitch' },
  { type: 'sfx', category: 'risers', name: 'riser.wav', kind: 'sfx', recipe: 'riser' },
  { type: 'sfx', category: 'laugh', name: 'laugh.wav', kind: 'sfx', recipe: 'laugh' },
  { type: 'sfx', category: 'crowd', name: 'clap.wav', kind: 'sfx', recipe: 'clap' },
  { type: 'sfx', category: 'cinematic', name: 'camera_shutter.wav', kind: 'sfx', recipe: 'shutter' },
  { type: 'bgm', category: 'lofi', name: 'local_lofi.mp3', kind: 'bgm', recipe: 'lofi' },
  { type: 'bgm', category: 'cinematic', name: 'local_cinematic.mp3', kind: 'bgm', recipe: 'cinematic' },
  { type: 'bgm', category: 'motivational', name: 'local_motivational.mp3', kind: 'bgm', recipe: 'motivational' },
  { type: 'bgm', category: 'dark', name: 'local_suspense.mp3', kind: 'bgm', recipe: 'suspense' },
  { type: 'bgm', category: 'gaming', name: 'local_hype.mp3', kind: 'bgm', recipe: 'hype' },
  { type: 'bgm', category: 'emotional', name: 'local_emotional.mp3', kind: 'bgm', recipe: 'emotional' },
  { type: 'overlays', category: 'flashes', name: 'white_flash.mp4', kind: 'overlay', recipe: 'flash' },
  { type: 'overlays', category: 'glitches', name: 'rgb_glitch.mp4', kind: 'overlay', recipe: 'glitch' },
  { type: 'overlays', category: 'particles', name: 'particles.mp4', kind: 'overlay', recipe: 'particles' },
  { type: 'overlays', category: 'light_leaks', name: 'light_leak.mp4', kind: 'overlay', recipe: 'light_leak' },
  { type: 'overlays', category: 'smoke', name: 'smoke.mp4', kind: 'overlay', recipe: 'smoke' },
  { type: 'transitions', category: 'zoom', name: 'zoom_transition.mp4', kind: 'overlay', recipe: 'zoom_transition' },
  { type: 'transitions', category: 'flash', name: 'flash_transition.mp4', kind: 'overlay', recipe: 'flash' },
  { type: 'transitions', category: 'shake', name: 'shake_transition.mp4', kind: 'overlay', recipe: 'shake' },
  { type: 'broll', category: 'finance', name: 'money_motion.mp4', kind: 'broll', recipe: 'finance' },
  { type: 'broll', category: 'technology', name: 'tech_motion.mp4', kind: 'broll', recipe: 'technology' },
  { type: 'broll', category: 'gaming', name: 'gaming_motion.mp4', kind: 'broll', recipe: 'gaming' },
  { type: 'broll', category: 'luxury', name: 'luxury_motion.mp4', kind: 'broll', recipe: 'luxury' },
  { type: 'broll', category: 'nature', name: 'nature_motion.mp4', kind: 'broll', recipe: 'nature' },
  { type: 'emojis', category: 'fire', name: 'fire.png', kind: 'emoji', recipe: 'FIRE' },
  { type: 'emojis', category: 'skull', name: 'skull.png', kind: 'emoji', recipe: 'DEAD' },
  { type: 'emojis', category: 'crying', name: 'crying.png', kind: 'emoji', recipe: 'LOL' },
  { type: 'emojis', category: 'shocked', name: 'shocked.png', kind: 'emoji', recipe: 'WOW' },
  { type: 'emojis', category: 'money', name: 'money.png', kind: 'emoji', recipe: '$$$' },
  { type: 'emojis', category: 'clap', name: 'clap.png', kind: 'emoji', recipe: 'CLAP' },
  { type: 'emojis', category: 'explosion', name: 'explosion.png', kind: 'emoji', recipe: 'BOOM' }
];

function assetPath(asset) {
  return path.join(ASSET_ROOT, asset.type, asset.category, asset.name);
}

function hasFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
}

async function createSfx(filePath, recipe) {
  const recipes = {
    whoosh: 'anoisesrc=color=pink:duration=0.45,highpass=f=550,lowpass=f=4200,afade=t=in:st=0:d=0.06,afade=t=out:st=0.28:d=0.17,volume=0.28',
    impact: 'sine=frequency=72:duration=0.32,volume=0.55,afade=t=out:st=0.12:d=0.2',
    bassdrop: 'sine=frequency=88:duration=0.62,asetrate=44100*0.72,aresample=44100,volume=0.52,afade=t=out:st=0.28:d=0.32',
    pop: 'sine=frequency=960:duration=0.09,volume=0.38,afade=t=out:st=0.04:d=0.05',
    glitch: 'anoisesrc=color=white:duration=0.28,acrusher=bits=5:mix=0.85,volume=0.16',
    riser: 'sine=frequency=260:duration=0.9,asetrate=44100*1.45,aresample=44100,volume=0.24,afade=t=in:st=0:d=0.16',
    laugh: 'sine=frequency=540:duration=0.42,tremolo=f=8:d=0.8,volume=0.18',
    clap: 'anoisesrc=color=white:duration=0.12,highpass=f=1700,volume=0.26,afade=t=out:st=0.04:d=0.08',
    shutter: 'anoisesrc=color=white:duration=0.055,highpass=f=2500,volume=0.3'
  };
  await runFFmpeg(['-y', '-f', 'lavfi', '-i', recipes[recipe], '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', filePath], `Install ${recipe} SFX`);
}

async function createBgm(filePath, recipe) {
  const recipeMap = {
    lofi: ['220', '277', '330'],
    cinematic: ['110', '165', '220'],
    motivational: ['196', '247', '294'],
    suspense: ['82', '110', '147'],
    hype: ['146', '196', '392'],
    emotional: ['174', '220', '261']
  };
  const tones = recipeMap[recipe] || recipeMap.lofi;
  const filter = [
    `sine=frequency=${tones[0]}:duration=16[a0]`,
    `sine=frequency=${tones[1]}:duration=16[a1]`,
    `sine=frequency=${tones[2]}:duration=16[a2]`,
    '[a0][a1][a2]amix=inputs=3:duration=longest,volume=0.13,afade=t=in:st=0:d=1.2,afade=t=out:st=14.5:d=1.3,loudnorm=I=-20:TP=-2:LRA=8[aout]'
  ].join(';');
  await runFFmpeg(['-y', '-filter_complex', filter, '-map', '[aout]', '-c:a', 'libmp3lame', '-b:a', '160k', filePath], `Install ${recipe} BGM`);
}

async function createMotionAsset(filePath, asset) {
  const text = asset.recipe.replace(/_/g, ' ').toUpperCase();
  const color = asset.kind === 'broll' ? '0x111827' : 'black@0.0';
  const duration = asset.kind === 'broll' ? '8' : '3';
  const filter = [
    `color=c=${color}:s=1080x1920:d=${duration}:r=30`,
    asset.recipe.includes('glitch') ? 'lutrgb=r=negval:g=val:b=negval' : 'eq=contrast=1.08:saturation=1.18',
    asset.recipe.includes('flash') ? "drawbox=x=0:y=0:w=iw:h=ih:color=white@0.35:t=fill:enable='lt(mod(t,0.7),0.08)'" : 'null',
    asset.recipe.includes('particles') ? "drawbox=x='mod(t*260,iw)':y='mod(t*420,ih)':w=18:h=18:color=white@0.45:t=fill" : 'null',
    asset.recipe.includes('light') ? "drawbox=x='-200+t*260':y=0:w=360:h=ih:color=0xffcc66@0.18:t=fill" : 'null',
    asset.kind === 'broll' ? `drawtext=text='${text}':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=72:fontcolor=white@0.78:borderw=4:bordercolor=black@0.7` : 'null',
    'format=yuv420p'
  ].join(',');
  await runFFmpeg(['-y', '-f', 'lavfi', '-i', filter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-movflags', '+faststart', filePath], `Install ${asset.recipe} motion asset`);
}

async function createEmoji(filePath, label) {
  const safe = label.replace(/'/g, '');
  await runFFmpeg([
    '-y',
    '-f', 'lavfi',
    '-i', 'color=c=black@0.0:s=512x512:d=0.1',
    '-vf', `drawbox=x=36:y=116:w=440:h=280:color=0xffd166@0.95:t=fill,drawtext=text='${safe}':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=86:fontcolor=black:borderw=0,format=rgba`,
    '-frames:v', '1',
    filePath
  ], `Install ${label} emoji`);
}

function downloadFile(url, outputPath) {
  return new Promise(resolve => {
    const file = fs.createWriteStream(outputPath);
    const request = https.get(url, response => {
      if (response.statusCode !== 200) {
        file.close();
        fs.rmSync(outputPath, { force: true });
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    });
    request.on('error', () => {
      file.close();
      fs.rmSync(outputPath, { force: true });
      resolve(false);
    });
    request.setTimeout(20000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function maybeInstallOpenFont() {
  const target = path.join(ASSET_ROOT, 'fonts', 'creator', 'Inter-Regular.ttf');
  if (hasFile(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const url = process.env.FONT_DOWNLOAD_URL || 'https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.woff2';
  const downloaded = await downloadFile(url, target);
  if (!downloaded) {
    fs.writeFileSync(path.join(path.dirname(target), 'README.txt'), 'SmartShorts uses system fonts when no downloaded open font is available.');
  }
}

async function installAsset(asset) {
  const output = assetPath(asset);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (hasFile(output)) return { name: asset.name, skipped: true };
  if (asset.kind === 'sfx') await createSfx(output, asset.recipe);
  if (asset.kind === 'bgm') await createBgm(output, asset.recipe);
  if (asset.kind === 'overlay' || asset.kind === 'broll') await createMotionAsset(output, asset);
  if (asset.kind === 'emoji') await createEmoji(output, asset.recipe);
  return { name: asset.name, installed: hasFile(output) };
}

async function installRequiredAssets() {
  ensureAssetTree();
  const results = [];
  for (const asset of REQUIRED_ASSETS) {
    try {
      results.push(await installAsset(asset));
    } catch (error) {
      results.push({ name: asset.name, error: error.message });
    }
  }
  await maybeInstallOpenFont();
  await rebuildAssetIndex();
  return results;
}

module.exports = {
  installRequiredAssets,
  REQUIRED_ASSETS
};
