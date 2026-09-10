from typing import Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, ConfigDict


class FacultyBase(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    faculty_type: str = "Internal Full-time"  # Internal Full-time, External Consultant, HOP
    domain: Optional[str] = None  # IT/ITES, Cloud, DS/ML, CyberSecurity, FullStack
    fms_external_id: Optional[str] = None
    fms_status: str = "Active"  # Active, Flagged, Blocked
    standard_hourly_rate: Decimal = Decimal("0.00")
    is_active: bool = True


class FacultyCreate(FacultyBase):
    pass


class FacultyUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    faculty_type: Optional[str] = None
    domain: Optional[str] = None
    fms_external_id: Optional[str] = None
    fms_status: Optional[str] = None
    standard_hourly_rate: Optional[Decimal] = None
    is_active: Optional[bool] = None


class FacultyResponse(FacultyBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FacultyUtilizationSummary(BaseModel):
    faculty_id: UUID
    full_name: str
    faculty_type: str
    total_sessions: int
    total_hours_delivered: Decimal
    average_feedback_rating: Optional[Decimal] = None
    active_batches_count: int
    fms_status: str
