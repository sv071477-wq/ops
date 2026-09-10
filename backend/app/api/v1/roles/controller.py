from typing import List, Optional, Any
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.schemas.user import RoleCreate, RoleUpdate, RoleResponse
from app.api.deps import get_current_user, require_admin
from app.api.v1.roles.service import RoleService

router = APIRouter()


def get_role_service(db: Session = Depends(get_db)) -> RoleService:
    return RoleService(db)


@router.get("", response_model=List[RoleResponse])
def list_roles(
    is_active: Optional[bool] = Query(None),
    service: RoleService = Depends(get_role_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """List all configured organizational roles and position titles."""
    return service.list_roles(is_active=is_active)


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_role(
    role_in: RoleCreate,
    service: RoleService = Depends(get_role_service),
    current_user: User = Depends(require_admin)
) -> Any:
    """Admin Only: Add a new organizational role / position title."""
    return service.create_role(role_in)


@router.get("/{id}", response_model=RoleResponse)
def get_role_by_id(
    id: UUID,
    service: RoleService = Depends(get_role_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Fetch details of a specific role by ID."""
    return service.get_role(id)


@router.patch("/{id}", response_model=RoleResponse, dependencies=[Depends(require_admin)])
def update_role(
    id: UUID,
    role_in: RoleUpdate,
    service: RoleService = Depends(get_role_service),
    current_user: User = Depends(require_admin)
) -> Any:
    """Admin Only: Update role name, base system role capability, or active status."""
    return service.update_role(id, role_in)


@router.delete("/{id}", dependencies=[Depends(require_admin)])
def delete_role(
    id: UUID,
    service: RoleService = Depends(get_role_service),
    current_user: User = Depends(require_admin)
) -> Any:
    """Admin Only: Delete a role if no active users are assigned to it."""
    return service.delete_role(id)
