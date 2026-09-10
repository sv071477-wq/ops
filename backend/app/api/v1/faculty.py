from typing import List, Optional, Any
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.api.deps import get_current_user, require_manager_or_admin, require_coordinator_or_above

router = APIRouter()


@router.get("")
def list_faculty(
    faculty_type: Optional[str] = None,
    domain: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Faculty directory endpoint (Active endpoint for future expansion)."""
    return []


@router.get("/utilization", dependencies=[Depends(require_coordinator_or_above)])
def get_faculty_utilization(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Real-time utilization calculation endpoint."""
    return []
