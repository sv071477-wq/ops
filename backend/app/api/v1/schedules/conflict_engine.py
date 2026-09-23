from typing import List, Optional
from uuid import UUID
from datetime import datetime, time, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from app.schemas.schedule import ConflictDetail
from app.models.session import FacultyUtilization
from app.models.batch import Batch
from app.models.user import User


class ConflictEngine:
    MAX_DAILY_FACULTY_HOURS = Decimal("8.0")

    @classmethod
    def check_session_conflict(
        cls,
        db: Session,
        faculty_name: str,
        date_of_training: datetime,
        requested_hours: Decimal,
        existing_hours: Decimal = Decimal("0.0"),
        start_time: Optional[time] = None,
        end_time: Optional[time] = None,
        faculty_id: Optional[UUID] = None,
    ) -> List[ConflictDetail]:
        """
        Validates whether assigning a faculty to a session creates double-booking or exceeds daily capacity.
        Queries existing sessions in the database and checks interval overlaps.
        """
        conflicts: List[ConflictDetail] = []
        target_date_str = date_of_training.strftime("%Y-%m-%d") if isinstance(date_of_training, datetime) else str(date_of_training)

        resolved_faculty_id = faculty_id
        sessions_on_date = []

        if db is not None:
            try:
                start_of_day = date_of_training.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = start_of_day + timedelta(days=1)
                query = db.query(FacultyUtilization).join(
                    Batch, Batch.id == FacultyUtilization.batch_id
                ).filter(
                    FacultyUtilization.date_of_training >= start_of_day,
                    FacultyUtilization.date_of_training < end_of_day,
                    FacultyUtilization.status.notin_(["Cancelled"]),
                    Batch.status != "Cancelled",
                )
                if faculty_name and faculty_name.strip():
                    query = query.filter(FacultyUtilization.faculty_name.ilike(faculty_name.strip()))
                sessions_on_date = query.all()
                db_hours = sum((s.no_of_hours for s in sessions_on_date), Decimal("0"))
                existing_hours = max(existing_hours, db_hours)
            except Exception:
                pass

        # 1. Check daily capacity exceeded
        if existing_hours + requested_hours > cls.MAX_DAILY_FACULTY_HOURS:
            msg = (
                f"Faculty '{faculty_name}' will exceed max daily capacity ({cls.MAX_DAILY_FACULTY_HOURS}h). "
                f"Attempted to allocate {existing_hours + requested_hours}h on {target_date_str}."
            )
            conflicts.append(ConflictDetail(
                faculty_id=resolved_faculty_id,
                faculty_name=faculty_name,
                date_of_training=target_date_str,
                date=target_date_str,
                conflict_type="DAILY_HOURS_EXCEEDED",
                message=msg,
                reason=msg,
                requested_hours=requested_hours,
                existing_hours=existing_hours
            ))

        # 2. Check time interval collision
        if start_time and end_time and sessions_on_date:
            for s in sessions_on_date:
                if s.start_time and s.end_time:
                    if s.start_time < end_time and s.end_time > start_time:
                        overlap_msg = (
                            f"Double-booking conflict: Faculty '{faculty_name}' is already booked from "
                            f"{s.start_time.strftime('%H:%M')} to {s.end_time.strftime('%H:%M')} on {target_date_str}."
                        )
                        conflicts.append(ConflictDetail(
                            faculty_id=resolved_faculty_id,
                            faculty_name=faculty_name,
                            date_of_training=target_date_str,
                            date=target_date_str,
                            conflict_type="DOUBLE_BOOKING",
                            message=overlap_msg,
                            reason=overlap_msg,
                            existing_session_id=s.id,
                            existing_batch_id=str(s.batch_id),
                            requested_hours=requested_hours,
                            existing_hours=existing_hours
                        ))

        return conflicts
