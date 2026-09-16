from typing import Generator, List, Optional, Set
from sqlalchemy import text
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserManagerMapping

security_scheme = HTTPBearer(auto_error=True)


def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme)
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identity format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_uuid, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or inactive",
        )
    return user


def require_roles(allowed_roles: List[str]):
    allowed_lower = {r.lower() for r in allowed_roles}
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = (current_user.role or "").lower()
        if user_role not in allowed_lower:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of roles [{', '.join(allowed_roles)}]. Current role: {current_user.role}",
            )
        return current_user
    return role_checker


# Convenient role dependencies
require_admin = require_roles(["Admin"])
require_manager_or_admin = require_roles(["Admin", "Manager"])
require_coordinator_or_above = require_roles(["Admin", "Manager", "Coordinator"])


def get_all_subordinate_ids(manager_id: UUID, db: Session) -> List[UUID]:
    """Return all direct and indirect subordinate UUIDs under a manager via a single recursive CTE.
    Combines both the self-referential User.manager_id hierarchy and the legacy UserManagerMapping table.
    """
    # Single recursive CTE — avoids the N+1 BFS query loop
    cte_sql = text("""
        WITH RECURSIVE subordinates AS (
            -- Anchor: direct reports via self-referential manager_id
            SELECT u.id
            FROM users u
            WHERE u.manager_id = :manager_id AND u.is_active = TRUE

            UNION

            -- Anchor: legacy coordinator mappings for this manager
            SELECT umm.coordinator_id AS id
            FROM user_manager_mappings umm
            WHERE umm.manager_id = :manager_id

            UNION ALL

            -- Recursive: subordinates of discovered subordinates
            SELECT u2.id
            FROM users u2
            INNER JOIN subordinates s ON u2.manager_id = s.id
            WHERE u2.is_active = TRUE
        )
        SELECT DISTINCT id FROM subordinates
    """)
    rows = db.execute(cte_sql, {"manager_id": str(manager_id)}).fetchall()
    return [UUID(str(row[0])) for row in rows]


def get_managed_coordinator_ids(manager_id: UUID, db: Session) -> List[UUID]:
    """Returns all subordinate UUIDs (direct and nested) under a given manager."""
    return get_all_subordinate_ids(manager_id, db)


def get_manager_scope_user_ids(user: User, db: Session) -> List[UUID]:
    """Return operational ownership scope: managers see their reports; coordinators see only themselves."""
    if (user.role or "").lower() != "manager":
        return [user.id]

    scope_ids: Set[UUID] = {user.id}
    scope_ids.update(get_all_subordinate_ids(user.id, db))
    return list(scope_ids)


def is_manager_or_lead(user: User, db: Session) -> bool:
    """Returns True if user is automatically identified as a Manager (has direct reports) or has Manager/Admin role."""
    if (user.role or "").lower() in ["admin", "manager"]:
        return True
    has_reports = db.query(User.id).filter(User.manager_id == user.id, User.is_active == True).first() is not None
    return has_reports
