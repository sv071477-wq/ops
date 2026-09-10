from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.batch import Batch
from app.schemas.feedback import SessionFeedbackCreate
from app.api.deps import get_current_user, require_coordinator_or_above
from app.services.gatekeeper import GatekeeperService
from app.services.notifier import NotificationService

router = APIRouter()


@router.get("")
def list_sessions(
    batch_id: Optional[UUID] = None,
    faculty_name: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Master session endpoint (Placeholder active for schema expansion)."""
    return []


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(
    batch_id: UUID,
    topic: str,
    faculty_name: str,
    date_of_training: datetime,
    no_of_hours: Decimal = Decimal("8.0"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """Schedule single session endpoint."""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    return {
        "status": "Scheduled",
        "batch_id": str(batch.id),
        "topic": topic,
        "faculty_name": faculty_name,
        "date_of_training": date_of_training.isoformat(),
        "no_of_hours": float(no_of_hours)
    }


@router.patch("/{id}/complete")
async def complete_session_gate1(
    id: str,
    feedback_in: SessionFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """Quality Checkpoint 1 Gate."""
    result = GatekeeperService.complete_session_gate1(
        db=db,
        session_id=id,
        feedback_data=feedback_in,
        user_id=current_user.id
    )

    await NotificationService.notify_gate_completion(
        batch_id=str(id),
        gate_name="Gate 1 (Session Feedback)",
        score=f"{feedback_in.rating}/5.0"
    )

    return result
