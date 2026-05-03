EMOTION_KEYWORDS = {
    "funny": ["funny", "laugh", "joke", "hilarious", "ridiculous"],
    "tense": ["wrong", "lie", "exposed", "argument", "fight", "debate"],
    "surprise": ["secret", "shocking", "crazy", "insane", "unbelievable"],
    "motivational": ["success", "discipline", "mindset", "dream", "win"],
    "fear": ["danger", "risk", "mistake", "destroy", "lost"],
}


def analyze_emotion(text: str) -> dict:
    advanced = analyze_with_transformers(text)
    if advanced:
        return advanced

    lowered = text.lower()
    scores = {
        emotion: sum(1 for word in words if word in lowered)
        for emotion, words in EMOTION_KEYWORDS.items()
    }
    best = max(scores, key=scores.get) if scores else "neutral"
    if scores.get(best, 0) == 0:
        best = "neutral"

    return {
        "success": True,
        "emotion": best,
        "scores": scores,
    }


def analyze_with_transformers(text: str) -> dict | None:
    try:
        from transformers import pipeline
    except Exception:
        return None

    try:
        classifier = pipeline(
            "text-classification",
            model="j-hartmann/emotion-english-distilroberta-base",
            top_k=None,
        )
        results = classifier(text[:1200])[0]
        scores = {item["label"].lower(): float(item["score"]) for item in results}
        emotion = max(scores, key=scores.get) if scores else "neutral"
        return {
            "success": True,
            "engine": "transformers",
            "emotion": emotion,
            "scores": scores,
        }
    except Exception:
        return None
