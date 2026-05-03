# SmartShorts Studio

SmartShorts Studio is a local-first AI video editor and viral shorts factory. It takes one long-form video, such as a podcast, interview, debate, stream, lesson, or documentary-style video, and automatically generates short-form clips for YouTube Shorts, Instagram Reels, and TikTok.

The goal is simple:

1. Upload one long video.
2. Click **Generate Viral Shorts**.
3. Let the system analyze, clip, edit, caption, score, thumbnail, and package the results.

The app does **not** bypass copyright, DRM, watermarks, or platform protections. It is designed for original content, licensed content, or content you have the right to transform.

---

## What This Project Does

SmartShorts Studio turns a long video into multiple ready-to-upload short clips. For every generated clip, it can produce:

- A rendered MP4 short.
- Viral score and grade.
- Hook, retention, engagement, and replay scores.
- Always-on burned-in ASS captions, with fallback captions if Whisper fails.
- Face-aware vertical framing.
- Dynamic visual polish and attention resets.
- Progress bar overlay.
- Optional local B-roll split-screen insertion.
- Background music mix with voice ducking.
- Thumbnail/cover images.
- Viral title.
- Description.
- Hashtags.
- Editing timeline metadata.

The frontend gives you a creator dashboard. The backend runs the AI/media pipeline using Node.js, FFmpeg, Whisper, transcript analysis, audio analysis, scene detection, and optional Python face tracking.

---

## Main User Flow

1. Open the app at `http://localhost:4200`.
2. Drag and drop a long video file.
3. Choose AI Studio, Fixed Clips, or Subtitle Only. AI Studio shows creator modes/effects; Fixed Clips only asks for duration; Subtitle Only asks for duration and caption style.
4. Click **Generate Viral Shorts**.
5. Watch live progress.
6. Preview each generated short.
7. Download the final videos and use the generated titles, descriptions, hashtags, and thumbnails.

---

## Creator Modes

The upload screen includes three clipping engines. AI Studio changes clip selection, pacing, effects, music mood, captions, and retention strategy. Fixed Clips exports raw time-based clips. Subtitle Only exports time-based clips with burned captions and no extra edit layers.

| Mode | What It Prioritizes |
|---|---|
| Auto Viral | Best all-around hooks, energy, pacing, and retention |
| Podcast Viral | Strong podcast hooks, stories, debates, and reactions |
| Documentary | Story arcs and editorial moments |
| Finance Guru | Money, business, sales, investing, and high-value statements |
| Gaming Streamer | High-energy gameplay and fast pacing |
| Motivational Speaker | Emotional peaks and quote-worthy moments |
| Cinematic Storytelling | Slower cinematic pacing and narrative moments |
| Debate/Drama | Arguments, disagreement, controversy, and reactions |
| Meme Style | Fast cuts, high-energy moments, and punchy edits |
| Educational Tutor | Complete lessons, explanations, and useful takeaways |
| Luxury/Alpha Style | Premium business/mindset style |
| Storytelling | Narrative arcs, reveals, and story peaks |
| Dark Doc | Suspense, mystery, serious mood, and darker pacing |
| Comedy | Funny, replayable, surprising moments |

---

## How The Backend Pipeline Works

When processing starts, the backend creates a job and runs a multi-step pipeline.

### 1. Upload

The frontend uploads the selected video to:

```text
backend/uploads/{jobId}/
```

The backend stores the job in memory with status, progress, selected options, clip list, errors, thumbnails, titles, and analysis data.

### 2. Analyze Source Video

The backend uses FFprobe and FFmpeg helpers to read:

- Duration.
- Width and height.
- FPS.
- Codec.
- Bitrate.
- Audio codec.
- Audio channel count.
- File size.

This metadata is shown in job analysis and used for rendering decisions.

### 3. Transcribe With Whisper

If Whisper is available and subtitles or smart clipping are enabled, the backend transcribes the full video.

Default model:

```env
WHISPER_MODEL=large-v3
```

The transcript is used for:

