from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.batch import Batch
from app.models.session import TrainingSession, FacultyUtilization


class BatchLifecycleService:
    """Service for managing automatic batch lifecycle state transitions."""

    def __init__(self, db: Session):
        self.db = db

    def sync_statuses(self) -> int:
        """
        Synchronize batch statuses based on dates.
        Returns the number of batches updated.
        """
        today = datetime.now(timezone.utc).date()
        updated_count = 0

        # Upcoming -> Ongoing (start_date == today)
        upcoming_batches = self.db.query(Batch).filter(
            Batch.status == "Upcoming",
            Batch.start_date.isnot(None),
            Batch.start_date <= datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
        ).all()

        for batch in upcoming_batches:
            if batch.start_date and batch.start_date.date() <= today:
                batch.status = "Ongoing"
                batch.updated_at = datetime.now(timezone.utc)
                updated_count += 1

        # Ongoing -> Pending for Closure (end_date < today)
        ongoing_batches = self.db.query(Batch).filter(
            Batch.status == "Ongoing",
            Batch.end_date.isnot(None),
            Batch.end_date < datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        ).all()

        for batch in ongoing_batches:
            if batch.end_date and batch.end_date.date() < today:
                batch.status = "Pending for Closure"
                batch.updated_at = datetime.now(timezone.utc)
                updated_count += 1

        self.db.commit()
        return updated_count

    def sync_session_statuses(self) -> int:
        """
        Update TrainingSession status to Completed when faculty utilization is logged as Completed.
        Returns the number of sessions updated.
        """
        # Find sessions with faculty utilization marked as Completed
        completed_utilizations = self.db.query(FacultyUtilization).filter(
            FacultyUtilization.training_session_id.isnot(None),
            FacultyUtilization.status == "Completed"
        ).all()

        updated_count = 0
        seen_session_ids = set()

        for utilization in completed_utilizations:
            if utilization.training_session_id in seen_session_ids:
                continue
            seen_session_ids.add(utilization.training_session_id)

            session = self.db.query(TrainingSession).filter(
                TrainingSession.id == utilization.training_session_id
            ).first()

            if session and session.status != "Completed":
                session.status = "Completed"
                # Copy feedback from utilization to session
                if utilization.feedback_rating is not None:
                    session.feedback_rating = utilization.feedback_rating
                if utilization.feedback_notes:
                    session.feedback_notes = utilization.feedback_notes
                session.updated_at = datetime.now(timezone.utc)
                updated_count += 1

        self.db.commit()
        return updated_count

    def calculate_batch_avg_feedback(self, batch_id: UUID) -> Optional[float]:
        """
        Calculate average batch feedback from all non-cancelled completed sessions.
        Called when all non-cancelled sessions are completed.
        """
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            return None

        # Get all non-cancelled sessions for this batch
        sessions = self.db.query(TrainingSession).filter(
            TrainingSession.batch_id == batch_id,
            TrainingSession.status != "Cancelled"
        ).all()

        if not sessions:
            return None

        # Check if all non-cancelled sessions are completed
        all_completed = all(s.status == "Completed" for s in sessions)
        if not all_completed:
            return None

        # Collect feedback ratings from completed sessions
        feedbacks = [s.feedback_rating for s in sessions if s.feedback_rating is not None]
        if not feedbacks:
            return None

        avg_feedback = sum(float(f) for f in feedbacks) / len(feedbacks)
        batch.batch_avg_feedback = round(avg_feedback, 2)
        batch.updated_at = datetime.now(timezone.utc)
        self.db.commit()

        return avg_feedback

    def check_and_update_batch_feedback(self, batch_id: UUID) -> Optional[float]:
        """Check if all sessions are completed and calculate batch average feedback."""
        return self.calculate_batch_avg_feedback(batch_id)

    def sync_all(self) -> dict:
        """Run all synchronization tasks and return counts."""
        batch_updates = self.sync_statuses()
        session_updates = self.sync_session_statuses()

        # Check for batch feedback calculation on batches that might have completed all sessions
        batches_pending_closure = self.db.query(Batch).filter(
            Batch.status == "Pending for Closure"
        ).all()

        feedback_calculated = 0
        for batch in batches_pending_closure:
            if self.calculate_batch_avg_feedback(batch.id) is not None:
                feedback_calculated += 1

        return {
            "batch_status_updates": batch_updates,
            "session_status_updates": session_updates,
            "batch_feedback_calculated": feedback_calculated,
        }