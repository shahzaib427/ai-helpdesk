"""
Dashboard routes. Every number here is computed live from the database —
nothing is hardcoded.

Scoping follows the same rule as leads/automation history: a normal user
sees only their own data, an admin sees everyone's.

Note on "emails_sent": the existing n8n workflow performs the Gmail send
as an internal step of a single AI Agent call, and only reports back one
combined result per call (not a separate "email sent" confirmation). So
"emails_sent" is computed as the count of successful automation runs —
the best available proxy given what n8n actually reports back to us,
not a fabricated number.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database.database import get_db
from app.database.models import AutomationLog, AutomationStatus, Lead, LeadStatus, User, UserRole
from app.dependencies.auth import get_current_user
from app.schemas.automation import AutomationLogOut
from app.schemas.dashboard import DashboardStats, RecentActivityResponse

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _scope_leads(db: Session, current_user: User):
    query = db.query(Lead)
    if current_user.role != UserRole.admin:
        query = query.filter(Lead.user_id == current_user.id)
    return query


def _scope_automation_logs(db: Session, current_user: User):
    query = db.query(AutomationLog)
    if current_user.role != UserRole.admin:
        query = query.filter(AutomationLog.user_id == current_user.id)
    return query


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total_leads = _scope_leads(db, current_user).count()
    new_leads = _scope_leads(db, current_user).filter(Lead.status == LeadStatus.new).count()

    successful_automations = (
        _scope_automation_logs(db, current_user)
        .filter(AutomationLog.status == AutomationStatus.success)
        .count()
    )
    failed_automations = (
        _scope_automation_logs(db, current_user)
        .filter(AutomationLog.status == AutomationStatus.failed)
        .count()
    )

    return DashboardStats(
        total_leads=total_leads,
        new_leads=new_leads,
        emails_sent=successful_automations,
        successful_automations=successful_automations,
        failed_automations=failed_automations,
    )


@router.get("/recent-activity", response_model=RecentActivityResponse)
def get_recent_activity(
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = (
        _scope_automation_logs(db, current_user)
        .options(joinedload(AutomationLog.lead))
        .order_by(AutomationLog.created_at.desc())
        .limit(limit)
        .all()
    )

    items = []
    for log in logs:
        out = AutomationLogOut.model_validate(log)
        out.lead_name = log.lead.name if log.lead else None
        items.append(out)

    return RecentActivityResponse(items=items)
