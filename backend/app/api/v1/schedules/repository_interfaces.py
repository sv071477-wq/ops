from datetime import date
from typing import List, Optional
from uuid import UUID
from abc import ABC, abstractmethod

from app.models.batch import Batch
from app.models.session import TrainingSession
from app.models.user import User


class IScheduleRepository(ABC):
    """Data-access contract for applying an ingested timetable to a batch."""

    @abstractmethod
    def get_batch_by_batch_id(self, batch_id: str) -> Optional[Batch]:
        pass

    @abstractmethod
    def get_batch_by_id(self, batch_id: UUID) -> Optional[Batch]:
        pass

    @abstractmethod
    def get_active_user(self, user_id: UUID) -> Optional[User]:
        pass

    @abstractmethod
    def find_existing_session(self, batch_id: UUID, session_date: date, module: str) -> Optional[TrainingSession]:
        pass

    @abstractmethod
    def list_scheduled_sessions_for_batch(self, batch_id: UUID) -> List[TrainingSession]:
        pass

    @abstractmethod
    def get_scheduled_session_count(self, batch_id: UUID) -> int:
        pass

    @abstractmethod
    def persist_sessions(self, sessions: List[TrainingSession]) -> List[TrainingSession]:
        """Insert every session as one transaction, refreshing each on success."""
        pass

    @abstractmethod
    def commit(self) -> None:
        pass

    @abstractmethod
    def rollback(self) -> None:
        pass