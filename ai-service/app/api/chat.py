"""Chat endpoint.

Phase 1 wires the plumbing only: request/response contracts, provider call and
error handling. Retrieval (Phase 5), routing (Phase 6) and handoff (Phase 7)
slot in behind this same contract so the Node backend never has to change.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.errors import AIServiceError, LLMUnavailableError
from app.core.logging import get_logger
from app.llm.base import ChatMessage
from app.llm.provider import get_llm_provider

router = APIRouter(prefix="/chat", tags=["chat"])
logger = get_logger(__name__)

SYSTEM_PROMPT = (
    "You are a customer-support assistant for an online electronics retailer. "
    "Answer only from information you have been given. If you do not know, say so "
    "plainly and offer to connect the customer with a human agent. Never invent "
    "policies, prices, order details or delivery dates."
)


class HistoryItem(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: int | None = None
    customer_id: int | None = None
    history: list[HistoryItem] = Field(default_factory=list, max_length=20)


class Source(BaseModel):
    document: str
    page: int | None = None
    chunk_id: int | None = None


class ChatResponse(BaseModel):
    reply: str
    intent: str = "general_conversation"
    used_rag: bool = False
    tool_used: str | None = None
    handoff_required: bool = False
    sources: list[Source] = Field(default_factory=list)
    provider: str
    model: str
    latency_ms: int


@router.post("", response_model=ChatResponse, summary="Send a message to the AI agent")
async def chat(payload: ChatRequest) -> ChatResponse:
    provider = get_llm_provider()

    messages = [ChatMessage(role="system", content=SYSTEM_PROMPT)]
    messages += [ChatMessage(role=h.role, content=h.content) for h in payload.history]
    messages.append(ChatMessage(role="user", content=payload.message))

    try:
        result = await provider.generate_response(messages)
    except AIServiceError:
        raise
    except Exception as exc:  # provider crashed, network died, model missing
        logger.error("LLM call failed: %s", exc)
        raise LLMUnavailableError() from exc

    return ChatResponse(
        reply=result.text,
        provider=result.provider,
        model=result.model,
        latency_ms=result.latency_ms,
    )
