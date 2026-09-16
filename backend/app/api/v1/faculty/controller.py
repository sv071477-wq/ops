from typing import List, Optional, Any
from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.faculty import FacultyResponse, FacultyUtilizationOverview
from app.api.deps import get_current_user, require_manager_or_admin, require_coordinator_or_above
from app.api.deps_services import get_faculty_service
from app.api.v1.faculty.service import FacultyService

router = APIRouter()


@router.get("", response_model=List[FacultyResponse])
def list_faculty(
    faculty_type: Optional[str] = None,
    domain: Optional[str] = None,
    service: FacultyService = Depends(get_faculty_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Faculty directory endpoint."""
    return service.list(faculty_type, domain)


@router.get("/utilization", response_model=FacultyUtilizationOverview, dependencies=[Depends(require_coordinator_or_above)])
def get_faculty_utilization(
    service: FacultyService = Depends(get_faculty_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Real-time utilization calculation endpoint."""
    return service.utilization()
