from fastapi import FastAPI
from pydantic import BaseModel

from whisper_service import transcribe_video
from face_tracking import track_faces
from emotion_detector import analyze_emotion
from audio_analyzer import analyze_audio
from clip_selector import select_clips

app = FastAPI(title="SmartShorts Python AI Service", version="1.0.0")


class VideoPathRequest(BaseModel):
    video_path: str
    output_dir: str | None = None
    model: str = "large-v3"


class EmotionRequest(BaseModel):
    text: str


class ClipSelectionRequest(BaseModel):
    duration: float
    transcript_segments: list[dict] = []
    audio_peaks: list[dict] = []
    scene_changes: list[dict] = []
    mode: str = "auto_viral"
    max_clips: int = 20


@app.get("/health")
def health():
    return {"ok": True, "service": "smartshorts-python-ai"}


@app.post("/transcribe")
def transcribe(req: VideoPathRequest):
    return transcribe_video(req.video_path, req.output_dir, req.model)


@app.post("/audio/analyze")
def audio(req: VideoPathRequest):
    return analyze_audio(req.video_path)


@app.post("/face/track")
def face(req: VideoPathRequest):
    return track_faces(req.video_path)


@app.post("/emotion/analyze")
def emotion(req: EmotionRequest):
    return analyze_emotion(req.text)


@app.post("/clips/select")
def clips(req: ClipSelectionRequest):
    return select_clips(
        duration=req.duration,
        transcript_segments=req.transcript_segments,
        audio_peaks=req.audio_peaks,
        scene_changes=req.scene_changes,
        mode=req.mode,
        max_clips=req.max_clips,
    )
