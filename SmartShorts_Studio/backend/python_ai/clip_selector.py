HOOK_WORDS = [
    "secret",
    "truth",
    "mistake",
    "changed",
    "destroyed",
    "nobody",
    "wait",
    "wrong",
    "million",
    "insane",
]


def select_clips(
    duration: float,
    transcript_segments: list[dict],
    audio_peaks: list[dict],
    scene_changes: list[dict],
    mode: str = "auto_viral",
    max_clips: int = 20,
) -> dict:
    candidates = []
    seeds = {0.0}

    for segment in transcript_segments:
        text = str(segment.get("text", "")).lower()
        if any(word in text for word in HOOK_WORDS) or "?" in text:
            seeds.add(max(0.0, float(segment.get("start", 0)) - 2.0))

    for peak in audio_peaks[:80]:
        seeds.add(max(0.0, float(peak.get("timestamp", 0)) - 4.0))

    for scene in scene_changes[:80]:
        seeds.add(max(0.0, float(scene.get("timestamp", 0)) - 1.0))

    target_durations = [20, 30, 45, 60] if mode != "gaming" else [12, 20, 30, 45]
    for start in sorted(seeds):
        for target in target_durations:
            end = min(duration, start + target)
            if end - start >= 10:
                clip = score_candidate(start, end, transcript_segments, audio_peaks, scene_changes)
                candidates.append(clip)

    candidates.sort(key=lambda item: item["viralScore"], reverse=True)
    selected = dedupe(candidates, max_clips)
    selected.sort(key=lambda item: item["start"])
    return {"success": True, "clips": selected}


def score_candidate(start: float, end: float, segments: list[dict], peaks: list[dict], scenes: list[dict]) -> dict:
    text = " ".join(
        str(segment.get("text", ""))
        for segment in segments
        if float(segment.get("start", 0)) >= start and float(segment.get("end", 0)) <= end
    )
    lowered = text.lower()
    hook_score = min(100, sum(14 for word in HOOK_WORDS if word in lowered) + (20 if "?" in text else 0))
    energy_score = min(100, sum(1 for peak in peaks if start <= float(peak.get("timestamp", 0)) <= end) * 8)
    scene_score = min(100, sum(1 for scene in scenes if start <= float(scene.get("timestamp", 0)) <= end) * 10)
    retention_score = min(100, round(hook_score * 0.45 + energy_score * 0.3 + scene_score * 0.25 + 12))
    viral_score = min(100, round(hook_score * 0.38 + energy_score * 0.25 + scene_score * 0.15 + retention_score * 0.22))

    return {
        "start": round(start, 2),
        "end": round(end, 2),
        "duration": round(end - start, 2),
        "hookText": text[:140],
        "hookScore": hook_score,
        "energyScore": energy_score,
        "sceneScore": scene_score,
        "retentionScore": retention_score,
        "viralScore": viral_score,
    }


def dedupe(candidates: list[dict], max_clips: int) -> list[dict]:
    selected = []
    for clip in candidates:
        duplicate = False
        for existing in selected:
            overlap = max(0, min(existing["end"], clip["end"]) - max(existing["start"], clip["start"]))
            smaller = max(1, min(existing["duration"], clip["duration"]))
            if overlap / smaller > 0.15:
                duplicate = True
                break
        if not duplicate:
            selected.append(clip)
        if len(selected) >= max_clips:
            break
    return selected
