"""Orchestrates one turn of conversation: classify intent, either call a tool
and phrase its result or fall back to Phase 5's retrieval-or-plain-chat path,
always through the same "build context, let the LLM phrase it" pattern.

Every tool-backed intent still goes through the LLM for the final reply, on
purpose — that's what lets the echo provider prove the tool wiring works
(same trick it plays with RAG context) even with no real model configured,
and it means one code path handles "phrase this data" whether the data came
from a document chunk or a live order lookup.
"""
from dataclasses import dataclass, field

from app.agents import router as router_module
from app.agents.router import is_frustrated, is_sensitive_payment_issue
from app.agents.sentiment import analyze_sentiment
from app.core.logging import get_logger
from app.rag.retriever import RetrievedChunk, retrieve
from app.tools import order_tools, product_tools, ticket_tools
from app.tools.base import ToolError

logger = get_logger(__name__)

BASE_INSTRUCTIONS = (
    "You are a customer-support assistant for an online electronics retailer. "
    "Be concise and friendly. Never invent order details, prices, ticket numbers, "
    "or delivery dates under any circumstances — those always come from a real "
    "lookup, provided to you below when relevant, not from you."
)

GROUNDED_INSTRUCTIONS = (
    "Answer the customer's question using ONLY the company documentation below. "
    "Cite it naturally in your answer (for example, \"according to our return policy...\"). "
    "If the documentation doesn't actually answer the question, say so honestly and "
    "offer to connect the customer with a human agent — do not fall back on outside "
    "knowledge or guess at specifics."
)

NO_MATCH_INSTRUCTIONS = (
    "No matching company documentation was found for this message. If the customer is "
    "asking something specific about policies, orders, refunds, or products, say you "
    "don't have that information on hand and offer to connect them with a human agent. "
    "Do not invent a policy, price, or timeframe. Ordinary conversation (greetings, "
    "thanks, small talk) doesn't need documentation — just respond naturally to those."
)

HANDOFF_INSTRUCTIONS = (
    "The customer has asked to speak with a human agent. Acknowledge this warmly and "
    "briefly, and let them know a human will join the conversation shortly. Do not try "
    "to solve their problem yourself in this reply."
)

TOOL_RESULT_INSTRUCTIONS = (
    "Use ONLY the structured data below to answer — it came from a real, live lookup. "
    "Phrase it naturally; do not just repeat the raw field names. Never add numbers, "
    "dates or details that are not present in the data below."
)

TOOL_NOT_FOUND_INSTRUCTIONS = (
    "The lookup below found nothing matching what the customer asked for. Say so "
    "honestly, double-check the number they gave if one was mentioned, and offer to "
    "connect them with a human agent if they believe this is a mistake. Do not invent "
    "a plausible-sounding answer instead."
)

TOOL_ERROR_INSTRUCTIONS = (
    "A live lookup that this reply needed just failed (the backend was unreachable or "
    "timed out). Apologise briefly, say the information could not be retrieved right "
    "now, and offer to connect the customer with a human agent. Do not guess at an "
    "answer in its place."
)

MISSING_ORDER_NUMBER_INSTRUCTIONS = (
    "The customer is asking about an order but did not give an order number, and no "
    "recent orders were found for their account either. Ask them for the order number "
    "in one short sentence. Do not guess or invent one."
)

SENSITIVE_PAYMENT_PREFIX = (
    "This message describes a possible duplicate or incorrect charge — a sensitive "
    "payment issue that always gets a human's attention, not just an automated answer. "
    "Acknowledge the concern seriously, share what the lookup below found, and let them "
    "know a human agent has been looped in and will follow up urgently. "
)

FRUSTRATION_PREFIX = (
    "This customer sounds frustrated. Acknowledge that plainly and sincerely — do not "
    "sound scripted or dismissive — before anything else in your reply. A human agent "
    "has also been looped in to make sure this gets resolved. "
)


@dataclass
class Source:
    document: str
    page: int | None = None


@dataclass
class AgentContext:
    """What support_agent hands to chat.py after deciding what to say and
    why — the system prompt to send the LLM, plus everything chat.py needs
    to fill in the rest of the response contract."""

    system_prompt: str
    intent: str
    used_rag: bool = False
    sources: list[Source] = field(default_factory=list)
    tool_used: str | None = None
    handoff_required: bool = False
    # Why, when handoff_required is True — lets Node write a SYSTEM message
    # and a ticket priority that actually matches the situation, instead of
    # every handoff looking identical to the agent who picks it up.
    # One of: explicit_request, no_confident_answer, sensitive_refund,
    # customer_frustration, tool_failure.
    handoff_reason: str | None = None
    sentiment: str = "NEUTRAL"


