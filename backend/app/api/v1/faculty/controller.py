from typing import List, Optional, Any
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv
from io import StringIO
from datetime import datetime

from app.models.user import User
from app.models.session import FacultyUtilization
from app.schemas.faculty import FacultyResponse, FacultyUtilizationOverview
from app.api.deps import get_current_user, require_manager_or_admin, require_coordinator_or_above
from app.api.deps_services import get_faculty_service
from app.api.v1.faculty.service import FacultyService
from app.core.database import get_db

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


@router.get("/utilization/export")
def export_faculty_utilization_csv(
    domain: Optional[str] = None,
    faculty_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    service: FacultyService = Depends(get_faculty_service),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> StreamingResponse:
    """Export faculty utilization ledger as CSV."""
    query = db.query(FacultyUtilization)
    
    if domain:
        query = query.filter(FacultyUtilization.domain == domain)
    if faculty_type:
        query = query.filter(FacultyUtilization.faculty_type == faculty_type)
    if start_date:
        query = query.filter(FacultyUtilization.date_of_training >= start_date)
    if end_date:
        query = query.filter(FacultyUtilization.date_of_training <= end_date)
    
    records = query.order_by(FacultyUtilization.date_of_training.desc()).all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Faculty Name", "Topic", "Hours", "City", "Venue", "Mode",
        "Status", "Feedback Rating", "Feedback Notes", "Outcome Reason",
        "Outcome At", "Replacement Session ID"
    ])
    
    for r in records:
        writer.writerow([
            r.date_of_training.isoformat() if r.date_of_training else "",
            r.faculty_name,
            r.topic or "",
            float(r.no_of_hours) if r.no_of_hours else "",
            r.location_city or "",
            r.venue or "",
            r.mode_of_delivery or "",
            r.status,
            float(r.feedback_rating) if r.feedback_rating else "",
            r.feedback_notes or "",
            r.outcome_reason or "",
            r.outcome_at.isoformat() if r.outcome_at else "",
            str(r.replacement_session_id) if r.replacement_session_id else ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=faculty-utilization-{datetime.now().strftime('%Y%m%d')}.csv"}
    )
