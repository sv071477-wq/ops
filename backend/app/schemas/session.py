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
    faculty_name: str
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
    faculty_name: Optional[str] = None
    no_of_hours: Optional[Decimal] = None
    venue: Optional[str] = None
    location_city: Optional[str] = None
    mode_of_delivery: Optional[str] = None

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


class SessionOutcomeRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=2000)


class SessionRescheduleRequest(SessionOutcomeRequest):
    date_of_training: datetime
    start_time: Optional[time] = None
    end_time: Optional[time] = None


class SessionResponse(SessionBase):
    id: UUID
    feedback_submitted: bool
    outcome_reason: Optional[str] = None
    outcome_at: Optional[datetime] = None
    outcome_by: Optional[UUID] = None
    replacement_session_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionDetailResponse(SessionResponse):
    feedback: Optional[SessionFeedbackResponse] = None

    model_config = ConfigDict(from_attributes=True)
