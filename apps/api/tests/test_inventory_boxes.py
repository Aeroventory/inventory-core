from datetime import date

from models.inventory_box import InventoryBox
from models.product import Product


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def register_first_admin(client):
    response = client.post(
        "/auth/register",
        json={"username": "admin", "password": "admin-password", "role": "admin"},
    )
    assert response.status_code == 201

    response = client.post(
        "/auth/login", data={"username": "admin", "password": "admin-password"}
    )
    assert response.status_code == 200
    return auth_headers(response.json()["access_token"])


def register_viewer(client, admin_headers):
    response = client.post(
        "/auth/register",
        json={"username": "viewer", "password": "viewer-password", "role": "viewer"},
        headers=admin_headers,
    )
    assert response.status_code == 201

    response = client.post(
        "/auth/login", data={"username": "viewer", "password": "viewer-password"}
    )
    assert response.status_code == 200
    return auth_headers(response.json()["access_token"])


def create_product(db) -> Product:
    product = Product(name="Car", sku="CAR", value=0)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def test_admin_can_create_edit_and_soft_remove_inventory_box(client, db_session):
    product = create_product(db_session)
    headers = register_first_admin(client)

    response = client.post(
        "/inventory-boxes",
        json={
            "box_code": "CAR-20260518-001",
            "product_id": product.id,
            "quantity": 50,
            "box_date": "2026-05-18",
        },
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["box_code"] == "CAR-20260518-001"
    assert data["quantity"] == 50
    assert data["is_active"] is True
    box_id = data["id"]

    response = client.patch(
        f"/inventory-boxes/{box_id}",
        json={"quantity": 75},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["quantity"] == 75

    response = client.delete(f"/inventory-boxes/{box_id}", headers=headers)
    assert response.status_code == 204

    box = db_session.query(InventoryBox).filter(InventoryBox.id == box_id).first()
    assert box.is_active is False
    assert box.removed_at is not None


def test_viewer_can_read_but_not_mutate_inventory_boxes(client, db_session):
    product = create_product(db_session)
    db_session.add(
        InventoryBox(
            box_code="CAR-20260518-001",
            product_id=product.id,
            quantity=50,
            box_date=date(2026, 5, 18),
            is_active=True,
        )
    )
    db_session.commit()
    admin_headers = register_first_admin(client)
    viewer_headers = register_viewer(client, admin_headers)

    response = client.get("/inventory-boxes?active=true", headers=viewer_headers)
    assert response.status_code == 200
    assert response.json()[0]["box_code"] == "CAR-20260518-001"

    response = client.post(
        "/inventory-boxes",
        json={"product_id": product.id, "quantity": 20, "box_date": "2026-05-19"},
        headers=viewer_headers,
    )
    assert response.status_code == 403


def test_inventory_box_filters_by_date_and_active_state(client, db_session):
    product = create_product(db_session)
    db_session.add_all(
        [
            InventoryBox(
                box_code="CAR-20260517-001",
                product_id=product.id,
                quantity=10,
                box_date=date(2026, 5, 17),
                is_active=True,
            ),
            InventoryBox(
                box_code="CAR-20260518-001",
                product_id=product.id,
                quantity=20,
                box_date=date(2026, 5, 18),
                is_active=False,
            ),
            InventoryBox(
                box_code="CAR-20260519-001",
                product_id=product.id,
                quantity=30,
                box_date=date(2026, 5, 19),
                is_active=True,
            ),
        ]
    )
    db_session.commit()
    headers = register_first_admin(client)

    response = client.get(
        "/inventory-boxes?active=true&from=2026-05-18&to=2026-05-20",
        headers=headers,
    )

    assert response.status_code == 200
    assert [box["box_code"] for box in response.json()] == ["CAR-20260519-001"]
