from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends

from app.api.deps import require_admin
from app.api.deps_services import get_fms_sync_service
from app.api.v1.fms_sync.service import FmsSyncService

router = APIRouter()


@router.post("/sync", dependencies=[Depends(require_admin)])
def sync_faculty_to_fms(
    faculty_id: str,
    event_type: str = "HOURS_UPDATE",
    service: FmsSyncService = Depends(get_fms_sync_service)
) -> Any:
    """Dispatches payload to external FMS."""
    return service.sync(faculty_id, event_type)


@router.get("/logs", dependencies=[Depends(require_admin)])
def list_fms_sync_logs(
    skip: int = 0,
    limit: int = 50,
    service: FmsSyncService = Depends(get_fms_sync_service)
) -> Any:
    """Retrieve history of FMS integration sync dispatches."""
    return service.list_logs(skip, limit)
