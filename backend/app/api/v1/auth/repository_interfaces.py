from typing import List, Optional
from uuid import UUID
from abc import ABC, abstractmethod

from app.models.user import (
    AuditEventType,
    AuditLog,
    Role,
    Team,
    User,
    UserManagerMapping,
)
from app.models.batch import ApprovalConfiguration


class IUserRepository(ABC):
    """Data-access contract for users, roles, teams and coordinator mappings."""

    # --- User lookups ---
    @abstractmethod
    def get_by_id(self, user_id: UUID) -> Optional[User]:
        pass

    @abstractmethod
    def get_active_by_id(self, user_id: UUID) -> Optional[User]:
        """Fetch a user only when the account is active."""
        pass

    @abstractmethod
    def get_by_email(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    def exists_by_email(self, email: str, exclude_id: Optional[UUID] = None) -> bool:
        pass

    @abstractmethod
    def list_all(self) -> List[User]:
        pass

    @abstractmethod
    def list_active(self) -> List[User]:
        pass

    @abstractmethod
    def list_by_role(self, role: str) -> List[User]:
        """Active users holding exactly the given system role."""
        pass

    @abstractmethod
    def list_by_team_name(self, team_name: str) -> List[User]:
        """Active users belonging to the named team."""
        pass

    @abstractmethod
    def list_by_ids(self, user_ids: List[UUID]) -> List[User]:
        pass

    # --- Reporting hierarchy ---
    @abstractmethod
    def list_direct_reports(self, manager_id: UUID) -> List[User]:
        pass

    @abstractmethod
    def has_direct_reports(self, manager_id: UUID) -> bool:
        pass

    @abstractmethod
    def get_all_subordinate_ids(self, manager_id: UUID) -> List[UUID]:
        """Transitive reports under a manager across both hierarchy representations."""
        pass

    @abstractmethod
    def get_managed_coordinator_ids(self, manager_id: UUID) -> List[UUID]:
        """Coordinators under a manager, excluding other managers and unrelated roles."""
        pass

    @abstractmethod
    def get_manager_ids_for_coordinator(self, coordinator_id: UUID) -> List[UUID]:
        """Managers a coordinator reports to, from manager_id plus legacy mappings."""
        pass

    @abstractmethod
    def get_manager_scope_user_ids(self, user: User) -> List[UUID]:
        """Operational ownership scope for a user, used to scope batch visibility.

        Managers see themselves plus their coordinators; coordinators see their
        own manager and their peers. Everyone else sees only themselves.
        """
        pass

    # --- Role and team lookups ---
    @abstractmethod
    def get_role_by_id(self, role_id: UUID) -> Optional[Role]:
        pass

    @abstractmethod
    def get_role_by_name(self, name: str) -> Optional[Role]:
        pass

    @abstractmethod
    def get_team_by_id(self, team_id: UUID) -> Optional[Team]:
        pass

    @abstractmethod
    def get_approval_config(self) -> Optional[ApprovalConfiguration]:
        pass

    # --- Mutations ---
    @abstractmethod
    def create(self, user: User) -> User:
        pass

    @abstractmethod
    def update(self, user: User, **fields) -> User:
        pass

    @abstractmethod
    def delete(self, user: User) -> None:
        pass

    @abstractmethod
    def commit(self) -> None:
        pass

    @abstractmethod
    def rollback(self) -> None:
        pass

    # --- Coordinator <-> manager mappings ---
    @abstractmethod
    def get_mapping_by_id(self, mapping_id: UUID) -> Optional[UserManagerMapping]:
        pass

    @abstractmethod
    def get_mapping_by_pair(self, coordinator_id: UUID, manager_id: UUID) -> Optional[UserManagerMapping]:
        pass

    @abstractmethod
    def list_mappings(self) -> List[UserManagerMapping]:
        pass

    @abstractmethod
    def create_mapping(self, mapping: UserManagerMapping) -> UserManagerMapping:
        pass

    @abstractmethod
    def delete_mapping(self, mapping: UserManagerMapping) -> None:
        pass

    # --- Audit ---
    @abstractmethod
    def log_audit_event(
        self,
        event_type: AuditEventType,
        user_id: Optional[UUID] = None,
        user_email: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[str] = None,
    ) -> None:
        """Persist an audit entry; never raises, so audit issues cannot break a request."""
        pass

    @abstractmethod
    def get_audit_logs(self, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        """Retrieve audit logs with pagination, ordered by creation date descending."""
        pass