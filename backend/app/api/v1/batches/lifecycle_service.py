from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from app.api.v1.batches.repository_interfaces import IBatchLifecycleRepository


class BatchLifecycleService:
    """Service for managing automatic batch lifecycle state transitions."""

    def __init__(self, lifecycle_repo: IBatchLifecycleRepository):
        self.lifecycle_repo = lifecycle_repo

    def sync_statuses(self) -> int:
        """
        Synchronize batch statuses based on dates.
        Returns the number of batches updated.
        """
        today = datetime.now(timezone.utc).date()
        updated_count = 0

        # Upcoming -> Ongoing (start_date == today)
        for batch in self.lifecycle_repo.list_upcoming_batches_started_by(today):
            if batch.start_date and batch.start_date.date() <= today:
                batch.status = "Ongoing"
                batch.updated_at = datetime.now(timezone.utc)
                updated_count += 1

        # Ongoing -> Pending for Closure (end_date < today)
        for batch in self.lifecycle_repo.list_ongoing_batches_ended_before(today):
            if batch.end_date and batch.end_date.date() < today:
                batch.status = "Pending for Closure"
                batch.updated_at = datetime.now(timezone.utc)
                updated_count += 1

        self.lifecycle_repo.commit()
        return updated_count

    def sync_session_statuses(self) -> int:
        """
        Update TrainingSession status to Completed when faculty utilization is logged as Completed.
        Returns the number of sessions updated.
        """
        updated_count = 0
        seen_session_ids = set()

        for utilization in self.lifecycle_repo.list_completed_utilizations_with_session():
            if utilization.training_session_id in seen_session_ids:
                continue
            seen_session_ids.add(utilization.training_session_id)

            session = self.lifecycle_repo.get_training_session_by_id(utilization.training_session_id)
            if session and session.status != "Completed":
                session.status = "Completed"
                # Copy feedback from utilization to session
                if utilization.feedback_rating is not None:
                    session.feedback_rating = utilization.feedback_rating
                if utilization.feedback_notes:
                    session.feedback_notes = utilization.feedback_notes
                session.updated_at = datetime.now(timezone.utc)
                updated_count += 1

        self.lifecycle_repo.commit()
        return updated_count

    def calculate_batch_avg_feedback(self, batch_id: UUID) -> Optional[float]:
        """
        Calculate average batch feedback from all non-cancelled completed sessions.
        Called when all non-cancelled sessions are completed.
        """
        batch = self.lifecycle_repo.get_batch_by_id(batch_id)
        if not batch:
            return None

        sessions = self.lifecycle_repo.list_non_cancelled_training_sessions(batch_id)
        if not sessions:
            return None

        # Only write an average once the whole batch has been delivered.
        if not all(s.status == "Completed" for s in sessions):
            return None

        feedbacks = self.lifecycle_repo.list_completed_feedback_ratings(batch_id)
        if not feedbacks:
            return None

        avg_feedback = sum(float(f) for f in feedbacks) / len(feedbacks)
        batch.batch_avg_feedback = round(avg_feedback, 2)
        batch.updated_at = datetime.now(timezone.utc)
        self.lifecycle_repo.commit()

        return avg_feedback

    def check_and_update_batch_feedback(self, batch_id: UUID) -> Optional[float]:
        """Check if all sessions are completed and calculate batch average feedback."""
        return self.calculate_batch_avg_feedback(batch_id)

    def sync_all(self) -> dict:
        """Run all synchronization tasks and return counts."""
        batch_updates = self.sync_statuses()
        session_updates = self.sync_session_statuses()

        # Check for batch feedback calculation on batches that might have completed all sessions
        feedback_calculated = 0
        for batch in self.lifecycle_repo.list_batches_with_status("Pending for Closure"):
            if self.calculate_batch_avg_feedback(batch.id) is not None:
                feedback_calculated += 1

        return {
            "batch_status_updates": batch_updates,
            "session_status_updates": session_updates,
            "batch_feedback_calculated": feedback_calculated,
        }