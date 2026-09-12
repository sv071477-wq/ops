from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.batch import (
    Accommodation,
    ApprovalConfiguration,
    Batch,
    BatchCategory,
    DeliveryMode,
    Entity,
)
from app.models.user import User
from app.schemas.batch import ApprovalConfigurationBase, ApprovalDecision, BatchApprove, BatchCreate, BatchUpdate
from app.schemas.feedback import BatchNpsClosureCreate
from app.api.deps import get_managed_coordinator_ids
from app.api.v1.gates.service import GatekeeperService


class BatchService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, batch_in: BatchCreate, current_user: User) -> Batch:
        if self.db.query(Batch).filter(Batch.batch_id == batch_in.batch_id).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Batch ID '{batch_in.batch_id}' is already registered.")
        batch_data = batch_in.model_dump(exclude_none=True)
        batch_data.pop("batch_request_date", None)
        batch_data["calendar_days"] = self._calendar_days(batch_data.get("start_date"), batch_data.get("end_date"))
        batch_data["category_id"] = self._option_id(BatchCategory, batch_data.get("category_id"), batch_data.get("category", "Bootcamp"))
        batch_data["delivery_mode_id"] = self._option_id(DeliveryMode, batch_data.get("delivery_mode_id"), batch_data.get("delivery_mode", "Online"))
        batch_data["accommodation_id"] = self._option_id(Accommodation, batch_data.get("accommodation_id"), batch_data.get("residential_type", "NR"))
        batch_data["entity_id"] = self._option_id(Entity, batch_data.get("entity_id"), "Default")
        batch_data["batch_request_date"] = datetime.now(timezone.utc)
        batch_data["status"] = "Requested"
        config = self.db.query(ApprovalConfiguration).first()
        if config:
            batch_data["approver_1_id"] = config.approver_1_id
            batch_data["approver_2_id"] = config.approver_2_id
        if current_user.role == "Coordinator" and not batch_data.get("coordinator_id"):
            batch_data["coordinator_id"] = current_user.id
        elif current_user.role == "Sales" and not batch_data.get("sales_spoc_id"):
            batch_data["sales_spoc_id"] = current_user.id
        batch = Batch(**batch_data)
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    @staticmethod
    def _calendar_days(start_date, end_date) -> int:
        if not start_date or not end_date:
            return 0
        if end_date < start_date:
            raise HTTPException(status_code=422, detail="end_date must be on or after start_date")
        return (end_date.date() - start_date.date()).days

    def _option_id(self, model, option_id, legacy_name: str):
        if option_id:
            option = self.db.query(model).filter(model.id == option_id, model.is_active.is_(True)).first()
            if not option:
                raise HTTPException(status_code=422, detail=f"Inactive or invalid {model.__tablename__} option")
            return option.id
        normalized = "Non-Residential" if legacy_name == "NR" else "Residential" if legacy_name == "R" else legacy_name
        option = self.db.query(model).filter(model.name == normalized).first()
        if not option:
            option = model(name=normalized, is_active=True)
            self.db.add(option)
            self.db.flush()
        return option.id

    def get_approval_config(self) -> ApprovalConfiguration:
        config = self.db.query(ApprovalConfiguration).first()
        if not config:
            config = ApprovalConfiguration()
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        return config

    def update_approval_config(self, config_in: ApprovalConfigurationBase) -> ApprovalConfiguration:
        config = self.get_approval_config()
        values = config_in.model_dump(exclude_unset=True)
        for field, value in values.items():
            if value:
                user = self.db.query(User).filter(User.id == value, User.is_active.is_(True)).first()
                if not user or user.role.lower() not in {"admin", "manager"}:
                    raise HTTPException(status_code=422, detail=f"{field} must reference an active Admin or Manager")
            setattr(config, field, value)
        self.db.commit()
        self.db.refresh(config)
        return config

    def submit_for_approval(self, batch_id: UUID) -> Batch:
        batch = self.get(batch_id)
        config = self.get_approval_config()
        if not config.approver_1_id or not config.approver_2_id:
            raise HTTPException(status_code=409, detail="Admin must configure both approvers before submission")
        batch.approver_1_id = config.approver_1_id
        batch.approver_2_id = config.approver_2_id
        batch.approver_1_status = "Pending"
        batch.approver_2_status = "Pending"
        batch.status = "Approval 1 Pending"
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def decide(self, batch_id: UUID, level: int, decision: ApprovalDecision, current_user: User) -> Batch:
        batch = self.get(batch_id)
        expected_id = batch.approver_1_id if level == 1 else batch.approver_2_id
        if expected_id != current_user.id:
            raise HTTPException(status_code=403, detail=f"Only the configured approver {level} can decide this request")
        if level == 2 and batch.approver_1_status != "Approved":
            raise HTTPException(status_code=409, detail="Approver 1 must approve before Approver 2")
        if decision.decision == "reject":
            if level == 1:
                batch.approver_1_status = "Rejected"
            else:
                batch.approver_2_status = "Rejected"
            batch.status = "Requested"
            if decision.reason:
                batch.comments = f"Approval {level} rejected: {decision.reason}"
        elif level == 1:
            batch.approver_1_status = "Approved"
            batch.approver_1_approved_at = datetime.now(timezone.utc)
            batch.status = "Approval 2 Pending"
        else:
            batch.approver_2_status = "Approved"
            batch.approver_2_approved_at = datetime.now(timezone.utc)
            batch.status = "Approved"
            batch.is_schema_locked = True
        batch.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def approve(self, batch_id: UUID, approval: BatchApprove, current_user: User) -> Batch:
        batch = self.get(batch_id)
        batch.approval_id = approval.approval_id
        batch.status = "Approved"
        batch.is_schema_locked = True
        batch.updated_at = datetime.now(timezone.utc)
        if not batch.primary_manager_id:
            batch.primary_manager_id = current_user.id
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def list(self, current_user: User, status_filter: Optional[str], domain: Optional[str], category: Optional[str], client_name: Optional[str], search: Optional[str], skip: int, limit: int) -> List[Batch]:
        query = self.db.query(Batch)
        user_role_lower = (current_user.role or "").lower()

        if user_role_lower != "admin":
            subordinate_ids = get_managed_coordinator_ids(current_user.id, self.db)
            if subordinate_ids or user_role_lower == "manager":
                team_user_ids = subordinate_ids + [current_user.id]
                query = query.filter(or_(
                    Batch.primary_manager_id.in_(team_user_ids),
                    Batch.coordinator_id.in_(team_user_ids),
                    Batch.sales_spoc_id.in_(team_user_ids)
                ))
            elif user_role_lower == "coordinator":
                query = query.filter(Batch.coordinator_id == current_user.id)
            elif user_role_lower == "sales":
                query = query.filter(Batch.sales_spoc_id == current_user.id)
        if status_filter:
            query = query.filter(Batch.status == status_filter)
        if domain:
            query = query.filter(Batch.domain == domain)
        if category:
            query = query.filter(Batch.category == category)
        if client_name:
            query = query.filter(Batch.client_name.ilike(f"%{client_name}%"))
        if search:
            term = f"%{search.strip()}%"
            query = query.filter(or_(Batch.batch_id.ilike(term), Batch.program_name.ilike(term), Batch.client_name.ilike(term), Batch.technology.ilike(term), Batch.location_city.ilike(term)))
        return query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()

    def get(self, batch_id: UUID) -> Batch:
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        return batch

    def update(self, batch_id: UUID, batch_in: BatchUpdate, current_user: User) -> Batch:
        batch = self.get(batch_id)
        update_data = batch_in.model_dump(exclude_unset=True)
        update_data.pop("batch_request_date", None)
        if "start_date" in update_data or "end_date" in update_data:
            update_data["calendar_days"] = self._calendar_days(
                update_data.get("start_date", batch.start_date),
                update_data.get("end_date", batch.end_date),
            )
        if batch.is_schema_locked and current_user.role not in ["Admin", "Manager"]:
            restricted = {"client_name", "category", "program_name", "technology", "domain"}
            for field in restricted.intersection(update_data):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Batch schema is locked. Modifying '{field}' requires Manager or Admin authorization.")
        for field, value in update_data.items():
            setattr(batch, field, value)
        batch.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def close_gate2(self, batch_id: UUID, closure: BatchNpsClosureCreate, user_id: UUID) -> Batch:
        return GatekeeperService.close_batch_gate2(
            db=self.db,
            batch_id=batch_id,
            closure_data=closure,
            user_id=user_id,
        )