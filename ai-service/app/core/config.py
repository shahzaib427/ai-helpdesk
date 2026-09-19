"""Typed settings loaded from .env. Nothing in the app reads os.environ directly."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    port: int = 5001
    cors_origin: str = "http://localhost:5173"

    # LLM
    llm_provider: str = "echo"
    llm_api_key: str = ""
    llm_base_url: str = ""
    model_name: str = "echo-1"
    llm_timeout_seconds: int = 60

    # RAG
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    vector_store_path: str = "./data/vector_store"
    documents_path: str = "./data/documents"
    chunk_size: int = 800
    chunk_overlap: int = 120
    top_k: int = 4
    relevance_threshold: float = 0.35

    backend_url: str = "http://localhost:5000"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origin.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
