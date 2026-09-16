from typing import List, Optional, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.user import User
from app.schemas.batch import (
    ApprovalConfigurationBase,
    ApprovalConfigurationResponse,
    ApprovalDecision,
    BatchCreate,
    BatchUpdate,
    BatchApprove,
    BatchResponse,
    BatchDetailResponse,
)
from app.schemas.feedback import BatchNpsClosureCreate, BatchFeedbackImportResponse
from app.api.deps import (
    get_current_user, require_admin, require_manager_or_admin, require_coordinator_or_above
)
from app.api.deps_services import get_batch_service
from app.api.v1.batches.service import BatchService
from app.api.v1.notifications.service import NotificationService
from app.core.database import get_db

router = APIRouter()


@router.get("/approval-config", response_model=ApprovalConfigurationResponse)
def get_approval_config(
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_admin),
) -> Any:
    return service.get_approval_config()


@router.put("/approval-config", response_model=ApprovalConfigurationResponse)
def update_approval_config(
    config_in: ApprovalConfigurationBase,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_admin),
) -> Any:
    return service.update_approval_config(config_in)


@router.post("", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(
    batch_in: BatchCreate,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """Workflow 1: Create a new batch in 'Requested' status. Administrators act strictly in managerial/governance capacity."""
    team_name = current_user.team_detail.name if current_user.team_detail else ""
    if (current_user.role or "").lower() == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrators cannot create batches. Admin acts strictly in a managerial and governance capacity."
        )
    if team_name.strip().lower() != "delivery":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Delivery team members can create batches."
        )
    batch = service.create(batch_in, current_user)
    await NotificationService.notify_approval_requested(batch)
    return batch


@router.post("/{id}/submit", response_model=BatchResponse)
async def submit_batch(
    id: UUID,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_coordinator_or_above),
) -> Any:
    batch = service.submit_for_approval(id, current_user)
    await NotificationService.notify_approval_requested(batch)
    return batch


@router.post("/{id}/approve-level-1", response_model=BatchResponse)
async def approve_level_1(
    id: UUID,
    decision: ApprovalDecision,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(get_current_user),
) -> Any:
    batch = service.decide(id, 1, decision, current_user)
    await NotificationService.notify_approval_decision(batch, 1, decision.decision)
    return batch


@router.post("/{id}/approve-level-2", response_model=BatchResponse)
async def approve_level_2(
    id: UUID,
    decision: ApprovalDecision,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(get_current_user),
) -> Any:
    batch = service.decide(id, 2, decision, current_user)
    await NotificationService.notify_approval_decision(batch, 2, decision.decision)
    return batch


@router.post("/{id}/approve", response_model=BatchResponse)
async def approve_batch(
    id: UUID,
    approve_in: BatchApprove,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_manager_or_admin)
) -> Any:
    """Manager Approval: Locks schema, assigns financial SOW Approval ID, transitions status to 'Approved'."""
    batch = service.approve(id, approve_in, current_user)

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
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """List batches with RBAC scoping and multi-attribute filters."""
    return service.list(current_user, status_filter, domain, category, client_name, search, skip, limit)


@router.get("/{id}", response_model=BatchDetailResponse)
def get_batch_detail(
    id: UUID,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Fetch complete batch details."""
    return service.get(id, current_user)


@router.patch("/{id}", response_model=BatchResponse)
def update_batch(
    id: UUID,
    batch_in: BatchUpdate,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """Updates batch fields. Schema locked batches restrict modification to non-governed fields."""
    return service.update(id, batch_in, current_user)


@router.post("/{id}/close", response_model=BatchResponse)
async def close_batch_gate2(
    id: UUID,
    closure_in: BatchNpsClosureCreate,
    db: Session = Depends(get_db),
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_coordinator_or_above)
) -> Any:
    """
    Quality Gate 2 Checkpoint:
    Mandatory Batch NPS Score (0-10) and retrospective submission to close batch.
    """
    closed_batch = service.close_gate2(id, closure_in, current_user.id, current_user)

    try:
        await NotificationService.notify_gate_completion(
            batch_id=closed_batch.batch_id,
            gate_name="Gate 2 (Batch NPS Closure)",
            score=f"NPS: {closure_in.nps_score}/10"
        )
    except Exception:
        pass

    return closed_batch


@router.post("/{id}/feedback-import", response_model=BatchFeedbackImportResponse)
async def import_batch_feedback(
    id: UUID,
    file: UploadFile = File(...),
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_coordinator_or_above),
) -> BatchFeedbackImportResponse:
    """Import and calculate the authoritative final NPS breakdown for a batch."""
    filename = file.filename or "feedback.xlsx"
    if not filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="File must be an Excel (.xlsx, .xls) or CSV spreadsheet")
    return service.import_feedback_workbook(
        batch_id=id,
        file_contents=await file.read(),
        filename=filename,
        user_id=current_user.id,
        current_user=current_user,
    )
