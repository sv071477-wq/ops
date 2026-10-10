import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from app.core.security import create_access_token, get_password_hash
from app.models.batch import Batch
from app.models.session import TrainingSession
from app.models.user import Team, User


@pytest.fixture
def role_ids(db_session):
    """Valid user ids for the three ownership fields the create contract requires."""
    def _id(email):
        return str(db_session.query(User).filter(User.email == email).first().id)
    return {
        "primary_manager_id": _id("test_manager@ops.com"),
        "coordinator_id": _id("test_coord@ops.com"),
        "sales_spoc_id": _id("test_admin@ops.com"),
    }


def _future_start():
    return (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()


def test_create_batch_requested(client, coord_token_headers, role_ids):
    batch_payload = {
        "batch_id": "NEW_BATCH_PYTORCH_2026",
        "client_name": "Fractal Analytics",
        "category": "Bootcamp",
        "domain": "DS/ML",
        "program_name": "Deep Learning with PyTorch",
        "delivery_mode": "Online",
        "location_city": "Bengaluru",
        "total_enrollments": 30,
        "training_days": 5,
        "total_hours": 40,
        "start_date": _future_start(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=37)).isoformat(),
        "faculty_members": [{"name": "Dr. Rao"}],
        **role_ids,
    }

    response = client.post("/api/v1/batches", json=batch_payload, headers=coord_token_headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["batch_id"] == "NEW_BATCH_PYTORCH_2026"
    assert data["client_name"] == "Fractal Analytics"
    assert data["status"] in ["Requested", "Approval 1 Pending"]
    assert data["is_schema_locked"] is False


def test_create_batch_online_clears_location(client, coord_token_headers, role_ids):
    batch_payload = {
        "batch_id": "ONLINE_BATCH_NO_LOCATION_2026",
        "client_name": "Fractal Analytics",
        "category": "Bootcamp",
        "domain": "DS/ML",
        "program_name": "Deep Learning with PyTorch",
        "delivery_mode": "Online",
        "location_city": "Bengaluru",
        "total_enrollments": 30,
        "training_days": 5,
        "total_hours": 40,
        "start_date": _future_start(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=37)).isoformat(),
        "faculty_members": [{"name": "Dr. Rao"}],
        **role_ids,
    }

    response = client.post("/api/v1/batches", json=batch_payload, headers=coord_token_headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["delivery_mode"] == "Online"
    assert data["location_city"] is None


def test_create_batch_persists_faculty_assigned_text(client, coord_token_headers, role_ids):
    """Regression: the field is part of the create contract and the Batch model."""
    batch_payload = {
        "batch_id": "FACULTY_TEXT_BATCH_2026",
        "program_name": "Cloud and Ops",
        "delivery_mode": "Online",
        "total_enrollments": 55,
        "training_days": 5,
        "total_hours": 40,
        "start_date": _future_start(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=37)).isoformat(),
        "faculty_assigned_text": "Nagabhushan / Srinivas P",
        "faculty_members": [{"name": "Nagabhushan"}, {"name": "Srinivas P"}],
        **role_ids,
    }

    response = client.post("/api/v1/batches", json=batch_payload, headers=coord_token_headers)
    assert response.status_code == 201, response.text
    assert response.json()["faculty_assigned_text"] == "Nagabhushan / Srinivas P"


def test_create_batch_rejects_server_owned_fields(client, coord_token_headers, role_ids):
    """The create contract is closed: lifecycle/approval fields are server-owned."""
    batch_payload = {
        "batch_id": "SNIFF_BATCH_2026",
        "program_name": "Cloud and Ops",
        "delivery_mode": "Online",
        "total_enrollments": 55,
        "training_days": 5,
        "total_hours": 63,
        "start_date": _future_start(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=37)).isoformat(),
        "faculty_members": [{"name": "Dr. Rao"}],
        "status": "Completed",
        **role_ids,
    }

    response = client.post("/api/v1/batches", json=batch_payload, headers=coord_token_headers)
    assert response.status_code == 422
    assert any(e["loc"][-1] == "status" for e in response.json()["detail"])


