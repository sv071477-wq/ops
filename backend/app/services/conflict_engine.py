from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from app.schemas.schedule import ConflictDetail


class ConflictEngine:
    MAX_DAILY_FACULTY_HOURS = Decimal("8.0")

    @classmethod
    def check_session_conflict(
        cls,
        db: Session,
        faculty_name: str,
        date_of_training: datetime,
        requested_hours: Decimal,
        existing_hours: Decimal = Decimal("0.0")
    ) -> List[ConflictDetail]:
        """
        Validates whether assigning a faculty to a session creates double-booking or exceeds daily capacity.
        """
        conflicts: List[ConflictDetail] = []
        
        target_date_str = date_of_training.strftime("%Y-%m-%d") if isinstance(date_of_training, datetime) else str(date_of_training)

        if existing_hours + requested_hours > cls.MAX_DAILY_FACULTY_HOURS:
            conflicts.append(ConflictDetail(
                faculty_id=UUID("00000000-0000-0000-0000-000000000000"),
                faculty_name=faculty_name,
                date_of_training=target_date_str,
                conflict_type="DAILY_HOURS_EXCEEDED",
                message=(
                    f"Faculty '{faculty_name}' will exceed max daily capacity ({cls.MAX_DAILY_FACULTY_HOURS}h). "
                    f"Attempted to allocate {existing_hours + requested_hours}h on {target_date_str}."
                ),
                requested_hours=requested_hours,
                existing_hours=existing_hours
            ))

        return conflicts
