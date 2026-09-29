"""Tests for the tool layer, using httpx.MockTransport so the real
request-building and response-parsing code runs against a handler we
control, without a live Node backend."""
import httpx
import pytest

from app.tools import order_tools, product_tools, ticket_tools
from app.tools.base import ToolError


@pytest.fixture(autouse=True)
def internal_api_key(monkeypatch):
    from app.core.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    monkeypatch.setattr(settings, "internal_api_key", "test-key")
    monkeypatch.setattr(settings, "backend_url", "https://fake-backend.test")
    yield
    get_settings.cache_clear()


def patch_transport(handler, monkeypatch):
    class PatchedClient(httpx.AsyncClient):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = httpx.MockTransport(handler)
            super().__init__(*args, **kwargs)

    import app.tools.base as base_module

    monkeypatch.setattr(base_module.httpx, "AsyncClient", PatchedClient)


class TestGetOrderStatus:
    @pytest.mark.anyio
    async def test_returns_shaped_order_data(self, monkeypatch):
        def handler(request):
            assert request.headers["x-internal-api-key"] == "test-key"
            assert request.url.params["customerId"] == "7"
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "order": {
                            "orderNumber": "5012",
                            "status": "SHIPPED",
                            "trackingNumber": "TRK123",
                            "carrier": "GlobalPost",
                            "estimatedDelivery": "2026-10-01",
                            "totalAmount": "49.99",
                            "items": [{"id": 1}],
                        }
                    },
                },
            )

        patch_transport(handler, monkeypatch)
        result = await order_tools.get_order_status("5012", customer_id=7)
        assert result["found"] is True
        assert result["order_number"] == "5012"
        assert result["status"] == "SHIPPED"
        assert result["item_count"] == 1

    @pytest.mark.anyio
    async def test_not_found_returns_found_false(self, monkeypatch):
        def handler(request):
            return httpx.Response(404)

        patch_transport(handler, monkeypatch)
        result = await order_tools.get_order_status("9999", customer_id=7)
        assert result == {"found": False}

    @pytest.mark.anyio
    async def test_rejects_non_numeric_order_number(self):
        with pytest.raises(ToolError):
            await order_tools.get_order_status("not-a-number", customer_id=7)

    @pytest.mark.anyio
    async def test_rejects_missing_customer_id(self):
        with pytest.raises(ToolError):
            await order_tools.get_order_status("5012", customer_id=None)

    @pytest.mark.anyio
    async def test_backend_down_raises_retryable_tool_error(self, monkeypatch):
        def handler(request):
            raise httpx.ConnectError("refused")

        patch_transport(handler, monkeypatch)
        with pytest.raises(ToolError) as exc_info:
            await order_tools.get_order_status("5012", customer_id=7)
        assert exc_info.value.retryable is True


class TestGetCustomerOrders:
    @pytest.mark.anyio
    async def test_returns_list(self, monkeypatch):
        def handler(request):
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "orders": [
                            {"orderNumber": "5001", "status": "DELIVERED", "totalAmount": "20.00", "placedAt": "x"},
                            {"orderNumber": "5002", "status": "PENDING", "totalAmount": "10.00", "placedAt": "y"},
                        ]
                    },
                },
            )

        patch_transport(handler, monkeypatch)
        result = await order_tools.get_customer_orders(customer_id=7)
        assert result["found"] is True
        assert len(result["orders"]) == 2

    @pytest.mark.anyio
    async def test_empty_list_is_found_false(self, monkeypatch):
        def handler(request):
            return httpx.Response(200, json={"success": True, "data": {"orders": []}})

        patch_transport(handler, monkeypatch)
        result = await order_tools.get_customer_orders(customer_id=7)
        assert result["found"] is False


