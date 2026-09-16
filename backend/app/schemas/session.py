from typing import Any, Optional
from uuid import UUID
from datetime import datetime, time
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.schemas.user import UserResponse
from app.schemas.feedback import SessionFeedbackResponse


class SessionBase(BaseModel):
    batch_id: UUID
    date_of_training: datetime  # TIMESTAMPTZ UTC
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    topic: str
    faculty_id: Optional[UUID] = None
    faculty_name: Optional[str] = None
    no_of_hours: Decimal = Field(default=Decimal("8.0"), gt=Decimal("0.0"), le=Decimal("24.0"))
    venue: Optional[str] = None
    location_city: Optional[str] = None
    mode_of_delivery: str = "Online"  # Online, Offline, F2F
    status: str = "Scheduled"  # Scheduled, InProgress, Completed, Cancelled, Rescheduled

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        if isinstance(data, dict):
            cleaned = {}
            for k, v in data.items():
                if isinstance(v, str):
                    s = v.strip()
                    cleaned[k] = s if s else None
                else:
                    cleaned[k] = v
            if "date" in cleaned and not cleaned.get("date_of_training"):
                cleaned["date_of_training"] = cleaned["date"]
            return cleaned
        return data


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    date_of_training: Optional[datetime] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    topic: Optional[str] = None
    faculty_id: Optional[UUID] = None
    faculty_name: Optional[str] = None
    no_of_hours: Optional[Decimal] = None
    venue: Optional[str] = None
    location_city: Optional[str] = None
    mode_of_delivery: Optional[str] = None
    status: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        if isinstance(data, dict):
            cleaned = {}
            for k, v in data.items():
                if isinstance(v, str):
                    s = v.strip()
                    cleaned[k] = s if s else None
                else:
                    cleaned[k] = v
            return cleaned
        return data


class SessionResponse(SessionBase):
    id: UUID
    feedback_submitted: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionDetailResponse(SessionResponse):
    faculty: Optional[UserResponse] = None
    feedback: Optional[SessionFeedbackResponse] = None

    model_config = ConfigDict(from_attributes=True)
