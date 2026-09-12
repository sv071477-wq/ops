from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.session import TrainingSession
from app.models.user import User
from app.schemas.feedback import SessionFeedbackCreate
from app.schemas.session import SessionCreate, SessionUpdate
from app.api.v1.gates.service import GatekeeperService
from app.api.v1.schedules.conflict_engine import ConflictEngine


class SessionService:
    def __init__(self, db: Session):
        self.db = db

    def list(self, batch_id: Optional[UUID], faculty_name: Optional[str], status_filter: Optional[str]) -> list[TrainingSession]:
        query = self.db.query(TrainingSession)
        if batch_id:
            query = query.filter(TrainingSession.batch_id == batch_id)
        if faculty_name:
            query = query.join(User, TrainingSession.faculty_id == User.id).filter(User.full_name.ilike(f"%{faculty_name}%"))
        if status_filter:
            query = query.filter(TrainingSession.status == status_filter)
        return query.order_by(TrainingSession.date_of_training.asc()).all()

    def create(self, session_in: SessionCreate) -> TrainingSession:
        batch = self.db.query(Batch).filter(Batch.id == session_in.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        faculty = self.db.query(User).filter(User.id == session_in.faculty_id, User.is_active.is_(True)).first()
        if not faculty or faculty.role.lower() != "faculty":
            raise HTTPException(status_code=422, detail="faculty_id must reference an active Faculty user")
        daily_hours = self.db.query(TrainingSession).filter(
            TrainingSession.faculty_id == session_in.faculty_id,
            TrainingSession.date_of_training >= session_in.date_of_training.replace(hour=0, minute=0, second=0, microsecond=0),
            TrainingSession.date_of_training < session_in.date_of_training.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1),
            TrainingSession.status.notin_(["Cancelled"]),
        ).all()
        existing_hours = sum((row.no_of_hours for row in daily_hours), Decimal("0"))
        conflicts = ConflictEngine.check_session_conflict(
            db=self.db,
            faculty_name=faculty.full_name,
            date_of_training=session_in.date_of_training,
            requested_hours=session_in.no_of_hours,
            existing_hours=existing_hours,
        )
        if conflicts:
            raise HTTPException(status_code=409, detail=[conflict.model_dump() for conflict in conflicts])
        session = TrainingSession(**session_in.model_dump())
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def update(self, session_id: UUID, session_in: SessionUpdate) -> TrainingSession:
        session = self.db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        for field, value in session_in.model_dump(exclude_unset=True).items():
            setattr(session, field, value)
        session.updated_at = datetime.now().astimezone()
        self.db.commit()
        self.db.refresh(session)
        return session

    def complete_gate1(self, session_id: str, feedback: SessionFeedbackCreate, user_id: UUID) -> dict:
        return GatekeeperService.complete_session_gate1(
            db=self.db,
            session_id=session_id,
            feedback_data=feedback,
            user_id=user_id,
        )