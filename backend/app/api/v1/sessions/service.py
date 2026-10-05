from datetime import datetime, timedelta, timezone, time
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from fastapi import HTTPException

from app.models.batch import Batch
from app.models.session import FacultyUtilization, TrainingSession
from app.models.user import User
from app.schemas.feedback import SessionFeedbackCreate
from app.schemas.session import (
    SessionCreate, SessionUpdate, SessionOutcomeRequest, SessionRescheduleRequest,
    TrainingSessionCreate,
    TrainingSessionUpdate,
)
from app.api.v1.auth.repository_interfaces import IUserRepository
from app.api.v1.batches.lifecycle_service import BatchLifecycleService
from app.api.v1.gates.service import GatekeeperService
from app.api.v1.schedules.conflict_engine import ConflictEngine
from app.api.v1.sessions.repository_interfaces import ISessionRepository


_TERMINAL_STATUSES = {"Completed", "Cancelled", "Not Conducted"}


class SessionService:
    def __init__(
        self,
        session_repo: ISessionRepository,
        user_repo: IUserRepository,
        lifecycle_service: BatchLifecycleService,
        gatekeeper: GatekeeperService,
    ):
        self.session_repo = session_repo
        self.user_repo = user_repo
        self.lifecycle_service = lifecycle_service
        self.gatekeeper = gatekeeper

    def _check_and_update_batch_completion(self, batch_id: UUID) -> None:
        """Mark the batch Completed once every session (scheduled + logged) is terminal."""
        all_sessions = self.session_repo.list_all_sessions_for_batch(batch_id)
        if not all_sessions:
            return
        if not all(session.status in _TERMINAL_STATUSES for session in all_sessions):
            return

        batch = self.session_repo.get_batch_by_id(batch_id)
        if batch and batch.status not in ("Completed", "Cancelled"):
            batch.status = "Completed"
            batch.updated_at = datetime.now(timezone.utc)
            self.session_repo.commit()

    def list(self, batch_id: Optional[UUID], faculty_name: Optional[str], status_filter: Optional[str], user_id: Optional[UUID] = None) -> List[FacultyUtilization]:
        """Lists actual faculty delivery records (utilization ledger)."""
        if batch_id and user_id:
            batch = self.session_repo.get_batch_by_id(batch_id)
            if batch:
                self._require_batch_scope(batch, user_id)
        return self.session_repo.list_utilizations(
            batch_id=batch_id,
            faculty_name=faculty_name,
            status_filter=status_filter,
        )

    def list_scheduled(self, batch_id: UUID, user_id: Optional[UUID] = None) -> List[dict]:
        """Lists the curriculum schedule days with status and linked utilization details."""
        batch = self.session_repo.get_batch_by_id(batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if user_id:
            self._require_batch_scope(batch, user_id)

        scheduled_days = self.session_repo.list_scheduled_for_batch(batch_id)
        util_map = {
            u.training_session_id: u
            for u in self.session_repo.list_utilizations_for_batch(batch_id)
            if u.training_session_id
        }

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
        session = self.session_repo.get_scheduled_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Scheduled session not found")
        batch = self.session_repo.get_batch_by_id(session.batch_id)
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
        self.session_repo.commit()
        self.session_repo.refresh(session)
        return session

    def create_scheduled(self, session_in: TrainingSessionCreate, user_id: Optional[UUID] = None) -> TrainingSession:
        batch = self.session_repo.get_batch_by_id(session_in.batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if user_id:
            self._require_batch_scope(batch, user_id)
        last_sequence = self.session_repo.get_max_sequence_number(batch.id)
        session = TrainingSession(
            **session_in.model_dump(exclude={"batch_id", "sequence_number"}),
            batch_id=batch.id,
            sequence_number=session_in.sequence_number or ((last_sequence or 0) + 1),
        )
        return self.session_repo.create_scheduled(session)

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
            faculty = self.session_repo.get_active_user(faculty_id)
            if faculty:
                return faculty, faculty.full_name

        clean_name = str(faculty_name).strip() if faculty_name else ""
        if clean_name:
            # Prefer a Faculty-role match, then fall back to any active user.
            faculty = self.session_repo.find_active_faculty_by_name(clean_name, faculty_role_only=True)
            if faculty:
                return faculty, faculty.full_name

            faculty = self.session_repo.find_active_faculty_by_name(clean_name)
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

    @staticmethod
    def _day_bounds(target: datetime) -> tuple[datetime, datetime]:
        day_start = target.replace(hour=0, minute=0, second=0, microsecond=0)
        return day_start, day_start + timedelta(days=1)

    def create(self, session_in: SessionCreate, user_id: Optional[UUID] = None) -> FacultyUtilization:
        """Logs a faculty utilization delivery record, optionally linking to a scheduled session day."""
        batch = self.session_repo.get_batch_by_id(session_in.batch_id)
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

        day_start, day_end = self._day_bounds(session_in.date_of_training)
        daily_hours = self.session_repo.list_daily_deliveries(
            faculty_name, day_start, day_end, excluded_statuses=("Cancelled",)
        )
        existing_hours = self.session_repo.sum_hours(daily_hours)
        conflicts = ConflictEngine.check_session_conflict(
            session_repo=self.session_repo,
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

        session = self.session_repo.create_utilization(FacultyUtilization(**session_dict))

        # If linked to a scheduled training session day and status is Completed, mark it Completed.
        # The timetable has no feedback columns; the rating stays on this ledger row.
        if session_in.training_session_id and session_in.status == "Completed":
            sched = self.session_repo.get_training_session_by_id(session_in.training_session_id)
            if sched:
                sched.status = "Completed"
                self.session_repo.commit()

        # Check and update batch completion/feedback
        self.lifecycle_service.check_and_update_batch_feedback(session.batch_id)

        return session

    def update(self, session_id: UUID, session_in: SessionUpdate, user_id: Optional[UUID] = None) -> FacultyUtilization:
        session = self.session_repo.get_utilization_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        update_dict = session_in.model_dump(exclude_unset=True)
        batch = self.session_repo.get_batch_by_id(session.batch_id)
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
            day_start, day_end = self._day_bounds(target_date)
            existing = self.session_repo.list_daily_deliveries(
                faculty_name, day_start, day_end,
                exclude_id=session.id,
                excluded_statuses=("Cancelled", "Not Conducted"),
            )
            existing_hours = self.session_repo.sum_hours(existing)
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
        self.session_repo.commit()
        self.session_repo.refresh(session)

        # If linked to a scheduled training session day and status changed to Completed, mark it Completed
        if session.training_session_id and not was_completed and will_be_completed:
            sched = self.session_repo.get_training_session_by_id(session.training_session_id)
            if sched:
                sched.status = "Completed"
                self.session_repo.commit()

        # Check and update batch completion/feedback
        self.lifecycle_service.check_and_update_batch_feedback(session.batch_id)

        return session

    def _transition(self, session_id: UUID, status: str, reason: str, user_id: UUID) -> FacultyUtilization:
        session = self.session_repo.get_utilization_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        batch = self.session_repo.get_batch_by_id(session.batch_id)
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
            sched = self.session_repo.get_training_session_by_id(session.training_session_id)
            if sched and sched.status != status:
                sched.status = status
                sched.updated_at = datetime.now(timezone.utc)

        self.session_repo.commit()
        self.session_repo.refresh(session)

        # Mark batch Completed when every (scheduled + logged) session is terminal.
        self._check_and_update_batch_completion(session.batch_id)

        # Delegate feedback calculation to the lifecycle service — it only writes
        # batch_avg_feedback once all non-cancelled sessions are Completed.
        self.lifecycle_service.check_and_update_batch_feedback(session.batch_id)

        return session

    def _require_batch_scope(self, batch: Batch, user_id: UUID) -> None:
        user = self.session_repo.get_active_user(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="Active user not found")
        role = (user.role or "").lower()
        team = (user.team_detail.name if user.team_detail else "").strip().lower()
        if role == "admin" or team == "finance":
            return
        scope_ids = set(self.user_repo.get_manager_scope_user_ids(user))
        batch_user_ids = {batch.primary_manager_id, batch.coordinator_id, batch.sales_spoc_id}
        if not scope_ids.intersection({value for value in batch_user_ids if value is not None}):
            raise HTTPException(status_code=403, detail="You can only view or edit sessions within your manager scope.")

    def cancel(self, session_id: UUID, request: SessionOutcomeRequest, user_id: UUID) -> FacultyUtilization:
        return self._transition(session_id, "Cancelled", request.reason, user_id)

    def mark_not_conducted(self, session_id: UUID, request: SessionOutcomeRequest, user_id: UUID) -> FacultyUtilization:
        return self._transition(session_id, "Not Conducted", request.reason, user_id)

    def reschedule(self, session_id: UUID, request: SessionRescheduleRequest, user_id: UUID) -> FacultyUtilization:
        session = self.session_repo.get_utilization_by_id(session_id)
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
        self.session_repo.commit()
        self.session_repo.refresh(updated)
        return updated

    def complete_gate1(self, session_id: str, feedback: SessionFeedbackCreate, user_id: UUID) -> dict:
        return self.gatekeeper.complete_session_gate1(
            session_id=session_id,
            feedback_data=feedback,
            user_id=user_id,
        )