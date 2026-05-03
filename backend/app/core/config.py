from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Codebase Explainer"
    environment: Literal["local", "development", "production"] = "local"
    log_level: str = "INFO"
    api_prefix: str = "/api"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    data_dir: Path = Path("data")
    project_dir: Path = Path("data/projects")
    upload_dir: Path = Path("data/uploads")
    vector_dir: Path = Path("data/vectors")
    sqlite_path: Path = Path("data/codebase_explainer.db")

    max_file_size_bytes: int = 750_000
    max_zip_size_bytes: int = 350_000_000
    max_index_files: int = 25_000
    chunk_target_lines: int = 120
    chunk_overlap_lines: int = 16

    embedding_provider: Literal["sentence-transformers", "hash"] = "sentence-transformers"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    vector_backend: Literal["chroma", "local"] = "chroma"

    llm_provider: Literal["ollama", "llamacpp", "mock"] = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5-coder:7b"
    llama_cpp_base_url: str = "http://localhost:8080"
    llm_temperature: float = 0.15
    llm_context_chars: int = 24_000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_prefix="ACE_",
    )

    def ensure_dirs(self) -> None:
        for directory in [self.data_dir, self.project_dir, self.upload_dir, self.vector_dir]:
            directory.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_dirs()
    return settings
