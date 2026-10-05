from datetime import date
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.session import TrainingSession
from app.models.user import User
from app.api.v1.schedules.repository_interfaces import IScheduleRepository


class ScheduleRepository(IScheduleRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_batch_by_batch_id(self, batch_id: str) -> Optional[Batch]:
        return self.db.query(Batch).filter(Batch.batch_id == batch_id).first()

    def get_batch_by_id(self, batch_id: UUID) -> Optional[Batch]:
        return self.db.query(Batch).filter(Batch.id == batch_id).first()

    def get_active_user(self, user_id: UUID) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()

    def find_existing_session(self, batch_id: UUID, session_date: date, module: str) -> Optional[TrainingSession]:
        return self.db.query(TrainingSession).filter(
            TrainingSession.batch_id == batch_id,
            TrainingSession.session_date == session_date,
            TrainingSession.module.ilike(module),
        ).first()

    def persist_sessions(self, sessions: List[TrainingSession]) -> List[TrainingSession]:
        for session in sessions:
            self.db.add(session)
        self.db.commit()
        for session in sessions:
            self.db.refresh(session)
        return sessions

    def rollback(self) -> None:
        self.db.rollback()