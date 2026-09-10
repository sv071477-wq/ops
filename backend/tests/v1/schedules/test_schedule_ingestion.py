from io import BytesIO

import pandas as pd

from app.api.v1.schedules.service import ScheduleFeatureService


def test_extracts_schedule_rows_from_all_excel_sheets():
    workbook = BytesIO()
    with pd.ExcelWriter(workbook, engine="openpyxl") as writer:
        pd.DataFrame([
            {
                "Batch ID": "BATCH-001",
                "Training Date": "2026-10-15",
                "Start Time": "09:00",
                "End Time": "17:00",
                "Session Topic": "Python Fundamentals",
                "Faculty": "Dr. Jane Smith",
                "Hours": 8,
                "City": "Bengaluru",
            }
        ]).to_excel(writer, sheet_name="Schedule", index=False)
        pd.DataFrame([
            {
                "Date": "2026-10-16",
                "Topic": "SQL Workshop",
                "Mode": "F2F",
            }
        ]).to_excel(writer, sheet_name="Day 2", index=False)
    workbook.seek(0)

    result = ScheduleFeatureService.ingest_schedule_file(
        file_contents=workbook.getvalue(),
        filename="schedule.xlsx",
        target_batch_id="BATCH-DEFAULT",
    )

    assert result.success is True
    assert result.sheets_processed == ["Schedule", "Day 2"]
    assert result.total_rows == 2
    assert result.extracted_rows == 2
    assert result.failed_rows == 0
    assert result.items[0].batch_id == "BATCH-001"
    assert result.items[0].topic == "Python Fundamentals"
    assert result.items[0].faculty_name == "Dr. Jane Smith"
    assert str(result.items[0].start_time) == "09:00:00"
    assert result.items[1].batch_id == "BATCH-DEFAULT"
    assert result.items[1].mode_of_delivery == "F2F"


def test_reports_invalid_rows_without_discarding_valid_rows():
    csv_contents = b"Date,Topic,Faculty\n2026-10-15,Valid topic,Dr. Smith\nnot-a-date,,\n"

    result = ScheduleFeatureService.ingest_schedule_file(
        file_contents=csv_contents,
        filename="schedule.csv",
    )

    assert result.success is False
    assert result.total_rows == 2
    assert result.extracted_rows == 1
    assert result.failed_rows == 1
    assert result.items[0].topic == "Valid topic"
    assert result.errors[0].source_sheet == "CSV"
    assert result.errors[0].source_row == 3


def test_missing_date_column_marks_rows_as_failed():
    csv_contents = b"Topic,Faculty\nSQL Workshop,Dr. Smith\n"

    result = ScheduleFeatureService.ingest_schedule_file(
        file_contents=csv_contents,
        filename="schedule.csv",
    )

    assert result.success is False
    assert result.extracted_rows == 0
    assert result.failed_rows == 1
    assert "training date column" in result.errors[0].message