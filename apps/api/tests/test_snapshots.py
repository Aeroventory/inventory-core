from datetime import date, datetime

import services.snapshot_services as snapshot_services
from models.inventory_box import InventoryBox
from models.product import Product
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


def test_create_snapshot_accepts_date_and_manual_flag(client, monkeypatch):
    monkeypatch.setattr(snapshot_services, "datetime", FixedDatetime)
    headers = auth_headers(client)

    response = client.post(
        "/snapshots/",
        json={
            "name": "Drone Count",
            "file_path": "snapshots/drone.png",
            "snapshot_date": "2026-05-20",
            "is_manual": False,
        },
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["is_manual"] is False
    assert data["created_at"] == "2026-05-20T14:15:16"


def test_create_snapshot_defaults_to_manual(client):
    headers = auth_headers(client)

    response = client.post(
        "/snapshots/",
        json={"name": "Manual Count", "file_path": "snapshots/manual.png"},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["is_manual"] is True


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

    assert snapshot.is_manual is False
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
