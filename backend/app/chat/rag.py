import uuid
from collections.abc import AsyncIterator
from typing import Any

from app.core.config import Settings
from app.database import Database
from app.llm.ollama import LLMClient
from app.vectorstore.store import VectorStore


class RepositoryChatService:
    def __init__(self, settings: Settings, db: Database, vectors: VectorStore, llm: LLMClient) -> None:
        self.settings = settings
        self.db = db
        self.vectors = vectors
        self.llm = llm

    async def answer(self, project_id: str, message: str, top_k: int = 8) -> dict[str, Any]:
        retrieved = self.retrieve(project_id, message, top_k)
        prompt = self.build_prompt(project_id, message, retrieved)
        self.db.add_chat_message({"id": str(uuid.uuid4()), "project_id": project_id, "role": "user", "content": message})
        answer = await self.llm.generate(prompt)
        self.db.add_chat_message(
            {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "role": "assistant",
                "content": answer,
                "citations": citations_from_results(retrieved),
            }
        )
        return {"answer": answer, "citations": citations_from_results(retrieved)}

    async def stream_answer(self, project_id: str, message: str, top_k: int = 8) -> AsyncIterator[str]:
        retrieved = self.retrieve(project_id, message, top_k)
        prompt = self.build_prompt(project_id, message, retrieved)
        self.db.add_chat_message({"id": str(uuid.uuid4()), "project_id": project_id, "role": "user", "content": message})
        collected: list[str] = []
        async for token in self.llm.stream(prompt):
            collected.append(token)
            yield token
        self.db.add_chat_message(
            {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "role": "assistant",
                "content": "".join(collected),
                "citations": citations_from_results(retrieved),
            }
        )

    def retrieve(self, project_id: str, query: str, top_k: int) -> list[dict[str, Any]]:
        return self.vectors.query(project_id, query, top_k=top_k)

    def build_prompt(self, project_id: str, question: str, results: list[dict[str, Any]]) -> str:
        try:
            project = self.db.get_project(project_id)
        except KeyError:
            project = {"name": project_id, "scan_result": {}}

        context_blocks = []
        remaining = self.settings.llm_context_chars
        for index, result in enumerate(results, start=1):
            metadata = result["metadata"]
            header = f"[{index}] {metadata['path']}:{metadata['start_line']}-{metadata['end_line']}\n"
            body = result["content"]
            block = header + body
            if len(block) > remaining:
                block = block[:remaining]
            context_blocks.append(block)
            remaining -= len(block)
            if remaining <= 0:
                break

        if not context_blocks:
            context_blocks.append("No relevant indexed code chunks were found.")

        return f"""You are an AI senior software architect answering questions about a repository.

Repository: {project.get("name")}

Rules:
- Ground every claim in the provided repository context.
- Cite files and line ranges in plain text, for example `src/auth.ts:10-48`.
- If the context is insufficient, say exactly what evidence is missing.
- Do not invent files, functions, APIs, database tables, or behavior.
- Prefer concise step-by-step explanations.

Repository context:
{chr(10).join(context_blocks)}

Question:
{question}

Answer:
"""


def citations_from_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "path": result["metadata"]["path"],
            "start_line": result["metadata"]["start_line"],
            "end_line": result["metadata"]["end_line"],
            "score": result["score"],
        }
        for result in results
    ]

