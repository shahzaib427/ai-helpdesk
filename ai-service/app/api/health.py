from fastapi import APIRouter

from app.core.config import get_settings
from app.llm.provider import get_llm_provider
from app.rag.store import get_vector_store

router = APIRouter(tags=["system"])


@router.get("/health", summary="Service and provider health")
async def health() -> dict:
    settings = get_settings()
    provider = get_llm_provider()
    store = get_vector_store()
    return {
        "success": True,
        "data": {
            "service": "ai-service",
            "environment": settings.app_env,
            "llm_provider": provider.name,
            "model": settings.model_name,
            "llm_reachable": await provider.health(),
            # Ingestion (Phase 4) can populate the store; chat doesn't read
            # from it yet, so rag_enabled stays false until Phase 5 wires
            # retrieval into the chat endpoint.
            "rag_enabled": False,
            "knowledge_base_chunks": store.count(),
        },
    }
