from typing import Optional
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.session import TrainingSession
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
        Validates module rating (1.0 - 5.0), saves feedback to DB, marks session Completed,
        and recalculates the batch's average feedback rating.
        """
        if feedback_data.rating < Decimal("1.0") or feedback_data.rating > Decimal("5.0"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Quality Gate 1 Rejected: Rating must be strictly between 1.0 and 5.0."
            )

        # Parse or query session
        session_obj = None
        try:
            parsed_uuid = UUID(str(session_id))
            session_obj = db.query(TrainingSession).filter(TrainingSession.id == parsed_uuid).first()
        except (ValueError, TypeError):
            pass

        if not session_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        if session_obj.status in {"Cancelled", "Not Conducted", "Completed"}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session is not available for Gate 1 completion")

        if session_obj:
            session_obj.status = "Completed"
            session_obj.feedback_submitted = True
            session_obj.feedback_rating = feedback_data.rating
            notes = feedback_data.topic_feedback or ""
            if feedback_data.faculty_observations:
                notes = f"{notes}\nObservations: {feedback_data.faculty_observations}".strip()
            session_obj.feedback_notes = notes
            session_obj.updated_at = datetime.now(timezone.utc)

            # Recalculate batch feedback aggregates
            completed = db.query(TrainingSession).filter(
                TrainingSession.batch_id == session_obj.batch_id,
                TrainingSession.feedback_rating.isnot(None),
                TrainingSession.status == "Completed",
            ).all()

            if completed:
                total = sum((s.feedback_rating for s in completed), Decimal("0"))
                avg = round(total / Decimal(str(len(completed))), 2)
                batch = db.query(Batch).filter(Batch.id == session_obj.batch_id).first()
                if batch:
                    batch.batch_avg_feedback = Decimal(str(avg))
                    batch.total_feedback_score = Decimal(str(total))
                    batch.updated_at = datetime.now(timezone.utc)

            db.commit()
            db.refresh(session_obj)

            return {
                "session_id": str(session_obj.id),
                "batch_id": str(session_obj.batch_id),
                "status": session_obj.status,
                "feedback_submitted": session_obj.feedback_submitted,
                "rating": session_obj.feedback_rating,
                "topic_feedback": session_obj.feedback_notes,
                "total_students_present": feedback_data.total_students_present,
                "submitted_by": str(user_id)
            }

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
        are submitted. Upon valid submission, the batch is closed and schema is locked.
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

        sessions = db.query(TrainingSession).filter(TrainingSession.batch_id == batch.id).all()
        if not sessions:
            raise HTTPException(status_code=409, detail="Batch cannot close before sessions are created")
        terminal_statuses = {"Completed", "Cancelled", "Not Conducted"}
        if any(session.status not in terminal_statuses for session in sessions):
            raise HTTPException(status_code=409, detail="Every session must have a terminal outcome before batch closure")
        if batch.nps_imported_at is None or batch.batch_nps is None:
            raise HTTPException(status_code=409, detail="Final feedback workbook must be imported before batch closure")
        if batch.nps_total_responses is None or batch.nps_total_responses <= 0:
            raise HTTPException(status_code=409, detail="Final feedback import must contain responses")
        if batch.batch_avg_feedback is None:
            raise HTTPException(status_code=409, detail="Average session feedback is required before batch closure")
        if closure_data.average_feedback_score is not None and closure_data.average_feedback_score != batch.batch_avg_feedback:
            raise HTTPException(status_code=409, detail="Submitted average feedback does not match the stored aggregate")

        batch.retrospective_notes = closure_data.retrospective_notes
        batch.status = "Completed"
        batch.is_schema_locked = True
        batch.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(batch)
        return batch
