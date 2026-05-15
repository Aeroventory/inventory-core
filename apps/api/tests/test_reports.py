from datetime import date, datetime

from models.inventory_snapshot import InventorySnapshot
from models.inventory_snapshot_item import InventorySnapshotItem
from models.product import Product
from services.comparison_service import compare_snapshots, get_daily_delta, get_stock_summary


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
    items: list[tuple[Product, int]],
) -> InventorySnapshot:
    snapshot = InventorySnapshot(
        name=f"Snapshot {created_at.isoformat()}",
        created_at=created_at,
        file_path=f"snapshots/{created_at.isoformat()}.png",
    )
    db.add(snapshot)
    db.flush()

    for product, quantity in items:
        db.add(
            InventorySnapshotItem(
                product_id=product.id,
                snapshot_id=snapshot.id,
                quantity=quantity,
            )
        )

    db.commit()
    db.refresh(snapshot)
    return snapshot


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
            (increased, 4),
            (increased, 4),
            (decreased, 1),
            (unchanged, 2),
            (new, 6),
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
    assert rows["SKU-A"].delta == 3
    assert rows["SKU-A"].status == "added"
    assert rows["SKU-B"].delta == -3
    assert rows["SKU-B"].status == "consumed"
    assert rows["SKU-C"].delta == 0
    assert rows["SKU-C"].status == "unchanged"
    assert rows["SKU-D"].current_quantity == 0
    assert rows["SKU-D"].status == "consumed"
    assert rows["SKU-E"].previous_quantity == 0
    assert rows["SKU-E"].status == "added"


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
    current = create_snapshot(db_session, datetime(2026, 5, 15, 8, 0), [(product, 5)])

    response = client.get("/reports/daily-delta?date=2026-05-15", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["date"] == "2026-05-15"
    assert data["current_snapshot_id"] == current.id
    assert data["baseline_snapshot_id"] == baseline.id
    assert data["items"][0]["product"]["sku"] == "SKU-001"
    assert data["items"][0]["delta"] == 3
    assert data["items"][0]["status"] == "added"


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
