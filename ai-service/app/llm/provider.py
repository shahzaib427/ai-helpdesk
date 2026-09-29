"""Provider factory. The only place that knows which concrete class to build."""
from app.core.config import get_settings
from app.core.errors import AIServiceError
from app.llm.base import LLMProvider
from app.llm.echo_provider import EchoProvider
from app.llm.openai_compatible_provider import OpenAICompatibleProvider

# Each entry is a factory, not just a class, because providers don't all need
# the same constructor arguments — echo only needs a model name, the real
# provider also needs a base URL, an optional key, and a timeout. A flat
# {name: class} map would force every provider to accept every setting
# whether it uses it or not.
_REGISTRY = {
    "echo": lambda settings: EchoProvider(model_name=settings.model_name),
    "openai_compatible": lambda settings: OpenAICompatibleProvider(
        model_name=settings.model_name,
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        timeout_seconds=settings.llm_timeout_seconds,
    ),
}

_instance: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    global _instance
    if _instance is not None:
        return _instance

    settings = get_settings()
    factory = _REGISTRY.get(settings.llm_provider.lower())
    if factory is None:
        available = ", ".join(_REGISTRY)
        raise AIServiceError(
            f"Unknown LLM_PROVIDER {settings.llm_provider!r}. Available: {available}",
            code="invalid_provider",
            status_code=500,
        )

    try:
        _instance = factory(settings)
    except ValueError as exc:
        # e.g. the openai_compatible provider requires LLM_BASE_URL, which
        # is a configuration mistake, not a server bug — same error shape as
        # everything else so the client gets consistent JSON either way.
        raise AIServiceError(str(exc), code="invalid_provider_config", status_code=500) from exc

    return _instance

def reset_llm_provider() -> None:
    """Used by tests so settings changes take effect."""
    global _instance
    _instance = None
