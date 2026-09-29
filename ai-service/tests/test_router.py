"""Tests for the rule-based router. Pure functions — no store, no LLM, no
network — so these run instantly and are the cheapest possible tests to keep
green."""
from app.agents.router import classify
from app.tools.order_tools import extract_order_number
from app.tools.ticket_tools import extract_ticket_number


class TestClassify:
    def test_human_handoff(self):
        assert classify("I want to talk to a human").intent == "human_handoff"
        assert classify("can I speak with a representative?").intent == "human_handoff"
        assert classify("connect me with an agent please").intent == "human_handoff"

    def test_handoff_takes_priority_over_refund(self):
        # "refund" would otherwise match refund_request, but the explicit
        # request for a person should win.
        result = classify("I want a refund, actually just get me a real person")
        assert result.intent == "human_handoff"

    def test_order_status_with_number(self):
        result = classify("Where is order #5012?")
        assert result.intent == "order_status"
        assert result.order_number == "5012"

    def test_order_status_without_number(self):
        result = classify("Where is my order?")
        assert result.intent == "order_status"
        assert result.order_number is None

    def test_tracking_keyword_counts_as_order_status(self):
        assert classify("Can you track my package?").intent == "order_status"

    def test_bare_number_alone_is_not_order_status(self):
        # A number with no order-related keyword nearby should not be
        # misclassified — e.g. a zip code or phone number fragment.
        result = classify("My favorite number is 12345")
        assert result.intent == "general_conversation"

    def test_refund_request(self):
        result = classify("I was charged twice for order 4021, I want a refund")
        assert result.intent == "refund_request"
        assert result.order_number == "4021"

    def test_duplicate_charge_phrasing_is_refund(self):
        assert classify("I think I was double charged").intent == "refund_request"

    def test_return_request(self):
        result = classify("I'd like to return my headphones")
        assert result.intent == "return_request"

    def test_ticket_request_create(self):
        result = classify("Can you open a ticket for this issue?")
        assert result.intent == "ticket_request"
        assert result.ticket_number is None

    def test_ticket_request_with_number(self):
        result = classify("What's the status of ticket #42?")
        assert result.intent == "ticket_request"
        assert result.ticket_number == "42"

    def test_product_question(self):
        assert classify("Does the Aria headphones work with Android?").intent == "product_question"
        assert classify("What's the warranty on the speaker?").intent == "product_question"

    def test_knowledge_question(self):
        assert classify("What is your return policy?").intent == "knowledge_question"
        assert classify("What are your support hours?").intent == "knowledge_question"

    def test_general_conversation_fallback(self):
        assert classify("hello").intent == "general_conversation"
        assert classify("thanks so much!").intent == "general_conversation"

    def test_empty_and_whitespace(self):
        assert classify("").intent == "general_conversation"
        assert classify("   ").intent == "general_conversation"


class TestExtractOrderNumber:
    def test_extracts_with_hash(self):
        assert extract_order_number("order #5012") == "5012"

    def test_extracts_without_hash(self):
        assert extract_order_number("order 5012 please") == "5012"

    def test_returns_none_when_absent(self):
        assert extract_order_number("where is my order") is None

    def test_ignores_short_numbers(self):
        # Fewer than 4 digits shouldn't match - too likely to be noise
        # (a quantity, a partial phone number, etc.)
        assert extract_order_number("I ordered 3 of them") is None


class TestExtractTicketNumber:
    def test_extracts_with_hash(self):
        assert extract_ticket_number("ticket #42") == "42"

    def test_extracts_without_hash(self):
        assert extract_ticket_number("ticket 42") == "42"

    def test_case_insensitive(self):
        assert extract_ticket_number("TICKET #7") == "7"

    def test_returns_none_when_absent(self):
        assert extract_ticket_number("can you open a ticket for me") is None


class TestIsSensitivePaymentIssue:
    def test_duplicate_charge(self):
        from app.agents.router import is_sensitive_payment_issue

        assert is_sensitive_payment_issue("I was charged twice for order 4021") is True
        assert is_sensitive_payment_issue("I think I was double charged") is True
        assert is_sensitive_payment_issue("looks like a duplicate charge on my card") is True

    def test_plain_refund_is_not_sensitive(self):
        from app.agents.router import is_sensitive_payment_issue

        assert is_sensitive_payment_issue("I'd like a refund please") is False
        assert is_sensitive_payment_issue("can I get my money back") is False


class TestIsFrustrated:
    def test_detects_clear_frustration(self):
        from app.agents.router import is_frustrated

        assert is_frustrated("this is ridiculous, no one is helping me") is True
        assert is_frustrated("I'm so frustrated with this service") is True
        assert is_frustrated("still not working after three days") is True

    def test_neutral_message_is_not_frustrated(self):
        from app.agents.router import is_frustrated

        assert is_frustrated("hi, quick question about my order") is False
        assert is_frustrated("thanks for your help") is False
