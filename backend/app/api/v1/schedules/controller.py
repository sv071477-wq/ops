from typing import List, Optional, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.batch import Batch
from app.schemas.schedule import (
    ScheduleValidationRequest, ScheduleValidationResponse,
    ScheduleIngestResponse, ConflictDetail
)
from app.api.deps import get_current_user, require_coordinator_or_above
from app.api.v1.schedules.conflict_engine import ConflictEngine
from app.api.v1.schedules.service import ExcelIngestionService
from app.api.deps_services import get_excel_ingestion_service

router = APIRouter()


@router.post("/validate", response_model=ScheduleValidationResponse)
def validate_schedule_slots(
    payload: ScheduleValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """Dry-run validation of schedule slots against faculty availability and capacity limits."""
    from decimal import Decimal
    conflicts: List[ConflictDetail] = []
    valid_count = 0
    running_hours: dict = {}

    for item in payload.items:
        fac_name = item.faculty_name or "Assigned Faculty"
        date_key = item.date_of_training.strftime("%Y-%m-%d") if item.date_of_training else ""
        key = (fac_name.strip().lower(), date_key)
        prior_hours = running_hours.get(key, Decimal("0.0"))

        item_conflicts = ConflictEngine.check_session_conflict(
            db=db,
            faculty_name=fac_name,
            date_of_training=item.date_of_training,
            requested_hours=item.no_of_hours,
            existing_hours=prior_hours,
            start_time=item.start_time,
            end_time=item.end_time,
            faculty_id=item.faculty_id,
        )

        running_hours[key] = prior_hours + item.no_of_hours

        if item_conflicts:
            conflicts.extend(item_conflicts)
        else:
            valid_count += 1

    return ScheduleValidationResponse(
        is_valid=len(conflicts) == 0,
        total_slots=len(payload.items),
        valid_slots=valid_count,
        conflict_count=len(conflicts),
        conflicts=conflicts
    )


@router.post("/ingest", response_model=ScheduleIngestResponse)
async def ingest_timetable_file(
    file: UploadFile = File(...),
    target_batch_id: Optional[str] = Form(None),
    current_user: User = Depends(require_coordinator_or_above),
    service: ExcelIngestionService = Depends(get_excel_ingestion_service)
) -> Any:
    """Workflow 2: Extract timetable rows from Excel or CSV without persistence."""
    filename = file.filename or "uploaded_schedule"
    if not filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel (.xlsx, .xls) or CSV spreadsheet."
        )

    file_bytes = await file.read()
    result = service.ingest_schedule_file(
        file_contents=file_bytes,
        filename=filename,
        target_batch_id=target_batch_id
    )

    return result
