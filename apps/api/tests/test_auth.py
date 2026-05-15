import importlib.util
from pathlib import Path

from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from jose import jwt
from sqlalchemy import create_engine, text

from core.config import settings
from core.security import verify_password
from models.user import User


def register_first_admin(client, username="admin", password="secret-password"):
    response = client.post(
        "/auth/register",
        json={"username": username, "password": password, "role": "admin"},
    )
    assert response.status_code == 201
    return response.json()


def login(client, username, password):
    response = client.post(
        "/auth/login", data={"username": username, "password": password}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def register_user(client, admin_token, username, password, role):
    response = client.post(
        "/auth/register",
        json={"username": username, "password": password, "role": role},
        headers=auth_headers(admin_token),
    )
    assert response.status_code == 201
    return response.json()


def test_register_login_hashes_password_and_me(client, db_session):
    user_response = register_first_admin(client)

    assert user_response == {"id": 1, "username": "admin", "role": "admin"}
    assert "password_hash" not in user_response

    user = db_session.query(User).filter(User.username == "admin").first()
    assert user is not None
    assert user.password_hash != "secret-password"
    assert verify_password("secret-password", user.password_hash)

    token = login(client, "admin", "secret-password")
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "admin"
    assert payload["role"] == "admin"

    response = client.get("/auth/me", headers=auth_headers(token))
    assert response.status_code == 200
    assert response.json() == {"id": 1, "username": "admin", "role": "admin"}


def test_invalid_login_returns_401(client):
    register_first_admin(client)

    response = client.post(
        "/auth/login", data={"username": "admin", "password": "wrong-password"}
    )

    assert response.status_code == 401


def test_protected_product_routes_require_valid_token(client):
    assert client.get("/products/").status_code == 401
    assert (
        client.get("/products/", headers={"Authorization": "Bearer not-a-token"}).status_code
        == 401
    )


def test_viewer_and_planner_can_read_but_not_write(client):
    register_first_admin(client)
    admin_token = login(client, "admin", "secret-password")
    register_user(client, admin_token, "viewer", "viewer-password", "viewer")
    register_user(client, admin_token, "planner", "planner-password", "planner")

    for username, password in [
        ("viewer", "viewer-password"),
        ("planner", "planner-password"),
    ]:
        token = login(client, username, password)

        read_response = client.get("/products/", headers=auth_headers(token))
        assert read_response.status_code == 200

        write_response = client.post(
            "/products/",
            json={"name": "Widget", "value": 100, "sku": f"{username}-sku"},
            headers=auth_headers(token),
        )
        assert write_response.status_code == 403


def test_admin_can_mutate_products_and_snapshots(client):
    register_first_admin(client)
    admin_token = login(client, "admin", "secret-password")
    headers = auth_headers(admin_token)

    create_product_response = client.post(
        "/products/",
        json={"name": "Widget", "value": 100, "sku": "SKU-001"},
        headers=headers,
    )
    assert create_product_response.status_code == 201
    product_id = create_product_response.json()["id"]

    update_product_response = client.patch(
        f"/products/{product_id}", json={"value": 125}, headers=headers
    )
    assert update_product_response.status_code == 200
    assert update_product_response.json()["value"] == 125

    delete_product_response = client.delete(f"/products/{product_id}", headers=headers)
    assert delete_product_response.status_code == 204

    create_snapshot_response = client.post(
        "/snapshots/",
        json={"name": "Daily Snapshot", "file_path": "snapshots/daily.png"},
        headers=headers,
    )
    assert create_snapshot_response.status_code == 201
    snapshot_id = create_snapshot_response.json()["id"]

    delete_snapshot_response = client.delete(f"/snapshots/{snapshot_id}", headers=headers)
    assert delete_snapshot_response.status_code == 204


def test_file_write_routes_require_admin(client):
    register_first_admin(client)
    admin_token = login(client, "admin", "secret-password")
    register_user(client, admin_token, "viewer", "viewer-password", "viewer")
    viewer_token = login(client, "viewer", "viewer-password")

    response = client.post("/files/save", params={"temp_filename": "missing.png"})
    assert response.status_code == 401
    response = client.post(
        "/files/save",
        params={"temp_filename": "missing.png"},
        headers=auth_headers(viewer_token),
    )
    assert response.status_code == 403


def test_migration_seeds_default_admin_from_env(monkeypatch):
    migration_path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "4d2f8a9c1b30_add_users_auth.py"
    )
    spec = importlib.util.spec_from_file_location("add_users_auth", migration_path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    monkeypatch.setenv("DEFAULT_ADMIN_USERNAME", "seed-admin")
    monkeypatch.setenv("DEFAULT_ADMIN_PASSWORD", "seed-password")

    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        migration.op = Operations(context)

        migration.upgrade()
        row = connection.execute(
            text("SELECT username, role, password_hash FROM users")
        ).mappings().one()

        assert row["username"] == "seed-admin"
        assert row["role"] == "admin"
        assert row["password_hash"] != "seed-password"
        assert verify_password("seed-password", row["password_hash"])
