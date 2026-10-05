from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Sequence
from uuid import UUID
from abc import ABC, abstractmethod

from app.models.batch import Batch
from app.models.session import FacultyUtilization, TrainingSession
from app.models.user import User


class ISessionRepository(ABC):
    """Data-access contract for the delivery ledger and the curriculum timetable."""

    # --- Batch context ---
    @abstractmethod
    def get_batch_by_id(self, batch_id: UUID) -> Optional[Batch]:
        pass

    @abstractmethod
    def list_all_sessions_for_batch(self, batch_id: UUID) -> List[object]:
        """Planned and actual delivery rows for a batch."""
        pass

    # --- Timetable ---
    @abstractmethod
    def list_scheduled_for_batch(self, batch_id: UUID) -> List[TrainingSession]:
        pass

    @abstractmethod
    def get_scheduled_by_id(self, session_id: UUID) -> Optional[TrainingSession]:
        pass

    @abstractmethod
    def get_max_sequence_number(self, batch_id: UUID) -> Optional[int]:
        pass

    @abstractmethod
    def create_scheduled(self, session: TrainingSession) -> TrainingSession:
        pass

    # --- Delivery ledger ---
    @abstractmethod
    def list_utilizations(
        self,
        batch_id: Optional[UUID] = None,
        faculty_name: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> List[FacultyUtilization]:
        pass

    @abstractmethod
    def list_utilizations_for_batch(self, batch_id: UUID) -> List[FacultyUtilization]:
        pass

    @abstractmethod
    def get_utilization_by_id(self, session_id: UUID) -> Optional[FacultyUtilization]:
        pass

    @abstractmethod
    def create_utilization(self, session: FacultyUtilization) -> FacultyUtilization:
        pass

    @abstractmethod
    def get_training_session_by_id(self, session_id: UUID) -> Optional[TrainingSession]:
        pass

    # --- Faculty resolution and daily capacity ---
    @abstractmethod
    def get_active_user(self, user_id: UUID) -> Optional[User]:
        pass

    @abstractmethod
    def find_active_faculty_by_name(self, name: str, faculty_role_only: bool = False) -> Optional[User]:
        pass

    @abstractmethod
    def list_daily_deliveries(
        self,
        faculty_name: str,
        day_start: datetime,
        day_end: datetime,
        exclude_id: Optional[UUID] = None,
        excluded_statuses: Sequence[str] = ("Cancelled",),
    ) -> List[FacultyUtilization]:
        """Deliveries for one faculty member within a day window, for capacity checks."""
        pass

    @abstractmethod
    def list_conflict_window_deliveries(self, faculty_name: str, target_date) -> List[FacultyUtilization]:
        """Non-cancelled deliveries on a date, skipping rows whose batch is cancelled.

        Used for double-booking detection, which needs the stored start/end times
        rather than just the summed hours.
        """
        pass

    @abstractmethod
    def sum_hours(self, rows: List[FacultyUtilization]) -> Decimal:
        pass

    # --- Mutations ---
    @abstractmethod
    def commit(self) -> None:
        pass

    @abstractmethod
    def refresh(self, instance) -> None:
        pass