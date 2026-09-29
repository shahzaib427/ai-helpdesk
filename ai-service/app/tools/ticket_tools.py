"""Ticket tools, both scoped to the customer whose conversation is asking."""
import re

from app.tools.base import ToolError, internal_request

_TICKET_NUMBER_PATTERN = re.compile(r"ticket\s*#?\s*(\d+)", re.IGNORECASE)


def extract_ticket_number(text: str) -> str | None:
    match = _TICKET_NUMBER_PATTERN.search(text)
    return match.group(1) if match else None


async def create_support_ticket(
    customer_id: int, subject: str, description: str, category: str = "general", conversation_id: int | None = None
) -> dict:
    if not customer_id:
        raise ToolError("This tool requires a signed-in customer.")
    if not subject or not description:
        raise ToolError("subject and description are required.")

    result = await internal_request(
        "POST",
        "/tickets",
        json={
            "customerId": customer_id,
            "subject": subject[:180],
            "description": description[:4000],
            "category": category,
            "conversationId": conversation_id,
        },
    )
    ticket = result["ticket"]
    return {"found": True, "ticket_id": ticket["id"], "status": ticket["status"], "subject": ticket["subject"]}


async def get_ticket_status(ticket_id: str, customer_id: int) -> dict:
    if not ticket_id or not str(ticket_id).isdigit():
        raise ToolError("ticket_id must be a numeric ticket id.")
    if not customer_id:
        raise ToolError("This tool requires a signed-in customer.")

    result = await internal_request("GET", f"/tickets/{ticket_id}", params={"customerId": customer_id})
    if not result.get("found"):
        return {"found": False}

    ticket = result["ticket"]
    return {
        "found": True,
        "ticket_id": ticket["id"],
        "subject": ticket["subject"],
        "status": ticket["status"],
        "priority": ticket["priority"],
        "created_at": ticket["createdAt"],
    }
