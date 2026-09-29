"""Pydantic schemas for n8n automation endpoints."""
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.database.models import AutomationAction, AutomationStatus


class AutomationSendRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    company: Optional[str] = Field(default=None, max_length=255)
    message: Optional[str] = None


class AutomationSendResponse(BaseModel):
    automation_id: int
    status: AutomationStatus
    n8n_response: Any  # whatever n8n actually returned (dict, list, or plain text)


class AutomationLogOut(BaseModel):
    id: int
    user_id: int
    lead_id: Optional[int] = None
    lead_name: Optional[str] = None
    action: AutomationAction
    status: AutomationStatus
    request_data: Optional[str] = None
    response_data: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AutomationLogListResponse(BaseModel):
    items: List[AutomationLogOut]
    total: int
    page: int
    limit: int
    pages: int
