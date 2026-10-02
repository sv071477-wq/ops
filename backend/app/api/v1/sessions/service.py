import re
from datetime import datetime, timedelta, timezone, date, time
from decimal import Decimal
from typing import Any, Optional, List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.batch import Batch
from app.models.session import FacultyUtilization, TrainingSession
from app.models.user import User
from app.schemas.feedback import SessionFeedbackCreate
from app.schemas.session import (
    SessionCreate, SessionUpdate, SessionOutcomeRequest, SessionRescheduleRequest,
    TrainingSessionCreate,
    TrainingSessionResponse, TrainingSessionUpdate,
)
from app.api.v1.gates.service import GatekeeperService
from app.api.v1.schedules.conflict_engine import ConflictEngine
from app.api.deps import get_manager_scope_user_ids


def _check_and_update_batch_completion(db: Session, batch_id: UUID) -> None:
    """Mark the batch Completed once every session (scheduled + logged) is terminal."""
    sessions = db.query(TrainingSession).filter(TrainingSession.batch_id == batch_id).all()
    util_sessions = db.query(FacultyUtilization).filter(FacultyUtilization.batch_id == batch_id).all()
    all_sessions = list(sessions) + list(util_sessions)

    if all_sessions:
        terminal_statuses = {"Completed", "Cancelled", "Not Conducted"}
        all_terminal = all(session.status in terminal_statuses for session in all_sessions)
        if all_terminal:
            batch = db.query(Batch).filter(Batch.id == batch_id).first()
            if batch and batch.status not in ["Completed", "Cancelled"]:
                batch.status = "Completed"
                batch.updated_at = datetime.now(timezone.utc)
                db.commit()


