def test_admin_can_create_and_list_roles(client, admin_token_headers):
    # 1. Admin creates a new custom role
    create_res = client.post(
        "/api/v1/roles",
        headers=admin_token_headers,
        json={"name": "Lead Technical Trainer", "system_role": "Faculty", "is_active": True}
    )
    assert create_res.status_code == 201
    created_role = create_res.json()
    assert created_role["name"] == "Lead Technical Trainer"
    assert created_role["system_role"] == "Faculty"
    role_id = created_role["id"]

    # 2. List roles
    list_res = client.get("/api/v1/roles", headers=admin_token_headers)
    assert list_res.status_code == 200
    roles = list_res.json()
    role_names = [r["name"] for r in roles]
    assert "Lead Technical Trainer" in role_names

    # 3. Create a user assigned to this role
    user_res = client.post(
        "/api/v1/auth/users",
        headers=admin_token_headers,
        json={
            "email": "trainer.lead@ops.com",
            "full_name": "Arjun Mehta",
            "password": "Password123",
            "role_id": role_id
        }
    )
    assert user_res.status_code == 200
    user_data = user_res.json()
    assert user_data["email"] == "trainer.lead@ops.com"
    assert user_data["role_id"] == role_id
    assert user_data["role_detail"]["name"] == "Lead Technical Trainer"

    # 4. Attempt to delete role in use should fail
    delete_res = client.delete(f"/api/v1/roles/{role_id}", headers=admin_token_headers)
    assert delete_res.status_code == 400


def test_non_admin_cannot_create_role(client, coord_token_headers):
    response = client.post(
        "/api/v1/roles",
        headers=coord_token_headers,
        json={"name": "Unauthorized Role", "system_role": "Coordinator"}
    )
    assert response.status_code == 403


def test_organization_reporting_hierarchy(client, admin_token_headers):
    # 1. Create Senior Manager
    mgr_res = client.post(
        "/api/v1/auth/users",
        headers=admin_token_headers,
        json={
            "email": "director@ops.com",
            "full_name": "Delivery Director",
            "password": "Password123",
            "role": "Manager"
        }
    )
    assert mgr_res.status_code == 200
    director_id = mgr_res.json()["id"]

    # 2. Create Lead Coordinator reporting to Director
    lead_res = client.post(
        "/api/v1/auth/users",
        headers=admin_token_headers,
        json={
            "email": "lead.coord@ops.com",
            "full_name": "Lead Coordinator",
            "password": "Password123",
            "role": "Coordinator",
            "manager_id": director_id
        }
    )
    assert lead_res.status_code == 200
    lead_id = lead_res.json()["id"]

    # 3. Create Sub-Coordinator reporting to Lead Coordinator
    sub_res = client.post(
        "/api/v1/auth/users",
        headers=admin_token_headers,
        json={
            "email": "sub.coord@ops.com",
            "full_name": "Junior Coordinator",
            "password": "Password123",
            "role": "Coordinator",
            "manager_id": lead_id
        }
    )
    assert sub_res.status_code == 200

    # 4. Fetch hierarchy
    hier_res = client.get("/api/v1/auth/hierarchy", headers=admin_token_headers)
    assert hier_res.status_code == 200
    hierarchy = hier_res.json()
    assert len(hierarchy) > 0
