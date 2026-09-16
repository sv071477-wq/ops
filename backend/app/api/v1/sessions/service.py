from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.session import TrainingSession
from app.models.user import User
from app.schemas.feedback import SessionFeedbackCreate
from app.schemas.session import SessionCreate, SessionUpdate, SessionOutcomeRequest, SessionRescheduleRequest
from app.api.v1.gates.service import GatekeeperService
from app.api.v1.schedules.conflict_engine import ConflictEngine
from app.api.deps import get_manager_scope_user_ids


class SessionService:
    def __init__(self, db: Session):
        self.db = db

    def list(self, batch_id: Optional[UUID], faculty_name: Optional[str], status_filter: Optional[str], user_id: Optional[UUID] = None) -> list[TrainingSession]:
        if batch_id and user_id:
            batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
            if batch:
                self._require_batch_scope(batch, user_id)
        query = self.db.query(TrainingSession)
        if batch_id:
            query = query.filter(TrainingSession.batch_id == batch_id)
        if faculty_name:
            query = query.filter(TrainingSession.faculty_name.ilike(f"%{faculty_name}%"))
        if status_filter:
            query = query.filter(TrainingSession.status == status_filter)
        return query.order_by(TrainingSession.date_of_training.asc()).all()

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
            import re
            slug = re.sub(r'[^a-zA-Z0-9]+', '.', clean_name.lower()).strip('.') or "faculty.trainer"
            email = f"{slug}@ops.faculty.internal"
            counter = 1
            while self.db.query(User).filter(User.email == email).first():
                email = f"{slug}{counter}@ops.faculty.internal"
                counter += 1

            from app.core.security import get_password_hash
            from app.models.user import Role
            fac_role = self.db.query(Role).filter(Role.system_role == "Faculty").first()
            new_faculty = User(
                email=email,
                hashed_password=get_password_hash("Faculty@123"),
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

    def create(self, session_in: SessionCreate, user_id: Optional[UUID] = None) -> TrainingSession:
        batch = self.db.query(Batch).filter(Batch.id == session_in.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if user_id:
            self._require_batch_scope(batch, user_id)

        session_dict = session_in.model_dump(exclude_unset=True)
        faculty = self._resolve_faculty(None, session_dict.get("faculty_name"))
        session_dict["faculty_name"] = faculty.full_name

        daily_hours = self.db.query(TrainingSession).filter(
            TrainingSession.faculty_name.ilike(faculty.full_name),
            TrainingSession.date_of_training >= session_in.date_of_training.replace(hour=0, minute=0, second=0, microsecond=0),
            TrainingSession.date_of_training < session_in.date_of_training.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1),
            TrainingSession.status.notin_(["Cancelled"]),
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
        session = TrainingSession(**session_dict)
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def update(self, session_id: UUID, session_in: SessionUpdate, user_id: Optional[UUID] = None) -> TrainingSession:
        session = self.db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
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
            existing = self.db.query(TrainingSession).filter(
                TrainingSession.id != session.id,
                TrainingSession.faculty_name.ilike(faculty_name),
                TrainingSession.date_of_training >= day_start,
                TrainingSession.date_of_training < day_end,
                TrainingSession.status.notin_(["Cancelled", "Not Conducted"]),
            ).all()
            existing_hours = sum((row.no_of_hours for row in existing), Decimal("0"))
            if existing_hours + requested_hours > ConflictEngine.MAX_DAILY_FACULTY_HOURS:
                raise HTTPException(status_code=409, detail="Faculty daily capacity would be exceeded")
        for field, value in update_dict.items():
            setattr(session, field, value)
        session.updated_at = datetime.now().astimezone()
        self.db.commit()
        self.db.refresh(session)
        return session

    def _transition(self, session_id: UUID, status: str, reason: str, user_id: UUID) -> TrainingSession:
        session = self.db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        batch = self.db.query(Batch).filter(Batch.id == session.batch_id).first()
        self._require_batch_scope(batch, user_id)
        if session.status == "Completed":
            raise HTTPException(status_code=409, detail="Completed sessions cannot be changed")
        session.status = status
        session.outcome_reason = reason.strip()
        session.outcome_at = datetime.now().astimezone()
        session.outcome_by = user_id
        session.updated_at = datetime.now().astimezone()
        self.db.commit()
        self.db.refresh(session)
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

    def cancel(self, session_id: UUID, request: SessionOutcomeRequest, user_id: UUID) -> TrainingSession:
        return self._transition(session_id, "Cancelled", request.reason, user_id)

    def mark_not_conducted(self, session_id: UUID, request: SessionOutcomeRequest, user_id: UUID) -> TrainingSession:
        return self._transition(session_id, "Not Conducted", request.reason, user_id)

    def reschedule(self, session_id: UUID, request: SessionRescheduleRequest, user_id: UUID) -> TrainingSession:
        session = self.db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
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
        updated.outcome_at = datetime.now().astimezone()
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