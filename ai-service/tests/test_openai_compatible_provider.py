"""Tests for OpenAICompatibleProvider's HTTP handling, using httpx's
MockTransport so the real request-building and response-parsing code runs,
without making an actual network call to Groq/OpenRouter/Ollama."""
import httpx
import pytest

from app.core.errors import LLMUnavailableError
from app.llm.base import ChatMessage
from app.llm.openai_compatible_provider import OpenAICompatibleProvider


def make_provider(handler, api_key="fake-key"):
    """Builds a provider whose internal httpx.AsyncClient is wired to a
    MockTransport, so generate_response() exercises the real request/response
    code path against a handler we control."""
    provider = OpenAICompatibleProvider(
        model_name="test-model", base_url="https://fake-provider.test/v1", api_key=api_key
    )

    class PatchedClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(*args, **kwargs)

    import app.llm.openai_compatible_provider as module

    original = module.httpx.AsyncClient
    module.httpx.AsyncClient = PatchedClient
    return provider, module, original


@pytest.mark.anyio
async def test_missing_base_url_raises_on_construction():
    with pytest.raises(ValueError):
        OpenAICompatibleProvider(model_name="x")


@pytest.mark.anyio
async def test_parses_a_successful_completion():
    def handler(request):
        assert request.headers["authorization"] == "Bearer fake-key"
        return httpx.Response(
            200,
            json={
                "model": "test-model",
                "choices": [{"message": {"content": "Hello from the fake provider."}, "finish_reason": "stop"}],
            },
        )

    provider, module, original = make_provider(handler)
    try:
        result = await provider.generate_response([ChatMessage(role="user", content="hi")])
        assert result.text == "Hello from the fake provider."
        assert result.provider == "openai_compatible"
        assert result.finish_reason == "stop"
        assert result.latency_ms >= 0
    finally:
        module.httpx.AsyncClient = original


@pytest.mark.anyio
async def test_omits_authorization_header_with_no_api_key():
    seen_headers = {}

    def handler(request):
        seen_headers.update(request.headers)
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    provider, module, original = make_provider(handler, api_key="")
    try:
        await provider.generate_response([ChatMessage(role="user", content="hi")])
        assert "authorization" not in seen_headers
    finally:
        module.httpx.AsyncClient = original


@pytest.mark.anyio
async def test_non_200_response_raises_llm_unavailable_with_provider_detail():
    def handler(request):
        return httpx.Response(401, text="Invalid API key")

    provider, module, original = make_provider(handler)
    try:
        with pytest.raises(LLMUnavailableError) as exc_info:
            await provider.generate_response([ChatMessage(role="user", content="hi")])
        assert "401" in str(exc_info.value)
        assert "Invalid API key" in str(exc_info.value)
    finally:
        module.httpx.AsyncClient = original


@pytest.mark.anyio
async def test_malformed_response_shape_raises_llm_unavailable():
    def handler(request):
        # Missing "choices" entirely - a provider returning an unexpected shape
        return httpx.Response(200, json={"unexpected": "shape"})

    provider, module, original = make_provider(handler)
    try:
        with pytest.raises(LLMUnavailableError):
            await provider.generate_response([ChatMessage(role="user", content="hi")])
    finally:
        module.httpx.AsyncClient = original


@pytest.mark.anyio
async def test_network_error_raises_llm_unavailable():
    def handler(request):
        raise httpx.ConnectError("Connection refused")

    provider, module, original = make_provider(handler)
    try:
        with pytest.raises(LLMUnavailableError):
            await provider.generate_response([ChatMessage(role="user", content="hi")])
    finally:
        module.httpx.AsyncClient = original


@pytest.mark.anyio
async def test_health_check_returns_false_on_unreachable_host():
    def handler(request):
        raise httpx.ConnectError("Connection refused")

    provider, module, original = make_provider(handler)
    try:
        assert await provider.health() is False
    finally:
        module.httpx.AsyncClient = original


@pytest.mark.anyio
async def test_health_check_returns_true_when_reachable():
    def handler(request):
        return httpx.Response(200, json={"data": []})

    provider, module, original = make_provider(handler)
    try:
        assert await provider.health() is True
    finally:
        module.httpx.AsyncClient = original
