from datetime import datetime, timezone
import io
import pandas as pd
from decimal import Decimal
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
from app.schemas.feedback import BatchNpsClosureCreate, BatchFeedbackImportResponse
from app.api.deps import get_manager_scope_user_ids
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
        if batch_data.get("accommodation_id"):
            batch_data["accommodation_id"] = self._option_id(Accommodation, batch_data["accommodation_id"], "")
        batch_data["entity_id"] = self._option_id(Entity, batch_data.get("entity_id"), "Default")
        batch_data["batch_request_date"] = datetime.now(timezone.utc)
        config = self.db.query(ApprovalConfiguration).first()
        if not config or not config.approver_1_id or not config.approver_2_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Both approvers must be configured before creating a batch.",
            )
        batch_data["approver_1_id"] = config.approver_1_id
        batch_data["approver_2_id"] = config.approver_2_id
        batch_data["approver_1_status"] = "Pending"
        batch_data["approver_2_status"] = "Pending"
        batch_data["status"] = "Approval 1 Pending"
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

    def submit_for_approval(self, batch_id: UUID, current_user: User) -> Batch:
        batch = self.get(batch_id, current_user)
        self._require_operational_scope(batch, current_user)
        config = self.get_approval_config()
        if not config.approver_1_id or not config.approver_2_id:
            raise HTTPException(status_code=409, detail="Admin must configure both approvers before submission")
        if batch.start_date and batch.start_date.date() < datetime.now(timezone.utc).date():
            raise HTTPException(status_code=422, detail="Cannot submit a batch whose start date has already passed")
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
                batch.remarks = f"Approval {level} rejected: {decision.reason}"
        elif level == 1:
            batch.approver_1_status = "Approved"
            batch.approver_1_approved_at = datetime.now(timezone.utc)
            batch.status = "Approval 2 Pending"
        else:
            batch.approver_2_status = "Approved"
            batch.approver_2_approved_at = datetime.now(timezone.utc)
            batch.status = "Approved"
            batch.is_schema_locked = True
            if decision.reason and not batch.approval_id and len(decision.reason.strip()) <= 100:
                batch.approval_id = decision.reason.strip()
        batch.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def approve(self, batch_id: UUID, approval: BatchApprove, current_user: User) -> Batch:
        batch = self.get(batch_id, current_user)
        self._require_operational_scope(batch, current_user)
        if batch.approver_1_id and batch.approver_1_status != "Approved" and (current_user.role or "").lower() != "admin":
            raise HTTPException(
                status_code=409,
                detail="Approver 1 signoff is pending. Direct approval requires Admin authorization or Level 1 completion."
            )
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
        self._sync_pending_approvers()
        query = self.db.query(Batch)
        user_role_lower = (current_user.role or "").lower()
        team_name_lower = (current_user.team_detail.name if current_user.team_detail else "").strip().lower()

        if user_role_lower != "admin" and team_name_lower != "finance":
            team_user_ids = get_manager_scope_user_ids(current_user, self.db)
            query = query.filter(or_(
                Batch.primary_manager_id.in_(team_user_ids),
                Batch.coordinator_id.in_(team_user_ids),
                Batch.sales_spoc_id.in_(team_user_ids),
                ((Batch.status == "Approval 1 Pending") & (Batch.approver_1_id == current_user.id)),
                ((Batch.status == "Approval 2 Pending") & (Batch.approver_2_id == current_user.id)),
            ))
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

    def _sync_pending_approvers(self) -> None:
        """Backfill pending approval assignments after admin configuration changes/imports."""
        config = self.db.query(ApprovalConfiguration).first()
        if not config or not config.approver_1_id or not config.approver_2_id:
            return
        pending_batches = self.db.query(Batch).filter(
            Batch.status.in_(["Approval 1 Pending", "Approval 2 Pending"])
        ).all()
        changed = False
        for batch in pending_batches:
            if batch.approver_1_id != config.approver_1_id:
                batch.approver_1_id = config.approver_1_id
                changed = True
            if batch.approver_2_id != config.approver_2_id:
                batch.approver_2_id = config.approver_2_id
                changed = True
        if changed:
            self.db.commit()

    def get(self, batch_id: UUID, current_user: Optional[User] = None) -> Batch:
        batch = self.db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        team_name_lower = (current_user.team_detail.name if current_user and current_user.team_detail else "").strip().lower()
        if current_user and (current_user.role or "").lower() != "admin" and team_name_lower != "finance":
            scope_ids = set(get_manager_scope_user_ids(current_user, self.db))
            batch_user_ids = self._batch_scope_user_ids(batch)
            is_assigned_approver = (
                (batch.status == "Approval 1 Pending" and batch.approver_1_id == current_user.id)
                or (batch.status == "Approval 2 Pending" and batch.approver_2_id == current_user.id)
            )
            if not scope_ids.intersection(batch_user_ids) and not is_assigned_approver:
                raise HTTPException(status_code=404, detail="Batch not found")
        return batch

    @staticmethod
    def _batch_scope_user_ids(batch: Batch) -> set:
        return {
            user_id for user_id in {
                batch.primary_manager_id,
                batch.coordinator_id,
                batch.sales_spoc_id,
            } if user_id is not None
        }

    def _require_operational_scope(self, batch: Batch, current_user: User) -> None:
        role = (current_user.role or "").lower()
        team = (current_user.team_detail.name if current_user.team_detail else "").strip().lower()
        if role == "admin" or team == "finance":
            return
        scope_ids = set(get_manager_scope_user_ids(current_user, self.db))
        if not scope_ids.intersection(self._batch_scope_user_ids(batch)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view or edit batches within your manager scope.",
            )

    def update(self, batch_id: UUID, batch_in: BatchUpdate, current_user: User) -> Batch:
        batch = self.get(batch_id, current_user)
        self._require_operational_scope(batch, current_user)
        update_data = batch_in.model_dump(exclude_unset=True)
        update_data.pop("batch_request_date", None)
        finance_fields = {"finance_status", "finance_status_check_date", "finance_check"}
        if finance_fields.intersection(update_data):
            team_name = current_user.team_detail.name if current_user.team_detail else ""
            if team_name.strip().lower() != "finance":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only Finance team members can update finance fields."
                )
        if "start_date" in update_data or "end_date" in update_data:
            update_data["calendar_days"] = self._calendar_days(
                update_data.get("start_date", batch.start_date),
                update_data.get("end_date", batch.end_date),
            )
        if batch.is_schema_locked and (current_user.role or "").lower() not in ["admin", "manager", "coordinator"]:
            restricted = {"client_name", "category", "program_name", "technology", "domain"}
            for field in restricted.intersection(update_data):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Batch schema is locked. Modifying '{field}' requires Manager or Admin authorization.")
        for field, value in update_data.items():
            setattr(batch, field, value)
        batch.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(batch)
        return batch

    def close_gate2(self, batch_id: UUID, closure: BatchNpsClosureCreate, user_id: UUID, current_user: Optional[User] = None) -> Batch:
        if current_user:
            batch = self.get(batch_id, current_user)
            self._require_operational_scope(batch, current_user)
        return GatekeeperService.close_batch_gate2(
            db=self.db,
            batch_id=batch_id,
            closure_data=closure,
            user_id=user_id,
        )

    def import_feedback_workbook(
        self,
        batch_id: UUID,
        file_contents: bytes,
        filename: str,
        user_id: UUID,
        current_user: Optional[User] = None,
    ) -> BatchFeedbackImportResponse:
        batch = self.get(batch_id)
        if current_user:
            self._require_operational_scope(batch, current_user)
        try:
            if filename.lower().endswith(".csv"):
                sheets = {"CSV": pd.read_csv(io.BytesIO(file_contents))}
            else:
                sheets = pd.read_excel(io.BytesIO(file_contents), sheet_name=None)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not read feedback workbook: {exc}") from exc

        frames = [frame for frame in sheets.values() if not frame.empty]
        if not frames:
            raise HTTPException(status_code=422, detail="Feedback workbook contains no rows")
        data = pd.concat(frames, ignore_index=True)
        columns = {str(column).strip().lower().replace("_", " "): column for column in data.columns}

        def find_column(aliases):
            for alias in aliases:
                if alias in columns:
                    return columns[alias]
            return None

        category_column = find_column(("category", "nps category", "response category", "segment"))
        nps_column = find_column(("nps score", "nps", "recommendation score", "recommendation", "likelihood to recommend"))
        total_column = find_column(("total responses", "responses", "response count", "total"))
        promoter_column = find_column(("promoters", "promoter count", "promoters count"))
        passive_column = find_column(("passives", "passive", "neutral", "neutral count", "passive count"))
        detractor_column = find_column(("detractors", "detractor count", "detractors count"))
        feedback_column = find_column(("feedback rating", "average feedback", "session rating", "module rating"))

        promoters = passives = detractors = total = 0
        if category_column:
            categories = data[category_column].dropna().astype(str).str.strip().str.lower()
            promoters = int(categories.isin({"promoter", "promoters"}).sum())
            passives = int(categories.isin({"passive", "passives", "neutral"}).sum())
            detractors = int(categories.isin({"detractor", "detractors"}).sum())
            total = promoters + passives + detractors
        elif nps_column:
            scores = pd.to_numeric(data[nps_column], errors="coerce").dropna()
            if ((scores < 0) | (scores > 10)).any():
                raise HTTPException(status_code=422, detail="NPS responses must be between 0 and 10")
            promoters = int((scores >= 9).sum())
            passives = int(scores.between(7, 8, inclusive="both").sum())
            detractors = int((scores <= 6).sum())
            total = int(len(scores))
        elif total_column and promoter_column and passive_column and detractor_column:
            first = data.iloc[0]
            promoters = int(first[promoter_column])
            passives = int(first[passive_column])
            detractors = int(first[detractor_column])
            total = int(first[total_column])
        else:
            raise HTTPException(status_code=422, detail="Workbook must contain NPS scores, categories, or a summary count row")

        if total <= 0 or promoters + passives + detractors != total:
            raise HTTPException(status_code=422, detail="NPS category counts must be positive and add up to total responses")

        average_feedback = None
        if feedback_column:
            ratings = pd.to_numeric(data[feedback_column], errors="coerce").dropna()
            if not ratings.empty:
                if ((ratings < 1) | (ratings > 5)).any():
                    raise HTTPException(status_code=422, detail="Feedback ratings must be between 1 and 5")
                average_feedback = Decimal(str(round(float(ratings.mean()), 2)))

        nps_score = Decimal(str(round(((promoters - detractors) / total) * 100, 2)))
        batch.nps_total_responses = total
        batch.nps_promoters = promoters
        batch.nps_passives = passives
        batch.nps_detractors = detractors
        batch.batch_nps = nps_score
        if average_feedback is not None:
            batch.batch_avg_feedback = average_feedback
        batch.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        return BatchFeedbackImportResponse(
            batch_id=batch.id,
            source_filename=filename,
            total_responses=total,
            promoters_count=promoters,
            passive_count=passives,
            detractors_count=detractors,
            nps_score=nps_score,
            average_feedback_score=average_feedback or batch.batch_avg_feedback,
        )