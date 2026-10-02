from datetime import datetime, timezone, date
from decimal import Decimal

from app.models.batch import Batch
from app.models.session import TrainingSession, FacultyUtilization
from app.api.v1.batches.lifecycle_service import BatchLifecycleService


def _seed_batch_with_sessions(db_session, batch, count=2):
    """Create `count` TrainingSession days for the batch and return them."""
    sessions = []
    for i in range(count):
        ts = TrainingSession(
            batch_id=batch.id,
            sequence_number=i + 1,
            session_date=date(2026, 1, 10 + i),
            day_name="Monday",
            module=f"Module {i + 1}",
            trainer_name="Test Faculty",
            status="Scheduled",
        )
        db_session.add(ts)
        sessions.append(ts)
    db_session.commit()
    for s in sessions:
        db_session.refresh(s)
    return sessions


def _seed_utilization(db_session, batch, training_session, rating="4.0", status="Completed"):
    """Create a FacultyUtilization record linked to a TrainingSession."""
    fu = FacultyUtilization(
        batch_id=batch.id,
        training_session_id=training_session.id,
        faculty_name="Test Faculty",
        date_of_training=datetime(2026, 1, 10, 9, 0, 0, tzinfo=timezone.utc),
        topic="Test Topic",
        no_of_hours=Decimal("8.0"),
        mode_of_delivery="Online",
        status=status,
        feedback_submitted=status == "Completed",
        feedback_rating=Decimal(str(rating)) if status == "Completed" else None,
        feedback_notes="Great session" if status == "Completed" else None,
    )
    db_session.add(fu)
    db_session.commit()
    return fu


def test_feedback_not_calculated_when_not_all_sessions_completed(db_session):
    """batch_avg_feedback must NOT be recalculated until every non-cancelled
    session for the batch is Completed."""
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()

    ts1, ts2 = _seed_batch_with_sessions(db_session, batch, count=2)
    _seed_utilization(db_session, batch, ts1, rating="4.0")

    service = BatchLifecycleService(db_session)
    result = service.calculate_batch_avg_feedback(batch.id)

    assert result is None
    batch = db_session.query(Batch).filter(Batch.id == batch.id).first()
    assert batch.batch_avg_feedback == Decimal("4.50")


def test_feedback_calculated_when_all_sessions_completed(db_session):
    """Once every non-cancelled session is Completed and logged, the average
    feedback is calculated and persisted on the batch."""
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()

    ts1, ts2 = _seed_batch_with_sessions(db_session, batch, count=2)
    _seed_utilization(db_session, batch, ts1, rating="4.0")
    _seed_utilization(db_session, batch, ts2, rating="5.0")

    ts1.status = "Completed"
    ts2.status = "Completed"
    db_session.commit()

    service = BatchLifecycleService(db_session)
    result = service.calculate_batch_avg_feedback(batch.id)

    assert result == 4.5
    batch = db_session.query(Batch).filter(Batch.id == batch.id).first()
    assert float(batch.batch_avg_feedback) == 4.5


def test_feedback_excludes_cancelled_sessions(db_session):
    """A cancelled session is excluded from the average but does not block
    feedback calculation for the remaining completed sessions."""
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()

    ts1, ts2 = _seed_batch_with_sessions(db_session, batch, count=2)
    _seed_utilization(db_session, batch, ts1, rating="3.0")

    # ts1 is delivered and completed; ts2 is cancelled
    ts1.status = "Completed"
    ts2.status = "Cancelled"
    db_session.commit()

    service = BatchLifecycleService(db_session)
    result = service.calculate_batch_avg_feedback(batch.id)

    assert result == 3.0
    batch = db_session.query(Batch).filter(Batch.id == batch.id).first()
    assert float(batch.batch_avg_feedback) == 3.0


def test_gate1_does_not_prematurely_calculate_feedback(db_session, coord_token_headers, client):
    """Completing one session via Gate 1 must NOT write batch_avg_feedback when
    other sessions remain uncompleted."""
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()
    ts1, ts2 = _seed_batch_with_sessions(db_session, batch, count=2)

    # Session 1: scheduled utilization that we will complete via Gate 1
    fu = _seed_utilization(db_session, batch, ts1, status="Scheduled")

    response = client.patch(
        f"/api/v1/sessions/{fu.id}/complete",
        json={
            "rating": "4.0",
            "topic_feedback": "Great session",
            "total_students_present": 30,
        },
        headers=coord_token_headers,
    )
    assert response.status_code == 200

    # ts2 is still Scheduled → batch_avg_feedback must NOT have been recalculated
    batch = db_session.query(Batch).filter(Batch.id == batch.id).first()
    assert batch.batch_avg_feedback == Decimal("4.50")


def test_gate1_calculates_feedback_when_all_sessions_completed(db_session, coord_token_headers, client):
    """When the last session is completed via Gate 1, the batch average feedback
    is calculated and persisted."""
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()
    ts1, ts2 = _seed_batch_with_sessions(db_session, batch, count=2)

    _seed_utilization(db_session, batch, ts1, rating="3.0")
    ts1.status = "Completed"
    db_session.commit()

    fu2 = _seed_utilization(db_session, batch, ts2, status="Scheduled")

    response = client.patch(
        f"/api/v1/sessions/{fu2.id}/complete",
        json={
            "rating": "5.0",
            "topic_feedback": "Excellent",
            "total_students_present": 35,
        },
        headers=coord_token_headers,
    )
    assert response.status_code == 200

    batch = db_session.query(Batch).filter(Batch.id == batch.id).first()
    assert float(batch.batch_avg_feedback) == 4.0  # (3.0 + 5.0) / 2
