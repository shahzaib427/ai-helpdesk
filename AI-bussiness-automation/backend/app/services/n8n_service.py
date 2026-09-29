"""
n8n integration service.

This does NOT reimplement any AI logic — it only calls the existing n8n
webhook (Webhook -> Edit Fields -> AI Agent [Groq + Gmail + Postgres tools])
and returns whatever that workflow actually responds with.
"""
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.core.config import settings

# Give the AI Agent (LLM call + Gmail + Postgres tool calls) real room to run.
N8N_REQUEST_TIMEOUT_SECONDS = 30.0


@dataclass
class N8nResult:
    success: bool
    data: Any  # parsed JSON (dict/list) if possible, else raw text
    raw_text: str
    status_code: Optional[int]
    error_message: Optional[str] = None


async def call_n8n_webhook(payload: dict) -> N8nResult:
    """
    POSTs `payload` to the configured n8n webhook and returns an N8nResult.
    Never raises — all failure modes (timeout, connection error, non-2xx,
    unparsable body) are captured in the returned result so the caller can
    decide how to log/report them.
    """
    try:
        async with httpx.AsyncClient(timeout=N8N_REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(settings.N8N_WEBHOOK_URL, json=payload)
    except httpx.TimeoutException:
        return N8nResult(
            success=False,
            data=None,
            raw_text="",
            status_code=None,
            error_message="The n8n automation service timed out.",
        )
    except httpx.ConnectError:
        return N8nResult(
            success=False,
            data=None,
            raw_text="",
            status_code=None,
            error_message="Unable to connect to the n8n automation service.",
        )
    except httpx.RequestError as exc:
        return N8nResult(
            success=False,
            data=None,
            raw_text="",
            status_code=None,
            error_message=f"Request to the n8n automation service failed: {exc}",
        )

    raw_text = response.text

    # n8n may respond with JSON (e.g. {"output": "..."}) or plain text.
    # Never assume the exact shape — parse defensively.
    try:
        parsed: Any = response.json()
    except ValueError:
        parsed = raw_text

    if response.status_code >= 400:
        return N8nResult(
            success=False,
            data=parsed,
            raw_text=raw_text,
            status_code=response.status_code,
            error_message=f"n8n automation service returned HTTP {response.status_code}.",
        )

    return N8nResult(
        success=True,
        data=parsed,
        raw_text=raw_text,
        status_code=response.status_code,
    )
