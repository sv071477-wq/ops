from typing import Optional, List, Any, Literal
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.schemas.user import UserResponse
import json


class BatchBase(BaseModel):
    batch_id: str = Field(..., min_length=3, max_length=255, description="Unique immutable batch identifier")
    sow_number: Optional[str] = Field(None, max_length=100, description="Client-side SOW number")
    approval_id: Optional[str] = Field(None, max_length=100, description="Financial SOW Approval ID")
    category: str = Field("Bootcamp", description="Bootcamp, RBT, PJP, Workshop")
    entity_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    delivery_mode_id: Optional[UUID] = None
    delivery_mode: Optional[str] = "Online"
    accommodation_id: Optional[UUID] = None
    program_name: str = Field(..., min_length=2, max_length=255)
    technology: Optional[str] = Field(None, max_length=255)
    domain: Optional[str] = Field(None, max_length=100)
    client_name: Optional[str] = Field(None, max_length=255)
    location_city: Optional[str] = Field(None, max_length=100)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    batch_request_date: Optional[datetime] = None
    training_days: int = Field(0, ge=0)
    calendar_days: Optional[int] = Field(0, ge=0)
    total_hours: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    total_enrollments: int = Field(0, ge=0)
    status: str = Field("Requested", description="Requested, Approved, Upcoming, Ongoing, Completed, Cancelled, OnHold")
    primary_manager_id: Optional[UUID] = None
    coordinator_id: Optional[UUID] = None
    sales_spoc_id: Optional[UUID] = None
    faculty_assigned_text: Optional[str] = None
    faculty_members: List[dict] = Field(default_factory=list, description="Array of faculty member objects with name, email, etc.")
    finance_status: str = Field("Pending", pattern="^(Pending|Cleared)$", max_length=50)
    finance_status_check_date: Optional[date] = None
    finance_check: Optional[int] = None
    remarks: Optional[str] = None

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
            if "sow_number" in cleaned and cleaned["sow_number"] is not None:
                cleaned["sow_number"] = str(cleaned["sow_number"]).strip()
            # Parse faculty_members if it's a JSON string
            if "faculty_members" in cleaned and isinstance(cleaned["faculty_members"], str):
                try:
                    cleaned["faculty_members"] = json.loads(cleaned["faculty_members"])
                except json.JSONDecodeError:
                    cleaned["faculty_members"] = []
            return cleaned
        return data

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            self.end_date = self.start_date
        return self


class BatchCreate(BatchBase):
    @model_validator(mode="after")
    def validate_create_dates(self):
        today = datetime.now().date()
        
        # start_date must be >= today (date only)
        if self.start_date and self.start_date.date() < today:
            raise ValueError("Commencement date cannot be in the past")
        
        # end_date must be > start_date
        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValueError("End date must be after start date")
        
        # Auto-calculate calendar_days
        if self.start_date and self.end_date:
            self.calendar_days = (self.end_date.date() - self.start_date.date()).days
        
        # training_days must be > 0 and <= calendar_days
        if self.training_days <= 0:
            raise ValueError("Training days must be greater than 0")
        if self.calendar_days is not None and self.training_days > self.calendar_days:
            raise ValueError("Training days must be between 1 and calendar days")
        
        # total_hours must be > 0
        if self.total_hours <= 0:
            raise ValueError("Total hours must be greater than 0")
        
        # total_enrollments must be >= 1
        if self.total_enrollments < 1:
            raise ValueError("At least 1 candidate required")
        
        # faculty_members array must have at least 1 item
        if not self.faculty_members or len(self.faculty_members) == 0:
            raise ValueError("At least one proposed faculty member required")
        
        # Required role IDs
        if not self.sales_spoc_id:
            raise ValueError("Sales Account SPOC is required")
        if not self.coordinator_id:
            raise ValueError("Operations Coordinator is required")
        if not self.primary_manager_id:
            raise ValueError("Delivery Manager is required")
        
        return self


class BatchApprove(BaseModel):
    approval_id: str = Field(..., min_length=3, max_length=100, description="Financial SOW or Manager Approval Reference")


class ApprovalDecision(BaseModel):
    decision: str = Field(..., pattern="^(approve|reject)$")
    reason: Optional[str] = Field(None, max_length=1000)