class SessionService:
    def __init__(self, db: Session):
        self.db = db

    def list(self, batch_id: Optional[UUID], faculty_name: Optional[str], status_filter: Optional[str], user_id: Optional[UUID] = None) -> List[FacultyUtilization]:
        """Lists actual faculty delivery records (utilization ledger)."""
        if batch_id and user_id:
            batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
            if batch:
                self._require_batch_scope(batch, user_id)
        query = self.db.query(FacultyUtilization).options(
            joinedload(FacultyUtilization.batch).joinedload(Batch.entity),
            joinedload(FacultyUtilization.batch).joinedload(Batch.coordinator)
        ).join(Batch, FacultyUtilization.batch_id == Batch.id)
        if batch_id:
            query = query.filter(FacultyUtilization.batch_id == batch_id)
        if faculty_name:
            query = query.filter(FacultyUtilization.faculty_name.ilike(f"%{faculty_name}%"))
        if status_filter:
            query = query.filter(FacultyUtilization.status == status_filter)
        return query.order_by(FacultyUtilization.date_of_training.asc()).all()

    def list_scheduled(self, batch_id: UUID, user_id: Optional[UUID] = None) -> List[dict]:
        """Lists the curriculum schedule days with status and linked utilization details."""
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if user_id:
            self._require_batch_scope(batch, user_id)

        scheduled_days = self.db.query(TrainingSession).filter(
            TrainingSession.batch_id == batch_id
        ).order_by(TrainingSession.session_date.asc(), TrainingSession.sequence_number.asc()).all()

        utilizations = self.db.query(FacultyUtilization).filter(FacultyUtilization.batch_id == batch_id).all()
        util_map = {u.training_session_id: u for u in utilizations if u.training_session_id}

        result = []
        for idx, s in enumerate(scheduled_days, start=1):
            util = util_map.get(s.id)
            result.append({
                "id": s.id,
                "batch_id": s.batch_id,
                "sequence_number": s.sequence_number or idx,
                "week": s.week,
                "session_date": s.session_date,
                "day_name": s.day_name or s.session_date.strftime("%A"),
                "start_time": s.start_time,
                "end_time": s.end_time,
                "duration_hours": s.duration_hours,
                "module": s.module,
                "trainer_name": s.trainer_name,
                "status": "Completed" if util else s.status,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
                "utilization_logged": util is not None,
                "utilization_id": util.id if util else None,
                "actual_trainer": util.faculty_name if util else None,
                "actual_hours": util.no_of_hours if util else None,
            })
        return result

    def update_scheduled(self, session_id: UUID, session_in: TrainingSessionUpdate, user_id: Optional[UUID] = None) -> TrainingSession:
        session = self.db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Scheduled session not found")
        batch = self.db.query(Batch).filter(Batch.id == session.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if user_id:
            self._require_batch_scope(batch, user_id)
        if batch.status == "Completed":
            raise HTTPException(status_code=409, detail="Completed batches cannot be edited")

        updates = session_in.model_dump(exclude_unset=True)
        if "session_date" in updates and updates["session_date"]:
            session.day_name = updates["session_date"].strftime("%A")
        for field, value in updates.items():
            setattr(session, field, value)
        session.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(session)
        return session

    def create_scheduled(self, session_in: TrainingSessionCreate, user_id: Optional[UUID] = None) -> TrainingSession:
        batch = self.db.query(Batch).filter(Batch.id == session_in.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if user_id:
            self._require_batch_scope(batch, user_id)
        last_sequence = self.db.query(TrainingSession.sequence_number).filter(
            TrainingSession.batch_id == batch.id
        ).order_by(TrainingSession.sequence_number.desc()).first()
        session = TrainingSession(
            **session_in.model_dump(exclude={"batch_id", "sequence_number"}),
            batch_id=batch.id,
            sequence_number=session_in.sequence_number or ((last_sequence[0] or 0) + 1 if last_sequence else 1),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def _resolve_faculty(self, faculty_id: Optional[UUID], faculty_name: Optional[str]) -> tuple[Optional[User], str]:
        """Resolve the faculty user for a ledger row, plus the name to persist.

        `faculty_utilization.faculty_name` is a denormalized free-text column with no
        foreign key, and the write path prefills it from `training_sessions.trainer_name`
        (also free text, and editable or imported from Excel). Requiring a matching
        `users` row therefore rejected every delivery log for a trainer who is not on
        the roster. Resolution is still preferred, so the stored name is canonical and
        the conflict engine gets a real `faculty_id`, but an unresolved name now falls
        back to the value the caller supplied instead of failing the request.
        """
        if faculty_id:
            faculty = self.db.query(User).filter(User.id == faculty_id, User.is_active.is_(True)).first()
            if faculty:
                return faculty, faculty.full_name

        clean_name = str(faculty_name).strip() if faculty_name else ""
        if clean_name:
            # Prefer a Faculty-role match, then fall back to any active user.
            faculty = self.db.query(User).filter(
                User.role.ilike("faculty"),
                User.full_name.ilike(clean_name),
                User.is_active.is_(True)
            ).first()
            if faculty:
                return faculty, faculty.full_name

            faculty = self.db.query(User).filter(
                User.full_name.ilike(clean_name),
                User.is_active.is_(True)
            ).first()
            if faculty:
                return faculty, faculty.full_name

        if not clean_name:
            raise HTTPException(status_code=422, detail="Faculty name is required to log a utilization record")

        return None, clean_name

    @staticmethod
    def _validate_time_window(start_time: Optional[time], end_time: Optional[time]) -> None:
        """Reject inverted or zero-length delivery windows.

        The conflict engine only tests intervals for overlap, so an end time at or
        before the start time used to persist a nonsensical row and then match it
        against every other booking that day.
        """
        if start_time and end_time and end_time <= start_time:
            raise HTTPException(
                status_code=422,
                detail=f"End time must be after start time (got {start_time.strftime('%H:%M')} to {end_time.strftime('%H:%M')}).",
            )

    def create(self, session_in: SessionCreate, user_id: Optional[UUID] = None) -> FacultyUtilization:
        """Logs a faculty utilization delivery record, optionally linking to a scheduled session day."""
        batch = self.db.query(Batch).filter(Batch.id == session_in.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if user_id:
            self._require_batch_scope(batch, user_id)

        session_dict = session_in.model_dump(exclude_unset=True)
        faculty, faculty_name = self._resolve_faculty(None, session_dict.get("faculty_name"))
        session_dict["faculty_name"] = faculty_name

        self._validate_time_window(session_in.start_time, session_in.end_time)

        # Require outcome_reason when status is Cancelled or Not Conducted
        if session_dict.get("status") in ["Cancelled", "Not Conducted"] and not session_dict.get("outcome_reason"):
            raise HTTPException(status_code=422, detail="Outcome reason is required when status is Cancelled or Not Conducted")

        # Auto-set outcome_by to current user if outcome_reason is provided but outcome_by is not
        if session_dict.get("outcome_reason") and not session_dict.get("outcome_by"):
            session_dict["outcome_by"] = user_id
            if not session_dict.get("outcome_at"):
                session_dict["outcome_at"] = datetime.now(timezone.utc)

        daily_hours = self.db.query(FacultyUtilization).filter(
            FacultyUtilization.faculty_name.ilike(faculty_name),
            FacultyUtilization.date_of_training >= session_in.date_of_training.replace(hour=0, minute=0, second=0, microsecond=0),
            FacultyUtilization.date_of_training < session_in.date_of_training.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1),
            FacultyUtilization.status.notin_(["Cancelled"]),
        ).all()
        existing_hours = sum((row.no_of_hours for row in daily_hours), Decimal("0"))
        conflicts = ConflictEngine.check_session_conflict(
            db=self.db,
            faculty_name=faculty_name,
            date_of_training=session_in.date_of_training,
            requested_hours=session_in.no_of_hours,
            existing_hours=existing_hours,
            start_time=session_in.start_time,
            end_time=session_in.end_time,
            faculty_id=faculty.id if faculty else None,
        )
        if conflicts:
            raise HTTPException(status_code=409, detail=[conflict.model_dump() for conflict in conflicts])
        
        session = FacultyUtilization(**session_dict)
        self.db.add(session)

        # If linked to a scheduled training session day and status is Completed, mark it Completed.
        # The timetable has no feedback columns; the rating stays on this ledger row.
        if session_in.training_session_id and session_in.status == "Completed":
            sched = self.db.query(TrainingSession).filter(TrainingSession.id == session_in.training_session_id).first()
            if sched:
                sched.status = "Completed"

        self.db.commit()
        self.db.refresh(session)
        
        # Check and update batch completion/feedback
        from app.api.v1.batches.lifecycle_service import BatchLifecycleService
        lifecycle_service = BatchLifecycleService(self.db)
        lifecycle_service.check_and_update_batch_feedback(session.batch_id)
        
        return session

    def update(self, session_id: UUID, session_in: SessionUpdate, user_id: Optional[UUID] = None) -> FacultyUtilization:
        session = self.db.query(FacultyUtilization).filter(FacultyUtilization.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        update_dict = session_in.model_dump(exclude_unset=True)
        batch = self.db.query(Batch).filter(Batch.id == session.batch_id).first()
        if user_id:
            self._require_batch_scope(batch, user_id)
        if batch and batch.status == "Completed":
            raise HTTPException(status_code=409, detail="Completed batches cannot be edited")
        if "faculty_name" in update_dict:
            _faculty, update_dict["faculty_name"] = self._resolve_faculty(None, update_dict.get("faculty_name"))
        self._validate_time_window(
            update_dict.get("start_time", session.start_time),
            update_dict.get("end_time", session.end_time),
        )
        target_date = update_dict.get("date_of_training", session.date_of_training)
        if batch and batch.start_date and target_date.date() < batch.start_date.date():
            raise HTTPException(status_code=422, detail="Session date is before the batch start date")
        if batch and batch.end_date and target_date.date() > batch.end_date.date():
            raise HTTPException(status_code=422, detail="Session date is after the batch end date")
        if "faculty_name" in update_dict or "date_of_training" in update_dict or "no_of_hours" in update_dict:
            faculty_name = update_dict.get("faculty_name", session.faculty_name)
            requested_hours = update_dict.get("no_of_hours", session.no_of_hours)
            day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            existing = self.db.query(FacultyUtilization).filter(
                FacultyUtilization.id != session.id,
                FacultyUtilization.faculty_name.ilike(faculty_name),
                FacultyUtilization.date_of_training >= day_start,
                FacultyUtilization.date_of_training < day_end,
                FacultyUtilization.status.notin_(["Cancelled", "Not Conducted"]),
            ).all()
            existing_hours = sum((row.no_of_hours for row in existing), Decimal("0"))
            if existing_hours + requested_hours > ConflictEngine.MAX_DAILY_FACULTY_HOURS:
                raise HTTPException(status_code=409, detail="Faculty daily capacity would be exceeded")

        # Require outcome_reason when status is changed to Cancelled or Not Conducted
        new_status = update_dict.get("status", session.status)
        if new_status in ["Cancelled", "Not Conducted"] and not update_dict.get("outcome_reason") and not session.outcome_reason:
            raise HTTPException(status_code=422, detail="Outcome reason is required when status is Cancelled or Not Conducted")

        # Auto-set outcome_by and outcome_at when outcome_reason is provided
        if update_dict.get("outcome_reason") and not update_dict.get("outcome_by"):
            update_dict["outcome_by"] = user_id
            if not update_dict.get("outcome_at"):
                update_dict["outcome_at"] = datetime.now(timezone.utc)

        # Track if status is changing to Completed
        was_completed = session.status == "Completed"
        will_be_completed = new_status == "Completed"

        for field, value in update_dict.items():
            setattr(session, field, value)
        session.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(session)

        # If linked to a scheduled training session day and status changed to Completed, mark it Completed
        if session.training_session_id and not was_completed and will_be_completed:
            sched = self.db.query(TrainingSession).filter(TrainingSession.id == session.training_session_id).first()
            if sched:
                sched.status = "Completed"
                self.db.commit()

        # Check and update batch completion/feedback
        from app.api.v1.batches.lifecycle_service import BatchLifecycleService
        lifecycle_service = BatchLifecycleService(self.db)
        lifecycle_service.check_and_update_batch_feedback(session.batch_id)

        return session

    def _transition(self, session_id: UUID, status: str, reason: str, user_id: UUID) -> FacultyUtilization:
        session = self.db.query(FacultyUtilization).filter(FacultyUtilization.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        batch = self.db.query(Batch).filter(Batch.id == session.batch_id).first()
        self._require_batch_scope(batch, user_id)
        if session.status == "Completed":
            raise HTTPException(status_code=409, detail="Completed sessions cannot be changed")
        session.status = status
        session.outcome_reason = reason.strip()
        session.outcome_at = datetime.now(timezone.utc)
        session.outcome_by = user_id
        session.updated_at = datetime.now(timezone.utc)

        # Sync the linked timetable day so lifecycle checks see the terminal status.
        if session.training_session_id:
            sched = self.db.query(TrainingSession).filter(TrainingSession.id == session.training_session_id).first()
            if sched and sched.status != status:
                sched.status = status
                sched.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(session)

        # Mark batch Completed when every (scheduled + logged) session is terminal.
        _check_and_update_batch_completion(self.db, session.batch_id)

        # Delegate feedback calculation to the lifecycle service — it only writes
        # batch_avg_feedback once all non-cancelled sessions are Completed.
        from app.api.v1.batches.lifecycle_service import BatchLifecycleService
        lifecycle_service = BatchLifecycleService(self.db)
        lifecycle_service.check_and_update_batch_feedback(session.batch_id)

        return session

    def _require_batch_scope(self, batch: Batch, user_id: UUID) -> None:
        user = self.db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
        if not user:
            raise HTTPException(status_code=401, detail="Active user not found")
        role = (user.role or "").lower()
        team = (user.team_detail.name if user.team_detail else "").strip().lower()
        if role == "admin" or team == "finance":
            return
        scope_ids = set(get_manager_scope_user_ids(user, self.db))
        batch_user_ids = {batch.primary_manager_id, batch.coordinator_id, batch.sales_spoc_id}
        if not scope_ids.intersection({value for value in batch_user_ids if value is not None}):
            raise HTTPException(status_code=403, detail="You can only view or edit sessions within your manager scope.")

    def cancel(self, session_id: UUID, request: SessionOutcomeRequest, user_id: UUID) -> FacultyUtilization:
        return self._transition(session_id, "Cancelled", request.reason, user_id)

    def mark_not_conducted(self, session_id: UUID, request: SessionOutcomeRequest, user_id: UUID) -> FacultyUtilization:
        return self._transition(session_id, "Not Conducted", request.reason, user_id)

    def reschedule(self, session_id: UUID, request: SessionRescheduleRequest, user_id: UUID) -> FacultyUtilization:
        session = self.db.query(FacultyUtilization).filter(FacultyUtilization.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session.status == "Completed":
            raise HTTPException(status_code=409, detail="Completed sessions cannot be rescheduled")
        updated = self.update(session_id, SessionUpdate(
            date_of_training=request.date_of_training,
            start_time=request.start_time,
            end_time=request.end_time,
        ), user_id)
        updated.status = "Scheduled"
        updated.outcome_reason = request.reason.strip()
        updated.outcome_at = datetime.now(timezone.utc)
        updated.outcome_by = user_id
        self.db.commit()
        self.db.refresh(updated)
        return updated

    def complete_gate1(self, session_id: str, feedback: SessionFeedbackCreate, user_id: UUID) -> dict:
        return GatekeeperService.complete_session_gate1(
            db=self.db,
            session_id=session_id,
            feedback_data=feedback,
            user_id=user_id,
        )