def test_create_batch_requires_ownership_ids(client, coord_token_headers):
    batch_payload = {
        "batch_id": "NO_OWNER_BATCH_2026",
        "program_name": "Cloud and Ops",
        "delivery_mode": "Online",
        "total_enrollments": 55,
        "training_days": 5,
        "total_hours": 63,
        "start_date": _future_start(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=37)).isoformat(),
        "faculty_members": [{"name": "Dr. Rao"}],
    }

    response = client.post("/api/v1/batches", json=batch_payload, headers=coord_token_headers)
    assert response.status_code == 422
    locs = {e["loc"][-1] for e in response.json()["detail"]}
    assert {"primary_manager_id", "coordinator_id", "sales_spoc_id"} <= locs


def test_create_batch_sanitizes_blank_optional_strings(client, coord_token_headers, role_ids):
    """Blank optional strings are dropped rather than stored as empty values."""
    batch_payload = {
        "batch_id": "BATCH_SAMPLE_2026",
        "client_name": "Delloite",
        "category": "PJP",
        "domain": "IT/ITES",
        "program_name": "Cloud and Ops",
        "sow_number": "SOW everthing",
        "technology": "   ",
        "location_city": "",
        "delivery_mode": "Online",
        "total_enrollments": 55,
        "training_days": 5,
        "total_hours": 40,
        "start_date": _future_start(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=37)).isoformat(),
        "faculty_members": [{"name": "Dr. Rao"}],
        **role_ids,
    }

    response = client.post("/api/v1/batches", json=batch_payload, headers=coord_token_headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["batch_id"] == "BATCH_SAMPLE_2026"
    assert data["sow_number"] == "SOW everthing"
    assert data["technology"] is None
    assert data["location_city"] is None


def test_approve_batch_locks_schema(client, manager_token_headers, db_session):
    test_batch = db_session.query(Batch).filter(Batch.batch_id == "TEST_BATCH_PYTHON_001").first()

    response = client.post(
        f"/api/v1/batches/{test_batch.id}/approve",
        json={"approval_id": "SOW-APPROVED-999"},
        headers=manager_token_headers
    )
    assert response.status_code == 200, response.text
    data = response.json()
    # approve() auto-transitions on start_date; this batch has none, so it lands
    # in the upcoming queue rather than "Approved".
    assert data["status"] in ["Upcoming", "Ongoing"]
    assert data["approval_id"] == "SOW-APPROVED-999"
    assert data["is_schema_locked"] is True


# ---------------------------------------------------------------------------
# `GET /batches?mine=true` — coordinator schedule access
# ---------------------------------------------------------------------------


def _add_user(db, email, full_name, role, team=None, manager=None):
    user = User(
        email=email,
        hashed_password=get_password_hash("password123"),
        full_name=full_name,
        role=role,
        team_id=team.id if team else None,
        manager_id=manager.id if manager else None,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _headers_for(user):
    token = create_access_token(subject=str(user.id), role=user.role)
    return {"Authorization": f"Bearer {token}"}


def _add_batch(db, batch_id, coordinator, manager, **overrides):
    batch = Batch(
        batch_id=batch_id,
        program_name="Cloud and Ops",
        delivery_mode="Online",
        status="Upcoming",
        primary_manager_id=manager.id if manager else None,
        coordinator_id=coordinator.id if coordinator else None,
        **overrides,
    )
    db.add(batch)
    db.flush()
    return batch


@pytest.fixture
def ownership_actors(db_session):
    """A second coordinator plus a Finance user, both absent from conftest."""
    delivery = db_session.query(Team).filter(Team.name == "Delivery").first()
    finance_team = Team(name="Finance", department="Finance")
    db_session.add(finance_team)
    db_session.flush()

    manager = db_session.query(User).filter(User.email == "test_manager@ops.com").first()
    coord = db_session.query(User).filter(User.email == "test_coord@ops.com").first()

    other_coord = _add_user(db_session, "other_coord@ops.com", "Other Coordinator", "Coordinator", team=delivery, manager=manager)
    finance_user = _add_user(db_session, "test_finance@ops.com", "Test Finance", "Finance", team=finance_team)
    db_session.commit()

    return {
        "manager": manager,
        "coord": coord,
        "other_coord": other_coord,
        "finance": finance_user,
    }


def test_list_mine_as_coordinator_returns_only_own_batches(client, db_session, ownership_actors):
    """A sibling coordinator's batch is inside the caller's RBAC scope but must
    not appear in `mine=true`."""
    coord = ownership_actors["coord"]
    _add_batch(db_session, "MINE_OWN_BATCH_2027", coordinator=coord, manager=ownership_actors["manager"])
    _add_batch(db_session, "MINE_SIBLING_BATCH_2027", coordinator=ownership_actors["other_coord"], manager=ownership_actors["manager"])
    db_session.commit()

    response = client.get("/api/v1/batches?mine=true", headers=_headers_for(coord))
    assert response.status_code == 200, response.text
    batch_ids = {row["batch_id"] for row in response.json()}

    assert "MINE_OWN_BATCH_2027" in batch_ids
    assert "MINE_SIBLING_BATCH_2027" not in batch_ids


def test_list_mine_does_not_widen_rbac_scope(client, db_session, ownership_actors):
    """Guards the AND-not-replace risk: ownership is layered on top of the RBAC
    scope block, so a batch the caller is otherwise allowed to see is still
    excluded when they do not own it."""
    coord = ownership_actors["coord"]
    manager = ownership_actors["manager"]
    # primary_manager_id is the caller, so the RBAC block matches on it, but
    # coordinator_id belongs to somebody else.
    _add_batch(db_session, "MINE_MANAGER_OWNED_2027", coordinator=ownership_actors["other_coord"], manager=manager)
    db_session.commit()

    mine = client.get("/api/v1/batches?mine=true", headers=_headers_for(coord))
    assert mine.status_code == 200, mine.text
    assert "MINE_MANAGER_OWNED_2027" not in {row["batch_id"] for row in mine.json()}

    # Same batch is visible without `mine`, proving the RBAC block still allows it.
    unscoped = client.get("/api/v1/batches", headers=_headers_for(coord))
    assert unscoped.status_code == 200, unscoped.text
    assert "MINE_MANAGER_OWNED_2027" in {row["batch_id"] for row in unscoped.json()}


def test_list_mine_as_manager_keys_off_primary_manager_id(client, db_session, ownership_actors):
    """Manager ownership lives on a different column than coordinator ownership;
    a single hardcoded `coordinator_id` comparison would return zero rows."""
    manager = ownership_actors["manager"]
    _add_batch(db_session, "MINE_MANAGER_BATCH_2027", coordinator=ownership_actors["other_coord"], manager=manager)
    _add_batch(db_session, "MINE_UNMANAGED_BATCH_2027", coordinator=ownership_actors["other_coord"], manager=None)
    db_session.commit()

    response = client.get("/api/v1/batches?mine=true", headers=_headers_for(manager))
    assert response.status_code == 200, response.text
    batch_ids = {row["batch_id"] for row in response.json()}

    assert "MINE_MANAGER_BATCH_2027" in batch_ids
    assert "MINE_UNMANAGED_BATCH_2027" not in batch_ids


def test_list_mine_as_finance_returns_full_scope(client, db_session, ownership_actors):
    """Finance owns nothing, so `mine` must not silently empty their list."""
    finance = ownership_actors["finance"]
    _add_batch(db_session, "MINE_FINANCE_SCOPE_A_2027", coordinator=ownership_actors["coord"], manager=ownership_actors["manager"])
    _add_batch(db_session, "MINE_FINANCE_SCOPE_B_2027", coordinator=ownership_actors["other_coord"], manager=ownership_actors["manager"])
    db_session.commit()

    with_mine = client.get("/api/v1/batches?mine=true", headers=_headers_for(finance))
    assert with_mine.status_code == 200, with_mine.text
    scoped = {row["batch_id"] for row in with_mine.json()}

    assert {"MINE_FINANCE_SCOPE_A_2027", "MINE_FINANCE_SCOPE_B_2027"} <= scoped

    without_mine = client.get("/api/v1/batches", headers=_headers_for(finance))
    assert without_mine.status_code == 200, without_mine.text
    assert {row["batch_id"] for row in without_mine.json()} == scoped


def test_list_without_mine_is_unchanged_for_other_call_sites(client, db_session, ownership_actors):
    """Regression guard for ManagerBoard / Approval Queue / Finance, which all
    call `GET /batches` with no `mine` parameter."""
    coord = ownership_actors["coord"]
    _add_batch(db_session, "NOMINE_OWN_BATCH_2027", coordinator=coord, manager=ownership_actors["manager"])
    _add_batch(db_session, "NOMINE_SIBLING_BATCH_2027", coordinator=ownership_actors["other_coord"], manager=ownership_actors["manager"])
    db_session.commit()

    response = client.get("/api/v1/batches", headers=_headers_for(coord))
    assert response.status_code == 200, response.text
    batch_ids = {row["batch_id"] for row in response.json()}

    assert {"NOMINE_OWN_BATCH_2027", "NOMINE_SIBLING_BATCH_2027"} <= batch_ids


def test_list_reports_scheduled_session_count(client, db_session, ownership_actors):
    """`scheduled_session_count` is what the My Batches Schedule column reads."""
    coord = ownership_actors["coord"]
    unscheduled = _add_batch(db_session, "SCHED_NONE_2027", coordinator=coord, manager=ownership_actors["manager"], training_days=3)
    scheduled = _add_batch(db_session, "SCHED_THREE_2027", coordinator=coord, manager=ownership_actors["manager"], training_days=3)

    first_day = datetime.now(timezone.utc).date() + timedelta(days=40)
    for index in range(3):
        db_session.add(
            TrainingSession(
                batch_id=scheduled.id,
                sequence_number=index + 1,
                session_date=first_day + timedelta(days=index),
                day_name="Day",
                module=f"Module {index + 1}",
                duration_hours=Decimal("8.0"),
                status="Scheduled",
            )
        )
    db_session.commit()

    response = client.get("/api/v1/batches?mine=true", headers=_headers_for(coord))
    assert response.status_code == 200, response.text
    counts = {row["batch_id"]: row["scheduled_session_count"] for row in response.json()}

    assert counts["SCHED_NONE_2027"] == 0
    assert counts["SCHED_THREE_2027"] == 3


# ---------------------------------------------------------------------------
# Rejection and Resubmit Flow Tests
# ---------------------------------------------------------------------------


def _future_start():
    return (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()


def _create_batch_for_approval(db_session, role_ids):
    """Helper to create a batch that reaches Approval 1 Pending state."""
    batch = Batch(
        batch_id="REJECT_TEST_BATCH_2026",
        program_name="Rejection Test Program",
        delivery_mode="Online",
        total_enrollments=20,
        training_days=5,
        total_hours=Decimal("40.00"),
        start_date=datetime.now(timezone.utc) + timedelta(days=30),
        end_date=datetime.now(timezone.utc) + timedelta(days=37),
        category="Bootcamp",
        status="Approval 1 Pending",
        approver_1_id=UUID(role_ids["primary_manager_id"]),
        approver_2_id=UUID(role_ids["sales_spoc_id"]),
        approver_1_status="Pending",
        approver_2_status="Pending",
        primary_manager_id=UUID(role_ids["primary_manager_id"]),
        coordinator_id=UUID(role_ids["coordinator_id"]),
        sales_spoc_id=UUID(role_ids["sales_spoc_id"]),
        is_schema_locked=False,
    )
    db_session.add(batch)
    db_session.commit()
    db_session.refresh(batch)
    return batch


def test_level_1_rejection_sets_rejected_status(client, manager_token_headers, db_session, role_ids):
    """Level 1 rejection should set batch status to Rejected (not Requested)."""
    batch = _create_batch_for_approval(db_session, role_ids)

    # Approver 1 rejects
    response = client.post(
        f"/api/v1/batches/{batch.id}/approve-level-1",
        json={"decision": "reject", "reason": "Insufficient budget"},
        headers=manager_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "Rejected"
    assert data["approver_1_status"] == "Rejected"
    assert "rejected" in data["remarks"].lower()


def test_level_2_rejection_sets_rejected_status(client, admin_token_headers, db_session, role_ids):
    """Level 2 rejection should set batch status to Rejected."""
    batch = _create_batch_for_approval(db_session, role_ids)

    # First approve level 1
    batch.approver_1_status = "Approved"
    batch.status = "Approval 2 Pending"
    db_session.commit()

    # Approver 2 rejects
    response = client.post(
        f"/api/v1/batches/{batch.id}/approve-level-2",
        json={"decision": "reject", "reason": "Schedule conflict"},
        headers=admin_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "Rejected"
    assert data["approver_2_status"] == "Rejected"
    assert "rejected" in data["remarks"].lower()


def test_resubmit_from_rejected_resets_approvers(client, coord_token_headers, db_session, role_ids):
    """Resubmitting a rejected batch should reset approvers from global config."""
    batch = _create_batch_for_approval(db_session, role_ids)

    # Reject at level 1
    batch.approver_1_status = "Rejected"
    batch.status = "Rejected"
    batch.remarks = "Approval 1 rejected: Insufficient budget"
    db_session.commit()

    # Coordinator resubmits
    response = client.post(
        f"/api/v1/batches/{batch.id}/submit",
        headers=coord_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "Approval 1 Pending"
    assert data["approver_1_status"] == "Pending"
    assert data["approver_2_status"] == "Pending"
    # Approver IDs should be reset from config
    assert data["approver_1_id"] is not None
    assert data["approver_2_id"] is not None


def test_rejected_only_transitions_to_approval_1_pending(client, coord_token_headers, db_session, role_ids):
    """Rejected batch can only transition to Approval 1 Pending via resubmit."""
    batch = _create_batch_for_approval(db_session, role_ids)
    batch.approver_1_status = "Rejected"
    batch.status = "Rejected"
    batch.remarks = "Rejected"
    db_session.commit()

    # Try to transition to Upcoming directly - should fail
    response = client.post(
        f"/api/v1/batches/{batch.id}/lifecycle-status",
        json={"status": "Upcoming", "reason": "Trying to skip approval"},
        headers=coord_token_headers,
    )
    assert response.status_code == 400

    # Valid transition: resubmit
    response = client.post(
        f"/api/v1/batches/{batch.id}/submit",
        headers=coord_token_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Approval 1 Pending"


def test_operational_scope_users_can_edit_rejected_batches(client, coord_token_headers, db_session, role_ids):
    """Coordinators/managers with operational scope can edit rejected batches."""
    batch = _create_batch_for_approval(db_session, role_ids)
    batch.approver_1_status = "Rejected"
    batch.status = "Rejected"
    batch.remarks = "Rejected"
    db_session.commit()

    # Coordinator can update the batch (e.g., change program_name)
    response = client.patch(
        f"/api/v1/batches/{batch.id}",
        json={"program_name": "Updated After Rejection"},
        headers=coord_token_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["program_name"] == "Updated After Rejection"


def test_enum_values_enforced_at_db_level(db_session):
    """Verify enum constraints prevent invalid status values at DB level."""
    from sqlalchemy.exc import DataError

    # This test verifies the enum types exist; actual constraint enforcement
    # requires a running DB with the migration applied. Here we just verify
    # the model uses the correct enum types.
    from app.models.batch import BatchStatus, ApprovalStatus

    assert "Rejected" in [e.value for e in BatchStatus]
    assert "Approved" not in [e.value for e in BatchStatus]
    assert "Rejected" in [e.value for e in ApprovalStatus]
    assert "Pending" in [e.value for e in ApprovalStatus]
    assert "Approved" in [e.value for e in ApprovalStatus]


# ---------------------------------------------------------------------------
# Batch Re-Approval on Schedule Change Tests
# ---------------------------------------------------------------------------


def _create_schema_locked_batch(db_session, role_ids, status="Upcoming"):
    """Helper to create a schema-locked batch in an active status."""
    from app.models.batch import Batch
    from decimal import Decimal

    batch = Batch(
        batch_id=f"SCHED_LOCKED_BATCH_{status.upper().replace(' ', '_')}_2026",
        program_name="Schedule Locked Test Program",
        delivery_mode="Online",
        total_enrollments=20,
        training_days=5,
        total_hours=Decimal("40.00"),
        start_date=datetime.now(timezone.utc) + timedelta(days=30),
        end_date=datetime.now(timezone.utc) + timedelta(days=37),
        category="Bootcamp",
        status=status,
        approver_1_id=UUID(role_ids["primary_manager_id"]),
        approver_2_id=UUID(role_ids["sales_spoc_id"]),
        approver_1_status="Approved",
        approver_2_status="Approved",
        primary_manager_id=UUID(role_ids["primary_manager_id"]),
        coordinator_id=UUID(role_ids["coordinator_id"]),
        sales_spoc_id=UUID(role_ids["sales_spoc_id"]),
        is_schema_locked=True,
    )
    db_session.add(batch)
    db_session.commit()
    db_session.refresh(batch)
    return batch


def test_update_triggers_reapproval_when_training_days_changed(client, coord_token_headers, db_session, role_ids):
    """Coordinator updates training_days on Upcoming batch -> Batch goes to Approval 1 Pending, schema unlocked."""
    batch = _create_schema_locked_batch(db_session, role_ids, status="Upcoming")
    batch_id = batch.id

    response = client.patch(
        f"/api/v1/batches/{batch_id}",
        json={"training_days": 10},
        headers=coord_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "Approval 1 Pending"
    assert data["is_schema_locked"] is False
    assert data["approver_1_status"] == "Pending"
    assert data["approver_2_status"] == "Pending"
    assert data["training_days"] == 10
    assert "training_days" in data["remarks"]


def test_update_triggers_reapproval_when_end_date_changed(client, coord_token_headers, db_session, role_ids):
    """Coordinator updates end_date on Ongoing batch -> Batch goes to Approval 1 Pending."""
    batch = _create_schema_locked_batch(db_session, role_ids, status="Ongoing")
    batch_id = batch.id

    new_end_date = (datetime.now(timezone.utc) + timedelta(days=45)).isoformat()
    response = client.patch(
        f"/api/v1/batches/{batch_id}",
        json={"end_date": new_end_date},
        headers=coord_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "Approval 1 Pending"
    assert data["is_schema_locked"] is False
    assert data["approver_1_status"] == "Pending"
    assert data["approver_2_status"] == "Pending"
    assert "end_date" in data["remarks"]


def test_update_triggers_reapproval_when_start_date_changed(client, coord_token_headers, db_session, role_ids):
    """Coordinator updates start_date on Pending for Closure batch -> Batch goes to Approval 1 Pending."""
    batch = _create_schema_locked_batch(db_session, role_ids, status="Pending for Closure")
    batch_id = batch.id

    # Update both start_date and end_date to keep end_date after start_date
    new_start_date = (datetime.now(timezone.utc) + timedelta(days=40)).isoformat()
    new_end_date = (datetime.now(timezone.utc) + timedelta(days=47)).isoformat()
    response = client.patch(
        f"/api/v1/batches/{batch_id}",
        json={"start_date": new_start_date, "end_date": new_end_date},
        headers=coord_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "Approval 1 Pending"
    assert data["is_schema_locked"] is False
    assert data["approver_1_status"] == "Pending"
    assert data["approver_2_status"] == "Pending"
    assert "start_date" in data["remarks"]


def test_update_triggers_reapproval_when_total_hours_changed(client, coord_token_headers, db_session, role_ids):
    """Coordinator updates total_hours on Upcoming batch -> Batch goes to Approval 1 Pending."""
    batch = _create_schema_locked_batch(db_session, role_ids, status="Upcoming")
    batch_id = batch.id

    response = client.patch(
        f"/api/v1/batches/{batch_id}",
        json={"total_hours": "60.00"},
        headers=coord_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "Approval 1 Pending"
    assert data["is_schema_locked"] is False
    assert data["approver_1_status"] == "Pending"
    assert data["approver_2_status"] == "Pending"
    assert "total_hours" in data["remarks"]


def test_update_no_reapproval_for_non_schedule_fields(client, coord_token_headers, db_session, role_ids):
    """Coordinator updates client_name on schema-locked batch -> No re-approval (non-schedule field)."""
    batch = _create_schema_locked_batch(db_session, role_ids, status="Upcoming")
    batch_id = batch.id

    response = client.patch(
        f"/api/v1/batches/{batch_id}",
        json={"client_name": "New Client Name"},
        headers=coord_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    # Should remain in Upcoming with schema locked
    assert data["status"] == "Upcoming"
    assert data["is_schema_locked"] is True
    assert data["approver_1_status"] == "Approved"
    assert data["approver_2_status"] == "Approved"
    assert data["client_name"] == "New Client Name"


def test_update_no_reapproval_for_completed_batch(client, coord_token_headers, db_session, role_ids):
    """Batch in Completed status updated -> No re-approval (not in active statuses)."""
    batch = _create_schema_locked_batch(db_session, role_ids, status="Completed")
    batch_id = batch.id

    response = client.patch(
        f"/api/v1/batches/{batch_id}",
        json={"training_days": 10},
        headers=coord_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    # Should remain in Completed with schema locked
    assert data["status"] == "Completed"
    assert data["is_schema_locked"] is True
    assert data["approver_1_status"] == "Approved"
    assert data["approver_2_status"] == "Approved"
    assert data["training_days"] == 10


def test_update_no_reapproval_for_admin(client, admin_token_headers, db_session, role_ids):
    """Admin updates schedule fields -> No re-approval (admins can edit locked schema)."""
    batch = _create_schema_locked_batch(db_session, role_ids, status="Upcoming")
    batch_id = batch.id

    response = client.patch(
        f"/api/v1/batches/{batch_id}",
        json={"training_days": 10, "end_date": (datetime.now(timezone.utc) + timedelta(days=45)).isoformat()},
        headers=admin_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    # Should remain in Upcoming with schema locked (admin can edit without re-approval)
    assert data["status"] == "Upcoming"
    assert data["is_schema_locked"] is True
    assert data["approver_1_status"] == "Approved"
    assert data["approver_2_status"] == "Approved"
    assert data["training_days"] == 10


def test_update_no_reapproval_for_manager(client, manager_token_headers, db_session, role_ids):
    """Manager updates schedule fields -> No re-approval (managers can edit locked schema)."""
    batch = _create_schema_locked_batch(db_session, role_ids, status="Upcoming")
    batch_id = batch.id

    response = client.patch(
        f"/api/v1/batches/{batch_id}",
        json={"training_days": 10},
        headers=manager_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    # Should remain in Upcoming with schema locked (manager can edit without re-approval)
    assert data["status"] == "Upcoming"
    assert data["is_schema_locked"] is True
    assert data["approver_1_status"] == "Approved"
    assert data["approver_2_status"] == "Approved"
    assert data["training_days"] == 10


def test_update_reapproval_preserves_approval_history_in_remarks(client, coord_token_headers, db_session, role_ids):
    """Re-approval preserves existing approval history in remarks."""
    batch = _create_schema_locked_batch(db_session, role_ids, status="Upcoming")
    batch.remarks = "Previous approval history"
    db_session.commit()
    batch_id = batch.id

    response = client.patch(
        f"/api/v1/batches/{batch_id}",
        json={"training_days": 10},
        headers=coord_token_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "Approval 1 Pending"
    assert "Previous approval history" in data["remarks"]
    assert "Schedule changed" in data["remarks"]
    assert "training_days" in data["remarks"]
