from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal

from app.schemas.schedule import ConflictDetail
from app.api.v1.sessions.repository_interfaces import ISessionRepository


class ConflictEngine:
    MAX_DAILY_FACULTY_HOURS = Decimal("8.0")

    @classmethod
    def check_session_conflict(
        cls,
        session_repo: Optional[ISessionRepository],
        faculty_name: str,
        date_of_training: datetime,
        requested_hours: Decimal,
        existing_hours: Decimal = Decimal("0.0"),
        start_time=None,
        end_time=None,
        faculty_id: Optional[UUID] = None,
    ) -> List[ConflictDetail]:
        """
        Validates whether assigning a faculty to a session creates double-booking or exceeds daily capacity.
        Reads existing deliveries and checks interval overlaps.
        """
        conflicts: List[ConflictDetail] = []

        # Normalize to date for comparison (handles timezone-aware datetimes correctly)
        if isinstance(date_of_training, datetime):
            target_date = date_of_training.date()
            target_date_str = target_date.isoformat()
        else:
            target_date = date_of_training
            target_date_str = str(target_date)

        resolved_faculty_id = faculty_id
        sessions_on_date = []

        if session_repo is not None:
            try:
                sessions_on_date = session_repo.list_conflict_window_deliveries(faculty_name, target_date)
                db_hours = session_repo.sum_hours(sessions_on_date)
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