from datetime import date, datetime

from models.inventory_box import InventoryBox
from models.inventory_snapshot import InventorySnapshot
from models.inventory_snapshot_item import InventorySnapshotItem
from models.product import Product
from models.production_plan import ProductionPlan
from services.comparison_service import (
    compare_snapshots,
    get_daily_delta,
    get_plan_vs_actual,
    get_stock_summary,
)


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


def create_product(db, sku: str, name: str | None = None) -> Product:
    product = Product(name=name or sku, sku=sku, value=0)
    db.add(product)
    db.flush()
    return product


def create_snapshot(
    db,
    created_at: datetime,
    items: list[tuple[Product, int] | tuple[Product, int, float | None]],
) -> InventorySnapshot:
    snapshot = InventorySnapshot(
        name=f"Snapshot {created_at.isoformat()}",
        created_at=created_at,
        file_path=f"snapshots/{created_at.isoformat()}.png",
    )
    db.add(snapshot)
    db.flush()

    for index, (product, quantity, *confidence) in enumerate(items, start=1):
        box = InventoryBox(
            box_code=f"{product.sku}-{snapshot.id}-{index}",
            product_id=product.id,
            quantity=quantity,
            box_date=created_at.date(),
            is_active=True,
        )
        db.add(box)
        db.flush()
        db.add(
            InventorySnapshotItem(
                box_id=box.id,
                box_code=box.box_code,
                product_id=product.id,
                snapshot_id=snapshot.id,
                quantity=quantity,
                box_date=box.box_date,
                confidence_score=confidence[0] if confidence else None,
            )
        )

    db.commit()
    db.refresh(snapshot)
    return snapshot


