"""
Automation routes. POST /api/automation/send is the core integration:
FastAPI validates the request, calls the existing n8n webhook, waits for
its response, logs the attempt, and returns the actual n8n response to
the caller (never a fabricated one).

GET /api/automation/history and GET /api/automation/{id} expose the
automation_logs table for the history UI, with the same ownership rules
as leads (a normal user sees only their own runs; an admin sees all).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import AutomationAction, AutomationStatus, User
from app.dependencies.auth import get_current_user
from app.schemas.automation import (
    AutomationLogListResponse,
    AutomationLogOut,
    AutomationSendRequest,
    AutomationSendResponse,
)
from app.services.automation_service import (
    build_history_query,
    get_automation_log_or_404,
    log_automation,
    paginate_history,
)
from app.services.n8n_service import call_n8n_webhook

router = APIRouter(prefix="/api/automation", tags=["automation"])


def _to_log_out(log) -> AutomationLogOut:
    """Attach the lead's name (if any) for display, without changing the DB schema."""
    data = AutomationLogOut.model_validate(log)
    data.lead_name = log.lead.name if log.lead else None
    return data


@router.post("/send", response_model=AutomationSendResponse)
async def send_automation(
    payload: AutomationSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request_payload = payload.model_dump()

    result = await call_n8n_webhook(request_payload)

    if not result.success:
        # Log the failure before reporting it, so it still shows up in history.
        log_automation(
            db=db,
            user_id=current_user.id,
            action=AutomationAction.automation,
            status=AutomationStatus.failed,
            request_data=request_payload,
            response_data={"error": result.error_message, "raw": result.raw_text}
            if result.raw_text
            else {"error": result.error_message},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result.error_message or "Unable to connect to n8n automation service",
        )

    log = log_automation(
        db=db,
        user_id=current_user.id,
        action=AutomationAction.automation,
        status=AutomationStatus.success,
        request_data=request_payload,
        response_data=result.data,
    )

    return AutomationSendResponse(
        automation_id=log.id,
        status=AutomationStatus.success,
        n8n_response=result.data,
    )


@router.get("/history", response_model=AutomationLogListResponse)
def get_automation_history(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    status_filter: Optional[AutomationStatus] = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = build_history_query(db, current_user, status_filter)
    items, total, pages = paginate_history(query, page, limit)
    return AutomationLogListResponse(
        items=[_to_log_out(log) for log in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/{automation_id}", response_model=AutomationLogOut)
def get_automation_log(
    automation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = get_automation_log_or_404(db, current_user, automation_id)
    return _to_log_out(log)
