from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status

from app.models.user import User
from app.schemas.feedback import SessionFeedbackCreate
from app.schemas.session import (
    SessionCreate, SessionUpdate, SessionDetailResponse,
    SessionOutcomeRequest, SessionRescheduleRequest, TrainingSessionResponse
)
from app.api.deps import get_current_user, require_coordinator_or_above
from app.api.deps_services import get_session_service
from app.api.v1.sessions.service import SessionService
from app.api.v1.notifications.service import NotificationService

router = APIRouter()


@router.get("/scheduled", response_model=List[TrainingSessionResponse])
def list_scheduled_sessions(
    batch_id: UUID,
    service: SessionService = Depends(get_session_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Lists the ingested curriculum training schedule days for a batch."""
    return service.list_scheduled(batch_id, current_user.id)


@router.get("", response_model=List[SessionDetailResponse])
def list_sessions(
    batch_id: Optional[UUID] = None,
    faculty_name: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    service: SessionService = Depends(get_session_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Master session endpoint (Placeholder active for schema expansion)."""
    return service.list(batch_id, faculty_name, status_filter, current_user.id)


@router.post("", response_model=SessionDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_in: SessionCreate,
    service: SessionService = Depends(get_session_service),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """Schedule single session endpoint."""
    result = service.create(session_in, current_user.id)
    await NotificationService.notify_session_scheduled(
        faculty_name=result.faculty_name,
        faculty_email=None,
        date_str=result.date_of_training.isoformat(),
        topic=result.topic,
    )
    return result


@router.patch("/{id}", response_model=SessionDetailResponse)
def update_session(
    id: UUID,
    session_in: SessionUpdate,
    service: SessionService = Depends(get_session_service),
    current_user: User = Depends(require_coordinator_or_above),
) -> Any:
    return service.update(id, session_in, current_user.id)


@router.post("/{id}/cancel", response_model=SessionDetailResponse)
def cancel_session(
    id: UUID,
    request: SessionOutcomeRequest,
    service: SessionService = Depends(get_session_service),
    current_user: User = Depends(require_coordinator_or_above),
) -> Any:
    return service.cancel(id, request, current_user.id)


@router.post("/{id}/not-conducted", response_model=SessionDetailResponse)
def mark_session_not_conducted(
    id: UUID,
    request: SessionOutcomeRequest,
    service: SessionService = Depends(get_session_service),
    current_user: User = Depends(require_coordinator_or_above),
) -> Any:
    return service.mark_not_conducted(id, request, current_user.id)


@router.post("/{id}/reschedule", response_model=SessionDetailResponse)
def reschedule_session(
    id: UUID,
    request: SessionRescheduleRequest,
    service: SessionService = Depends(get_session_service),
    current_user: User = Depends(require_coordinator_or_above),
) -> Any:
    return service.reschedule(id, request, current_user.id)


@router.patch("/{id}/complete")
async def complete_session_gate1(
    id: str,
    feedback_in: SessionFeedbackCreate,
    service: SessionService = Depends(get_session_service),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """Quality Checkpoint 1 Gate."""
    result = service.complete_gate1(id, feedback_in, current_user.id)

    await NotificationService.notify_gate_completion(
        batch_id=str(result.get("batch_id") or id),
        gate_name="Gate 1 (Session Feedback)",
        score=f"{feedback_in.rating}/5.0"
    )

    return result
