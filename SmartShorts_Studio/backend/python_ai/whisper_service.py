import json
import subprocess
from pathlib import Path


def transcribe_video(video_path: str, output_dir: str | None = None, model: str = "large-v3") -> dict:
    source = Path(video_path)
    out_dir = Path(output_dir) if output_dir else source.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    expected_srt = out_dir / f"{source.stem}.srt"

    faster = transcribe_with_faster_whisper(source, expected_srt, model)
    if faster["success"]:
        return faster

    command = [
        "whisper",
        str(source),
        "--model",
        model,
        "--output_format",
        "srt",
        "--output_dir",
        str(out_dir),
    ]

    try:
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode == 0 and expected_srt.exists():
            return {
                "success": True,
                "srt_path": str(expected_srt),
                "model": model,
                "segments": parse_srt(expected_srt.read_text(encoding="utf-8", errors="ignore")),
            }

        if model != "base":
            return transcribe_video(video_path, output_dir, "base")

        return {
            "success": False,
            "error": result.stderr[-1000:],
            "srt_path": None,
            "segments": [],
        }
    except Exception as exc:
        return {"success": False, "error": str(exc), "srt_path": None, "segments": []}


def transcribe_with_faster_whisper(source: Path, expected_srt: Path, model: str) -> dict:
    try:
        from faster_whisper import WhisperModel
    except Exception:
        return {"success": False, "error": "faster-whisper not installed", "srt_path": None, "segments": []}

    try:
        device = "cuda"
        compute_type = "float16"
        try:
            import torch
            if not torch.cuda.is_available():
                device = "cpu"
                compute_type = "int8"
        except Exception:
            device = "cpu"
            compute_type = "int8"

        fw_model = WhisperModel(model, device=device, compute_type=compute_type)
        segments, info = fw_model.transcribe(str(source), vad_filter=True, word_timestamps=True)
        parsed = []
        with expected_srt.open("w", encoding="utf-8") as handle:
            for index, segment in enumerate(segments, start=1):
                text = segment.text.strip()
                parsed.append({"start": float(segment.start), "end": float(segment.end), "text": text})
                handle.write(f"{index}\n")
                handle.write(f"{to_srt_time(segment.start)} --> {to_srt_time(segment.end)}\n")
                handle.write(f"{text}\n\n")

        return {
            "success": True,
            "engine": "faster-whisper",
            "srt_path": str(expected_srt),
            "model": model,
            "language": getattr(info, "language", None),
            "segments": parsed,
        }
    except Exception as exc:
        return {"success": False, "error": str(exc), "srt_path": None, "segments": []}


def parse_srt(content: str) -> list[dict]:
    segments: list[dict] = []
    for block in content.strip().split("\n\n"):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 3 or "-->" not in lines[1]:
            continue
        start_raw, end_raw = [part.strip() for part in lines[1].split("-->")]
        segments.append(
            {
                "start": to_seconds(start_raw),
                "end": to_seconds(end_raw),
                "text": " ".join(lines[2:]),
            }
        )
    return segments


def to_seconds(value: str) -> float:
    time_part, ms_part = value.split(",")
    hours, minutes, seconds = [int(part) for part in time_part.split(":")]
    return hours * 3600 + minutes * 60 + seconds + int(ms_part) / 1000


def to_srt_time(seconds: float) -> str:
    millis = int(round(seconds * 1000))
    hours, rest = divmod(millis, 3600000)
    minutes, rest = divmod(rest, 60000)
    secs, ms = divmod(rest, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{ms:03}"
