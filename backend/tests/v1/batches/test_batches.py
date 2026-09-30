import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

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
        status="Approved",
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
