"""Tests for support_agent.py's orchestration: given an intent, does it call
the right tool, build the right kind of prompt, and set the right response
flags? Tools and retrieval are mocked here — this file is testing the
decision logic that sits between the router and the LLM, not the tools
themselves (covered in test_tools.py) or retrieval (test_retriever.py)."""
import pytest

from app.agents import support_agent
from app.tools.base import ToolError


class TestHumanHandoff:
    @pytest.mark.anyio
    async def test_sets_handoff_required_with_no_tool(self):
        context = await support_agent.handle_message("I want to talk to a human", customer_id=7)
        assert context.intent == "human_handoff"
        assert context.handoff_required is True
        assert context.tool_used is None


class TestOrderStatus:
    @pytest.mark.anyio
    async def test_calls_get_order_status_when_number_present(self, monkeypatch):
        async def fake_get_order_status(order_number, customer_id):
            assert order_number == "5012"
            assert customer_id == 7
            return {"found": True, "status": "SHIPPED", "order_number": "5012"}

        monkeypatch.setattr(support_agent.order_tools, "get_order_status", fake_get_order_status)

        context = await support_agent.handle_message("Where is order #5012?", customer_id=7)
        assert context.tool_used == "get_order_status"
        assert "SHIPPED" in context.system_prompt

    @pytest.mark.anyio
    async def test_falls_back_to_customer_orders_when_no_number(self, monkeypatch):
        async def fake_get_customer_orders(customer_id, limit=5):
            return {"found": True, "orders": [{"order_number": "5001", "status": "DELIVERED"}]}

        monkeypatch.setattr(support_agent.order_tools, "get_customer_orders", fake_get_customer_orders)

        context = await support_agent.handle_message("Where is my order?", customer_id=7)
        assert context.tool_used == "get_customer_orders"

    @pytest.mark.anyio
    async def test_asks_for_order_number_when_none_found_anywhere(self, monkeypatch):
        async def fake_get_customer_orders(customer_id, limit=5):
            return {"found": False, "orders": []}

        monkeypatch.setattr(support_agent.order_tools, "get_customer_orders", fake_get_customer_orders)

        context = await support_agent.handle_message("Where is my order?", customer_id=7)
        assert context.tool_used is None
        assert "order number" in context.system_prompt.lower()

    @pytest.mark.anyio
    async def test_no_customer_id_asks_for_order_number_directly(self):
        context = await support_agent.handle_message("Where is my order?", customer_id=None)
        assert context.tool_used is None

    @pytest.mark.anyio
    async def test_tool_error_produces_error_prompt_and_flags_handoff(self, monkeypatch):
        async def failing_get_order_status(order_number, customer_id):
            raise ToolError("backend down", retryable=False)

        monkeypatch.setattr(support_agent.order_tools, "get_order_status", failing_get_order_status)

        context = await support_agent.handle_message("Where is order #5012?", customer_id=7)
        assert context.tool_used == "get_order_status"
        assert context.handoff_required is True  # non-retryable failure escalates

    @pytest.mark.anyio
    async def test_retryable_tool_error_does_not_force_handoff(self, monkeypatch):
        async def failing_get_order_status(order_number, customer_id):
            raise ToolError("timeout", retryable=True)

        monkeypatch.setattr(support_agent.order_tools, "get_order_status", failing_get_order_status)

        context = await support_agent.handle_message("Where is order #5012?", customer_id=7)
        assert context.handoff_required is False


class TestRefundRequest:
    @pytest.mark.anyio
    async def test_calls_get_refund_status_with_order_number(self, monkeypatch):
        async def fake_refund_status(order_number, customer_id):
            assert order_number == "4021"
            return {"found": True, "is_refunded": False, "order_status": "SHIPPED"}

        monkeypatch.setattr(support_agent.order_tools, "get_refund_status", fake_refund_status)

        context = await support_agent.handle_message(
            "I was charged twice for order 4021, I want a refund", customer_id=7
        )
        assert context.tool_used == "get_refund_status"

    @pytest.mark.anyio
    async def test_asks_for_order_number_when_missing(self):
        context = await support_agent.handle_message("I want a refund", customer_id=7)
        assert context.tool_used is None
        assert "order number" in context.system_prompt.lower()