class ApprovalConfigurationBase(BaseModel):
    approver_1_id: Optional[UUID] = None
    approver_2_id: Optional[UUID] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_inputs(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return {
                k: (v.strip() if isinstance(v, str) and v.strip() else None if isinstance(v, str) else v)
                for k, v in data.items()
            }
        return data


class ApprovalConfigurationResponse(ApprovalConfigurationBase):
    id: UUID
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BatchLifecycleStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(OnHold|Cancelled|Upcoming|Ongoing|Approved|Requested|Approval 1 Pending|Approval 2 Pending|Resume)$", description="Target lifecycle status")
    reason: str = Field(..., min_length=3, max_length=1000, description="Mandatory reason/justification for status change")


class BatchUpdate(BaseModel):
    sow_number: Optional[str] = None
    approval_id: Optional[str] = None
    category: Optional[str] = None
    entity_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    delivery_mode_id: Optional[UUID] = None
    delivery_mode: Optional[str] = None
    accommodation_id: Optional[UUID] = None
    program_name: Optional[str] = None
    technology: Optional[str] = None
    domain: Optional[str] = None
    client_name: Optional[str] = None
    location_city: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    batch_request_date: Optional[datetime] = None
    training_days: Optional[int] = None
    calendar_days: Optional[int] = None
    total_hours: Optional[Decimal] = None
    total_enrollments: Optional[int] = None
    status: Optional[str] = None
    primary_manager_id: Optional[UUID] = None
    coordinator_id: Optional[UUID] = None
    sales_spoc_id: Optional[UUID] = None
    faculty_assigned_text: Optional[str] = None
    faculty_members: Optional[List[dict]] = None
    finance_status: Optional[str] = Field(None, pattern="^(Pending|Cleared)$")
    finance_status_check_date: Optional[date] = None
    finance_check: Optional[int] = None
    remarks: Optional[str] = None

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
            if "sow_number" in cleaned and cleaned["sow_number"] is not None:
                cleaned["sow_number"] = str(cleaned["sow_number"]).strip()
            # Parse faculty_members if it's a JSON string
            if "faculty_members" in cleaned and isinstance(cleaned["faculty_members"], str):
                try:
                    cleaned["faculty_members"] = json.loads(cleaned["faculty_members"])
                except json.JSONDecodeError:
                    cleaned["faculty_members"] = []
            return cleaned
        return data

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
    batch_avg_feedback: Optional[Decimal] = None
    batch_nps: Optional[Decimal] = None
    nps_total_responses: Optional[int] = None
    nps_promoters: Optional[int] = None
    nps_passives: Optional[int] = None
    nps_detractors: Optional[int] = None
    primary_manager: Optional[UserResponse] = None
    coordinator: Optional[UserResponse] = None
    sales_spoc: Optional[UserResponse] = None
    sessions_conducted: Optional[int] = 0
    completion_rate: Optional[float] = 0.0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BatchDetailResponse(BatchResponse):
    primary_manager: Optional[UserResponse] = None
    coordinator: Optional[UserResponse] = None
    sales_spoc: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Program Type Schemas (Admin-editable options for Faculty Utilization)
# ============================================================================

class ProgramTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    is_active: bool = True


class ProgramTypeCreate(ProgramTypeBase):
    pass


class ProgramTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class ProgramTypeResponse(ProgramTypeBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Active Batches Schemas (for /batches/active endpoint)
# ============================================================================

class ActiveBatchItem(BaseModel):
    id: str
    batch_id: str
    program_name: str
    client_name: Optional[str]
    category: str
    delivery_mode: str
    location_city: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    status: str
    total_enrollments: int
    training_days: int
    sessions_conducted: int
    progress: float  # computed: (sessions_conducted / training_days) * 100

    model_config = ConfigDict(from_attributes=True)


class ActiveSessionItem(BaseModel):
    id: str
    batch_id: str
    batch_name: str
    session_type: Literal["scheduled", "actual"]  # "scheduled" = TrainingSession, "actual" = FacultyUtilization
    sequence_number: Optional[int]
    module: str
    trainer_name: Optional[str]
    faculty_name: Optional[str]
    session_date: str
    start_time: Optional[str]
    end_time: Optional[str]
    duration_hours: float
    status: str
    venue: Optional[str]
    location_city: Optional[str]
    mode_of_delivery: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class ActiveBatchesResponse(BaseModel):
    filter_date: str
    batches: List[ActiveBatchItem]
    sessions: List[ActiveSessionItem]
    total_batches: int
    total_sessions: int
    skip: int
    limit: int

    model_config = ConfigDict(from_attributes=True)