from typing import List, Optional
from uuid import UUID
from abc import ABC, abstractmethod

from app.models.user import Role, User


class IRoleRepository(ABC):
    @abstractmethod
    def list_roles(self, is_active: Optional[bool] = None) -> List[Role]:
        pass

    @abstractmethod
    def get_by_id(self, role_id: UUID) -> Optional[Role]:
        pass

    @abstractmethod
    def get_assigned_user_count(self, role_id: UUID) -> int:
        pass

    @abstractmethod
    def create(self, role: Role) -> Role:
        pass

    @abstractmethod
    def update(self, role: Role, name: Optional[str] = None, system_role: Optional[str] = None, is_active: Optional[bool] = None) -> Role:
        pass

    @abstractmethod
    def delete(self, role: Role) -> None:
        pass

    @abstractmethod
    def exists_by_name(self, name: str, exclude_id: Optional[UUID] = None) -> bool:
        pass