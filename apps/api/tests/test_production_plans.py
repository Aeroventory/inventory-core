from datetime import date, timedelta

from models.product import Product
from models.production_plan import ProductionPlan


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


def register_user(client, admin_headers, username, role):
    response = client.post(
        "/auth/register",
        json={"username": username, "password": f"{username}-password", "role": role},
        headers=admin_headers,
    )
    assert response.status_code == 201

    response = client.post(
        "/auth/login",
        data={"username": username, "password": f"{username}-password"},
    )
    assert response.status_code == 200
    return auth_headers(response.json()["access_token"])


def create_product(db, sku="SKU-001") -> Product:
    product = Product(name=sku, sku=sku, value=0)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def create_plan(db, product: Product, plan_date: date, quantity: int) -> ProductionPlan:
    plan = ProductionPlan(
        product_id=product.id,
        date=plan_date,
        target_quantity=quantity,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def test_planner_can_create_update_and_delete_plan(client, db_session):
    product = create_product(db_session)
    admin_headers = register_first_admin(client)
    planner_headers = register_user(client, admin_headers, "planner", "planner")
    plan_date = date(2026, 5, 20)

    response = client.post(
        "/production-plans",
        json={
            "product_id": product.id,
            "target_quantity": 100,
            "date": plan_date.isoformat(),
        },
        headers=planner_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["product_id"] == product.id
    assert data["target_quantity"] == 100
    assert data["date"] == plan_date.isoformat()
    assert data["created_by"] is not None

    plan_id = data["id"]
    response = client.patch(
        f"/production-plans/{plan_id}",
        json={"target_quantity": 125},
        headers=planner_headers,
    )
    assert response.status_code == 200
    assert response.json()["target_quantity"] == 125

    response = client.delete(f"/production-plans/{plan_id}", headers=planner_headers)
    assert response.status_code == 204

    response = client.get(
        f"/production-plans?from={plan_date.isoformat()}&to={plan_date.isoformat()}",
        headers=planner_headers,
    )
    assert response.status_code == 200
    assert response.json() == []


def test_viewer_can_list_but_cannot_mutate_plans(client, db_session):
    product = create_product(db_session)
    plan = create_plan(db_session, product, date(2026, 5, 20), 100)
    admin_headers = register_first_admin(client)
    viewer_headers = register_user(client, admin_headers, "viewer", "viewer")

    response = client.get(
        "/production-plans?from=2026-05-20&to=2026-05-20",
        headers=viewer_headers,
    )
    assert response.status_code == 200
    assert response.json()[0]["id"] == plan.id

    response = client.post(
        "/production-plans",
        json={
            "product_id": product.id,
            "target_quantity": 50,
            "date": "2026-05-21",
        },
        headers=viewer_headers,
    )
    assert response.status_code == 403

    response = client.patch(
        f"/production-plans/{plan.id}",
        json={"target_quantity": 125},
        headers=viewer_headers,
    )
    assert response.status_code == 403

    response = client.delete(f"/production-plans/{plan.id}", headers=viewer_headers)
    assert response.status_code == 403


def test_single_create_rejects_duplicate_product_date(client, db_session):
    product = create_product(db_session)
    create_plan(db_session, product, date(2026, 5, 20), 100)
    admin_headers = register_first_admin(client)

    response = client.post(
        "/production-plans",
        json={
            "product_id": product.id,
            "target_quantity": 200,
            "date": "2026-05-20",
        },
        headers=admin_headers,
    )

    assert response.status_code == 409


def test_bulk_create_makes_one_plan_per_date_and_updates_overlap(client, db_session):
    product = create_product(db_session)
    create_plan(db_session, product, date(2026, 5, 21), 100)
    admin_headers = register_first_admin(client)
    planner_headers = register_user(client, admin_headers, "planner", "planner")

    response = client.post(
        "/production-plans/bulk",
        json={
            "product_id": product.id,
            "target_quantity": 500,
            "from": "2026-05-20",
            "to": "2026-05-22",
        },
        headers=planner_headers,
    )

    assert response.status_code == 201
    rows = response.json()
    assert [row["date"] for row in rows] == [
        "2026-05-20",
        "2026-05-21",
        "2026-05-22",
    ]
    assert [row["target_quantity"] for row in rows] == [500, 500, 500]
    assert db_session.query(ProductionPlan).count() == 3


def test_get_production_plans_filters_inclusive_date_range(client, db_session):
    product = create_product(db_session)
    create_plan(db_session, product, date(2026, 5, 19), 90)
    included = create_plan(db_session, product, date(2026, 5, 20), 100)
    create_plan(db_session, product, date(2026, 5, 23), 130)
    admin_headers = register_first_admin(client)

    response = client.get(
        "/production-plans?from=2026-05-20&to=2026-05-22",
        headers=admin_headers,
    )

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["id"] == included.id
    assert rows[0]["date"] == "2026-05-20"


def test_create_validates_product_and_planning_horizon(client, db_session):
    product = create_product(db_session)
    admin_headers = register_first_admin(client)
    too_far = date.today() + timedelta(days=93)

    response = client.post(
        "/production-plans",
        json={
            "product_id": 999,
            "target_quantity": 100,
            "date": "2026-05-20",
        },
        headers=admin_headers,
    )
    assert response.status_code == 404

    response = client.post(
        "/production-plans/bulk",
        json={
            "product_id": product.id,
            "target_quantity": 100,
            "from": date.today().isoformat(),
            "to": too_far.isoformat(),
        },
        headers=admin_headers,
    )
    assert response.status_code == 422
