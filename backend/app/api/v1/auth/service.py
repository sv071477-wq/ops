from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token, create_refresh_token, get_password_hash, verify_password, validate_password_strength,
    decode_refresh_token
)
from app.core.config import settings
from app.core.email import generate_random_password, email_service
from app.models.user import User, UserManagerMapping, Role, Team, AuditLog, AuditEventType
from app.models.batch import ApprovalConfiguration
from app.schemas.user import (
    CoordinatorMappingCreate, UserCreate, UserLogin, UserResponse, UserHierarchyNode, UserUpdate,
    ChangePasswordRequest, AdminResetPasswordRequest, TokenPair, AdminUserCreate
)


def log_audit_event(
    db: Session,
    event_type: AuditEventType,
    user_id: Optional[UUID] = None,
    user_email: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[str] = None
) -> None:
    """Log security audit event."""
    try:
        audit = AuditLog(
            event_type=event_type,
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details
        )
        db.add(audit)
        db.commit()
    except Exception:
        # Don't let audit logging failures break the main flow
        db.rollback()


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def authenticate(self, login_data: UserLogin, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> dict:
        user = self.db.query(User).filter(User.email == login_data.email).first()
        
        # Check account lockout
        if user and user.locked_until and user.locked_until > datetime.now(timezone.utc):
            log_audit_event(
                self.db, AuditEventType.LOGIN_FAILED,
                user_id=user.id, user_email=user.email,
                ip_address=ip_address, user_agent=user_agent,
                details="Account locked"
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account temporarily locked. Try again after {user.locked_until.strftime('%H:%M:%S UTC')}"
            )
        
        if not user or not verify_password(login_data.password, user.hashed_password):
            # Increment failed attempts
            if user:
                user.failed_login_attempts += 1
                was_locked = False
                if user.failed_login_attempts >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
                    user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.LOCKOUT_DURATION_MINUTES)
                    was_locked = True
                    log_audit_event(
                        self.db, AuditEventType.ACCOUNT_LOCKED,
                        user_id=user.id, user_email=user.email,
                        ip_address=ip_address, user_agent=user_agent,
                        details=f"Account locked after {user.failed_login_attempts} failed attempts"
                    )
                self.db.commit()
            
            log_audit_event(
                self.db, AuditEventType.LOGIN_FAILED,
                user_id=user.id if user else None, user_email=login_data.email,
                ip_address=ip_address, user_agent=user_agent,
                details=f"Invalid password (attempt {user.failed_login_attempts if user else 1})"
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
        
        if not user.is_active:
            log_audit_event(
                self.db, AuditEventType.LOGIN_FAILED,
                user_id=user.id, user_email=user.email,
                ip_address=ip_address, user_agent=user_agent,
                details="Inactive account"
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user account")
        
        # Reset failed attempts on successful login
        was_locked = user.locked_until is not None
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = datetime.now(timezone.utc)
        self.db.commit()
        
        if was_locked:
            log_audit_event(
                self.db, AuditEventType.ACCOUNT_UNLOCKED,
                user_id=user.id, user_email=user.email,
                ip_address=ip_address, user_agent=user_agent,
                details="Account unlocked by successful login"
            )
        
        log_audit_event(
            self.db, AuditEventType.LOGIN_SUCCESS,
            user_id=user.id, user_email=user.email,
            ip_address=ip_address, user_agent=user_agent,
            details="User logged in successfully"
        )
        
        # Enrich user response
        user_resp = self._enrich_user(user)
        return {
            "access_token": create_access_token(subject=str(user.id), role=user.role),
            "refresh_token": create_refresh_token(subject=str(user.id)),
            "token_type": "bearer",
            "user": user_resp,
        }

    def _enrich_user(self, user: User) -> UserResponse:
        direct_count = self.db.query(User).filter(User.manager_id == user.id, User.is_active == True).count()
        mgr_name = user.manager.full_name if user.manager else None
        team_name = user.team_detail.name if user.team_detail else None
        department = user.team_detail.department if user.team_detail else None
        approval_config = self.db.query(ApprovalConfiguration).first()
        
        is_mgr = direct_count > 0 or (user.role or "").lower() in ["admin", "manager"]
        
        resp = UserResponse.model_validate(user)
        resp.manager_name = mgr_name
        resp.is_manager = is_mgr
        resp.direct_reports_count = direct_count
        resp.team_name = team_name
        resp.department = department
        resp.is_configured_approver = bool(
            approval_config
            and user.id in {approval_config.approver_1_id, approval_config.approver_2_id}
        )
        return resp

    def create_user(self, user_in: UserCreate) -> UserResponse:
        # Validate password strength
        password_errors = validate_password_strength(user_in.password)
        if password_errors:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="; ".join(password_errors))
        
        if self.db.query(User).filter(User.email == user_in.email).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")

        role_id = user_in.role_id
        resolved_system_role = user_in.role

        if role_id:
            role_obj = self.db.query(Role).filter(Role.id == role_id).first()
            if not role_obj:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected role not found")
            resolved_system_role = role_obj.system_role
        else:
            role_obj = self.db.query(Role).filter(Role.name.ilike(user_in.role)).first()
            if role_obj:
                role_id = role_obj.id
                resolved_system_role = role_obj.system_role

        team_id = user_in.team_id
        if team_id:
            team_obj = self.db.query(Team).filter(Team.id == team_id).first()
            if not team_obj:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected team not found")

        if user_in.manager_id:
            manager_obj = self.db.query(User).filter(User.id == user_in.manager_id).first()
            if not manager_obj:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned manager not found")

        user = User(
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            role=resolved_system_role,
            role_id=role_id,
            team_id=team_id,
            manager_id=user_in.manager_id,
            is_active=user_in.is_active,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return self._enrich_user(user)

    def create_user_by_admin(self, user_in: AdminUserCreate, admin_user: User, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> dict:
        """Admin creates a new user with auto-generated password and sends welcome email."""
        if self.db.query(User).filter(User.email == user_in.email).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")

        role_id = user_in.role_id
        resolved_system_role = user_in.role

        if role_id:
            role_obj = self.db.query(Role).filter(Role.id == role_id).first()
            if not role_obj:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected role not found")
            resolved_system_role = role_obj.system_role
        else:
            role_obj = self.db.query(Role).filter(Role.name.ilike(user_in.role)).first()
            if role_obj:
                role_id = role_obj.id
                resolved_system_role = role_obj.system_role

        team_id = user_in.team_id
        if team_id:
            team_obj = self.db.query(Team).filter(Team.id == team_id).first()
            if not team_obj:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected team not found")

        if user_in.manager_id:
            manager_obj = self.db.query(User).filter(User.id == user_in.manager_id).first()
            if not manager_obj:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned manager not found")

        # Generate random password
        plain_password = generate_random_password()
        
        user = User(
            email=user_in.email,
            hashed_password=get_password_hash(plain_password),
            full_name=user_in.full_name,
            role=resolved_system_role,
            role_id=role_id,
            team_id=team_id,
            manager_id=user_in.manager_id,
            is_active=user_in.is_active,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        # Log audit event
        log_audit_event(
            self.db, AuditEventType.USER_CREATED,
            user_id=user.id, user_email=user.email,
            ip_address=ip_address, user_agent=user_agent,
            details=f"User created by admin {admin_user.email}"
        )

        # Send welcome email if requested
        email_sent = False
        if user_in.send_welcome_email:
            import asyncio
            try:
                email_sent = asyncio.run(email_service.send_welcome_email(
                    to_email=user.email,
                    full_name=user.full_name,
                    password=plain_password
                ))
            except Exception as e:
                print(f"[EMAIL] Failed to send welcome email: {e}")
                email_sent = False

        user_resp = self._enrich_user(user)
        
        return {
            "user": user_resp,
            "password": plain_password,
            "email_sent": email_sent
        }

    def update_user(self, user_id: UUID, user_in: UserUpdate) -> UserResponse:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        update_data = user_in.model_dump(exclude_unset=True)

        if "email" in update_data:
            email = str(update_data["email"]).lower().strip()
            existing = self.db.query(User).filter(User.email == email, User.id != user_id).first()
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")
            user.email = email

        if "full_name" in update_data:
            full_name = (update_data["full_name"] or "").strip()
            if not full_name:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Full name cannot be blank")
            user.full_name = full_name

        if "role_id" in update_data or "role" in update_data:
            role_id = update_data.get("role_id")
            role_obj = self.db.query(Role).filter(Role.id == role_id).first() if role_id else None
            if role_id and not role_obj:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected role not found")
            if role_obj:
                user.role_id = role_obj.id
                user.role = role_obj.system_role
            elif "role" in update_data and update_data["role"]:
                user.role = update_data["role"]
                user.role_id = None

        if "team_id" in update_data:
            from app.models.user import Team
            if update_data["team_id"] and not self.db.query(Team).filter(Team.id == update_data["team_id"]).first():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Selected team not found")
            user.team_id = update_data["team_id"]

        if "manager_id" in update_data:
            manager_id = update_data["manager_id"]
            if manager_id == user_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user cannot report to themselves")
            if manager_id and not self.db.query(User).filter(User.id == manager_id).first():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned manager not found")
            user.manager_id = manager_id

        if "is_active" in update_data and update_data["is_active"] is not None:
            user.is_active = update_data["is_active"]
        if "password" in update_data and update_data["password"]:
            password_errors = validate_password_strength(update_data["password"])
            if password_errors:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="; ".join(password_errors))
            user.hashed_password = get_password_hash(update_data["password"])

        self.db.commit()
        self.db.refresh(user)
        return self._enrich_user(user)

    def delete_user(self, user_id: UUID) -> dict:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        self.db.delete(user)
        self.db.commit()
        return {"detail": f"User '{user.email}' successfully deleted"}

    def change_my_password(self, user: User, data: ChangePasswordRequest, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> dict:
        if not verify_password(data.current_password, user.hashed_password):
            log_audit_event(
                self.db, AuditEventType.PASSWORD_CHANGE,
                user_id=user.id, user_email=user.email,
                ip_address=ip_address, user_agent=user_agent,
                details="Failed: incorrect current password"
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
        
        password_errors = validate_password_strength(data.new_password)
        if password_errors:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="; ".join(password_errors))
        
        user.hashed_password = get_password_hash(data.new_password)
        self.db.commit()
        
        log_audit_event(
            self.db, AuditEventType.PASSWORD_CHANGE,
            user_id=user.id, user_email=user.email,
            ip_address=ip_address, user_agent=user_agent,
            details="Password changed by user"
        )
        return {"detail": "Password successfully updated"}

    def admin_reset_user_password(self, user_id: UUID, new_password: str, admin_user: Optional[User] = None, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> dict:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
        password_errors = validate_password_strength(new_password)
        if password_errors:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="; ".join(password_errors))
        
        user.hashed_password = get_password_hash(new_password)
        # Also unlock account if locked
        was_locked = user.locked_until is not None
        user.failed_login_attempts = 0
        user.locked_until = None
        self.db.commit()
        
        log_audit_event(
            self.db, AuditEventType.PASSWORD_RESET_ADMIN,
            user_id=user.id, user_email=user.email,
            ip_address=ip_address, user_agent=user_agent,
            details=f"Password reset by admin {admin_user.email if admin_user else 'unknown'}" + (" (account unlocked)" if was_locked else "")
        )
        return {"detail": f"Password for '{user.email}' successfully updated"}

    def refresh_tokens(self, refresh_token: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> TokenPair:
        """Generate new access token from refresh token."""
        payload = decode_refresh_token(refresh_token)
        if not payload:
            log_audit_event(
                self.db, AuditEventType.REFRESH_TOKEN_FAILED,
                ip_address=ip_address, user_agent=user_agent,
                details="Invalid or expired refresh token"
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
        
        user_id = payload.get("sub")
        if not user_id:
            log_audit_event(
                self.db, AuditEventType.REFRESH_TOKEN_FAILED,
                ip_address=ip_address, user_agent=user_agent,
                details="Invalid token payload"
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        
        user = self.db.query(User).filter(User.id == UUID(user_id), User.is_active == True).first()
        if not user:
            log_audit_event(
                self.db, AuditEventType.REFRESH_TOKEN_FAILED,
                ip_address=ip_address, user_agent=user_agent,
                details="User not found or inactive"
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or inactive")
        
        user_resp = self._enrich_user(user)
        
        log_audit_event(
            self.db, AuditEventType.REFRESH_TOKEN_USED,
            user_id=user.id, user_email=user.email,
            ip_address=ip_address, user_agent=user_agent,
            details="Access token refreshed"
        )
        
        return TokenPair(
            access_token=create_access_token(subject=str(user.id), role=user.role),
            refresh_token=create_refresh_token(subject=str(user.id)),
            token_type="bearer",
            user=user_resp,
        )


    def list_all_users(self) -> List[UserResponse]:
        users = self.db.query(User).order_by(User.created_at.desc()).all()
        return [self._enrich_user(u) for u in users]

    def get_user_profile(self, user_id: UUID) -> UserResponse:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return self._enrich_user(user)

    def get_organization_hierarchy(self) -> List[Dict[str, Any]]:
        """Returns the full hierarchical tree of the organization."""
        all_users = self.db.query(User).filter(User.is_active == True).all()
        
        # Build node dictionary
        nodes: Dict[UUID, Dict[str, Any]] = {}
        for u in all_users:
            nodes[u.id] = {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "role_name": u.role_detail.name if u.role_detail else u.role,
                "team_name": u.team_detail.name if u.team_detail else None,
                "department": u.team_detail.department if u.team_detail else None,
                "manager_id": u.manager_id,
                "direct_reports": []
            }

        # Build trees
        root_nodes = []
        for u in all_users:
            if u.manager_id and u.manager_id in nodes:
                nodes[u.manager_id]["direct_reports"].append(nodes[u.id])
            else:
                root_nodes.append(nodes[u.id])

        return root_nodes

    def list_coordinators(self, current_user: User) -> List[UserResponse]:
        if (current_user.role or "").lower() == "admin":
            coords = self.db.query(User).filter(User.role == "Coordinator").all()
            return [self._enrich_user(c) for c in coords]
        
        # All direct & indirect reports
        from app.api.deps import get_managed_coordinator_ids
        sub_ids = get_managed_coordinator_ids(current_user.id, self.db)
        coords = self.db.query(User).filter(User.id.in_(sub_ids)).all()
        return [self._enrich_user(c) for c in coords]

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

        # Also update self-referential manager_id for direct alignment
        coordinator.manager_id = manager.id

        existing = self.db.query(UserManagerMapping).filter(
            UserManagerMapping.coordinator_id == mapping_in.coordinator_id,
            UserManagerMapping.manager_id == mapping_in.manager_id,
        ).first()
        if existing:
            self.db.commit()
            return existing

        mapping = UserManagerMapping(
            coordinator_id=mapping_in.coordinator_id,
            manager_id=mapping_in.manager_id,
        )
        self.db.add(mapping)
        self.db.commit()
        self.db.refresh(mapping)
        return mapping

    def list_mappings(self):
        """List all coordinator-manager mappings with names enriched (Admin only)."""
        from app.schemas.user import CoordinatorMappingListResponse
        mappings = self.db.query(UserManagerMapping).order_by(UserManagerMapping.assigned_at.desc()).all()
        results = []
        for m in mappings:
            results.append(CoordinatorMappingListResponse(
                id=m.id,
                coordinator_id=m.coordinator_id,
                coordinator_name=m.coordinator.full_name if m.coordinator else None,
                coordinator_email=m.coordinator.email if m.coordinator else None,
                manager_id=m.manager_id,
                manager_name=m.manager.full_name if m.manager else None,
                manager_email=m.manager.email if m.manager else None,
                assigned_at=m.assigned_at,
            ))
        return results

    def delete_mapping(self, mapping_id: UUID) -> dict:
        """Remove a coordinator-manager mapping by its ID (Admin only)."""
        mapping = self.db.query(UserManagerMapping).filter(UserManagerMapping.id == mapping_id).first()
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        self.db.delete(mapping)
        self.db.commit()
        return {"detail": "Coordinator-manager mapping removed successfully"}