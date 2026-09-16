from typing import Any, List, Optional
from uuid import UUID
from datetime import datetime, time
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator


class ScheduleValidationItem(BaseModel):
    batch_id: Optional[str] = None  # Batch identifier string or UUID string
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
    faculty_id: Optional[UUID] = None
    faculty_name: str
    date_of_training: str
    date: Optional[str] = None
    conflict_type: str  # "DOUBLE_BOOKING", "DAILY_HOURS_EXCEEDED", "FACULTY_BLOCKED"
    message: str
    reason: Optional[str] = None
    existing_batch_id: Optional[str] = None
    existing_session_id: Optional[UUID] = None
    requested_hours: Decimal
    existing_hours: Decimal

    @model_validator(mode="before")
    @classmethod
    def sync_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "date_of_training" in data and not data.get("date"):
                data["date"] = str(data["date_of_training"])
            elif "date" in data and not data.get("date_of_training"):
                data["date_of_training"] = str(data["date"])
            if "message" in data and not data.get("reason"):
                data["reason"] = str(data["message"])
            elif "reason" in data and not data.get("message"):
                data["message"] = str(data["reason"])
        return data


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
    success: bool = True
    message: str = "Ingestion successful"
    filename: str = ""
    source_filename: Optional[str] = None
    sheets_processed: List[str] = []
    total_rows: int = 0
    total_rows_parsed: Optional[int] = None
    extracted_rows: int = 0
    failed_rows: int = 0
    items: List[ExtractedScheduleItem] = []
    extracted_schedule: List[ExtractedScheduleItem] = []
    errors: List[ScheduleExtractionError] = []

    @model_validator(mode="before")
    @classmethod
    def sync_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("source_filename") and data.get("filename"):
                data["source_filename"] = data["filename"]
            elif not data.get("filename") and data.get("source_filename"):
                data["filename"] = data["source_filename"]
            if data.get("total_rows_parsed") is None and data.get("total_rows") is not None:
                data["total_rows_parsed"] = data["total_rows"]
            elif data.get("total_rows") == 0 and data.get("total_rows_parsed") is not None:
                data["total_rows"] = data["total_rows_parsed"]
            if not data.get("extracted_schedule") and data.get("items"):
                data["extracted_schedule"] = data["items"]
            elif not data.get("items") and data.get("extracted_schedule"):
                data["items"] = data["extracted_schedule"]
        return data
