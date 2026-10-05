from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import Role, User
from app.api.v1.roles.repository_interfaces import IRoleRepository


class RoleRepository(IRoleRepository):
    def __init__(self, db: Session):
        self.db = db

    def list_roles(self, is_active: Optional[bool] = None) -> List[Role]:
        query = self.db.query(Role)
        if is_active is not None:
            query = query.filter(Role.is_active == is_active)
        return query.order_by(Role.name.asc()).all()

    def get_by_id(self, role_id: UUID) -> Optional[Role]:
        return self.db.query(Role).filter(Role.id == role_id).first()

    def get_assigned_user_count(self, role_id: UUID) -> int:
        return self.db.query(User).filter(User.role_id == role_id).count()

    def create(self, role: Role) -> Role:
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def update(
        self,
        role: Role,
        name: Optional[str] = None,
        system_role: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> Role:
        if name is not None:
            role.name = name
        if system_role is not None:
            role.system_role = system_role
        if is_active is not None:
            role.is_active = is_active
        self.db.commit()
        self.db.refresh(role)
        return role

    def delete(self, role: Role) -> None:
        self.db.delete(role)
        self.db.commit()

    def exists_by_name(self, name: str, exclude_id: Optional[UUID] = None) -> bool:
        query = self.db.query(Role).filter(Role.name.ilike(name))
        if exclude_id:
            query = query.filter(Role.id != exclude_id)
        return query.first() is not None