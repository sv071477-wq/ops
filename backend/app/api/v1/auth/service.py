from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User, UserManagerMapping
from app.schemas.user import CoordinatorMappingCreate, UserCreate, UserLogin


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def authenticate(self, login_data: UserLogin) -> dict:
        user = self.db.query(User).filter(User.email == login_data.email).first()
        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")
        return {
            "access_token": create_access_token(subject=str(user.id), role=user.role),
            "token_type": "bearer",
            "user": user,
        }

    def create_user(self, user_in: UserCreate) -> User:
        if self.db.query(User).filter(User.email == user_in.email).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")
        user = User(
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            role=user_in.role,
            is_active=user_in.is_active,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def list_coordinators(self, current_user: User) -> List[User]:
        if current_user.role == "Admin":
            return self.db.query(User).filter(User.role == "Coordinator").all()
        mapping_query = self.db.query(UserManagerMapping).filter(UserManagerMapping.manager_id == current_user.id)
        coordinator_ids = [mapping.coordinator_id for mapping in mapping_query.all()]
        return self.db.query(User).filter(User.id.in_(coordinator_ids)).all()

    def assign_coordinator(self, mapping_in: CoordinatorMappingCreate) -> UserManagerMapping:
        coordinator = self.db.query(User).filter(
            User.id == mapping_in.coordinator_id,
            User.role == "Coordinator",
        ).first()
        if not coordinator:
            raise HTTPException(status_code=404, detail="Coordinator not found")

        manager = self.db.query(User).filter(
            User.id == mapping_in.manager_id,
            User.role.in_(["Manager", "Admin"]),
        ).first()
        if not manager:
            raise HTTPException(status_code=404, detail="Manager not found")

        existing = self.db.query(UserManagerMapping).filter(
            UserManagerMapping.coordinator_id == mapping_in.coordinator_id,
            UserManagerMapping.manager_id == mapping_in.manager_id,
        ).first()
        if existing:
            return existing

        mapping = UserManagerMapping(
            coordinator_id=mapping_in.coordinator_id,
            manager_id=mapping_in.manager_id,
        )
        self.db.add(mapping)
        self.db.commit()
        self.db.refresh(mapping)
        return mapping