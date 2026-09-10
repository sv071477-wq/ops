from decimal import Decimal
from datetime import datetime, timezone
from app.services.conflict_engine import ConflictEngine


def test_conflict_engine_detects_daily_overload(db_session):
    # Existing session on 2026-10-15 is 8 hours, attempting to add 4 more hours
    conflicts = ConflictEngine.check_session_conflict(
        db=db_session,
        faculty_name="Dr. Jane Smith",
        date_of_training=datetime(2026, 10, 15, 14, 0, 0, tzinfo=timezone.utc),
        requested_hours=Decimal("4.0"),
        existing_hours=Decimal("8.0")
    )

    assert len(conflicts) > 0
    assert conflicts[0].conflict_type == "DAILY_HOURS_EXCEEDED"
    assert "exceed max daily capacity" in conflicts[0].message


def test_conflict_engine_allows_free_date(db_session):
    # Free date with no prior bookings (0 existing hours, 8 requested hours)
    conflicts = ConflictEngine.check_session_conflict(
        db=db_session,
        faculty_name="Dr. Jane Smith",
        date_of_training=datetime(2026, 10, 20, 9, 0, 0, tzinfo=timezone.utc),
        requested_hours=Decimal("8.0"),
        existing_hours=Decimal("0.0")
    )

    assert len(conflicts) == 0

