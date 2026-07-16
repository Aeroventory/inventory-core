from datetime import date, datetime

import routers.snapshots as snapshots_router
import services.snapshot_services as snapshot_services
from models.inventory_box import InventoryBox
from models.media import MediaAsset
from models.product import Product
from services.file_service import TEMP_DIR, UPLOADS_DIR
from services.snapshot_services import ingest_snapshot


class FixedDatetime(datetime):
    @classmethod
    def now(cls):
        return cls(2026, 5, 18, 14, 15, 16)


def auth_headers(client):
    response = client.post(
        "/auth/register",
        json={"username": "admin", "password": "secret-password", "role": "admin"},
    )
    assert response.status_code == 201

    response = client.post(
        "/auth/login", data={"username": "admin", "password": "secret-password"}
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def write_drone_photo(filename: str, content: bytes = b"image-bytes") -> str:
    photo_dir = UPLOADS_DIR / "drone"
    photo_dir.mkdir(parents=True, exist_ok=True)
    path = photo_dir / filename
    path.write_bytes(content)
    return f"drone/{filename}"


def test_create_snapshot_accepts_date_and_snapshot_type(client, monkeypatch):
    monkeypatch.setattr(snapshot_services, "datetime", FixedDatetime)
    headers = auth_headers(client)

    response = client.post(
        "/snapshots/",
        json={
            "name": "Drone Count",
            "file_path": "snapshots/drone.png",
            "snapshot_date": "2026-05-20",
            "snapshot_type": "drone",
        },
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["snapshot_type"] == "drone"
    assert data["created_at"] == "2026-05-20T14:15:16"


def test_create_snapshot_defaults_to_manual(client):
    headers = auth_headers(client)

    response = client.post(
        "/snapshots/",
        json={"name": "Manual Count", "file_path": "snapshots/manual.png"},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["snapshot_type"] == "manual"


def test_create_snapshot_captures_active_inventory_boxes(client, db_session):
    headers = auth_headers(client)
    product = Product(name="Car", sku="CAR", value=0)
    db_session.add(product)
    db_session.flush()
    active_box = InventoryBox(
        box_code="CAR-20260518-001",
        product_id=product.id,
        quantity=50,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    removed_box = InventoryBox(
        box_code="CAR-20260517-001",
        product_id=product.id,
        quantity=25,
        box_date=date(2026, 5, 17),
        is_active=False,
    )
    db_session.add_all([active_box, removed_box])
    db_session.commit()

    response = client.post(
        "/snapshots/",
        json={"name": "Pool Capture", "snapshot_date": "2026-05-18"},
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["file_path"] is None
    assert len(data["items"]) == 1
    assert data["items"][0]["box_id"] == active_box.id
    assert data["items"][0]["box_code"] == "CAR-20260518-001"
    assert data["items"][0]["quantity"] == 50


def test_create_snapshot_commits_staged_box_removals_before_capture(client, db_session):
    headers = auth_headers(client)
    product = Product(name="Car", sku="CAR", value=0)
    db_session.add(product)
    db_session.flush()
    keep_box = InventoryBox(
        box_code="CAR-20260518-KEEP",
        product_id=product.id,
        quantity=50,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    remove_box = InventoryBox(
        box_code="CAR-20260518-REMOVE",
        product_id=product.id,
        quantity=25,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    db_session.add_all([keep_box, remove_box])
    db_session.commit()

    response = client.post(
        "/snapshots/",
        json={
            "name": "Pool Capture",
            "snapshot_date": "2026-05-18",
            "removed_box_ids": [remove_box.id],
        },
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert [item["box_code"] for item in data["items"]] == ["CAR-20260518-KEEP"]

    db_session.refresh(keep_box)
    db_session.refresh(remove_box)
    assert keep_box.is_active is True
    assert remove_box.is_active is False
    assert remove_box.removed_at is not None


def test_removed_box_disappears_from_new_snapshots_but_old_snapshot_keeps_it(
    client, db_session
):
    headers = auth_headers(client)
    product = Product(name="Car", sku="CAR", value=0)
    db_session.add(product)
    db_session.flush()
    box = InventoryBox(
        box_code="CAR-20260518-001",
        product_id=product.id,
        quantity=50,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    db_session.add(box)
    db_session.commit()

    first = client.post(
        "/snapshots/",
        json={"name": "Before Removal", "snapshot_date": "2026-05-18"},
        headers=headers,
    )
    assert first.status_code == 201

    box.is_active = False
    box.removed_at = datetime(2026, 5, 18, 15, 0)
    db_session.commit()

    second = client.post(
        "/snapshots/",
        json={"name": "After Removal", "snapshot_date": "2026-05-19"},
        headers=headers,
    )
    assert second.status_code == 201

    assert len(first.json()["items"]) == 1
    assert first.json()["items"][0]["box_code"] == "CAR-20260518-001"
    assert second.json()["items"] == []


def test_ingest_snapshot_creates_drone_snapshot(db_session, monkeypatch):
    monkeypatch.setattr(snapshot_services, "datetime", FixedDatetime)

    snapshot = ingest_snapshot(
        db_session,
        "snapshots/drone.png",
        date(2026, 5, 19),
        [{"sku": "DRONE-001", "count": 4, "confidence": 0.92}],
    )

    assert snapshot.snapshot_type == "AI"
    assert snapshot.created_at == datetime(2026, 5, 19, 14, 15, 16)
    assert len(snapshot.items) == 1
    assert snapshot.items[0].box_code.startswith("DRONE-001-20260519")
    assert snapshot.items[0].quantity == 4
    assert snapshot.items[0].confidence_score == 0.92


def test_ingest_snapshot_updates_existing_box_and_keeps_it_active(db_session, monkeypatch):
    monkeypatch.setattr(snapshot_services, "datetime", FixedDatetime)
    product = Product(name="Drone Car", sku="DRONE-001", value=0)
    db_session.add(product)
    db_session.flush()
    box = InventoryBox(
        box_code="BOX-001",
        product_id=product.id,
        quantity=2,
        box_date=date(2026, 5, 18),
        is_active=False,
    )
    db_session.add(box)
    db_session.commit()

    snapshot = ingest_snapshot(
        db_session,
        "snapshots/drone.png",
        date(2026, 5, 19),
        [
            {
                "box_code": "BOX-001",
                "sku": "DRONE-001",
                "quantity": 5,
                "box_date": "2026-05-19",
                "confidence": 0.85,
            }
        ],
    )

    assert len(snapshot.items) == 1
    assert snapshot.items[0].box_code == "BOX-001"
    assert snapshot.items[0].quantity == 5
    assert snapshot.items[0].box_date == date(2026, 5, 19)
    db_session.refresh(box)
    assert box.is_active is True
    assert box.quantity == 5


def test_ai_analyze_returns_matched_and_unmatched_rows(client, db_session, monkeypatch):
    headers = auth_headers(client)
    product = Product(name="Panel", sku="PNL-001", value=0)
    db_session.add(product)
    db_session.commit()

    async def fake_analyze(file_path, product_catalog):
        assert product_catalog[0]["sku"] == "PNL-001"
        return {
            "detections": [
                {
                    "sku": "PNL-001",
                    "box_code": "BOX-MATCH",
                    "quantity": 4,
                    "confidence_score": 0.91,
                },
                {
                    "sku": "UNKNOWN",
                    "product_name": "Unknown part",
                    "box_code": "BOX-UNKNOWN",
                    "quantity": 2,
                    "confidence_score": 0.52,
                },
            ],
            "unmatched": [],
            "raw_json": {"source": "test"},
            "model_version": "test-gemini",
        }

    monkeypatch.setattr(snapshots_router, "call_vision_ai_analyze", fake_analyze)

    response = client.post(
        "/snapshots/ai/analyze",
        files={"file": ("snapshot.png", b"image-bytes", "image/png")},
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["temp_filename"].endswith(".png")
    assert data["detections"][0]["product_id"] == product.id
    assert data["detections"][0]["box_code"] == "BOX-MATCH"
    assert data["unmatched"][0]["sku"] == "UNKNOWN"
    assert db_session.query(Product).count() == 1
    (TEMP_DIR / data["temp_filename"]).unlink(missing_ok=True)


def test_ai_analyze_maps_by_sku_when_product_id_is_missing(client, db_session, monkeypatch):
    headers = auth_headers(client)
    product = Product(name="Ventilation Panel", sku="VENT-001", value=0)
    db_session.add(product)
    db_session.commit()

    async def fake_analyze(file_path, product_catalog):
        return {
            "detections": [
                {
                    "sku": " VENT-001 ",
                    "box_code": "BOX-VENT",
                    "quantity": 8,
                }
            ],
            "unmatched": [],
            "raw_json": {},
            "model_version": "test-gemini",
        }

    monkeypatch.setattr(snapshots_router, "call_vision_ai_analyze", fake_analyze)

    response = client.post(
        "/snapshots/ai/analyze",
        files={"file": ("snapshot.png", b"image-bytes", "image/png")},
        headers=headers,
    )

    assert response.status_code == 200
    row = response.json()["detections"][0]
    assert row["product_id"] == product.id
    assert row["sku"] == "VENT-001"
    assert row["product_name"] == "Ventilation Panel"
    (TEMP_DIR / response.json()["temp_filename"]).unlink(missing_ok=True)


def test_ai_analyze_uses_sku_when_product_id_or_name_conflicts(client, db_session, monkeypatch):
    headers = auth_headers(client)
    sku_product = Product(name="Filter Cartridge", sku="FLT-001", value=0)
    wrong_product = Product(name="Fan Motor", sku="MTR-001", value=0)
    db_session.add_all([sku_product, wrong_product])
    db_session.commit()

    async def fake_analyze(file_path, product_catalog):
        return {
            "detections": [
                {
                    "product_id": wrong_product.id,
                    "sku": "FLT-001",
                    "product_name": "Fan Motor",
                    "box_code": "BOX-FLT",
                    "quantity": 16,
                }
            ],
            "unmatched": [],
            "raw_json": {},
            "model_version": "test-gemini",
        }

    monkeypatch.setattr(snapshots_router, "call_vision_ai_analyze", fake_analyze)

    response = client.post(
        "/snapshots/ai/analyze",
        files={"file": ("snapshot.png", b"image-bytes", "image/png")},
        headers=headers,
    )

    assert response.status_code == 200
    row = response.json()["detections"][0]
    assert row["product_id"] == sku_product.id
    assert row["sku"] == "FLT-001"
    assert row["product_name"] == "Filter Cartridge"
    assert "Review warning" in row["notes"]
    assert str(wrong_product.id) in row["notes"]
    (TEMP_DIR / response.json()["temp_filename"]).unlink(missing_ok=True)


def test_ai_analyze_fills_sku_and_name_when_only_valid_product_id_is_returned(client, db_session, monkeypatch):
    headers = auth_headers(client)
    product = Product(name="Compressor Kit", sku="CMP-001", value=0)
    db_session.add(product)
    db_session.commit()

    async def fake_analyze(file_path, product_catalog):
        return {
            "detections": [
                {
                    "product_id": product.id,
                    "box_code": "BOX-CMP",
                    "quantity": 3,
                }
            ],
            "unmatched": [],
            "raw_json": {},
            "model_version": "test-gemini",
        }

    monkeypatch.setattr(snapshots_router, "call_vision_ai_analyze", fake_analyze)

    response = client.post(
        "/snapshots/ai/analyze",
        files={"file": ("snapshot.png", b"image-bytes", "image/png")},
        headers=headers,
    )

    assert response.status_code == 200
    row = response.json()["detections"][0]
    assert row["product_id"] == product.id
    assert row["sku"] == "CMP-001"
    assert row["product_name"] == "Compressor Kit"
    (TEMP_DIR / response.json()["temp_filename"]).unlink(missing_ok=True)


def test_ai_analyze_requires_admin(client, db_session, monkeypatch):
    admin_headers = auth_headers(client)
    viewer_response = client.post(
        "/auth/register",
        json={"username": "viewer", "password": "viewer-password", "role": "viewer"},
        headers=admin_headers,
    )
    assert viewer_response.status_code == 201
    login_response = client.post(
        "/auth/login", data={"username": "viewer", "password": "viewer-password"}
    )
    viewer_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    response = client.post(
        "/snapshots/ai/analyze",
        files={"file": ("snapshot.png", b"image-bytes", "image/png")},
        headers=viewer_headers,
    )

    assert response.status_code == 403


def test_ai_create_syncs_active_pool_and_captures_snapshot(client, db_session):
    headers = auth_headers(client)
    product = Product(name="Panel", sku="PNL-001", value=0)
    other_product = Product(name="Motor", sku="MTR-001", value=0)
    db_session.add_all([product, other_product])
    db_session.flush()
    keep_box = InventoryBox(
        box_code="BOX-KEEP",
        product_id=product.id,
        quantity=1,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    remove_box = InventoryBox(
        box_code="BOX-REMOVE",
        product_id=other_product.id,
        quantity=3,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    db_session.add_all([keep_box, remove_box])
    db_session.commit()

    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    temp_filename = "ai-sync-test.png"
    (TEMP_DIR / temp_filename).write_bytes(b"image-bytes")

    response = client.post(
        "/snapshots/ai/create",
        json={
            "name": "AI Count",
            "snapshot_date": "2026-05-20",
            "temp_filename": temp_filename,
            "confirmed_removed_box_ids": [remove_box.id],
            "rows": [
                {
                    "product_id": product.id,
                    "box_code": "BOX-KEEP",
                    "quantity": 9,
                    "box_date": "2026-05-20",
                    "confidence_score": 0.96,
                },
                {
                    "product_id": product.id,
                    "quantity": 2,
                    "box_date": "2026-05-20",
                    "confidence_score": 0.88,
                },
            ],
        },
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "AI Count"
    assert data["snapshot_type"] == "AI"
    assert data["file_path"].startswith("snapshots/")
    assert len(data["items"]) == 2
    assert {item["quantity"] for item in data["items"]} == {2, 9}
    assert "BOX-REMOVE" not in {item["box_code"] for item in data["items"]}

    db_session.refresh(keep_box)
    db_session.refresh(remove_box)
    assert keep_box.quantity == 9
    assert keep_box.is_active is True
    assert remove_box.is_active is False
    assert remove_box.removed_at is not None
    (UPLOADS_DIR / data["file_path"]).unlink(missing_ok=True)


def test_ai_create_rejects_stale_removed_box_confirmation(client, db_session):
    headers = auth_headers(client)
    product = Product(name="Panel", sku="PNL-001", value=0)
    db_session.add(product)
    db_session.flush()
    keep_box = InventoryBox(
        box_code="BOX-KEEP",
        product_id=product.id,
        quantity=1,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    remove_box = InventoryBox(
        box_code="BOX-REMOVE",
        product_id=product.id,
        quantity=3,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    db_session.add_all([keep_box, remove_box])
    db_session.commit()

    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    temp_filename = "ai-stale-test.png"
    (TEMP_DIR / temp_filename).write_bytes(b"image-bytes")

    response = client.post(
        "/snapshots/ai/create",
        json={
            "name": "AI Count",
            "snapshot_date": "2026-05-20",
            "temp_filename": temp_filename,
            "confirmed_removed_box_ids": [],
            "rows": [
                {
                    "product_id": product.id,
                    "box_code": "BOX-KEEP",
                    "quantity": 2,
                    "box_date": "2026-05-20",
                }
            ],
        },
        headers=headers,
    )

    assert response.status_code == 409
    assert response.json()["detail"]["expected_removed_box_ids"] == [remove_box.id]
    (TEMP_DIR / temp_filename).unlink(missing_ok=True)


def test_drone_analyze_returns_matched_and_unmatched_rows(client, db_session, monkeypatch):
    headers = auth_headers(client)
    product = Product(name="Panel", sku="PNL-001", value=0)
    db_session.add(product)
    db_session.commit()
    image_path = write_drone_photo("analyze-1.jpg")

    async def fake_analyze_batch(file_paths, product_catalog):
        assert file_paths == [str(UPLOADS_DIR / image_path)]
        assert product_catalog[0]["sku"] == "PNL-001"
        return {
            "detections": [
                {
                    "sku": "PNL-001",
                    "box_code": "BOX-DRONE",
                    "quantity": 4,
                    "confidence_score": 0.91,
                }
            ],
            "unmatched": [
                {
                    "sku": "UNKNOWN",
                    "box_code": "BOX-UNKNOWN",
                    "quantity": 1,
                    "confidence_score": 0.41,
                }
            ],
            "raw_json": {"source": "drone"},
            "model_version": "test-gemini",
        }

    monkeypatch.setattr(
        snapshots_router, "call_vision_ai_analyze_batch", fake_analyze_batch
    )

    response = client.post(
        "/snapshots/drone/analyze",
        json={"image_paths": [image_path]},
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["image_paths"] == [image_path]
    assert data["detections"][0]["product_id"] == product.id
    assert data["detections"][0]["box_code"] == "BOX-DRONE"
    assert data["unmatched"][0]["sku"] == "UNKNOWN"
    (UPLOADS_DIR / image_path).unlink(missing_ok=True)


def test_drone_analyze_validates_photo_paths(client):
    headers = auth_headers(client)

    response = client.post(
        "/snapshots/drone/analyze",
        json={"image_paths": ["snapshots/not-drone.jpg"]},
        headers=headers,
    )

    assert response.status_code == 422
    assert "uploads/drone" in response.json()["detail"]


def test_drone_snapshot_endpoints_require_admin(client):
    admin_headers = auth_headers(client)
    viewer_response = client.post(
        "/auth/register",
        json={"username": "viewer", "password": "viewer-password", "role": "viewer"},
        headers=admin_headers,
    )
    assert viewer_response.status_code == 201
    login_response = client.post(
        "/auth/login", data={"username": "viewer", "password": "viewer-password"}
    )
    viewer_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}
    image_path = write_drone_photo("viewer-denied.jpg")

    analyze = client.post(
        "/snapshots/drone/analyze",
        json={"image_paths": [image_path]},
        headers=viewer_headers,
    )
    create = client.post(
        "/snapshots/drone/create",
        json={
            "name": "Drone Count",
            "snapshot_date": "2026-05-20",
            "image_paths": [image_path],
            "confirmed_removed_box_ids": [],
            "rows": [],
        },
        headers=viewer_headers,
    )

    assert analyze.status_code == 403
    assert create.status_code == 403
    (UPLOADS_DIR / image_path).unlink(missing_ok=True)


def test_drone_create_syncs_active_pool_and_attaches_photos(client, db_session):
    headers = auth_headers(client)
    product = Product(name="Panel", sku="PNL-001", value=0)
    other_product = Product(name="Motor", sku="MTR-001", value=0)
    db_session.add_all([product, other_product])
    db_session.flush()
    keep_box = InventoryBox(
        box_code="BOX-KEEP",
        product_id=product.id,
        quantity=1,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    remove_box = InventoryBox(
        box_code="BOX-REMOVE",
        product_id=other_product.id,
        quantity=3,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    db_session.add_all([keep_box, remove_box])
    db_session.commit()
    first_image_path = write_drone_photo("create-1.jpg")
    second_image_path = write_drone_photo("create-2.jpg")

    response = client.post(
        "/snapshots/drone/create",
        json={
            "name": "Drone Count",
            "snapshot_date": "2026-05-20",
            "image_paths": [first_image_path, second_image_path],
            "confirmed_removed_box_ids": [remove_box.id],
            "rows": [
                {
                    "product_id": product.id,
                    "box_code": "BOX-KEEP",
                    "quantity": 9,
                    "box_date": "2026-05-20",
                    "confidence_score": 0.96,
                },
                {
                    "product_id": product.id,
                    "quantity": 2,
                    "box_date": "2026-05-20",
                    "confidence_score": 0.88,
                },
            ],
        },
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["snapshot_type"] == "drone"
    assert data["file_path"] == first_image_path
    assert data["primary_image"]["file_path"] == first_image_path
    assert [image["file_path"] for image in data["images"]] == [
        first_image_path,
        second_image_path,
    ]
    assert len(data["items"]) == 2
    assert "BOX-REMOVE" not in {item["box_code"] for item in data["items"]}

    db_session.refresh(keep_box)
    db_session.refresh(remove_box)
    assert keep_box.quantity == 9
    assert keep_box.is_active is True
    assert remove_box.is_active is False
    assert remove_box.removed_at is not None
    assert db_session.query(MediaAsset).count() == 2
    (UPLOADS_DIR / first_image_path).unlink(missing_ok=True)
    (UPLOADS_DIR / second_image_path).unlink(missing_ok=True)


def test_drone_create_rejects_stale_removed_box_confirmation(client, db_session):
    headers = auth_headers(client)
    product = Product(name="Panel", sku="PNL-001", value=0)
    db_session.add(product)
    db_session.flush()
    keep_box = InventoryBox(
        box_code="BOX-KEEP",
        product_id=product.id,
        quantity=1,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    remove_box = InventoryBox(
        box_code="BOX-REMOVE",
        product_id=product.id,
        quantity=3,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    db_session.add_all([keep_box, remove_box])
    db_session.commit()
    image_path = write_drone_photo("stale.jpg")

    response = client.post(
        "/snapshots/drone/create",
        json={
            "name": "Drone Count",
            "snapshot_date": "2026-05-20",
            "image_paths": [image_path],
            "confirmed_removed_box_ids": [],
            "rows": [
                {
                    "product_id": product.id,
                    "box_code": "BOX-KEEP",
                    "quantity": 2,
                    "box_date": "2026-05-20",
                }
            ],
        },
        headers=headers,
    )

    assert response.status_code == 409
    assert response.json()["detail"]["expected_removed_box_ids"] == [remove_box.id]
    (UPLOADS_DIR / image_path).unlink(missing_ok=True)
