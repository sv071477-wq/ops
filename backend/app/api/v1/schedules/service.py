import io
from typing import Any, Dict, List, Optional
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.schemas.schedule import (
    ExtractedScheduleItem,
    ScheduleExtractionError,
    ScheduleIngestResponse,
    ScheduleApplyResponse,
)
from app.models.batch import Batch
from app.models.session import TrainingSession
from app.models.user import User
from app.api.v1.schedules.conflict_engine import ConflictEngine
from app.api.deps import get_manager_scope_user_ids


class ExcelIngestionService:

    COLUMN_ALIASES = {
        "batch_id": ("batch id", "batch_id", "batch", "batch code", "batch no"),
        "date_of_training": ("date of training", "training date", "date", "session date"),
        "start_time": ("start time", "start", "session start"),
        "end_time": ("end time", "end", "session end"),
        "topic": ("topic", "session topic", "module", "subject", "program", "program name"),
        "faculty_name": ("faculty name", "faculty", "trainer", "instructor"),
        "no_of_hours": ("no of hours", "hours", "duration", "session hours"),
        "venue": ("venue", "room", "location"),
        "location_city": ("location city", "city", "location"),
        "mode_of_delivery": ("mode of delivery", "delivery mode", "mode", "delivery"),
    }

    @staticmethod
    def _clean_str(val: Any) -> Optional[str]:
        if pd.isna(val) or val is None:
            return None
        s = str(val).strip()
        return s if s else None

    @staticmethod
    def _clean_decimal(val: Any, default: Decimal = Decimal("0.0")) -> Decimal:
        if pd.isna(val) or val is None:
            return default
        try:
            return Decimal(str(val).replace(",", "").strip())
        except (TypeError, ValueError, ArithmeticError):
            return default

    @staticmethod
    def _parse_datetime(val: Any) -> Optional[datetime]:
        if val is None or pd.isna(val):
            return None
        if isinstance(val, datetime):
            return val
        if isinstance(val, date):
            return datetime.combine(val, time.min)
        parsed = pd.to_datetime(val, errors="coerce")
        if pd.isna(parsed):
            return None
        return parsed.to_pydatetime() if hasattr(parsed, "to_pydatetime") else parsed

    @staticmethod
    def _parse_time(val: Any) -> Optional[time]:
        if val is None or pd.isna(val):
            return None
        if isinstance(val, time):
            return val.replace(tzinfo=None)
        if isinstance(val, datetime):
            return val.time().replace(tzinfo=None)
        parsed = pd.to_datetime(str(val), errors="coerce")
        if pd.isna(parsed):
            return None
        return parsed.to_pydatetime().time().replace(tzinfo=None)

    @classmethod
    def _column_map(cls, columns: List[Any]) -> Dict[str, str]:
        normalized = {str(column).strip().lower().replace("_", " "): str(column) for column in columns}
        result: Dict[str, str] = {}
        for field, aliases in cls.COLUMN_ALIASES.items():
            for alias in aliases:
                if alias in normalized:
                    result[field] = normalized[alias]
                    break
        return result

    @classmethod
    def ingest_schedule_file(
        cls,
        file_contents: bytes,
        filename: str,
        target_batch_id: Optional[str] = None
    ) -> ScheduleIngestResponse:
        """
        Extracts normalized schedule records from every workbook sheet.

        This method intentionally has no database dependency or persistence side effect.
        """
        try:
            if filename.lower().endswith(".csv"):
                sheets = {"CSV": pd.read_csv(io.BytesIO(file_contents))}
            else:
                sheets = pd.read_excel(io.BytesIO(file_contents), sheet_name=None)
        except Exception as e:
            return ScheduleIngestResponse(
                success=False,
                message=f"Could not read spreadsheet file: {str(e)}",
                filename=filename,
                sheets_processed=[],
                total_rows=0,
                extracted_rows=0,
                failed_rows=0,
                items=[],
                errors=[]
            )

        items: List[ExtractedScheduleItem] = []
        errors: List[ScheduleExtractionError] = []
        total_rows = 0

        for sheet_name, df in sheets.items():
            columns = cls._column_map(list(df.columns))
            total_rows += len(df)
            if "date_of_training" not in columns:
                for index in range(len(df)):
                    errors.append(ScheduleExtractionError(
                        source_sheet=str(sheet_name),
                        source_row=index + 2,
                        message="Missing a training date column. Expected Date, Training Date, or Date of Training."
                    ))
                continue

            for index, row in df.iterrows():
                source_row = int(index) + 2
                try:
                    training_date = cls._parse_datetime(row.get(columns["date_of_training"]))
                    topic = cls._clean_str(row.get(columns.get("topic"))) if columns.get("topic") else None
                    if not training_date:
                        raise ValueError("training date is missing or invalid")
                    if not topic:
                        raise ValueError("topic is missing")

                    batch_id = cls._clean_str(row.get(columns.get("batch_id"))) if columns.get("batch_id") else target_batch_id
                    items.append(ExtractedScheduleItem(
                        source_sheet=str(sheet_name),
                        source_row=source_row,
                        batch_id=batch_id,
                        date_of_training=training_date,
                        start_time=cls._parse_time(row.get(columns.get("start_time"))) if columns.get("start_time") else None,
                        end_time=cls._parse_time(row.get(columns.get("end_time"))) if columns.get("end_time") else None,
                        topic=topic,
                        faculty_name=cls._clean_str(row.get(columns.get("faculty_name"))) if columns.get("faculty_name") else None,
                        no_of_hours=cls._clean_decimal(row.get(columns.get("no_of_hours")), Decimal("8.0")) if columns.get("no_of_hours") else Decimal("8.0"),
                        venue=cls._clean_str(row.get(columns.get("venue"))) if columns.get("venue") else None,
                        location_city=cls._clean_str(row.get(columns.get("location_city"))) if columns.get("location_city") else None,
                        mode_of_delivery=cls._clean_str(row.get(columns.get("mode_of_delivery"))) or "Online" if columns.get("mode_of_delivery") else "Online",
                    ))
                except (ValueError, TypeError) as exc:
                    errors.append(ScheduleExtractionError(
                        source_sheet=str(sheet_name),
                        source_row=source_row,
                        message=str(exc),
                    ))

        return ScheduleIngestResponse(
            success=len(errors) == 0,
            message=f"Extracted {len(items)} schedule rows ({len(errors)} skipped).",
            filename=filename,
            source_filename=filename,
            sheets_processed=[str(name) for name in sheets],
            total_rows=total_rows,
            total_rows_parsed=total_rows,
            extracted_rows=len(items),
            failed_rows=len(errors),
            items=items,
            extracted_schedule=items,
            errors=errors,
        )

    @classmethod
    def apply_schedule_items(
        cls,
        db: Session,
        target_batch_id: str,
        items: List[ExtractedScheduleItem],
        source_filename: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> ScheduleApplyResponse:
        """Validate and persist a complete schedule upload as one transaction."""
        batch = db.query(Batch).filter(Batch.batch_id == target_batch_id).first()
        if not batch:
            try:
                batch = db.query(Batch).filter(Batch.id == UUID(target_batch_id)).first()
            except ValueError:
                batch = None
        if not batch:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target batch not found")
        if user_id:
            user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
            if not user:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Active user not found")
            role = (user.role or "").lower()
            team = (user.team_detail.name if user.team_detail else "").strip().lower()
            if role != "admin" and team != "finance":
                scope_ids = set(get_manager_scope_user_ids(user, db))
                batch_user_ids = {batch.primary_manager_id, batch.coordinator_id, batch.sales_spoc_id}
                if not scope_ids.intersection({value for value in batch_user_ids if value is not None}):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only apply schedules within your manager scope.")
        if batch.status in {"Completed", "Cancelled"}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Schedule cannot be applied to a completed or cancelled batch")
        if not items:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Schedule upload contains no valid rows")

        errors: List[dict] = []
        prepared = []
        seen_keys = set()
        running_hours = {}
        running_slots = {}
        for item in items:
            row_key = (item.date_of_training.date(), item.start_time, item.end_time, item.topic.strip().lower())
            if row_key in seen_keys:
                errors.append({"source_row": item.source_row, "message": "Duplicate schedule row in upload"})
                continue
            seen_keys.add(row_key)

            if item.batch_id and item.batch_id not in {batch.batch_id, str(batch.id)}:
                errors.append({"source_row": item.source_row, "message": "Row belongs to a different batch"})
                continue
            if batch.start_date and item.date_of_training.date() < batch.start_date.date():
                errors.append({"source_row": item.source_row, "message": "Training date is before the batch start date"})
                continue
            if batch.end_date and item.date_of_training.date() > batch.end_date.date():
                errors.append({"source_row": item.source_row, "message": "Training date is after the batch end date"})
                continue

            faculty_name = (item.faculty_name or batch.faculty_assigned_text or "").strip()
            if not faculty_name:
                errors.append({"source_row": item.source_row, "message": "Faculty name is required"})
                continue

            existing = db.query(TrainingSession).filter(
                TrainingSession.batch_id == batch.id,
                TrainingSession.date_of_training == item.date_of_training,
                TrainingSession.topic.ilike(item.topic.strip()),
            ).first()
            if existing:
                errors.append({"source_row": item.source_row, "message": "Matching session already exists for this batch"})
                continue

            day_key = (faculty_name.lower(), item.date_of_training.date())
            prior_hours = running_hours.get(day_key, Decimal("0"))
            conflicts = ConflictEngine.check_session_conflict(
                db=db,
                faculty_name=faculty_name,
                date_of_training=item.date_of_training,
                requested_hours=item.no_of_hours,
                existing_hours=prior_hours,
                start_time=item.start_time,
                end_time=item.end_time,
                faculty_id=None,
            )
            slot_key = (faculty_name.lower(), item.date_of_training.date())
            for previous_start, previous_end, previous_row in running_slots.get(slot_key, []):
                if item.start_time and item.end_time and previous_start and previous_end and previous_start < item.end_time and previous_end > item.start_time:
                    errors.append({"source_row": item.source_row, "message": f"Overlaps another uploaded session from row {previous_row}"})
            if conflicts:
                errors.extend({"source_row": item.source_row, "message": conflict.message} for conflict in conflicts)
                continue

            running_hours[day_key] = prior_hours + item.no_of_hours
            running_slots.setdefault(slot_key, []).append((item.start_time, item.end_time, item.source_row))
            prepared.append((item, faculty_name))

        generated = []
        if not errors and batch.training_days and batch.start_date and batch.end_date:
            scheduled_dates = {item.date_of_training.date() for item, _ in prepared}
            missing_count = max(0, batch.training_days - len(scheduled_dates))
            if missing_count:
                faculty_name = (batch.faculty_assigned_text or "").strip()
                if not faculty_name:
                    errors.append({"source_row": 0, "message": "A faculty assignment is required to generate missing training days"})
                else:
                    candidate = batch.start_date.date()
                    while candidate <= batch.end_date.date() and len(generated) < missing_count:
                        if candidate.weekday() < 5 and candidate not in scheduled_dates:
                            generated.append((
                                datetime.combine(candidate, time(9, 0)),
                                faculty_name,
                            ))
                            scheduled_dates.add(candidate)
                        candidate += timedelta(days=1)
                    if len(generated) < missing_count:
                        errors.append({"source_row": 0, "message": "The batch date range does not contain enough missing weekdays to satisfy training_days"})

        if errors:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": "Schedule was not applied", "errors": errors})

        try:
            sessions = []
            for item, faculty_name in prepared:
                session = TrainingSession(
                    batch_id=batch.id,
                    faculty_name=faculty_name,
                    date_of_training=item.date_of_training,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    topic=item.topic,
                    no_of_hours=item.no_of_hours,
                    venue=item.venue,
                    location_city=item.location_city or batch.location_city,
                    mode_of_delivery=item.mode_of_delivery or batch.delivery_mode,
                    status="Scheduled",
                )
                db.add(session)
                sessions.append(session)
            for generated_date, faculty_name in generated:
                session = TrainingSession(
                    batch_id=batch.id,
                    faculty_name=faculty_name,
                    date_of_training=generated_date,
                    start_time=time(9, 0),
                    end_time=time(17, 0),
                    topic="Generated training day - details required",
                    no_of_hours=Decimal("8.0"),
                    location_city=batch.location_city,
                    mode_of_delivery=batch.delivery_mode,
                    status="Scheduled",
                )
                db.add(session)
                sessions.append(session)
            db.commit()
            for session in sessions:
                db.refresh(session)
        except Exception:
            db.rollback()
            raise

        return ScheduleApplyResponse(
            success=True,
            target_batch_id=batch.batch_id,
            source_filename=source_filename,
            applied_rows=len(sessions),
            session_ids=[session.id for session in sessions],
        )
