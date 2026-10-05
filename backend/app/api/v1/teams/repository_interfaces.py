from typing import List, Optional
from uuid import UUID
from abc import ABC, abstractmethod

from app.models.user import Team, User
from app.schemas.user import TeamCreate, TeamUpdate, TeamResponse


class ITeamRepository(ABC):
    @abstractmethod
    def list_teams(
        self,
        department: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[Team]:
        pass

    @abstractmethod
    def get_by_id(self, team_id: UUID) -> Optional[Team]:
        pass

    @abstractmethod
    def get_member_count(self, team_id: UUID) -> int:
        pass

    @abstractmethod
    def create(self, team: Team) -> Team:
        pass

    @abstractmethod
    def update(self, team: Team, name: Optional[str] = None, department: Optional[str] = None, description: Optional[str] = None, is_active: Optional[bool] = None) -> Team:
        pass

    @abstractmethod
    def delete(self, team: Team) -> None:
        pass

    @abstractmethod
    def unassign_users(self, team_id: UUID) -> None:
        pass

    @abstractmethod
    def exists_by_name(self, name: str, exclude_id: Optional[UUID] = None) -> bool:
        pass