from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import Role, User
from app.schemas.user import RoleCreate, RoleUpdate

VALID_SYSTEM_ROLES = {"Admin", "Manager", "Coordinator", "Sales", "Faculty"}


class RoleService:
    def __init__(self, db: Session):
        self.db = db

    def list_roles(self, is_active: Optional[bool] = None) -> List[Role]:
        query = self.db.query(Role)
        if is_active is not None:
            query = query.filter(Role.is_active == is_active)
        return query.order_by(Role.name.asc()).all()

    def get_role(self, role_id: UUID) -> Role:
        role = self.db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
        return role

    def create_role(self, role_in: RoleCreate) -> Role:
        clean_name = role_in.name.strip()
        if not clean_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role name cannot be blank")

        if role_in.system_role not in VALID_SYSTEM_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid system_role '{role_in.system_role}'. Must be one of {list(VALID_SYSTEM_ROLES)}"
            )

        existing = self.db.query(Role).filter(Role.name.ilike(clean_name)).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role with name '{clean_name}' already exists")

        role = Role(
            name=clean_name,
            system_role=role_in.system_role,
            is_active=role_in.is_active
        )
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def update_role(self, role_id: UUID, role_in: RoleUpdate) -> Role:
        role = self.get_role(role_id)
        update_data = role_in.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"]:
            clean_name = update_data["name"].strip()
            existing = self.db.query(Role).filter(Role.name.ilike(clean_name), Role.id != role_id).first()
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role with name '{clean_name}' already exists")
            role.name = clean_name

        if "system_role" in update_data and update_data["system_role"]:
            if update_data["system_role"] not in VALID_SYSTEM_ROLES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid system_role. Must be one of {list(VALID_SYSTEM_ROLES)}"
                )
            role.system_role = update_data["system_role"]

        if "is_active" in update_data and update_data["is_active"] is not None:
            role.is_active = update_data["is_active"]

        self.db.commit()
        self.db.refresh(role)
        return role

    def delete_role(self, role_id: UUID) -> dict:
        role = self.get_role(role_id)
        # Check if users are assigned to this role
        assigned_user_count = self.db.query(User).filter(User.role_id == role_id).count()
        if assigned_user_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete role '{role.name}' because {assigned_user_count} user(s) are currently assigned to it. Deactivate the role instead."
            )
        self.db.delete(role)
        self.db.commit()
        return {"detail": f"Role '{role.name}' successfully deleted"}
