from typing import List, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User, UserManagerMapping
from app.schemas.user import (
    UserCreate, UserResponse, UserLogin, Token,
    CoordinatorMappingCreate, CoordinatorMappingResponse
)
from app.api.deps import get_current_user, require_admin, require_manager_or_admin

router = APIRouter()


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)) -> Any:
    """Issue JWT token on valid credentials."""
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )

    access_token = create_access_token(subject=str(user.id), role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> Any:
    """Fetch profile of authenticated user."""
    return current_user


@router.post("/users", response_model=UserResponse, dependencies=[Depends(require_admin)])
def create_user(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    """Admin-only: Provision a new user."""
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists",
        )
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=user_in.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users/coordinators", response_model=List[UserResponse], dependencies=[Depends(require_manager_or_admin)])
def get_coordinators(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """List coordinators mapped to the current manager, or all coordinators for Admin."""
    if current_user.role == "Admin":
        return db.query(User).filter(User.role == "Coordinator").all()
    
    # Return coordinators mapped to this manager
    mappings = db.query(UserManagerMapping).filter(UserManagerMapping.manager_id == current_user.id).all()
    coord_ids = [m.coordinator_id for m in mappings]
    return db.query(User).filter(User.id.in_(coord_ids)).all()


@router.post("/users/coordinator-mapping", response_model=CoordinatorMappingResponse, dependencies=[Depends(require_manager_or_admin)])
def assign_coordinator_to_manager(
    mapping_in: CoordinatorMappingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Map a coordinator to a manager."""
    coord = db.query(User).filter(User.id == mapping_in.coordinator_id, User.role == "Coordinator").first()
    if not coord:
        raise HTTPException(status_code=404, detail="Coordinator not found")

    manager = db.query(User).filter(User.id == mapping_in.manager_id, User.role.in_(["Manager", "Admin"])).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")

    existing = db.query(UserManagerMapping).filter(
        UserManagerMapping.coordinator_id == mapping_in.coordinator_id,
        UserManagerMapping.manager_id == mapping_in.manager_id
    ).first()
    if existing:
        return existing

    mapping = UserManagerMapping(
        coordinator_id=mapping_in.coordinator_id,
        manager_id=mapping_in.manager_id
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping
