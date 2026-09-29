"""Shared plumbing every tool uses to reach the Node backend.

No tool ever touches Postgres directly — every one of them goes through this
client to Node's /api/internal/* routes, which are the only endpoints that
accept the shared internal API key instead of a user JWT. This file is the
one place that key is attached to a request, so a tool module itself never
has to know how authentication works, only what data it needs.
"""
import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class ToolError(Exception):
    """Raised when a tool can't complete — bad input, the resource doesn't
    exist, or the backend is unreachable. Always caught by support_agent.py
    and turned into something the customer can be told honestly, never
    allowed to bubble up as a raw exception."""

    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.message = message
        self.retryable = retryable


async def internal_request(method: str, path: str, params: dict | None = None, json: dict | None = None) -> dict:
    settings = get_settings()
    if not settings.internal_api_key:
        # A configuration mistake, not a tool-input mistake — fail loudly
        # rather than silently sending an unauthenticated request that Node
        # will reject anyway.
        raise ToolError("INTERNAL_API_KEY is not configured for the AI service.")

    url = f"{settings.backend_url}/api/internal{path}"
    headers = {"X-Internal-Api-Key": settings.internal_api_key}

    try:
        async with httpx.AsyncClient(timeout=settings.tool_timeout_seconds) as client:
            response = await client.request(method, url, params=params, json=json, headers=headers)
    except httpx.TimeoutException as exc:
        raise ToolError(f"The backend took too long to respond to {path}.", retryable=True) from exc
    except httpx.RequestError as exc:
        raise ToolError(f"Could not reach the backend at {path}.", retryable=True) from exc

    if response.status_code == 404:
        return {"found": False}
    if response.status_code == 400:
        detail = response.json().get("message", "Invalid request") if response.content else "Invalid request"
        raise ToolError(detail)
    if response.status_code >= 500:
        raise ToolError(f"The backend returned an error for {path}.", retryable=True)
    if response.status_code >= 400:
        raise ToolError(f"The backend rejected the request to {path} ({response.status_code}).")

    body = response.json()
    data = body.get("data", {})
    data["found"] = True
    return data