def _grounded_prompt(retrieved: list[RetrievedChunk]) -> tuple[str, list[Source]]:
    if not retrieved:
        return f"{BASE_INSTRUCTIONS}\n\n{NO_MATCH_INSTRUCTIONS}", []

    context_blocks = []
    sources = []
    for i, chunk in enumerate(retrieved, start=1):
        context_blocks.append(f"[Source {i}: {chunk.filename}]\n{chunk.text}")
        sources.append(Source(document=chunk.filename, page=chunk.page_number))

    context_text = "\n\n".join(context_blocks)
    return f"{BASE_INSTRUCTIONS}\n\n{GROUNDED_INSTRUCTIONS}\n\n{context_text}", sources


def _tool_result_prompt(tool_name: str, result: dict) -> str:
    if not result.get("found", True):
        return f"{BASE_INSTRUCTIONS}\n\n{TOOL_NOT_FOUND_INSTRUCTIONS}\n\nTool: {tool_name}\nResult: not found"
    return f"{BASE_INSTRUCTIONS}\n\n{TOOL_RESULT_INSTRUCTIONS}\n\nTool: {tool_name}\nData: {result}"


def _tool_error_prompt(tool_name: str, error: str) -> str:
    return f"{BASE_INSTRUCTIONS}\n\n{TOOL_ERROR_INSTRUCTIONS}\n\nTool: {tool_name}\nError: {error}"


async def _handle_order_status(route: router_module.RouterResult, customer_id: int | None) -> AgentContext:
    if route.order_number and customer_id:
        try:
            result = await order_tools.get_order_status(route.order_number, customer_id)
        except ToolError as exc:
            return AgentContext(
                system_prompt=_tool_error_prompt("get_order_status", exc.message),
                intent=route.intent,
                tool_used="get_order_status",
                handoff_required=not exc.retryable,
                handoff_reason="tool_failure" if not exc.retryable else None,
            )
        return AgentContext(
            system_prompt=_tool_result_prompt("get_order_status", result),
            intent=route.intent,
            tool_used="get_order_status",
        )

    # No order number given: show recent orders instead of just asking the
    # customer to repeat themselves, if we have an account to look them up on.
    if customer_id:
        try:
            result = await order_tools.get_customer_orders(customer_id)
        except ToolError as exc:
            return AgentContext(
                system_prompt=_tool_error_prompt("get_customer_orders", exc.message),
                intent=route.intent,
                tool_used="get_customer_orders",
            )
        if result.get("found"):
            return AgentContext(
                system_prompt=_tool_result_prompt("get_customer_orders", result),
                intent=route.intent,
                tool_used="get_customer_orders",
            )

    return AgentContext(
        system_prompt=f"{BASE_INSTRUCTIONS}\n\n{MISSING_ORDER_NUMBER_INSTRUCTIONS}", intent=route.intent
    )


async def _handle_refund_request(
    message: str, route: router_module.RouterResult, customer_id: int | None
) -> AgentContext:
    sensitive = is_sensitive_payment_issue(message)

    if not route.order_number or not customer_id:
        prompt = f"{BASE_INSTRUCTIONS}\n\n"
        if sensitive:
            prompt += (
                f"{SENSITIVE_PAYMENT_PREFIX}They have not given an order number yet — ask for it "
                "in one short sentence so the lookup and the human follow-up both have what they need."
            )
        else:
            prompt += "The customer is asking about a refund but did not give an order number. Ask them for it in one short sentence."
        return AgentContext(
            system_prompt=prompt,
            intent=route.intent,
            handoff_required=sensitive,
            handoff_reason="sensitive_refund" if sensitive else None,
        )

    try:
        result = await order_tools.get_refund_status(route.order_number, customer_id)
    except ToolError as exc:
        return AgentContext(
            system_prompt=_tool_error_prompt("get_refund_status", exc.message),
            intent=route.intent,
            tool_used="get_refund_status",
            handoff_required=not exc.retryable or sensitive,
            handoff_reason="sensitive_refund" if sensitive else ("tool_failure" if not exc.retryable else None),
        )

    prompt = _tool_result_prompt("get_refund_status", result)
    if sensitive:
        prompt = f"{BASE_INSTRUCTIONS}\n\n{SENSITIVE_PAYMENT_PREFIX}\n\nTool: get_refund_status\nData: {result}"

    return AgentContext(
        system_prompt=prompt,
        intent=route.intent,
        tool_used="get_refund_status",
        handoff_required=sensitive,
        handoff_reason="sensitive_refund" if sensitive else None,
    )


async def _handle_product_question(message: str, route: router_module.RouterResult) -> AgentContext:
    try:
        result = await product_tools.get_product_information(message)
    except ToolError as exc:
        return AgentContext(
            system_prompt=_tool_error_prompt("get_product_information", exc.message),
            intent=route.intent,
            tool_used="get_product_information",
        )
    if result.get("found"):
        return AgentContext(
            system_prompt=_tool_result_prompt("get_product_information", result),
            intent=route.intent,
            tool_used="get_product_information",
        )
    # No product matched by name — fall through to RAG rather than a flat
    # "not found", since the knowledge base's product category may cover it.
    return await _handle_knowledge_or_general(message, route)


