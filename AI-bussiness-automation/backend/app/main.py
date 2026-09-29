"""
AI Business Automation - FastAPI Backend
Phase 1: Project setup — health check only.
Later phases add database, auth, leads, automation, dashboard routers.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

app = FastAPI(
    title="AI Business Automation API",
    description="Backend API for the AI Business Automation Platform. "
    "Talks to PostgreSQL for storage and to an existing n8n workflow "
    "for AI automation (Groq + Gmail + PostgreSQL tools).",
    version="0.1.0",
)

# CORS - only allow the configured frontend origin(s), never "*" in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["health"])
async def health_check():
    """Simple liveness check used by the frontend and for manual testing."""
    return {
        "status": "ok",
        "service": "ai-business-automation-backend",
        "version": app.version,
    }


@app.get("/", tags=["health"])
async def root():
    return {"message": "AI Business Automation API is running. See /docs for Swagger UI."}
