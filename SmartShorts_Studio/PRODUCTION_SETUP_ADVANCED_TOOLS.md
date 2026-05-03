# Advanced tools for production-grade SmartShorts Studio

This file lists the tools I recommend installing on the other laptop. Nothing here was installed on this machine.

## Core required tools

```powershell
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.11
winget install Gyan.FFmpeg
```

## Redis queue

Use one option.

Memurai on Windows:

```powershell
winget install Memurai.MemuraiDeveloper
redis-cli ping
```

Docker Redis:

```powershell
docker run --name smartshorts-redis -p 6379:6379 -d redis:7
docker start smartshorts-redis
```

## Python virtual environment

```powershell
cd backend\python_ai
python -m venv .venv
.\.venv\Scripts\activate
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

## Advanced Python AI stack

Install this only on a strong laptop. It adds faster transcription, optional diarization, audio cleanup, and transformer emotion detection.

```powershell
cd backend\python_ai
.\.venv\Scripts\activate
pip install -r requirements-advanced.txt
```

For NVIDIA GPU, install PyTorch first from the official selector. Example for CUDA 12.1:

```powershell
pip install -U torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements-advanced.txt
```

## Optional diarization

`pyannote.audio` models may require a Hugging Face token.

```powershell
setx HF_TOKEN "your_huggingface_token_here"
```

Restart the terminal after setting the token.

## Sound effects

Place licensed or self-created sound effects in:

```text
backend\assets\sfx\
```

Expected filenames:

```text
boom.mp3
whoosh.mp3
click.mp3
clap.mp3
laugh.mp3
```

If a file is missing, SmartShorts creates a synthetic fallback sound with FFmpeg.

## Background music

Place royalty-free or licensed music in:

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

## Recommended `.env`

```env
PORT=3000
WHISPER_ENABLED=true
WHISPER_MODEL=large-v3
WHISPER_CLIP_MODEL=large-v3
FFMPEG_PRESET=fast
FFMPEG_CRF=22
FFMPEG_THREADS=0

QUEUE_ENABLED=true
REDIS_URL=redis://127.0.0.1:6379
VIDEO_WORKER_CONCURRENCY=1

PYTHON_AI_ENABLED=true
PYTHON_AI_URL=http://127.0.0.1:8001
```

## Run order

Terminal 1:

```powershell
cd backend\python_ai
.\.venv\Scripts\activate
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Terminal 2:

```powershell
cd backend
npm run dev:queue
```

Terminal 3:

```powershell
cd frontend
npm start
```

Open:

```text
http://localhost:4200
```