async def _handle_ticket_request(
    message: str, route: router_module.RouterResult, customer_id: int | None, conversation_id: int | None
) -> AgentContext:
    if route.ticket_number:
        if not customer_id:
            return AgentContext(
                system_prompt=f"{BASE_INSTRUCTIONS}\n\nThe customer asked about a ticket but is not signed in.",
                intent=route.intent,
            )
        try:
            result = await ticket_tools.get_ticket_status(route.ticket_number, customer_id)
        except ToolError as exc:
            return AgentContext(
                system_prompt=_tool_error_prompt("get_ticket_status", exc.message),
                intent=route.intent,
                tool_used="get_ticket_status",
            )
        return AgentContext(
            system_prompt=_tool_result_prompt("get_ticket_status", result),
            intent=route.intent,
            tool_used="get_ticket_status",
        )

    if not customer_id:
        return AgentContext(
            system_prompt=f"{BASE_INSTRUCTIONS}\n\nThe customer wants to raise a ticket but is not signed in.",
            intent=route.intent,
        )

    try:
        result = await ticket_tools.create_support_ticket(
            customer_id=customer_id,
            subject=message[:180],
            description=message,
            category="general",
            conversation_id=conversation_id,
        )
    except ToolError as exc:
        return AgentContext(
            system_prompt=_tool_error_prompt("create_support_ticket", exc.message),
            intent=route.intent,
            tool_used="create_support_ticket",
        )
    return AgentContext(
        system_prompt=_tool_result_prompt("create_support_ticket", result),
        intent=route.intent,
        tool_used="create_support_ticket",
    )


async def _handle_knowledge_or_general(message: str, route: router_module.RouterResult) -> AgentContext:
    """Phase 5's original behaviour, unchanged: retrieve, ground if
    something relevant turned up, otherwise let the LLM handle ordinary
    conversation honestly. This is also where return_request lands — the
    knowledge base explains the return process; there's no tool for
    "start a return" because that's a self-service account action, not
    something a chat message should trigger on its own.

    Phase 7 addition: when the intent was specifically a knowledge_question
    (not idle chat) and nothing relevant was found, that's the AI genuinely
    not knowing the answer — escalate automatically rather than leaving the
    customer with only "I don't know." Ordinary conversation without a RAG
    match (a "hello" won't match any document) is not a failure and doesn't
    escalate; only a real, unanswered question does.
    """
    retrieved = retrieve(message)
    system_prompt, sources = _grounded_prompt(retrieved)
    no_confident_answer = route.intent == "knowledge_question" and not retrieved
    return AgentContext(
        system_prompt=system_prompt,
        intent=route.intent,
        used_rag=bool(retrieved),
        sources=sources,
        handoff_required=no_confident_answer,
        handoff_reason="no_confident_answer" if no_confident_answer else None,
    )


async def handle_message(
    message: str, customer_id: int | None = None, conversation_id: int | None = None
) -> AgentContext:
    route = router_module.classify(message)
    logger.info("Routed to intent=%s order=%s ticket=%s", route.intent, route.order_number, route.ticket_number)

    if route.intent == "human_handoff":
        context = AgentContext(
            system_prompt=f"{BASE_INSTRUCTIONS}\n\n{HANDOFF_INSTRUCTIONS}",
            intent=route.intent,
            handoff_required=True,
            handoff_reason="explicit_request",
        )
    elif route.intent == "order_status":
        context = await _handle_order_status(route, customer_id)
    elif route.intent == "refund_request":
        context = await _handle_refund_request(message, route, customer_id)
    elif route.intent == "product_question":
        context = await _handle_product_question(message, route)
    elif route.intent == "ticket_request":
        context = await _handle_ticket_request(message, route, customer_id, conversation_id)
    else:
        # return_request, knowledge_question, general_conversation
        context = await _handle_knowledge_or_general(message, route)

    # Frustration is orthogonal to intent — a customer can be upset while
    # asking about anything. Checked after the intent-specific handler runs
    # so the underlying question still gets answered (the bot doesn't just
    # give up on a frustrated customer), with a human looped in alongside
    # it. Never overwrites a reason the handler already set — sensitive_refund
    # or tool_failure are more specific than a general frustration signal.
    if is_frustrated(message) and not context.handoff_required:
        context.handoff_required = True
        context.handoff_reason = "customer_frustration"
        context.system_prompt = f"{FRUSTRATION_PREFIX}\n\n{context.system_prompt}"

    # Every path reaches here, including human_handoff — a customer typing
    # "get me a human, this is ridiculous" should log as NEGATIVE sentiment,
    # not the NEUTRAL default an early return would have left it at.
    context.sentiment = analyze_sentiment(message)
    return context