- Hook detection.
- Question detection.
- Emotional wording.
- Curiosity gaps.
- Controversial statements.
- Story peaks.
- Subtitle generation.

If Whisper is not installed or disabled, the app still runs. It falls back to scene/audio/duration-based clipping.

### 4. Detect Viral Moments

The smart clipper analyzes several signals:

- Transcript hook score.
- Audio energy.
- Silence gaps.
- Scene changes.
- High-activity visual regions.
- Opening strength.
- Story completion.
- Retention probability.
- Replay potential.

It does not cut only by fixed duration. It generates many candidate windows, scores them, removes overlapping lower-quality clips, and keeps the best clips.

Each selected clip receives:

- `viralScore`
- `grade`
- `hookText`
- `reason`
- `emotion`
- `details.hookScore`
- `details.energyScore`
- `details.sceneScore`
- `details.pacingScore`
- `details.retentionScore`
- `details.engagementPrediction`
- `details.replayPotential`

### 5. Cut Clip Segments

The backend cuts each selected time range from the original video.

It first tries fast stream-copy cutting. If that fails, it retries with precise re-encoding. This makes the app more reliable across different video formats.

### 6. Generate Captions

For each clip, the backend can generate subtitles and convert them to styled ASS captions.

Captions are forced on for exported videos. The backend attempts Whisper whenever the `whisper` command is available. If Whisper fails or returns no subtitle file, the system creates a fallback ASS caption track from the clip hook/title/reason so the final render still has visible burned-in captions.

Supported caption presets include:

- Default
- Hormozi
- MrBeast
- Iman Gadzhi
- Podcast
- Gaming
- Documentary
- Cinematic
- Minimalist

The subtitle styler adds:

- Karaoke-style timing.
- Emphasis words.
- Larger important words.
- Pop/scale animation.
- High-contrast mobile-safe font sizes.
- Thick black outlines and shadow.
- Uppercase hook styles for some presets.

### 7. Frame And Render

The render step turns each clip into the chosen output format:

- `9:16` for Shorts/Reels/TikTok.
- `16:9` for YouTube landscape.
- `1:1` for square posts.
- `4:5` for Instagram feed.

Crop modes:

- Smart Crop: uses Python face tracking when available.
- Center Crop: fills the frame from the center.
- Letterbox: preserves full frame with padding.

The rendered video also gets a `PART X` label.

### 8. Apply AI Editing During Final Render

The final renderer applies creator-style visual polish inside the final FFmpeg command:

- Subtle punch zoom / movement.
- Contrast and saturation tuning.
- Sharpening.
- Mood-based color grade.
- Light attention-reset flashes.
- Hook intro overlay, reaction sticker text, and keyword callouts.
- Effects-level scaling for low, medium, or aggressive creator edits.
- Bottom progress bar.
- Burned ASS captions.
- Generated boom/click/whoosh sound effects.
- Background music ducking when music is available.
- Output-safe `yuv420p` formatting.

The exact mood depends on the selected creator mode.

### 9. Optional Local B-Roll

If enabled, the backend looks in:

```text
backend/broll/
```

If it finds a local `.mp4`, it creates a split-screen B-roll version. This is intentionally local-first. The project does not download stock footage automatically.

### 10. Add Overlay

The overlay engine adds a TikTok-style progress bar at the bottom of the video.

### 11. Mix Audio

If enabled and a music file exists in:

```text
backend/assets/lofi_beat.mp3
```

The backend mixes background music under the voice.

The audio mixer includes:

- Voice normalization.
- Background music volume control.
- Sidechain compression / ducking.
- Final loudness normalization.

If no music file exists, the app simply exports the clip without background music.

### 12. Generate Thumbnails

For every final clip, the backend generates:

- Shorts cover.
- YouTube thumbnail.
- Instagram cover.

The thumbnail generator selects a frame, crops it to the target format, boosts contrast/saturation, sharpens it, and overlays bold hook text.

### 13. Generate SEO Metadata

Each clip receives:

