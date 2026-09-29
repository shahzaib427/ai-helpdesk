"""Classifies a message into one of the categories the original spec lists,
plus whatever entity (an order number, a ticket number) the message contains.

Deliberately rule-based, not an LLM call. Three reasons: it's free (no extra
API round-trip just to decide what to do), it's fully deterministic and
testable (the same message always classifies the same way — an LLM-based
classifier would need its own test-flakiness handling, the kind Phase 5's
retrieval tests needed for embedding similarity), and it works identically
whether LLM_PROVIDER is "echo" or a real model, so the router's behaviour
never depends on which one happens to be configured.

Order of checks matters — human_handoff is checked first because "I want a
refund, actually just get me a person" should escalate, not get parsed as a
refund_request.
"""
import re
from dataclasses import dataclass

from app.tools.order_tools import extract_order_number
from app.tools.ticket_tools import extract_ticket_number

INTENTS = (
    "human_handoff",
    "order_status",
    "refund_request",
    "return_request",
    "ticket_request",
    "product_question",
    "knowledge_question",
    "general_conversation",
)


@dataclass
class RouterResult:
    intent: str
    order_number: str | None = None
    ticket_number: str | None = None


_HANDOFF_PATTERNS = re.compile(
    r"\b(talk to|speak (to|with)|connect me (to|with)|human|real person|"
    r"a person|an agent|representative|someone)\b",
    re.IGNORECASE,
)
_REFUND_PATTERNS = re.compile(
    r"\b(refund|money back|charged twice|double charged|duplicate charge)\b", re.IGNORECASE
)
_RETURN_PATTERNS = re.compile(r"\b(return|send back|exchange)\b", re.IGNORECASE)
_ORDER_PATTERNS = re.compile(
    r"\b(order|shipped|shipping|delivery|deliver|tracking|track|package|parcel)\b", re.IGNORECASE
)
_TICKET_PATTERNS = re.compile(r"\b(ticket|open a case|log an issue|file a complaint)\b", re.IGNORECASE)
_PRODUCT_PATTERNS = re.compile(
    r"\b(headphones?|earbuds?|speakers?|watch(es)?|bands?|lamps?|thermostats?|"
    r"purifiers?|sensors?|power ?banks?|hubs?|sleeves?|backpacks?|keyboards?|"
    r"mice|mouse|monitors?|webcams?|stands?|"
    r"product|specs?|compatible|warranty on)\b",
    re.IGNORECASE,
)
_KNOWLEDGE_PATTERNS = re.compile(
    r"\b(policy|policies|hours|contact|faq|how (long|do i|does)|when (will|does)|"
    r"what is your|do you)\b",
    re.IGNORECASE,
)

# A narrower signal than _REFUND_PATTERNS: specifically a payment error, not
# just "I'd like my money back." The return policy explicitly treats
# duplicate charges as urgent and handled within one working day — this is
# what lets support_agent.py match that same urgency automatically rather
# than every refund question getting flagged the same way.
_SENSITIVE_PAYMENT_PATTERNS = re.compile(
    r"\b(charged twice|double charged|duplicate charge|charged (me )?two ?times|"
    r"wrong amount charged|overcharged)\b",
    re.IGNORECASE,
)

# Deliberately lightweight — a keyword list, not a sentiment model. Full
# sentiment analysis is explicitly Phase 8 scope (AI analytics); this is
# only precise enough to catch a customer who is clearly upset, not to
# score how upset on a scale. False negatives (missing genuine frustration
# phrased unusually) are an accepted cost of keeping this simple and free.
_FRUSTRATION_PATTERNS = re.compile(
    r"\b(ridiculous|unacceptable|terrible service|awful|worst (service|experience)|"
    r"fed up|sick of this|done with this|so (frustrated|annoyed)|still (not|isn'?t) (working|fixed)|"
    r"this is (broken|useless)|no ?one (is )?(helping|responding)|waste of (my )?time)\b",
    re.IGNORECASE,
)


def is_sensitive_payment_issue(text: str) -> bool:
    return bool(_SENSITIVE_PAYMENT_PATTERNS.search(text))


def is_frustrated(text: str) -> bool:
    return bool(_FRUSTRATION_PATTERNS.search(text))


def classify(message: str) -> RouterResult:
    text = message.strip()

    if _HANDOFF_PATTERNS.search(text):
        return RouterResult(intent="human_handoff")

    # Checked early and specifically: "what is your return policy" and "I
    # want to return this" share the word "return" but are different
    # intents. A message phrased as an explicit policy/informational
    # question wins that ambiguity before the action-keyword checks below
    # ever see it — both intents fall through to the same RAG-backed
    # handler in support_agent.py regardless, but getting the label right
    # still matters for the analytics Phase 8 builds on top of it.
    if _KNOWLEDGE_PATTERNS.search(text):
        return RouterResult(intent="knowledge_question")

    ticket_number = extract_ticket_number(text)
    if ticket_number or _TICKET_PATTERNS.search(text):
        return RouterResult(intent="ticket_request", ticket_number=ticket_number)

    if _REFUND_PATTERNS.search(text):
        return RouterResult(intent="refund_request", order_number=extract_order_number(text))

    if _RETURN_PATTERNS.search(text):
        return RouterResult(intent="return_request", order_number=extract_order_number(text))

    if _ORDER_PATTERNS.search(text):
        return RouterResult(intent="order_status", order_number=extract_order_number(text))

    if _PRODUCT_PATTERNS.search(text):
        return RouterResult(intent="product_question")

    return RouterResult(intent="general_conversation")
