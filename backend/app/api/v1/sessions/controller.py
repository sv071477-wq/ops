from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status

from app.models.user import User
from app.schemas.feedback import SessionFeedbackCreate
from app.api.deps import get_current_user, require_coordinator_or_above
from app.api.deps_services import get_session_service
from app.api.v1.sessions.service import SessionFeatureService as SessionService
from app.services.notifier import NotificationService

router = APIRouter()


@router.get("")
def list_sessions(
    batch_id: Optional[UUID] = None,
    faculty_name: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    service: SessionService = Depends(get_session_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Master session endpoint (Placeholder active for schema expansion)."""
    return service.list(batch_id, faculty_name, status_filter)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(
    batch_id: UUID,
    topic: str,
    faculty_name: str,
    date_of_training: datetime,
    no_of_hours: Decimal = Decimal("8.0"),
    service: SessionService = Depends(get_session_service),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """Schedule single session endpoint."""
    return service.create(batch_id, topic, faculty_name, date_of_training, no_of_hours)


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
        batch_id=str(id),
        gate_name="Gate 1 (Session Feedback)",
        score=f"{feedback_in.rating}/5.0"
    )

    return result
