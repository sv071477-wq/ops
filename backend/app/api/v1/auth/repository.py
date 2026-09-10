from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User, UserManagerMapping


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db

    def find_user_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def find_user(self, user_id: UUID) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def create_user(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def list_coordinators(self, manager_id: Optional[UUID] = None) -> List[User]:
        if manager_id is None:
            return self.db.query(User).filter(User.role == "Coordinator").all()
        ids = [mapping.coordinator_id for mapping in self.db.query(UserManagerMapping).filter(UserManagerMapping.manager_id == manager_id).all()]
        return self.db.query(User).filter(User.id.in_(ids)).all()

    def find_mapping(self, coordinator_id: UUID, manager_id: UUID) -> Optional[UserManagerMapping]:
        return self.db.query(UserManagerMapping).filter(
            UserManagerMapping.coordinator_id == coordinator_id,
            UserManagerMapping.manager_id == manager_id,
        ).first()

    def create_mapping(self, mapping: UserManagerMapping) -> UserManagerMapping:
        self.db.add(mapping)
        self.db.commit()
        self.db.refresh(mapping)
        return mapping