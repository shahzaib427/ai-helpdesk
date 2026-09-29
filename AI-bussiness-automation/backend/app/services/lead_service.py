"""
Business logic for leads: querying with search/filter/pagination, and
ownership enforcement (a normal user only ever sees their own leads;
an admin sees everyone's).
"""
import math
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.models import Lead, LeadStatus, User, UserRole


def build_leads_query(db: Session, current_user: User, search: Optional[str], lead_status: Optional[LeadStatus]):
    query = db.query(Lead)

    if current_user.role != UserRole.admin:
        query = query.filter(Lead.user_id == current_user.id)

    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(Lead.name.ilike(like), Lead.email.ilike(like), Lead.company.ilike(like))
        )

    if lead_status:
        query = query.filter(Lead.status == lead_status)

    return query


def paginate(query, page: int, limit: int):
    total = query.count()
    pages = max(1, math.ceil(total / limit))
    items = query.order_by(Lead.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return items, total, pages


def get_lead_or_404(db: Session, current_user: User, lead_id: int) -> Lead:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    if current_user.role != UserRole.admin and lead.user_id != current_user.id:
        # Report "not found" rather than "forbidden" so we don't leak the
        # existence of other users' records.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    return lead