class TestProductQuestion:
    @pytest.mark.anyio
    async def test_calls_product_tool_and_uses_result_when_found(self, monkeypatch):
        async def fake_product_info(query, limit=5):
            return {"found": True, "products": [{"name": "Aria Headphones"}]}

        monkeypatch.setattr(support_agent.product_tools, "get_product_information", fake_product_info)

        context = await support_agent.handle_message("Tell me about the headphones", customer_id=7)
        assert context.tool_used == "get_product_information"

    @pytest.mark.anyio
    async def test_falls_through_to_rag_when_no_product_matches(self, monkeypatch):
        async def fake_product_info(query, limit=5):
            return {"found": False, "products": []}

        monkeypatch.setattr(support_agent.product_tools, "get_product_information", fake_product_info)
        monkeypatch.setattr(support_agent, "retrieve", lambda message: [])

        context = await support_agent.handle_message("Tell me about the headphones", customer_id=7)
        # Falls through to _handle_knowledge_or_general, which doesn't set tool_used
        assert context.tool_used is None


class TestTicketRequest:
    @pytest.mark.anyio
    async def test_creates_ticket_when_no_number_referenced(self, monkeypatch):
        async def fake_create(customer_id, subject, description, category="general", conversation_id=None):
            assert customer_id == 7
            return {"found": True, "ticket_id": 99, "status": "OPEN", "subject": subject}

        monkeypatch.setattr(support_agent.ticket_tools, "create_support_ticket", fake_create)

        context = await support_agent.handle_message("Please open a ticket, my item arrived broken", customer_id=7)
        assert context.tool_used == "create_support_ticket"

    @pytest.mark.anyio
    async def test_checks_status_when_ticket_number_referenced(self, monkeypatch):
        async def fake_status(ticket_id, customer_id):
            assert ticket_id == "42"
            return {"found": True, "status": "IN_PROGRESS"}

        monkeypatch.setattr(support_agent.ticket_tools, "get_ticket_status", fake_status)

        context = await support_agent.handle_message("What's the status of ticket #42?", customer_id=7)
        assert context.tool_used == "get_ticket_status"

    @pytest.mark.anyio
    async def test_no_customer_id_does_not_call_create(self):
        context = await support_agent.handle_message("Please open a ticket for me", customer_id=None)
        assert context.tool_used is None


class TestKnowledgeAndGeneral:
    @pytest.mark.anyio
    async def test_general_conversation_uses_rag_path(self, monkeypatch):
        monkeypatch.setattr(support_agent, "retrieve", lambda message: [])
        context = await support_agent.handle_message("hello there", customer_id=7)
        assert context.intent == "general_conversation"
        assert context.used_rag is False
        assert context.tool_used is None

    @pytest.mark.anyio
    async def test_return_request_falls_through_to_rag(self, monkeypatch):
        monkeypatch.setattr(support_agent, "retrieve", lambda message: [])
        context = await support_agent.handle_message("I'd like to return my headphones", customer_id=7)
        assert context.intent == "return_request"
        assert context.tool_used is None


