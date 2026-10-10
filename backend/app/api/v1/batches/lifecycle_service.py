from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from app.models.session import SessionStatus
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
                # `training_sessions` declares no feedback columns, so the rating
                # and notes stay on the delivery ledger row that recorded them.
                session.updated_at = datetime.now(timezone.utc)
                updated_count += 1

        self.lifecycle_repo.commit()
        return updated_count

    def calculate_batch_avg_feedback(self, batch_id: UUID) -> Optional[Decimal]:
        """Calculate and persist the batch average feedback.

        Only one condition must hold before a value is written:
          1. at least one ``Completed`` row carries a rating.

        The mean is taken over rated rows only. Unrated ``Completed`` rows are
        excluded from the mean and never block it.

        This method recalculates the average on every call, so it can be invoked
        from multiple trigger points (utilization create/update, nightly sweep,
        Gate 1) without idempotency concerns.
        """
        batch = self.lifecycle_repo.get_batch_by_id(batch_id)
        if not batch:
            return None

        ledger = self.lifecycle_repo.list_utilizations_for_batch(batch_id)

        ratings = [
            u.feedback_rating
            for u in ledger
            if u.status == SessionStatus.Completed and u.feedback_rating is not None
        ]
        if not ratings:
            return None

        avg_feedback = Decimal(str(round(sum(ratings) / len(ratings), 2)))
        batch.batch_avg_feedback = avg_feedback
        batch.updated_at = datetime.now(timezone.utc)
        self.lifecycle_repo.commit()

        return avg_feedback

    def check_and_update_batch_feedback(self, batch_id: UUID) -> Optional[Decimal]:
        """Check whether the batch is fully delivered and calculate its average feedback."""
        return self.calculate_batch_avg_feedback(batch_id)

    def sync_all(self) -> dict:
        """Run all synchronization tasks and return counts."""
        batch_updates = self.sync_statuses()
        session_updates = self.sync_session_statuses()

        # Every batch still missing its average, whatever its status: the
        # feedback write depends on delivery and outcome state, not on the batch
        # having reached "Pending for Closure".
        feedback_calculated = 0
        for batch in self.lifecycle_repo.list_batches_missing_avg_feedback():
            if self.calculate_batch_avg_feedback(batch.id) is not None:
                feedback_calculated += 1

        return {
            "batch_status_updates": batch_updates,
            "session_status_updates": session_updates,
            "batch_feedback_calculated": feedback_calculated,
        }