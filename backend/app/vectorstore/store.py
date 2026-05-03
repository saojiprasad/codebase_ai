import json
import math
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.embeddings.provider import EmbeddingProvider


class VectorStore:
    def __init__(self, settings: Settings, embeddings: EmbeddingProvider) -> None:
        self.settings = settings
        self.embeddings = embeddings
        self.settings.vector_dir.mkdir(parents=True, exist_ok=True)

    def reset_project(self, project_id: str) -> None:
        backend = self._chroma_collection(project_id, create=False)
        if backend is not None:
            try:
                self._chroma_client().delete_collection(self._collection_name(project_id))
            except Exception:
                pass
        local_path = self._local_path(project_id)
        if local_path.exists():
            local_path.unlink()

    def upsert_chunks(self, project_id: str, chunks: list[dict[str, Any]]) -> int:
        if not chunks:
            return 0
        texts = [chunk["content"] for chunk in chunks]
        vectors = self.embeddings.embed(texts)
        collection = self._chroma_collection(project_id, create=True)
        if collection is not None:
            collection.upsert(
                ids=[chunk["id"] for chunk in chunks],
                documents=texts,
                metadatas=[self._metadata(chunk) for chunk in chunks],
                embeddings=vectors,
            )
        else:
            rows = [
                {"id": chunk["id"], "content": chunk["content"], "metadata": self._metadata(chunk), "embedding": vector}
                for chunk, vector in zip(chunks, vectors)
            ]
            self._local_path(project_id).write_text(json.dumps(rows), encoding="utf-8")
        return len(chunks)

    def query(self, project_id: str, query: str, top_k: int = 8, filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        filters = filters or {}
        query_vector = self.embeddings.embed([query])[0]
        collection = self._chroma_collection(project_id, create=False)
        if collection is not None:
            result = collection.query(
                query_embeddings=[query_vector],
                n_results=top_k,
                where=filters or None,
                include=["documents", "metadatas", "distances"],
            )
            return self._format_chroma_results(result)
        return self._query_local(project_id, query_vector, top_k, filters)

    def _query_local(self, project_id: str, query_vector: list[float], top_k: int, filters: dict[str, Any]) -> list[dict[str, Any]]:
        path = self._local_path(project_id)
        if not path.exists():
            return []
        rows = json.loads(path.read_text(encoding="utf-8"))
        scored = []
        for row in rows:
            metadata = row["metadata"]
            if any(metadata.get(key) != value for key, value in filters.items()):
                continue
            scored.append((cosine_similarity(query_vector, row["embedding"]), row))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [
            {
                "id": row["id"],
                "content": row["content"],
                "metadata": row["metadata"],
                "score": score,
            }
            for score, row in scored[:top_k]
        ]

    def _format_chroma_results(self, result: dict[str, Any]) -> list[dict[str, Any]]:
        items = []
        ids = result.get("ids", [[]])[0]
        docs = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        for item_id, doc, metadata, distance in zip(ids, docs, metadatas, distances):
            items.append({"id": item_id, "content": doc, "metadata": metadata, "score": 1.0 - float(distance)})
        return items

    def _metadata(self, chunk: dict[str, Any]) -> dict[str, Any]:
        return {
            "path": chunk["path"],
            "language": chunk["language"],
            "start_line": chunk["start_line"],
            "end_line": chunk["end_line"],
            "symbols": ",".join(chunk.get("symbols", [])),
        }

    def _local_path(self, project_id: str) -> Path:
        return self.settings.vector_dir / f"{project_id}.vectors.json"

    def _collection_name(self, project_id: str) -> str:
        return f"project_{project_id.replace('-', '_')}"

    def _chroma_client(self):
        import chromadb

        return chromadb.PersistentClient(path=str(self.settings.vector_dir / "chroma"))

    def _chroma_collection(self, project_id: str, create: bool):
        if self.settings.vector_backend != "chroma":
            return None
        try:
            client = self._chroma_client()
            name = self._collection_name(project_id)
            if create:
                return client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})
            return client.get_collection(name=name)
        except Exception:
            return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    numerator = sum(x * y for x, y in zip(a, b))
    left = math.sqrt(sum(x * x for x in a)) or 1.0
    right = math.sqrt(sum(y * y for y in b)) or 1.0
    return numerator / (left * right)

