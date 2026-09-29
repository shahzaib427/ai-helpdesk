"""End-to-end tests for POST /chat exercising tool calling through the real
FastAPI app. The Node backend's internal API is mocked via httpx.MockTransport
on the tools' shared client — everything above that (routing, the agent,
chat.py, the echo provider) is real, unmocked code."""
import httpx
import pytest

fastapi_testclient = pytest.importorskip("fastapi.testclient", reason="fastapi not installed")


@pytest.fixture(autouse=True)
def reset_llm_provider():
    from app.llm.provider import reset_llm_provider as _reset

    _reset()
    yield
    _reset()


@pytest.fixture(autouse=True)
def force_echo_provider(monkeypatch):
    from app.core.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    monkeypatch.setattr(settings, "llm_provider", "echo")
    monkeypatch.setattr(settings, "internal_api_key", "test-key")
    monkeypatch.setattr(settings, "backend_url", "https://fake-backend.test")
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def isolated_vector_store(tmp_vector_store_path, monkeypatch):
    from app.core.config import get_settings
    from app.rag import store as store_module

    settings = get_settings()
    monkeypatch.setattr(settings, "vector_store_path", tmp_vector_store_path)
    store_module._store = None
    yield
    store_module._store = None


def mock_backend(handler, monkeypatch):
    class PatchedClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(*args, **kwargs)

    import app.tools.base as base_module

    monkeypatch.setattr(base_module.httpx, "AsyncClient", PatchedClient)


@pytest.fixture
def client():
    from main import app

    return fastapi_testclient.TestClient(app)


class TestOrderStatusToolCalling:
    def test_order_question_calls_tool_and_returns_tool_used(self, client, monkeypatch):
        def handler(request):
            assert "orders/by-number/5012" in str(request.url)
            assert request.url.params["customerId"] == "7"
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "order": {
                            "orderNumber": "5012",
                            "status": "SHIPPED",
                            "trackingNumber": "TRK1",
                            "carrier": "GlobalPost",
                            "estimatedDelivery": "2026-10-01",
                            "totalAmount": "49.99",
                            "items": [],
                        }
                    },
                },
            )

        mock_backend(handler, monkeypatch)
        res = client.post("/chat", json={"message": "Where is order #5012?", "customer_id": 7})
        assert res.status_code == 200
        body = res.json()
        assert body["intent"] == "order_status"
        assert body["tool_used"] == "get_order_status"
        # The echo provider names the tool and shows the raw result, proving
        # real order data reached the prompt.
        assert "get_order_status" in body["reply"]
        assert "SHIPPED" in body["reply"]

    def test_order_not_found_still_returns_200_with_honest_reply(self, client, monkeypatch):
        def handler(request):
            return httpx.Response(404)

        mock_backend(handler, monkeypatch)
        res = client.post("/chat", json={"message": "Where is order #9999?", "customer_id": 7})
        assert res.status_code == 200
        assert res.json()["tool_used"] == "get_order_status"

    def test_backend_unreachable_does_not_crash_the_request(self, client, monkeypatch):
        def handler(request):
            raise httpx.ConnectError("refused")

        mock_backend(handler, monkeypatch)
        res = client.post("/chat", json={"message": "Where is order #5012?", "customer_id": 7})
        assert res.status_code == 200
        body = res.json()
        assert body["tool_used"] == "get_order_status"
        # A connection failure is retryable, so this shouldn't force a
        # handoff the way a confirmed non-retryable failure would — see
        # test_support_agent.py's retryable-vs-not distinction.
        assert body["handoff_required"] is False


class TestHumanHandoff:
    def test_handoff_request_sets_flag_with_no_tool(self, client):
        res = client.post("/chat", json={"message": "I want to talk to a human", "customer_id": 7})
        assert res.status_code == 200
        body = res.json()
        assert body["intent"] == "human_handoff"
        assert body["handoff_required"] is True
        assert body["tool_used"] is None


class TestTicketCreation:
    def test_creates_a_ticket_via_tool(self, client, monkeypatch):
        def handler(request):
            assert request.method == "POST"
            return httpx.Response(
                201,
                json={"success": True, "data": {"ticket": {"id": 55, "status": "OPEN", "subject": "x"}}},
            )

        mock_backend(handler, monkeypatch)
        res = client.post(
            "/chat", json={"message": "please open a ticket, my order arrived damaged", "customer_id": 7}
        )
        assert res.status_code == 200
        body = res.json()
        assert body["tool_used"] == "create_support_ticket"
        assert "55" in body["reply"]


class TestProductQuestion:
    def test_product_lookup_via_tool(self, client, monkeypatch):
        def handler(request):
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "products": [
                            {"name": "Aria Wireless Headphones", "price": "129.99", "stock": 5, "warrantyMonths": 24}
                        ]
                    },
                },
            )

        mock_backend(handler, monkeypatch)
        res = client.post("/chat", json={"message": "tell me about your headphones", "customer_id": 7})
        assert res.status_code == 200
        assert res.json()["tool_used"] == "get_product_information"


class TestNoCustomerId:
    def test_order_question_without_customer_id_does_not_call_backend(self, client, monkeypatch):
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(200, json={"success": True, "data": {}})

        mock_backend(handler, monkeypatch)
        res = client.post("/chat", json={"message": "Where is order #5012?"})
        assert res.status_code == 200
        assert res.json()["tool_used"] is None
        assert len(calls) == 0  # never even tried the backend without a customer
