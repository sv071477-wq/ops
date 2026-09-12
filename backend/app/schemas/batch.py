from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.schemas.user import UserResponse


class BatchBase(BaseModel):
    batch_id: str = Field(..., min_length=3, max_length=255, description="Unique immutable batch identifier")
    sow_number: Optional[str] = Field(None, max_length=100, description="Client-side SOW number")
    approval_id: Optional[str] = Field(None, max_length=100, description="Financial SOW Approval ID")
    category: str = Field("Bootcamp", description="Bootcamp, RBT, PJP, Workshop")
    residential_type: str = Field("NR", description="R, NR")
    entity_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    delivery_mode_id: Optional[UUID] = None
    accommodation_id: Optional[UUID] = None
    program_name: str = Field(..., min_length=2, max_length=255)
    technology: Optional[str] = Field(None, max_length=255)
    domain: Optional[str] = Field(None, max_length=100)
    client_name: Optional[str] = Field(None, max_length=255)
    delivery_mode: str = Field("Online", description="Online, F2F, Blended")
    location_city: Optional[str] = Field(None, max_length=100)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    batch_request_date: Optional[datetime] = None
    training_days: int = Field(0, ge=0)
    calendar_days: Optional[int] = Field(0, ge=0)
    total_hours: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    total_enrollments: int = Field(0, ge=0)
    residential_enrollments: int = Field(0, ge=0)
    non_residential_enrollments: int = Field(0, ge=0)
    status: str = Field("Requested", description="Requested, Approved, Upcoming, Ongoing, Completed, Cancelled, OnHold")
    primary_manager_id: Optional[UUID] = None
    coordinator_id: Optional[UUID] = None
    sales_spoc_id: Optional[UUID] = None
    faculty_assigned_text: Optional[str] = None
    finance_status: str = Field("Pending", max_length=50)
    finance_status_check_date: Optional[date] = None
    finance_check: Optional[int] = Field(None, ge=0)
    remarks: Optional[str] = None
    comments: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class BatchCreate(BatchBase):
    pass


class BatchApprove(BaseModel):
    approval_id: str = Field(..., min_length=3, max_length=100, description="Financial SOW or Manager Approval Reference")


class ApprovalDecision(BaseModel):
    decision: str = Field(..., pattern="^(approve|reject)$")
    reason: Optional[str] = Field(None, max_length=1000)


class ApprovalConfigurationBase(BaseModel):
    approver_1_id: Optional[UUID] = None
    approver_2_id: Optional[UUID] = None


class ApprovalConfigurationResponse(ApprovalConfigurationBase):
    id: UUID
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BatchUpdate(BaseModel):
    sow_number: Optional[str] = None
    approval_id: Optional[str] = None
    category: Optional[str] = None
    residential_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    delivery_mode_id: Optional[UUID] = None
    accommodation_id: Optional[UUID] = None
    program_name: Optional[str] = None
    technology: Optional[str] = None
    domain: Optional[str] = None
    client_name: Optional[str] = None
    delivery_mode: Optional[str] = None
    location_city: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    batch_request_date: Optional[datetime] = None
    training_days: Optional[int] = None
    calendar_days: Optional[int] = None
    total_hours: Optional[Decimal] = None
    total_enrollments: Optional[int] = None
    residential_enrollments: Optional[int] = None
    non_residential_enrollments: Optional[int] = None
    status: Optional[str] = None
    primary_manager_id: Optional[UUID] = None
    coordinator_id: Optional[UUID] = None
    sales_spoc_id: Optional[UUID] = None
    faculty_assigned_text: Optional[str] = None
    finance_status: Optional[str] = None
    finance_status_check_date: Optional[date] = None
    finance_check: Optional[int] = Field(None, ge=0)
    remarks: Optional[str] = None
    comments: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class BatchResponse(BatchBase):
    id: UUID
    is_schema_locked: bool
    approver_1_id: Optional[UUID] = None
    approver_2_id: Optional[UUID] = None
    approver_1_status: str = "Pending"
    approver_2_status: str = "Pending"
    approver_1_approved_at: Optional[datetime] = None
    approver_2_approved_at: Optional[datetime] = None
    finance_status_check_date: Optional[date] = None
    finance_check: Optional[int] = None
    batch_avg_feedback: Optional[Decimal] = None
    total_feedback_score: Optional[Decimal] = None
    batch_nps: Optional[Decimal] = None
    retrospective_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BatchDetailResponse(BatchResponse):
    primary_manager: Optional[UserResponse] = None
    coordinator: Optional[UserResponse] = None
    sales_spoc: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)
