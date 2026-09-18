import io
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional

import pandas as pd
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, cast, Date
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.session import TrainingSession
from app.models.user import User, UserManagerMapping
from app.schemas.analytics import ManagerDashboardSummary, VerticalBreakdown


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _average(values) -> Decimal | None:
        if not values:
            return None
        valid_floats = []
        for v in values:
            val = v[0] if isinstance(v, (tuple, list)) else v
            if val is not None:
                try:
                    valid_floats.append(float(val))
                except (ValueError, TypeError):
                    pass
        if not valid_floats:
            return None
        return Decimal(str(round(sum(valid_floats) / len(valid_floats), 2)))

    def _get_scoped_batch_ids(self, current_user: Optional[User]) -> Optional[list]:
        """Returns a list of batch IDs scoped to the manager, or None if admin/unrestricted."""
        if not current_user or current_user.role.lower() == "admin":
            return None

        # Manager scoping
        direct_coord_ids = set()
        # Direct reports via User.manager_id
        for u in self.db.query(User.id).filter(User.manager_id == current_user.id).all():
            direct_coord_ids.add(u[0])
        # Direct reports via UserManagerMapping
        for m in self.db.query(UserManagerMapping.coordinator_id).filter(UserManagerMapping.manager_id == current_user.id).all():
            direct_coord_ids.add(m[0])

        batch_filters = [
            Batch.primary_manager_id == current_user.id,
            Batch.approver_1_id == current_user.id,
            Batch.approver_2_id == current_user.id,
        ]
        if direct_coord_ids:
            batch_filters.append(Batch.coordinator_id.in_(list(direct_coord_ids)))

        scoped_batches = self.db.query(Batch.id).filter(or_(*batch_filters)).all()
        scoped_ids = [b[0] for b in scoped_batches]

        # If manager has no directly assigned batches yet, default to all visible batches for a seamless demo
        if not scoped_ids:
            return None
        return scoped_ids

    def manager_dashboard(self, current_user: Optional[User] = None) -> ManagerDashboardSummary:
        scoped_ids = self._get_scoped_batch_ids(current_user)

        base_batch_query = self.db.query(Batch)
        if scoped_ids is not None:
            base_batch_query = base_batch_query.filter(Batch.id.in_(scoped_ids))

        active_statuses = ["Approved", "Upcoming", "Ongoing"]
        total_active = base_batch_query.filter(Batch.status.in_(active_statuses)).count()

        # Avg NPS and Feedback
        nps_vals = base_batch_query.filter(Batch.batch_nps.isnot(None)).with_entities(Batch.batch_nps).all()
        avg_nps = self._average(nps_vals)

        feedback_vals = base_batch_query.filter(Batch.batch_avg_feedback.isnot(None)).with_entities(Batch.batch_avg_feedback).all()
        avg_feedback = self._average(feedback_vals)

        # Gate 2 closures pending (batches not yet completed, or completed without NPS)
        now_utc = datetime.now(timezone.utc)
        pending_gate2 = base_batch_query.filter(
            Batch.status.in_(active_statuses),
            or_(Batch.batch_nps.is_(None), Batch.status == "Ongoing")
        ).count()

        # Sessions query scoped to batches
        session_query = self.db.query(TrainingSession)
        if scoped_ids is not None:
            session_query = session_query.filter(TrainingSession.batch_id.in_(scoped_ids))

        # Real ongoing sessions
        today = date.today()
        total_ongoing_sessions = session_query.filter(
            or_(
                TrainingSession.status == "InProgress",
                and_filter := (
                    TrainingSession.status != "Cancelled",
                    cast(TrainingSession.date_of_training, Date) == today
                )
            )
        ).count()

        # Total hours delivered from completed sessions
        delivered_hours_sum = session_query.filter(
            TrainingSession.status == "Completed"
        ).with_entities(func.sum(TrainingSession.no_of_hours)).scalar()

        if delivered_hours_sum is not None:
            total_hours_delivered = Decimal(str(round(float(delivered_hours_sum), 2)))
        else:
            # Fallback: sum total_hours from Completed batches
            completed_batch_hours = base_batch_query.filter(
                Batch.status == "Completed"
            ).with_entities(func.sum(Batch.total_hours)).scalar()
            total_hours_delivered = Decimal(str(round(float(completed_batch_hours or 0.0), 2)))

        # Pending Gate 1 Feedbacks (sessions completed or past date without rating)
        pending_gate1 = session_query.filter(
            or_(
                TrainingSession.status == "Completed",
                TrainingSession.date_of_training <= now_utc
            ),
            TrainingSession.status != "Cancelled",
            or_(
                TrainingSession.feedback_rating.is_(None),
                TrainingSession.feedback_submitted == False
            )
        ).count()

        # Faculty utilization ratio: deployed faculty / total faculty count
        total_fac_count = self.db.query(User).filter(
            User.role == "Faculty",
            User.is_active == True
        ).count()

        deployed_fac_count = self.db.query(TrainingSession.faculty_name).filter(
            TrainingSession.status.in_(["Scheduled", "InProgress", "Completed"])
        ).distinct().count()

        if total_fac_count > 0:
            util_ratio = Decimal(str(round((min(deployed_fac_count, total_fac_count) / total_fac_count) * 100, 1)))
        else:
            util_ratio = Decimal("0.0")

        # Dynamic vertical breakdown from distinct domains in DB
        distinct_domains = base_batch_query.filter(
            Batch.domain.isnot(None),
            Batch.domain != ""
        ).with_entities(Batch.domain).distinct().all()

        domain_names = [d[0] for d in distinct_domains if d[0]]
        if not domain_names:
            domain_names = ["IT/ITES", "Cloud", "DS/ML", "BFSI"]

        verticals = []
        for domain_name in domain_names:
            d_query = base_batch_query.filter(Batch.domain == domain_name)
            d_active = d_query.filter(Batch.status.in_(active_statuses)).count()
            d_hours = d_query.with_entities(func.sum(Batch.total_hours)).scalar() or 0.0
            d_feedbacks = d_query.filter(Batch.batch_avg_feedback.isnot(None)).with_entities(Batch.batch_avg_feedback).all()

            verticals.append(VerticalBreakdown(
                vertical=domain_name,
                active_batches=d_active,
                total_hours=Decimal(str(round(float(d_hours), 2))),
                average_feedback=self._average(d_feedbacks) or Decimal("0.0"),
            ))

        # Sort verticals by active batches descending
        verticals.sort(key=lambda x: x.active_batches, reverse=True)

        return ManagerDashboardSummary(
            total_active_batches=total_active,
            total_ongoing_sessions=total_ongoing_sessions,
            total_hours_delivered=total_hours_delivered,
            overall_avg_nps=avg_nps,
            overall_avg_feedback=avg_feedback,
            faculty_utilization_ratio=util_ratio,
            pending_gate1_feedbacks=pending_gate1,
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
            "Delivery Mode": batch.delivery_mode_detail.name if batch.delivery_mode_detail else None,
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