import io
from decimal import Decimal

import pandas as pd
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.schemas.analytics import ManagerDashboardSummary, VerticalBreakdown


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _average(values) -> Decimal | None:
        if not values:
            return None
        return Decimal(str(round(sum(float(value[0]) for value in values) / len(values), 2)))

    def manager_dashboard(self) -> ManagerDashboardSummary:
        active_statuses = ["Approved", "Upcoming", "Ongoing"]
        total_active = self.db.query(Batch).filter(Batch.status.in_(active_statuses)).count()
        avg_nps = self._average(self.db.query(Batch.batch_nps).filter(Batch.batch_nps.isnot(None)).all())
        avg_feedback = self._average(self.db.query(Batch.batch_avg_feedback).filter(Batch.batch_avg_feedback.isnot(None)).all())
        pending_gate2 = self.db.query(Batch).filter(Batch.status != "Completed").count()

        verticals = []
        for vertical in ["IT/ITES", "DS/ITES", "BFSI"]:
            query = self.db.query(Batch).filter(Batch.domain == vertical, Batch.status.in_(active_statuses))
            feedbacks = self.db.query(Batch.batch_avg_feedback).filter(Batch.domain == vertical, Batch.batch_avg_feedback.isnot(None)).all()
            verticals.append(VerticalBreakdown(
                vertical=vertical,
                active_batches=query.count(),
                total_hours=Decimal("0.0"),
                average_feedback=self._average(feedbacks) or Decimal("0.0"),
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
            vertical_distribution=verticals,
        )

    def export_mbr(self) -> StreamingResponse:
        data = [{
            "Batch ID": batch.batch_id,
            "Approval ID": batch.approval_id,
            "Client": batch.client_name or "N/A",
            "Category": batch.category,
            "Program Name": batch.program_name,
            "Technology": batch.technology,
            "Delivery Mode": batch.delivery_mode,
            "Location / City": batch.location_city,
            "Status": batch.status,
            "Total Enrollments": batch.total_enrollments,
            "Training Days": batch.training_days,
            "Batch NPS": float(batch.batch_nps) if batch.batch_nps else None,
            "Batch Avg Feedback": float(batch.batch_avg_feedback) if batch.batch_avg_feedback else None,
            "Schema Locked": "Yes" if batch.is_schema_locked else "No",
        } for batch in self.db.query(Batch).all()]
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            pd.DataFrame(data).to_excel(writer, index=False, sheet_name="Active Batches")
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=MBR_Report_Export.xlsx"},
        )