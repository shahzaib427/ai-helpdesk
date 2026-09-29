"""
Centralized application configuration.
Reads values from environment variables / a .env file.
NEVER hardcode secrets here — this file only defines defaults and types.
"""
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- Database (used starting Phase 2) ---
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ai_business_automation"

    # --- Auth (used starting Phase 3) ---
    SECRET_KEY: str = "CHANGE_THIS_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # --- n8n integration (used starting Phase 5) ---
    N8N_WEBHOOK_URL: str = (
        "http://localhost:5678/webhook-test/90ab0395-6981-4903-a51a-711d71b710cf"
    )

    # --- Frontend / CORS ---
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [self.FRONTEND_URL]


settings = Settings()
