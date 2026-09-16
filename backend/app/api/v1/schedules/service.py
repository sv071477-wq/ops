import io
from typing import Any, Dict, List, Optional
from datetime import date, datetime, time
from decimal import Decimal
import pandas as pd
from app.schemas.schedule import (
    ExtractedScheduleItem,
    ScheduleExtractionError,
    ScheduleIngestResponse,
)


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
