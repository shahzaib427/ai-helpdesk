"""Pydantic schemas for lead endpoints."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.database.models import LeadStatus


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    company: Optional[str] = Field(default=None, max_length=255)
    message: Optional[str] = None


class LeadUpdate(BaseModel):
    """Only status, company, and message are editable, per spec."""
    status: Optional[LeadStatus] = None
    company: Optional[str] = Field(default=None, max_length=255)
    message: Optional[str] = None


class LeadOut(BaseModel):
    id: int
    user_id: int
    name: str
    email: EmailStr
    company: Optional[str] = None
    message: Optional[str] = None
    status: LeadStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadListResponse(BaseModel):
    items: List[LeadOut]
    total: int
    page: int
    limit: int
    pages: int
