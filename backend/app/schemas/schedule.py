from typing import List, Optional
from uuid import UUID
from datetime import datetime, time
from decimal import Decimal
from pydantic import BaseModel, Field


class ScheduleValidationItem(BaseModel):
    batch_id: str  # Batch identifier string or UUID string
    date_of_training: datetime
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    topic: str
    faculty_id: Optional[UUID] = None
    faculty_name: Optional[str] = None
    no_of_hours: Decimal = Decimal("8.0")
    venue: Optional[str] = None
    location_city: Optional[str] = None
    mode_of_delivery: str = "Online"


class ScheduleValidationRequest(BaseModel):
    items: List[ScheduleValidationItem]


class ConflictDetail(BaseModel):
    faculty_id: UUID
    faculty_name: str
    date_of_training: str
    conflict_type: str  # "DOUBLE_BOOKING", "DAILY_HOURS_EXCEEDED", "FACULTY_BLOCKED"
    message: str
    existing_batch_id: Optional[str] = None
    existing_session_id: Optional[UUID] = None
    requested_hours: Decimal
    existing_hours: Decimal


class ScheduleValidationResponse(BaseModel):
    is_valid: bool
    total_slots: int
    valid_slots: int
    conflict_count: int
    conflicts: List[ConflictDetail] = []


class ExtractedScheduleItem(BaseModel):
    source_sheet: str
    source_row: int
    batch_id: Optional[str] = None
    date_of_training: datetime
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    topic: str
    faculty_name: Optional[str] = None
    no_of_hours: Decimal = Field(default=Decimal("8.0"), gt=Decimal("0.0"), le=Decimal("24.0"))
    venue: Optional[str] = None
    location_city: Optional[str] = None
    mode_of_delivery: str = "Online"


class ScheduleExtractionError(BaseModel):
    source_sheet: str
    source_row: int
    message: str


class ScheduleIngestResponse(BaseModel):
    success: bool
    message: str
    filename: str
    sheets_processed: List[str]
    total_rows: int
    extracted_rows: int
    failed_rows: int
    items: List[ExtractedScheduleItem] = []
    errors: List[ScheduleExtractionError] = []
