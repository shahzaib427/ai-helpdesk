"""Chat endpoint.

Phase 6 delegates the actual thinking to support_agent.py: classify intent,
call a tool if one applies, or fall back to Phase 5's retrieval-or-plain-chat
path. This file's job shrinks to what it was always meant to be — validate
the request, call the agent, call the LLM with whatever prompt the agent
built, validate the response, and shape it into the contract the Node
backend expects. Nothing about that contract changed since Phase 1: the same
fields (`intent`, `used_rag`, `tool_used`, `handoff_required`, `sources`)
just have real values now instead of defaults.
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.agents.support_agent import handle_message
from app.core.errors import AIServiceError, LLMUnavailableError
from app.core.logging import get_logger
from app.llm.base import ChatMessage
from app.llm.provider import get_llm_provider

router = APIRouter(prefix="/chat", tags=["chat"])
logger = get_logger(__name__)


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
    handoff_reason: str | None = None
    sentiment: str = "NEUTRAL"
    sources: list[Source] = Field(default_factory=list)
    provider: str
    model: str
    latency_ms: int


@router.post("", response_model=ChatResponse, summary="Send a message to the AI agent")
async def chat(payload: ChatRequest) -> ChatResponse:
    provider = get_llm_provider()

    agent_context = await handle_message(
        payload.message, customer_id=payload.customer_id, conversation_id=payload.conversation_id
    )

    messages = [ChatMessage(role="system", content=agent_context.system_prompt)]
    messages += [ChatMessage(role=h.role, content=h.content) for h in payload.history]
    messages.append(ChatMessage(role="user", content=payload.message))

    try:
        result = await provider.generate_response(messages)
    except AIServiceError:
        raise
    except Exception as exc:  # provider crashed, network died, model missing
        logger.error("LLM call failed: %s", exc)
        raise LLMUnavailableError() from exc

    # Response validation: a provider returning an empty string is a failure
    # mode, not a valid answer, even though it isn't an exception.
    reply_text = result.text.strip()
    if not reply_text:
        logger.error("Provider %s returned an empty reply", result.provider)
        raise LLMUnavailableError("The language model returned an empty response.")

    return ChatResponse(
        reply=reply_text,
        intent=agent_context.intent,
        used_rag=agent_context.used_rag,
        tool_used=agent_context.tool_used,
        handoff_required=agent_context.handoff_required,
        handoff_reason=agent_context.handoff_reason,
        sentiment=agent_context.sentiment,
        sources=[Source(document=s.document, page=s.page) for s in agent_context.sources],
        provider=result.provider,
        model=result.model,
        latency_ms=result.latency_ms,
    )
