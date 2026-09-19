"""Zero-dependency provider used until a real model is wired up in Phase 5.

It returns a deterministic, obviously-fake reply. That is on purpose: it keeps
Phase 1 runnable with no API key and no model download, and it makes it
impossible to mistake scaffold output for real answers.
"""
import time

from app.llm.base import ChatMessage, LLMProvider, LLMResponse


class EchoProvider(LLMProvider):
    name = "echo"

    def __init__(self, model_name: str = "echo-1"):
        self.model_name = model_name

    async def generate_response(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> LLMResponse:
        started = time.perf_counter()
        last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        text = (
            "[echo provider] No language model is configured yet, so I cannot answer "
            f"this for real. You asked: \"{last_user.strip()[:200]}\". "
            "Set LLM_PROVIDER in ai-service/.env once a provider is added in Phase 5."
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return LLMResponse(
            text=text,
            model=self.model_name,
            provider=self.name,
            latency_ms=latency_ms,
        )
