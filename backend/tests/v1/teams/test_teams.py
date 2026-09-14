def test_admin_can_create_and_list_teams(client, admin_token_headers):
    # 1. Admin creates a new team in the Ops department
    create_res = client.post(
        "/api/v1/teams",
        headers=admin_token_headers,
        json={
            "name": "Core Operations",
            "department": "Ops",
            "description": "Core Delivery Operations Team",
            "is_active": True
        }
    )
    assert create_res.status_code == 201
    team_data = create_res.json()
    assert team_data["name"] == "Core Operations"
    assert team_data["department"] == "Ops"
    team_id = team_data["id"]

    # 2. List all teams
    list_res = client.get("/api/v1/teams", headers=admin_token_headers)
    assert list_res.status_code == 200
    teams = list_res.json()
    assert any(t["name"] == "Core Operations" for t in teams)

    # 3. Filter by department Ops
    ops_res = client.get("/api/v1/teams?department=Ops", headers=admin_token_headers)
    assert ops_res.status_code == 200
    ops_teams = ops_res.json()
    assert all(t["department"].lower() == "ops" for t in ops_teams)


def test_create_user_with_role_and_team(client, admin_token_headers):
    # 1. Create a Team
    team_res = client.post(
        "/api/v1/teams",
        headers=admin_token_headers,
        json={"name": "Academic Ops", "department": "Ops", "description": "Academic scheduling"}
    )
    assert team_res.status_code == 201
    team_id = team_res.json()["id"]

    # 2. Create a Role
    role_res = client.post(
        "/api/v1/roles",
        headers=admin_token_headers,
        json={"name": "Ops Lead", "system_role": "Coordinator"}
    )
    assert role_res.status_code == 201
    role_id = role_res.json()["id"]

    # 3. Provision user with role and team
    user_res = client.post(
        "/api/v1/auth/users",
        headers=admin_token_headers,
        json={
            "email": "ops.lead@enterprise-ops.com",
            "full_name": "Rohan Verma",
            "password": "Password123",
            "role_id": role_id,
            "team_id": team_id
        }
    )
    assert user_res.status_code == 200
    user_data = user_res.json()
    assert user_data["email"] == "ops.lead@enterprise-ops.com"
    assert user_data["role_id"] == role_id
    assert user_data["team_id"] == team_id
    assert user_data["team_name"] == "Academic Ops"
    assert user_data["department"] == "Ops"
    assert user_data["team_detail"]["name"] == "Academic Ops"

    # 4. Check team member count
    team_get_res = client.get(f"/api/v1/teams/{team_id}", headers=admin_token_headers)
    assert team_get_res.status_code == 200
    assert team_get_res.json()["member_count"] == 1


def test_non_admin_cannot_create_team(client, coord_token_headers):
    res = client.post(
        "/api/v1/teams",
        headers=coord_token_headers,
        json={"name": "Unauthorized Team", "department": "Ops"}
    )
    assert res.status_code == 403


def test_delete_team_unassigns_users(client, admin_token_headers):
    # Create team & user
    team_res = client.post(
        "/api/v1/teams",
        headers=admin_token_headers,
        json={"name": "Temporary Team", "department": "Ops"}
    )
    team_id = team_res.json()["id"]

    user_res = client.post(
        "/api/v1/auth/users",
        headers=admin_token_headers,
        json={
            "email": "temp.member@ops.com",
            "full_name": "Temp Member",
            "password": "Password123",
            "team_id": team_id
        }
    )
    user_id = user_res.json()["id"]

    # Delete team
    del_res = client.delete(f"/api/v1/teams/{team_id}", headers=admin_token_headers)
    assert del_res.status_code == 200

    # User still exists, but team is unassigned
    users_res = client.get("/api/v1/auth/users", headers=admin_token_headers)
    assert users_res.status_code == 200
    u = next(x for x in users_res.json() if x["id"] == user_id)
    assert u["team_id"] is None
    assert u["team_name"] is None
