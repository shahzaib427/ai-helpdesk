"""
Business logic for automation runs: persisting automation_logs records,
and querying automation history with pagination + ownership enforcement.
"""
import json
import math
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database.models import AutomationLog, AutomationAction, AutomationStatus, User, UserRole


def log_automation(
    db: Session,
    user_id: int,
    action: AutomationAction,
    status: AutomationStatus,
    request_data: Optional[dict] = None,
    response_data: Any = None,
    lead_id: Optional[int] = None,
) -> AutomationLog:
    """
    Create and persist an automation_logs row. Never include passwords or
    JWT tokens in request_data/response_data — callers must not pass them.
    """
    log = AutomationLog(
        user_id=user_id,
        lead_id=lead_id,
        action=action,
        status=status,
        request_data=json.dumps(request_data) if request_data is not None else None,
        response_data=json.dumps(response_data) if response_data is not None else None,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def build_history_query(db: Session, current_user: User, status_filter: Optional[AutomationStatus]):
    query = db.query(AutomationLog).options(joinedload(AutomationLog.lead))

    if current_user.role != UserRole.admin:
        query = query.filter(AutomationLog.user_id == current_user.id)

    if status_filter:
        query = query.filter(AutomationLog.status == status_filter)

    return query


def paginate_history(query, page: int, limit: int):
    total = query.count()
    pages = max(1, math.ceil(total / limit))
    items = (
        query.order_by(AutomationLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return items, total, pages


def get_automation_log_or_404(db: Session, current_user: User, automation_id: int) -> AutomationLog:
    log = (
        db.query(AutomationLog)
        .options(joinedload(AutomationLog.lead))
        .filter(AutomationLog.id == automation_id)
        .first()
    )
    if log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation log not found")

    if current_user.role != UserRole.admin and log.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Automation log not found")

    return log
