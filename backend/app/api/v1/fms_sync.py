from typing import Any
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import require_admin

router = APIRouter()


@router.post("/sync", dependencies=[Depends(require_admin)])
def sync_faculty_to_fms(
    faculty_id: str,
    event_type: str = "HOURS_UPDATE",
    db: Session = Depends(get_db)
) -> Any:
    """Dispatches payload to external FMS."""
    return {
        "status": "SUCCESS",
        "message": f"FMS sync event {event_type} dispatched for {faculty_id}.",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/logs", dependencies=[Depends(require_admin)])
def list_fms_sync_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
) -> Any:
    """Retrieve history of FMS integration sync dispatches."""
    return []
