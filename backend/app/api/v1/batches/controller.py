from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_

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
    BatchLifecycleStatusUpdate,
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
    limit: int = 5000,
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


@router.post("/{id}/lifecycle-status", response_model=BatchResponse)
def update_batch_lifecycle_status(
    id: UUID,
    payload: BatchLifecycleStatusUpdate,
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_coordinator_or_above),
) -> Any:
    """Transition batch lifecycle status (e.g. OnHold, Cancelled, Upcoming, Ongoing) with mandatory reason."""
    return service.update_lifecycle_status(id, payload.status, payload.reason, current_user)


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


@router.get("/finance/export")
def export_finance_csv(
    status_filter: Optional[str] = Query(None),
    finance_status: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    delivery_mode: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    service: BatchService = Depends(get_batch_service),
    current_user: User = Depends(require_coordinator_or_above),
    db: Session = Depends(get_db)
) -> Response:
    """Export finance review data as CSV."""
    from app.api.deps import get_manager_scope_user_ids
    import csv
    from io import StringIO
    from fastapi.responses import StreamingResponse
    
    # Build query similar to list endpoint
    query = db.query(Batch)
    user_role_lower = (current_user.role or "").lower()
    team_name_lower = (current_user.team_detail.name if current_user.team_detail else "").strip().lower()
    
    if user_role_lower != "admin" and team_name_lower != "finance":
        team_user_ids = get_manager_scope_user_ids(current_user, db)
        query = query.filter(or_(
            Batch.primary_manager_id == current_user.id,
            Batch.coordinator_id.in_(team_user_ids),
            ((Batch.status == "Approval 1 Pending") & (Batch.approver_1_id == current_user.id)),
            ((Batch.status == "Approval 2 Pending") & (Batch.approver_2_id == current_user.id)),
        ))
    
    if status_filter:
        query = query.filter(Batch.status == status_filter)
    if finance_status:
        query = query.filter(Batch.finance_status == finance_status)
    if domain:
        query = query.filter(Batch.domain == domain)
    if delivery_mode:
        query = query.filter(Batch.delivery_mode == delivery_mode)
    if start_date:
        query = query.filter(Batch.start_date >= start_date)
    if end_date:
        query = query.filter(Batch.start_date <= end_date)
    
    batches = query.order_by(Batch.created_at.desc()).all()
    
    # Generate CSV
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Batch ID", "SOW Number", "Approval ID", "Client", "Program", "Category",
        "Technology", "Domain", "Delivery Mode", "Location", "Start Date", "End Date",
        "Total Enrollments", "Training Days", "Total Hours", "Finance Status",
        "Finance Check Date", "Finance Check", "Batch Avg Feedback", "Batch NPS", "Status"
    ])
    
    for b in batches:
        writer.writerow([
            b.batch_id,
            b.sow_number or "",
            b.approval_id or "",
            b.client_name or "",
            b.program_name,
            b.category or "",
            b.technology or "",
            b.domain or "",
            b.delivery_mode or "",
            b.location_city or "",
            b.start_date.isoformat() if b.start_date else "",
            b.end_date.isoformat() if b.end_date else "",
            b.total_enrollments,
            b.training_days or 0,
            b.total_hours or 0,
            b.finance_status or "Pending",
            b.finance_status_check_date.isoformat() if b.finance_status_check_date else "",
            b.finance_check or "",
            float(b.batch_avg_feedback) if b.batch_avg_feedback else "",
            b.batch_nps or "",
            b.status
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=finance-review-{datetime.now().strftime('%Y%m%d')}.csv"}
    )
