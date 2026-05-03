from functools import lru_cache

from app.chat.rag import RepositoryChatService
from app.core.config import get_settings
from app.database import Database
from app.embeddings.provider import EmbeddingProvider
from app.llm.ollama import LLMClient
from app.services.ingestion import IngestionService
from app.vectorstore.store import VectorStore


@lru_cache
def get_database() -> Database:
    settings = get_settings()
    db = Database(settings.sqlite_path)
    db.init()
    return db


@lru_cache
def get_embedding_provider() -> EmbeddingProvider:
    return EmbeddingProvider(get_settings())


@lru_cache
def get_vector_store() -> VectorStore:
    return VectorStore(get_settings(), get_embedding_provider())


@lru_cache
def get_llm_client() -> LLMClient:
    return LLMClient(get_settings())


@lru_cache
def get_ingestion_service() -> IngestionService:
    return IngestionService(get_settings(), get_database(), get_vector_store())


@lru_cache
def get_chat_service() -> RepositoryChatService:
    return RepositoryChatService(get_settings(), get_database(), get_vector_store(), get_llm_client())

