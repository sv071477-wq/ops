from typing import Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class SessionFeedbackCreate(BaseModel):
    """Payload required for Quality Gate 1"""
    rating: Decimal = Field(..., ge=Decimal("1.0"), le=Decimal("5.0"), description="Rating between 1.0 and 5.0")
    topic_feedback: str = Field(..., min_length=3, description="Topic delivery notes and summary")
    faculty_observations: Optional[str] = None
    total_students_present: int = Field(default=0, ge=0)


class SessionFeedbackResponse(BaseModel):
    id: UUID
    session_id: UUID
    rating: Decimal
    topic_feedback: Optional[str] = None
    faculty_observations: Optional[str] = None
    total_students_present: int
    submitted_at: datetime
    submitted_by: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)


class BatchNpsClosureCreate(BaseModel):
    """Payload required for Quality Gate 2.

    Only the three NPS category counts are accepted. The index itself, the
    total and the average batch feedback are derived server-side so a
    client cannot assert its own NPS.
    """
    promoters_count: int = Field(..., ge=0, description="Responses scoring 9-10")
    passive_count: int = Field(..., ge=0, description="Responses scoring 7-8")
    detractors_count: int = Field(..., ge=0, description="Responses scoring 0-6")
