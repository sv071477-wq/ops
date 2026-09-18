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
    """Payload required for Quality Gate 2"""
    nps_score: Optional[Decimal] = Field(None, ge=Decimal("-100.0"), le=Decimal("100.0"), description="Calculated NPS, supplied only for display")
    total_responses: int = Field(default=0, ge=0)
    promoters_count: int = Field(default=0, ge=0)
    passive_count: int = Field(default=0, ge=0)
    detractors_count: int = Field(default=0, ge=0)
    average_feedback_score: Optional[Decimal] = Field(None, ge=Decimal("1.0"), le=Decimal("5.0"))
    client_feedback: Optional[str] = None


class BatchFeedbackImportResponse(BaseModel):
    batch_id: UUID
    source_filename: str
    total_responses: int
    promoters_count: int
    passive_count: int
    detractors_count: int
    nps_score: Decimal
    average_feedback_score: Optional[Decimal] = None


class BatchNpsClosureResponse(BaseModel):
    id: UUID
    batch_id: UUID
    nps_score: Decimal
    net_promoter_index: Optional[Decimal] = None
    total_responses: int
    promoters_count: int
    passive_count: int
    detractors_count: int
    average_feedback_score: Optional[Decimal] = None
    client_feedback: Optional[str] = None
    closed_at: datetime
    closed_by: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)
