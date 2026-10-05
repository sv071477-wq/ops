from typing import List
from abc import ABC, abstractmethod


class IFmsSyncRepository(ABC):
    """Data-access contract for external FMS integration dispatch history."""

    @abstractmethod
    def list_logs(self, skip: int, limit: int) -> List[dict]:
        """Paginated sync dispatch history, newest first."""
        pass