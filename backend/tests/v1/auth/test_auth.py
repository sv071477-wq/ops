def test_login_success(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test_admin@ops.com", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "test_admin@ops.com"
    assert data["user"]["role"] == "Admin"


def test_login_invalid_password(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test_admin@ops.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_get_me_authenticated(client, admin_token_headers):
    response = client.get("/api/v1/auth/me", headers=admin_token_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "test_admin@ops.com"


def test_get_me_unauthorized(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 403 or response.status_code == 401
