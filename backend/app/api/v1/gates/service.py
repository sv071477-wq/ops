from typing import Optional
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.schemas.feedback import SessionFeedbackCreate, BatchNpsClosureCreate


class GatekeeperService:

    @classmethod
    def complete_session_gate1(
        cls,
        db: Session,
        session_id: str,
        feedback_data: SessionFeedbackCreate,
        user_id: UUID
    ) -> dict:
        """
        Quality Checkpoint 1:
        Validates module rating (1.0 - 5.0) and topic feedback.
        """
        if feedback_data.rating < Decimal("1.0") or feedback_data.rating > Decimal("5.0"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Quality Gate 1 Rejected: Rating must be strictly between 1.0 and 5.0."
            )

        return {
            "session_id": session_id,
            "status": "Completed",
            "feedback_submitted": True,
            "rating": feedback_data.rating,
            "topic_feedback": feedback_data.topic_feedback,
            "total_students_present": feedback_data.total_students_present,
            "submitted_by": str(user_id)
        }

    @classmethod
    def close_batch_gate2(
        cls,
        db: Session,
        batch_id: UUID,
        closure_data: BatchNpsClosureCreate,
        user_id: UUID
    ) -> Batch:
        """
        Quality Checkpoint 2:
        Closing a batch is BLOCKED unless final Batch NPS (0 - 10 score) and retrospective notes
        are submitted.
        """
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch {batch_id} not found."
            )

        if batch.status == "Completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Batch has already completed Gate 2 and is Closed."
            )

        # Update batch metrics directly on Batch table
        batch.batch_nps = closure_data.nps_score
        if closure_data.average_feedback_score:
            batch.batch_avg_feedback = closure_data.average_feedback_score
        batch.retrospective_notes = closure_data.retrospective_notes
        batch.status = "Completed"
        batch.is_schema_locked = True
        batch.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(batch)
        return batch
