"""Order tools. All three read-only, all three scoped to the customer whose
conversation is asking — a tool never accepts an arbitrary customer_id from
the message text, only the one Node already told it belongs to this thread.
"""
import re

from app.tools.base import ToolError, internal_request

# Accepts "order 5012", "order #5012", "#5012", or a bare "5012" near the
# word order — matches the demo seed data's numeric order numbers. Real
# order-number formats vary a lot between retailers; this is one reasonable
# pattern, not a universal parser.
_ORDER_NUMBER_PATTERN = re.compile(r"#?\s*(\d{4,10})")


def extract_order_number(text: str) -> str | None:
    match = _ORDER_NUMBER_PATTERN.search(text)
    return match.group(1) if match else None


async def get_order_status(order_number: str, customer_id: int) -> dict:
    if not order_number or not order_number.isdigit():
        raise ToolError("order_number must be a numeric order number.")
    if not customer_id:
        raise ToolError("This tool requires a signed-in customer.")

    result = await internal_request(
        "GET", f"/orders/by-number/{order_number}", params={"customerId": customer_id}
    )
    if not result.get("found"):
        return {"found": False}

    order = result["order"]
    return {
        "found": True,
        "order_number": order["orderNumber"],
        "status": order["status"],
        "tracking_number": order.get("trackingNumber"),
        "carrier": order.get("carrier"),
        "estimated_delivery": order.get("estimatedDelivery"),
        "total_amount": order["totalAmount"],
        "item_count": len(order.get("items", [])),
    }


async def get_customer_orders(customer_id: int, limit: int = 5) -> dict:
    if not customer_id:
        raise ToolError("This tool requires a signed-in customer.")

    result = await internal_request("GET", "/orders", params={"customerId": customer_id, "limit": limit})
    orders = result.get("orders", [])
    return {
        "found": len(orders) > 0,
        "orders": [
            {
                "order_number": o["orderNumber"],
                "status": o["status"],
                "total_amount": o["totalAmount"],
                "placed_at": o["placedAt"],
            }
            for o in orders
        ],
    }


async def get_refund_status(order_number: str, customer_id: int) -> dict:
    """There's no separate refund record in this project's schema — an
    order's own status (REFUNDED or not) is the refund status. This reuses
    get_order_status's data rather than needing its own backend endpoint,
    since the two tools are reading the same underlying fact."""
    status = await get_order_status(order_number, customer_id)
    if not status.get("found"):
        return {"found": False}

    return {
        "found": True,
        "order_number": status["order_number"],
        "order_status": status["status"],
        "is_refunded": status["status"] == "REFUNDED",
        "total_amount": status["total_amount"],
    }
