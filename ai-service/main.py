"""AI service entry point.

Run locally:
    uvicorn main:app --reload --port 5001

Swagger UI: http://localhost:5001/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, health, ingestion
from app.core.config import get_settings
from app.core.errors import AIServiceError, ai_service_error_handler
from app.core.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI service ready - provider=%s model=%s", settings.llm_provider, settings.model_name)
    yield


app = FastAPI(
    title="Helpdesk AI Service",
    description="RAG, routing, tools and conversation analysis for the AI helpdesk platform.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AIServiceError, ai_service_error_handler)

app.include_router(health.router)
app.include_router(chat.router)
app.include_router(ingestion.router)
# Phase 5/8 mount points:
# app.include_router(rag.router)
# app.include_router(analysis.router)
