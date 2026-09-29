
"""A real LLM provider that speaks the OpenAI chat-completions wire format —
which is not just OpenAI's own API, but also what Groq, OpenRouter, and local
Ollama (as of its /v1 endpoint) all implement. One provider class covers
three genuinely free ways to run this project with real answers instead of
the echo placeholder:

  Groq       LLM_BASE_URL=https://api.groq.com/openai/v1   (free tier, needs a key, fast)
  OpenRouter LLM_BASE_URL=https://openrouter.ai/api/v1      (free-tier models available, needs a key)
  Ollama     LLM_BASE_URL=http://localhost:11434/v1         (fully local, no key, needs `ollama pull <model>` first)

Whichever one is configured, this class never sees the difference — it just
POSTs the standard shape and reads the standard shape back.
"""

import time

import httpx

from app.core.errors import LLMUnavailableError
from app.core.logging import get_logger
from app.llm.base import ChatMessage, LLMProvider, LLMResponse

logger = get_logger(__name__)


class OpenAICompatibleProvider(LLMProvider):
    name = "openai_compatible"

    def __init__(
        self,
        model_name: str,
        base_url: str = "",
        api_key: str = "",
        timeout_seconds: int = 60,
    ):
        if not base_url:
            raise ValueError(
                "LLM_BASE_URL is required for the openai_compatible provider. "
                "Point it at Groq, OpenRouter, a local Ollama instance, or any "
                "other OpenAI-compatible /chat/completions endpoint."
            )

        self.model_name = model_name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}

        # Ollama's local endpoint doesn't need a key; hosted providers do.
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        return headers

    async def generate_response(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> LLMResponse:
        started = time.perf_counter()

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": m.role, "content": m.content}
                for m in messages
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout_seconds
            ) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=self._headers(),
                )

        except httpx.TimeoutException as exc:
            raise LLMUnavailableError(
                f"{self.name} provider timed out after "
                f"{self.timeout_seconds}s"
            ) from exc

        except httpx.RequestError as exc:
            raise LLMUnavailableError(
                f"Could not reach {self.base_url}: {exc}"
            ) from exc

        if response.status_code != 200:
            detail = response.text[:300]

            print(
                f"### DEBUG: Groq response body: {detail!r} ###"
            )
            print(
                f"### DEBUG: Request URL was: "
                f"{self.base_url}/chat/completions ###"
            )
            print(
                f"### DEBUG: repr(base_url) = {self.base_url!r} ###"
            )

            raise LLMUnavailableError(
                f"{self.name} provider returned "
                f"{response.status_code}: {detail}"
            )

        body = response.json()

        try:
            text = body["choices"][0]["message"]["content"]
            finish_reason = body["choices"][0].get(
                "finish_reason",
                "stop",
            )

        except (KeyError, IndexError) as exc:
            raise LLMUnavailableError(
                f"Unexpected response shape from "
                f"{self.name} provider"
            ) from exc

        latency_ms = int(
            (time.perf_counter() - started) * 1000
        )

        return LLMResponse(
            text=text,
            model=body.get("model", self.model_name),
            provider=self.name,
            latency_ms=latency_ms,
            finish_reason=finish_reason,
            raw=body,
        )

    async def health(self) -> bool:
        # A cheap reachability check, not a full completion — this is what
        # GET /health calls, and it should be fast and not cost a token quota.
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=self._headers(),
                )

            return response.status_code < 500

        except httpx.RequestError:
            return False

