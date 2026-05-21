from datetime import date

from models.inventory_box import InventoryBox
from models.media import MediaAsset


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


def create_admin_headers(client):
    register_first_admin(client)
    return auth_headers(login(client, "admin", "secret-password"))


def create_media_asset(db_session, file_path="gallery/test.png"):
    asset = MediaAsset(
        file_path=file_path,
        original_filename=file_path.rsplit("/", 1)[-1],
        content_type="image/png",
        size_bytes=12,
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    return asset


def test_product_raw_materials_create_update_and_read(client):
    headers = create_admin_headers(client)

    create_response = client.post(
        "/products/",
        json={
            "name": "Valve",
            "sku": "VALVE-001",
            "value": 120,
            "raw_materials": "Aluminum, rubber seal",
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    assert create_response.json()["raw_materials"] == "Aluminum, rubber seal"

    product_id = create_response.json()["id"]
    update_response = client.patch(
        f"/products/{product_id}",
        json={"raw_materials": "Stainless steel"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["raw_materials"] == "Stainless steel"

    list_response = client.get("/products/", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()[0]["raw_materials"] == "Stainless steel"


def test_admin_can_upload_media_and_viewer_can_only_read(client):
    register_first_admin(client)
    admin_token = login(client, "admin", "secret-password")
    client.post(
        "/auth/register",
        json={"username": "viewer", "password": "viewer-password", "role": "viewer"},
        headers=auth_headers(admin_token),
    )
    viewer_token = login(client, "viewer", "viewer-password")

    upload_response = client.post(
        "/media/upload",
        files=[("files", ("product.png", b"image-bytes", "image/png"))],
        headers=auth_headers(admin_token),
    )
    assert upload_response.status_code == 201
    media_asset = upload_response.json()[0]
    assert media_asset["file_path"].startswith("gallery/")
    assert media_asset["original_filename"] == "product.png"

    read_response = client.get("/media/", headers=auth_headers(viewer_token))
    assert read_response.status_code == 200
    assert read_response.json()[0]["id"] == media_asset["id"]

    denied_response = client.post(
        "/media/upload",
        files=[("files", ("denied.png", b"image-bytes", "image/png"))],
        headers=auth_headers(viewer_token),
    )
    assert denied_response.status_code == 403

    delete_response = client.delete(
        f"/media/{media_asset['id']}", headers=auth_headers(admin_token)
    )
    assert delete_response.status_code == 204


def test_product_media_attachment_primary_and_delete_protection(client, db_session):
    headers = create_admin_headers(client)
    first_asset = create_media_asset(db_session, "gallery/first.png")
    second_asset = create_media_asset(db_session, "gallery/second.png")

    product_response = client.post(
        "/products/",
        json={"name": "Rotor", "sku": "ROTOR-001", "value": 75},
        headers=headers,
    )
    assert product_response.status_code == 201
    product_id = product_response.json()["id"]

    attach_response = client.put(
        f"/products/{product_id}/media",
        json={
            "attachments": [
                {"media_asset_id": first_asset.id, "sort_order": 0},
                {"media_asset_id": second_asset.id, "sort_order": 1, "is_primary": True},
            ]
        },
        headers=headers,
    )
    assert attach_response.status_code == 200
    data = attach_response.json()
    assert [image["id"] for image in data["images"]] == [first_asset.id, second_asset.id]
    assert data["primary_image"]["id"] == second_asset.id

    delete_response = client.delete(f"/media/{second_asset.id}", headers=headers)
    assert delete_response.status_code == 409


def test_snapshot_response_keeps_legacy_file_path_and_returns_gallery_images(
    client, db_session
):
    headers = create_admin_headers(client)
    product_response = client.post(
        "/products/",
        json={
            "name": "Panel",
            "sku": "PANEL-001",
            "value": 25,
            "raw_materials": "Composite",
        },
        headers=headers,
    )
    product_id = product_response.json()["id"]
    asset = create_media_asset(db_session, "gallery/snapshot.png")
    client.put(
        f"/products/{product_id}/media",
        json={"attachments": [{"media_asset_id": asset.id, "is_primary": True}]},
        headers=headers,
    )

    db_session.add(
        InventoryBox(
            box_code="PANEL-20260519-001",
            product_id=product_id,
            quantity=2,
            box_date=date(2026, 5, 19),
            is_active=True,
        )
    )
    db_session.commit()

    snapshot_response = client.post(
        "/snapshots/",
        json={
            "name": "Gallery Snapshot",
            "file_path": "snapshots/legacy.png",
            "snapshot_date": "2026-05-19",
        },
        headers=headers,
    )
    assert snapshot_response.status_code == 201
    snapshot_id = snapshot_response.json()["id"]

    attach_response = client.put(
        f"/snapshots/{snapshot_id}/media",
        json={"attachments": [{"media_asset_id": asset.id, "is_primary": True}]},
        headers=headers,
    )
    assert attach_response.status_code == 200
    data = attach_response.json()
    assert data["file_path"] == "snapshots/legacy.png"
    assert data["primary_image"]["id"] == asset.id
    assert data["images"][0]["id"] == asset.id
    assert data["items"][0]["product"]["raw_materials"] == "Composite"
    assert data["items"][0]["product"]["primary_image"]["id"] == asset.id
