from typing import Any, Optional, List
from uuid import UUID
from datetime import datetime, time, date
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.schemas.user import UserResponse
from app.schemas.feedback import SessionFeedbackResponse


# ============================================================================
# Scheduled Training Session Schemas (Curriculum Schedule from Ingested Excel)
# ============================================================================

class TrainingSessionBase(BaseModel):
    batch_id: UUID
    sequence_number: Optional[int] = None
    week: Optional[str] = None
    session_date: date
    day_name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    duration_hours: Decimal = Field(default=Decimal("8.0"), gt=Decimal("0.0"), le=Decimal("24.0"))
    module: str
    trainer_name: Optional[str] = None
    status: str = "Scheduled"

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
            # If day_name not given, infer from session_date
            if "session_date" in cleaned and isinstance(cleaned["session_date"], (date, datetime)) and not cleaned.get("day_name"):
                d = cleaned["session_date"]
                cleaned["day_name"] = d.strftime("%A")
            return cleaned
        return data


class TrainingSessionCreate(TrainingSessionBase):
    pass


class TrainingSessionUpdate(BaseModel):
    sequence_number: Optional[int] = None
    week: Optional[str] = None
    session_date: Optional[date] = None
    day_name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    duration_hours: Optional[Decimal] = None
    module: Optional[str] = None
    trainer_name: Optional[str] = None
    status: Optional[str] = None


class TrainingSessionResponse(TrainingSessionBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    utilization_logged: Optional[bool] = False
    utilization_id: Optional[UUID] = None
    actual_trainer: Optional[str] = None
    actual_hours: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Faculty Utilization Schemas (Delivery Ledger, Attendance & Timesheet)
# ============================================================================

class SessionBase(BaseModel):
    batch_id: UUID
    training_session_id: Optional[UUID] = None
    date_of_training: datetime  # TIMESTAMPTZ UTC
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    topic: str
    faculty_name: str
    no_of_hours: Decimal = Field(default=Decimal("8.0"), gt=Decimal("0.0"), le=Decimal("24.0"))
    venue: Optional[str] = None
    location_city: Optional[str] = None
    mode_of_delivery: str = "Online"  # Online, Offline, F2F, Blended
    status: str = "Scheduled"  # Scheduled, InProgress, Completed, Cancelled, Rescheduled
    feedback_submitted: Optional[bool] = False
    feedback_rating: Optional[Decimal] = None
    feedback_notes: Optional[str] = None
    outcome_reason: Optional[str] = None
    outcome_at: Optional[datetime] = None
    outcome_by: Optional[UUID] = None
    replacement_session_id: Optional[UUID] = None

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
    training_session_id: Optional[UUID] = None
    date_of_training: Optional[datetime] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    topic: Optional[str] = None
    faculty_name: Optional[str] = None
    no_of_hours: Optional[Decimal] = None
    venue: Optional[str] = None
    location_city: Optional[str] = None
    mode_of_delivery: Optional[str] = None
    status: Optional[str] = None
    feedback_submitted: Optional[bool] = None
    feedback_rating: Optional[Decimal] = None
    feedback_notes: Optional[str] = None
    outcome_reason: Optional[str] = None
    outcome_at: Optional[datetime] = None
    outcome_by: Optional[UUID] = None
    replacement_session_id: Optional[UUID] = None

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
    feedback_rating: Optional[Decimal] = None
    feedback_notes: Optional[str] = None
    outcome_reason: Optional[str] = None
    outcome_at: Optional[datetime] = None
    outcome_by: Optional[UUID] = None
    replacement_session_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionDetailResponse(SessionResponse):
    feedback: Optional[SessionFeedbackResponse] = None

    model_config = ConfigDict(from_attributes=True)


# Aliases for clear semantic naming
FacultyUtilizationBase = SessionBase
FacultyUtilizationCreate = SessionCreate
FacultyUtilizationUpdate = SessionUpdate
FacultyUtilizationResponse = SessionResponse
FacultyUtilizationDetailResponse = SessionDetailResponse