class TestGetRefundStatus:
    @pytest.mark.anyio
    async def test_refunded_order(self, monkeypatch):
        def handler(request):
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "order": {
                            "orderNumber": "5012",
                            "status": "REFUNDED",
                            "totalAmount": "49.99",
                            "items": [],
                        }
                    },
                },
            )

        patch_transport(handler, monkeypatch)
        result = await order_tools.get_refund_status("5012", customer_id=7)
        assert result["is_refunded"] is True

    @pytest.mark.anyio
    async def test_not_refunded_order(self, monkeypatch):
        def handler(request):
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {"order": {"orderNumber": "5012", "status": "SHIPPED", "totalAmount": "49.99", "items": []}},
                },
            )

        patch_transport(handler, monkeypatch)
        result = await order_tools.get_refund_status("5012", customer_id=7)
        assert result["is_refunded"] is False

    @pytest.mark.anyio
    async def test_order_not_found(self, monkeypatch):
        def handler(request):
            return httpx.Response(404)

        patch_transport(handler, monkeypatch)
        result = await order_tools.get_refund_status("9999", customer_id=7)
        assert result == {"found": False}


class TestGetProductInformation:
    @pytest.mark.anyio
    async def test_returns_matching_products(self, monkeypatch):
        def handler(request):
            assert request.url.params["search"] == "headphones"
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "products": [
                            {
                                "name": "Aria Wireless Headphones",
                                "category": "Audio",
                                "price": "129.99",
                                "stock": 10,
                                "warrantyMonths": 24,
                                "description": "Over-ear ANC headphones",
                            }
                        ]
                    },
                },
            )

        patch_transport(handler, monkeypatch)
        result = await product_tools.get_product_information("headphones")
        assert result["found"] is True
        assert result["products"][0]["name"] == "Aria Wireless Headphones"
        assert result["products"][0]["in_stock"] is True

    @pytest.mark.anyio
    async def test_out_of_stock_flag(self, monkeypatch):
        def handler(request):
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {"products": [{"name": "X", "price": "1", "stock": 0}]},
                },
            )

        patch_transport(handler, monkeypatch)
        result = await product_tools.get_product_information("x")
        assert result["products"][0]["in_stock"] is False

    @pytest.mark.anyio
    async def test_rejects_empty_query(self):
        with pytest.raises(ToolError):
            await product_tools.get_product_information("   ")


class TestCreateSupportTicket:
    @pytest.mark.anyio
    async def test_creates_and_returns_ticket_id(self, monkeypatch):
        def handler(request):
            assert request.method == "POST"
            return httpx.Response(
                201,
                json={
                    "success": True,
                    "data": {"ticket": {"id": 42, "status": "OPEN", "subject": "Help"}},
                },
            )

        patch_transport(handler, monkeypatch)
        result = await ticket_tools.create_support_ticket(
            customer_id=7, subject="Help", description="Something is wrong"
        )
        assert result["ticket_id"] == 42
        assert result["status"] == "OPEN"

    @pytest.mark.anyio
    async def test_rejects_missing_customer_id(self):
        with pytest.raises(ToolError):
            await ticket_tools.create_support_ticket(customer_id=None, subject="x", description="y")

    @pytest.mark.anyio
    async def test_rejects_empty_subject(self):
        with pytest.raises(ToolError):
            await ticket_tools.create_support_ticket(customer_id=7, subject="", description="y")


class TestGetTicketStatus:
    @pytest.mark.anyio
    async def test_returns_ticket_detail(self, monkeypatch):
        def handler(request):
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "ticket": {
                            "id": 42,
                            "subject": "Help",
                            "status": "IN_PROGRESS",
                            "priority": "MEDIUM",
                            "createdAt": "2026-01-01",
                        }
                    },
                },
            )

        patch_transport(handler, monkeypatch)
        result = await ticket_tools.get_ticket_status("42", customer_id=7)
        assert result["found"] is True
        assert result["status"] == "IN_PROGRESS"

    @pytest.mark.anyio
    async def test_not_found(self, monkeypatch):
        def handler(request):
            return httpx.Response(404)

        patch_transport(handler, monkeypatch)
        result = await ticket_tools.get_ticket_status("999", customer_id=7)
        assert result == {"found": False}

    @pytest.mark.anyio
    async def test_rejects_non_numeric_ticket_id(self):
        with pytest.raises(ToolError):
            await ticket_tools.get_ticket_status("abc", customer_id=7)
