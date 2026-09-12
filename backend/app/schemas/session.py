from typing import Optional
from uuid import UUID
from datetime import datetime, time
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.user import UserResponse
from app.schemas.feedback import SessionFeedbackResponse


class SessionBase(BaseModel):
    batch_id: UUID
    date_of_training: datetime  # TIMESTAMPTZ UTC
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    topic: str
    faculty_id: UUID
    no_of_hours: Decimal = Field(default=Decimal("8.0"), gt=Decimal("0.0"), le=Decimal("24.0"))
    venue: Optional[str] = None
    location_city: Optional[str] = None
    mode_of_delivery: str = "Online"  # Online, Offline, F2F
    status: str = "Scheduled"  # Scheduled, InProgress, Completed, Cancelled, Rescheduled


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    date_of_training: Optional[datetime] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    topic: Optional[str] = None
    faculty_id: Optional[UUID] = None
    no_of_hours: Optional[Decimal] = None
    venue: Optional[str] = None
    location_city: Optional[str] = None
    mode_of_delivery: Optional[str] = None
    status: Optional[str] = None


class SessionResponse(SessionBase):
    id: UUID
    feedback_submitted: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionDetailResponse(SessionResponse):
    faculty: Optional[UserResponse] = None
    feedback: Optional[SessionFeedbackResponse] = None

    model_config = ConfigDict(from_attributes=True)