class TestPhase7Escalation:
    @pytest.mark.anyio
    async def test_no_confident_answer_escalates_for_knowledge_question(self, monkeypatch):
        monkeypatch.setattr(support_agent, "retrieve", lambda message: [])
        context = await support_agent.handle_message("what is your international return policy for gift cards?", customer_id=7)
        assert context.intent == "knowledge_question"
        assert context.handoff_required is True
        assert context.handoff_reason == "no_confident_answer"

    @pytest.mark.anyio
    async def test_general_chitchat_with_no_rag_match_does_not_escalate(self, monkeypatch):
        monkeypatch.setattr(support_agent, "retrieve", lambda message: [])
        context = await support_agent.handle_message("hello!", customer_id=7)
        assert context.intent == "general_conversation"
        assert context.handoff_required is False
        assert context.handoff_reason is None

    @pytest.mark.anyio
    async def test_sensitive_refund_escalates_even_with_a_successful_lookup(self, monkeypatch):
        async def fake_refund_status(order_number, customer_id):
            return {"found": True, "is_refunded": False, "order_status": "SHIPPED"}

        monkeypatch.setattr(support_agent.order_tools, "get_refund_status", fake_refund_status)

        context = await support_agent.handle_message(
            "I was charged twice for order 4021, please help", customer_id=7
        )
        assert context.handoff_required is True
        assert context.handoff_reason == "sensitive_refund"
        assert context.tool_used == "get_refund_status"  # the AI still helps, in addition to escalating

    @pytest.mark.anyio
    async def test_plain_refund_request_does_not_auto_escalate(self, monkeypatch):
        async def fake_refund_status(order_number, customer_id):
            return {"found": True, "is_refunded": False, "order_status": "SHIPPED"}

        monkeypatch.setattr(support_agent.order_tools, "get_refund_status", fake_refund_status)

        context = await support_agent.handle_message("can I get a refund for order 4021", customer_id=7)
        assert context.handoff_required is False
        assert context.handoff_reason is None

    @pytest.mark.anyio
    async def test_frustration_escalates_while_still_answering_the_question(self, monkeypatch):
        async def fake_order_status(order_number, customer_id):
            return {"found": True, "status": "SHIPPED", "order_number": "5012"}

        monkeypatch.setattr(support_agent.order_tools, "get_order_status", fake_order_status)

        context = await support_agent.handle_message(
            "this is ridiculous, where is order #5012", customer_id=7
        )
        assert context.handoff_required is True
        assert context.handoff_reason == "customer_frustration"
        assert context.tool_used == "get_order_status"  # still answered the actual question

    @pytest.mark.anyio
    async def test_frustration_does_not_override_a_more_specific_reason(self, monkeypatch):
        async def fake_refund_status(order_number, customer_id):
            return {"found": True, "is_refunded": False, "order_status": "SHIPPED"}

        monkeypatch.setattr(support_agent.order_tools, "get_refund_status", fake_refund_status)

        context = await support_agent.handle_message(
            "this is ridiculous, I was charged twice for order 4021", customer_id=7
        )
        assert context.handoff_required is True
        # sensitive_refund is more specific than customer_frustration and
        # should win, not get silently overwritten
        assert context.handoff_reason == "sensitive_refund"

    @pytest.mark.anyio
    async def test_explicit_handoff_reason_is_set(self):
        context = await support_agent.handle_message("let me talk to a human please", customer_id=7)
        assert context.handoff_reason == "explicit_request"

    @pytest.mark.anyio
    async def test_non_retryable_tool_failure_reason_is_set(self, monkeypatch):
        async def failing_get_order_status(order_number, customer_id):
            raise ToolError("backend down", retryable=False)

        monkeypatch.setattr(support_agent.order_tools, "get_order_status", failing_get_order_status)
        context = await support_agent.handle_message("Where is order #5012?", customer_id=7)
        assert context.handoff_reason == "tool_failure"


class TestPhase8Sentiment:
    @pytest.mark.anyio
    async def test_sentiment_is_set_for_ordinary_messages(self, monkeypatch):
        monkeypatch.setattr(support_agent, "retrieve", lambda message: [])
        context = await support_agent.handle_message("thanks, that helped a lot", customer_id=7)
        assert context.sentiment == "POSITIVE"

    @pytest.mark.anyio
    async def test_sentiment_is_set_even_on_the_human_handoff_early_return(self):
        # Regression test: human_handoff used to return early, before the
        # sentiment computation at the bottom of handle_message ever ran,
        # silently leaving it at the NEUTRAL default no matter how the
        # message was actually phrased.
        context = await support_agent.handle_message(
            "this is ridiculous, get me a real person", customer_id=7
        )
        assert context.intent == "human_handoff"
        assert context.sentiment == "NEGATIVE"

    @pytest.mark.anyio
    async def test_neutral_order_question_has_neutral_sentiment(self, monkeypatch):
        async def fake_get_order_status(order_number, customer_id):
            return {"found": True, "status": "SHIPPED", "order_number": "5012"}

        monkeypatch.setattr(support_agent.order_tools, "get_order_status", fake_get_order_status)
        context = await support_agent.handle_message("Where is order #5012?", customer_id=7)
        assert context.sentiment == "NEUTRAL"
