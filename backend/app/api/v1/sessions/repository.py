from datetime import datetime, time, timedelta
from decimal import Decimal
from typing import List, Optional, Sequence
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.batch import Batch
from app.models.session import FacultyUtilization, TrainingSession
from app.models.user import User
from app.api.v1.sessions.repository_interfaces import ISessionRepository


class SessionRepository(ISessionRepository):
    def __init__(self, db: Session):
        self.db = db

    # --- Batch context ---
    def get_batch_by_id(self, batch_id: UUID) -> Optional[Batch]:
        return self.db.query(Batch).filter(Batch.id == batch_id).first()

    def list_all_sessions_for_batch(self, batch_id: UUID) -> List[object]:
        scheduled = self.db.query(TrainingSession).filter(TrainingSession.batch_id == batch_id).all()
        actual = self.db.query(FacultyUtilization).filter(FacultyUtilization.batch_id == batch_id).all()
        return list(scheduled) + list(actual)

    # --- Timetable ---
    def list_scheduled_for_batch(self, batch_id: UUID) -> List[TrainingSession]:
        return self.db.query(TrainingSession).filter(
            TrainingSession.batch_id == batch_id
        ).order_by(TrainingSession.session_date.asc(), TrainingSession.sequence_number.asc()).all()

    def get_scheduled_by_id(self, session_id: UUID) -> Optional[TrainingSession]:
        return self.db.query(TrainingSession).filter(TrainingSession.id == session_id).first()

    def get_max_sequence_number(self, batch_id: UUID) -> Optional[int]:
        row = self.db.query(TrainingSession.sequence_number).filter(
            TrainingSession.batch_id == batch_id
        ).order_by(TrainingSession.sequence_number.desc()).first()
        return row[0] if row else None

    def create_scheduled(self, session: TrainingSession) -> TrainingSession:
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    # --- Delivery ledger ---
    def list_utilizations(
        self,
        batch_id: Optional[UUID] = None,
        faculty_name: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> List[FacultyUtilization]:
        query = self.db.query(FacultyUtilization).options(
            joinedload(FacultyUtilization.batch).joinedload(Batch.entity),
            joinedload(FacultyUtilization.batch).joinedload(Batch.coordinator)
        ).join(Batch, FacultyUtilization.batch_id == Batch.id)
        if batch_id:
            query = query.filter(FacultyUtilization.batch_id == batch_id)
        if faculty_name:
            query = query.filter(FacultyUtilization.faculty_name.ilike(f"%{faculty_name}%"))
        if status_filter:
            query = query.filter(FacultyUtilization.status == status_filter)
        return query.order_by(FacultyUtilization.date_of_training.asc()).all()

    def list_utilizations_for_batch(self, batch_id: UUID) -> List[FacultyUtilization]:
        return self.db.query(FacultyUtilization).filter(
            FacultyUtilization.batch_id == batch_id
        ).all()

    def get_utilization_by_id(self, session_id: UUID) -> Optional[FacultyUtilization]:
        return self.db.query(FacultyUtilization).filter(FacultyUtilization.id == session_id).first()

    def create_utilization(self, session: FacultyUtilization) -> FacultyUtilization:
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_training_session_by_id(self, session_id: UUID) -> Optional[TrainingSession]:
        return self.db.query(TrainingSession).filter(TrainingSession.id == session_id).first()

    # --- Faculty resolution and daily capacity ---
    def get_active_user(self, user_id: UUID) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()

    def find_active_faculty_by_name(self, name: str, faculty_role_only: bool = False) -> Optional[User]:
        query = self.db.query(User).filter(
            User.full_name.ilike(name),
            User.is_active.is_(True),
        )
        if faculty_role_only:
            query = query.filter(User.role.ilike("faculty"))
        return query.first()

    def list_daily_deliveries(
        self,
        faculty_name: str,
        day_start: datetime,
        day_end: datetime,
        exclude_id: Optional[UUID] = None,
        excluded_statuses: Sequence[str] = ("Cancelled",),
    ) -> List[FacultyUtilization]:
        query = self.db.query(FacultyUtilization).filter(
            FacultyUtilization.faculty_name.ilike(faculty_name),
            FacultyUtilization.date_of_training >= day_start,
            FacultyUtilization.date_of_training < day_end,
            FacultyUtilization.status.notin_(list(excluded_statuses)),
        )
        if exclude_id:
            query = query.filter(FacultyUtilization.id != exclude_id)
        return query.all()

    def list_conflict_window_deliveries(self, faculty_name: str, target_date) -> List[FacultyUtilization]:
        # Use date() for comparison to avoid timezone/DST issues
        start_of_day = datetime.combine(target_date, time.min)
        end_of_day = start_of_day + timedelta(days=1)
        query = self.db.query(FacultyUtilization).join(
            Batch, Batch.id == FacultyUtilization.batch_id
        ).filter(
            FacultyUtilization.date_of_training >= start_of_day,
            FacultyUtilization.date_of_training < end_of_day,
            FacultyUtilization.status.notin_(["Cancelled"]),
            Batch.status != "Cancelled",
        )
        if faculty_name and faculty_name.strip():
            query = query.filter(FacultyUtilization.faculty_name.ilike(faculty_name.strip()))
        return query.all()

    def sum_hours(self, rows: List[FacultyUtilization]) -> Decimal:
        return sum((row.no_of_hours for row in rows), Decimal("0"))

    # --- Mutations ---
    def commit(self) -> None:
        self.db.commit()

    def refresh(self, instance) -> None:
        self.db.refresh(instance)