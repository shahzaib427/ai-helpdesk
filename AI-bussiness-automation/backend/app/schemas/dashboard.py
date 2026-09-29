"""Pydantic schemas for dashboard endpoints."""
from typing import List

from pydantic import BaseModel

from app.schemas.automation import AutomationLogOut


class DashboardStats(BaseModel):
    total_leads: int
    new_leads: int
    emails_sent: int
    successful_automations: int
    failed_automations: int


class RecentActivityResponse(BaseModel):
    items: List[AutomationLogOut]
