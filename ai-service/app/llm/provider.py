"""Provider factory. The only place that knows which concrete class to build."""
from app.core.config import get_settings
from app.core.errors import AIServiceError
from app.llm.base import LLMProvider
from app.llm.echo_provider import EchoProvider

_REGISTRY: dict[str, type[LLMProvider]] = {
    "echo": EchoProvider,
    # Phase 5 adds entries here, e.g.:
    # "ollama": OllamaProvider,
    # "groq": GroqProvider,
}

_instance: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    global _instance
    if _instance is not None:
        return _instance

    settings = get_settings()
    provider_cls = _REGISTRY.get(settings.llm_provider.lower())
    if provider_cls is None:
        available = ", ".join(_REGISTRY)
        raise AIServiceError(
            f"Unknown LLM_PROVIDER {settings.llm_provider!r}. Available: {available}",
            code="invalid_provider",
            status_code=500,
        )

    _instance = provider_cls(model_name=settings.model_name)
    return _instance


def reset_llm_provider() -> None:
    """Used by tests so settings changes take effect."""
    global _instance
    _instance = None
