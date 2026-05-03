# Commands to run on the other laptop

Run these from the project root on the laptop where you want to process videos. I did not install anything on this machine.

## Clip mode behavior

SmartShorts Studio now has three clipping modes:

```text
AI Studio      = AI selects viral moments and applies full creator editing.
Fixed Clips    = raw time-based clips only; no subtitles, effects, SFX, BGM, or thumbnails.
Subtitle Only  = fixed time-based clips with burned captions only; no zooms, hook overlay, SFX, or BGM.
```

Fixed Clips and Subtitle Only use these durations only:

```text
30, 45, 60, 75, 90, 120, 150, 180 seconds
```
## 1. Verify required tools

```powershell
node -v
npm -v
ffmpeg -version
ffprobe -version
python --version
pip --version
```

This Angular frontend requires Node.js 20.19 or newer. If `node -v` shows Node 14, 16, or 18, install/update Node before running the frontend:

```powershell
winget install OpenJS.NodeJS.LTS
node -v
```

If you are using bundled FFmpeg binaries in this repo:

```powershell
if (Test-Path .\ffmpeg\ffmpeg.exe) { .\ffmpeg\ffmpeg.exe -version }
if (Test-Path .\ffmpeg\ffprobe.exe) { .\ffmpeg\ffprobe.exe -version }
```

## 2. Install Node packages

```powershell
npm install
cd backend
npm install
cd ..\frontend
npm install
cd ..
```

## 3. Install Python AI packages

Recommended:

```powershell
cd backend\python_ai
python -m venv .venv
.\.venv\Scripts\activate
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
cd ..\..
```

Advanced install for stronger transcription, emotion detection, diarization helpers, and audio cleanup:

```powershell
cd backend\python_ai
.\.venv\Scripts\activate
pip install -r requirements-advanced.txt
cd ..\..
```

If your laptop has an NVIDIA GPU, install the correct PyTorch build before Whisper. Example for CUDA 12.1:

```powershell
pip install -U torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
cd backend\python_ai
.\.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-advanced.txt
cd ..\..
```

## 4. Optional Redis queue

Redis is optional. The app works without it. Use Redis if you want BullMQ queue behavior.

Windows options:

```powershell
winget install Memurai.MemuraiDeveloper
```

Or run Redis with Docker:

```powershell
docker run --name smartshorts-redis -p 6379:6379 -d redis:7
```

Or use the included compose file:

```powershell
docker compose up -d redis
```

Verify:

```powershell
redis-cli ping
```

## 5. Add local sound effects and music

Put SFX files here:

```text
backend\assets\sfx\
```

Expected filenames:

```text
boom.mp3
swoosh.mp3
whoosh.mp3
click.mp3
clap.mp3
laugh.mp3
```

Put background music here:

```text
backend\assets\music\
```

Suggested filenames:

```text
hype.mp3
upbeat.mp3
lofi.mp3
cinematic.mp3
inspire.mp3
suspense.mp3
dark.mp3
fun.mp3
meme.mp3
premium.mp3
```

Use only royalty-free, licensed, or self-created audio.

You can generate starter local SFX and music with FFmpeg, so the editor has boom/swoosh/click/clap/laugh/music immediately:

```powershell
New-Item -ItemType Directory -Force backend\assets\sfx, backend\assets\music | Out-Null

ffmpeg -y -f lavfi -i "sine=frequency=58:duration=0.28" -af "volume=0.55,afade=t=out:st=0.12:d=0.16" backend\assets\sfx\boom.mp3
ffmpeg -y -f lavfi -i "anoisesrc=color=pink:duration=0.36" -af "highpass=f=850,lowpass=f=3600,volume=0.28,afade=t=in:st=0:d=0.04,afade=t=out:st=0.24:d=0.12" backend\assets\sfx\swoosh.mp3
ffmpeg -y -f lavfi -i "sine=frequency=1450:duration=0.055" -af "volume=0.30" backend\assets\sfx\click.mp3
ffmpeg -y -f lavfi -i "anoisesrc=color=white:duration=0.08" -af "highpass=f=1800,volume=0.36" backend\assets\sfx\clap.mp3
ffmpeg -y -f lavfi -i "sine=frequency=520:duration=0.24" -af "volume=0.22,tremolo=f=9:d=0.65" backend\assets\sfx\laugh.mp3

ffmpeg -y -f lavfi -i "sine=frequency=110:duration=12" -f lavfi -i "sine=frequency=220:duration=12" -filter_complex "[0:a]volume=0.10[a0];[1:a]volume=0.045,tremolo=f=4:d=0.45[a1];[a0][a1]amix=inputs=2,afade=t=in:st=0:d=0.5,afade=t=out:st=11.2:d=0.8" backend\assets\music\hype.mp3
ffmpeg -y -f lavfi -i "sine=frequency=146.83:duration=12" -f lavfi -i "sine=frequency=293.66:duration=12" -filter_complex "[0:a]volume=0.08[a0];[1:a]volume=0.04,aecho=0.6:0.45:700:0.25[a1];[a0][a1]amix=inputs=2,afade=t=in:st=0:d=0.5,afade=t=out:st=11.2:d=0.8" backend\assets\music\cinematic.mp3
```

Replace these generated placeholders with your own licensed creator sound packs whenever you want higher production value.

## 6. Create backend config

```powershell
cd backend
copy .env.example .env
cd ..
```

Recommended `.env` for normal local use:

```env
PORT=3000
WHISPER_ENABLED=true
WHISPER_MODEL=large-v3
WHISPER_CLIP_MODEL=large-v3
FFMPEG_PRESET=fast
FFMPEG_CRF=22
FFMPEG_THREADS=0
DEFAULT_EFFECTS_LEVEL=aggressive
FORCE_VERTICAL_OUTPUT=true
QUEUE_ENABLED=false
PYTHON_AI_URL=http://127.0.0.1:8001
PYTHON_AI_ENABLED=false
```

If Redis is installed and running:

```env
QUEUE_ENABLED=true
REDIS_URL=redis://127.0.0.1:6379
VIDEO_WORKER_CONCURRENCY=1
```

If you want the backend to call the Python AI service:

```env
PYTHON_AI_ENABLED=true
PYTHON_AI_URL=http://127.0.0.1:8001
```

## 7. Run the optional Python AI service

Terminal 1:

```powershell
cd backend\python_ai
.\.venv\Scripts\activate
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Open:

```text
http://127.0.0.1:8001/health
```

## 8. Run the backend

Terminal 2:

```powershell
cd backend
npm run dev
```

If Redis queue is enabled:

```powershell
cd backend
npm run dev:queue
```

Backend console logs to watch:

```text
[AI] pipeline started
[AI] probing source video
[WHISPER] Transcribing video/audio
[AI] SmartClipper final clips selected
[AI] AI editor plan for clip
[RENDER] final AI edit render
[RENDER] Final renderer assembled FFmpeg graph
[RENDER] clip ready
```

These logs confirm the AI analysis, subtitle generation, unique clip selection, human-style edit planning, and FFmpeg editing pipeline are running.

## 9. Run the frontend

Terminal 3:

```powershell
cd frontend
npm start
```

Open:

```text
http://localhost:4200
```

## 10. Build and syntax check

```powershell
cd frontend
npm run build -- --configuration development
cd ..\backend
node --check server.js
node --check services\videoProcessor.js
node --check effects\finalRenderer.js
```
