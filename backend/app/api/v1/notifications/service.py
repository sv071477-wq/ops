import logging
from typing import List, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class NotificationService:

    @classmethod
    async def notify_approval_requested(cls, batch):
        logger.info(
            f"[NOTIFICATION TRIGGERED] Batch {batch.batch_id} submitted for approval. "
            f"Approver 1: {batch.approver_1_id}, Approver 2: {batch.approver_2_id}"
        )

    @classmethod
    async def notify_approval_decision(cls, batch, level: int, decision: str):
        logger.info(
            f"[NOTIFICATION TRIGGERED] Batch {batch.batch_id} approval level {level}: {decision}. "
            f"Current status: {batch.status}"
        )

    @classmethod
    async def notify_batch_approved(cls, batch_id: str, approval_id: str, manager_email: Optional[str], sales_email: Optional[str]):
        """Dispatches automated notifications when a batch schema is locked and approved."""
        logger.info(
            f"[NOTIFICATION TRIGGERED] Batch {batch_id} Approved with SOW ID {approval_id}. "
            f"Recipients: Manager ({manager_email}), Sales ({sales_email})"
        )

    @classmethod
    async def notify_session_scheduled(cls, faculty_name: str, faculty_email: Optional[str], date_str: str, topic: str):
        """Dispatches calendar invite/alert when trainer is assigned to a session."""
        logger.info(
            f"[NOTIFICATION TRIGGERED] Session Scheduled for {faculty_name} ({faculty_email}) on {date_str} - Topic: {topic}"
        )

    @classmethod
    async def notify_gate_completion(cls, batch_id: str, gate_name: str, score: str):
        """Notifies stakeholders when Quality Gate 1 or 2 is passed."""
        logger.info(
            f"[NOTIFICATION TRIGGERED] Quality Gate '{gate_name}' completed for Batch {batch_id} with Score: {score}"
        )
