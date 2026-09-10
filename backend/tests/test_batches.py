def test_create_batch_requested(client, coord_token_headers):
    batch_payload = {
        "batch_id": "NEW_BATCH_PYTORCH_2026",
        "client_name": "Fractal Analytics",
        "category": "Bootcamp",
        "domain": "DS/ML",
        "program_name": "Deep Learning with PyTorch",
        "delivery_mode": "Online",
        "location_city": "Bengaluru",
        "total_enrollments": 30,
        "residential_enrollments": 0,
        "non_residential_enrollments": 30
    }

    response = client.post("/api/v1/batches", json=batch_payload, headers=coord_token_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["batch_id"] == "NEW_BATCH_PYTORCH_2026"
    assert data["client_name"] == "Fractal Analytics"
    assert data["status"] == "Requested"
    assert data["is_schema_locked"] is False


def test_approve_batch_locks_schema(client, manager_token_headers, db_session):
    from app.models.batch import Batch
    test_batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()

    response = client.post(
        f"/api/v1/batches/{test_batch.id}/approve",
        json={"approval_id": "SOW-APPROVED-999"},
        headers=manager_token_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Approved"
    assert data["approval_id"] == "SOW-APPROVED-999"
    assert data["is_schema_locked"] is True
