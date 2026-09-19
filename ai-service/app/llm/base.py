"""The one interface the rest of the AI service is allowed to depend on.

RAG, the router, the agent and the tools all call `generate_response()`.
Swapping providers is then a .env change, not a refactor.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMResponse:
    text: str
    model: str
    provider: str
    latency_ms: int
    finish_reason: str = "stop"
    raw: dict = field(default_factory=dict)


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def generate_response(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.2,
        max_tokens: int = 800,
    ) -> LLMResponse:
        """Return a completion for the given conversation."""

    async def health(self) -> bool:
        """Cheap availability check used by /health."""
        return True
