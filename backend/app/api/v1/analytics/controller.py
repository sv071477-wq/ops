from typing import Any
from fastapi import APIRouter, Depends
from app.models.user import User
from app.schemas.analytics import ManagerDashboardSummary
from app.api.deps import get_current_user, require_manager_or_admin
from app.api.deps_services import get_analytics_service
from app.api.v1.analytics.service import AnalyticsService

router = APIRouter()


@router.get("/manager-dashboard", response_model=ManagerDashboardSummary, dependencies=[Depends(require_manager_or_admin)])
def get_manager_dashboard(
    service: AnalyticsService = Depends(get_analytics_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    return service.manager_dashboard(current_user=current_user)


@router.get("/mbr-export", dependencies=[Depends(require_manager_or_admin)])
def export_mbr_report(service: AnalyticsService = Depends(get_analytics_service)) -> Any:
    return service.export_mbr()
