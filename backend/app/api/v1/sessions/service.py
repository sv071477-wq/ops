from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.schemas.feedback import SessionFeedbackCreate
from app.api.v1.gates.service import GatekeeperService


class SessionService:
    def __init__(self, db: Session):
        self.db = db

    def list(self, batch_id: Optional[UUID], faculty_name: Optional[str], status_filter: Optional[str]) -> list[Any]:
        return []

    def create(self, batch_id: UUID, topic: str, faculty_name: str, date_of_training: datetime, no_of_hours: Decimal) -> dict:
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        return {
            "status": "Scheduled",
            "batch_id": str(batch.id),
            "topic": topic,
            "faculty_name": faculty_name,
            "date_of_training": date_of_training.isoformat(),
            "no_of_hours": float(no_of_hours),
        }

    def complete_gate1(self, session_id: str, feedback: SessionFeedbackCreate, user_id: UUID) -> dict:
        return GatekeeperService.complete_session_gate1(
            db=self.db,
            session_id=session_id,
            feedback_data=feedback,
            user_id=user_id,
        )