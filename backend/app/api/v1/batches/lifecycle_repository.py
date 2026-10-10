from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.session import FacultyUtilization, TrainingSession
from app.api.v1.batches.repository_interfaces import IBatchLifecycleRepository


class BatchLifecycleRepository(IBatchLifecycleRepository):
    def __init__(self, db: Session):
        self.db = db

    def list_upcoming_batches_started_by(self, target_date: date) -> List[Batch]:
        end_of_day = datetime.combine(target_date, time.max).replace(tzinfo=timezone.utc)
        return self.db.query(Batch).filter(
            Batch.status == "Upcoming",
            Batch.start_date.isnot(None),
            Batch.start_date <= end_of_day,
        ).all()

    def list_ongoing_batches_ended_before(self, target_date: date) -> List[Batch]:
        start_of_day = datetime.combine(target_date, time.min).replace(tzinfo=timezone.utc)
        return self.db.query(Batch).filter(
            Batch.status == "Ongoing",
            Batch.end_date.isnot(None),
            Batch.end_date < start_of_day,
        ).all()

    def list_batches_with_status(self, status: str) -> List[Batch]:
        return self.db.query(Batch).filter(Batch.status == status).all()

    def list_batches_missing_avg_feedback(self) -> List[Batch]:
        return self.db.query(Batch).filter(Batch.batch_avg_feedback.is_(None)).all()

    def list_completed_utilizations_with_session(self) -> List[FacultyUtilization]:
        return self.db.query(FacultyUtilization).filter(
            FacultyUtilization.training_session_id.isnot(None),
            FacultyUtilization.status == "Completed",
        ).all()

    def get_training_session_by_id(self, session_id: UUID) -> Optional[TrainingSession]:
        return self.db.query(TrainingSession).filter(TrainingSession.id == session_id).first()

    def get_batch_by_id(self, batch_id: UUID) -> Optional[Batch]:
        return self.db.query(Batch).filter(Batch.id == batch_id).first()

    def list_non_cancelled_training_sessions(self, batch_id: UUID) -> List[TrainingSession]:
        return self.db.query(TrainingSession).filter(
            TrainingSession.batch_id == batch_id,
        ).all()

    def list_utilizations_for_batch(self, batch_id: UUID) -> List[FacultyUtilization]:
        return self.db.query(FacultyUtilization).filter(
            FacultyUtilization.batch_id == batch_id,
        ).all()

    def list_completed_feedback_ratings(self, batch_id: UUID) -> List[Decimal]:
        # Feedback is captured on the delivery ledger, not on the planned timetable:
        # `training_sessions` has no feedback columns, so reading them off the
        # TrainingSession rows raised AttributeError on every fully-delivered batch.
        # Unlinked rows are included: a delivery logged without a planned day is
        # still a real delivery that faculty rated.
        return [
            row.feedback_rating
            for row in self.db.query(FacultyUtilization).filter(
                FacultyUtilization.batch_id == batch_id,
                FacultyUtilization.status == "Completed",
                FacultyUtilization.feedback_rating.isnot(None),
            ).all()
        ]

    def commit(self) -> None:
        self.db.commit()