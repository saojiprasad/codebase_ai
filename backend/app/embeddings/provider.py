import hashlib
import math
import re
from functools import cached_property
from typing import Iterable

from app.core.config import Settings


class EmbeddingProvider:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @cached_property
    def model(self):
        if self.settings.embedding_provider != "sentence-transformers":
            return None
        try:
            from sentence_transformers import SentenceTransformer

            return SentenceTransformer(self.settings.embedding_model)
        except Exception:
            return None

    def embed(self, texts: Iterable[str]) -> list[list[float]]:
        text_list = list(texts)
        if self.model is not None:
            vectors = self.model.encode(text_list, normalize_embeddings=True, show_progress_bar=False)
            return [vector.tolist() for vector in vectors]
        return [hash_embedding(text) for text in text_list]


def hash_embedding(text: str, dimensions: int = 384) -> list[float]:
    vector = [0.0] * dimensions
    for token in tokenize(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def tokenize(text: str) -> list[str]:
    return re.findall(r"[A-Za-z_][A-Za-z0-9_]{1,}|[/.:-]+", text.lower())[:4000]

