from typing import List, Any
from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.user import (
    UserCreate, UserResponse, UserLogin, Token,
    CoordinatorMappingCreate, CoordinatorMappingResponse
)
from app.api.deps import get_current_user, require_admin, require_manager_or_admin
from app.api.deps_services import get_auth_service
from app.api.v1.auth.service import AuthService

router = APIRouter()


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, service: AuthService = Depends(get_auth_service)) -> Any:
    return service.authenticate(login_data)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> Any:
    """Fetch profile of authenticated user."""
    return current_user


@router.post("/users", response_model=UserResponse, dependencies=[Depends(require_admin)])
def create_user(user_in: UserCreate, service: AuthService = Depends(get_auth_service)) -> Any:
    return service.create_user(user_in)


@router.get("/users/coordinators", response_model=List[UserResponse], dependencies=[Depends(require_manager_or_admin)])
def get_coordinators(
    service: AuthService = Depends(get_auth_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    return service.list_coordinators(current_user)


@router.post("/users/coordinator-mapping", response_model=CoordinatorMappingResponse, dependencies=[Depends(require_manager_or_admin)])
def assign_coordinator_to_manager(
    mapping_in: CoordinatorMappingCreate,
    service: AuthService = Depends(get_auth_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    return service.assign_coordinator(mapping_in)
