from decimal import Decimal

from app.models.batch import Batch


def test_gate1_session_feedback_success(client, coord_token_headers):
    feedback_payload = {
        "rating": "4.8",
        "topic_feedback": "Excellent engagement on AsyncIO coroutines.",
        "faculty_observations": "Class grasped event loops well.",
        "total_students_present": 42
    }

    response = client.patch(
        "/api/v1/sessions/mock-session-id-123/complete",
        json=feedback_payload,
        headers=coord_token_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Completed"
    assert data["feedback_submitted"] is True


def test_gate1_invalid_rating_rejected(client, coord_token_headers):
    invalid_feedback = {
        "rating": "6.5",  # Exceeds max 5.0
        "topic_feedback": "Invalid rating test",
        "total_students_present": 20
    }

    response = client.patch(
        "/api/v1/sessions/mock-session-id-123/complete",
        json=invalid_feedback,
        headers=coord_token_headers
    )

    assert response.status_code == 422


def test_gate2_batch_nps_closure(client, coord_token_headers, db_session):
    """Gate 2 derives the NPS index from the three category counts. The
    fixture batch already carries batch_avg_feedback=4.50, so the
    Checkpoint 1 precondition is satisfied and the average must be left
    untouched."""
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()

    nps_payload = {
        "promoters_count": 35,
        "passive_count": 3,
        "detractors_count": 2,
    }

    response = client.post(
        f"/api/v1/batches/{batch.id}/close",
        json=nps_payload,
        headers=coord_token_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Completed"
    assert data["is_schema_locked"] is True
    # (35 - 2) / 40 * 100 = 82.5
    assert float(data["batch_nps"]) == 82.5
    assert data["nps_total_responses"] == 40
    assert data["nps_promoters"] == 35
    assert data["nps_passives"] == 3
    assert data["nps_detractors"] == 2
    # Gate 2 is sequenced after Gate 1 but never writes the average.
    assert float(data["batch_avg_feedback"]) == 4.5


def test_gate2_blocked_until_gate1_complete(client, coord_token_headers, db_session):
    """A batch with no average feedback has not cleared Checkpoint 1, so
    closure is rejected with 409."""
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()
    batch.batch_avg_feedback = None
    db_session.commit()

    response = client.post(
        f"/api/v1/batches/{batch.id}/close",
        json={"promoters_count": 10, "passive_count": 5, "detractors_count": 5},
        headers=coord_token_headers
    )

    assert response.status_code == 409
    assert "Quality Checkpoint 1" in response.json()["detail"]


def test_gate2_rejects_zero_responses(client, coord_token_headers, db_session):
    """An NPS index over zero responses is undefined, so the closure is
    rejected with 422."""
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()

    response = client.post(
        f"/api/v1/batches/{batch.id}/close",
        json={"promoters_count": 0, "passive_count": 0, "detractors_count": 0},
        headers=coord_token_headers
    )

    assert response.status_code == 422


def test_gate2_rejects_client_supplied_nps(client, coord_token_headers, db_session):
    """The index is server-side only: a client-supplied nps_score is
    ignored rather than trusted."""
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()

    response = client.post(
        f"/api/v1/batches/{batch.id}/close",
        json={
            "promoters_count": 35,
            "passive_count": 3,
            "detractors_count": 2,
            "nps_score": "9.2",
            "average_feedback_score": "1.0",
            "retrospective_notes": "Client supplied values must be ignored.",
        },
        headers=coord_token_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert float(data["batch_nps"]) == 82.5
    assert float(data["batch_avg_feedback"]) == 4.5


def test_feedback_import_endpoint_removed(client, coord_token_headers, db_session):
    """The workbook import surface is gone; closure is the only path."""
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()

    response = client.post(
        f"/api/v1/batches/{batch.id}/feedback-import",
        headers=coord_token_headers
    )

    assert response.status_code == 404