def create_plan(
    db, product: Product, plan_date: date, target_quantity: int
) -> ProductionPlan:
    plan = ProductionPlan(
        product_id=product.id,
        date=plan_date,
        target_quantity=target_quantity,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def items_by_sku(items):
    return {item.product.sku: item for item in items}


def test_compare_snapshots_reports_all_delta_statuses_and_aggregates_duplicates(db_session):
    increased = create_product(db_session, "SKU-A", "Increased")
    decreased = create_product(db_session, "SKU-B", "Decreased")
    unchanged = create_product(db_session, "SKU-C", "Unchanged")
    consumed = create_product(db_session, "SKU-D", "Consumed")
    new = create_product(db_session, "SKU-E", "New")

    baseline = create_snapshot(
        db_session,
        datetime(2026, 5, 14, 9, 0),
        [
            (increased, 5),
            (decreased, 2),
            (decreased, 2),
            (unchanged, 2),
            (consumed, 7),
        ],
    )
    current = create_snapshot(
        db_session,
        datetime(2026, 5, 15, 9, 0),
        [
            (increased, 4, 0.8),
            (increased, 4, 0.9),
            (decreased, 1, None),
            (unchanged, 2),
            (new, 6, 0.7),
        ],
    )

    result = compare_snapshots(db_session, current.id, baseline.id)
    rows = items_by_sku(result)

    assert [item.product.sku for item in result] == [
        "SKU-A",
        "SKU-B",
        "SKU-C",
        "SKU-D",
        "SKU-E",
    ]
    assert (rows["SKU-A"].previous_quantity, rows["SKU-A"].current_quantity) == (5, 8)
    assert rows["SKU-A"].added_quantity == 8
    assert rows["SKU-A"].removed_quantity == 5
    assert rows["SKU-A"].delta == 3
    assert rows["SKU-A"].status == "added"
    assert rows["SKU-A"].confidence_score is not None
    assert round(rows["SKU-A"].confidence_score, 2) == 0.85
    assert rows["SKU-B"].delta == -3
    assert rows["SKU-B"].status == "consumed"
    assert rows["SKU-B"].confidence_score is None
    assert rows["SKU-C"].delta == 0
    assert rows["SKU-C"].status == "unchanged"
    assert rows["SKU-D"].current_quantity == 0
    assert rows["SKU-D"].status == "consumed"
    assert rows["SKU-D"].confidence_score is None
    assert rows["SKU-E"].previous_quantity == 0
    assert rows["SKU-E"].status == "added"
    assert rows["SKU-E"].confidence_score == 0.7


def test_compare_snapshots_does_not_delta_boxes_present_in_both_snapshots(db_session):
    product = create_product(db_session, "SKU-STAY", "Staying Box")
    box = InventoryBox(
        box_code="BOX-STAY",
        product_id=product.id,
        quantity=10,
        box_date=date(2026, 5, 18),
        is_active=True,
    )
    db_session.add(box)
    db_session.flush()

    baseline = InventorySnapshot(
        name="Baseline",
        created_at=datetime(2026, 5, 18, 9, 0),
        file_path=None,
    )
    current = InventorySnapshot(
        name="Current",
        created_at=datetime(2026, 5, 19, 9, 0),
        file_path=None,
    )
    db_session.add_all([baseline, current])
    db_session.flush()

    for snapshot in [baseline, current]:
        db_session.add(
            InventorySnapshotItem(
                box_id=box.id,
                box_code=box.box_code,
                product_id=product.id,
                snapshot_id=snapshot.id,
                quantity=box.quantity,
                box_date=box.box_date,
            )
        )
    db_session.commit()

    result = compare_snapshots(db_session, current.id, baseline.id)

    assert len(result) == 1
    assert result[0].previous_quantity == 10
    assert result[0].current_quantity == 10
    assert result[0].added_quantity == 0
    assert result[0].removed_quantity == 0
    assert result[0].delta == 0
    assert result[0].added_boxes == []
    assert result[0].removed_boxes == []


def test_get_daily_delta_uses_latest_snapshot_for_requested_and_previous_day(db_session):
    product = create_product(db_session, "SKU-001", "Widget")

    create_snapshot(db_session, datetime(2026, 5, 14, 8, 0), [(product, 1)])
    latest_baseline = create_snapshot(
        db_session, datetime(2026, 5, 14, 17, 0), [(product, 2)]
    )
    create_snapshot(db_session, datetime(2026, 5, 15, 8, 0), [(product, 3)])
    latest_current = create_snapshot(
        db_session, datetime(2026, 5, 15, 18, 0), [(product, 5)]
    )

    result = get_daily_delta(db_session, date(2026, 5, 15))

    assert result is not None
    assert result.current_snapshot_id == latest_current.id
    assert result.baseline_snapshot_id == latest_baseline.id
    assert result.items[0].previous_quantity == 2
    assert result.items[0].current_quantity == 5
    assert result.items[0].added_quantity == 5
    assert result.items[0].removed_quantity == 2
    assert result.items[0].delta == 3


def test_get_daily_delta_returns_none_when_requested_date_has_no_snapshot(db_session):
    assert get_daily_delta(db_session, date(2026, 5, 15)) is None


def test_get_daily_delta_without_previous_day_reports_all_current_items_as_new(db_session):
    product = create_product(db_session, "SKU-001", "Widget")
    current = create_snapshot(db_session, datetime(2026, 5, 15, 8, 0), [(product, 4)])

    result = get_daily_delta(db_session, date(2026, 5, 15))

    assert result is not None
    assert result.current_snapshot_id == current.id
    assert result.baseline_date == date(2026, 5, 14)
    assert result.baseline_snapshot_id is None
    assert result.items[0].previous_quantity == 0
    assert result.items[0].current_quantity == 4
    assert result.items[0].added_quantity == 4
    assert result.items[0].removed_quantity == 0
    assert result.items[0].delta == 4
    assert result.items[0].status == "added"


def test_get_stock_summary_uses_latest_snapshot_and_aggregates_items(db_session):
    product = create_product(db_session, "SKU-001", "Widget")
    create_snapshot(db_session, datetime(2026, 5, 14, 8, 0), [(product, 2)])
    latest = create_snapshot(
        db_session,
        datetime(2026, 5, 15, 8, 0),
        [(product, 3), (product, 4)],
    )

    result = get_stock_summary(db_session)

    assert result is not None
    assert result.snapshot_id == latest.id
    assert result.snapshot_date == date(2026, 5, 15)
    assert result.items[0].product.sku == "SKU-001"
    assert result.items[0].quantity == 7


def test_daily_delta_endpoint_returns_authenticated_report(client, db_session):
    headers = auth_headers(client)
    product = create_product(db_session, "SKU-001", "Widget")
    baseline = create_snapshot(db_session, datetime(2026, 5, 14, 8, 0), [(product, 2)])
    current = create_snapshot(
        db_session, datetime(2026, 5, 15, 8, 0), [(product, 5, 0.92)]
    )

    response = client.get("/reports/daily-delta?date=2026-05-15", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["date"] == "2026-05-15"
    assert data["current_snapshot_id"] == current.id
    assert data["baseline_snapshot_id"] == baseline.id
    assert data["items"][0]["product"]["sku"] == "SKU-001"
    assert data["items"][0]["delta"] == 3
    assert data["items"][0]["status"] == "added"
    assert data["items"][0]["confidence_score"] == 0.92


def test_daily_delta_endpoint_returns_404_when_requested_date_has_no_snapshot(client):
    headers = auth_headers(client)

    response = client.get("/reports/daily-delta?date=2026-05-15", headers=headers)

    assert response.status_code == 404


def test_stock_summary_endpoint_returns_authenticated_latest_stock(client, db_session):
    headers = auth_headers(client)
    product = create_product(db_session, "SKU-001", "Widget")
    snapshot = create_snapshot(db_session, datetime(2026, 5, 15, 8, 0), [(product, 4)])

    response = client.get("/reports/stock-summary", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["snapshot_id"] == snapshot.id
    assert data["snapshot_date"] == "2026-05-15"
    assert data["items"][0]["product"]["sku"] == "SKU-001"
    assert data["items"][0]["quantity"] == 4


def test_stock_summary_endpoint_returns_404_when_no_snapshots_exist(client):
    headers = auth_headers(client)

    response = client.get("/reports/stock-summary", headers=headers)

    assert response.status_code == 404


def test_get_plan_vs_actual_uses_latest_snapshot_and_aggregates_items(db_session):
    product = create_product(db_session, "SKU-001", "Widget")
    create_plan(db_session, product, date(2026, 5, 16), 8)
    create_snapshot(db_session, datetime(2026, 5, 16, 8, 0), [(product, 1)])
    latest = create_snapshot(
        db_session,
        datetime(2026, 5, 16, 18, 0),
        [(product, 7), (product, 3)],
    )

    result = get_plan_vs_actual(
        db_session, date(2026, 5, 16), date(2026, 5, 16)
    )

    assert result.from_date == date(2026, 5, 16)
    assert result.to_date == date(2026, 5, 16)
    assert len(result.items) == 1
    assert result.items[0].snapshot_id == latest.id
    assert result.items[0].planned_quantity == 8
    assert result.items[0].actual_quantity == 10
    assert result.items[0].variance == 2


def test_get_plan_vs_actual_returns_zero_actual_without_snapshot(db_session):
    product = create_product(db_session, "SKU-001", "Widget")
    create_plan(db_session, product, date(2026, 5, 16), 5)

    result = get_plan_vs_actual(
        db_session, date(2026, 5, 16), date(2026, 5, 16)
    )

    assert len(result.items) == 1
    assert result.items[0].snapshot_id is None
    assert result.items[0].actual_quantity == 0
    assert result.items[0].variance == -5


def test_plan_vs_actual_endpoint_returns_authenticated_report(client, db_session):
    headers = auth_headers(client)
    product = create_product(db_session, "SKU-001", "Widget")
    create_plan(db_session, product, date(2026, 5, 16), 12)
    create_snapshot(db_session, datetime(2026, 5, 16, 8, 0), [(product, 9)])

    response = client.get(
        "/reports/plan-vs-actual?from=2026-05-16&to=2026-05-16",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["from_date"] == "2026-05-16"
    assert data["to_date"] == "2026-05-16"
    assert data["items"][0]["product"]["sku"] == "SKU-001"
    assert data["items"][0]["planned_quantity"] == 12
    assert data["items"][0]["actual_quantity"] == 9
    assert data["items"][0]["variance"] == -3
