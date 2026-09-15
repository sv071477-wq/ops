from typing import List, Any
from fastapi import APIRouter, Depends, Query
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse, UserLogin, Token,
    CoordinatorMappingCreate, CoordinatorMappingResponse, CoordinatorMappingListResponse, UserHierarchyNode
)
from app.api.deps import get_current_user, require_admin, require_manager_or_admin
from app.api.deps_services import get_auth_service
from app.api.v1.auth.service import AuthService
from app.core.database import get_db

router = APIRouter()


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, service: AuthService = Depends(get_auth_service)) -> Any:
    return service.authenticate(login_data)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user), service: AuthService = Depends(get_auth_service)) -> Any:
    """Fetch profile of authenticated user."""
    return service._enrich_user(current_user)


@router.get("/my-reports", response_model=List[UserResponse])
def get_my_reports(current_user: User = Depends(get_current_user), service: AuthService = Depends(get_auth_service)) -> Any:
    """Fetch list of active users reporting directly to the authenticated user."""
    reports = service.db.query(User).filter(User.manager_id == current_user.id, User.is_active.is_(True)).all()
    return [service._enrich_user(u) for u in reports]


@router.get("/users", response_model=List[UserResponse], dependencies=[Depends(require_admin)])
def list_users(service: AuthService = Depends(get_auth_service)) -> Any:
    """Admin Only: List all organization users with their assigned roles."""
    return service.list_all_users()


@router.get("/users/assignable", response_model=List[UserResponse])
def list_assignable_users(
    role: str = Query(..., pattern="^(Sales|Coordinator|Manager)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return db.query(User).filter(User.role == role, User.is_active.is_(True)).order_by(User.full_name).all()


@router.get("/hierarchy", response_model=List[UserHierarchyNode], dependencies=[Depends(get_current_user)])
def get_organization_hierarchy(service: AuthService = Depends(get_auth_service)) -> Any:
    """Fetch the full organization reporting tree."""
    return service.get_organization_hierarchy()


@router.post("/users", response_model=UserResponse, dependencies=[Depends(require_admin)])
def create_user(user_in: UserCreate, service: AuthService = Depends(get_auth_service)) -> Any:
    return service.create_user(user_in)


@router.patch("/users/{id}", response_model=UserResponse, dependencies=[Depends(require_admin)])
def update_user(
    id: UUID,
    user_in: UserUpdate,
    service: AuthService = Depends(get_auth_service),
    current_user: User = Depends(require_admin),
) -> Any:
    """Admin Only: Update a staff member's account and organization assignments."""
    return service.update_user(id, user_in)


@router.delete("/users/{id}", dependencies=[Depends(require_admin)])
def delete_user(
    id: UUID,
    service: AuthService = Depends(get_auth_service),
    current_user: User = Depends(require_admin),
) -> Any:
    """Admin Only: Delete a staff member's account."""
    if id == current_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own admin account")
    return service.delete_user(id)


@router.get("/users/coordinators", response_model=List[UserResponse], dependencies=[Depends(require_manager_or_admin)])
def get_coordinators(
    service: AuthService = Depends(get_auth_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    return service.list_coordinators(current_user)


@router.post("/users/coordinator-mapping", response_model=CoordinatorMappingResponse, dependencies=[Depends(require_admin)])
def assign_coordinator_to_manager(
    mapping_in: CoordinatorMappingCreate,
    service: AuthService = Depends(get_auth_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Admin Only: Assign a coordinator to a manager (shared coordinator mapping)."""
    return service.assign_coordinator(mapping_in)


@router.get("/coordinator-mappings", response_model=List[CoordinatorMappingListResponse], dependencies=[Depends(require_admin)])
def list_coordinator_mappings(
    service: AuthService = Depends(get_auth_service),
) -> Any:
    """Admin Only: List all existing coordinator-manager assignments."""
    return service.list_mappings()


@router.delete("/coordinator-mappings/{mapping_id}", dependencies=[Depends(require_admin)])
def delete_coordinator_mapping(
    mapping_id: UUID,
    service: AuthService = Depends(get_auth_service),
) -> Any:
    """Admin Only: Remove a coordinator-manager assignment by its mapping ID."""
    return service.delete_mapping(mapping_id)
