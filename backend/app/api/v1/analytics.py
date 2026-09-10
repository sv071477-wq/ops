import io
from typing import Any, List
from decimal import Decimal
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd

from app.core.database import get_db
from app.models.user import User
from app.models.batch import Batch
from app.schemas.analytics import ManagerDashboardSummary, VerticalBreakdown
from app.api.deps import get_current_user, require_manager_or_admin

router = APIRouter()


@router.get("/manager-dashboard", response_model=ManagerDashboardSummary, dependencies=[Depends(require_manager_or_admin)])
def get_manager_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Real-time Manager Analytics Dashboard KPI metrics computed from Batches."""
    total_active = db.query(Batch).filter(Batch.status.in_(["Approved", "Upcoming", "Ongoing"])).count()
    
    # Calculate NPS average directly from Batch records
    nps_records = db.query(Batch.batch_nps).filter(Batch.batch_nps.isnot(None)).all()
    avg_nps = None
    if nps_records:
        avg_nps = Decimal(str(round(sum(float(r[0]) for r in nps_records) / len(nps_records), 2)))

    # Calculate Feedback average directly from Batch records
    feedback_records = db.query(Batch.batch_avg_feedback).filter(Batch.batch_avg_feedback.isnot(None)).all()
    avg_feedback = None
    if feedback_records:
        avg_feedback = Decimal(str(round(sum(float(r[0]) for r in feedback_records) / len(feedback_records), 2)))

    pending_gate2 = db.query(Batch).filter(Batch.status != "Completed").count()

    # Vertical Breakdown
    verticals = ["IT/ITES", "DS/ITES", "BFSI"]
    vertical_stats = []
    for v in verticals:
        v_batches = db.query(Batch).filter(Batch.vertical == v, Batch.status.in_(["Approved", "Upcoming", "Ongoing"])).count()
        v_feedbacks = db.query(Batch.batch_avg_feedback).filter(Batch.vertical == v, Batch.batch_avg_feedback.isnot(None)).all()
        v_avg = Decimal("0.0")
        if v_feedbacks:
            v_avg = Decimal(str(round(sum(float(r[0]) for r in v_feedbacks) / len(v_feedbacks), 2)))

        vertical_stats.append(VerticalBreakdown(
            vertical=v,
            active_batches=v_batches,
            total_hours=Decimal("0.0"),
            average_feedback=v_avg
        ))

    return ManagerDashboardSummary(
        total_active_batches=total_active,
        total_ongoing_sessions=0,
        total_hours_delivered=Decimal("0.0"),
        overall_avg_nps=avg_nps,
        overall_avg_feedback=avg_feedback,
        faculty_utilization_ratio=Decimal("100.0"),
        pending_gate1_feedbacks=0,
        pending_gate2_closures=pending_gate2,
        vertical_distribution=vertical_stats
    )


@router.get("/mbr-export", dependencies=[Depends(require_manager_or_admin)])
def export_mbr_report(db: Session = Depends(get_db)) -> Any:
    """Generates standardized MBR Active Batches Excel report."""
    batches = db.query(Batch).all()
    data = []
    for b in batches:
        data.append({
            "Batch ID": b.batch_id,
            "Approval ID": b.approval_id,
            "Client": b.client_name or "N/A",
            "Entity": b.entity,
            "Vertical": b.vertical,
            "Category": b.category,
            "Program Name": b.program_name,
            "Technology": b.technology,
            "Delivery Mode": b.delivery_mode,
            "Location / City": b.location_city,
            "Status": b.status,
            "Total Enrollments": b.total_enrollments,
            "Training Days": b.training_days,
            "Batch NPS": float(b.batch_nps) if b.batch_nps else None,
            "Batch Avg Feedback": float(b.batch_avg_feedback) if b.batch_avg_feedback else None,
            "Schema Locked": "Yes" if b.is_schema_locked else "No",
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Active Batches")

    output.seek(0)
    headers = {
        "Content-Disposition": "attachment; filename=MBR_Report_Export.xlsx"
    }
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )
