from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import Settings


class LLMClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def generate(self, prompt: str) -> str:
        if self.settings.llm_provider == "mock":
            return "Mock mode: connect Ollama and select a local coder model to generate full responses."
        if self.settings.llm_provider == "llamacpp":
            return await self._generate_llamacpp(prompt)
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(
                f"{self.settings.ollama_base_url}/api/generate",
                json={
                    "model": self.settings.ollama_model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": self.settings.llm_temperature},
                },
            )
            response.raise_for_status()
            payload: dict[str, Any] = response.json()
            return payload.get("response", "")

    async def stream(self, prompt: str) -> AsyncIterator[str]:
        if self.settings.llm_provider == "mock":
            yield "Mock mode: connect Ollama and select a local coder model to stream responses."
            return
        if self.settings.llm_provider == "llamacpp":
            yield await self._generate_llamacpp(prompt)
            return
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{self.settings.ollama_base_url}/api/generate",
                json={
                    "model": self.settings.ollama_model,
                    "prompt": prompt,
                    "stream": True,
                    "options": {"temperature": self.settings.llm_temperature},
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        import json

                        payload = json.loads(line)
                    except ValueError:
                        continue
                    token = payload.get("response")
                    if token:
                        yield token

    async def _generate_llamacpp(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(
                f"{self.settings.llama_cpp_base_url}/completion",
                json={
                    "prompt": prompt,
                    "temperature": self.settings.llm_temperature,
                    "n_predict": 2048,
                    "stream": False,
                },
            )
            response.raise_for_status()
            payload: dict[str, Any] = response.json()
            return payload.get("content", payload.get("response", ""))
