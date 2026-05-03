def analyze_audio(video_path: str) -> dict:
    try:
        import librosa
        import numpy as np
    except Exception as exc:
        return {"success": False, "error": str(exc), "peaks": [], "silences": []}

    try:
        y, sr = librosa.load(video_path, sr=16000, mono=True)
        y = reduce_noise_if_available(y, sr)
        hop = int(sr * 0.5)
        rms = librosa.feature.rms(y=y, hop_length=hop)[0]
        times = librosa.frames_to_time(range(len(rms)), sr=sr, hop_length=hop)
        threshold = float(max(0.015, rms.mean() * 0.45))
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)

        peaks = [
            {"timestamp": float(t), "energy": float(v)}
            for t, v in zip(times, rms)
            if v > rms.mean() + rms.std()
        ]

        silences = []
        start = None
        for t, v in zip(times, rms):
            if v < threshold and start is None:
                start = float(t)
            elif v >= threshold and start is not None:
                end = float(t)
                if end - start >= 0.45:
                    silences.append({"start": start, "end": end, "duration": end - start})
                start = None

        duration = float(librosa.get_duration(y=y, sr=sr))
        return {
            "success": True,
            "duration": duration,
            "mean_energy": float(rms.mean()),
            "max_energy": float(rms.max()),
            "tempo": float(tempo) if not isinstance(tempo, list) else float(tempo[0]),
            "beats": [{"timestamp": float(t)} for t in beat_times[:300]],
            "peaks": peaks[:300],
            "silences": silences[:300],
        }
    except Exception as exc:
        return {"success": False, "error": str(exc), "peaks": [], "silences": []}


def reduce_noise_if_available(y, sr):
    try:
        import noisereduce as nr
        return nr.reduce_noise(y=y, sr=sr, stationary=False)
    except Exception:
        return y
