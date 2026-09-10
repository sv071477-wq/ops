from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.batch import Batch
from app.models.user import User
from app.schemas.batch import (
    BatchCreate, BatchUpdate, BatchApprove, BatchResponse, BatchDetailResponse
)
from app.schemas.feedback import BatchNpsClosureCreate
from app.api.deps import (
    get_current_user, require_manager_or_admin, require_coordinator_or_above,
    get_managed_coordinator_ids
)
from app.services.gatekeeper import GatekeeperService
from app.services.notifier import NotificationService

router = APIRouter()


@router.post("", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    batch_in: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """Workflow 1: Create a new batch in 'Requested' status."""
    existing = db.query(Batch).filter(Batch.batch_id == batch_in.batch_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch ID '{batch_in.batch_id}' is already registered."
        )

    batch_data = batch_in.model_dump()
    if current_user.role == "Coordinator" and not batch_data.get("coordinator_id"):
        batch_data["coordinator_id"] = current_user.id
    elif current_user.role == "Sales" and not batch_data.get("sales_spoc_id"):
        batch_data["sales_spoc_id"] = current_user.id

    batch = Batch(**batch_data)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/{id}/approve", response_model=BatchResponse)
async def approve_batch(
    id: UUID,
    approve_in: BatchApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin)
) -> Any:
    """Manager Approval: Locks schema, assigns financial SOW Approval ID, transitions status to 'Approved'."""
    batch = db.query(Batch).filter(Batch.id == id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch.approval_id = approve_in.approval_id
    batch.status = "Approved"
    batch.is_schema_locked = True
    batch.updated_at = datetime.now(timezone.utc)
    
    if not batch.primary_manager_id:
        batch.primary_manager_id = current_user.id

    db.commit()
    db.refresh(batch)

    # Trigger Async Notification
    try:
        await NotificationService.notify_batch_approved(
            batch_id=batch.batch_id,
            approval_id=batch.approval_id,
            manager_email=batch.primary_manager.email if batch.primary_manager else None,
            sales_email=batch.sales_spoc.email if batch.sales_spoc else None
        )
    except Exception:
        pass

    return batch


@router.get("", response_model=List[BatchResponse])
def list_batches(
    status_filter: Optional[str] = Query(None, alias="status"),
    domain: Optional[str] = None,
    category: Optional[str] = None,
    client_name: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """List batches with RBAC scoping and multi-attribute filters."""
    query = db.query(Batch)

    # RBAC Scoping
    if current_user.role == "Manager":
        coord_ids = get_managed_coordinator_ids(current_user.id, db)
        query = query.filter(
            or_(
                Batch.primary_manager_id == current_user.id,
                Batch.coordinator_id.in_(coord_ids)
            )
        )
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
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Batch.batch_id.ilike(search_term),
                Batch.program_name.ilike(search_term),
                Batch.client_name.ilike(search_term),
                Batch.technology.ilike(search_term),
                Batch.location_city.ilike(search_term)
            )
        )

    return query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{id}", response_model=BatchDetailResponse)
def get_batch_detail(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Fetch complete batch details."""
    batch = db.query(Batch).filter(Batch.id == id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.patch("/{id}", response_model=BatchResponse)
def update_batch(
    id: UUID,
    batch_in: BatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """Updates batch fields. Schema locked batches restrict modification to non-governed fields."""
    batch = db.query(Batch).filter(Batch.id == id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    update_data = batch_in.model_dump(exclude_unset=True)

    # If schema is locked, only Admin or Manager can modify critical logistical fields
    if batch.is_schema_locked and current_user.role not in ["Admin", "Manager"]:
        restricted_keys = {"client_name", "category", "program_name", "technology", "domain"}
        for k in restricted_keys:
            if k in update_data:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Batch schema is locked. Modifying '{k}' requires Manager or Admin authorization."
                )

    for field, value in update_data.items():
        setattr(batch, field, value)

    batch.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/{id}/close", response_model=BatchResponse)
async def close_batch_gate2(
    id: UUID,
    closure_in: BatchNpsClosureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """
    Quality Gate 2 Checkpoint:
    Mandatory Batch NPS Score (0-10) and retrospective submission to close batch.
    """
    closed_batch = GatekeeperService.close_batch_gate2(
        db=db,
        batch_id=id,
        closure_data=closure_in,
        user_id=current_user.id
    )

    try:
        await NotificationService.notify_gate_completion(
            batch_id=closed_batch.batch_id,
            gate_name="Gate 2 (Batch NPS Closure)",
            score=f"NPS: {closure_in.nps_score}/10"
        )
    except Exception:
        pass

    return closed_batch
