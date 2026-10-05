from typing import List, Optional, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status

from app.models.user import User
from app.schemas.schedule import (
    ScheduleValidationRequest, ScheduleValidationResponse,
    ScheduleIngestResponse, ConflictDetail, ScheduleApplyRequest, ScheduleApplyResponse
)
from app.api.deps import get_current_user, require_coordinator_or_above
from app.api.deps_services import (
    get_excel_ingestion_service,
    get_schedule_repository,
    get_session_repository,
    get_user_repository,
)
from app.api.v1.auth.repository_interfaces import IUserRepository
from app.api.v1.schedules.conflict_engine import ConflictEngine
from app.api.v1.schedules.repository_interfaces import IScheduleRepository
from app.api.v1.schedules.service import ExcelIngestionService
from app.api.v1.sessions.repository_interfaces import ISessionRepository

router = APIRouter()

# File upload limits
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_SCHEDULE_EXTENSIONS = {".xlsx", ".xls", ".csv"}

async def validate_upload_file(file: UploadFile, max_size: int = MAX_UPLOAD_SIZE, allowed_extensions: set | None = None) -> bytes:
    """Validate uploaded file size and extension, return file contents."""
    if allowed_extensions:
        filename = file.filename or ""
        if not any(filename.lower().endswith(ext) for ext in allowed_extensions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File must be one of: {', '.join(sorted(allowed_extensions))}"
            )
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {max_size // (1024*1024)} MB"
        )
    return content


@router.post("/validate", response_model=ScheduleValidationResponse)
def validate_schedule_slots(
    payload: ScheduleValidationRequest,
    session_repo: ISessionRepository = Depends(get_session_repository),
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
            session_repo=session_repo,
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
    file_bytes = await validate_upload_file(file, allowed_extensions=ALLOWED_SCHEDULE_EXTENSIONS)
    filename = file.filename or "uploaded_schedule"
    result = service.ingest_schedule_file(
        file_contents=file_bytes,
        filename=filename,
        target_batch_id=target_batch_id
    )

    return result


@router.post("/apply", response_model=ScheduleApplyResponse)
def apply_schedule(
    payload: ScheduleApplyRequest,
    schedule_repo: IScheduleRepository = Depends(get_schedule_repository),
    user_repo: IUserRepository = Depends(get_user_repository),
    session_repo: ISessionRepository = Depends(get_session_repository),
    current_user: User = Depends(require_coordinator_or_above),
) -> ScheduleApplyResponse:
    """Validate and persist the complete extracted schedule atomically."""
    return ExcelIngestionService.apply_schedule_items(
        schedule_repo=schedule_repo,
        user_repo=user_repo,
        target_batch_id=payload.target_batch_id,
        items=payload.items,
        source_filename=payload.source_filename,
        user_id=current_user.id,
        conflict_repo=session_repo,
    )