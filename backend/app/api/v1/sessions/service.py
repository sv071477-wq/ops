import re
import secrets
import string
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from typing import Any, Optional, List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.session import FacultyUtilization, TrainingSession
from app.models.user import User, Role
from app.core.security import get_password_hash
from app.schemas.feedback import SessionFeedbackCreate
from app.schemas.session import (
    SessionCreate, SessionUpdate, SessionOutcomeRequest, SessionRescheduleRequest,
    TrainingSessionCreate,
    TrainingSessionResponse, TrainingSessionUpdate,
)
from app.api.v1.gates.service import GatekeeperService
from app.api.v1.schedules.conflict_engine import ConflictEngine
from app.api.deps import get_manager_scope_user_ids


def _recalculate_batch_feedback(db: Session, batch_id: UUID) -> None:
    """Recalculate batch average feedback from completed sessions with ratings."""
    completed = db.query(FacultyUtilization).filter(
        FacultyUtilization.batch_id == batch_id,
        FacultyUtilization.feedback_rating.isnot(None),
        FacultyUtilization.status == "Completed",
    ).all()

    if completed:
        total = sum((s.feedback_rating for s in completed), Decimal("0"))
        avg = round(total / Decimal(str(len(completed))), 2)
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if batch:
            batch.batch_avg_feedback = Decimal(str(avg))
            batch.updated_at = datetime.now(timezone.utc)
            db.commit()


def _check_and_update_batch_completion(db: Session, batch_id: UUID) -> None:
    """Check if all sessions for a batch are in terminal state and update batch if needed."""
    sessions = db.query(TrainingSession).filter(TrainingSession.batch_id == batch_id).all()
    util_sessions = db.query(FacultyUtilization).filter(FacultyUtilization.batch_id == batch_id).all()
    all_sessions = list(sessions) + list(util_sessions)
    
    if all_sessions:
        terminal_statuses = {"Completed", "Cancelled", "Not Conducted"}
        all_terminal = all(session.status in terminal_statuses for session in all_sessions)
        if all_terminal:
            _recalculate_batch_feedback(db, batch_id)
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
        query = self.db.query(FacultyUtilization)
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

    def _resolve_faculty(self, faculty_id: Optional[UUID], faculty_name: Optional[str]) -> User:
        if faculty_id:
            faculty = self.db.query(User).filter(User.id == faculty_id, User.is_active.is_(True)).first()
            if faculty:
                return faculty

        if faculty_name and str(faculty_name).strip():
            clean_name = str(faculty_name).strip()
            # Match by full_name case-insensitive with Faculty role
            faculty = self.db.query(User).filter(
                User.role.ilike("faculty"),
                User.full_name.ilike(clean_name),
                User.is_active.is_(True)
            ).first()
            if faculty:
                return faculty

            # Match by full_name case-insensitive across all active users
            faculty = self.db.query(User).filter(
                User.full_name.ilike(clean_name),
                User.is_active.is_(True)
            ).first()
            if faculty:
                return faculty

            # Provision active Faculty user so schedule creation succeeds seamlessly
            slug = re.sub(r'[^a-zA-Z0-9]+', '.', clean_name.lower()).strip('.') or "faculty.trainer"
            email = f"{slug}@ops.faculty.internal"
            counter = 1
            while self.db.query(User).filter(User.email == email).first():
                email = f"{slug}{counter}@ops.faculty.internal"
                counter += 1

            fac_role = self.db.query(Role).filter(Role.system_role == "Faculty").first()
            # Generate a secure random password for auto-provisioned faculty
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            random_password = "".join(secrets.choice(alphabet) for _ in range(16))
            new_faculty = User(
                email=email,
                hashed_password=get_password_hash(random_password),
                full_name=clean_name,
                role="Faculty",
                role_id=fac_role.id if fac_role else None,
                is_active=True
            )
            self.db.add(new_faculty)
            self.db.commit()
            self.db.refresh(new_faculty)
            return new_faculty

        # Fallback to any active faculty in system
        fallback_fac = self.db.query(User).filter(User.role.ilike("faculty"), User.is_active.is_(True)).first()
        if fallback_fac:
            return fallback_fac

        raise HTTPException(status_code=422, detail="faculty_id or faculty_name must be provided to schedule a session")

    def create(self, session_in: SessionCreate, user_id: Optional[UUID] = None) -> FacultyUtilization:
        """Logs a faculty utilization delivery record, optionally linking to a scheduled session day."""
        batch = self.db.query(Batch).filter(Batch.id == session_in.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if user_id:
            self._require_batch_scope(batch, user_id)

        session_dict = session_in.model_dump(exclude_unset=True)
        faculty = self._resolve_faculty(None, session_dict.get("faculty_name"))
        session_dict["faculty_name"] = faculty.full_name

        daily_hours = self.db.query(FacultyUtilization).filter(
            FacultyUtilization.faculty_name.ilike(faculty.full_name),
            FacultyUtilization.date_of_training >= session_in.date_of_training.replace(hour=0, minute=0, second=0, microsecond=0),
            FacultyUtilization.date_of_training < session_in.date_of_training.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1),
            FacultyUtilization.status.notin_(["Cancelled"]),
        ).all()
        existing_hours = sum((row.no_of_hours for row in daily_hours), Decimal("0"))
        conflicts = ConflictEngine.check_session_conflict(
            db=self.db,
            faculty_name=faculty.full_name,
            date_of_training=session_in.date_of_training,
            requested_hours=session_in.no_of_hours,
            existing_hours=existing_hours,
            start_time=session_in.start_time,
            end_time=session_in.end_time,
            faculty_id=faculty.id,
        )
        if conflicts:
            raise HTTPException(status_code=409, detail=[conflict.model_dump() for conflict in conflicts])
        
        session = FacultyUtilization(**session_dict)
        self.db.add(session)

        # If linked to a scheduled training session day, mark it Completed
        if session_in.training_session_id:
            sched = self.db.query(TrainingSession).filter(TrainingSession.id == session_in.training_session_id).first()
            if sched:
                sched.status = "Completed"

        self.db.commit()
        self.db.refresh(session)
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
            faculty = self._resolve_faculty(None, update_dict.get("faculty_name"))
            update_dict["faculty_name"] = faculty.full_name
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
        for field, value in update_dict.items():
            setattr(session, field, value)
        session.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(session)
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
        self.db.commit()
        self.db.refresh(session)

        # Recalculate batch feedback if all sessions are terminal
        _check_and_update_batch_completion(self.db, session.batch_id)

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