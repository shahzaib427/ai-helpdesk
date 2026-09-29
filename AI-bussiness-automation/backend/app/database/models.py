"""
SQLAlchemy ORM models for the AI Business Automation platform.

Tables:
- users             authenticated platform users (Phase 3 uses this)
- leads              customer/lead records, owned by a user
- automation_logs    a record of every n8n automation call (Phase 5/6)
- conversations      AI chat turns tied to a session (Phase 8)
"""
import enum
import uuid

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    converted = "converted"
    closed = "closed"


class AutomationAction(str, enum.Enum):
    email = "email"
    save_lead = "save_lead"
    ai_request = "ai_request"
    automation = "automation"


class AutomationStatus(str, enum.Enum):
    success = "success"
    failed = "failed"
    pending = "pending"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False, default=UserRole.user)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    leads = relationship("Lead", back_populates="user", cascade="all, delete-orphan")
    automation_logs = relationship(
        "AutomationLog", back_populates="user", cascade="all, delete-orphan"
    )
    conversations = relationship(
        "Conversation", back_populates="user", cascade="all, delete-orphan"
    )


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    company = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    status = Column(Enum(LeadStatus, name="lead_status"), nullable=False, default=LeadStatus.new)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="leads")
    automation_logs = relationship(
        "AutomationLog", back_populates="lead", cascade="all, delete-orphan"
    )


class AutomationLog(Base):
    __tablename__ = "automation_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(Enum(AutomationAction, name="automation_action"), nullable=False)
    status = Column(Enum(AutomationStatus, name="automation_status"), nullable=False)
    request_data = Column(Text, nullable=True)   # JSON-serialized request payload
    response_data = Column(Text, nullable=True)  # JSON-serialized response payload
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="automation_logs")
    lead = relationship("Lead", back_populates="automation_logs")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(255), nullable=False, index=True, default=lambda: str(uuid.uuid4()))
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="conversations")