- Viral title.
- Description.
- Hashtags.
- CTA.
- Platform-specific metadata for Shorts, Reels, and TikTok.

The SEO engine adapts the text based on:

- Hook text.
- Emotion.
- Clip mode.
- Topic keywords.
- Viral angle.

### 14. Show Results In Dashboard

The frontend receives live updates through Server-Sent Events.

The results dashboard shows:

- Processing state.
- Pipeline step.
- Progress percentage.
- Clip previews.
- Viral scores.
- Hook/retention/engagement/replay scores.
- Timeline summary.
- Tips.
- Thumbnails.
- Title.
- Description.
- Hashtags.
- Download buttons.

---

## Architecture

```text
SmartShorts Studio
|
|-- frontend/               Angular creator dashboard
|   |-- upload component     File upload and AI mode settings
|   |-- clips component      Results, previews, scores, metadata
|   |-- api service          HTTP API calls
|   |-- sse service          Live job progress
|
|-- backend/                Node.js + Express API
|   |-- routes/             Upload, process, status, clips, download, SSE
|   |-- services/           Job store and pipeline orchestration
|   |-- ai/                 Clipping, transcript, scoring, SEO, retention
|   |-- effects/            Captions, overlays, thumbnails, audio, visual polish
|   |-- utils/              FFmpeg, FFprobe, Whisper wrappers
|   |-- uploads/            Uploaded videos, created at runtime
|   |-- outputs/            Final clips and thumbnails, created at runtime
```

---

## Important Files

| File | Purpose |
|---|---|
| `backend/server.js` | Starts the Express backend |
| `backend/routes/api.js` | Upload, process, status, clips, download routes |
| `backend/routes/sse.js` | Live progress events |
| `backend/services/videoProcessor.js` | Main video processing pipeline |
| `backend/services/pipelineManager.js` | Runs pipeline steps and updates progress |
| `backend/services/jobStore.js` | In-memory job state |
| `backend/ai/smartClipper.js` | Viral moment detection and clip scoring |
| `backend/ai/transcriptAnalyzer.js` | Hook, emotion, keyword, and transcript analysis |
| `backend/ai/audioAnalyzer.js` | Silence and energy analysis |
| `backend/ai/sceneDetector.js` | Scene-change detection |
| `backend/ai/seoEngine.js` | Titles, descriptions, hashtags |
| `backend/ai/retentionOptimizer.js` | Edit-plan and retention metadata |
| `backend/effects/subtitleStyler.js` | ASS subtitle styling |
| `backend/effects/autoEditor.js` | Visual polish and attention resets |
| `backend/effects/audioMixer.js` | Background music, ducking, normalization |
| `backend/effects/thumbnailGenerator.js` | Cover/thumbnail generation |
| `backend/utils/ffmpeg.js` | FFmpeg wrapper and rendering helpers |
| `backend/utils/whisper.js` | Whisper CLI wrapper |
| `frontend/src/app/components/upload/` | Upload and settings UI |
| `frontend/src/app/components/clips/` | Result dashboard UI |
| `COMMANDS_TO_RUN_ON_OTHER_LAPTOP.md` | Exact setup/run commands |

---

## Setup On Another Laptop

I did not install dependencies on this machine. Use:

```text
COMMANDS_TO_RUN_ON_OTHER_LAPTOP.md
```

That file contains the exact commands to:

- Verify Node, npm, FFmpeg, FFprobe, Python, and pip.
- Install project npm packages.
- Optionally install Whisper, OpenCV, MediaPipe, and NumPy.
- Create `.env`.
- Run backend and frontend.
- Build/check the project.

---

## Required Tools

Minimum:

- Node.js
- npm
- FFmpeg
- FFprobe

Optional but recommended:

- Python
- OpenAI Whisper CLI
- OpenCV Python
- MediaPipe
- NumPy

Whisper is needed for best hook detection and captions. MediaPipe/OpenCV are needed for face-aware smart crop.

---

## Environment Configuration

Create:

```text
backend/.env
```

From:

```text
backend/.env.example
```

Important options:

```env
PORT=3000
UPLOAD_DIR=./uploads
OUTPUT_DIR=./outputs
MAX_FILE_SIZE_MB=5000
DEFAULT_CLIP_DURATION=45

WHISPER_ENABLED=false
WHISPER_MODEL=large-v3
WHISPER_CLIP_MODEL=large-v3

FFMPEG_PRESET=fast
FFMPEG_CRF=22
```

Set this on your processing laptop if Whisper is installed:

```env
WHISPER_ENABLED=true
```

---

## Run The App

Backend:

```powershell
cd backend
npm run dev
```

Frontend:

```powershell
cd frontend
npm start
```

Open:

```text
http://localhost:4200
```

---

## API Overview

Base URL:

```text
http://localhost:3000/api
```

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/upload` | Upload video |
| `POST` | `/process` | Start processing uploaded video |
| `GET` | `/status/:jobId` | Get live job status |
| `GET` | `/clips/:jobId` | Get generated clips |
| `GET` | `/download/:jobId/:clipName` | Download one clip |
| `GET` | `/jobs` | List all jobs |
| `GET` | `/events/:jobId` | Server-Sent Events stream |

---

## Output Structure

Final files are written to:

```text
backend/outputs/{jobId}/
```

Example:

```text
outputs/
  job-id/
    Part_01.mp4
    Part_01_shorts_cover.jpg
    Part_01_youtube_thumb.jpg
    Part_01_instagram_cover.jpg
    Part_02.mp4
    Part_02_shorts_cover.jpg
    Part_02_youtube_thumb.jpg
    Part_02_instagram_cover.jpg
```

Temporary segments are created during processing and cleaned after the pipeline finishes.

---

## What Happens If Optional Tools Are Missing

| Missing Tool | What Happens |
|---|---|
| Whisper | Captions/transcript hooks are skipped; audio/scene fallback still works |
| Python face tracking | Smart Crop falls back to center crop |
| Local B-roll files | B-roll step is skipped |
| Background music file | Audio music mix is skipped |
| Bundled FFmpeg | System `ffmpeg` from PATH is used |

---

## Current Limitations

- Jobs are stored in memory, so they reset when the backend restarts.
- Processing is local and can be slow for 1-3 hour videos on weak laptops.
- The current B-roll system uses local files only.
- Whisper large-v3 gives better output but needs more compute.
- Thumbnail generation is FFmpeg-based, not generative AI.
- The editor is automated, not a full manual Premiere-style timeline editor yet.

---

## Safety And Rights

Use this app only with videos you own, created, licensed, or have permission to transform.

This project should not be used for:

- DRM bypass.
- Watermark removal.
- Reuploading copyrighted content without rights.
- Circumventing platform protections.

The intended use is creator-owned content repurposing and transformative editing workflows.

---

## Troubleshooting

### FFmpeg not found

Make sure `ffmpeg` and `ffprobe` work in your terminal:

```powershell
ffmpeg -version
ffprobe -version
```

The backend also checks for bundled binaries in:

```text
ffmpeg/ffmpeg.exe
ffmpeg/ffprobe.exe
```

### Subtitles are missing

Check:

```powershell
whisper --help
```

And set:

```env
WHISPER_ENABLED=true
```

### Smart Crop does not follow faces

Install optional Python tools on the processing laptop:

```powershell
pip install -U opencv-python mediapipe numpy
```

If not installed, the app still renders clips using center crop.

### Processing is slow

Try:

```env
WHISPER_MODEL=base
WHISPER_CLIP_MODEL=base
FFMPEG_PRESET=veryfast
```

Quality may be lower, but processing is faster.

### Frontend cannot connect to backend

Make sure the backend is running on:

```text
http://localhost:3000
```

And the frontend is running on:

```text
http://localhost:4200
```

---

## In One Sentence

SmartShorts Studio is a local AI-powered pipeline that analyzes a long video, finds the best short-form moments, edits them with captions/effects/audio/thumbnails, scores them for virality, and packages them for upload.
