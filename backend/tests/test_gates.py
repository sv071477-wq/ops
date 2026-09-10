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
    batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()

    nps_payload = {
        "nps_score": "9.2",
        "total_responses": 40,
        "promoters_count": 35,
        "passive_count": 3,
        "detractors_count": 2,
        "retrospective_notes": "Program concluded with 82.5 Net Promoter Index. Client highly satisfied.",
        "client_feedback": "Superb hands-on experience."
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
    assert float(data["batch_nps"]) == 9.2
