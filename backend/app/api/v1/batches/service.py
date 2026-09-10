from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.user import User
from app.schemas.batch import BatchApprove, BatchCreate, BatchUpdate
from app.schemas.feedback import BatchNpsClosureCreate
from app.api.deps import get_managed_coordinator_ids
from app.api.v1.gates.service import GatekeeperService


class BatchService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, batch_in: BatchCreate, current_user: User) -> Batch:
        if self.db.query(Batch).filter(Batch.batch_id == batch_in.batch_id).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Batch ID '{batch_in.batch_id}' is already registered.")
        batch_data = batch_in.model_dump()
        if current_user.role == "Coordinator" and not batch_data.get("coordinator_id"):
            batch_data["coordinator_id"] = current_user.id
        elif current_user.role == "Sales" and not batch_data.get("sales_spoc_id"):
            batch_data["sales_spoc_id"] = current_user.id
        batch = Batch(**batch_data)
        self.db.add(batch)
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
        if current_user.role == "Manager":
            coordinator_ids = get_managed_coordinator_ids(current_user.id, self.db)
            query = query.filter(or_(Batch.primary_manager_id == current_user.id, Batch.coordinator_id.in_(coordinator_ids)))
        elif current_user.role == "Coordinator":
            query = query.filter(Batch.coordinator_id == current_user.id)
        elif current_user.role == "Sales":
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