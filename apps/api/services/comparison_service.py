from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session, joinedload

from models.inventory_snapshot import InventorySnapshot
from models.inventory_snapshot_item import InventorySnapshotItem
from models.product import Product
from schemas.inventory_snapshot import ProductInSnapshot
from schemas.report import (
    DailyDeltaResponse,
    DeltaItem,
    DeltaStatus,
    StockSummaryItem,
    StockSummaryResponse,
)


class SnapshotNotFoundError(ValueError):
    pass


AggregatedItems = dict[int, tuple[Product, int]]


def _load_snapshot(db: Session, snapshot_id: int) -> InventorySnapshot | None:
    return (
        db.query(InventorySnapshot)
        .options(joinedload(InventorySnapshot.items).joinedload(InventorySnapshotItem.product))
        .filter(InventorySnapshot.id == snapshot_id)
        .first()
    )


def _latest_snapshot_for_date(db: Session, snapshot_date: date) -> InventorySnapshot | None:
    start_at = datetime.combine(snapshot_date, time.min)
    end_at = start_at + timedelta(days=1)

    return (
        db.query(InventorySnapshot)
        .options(joinedload(InventorySnapshot.items).joinedload(InventorySnapshotItem.product))
        .filter(
            InventorySnapshot.created_at >= start_at,
            InventorySnapshot.created_at < end_at,
        )
        .order_by(InventorySnapshot.created_at.desc(), InventorySnapshot.id.desc())
        .first()
    )


def _latest_snapshot(db: Session) -> InventorySnapshot | None:
    return (
        db.query(InventorySnapshot)
        .options(joinedload(InventorySnapshot.items).joinedload(InventorySnapshotItem.product))
        .order_by(InventorySnapshot.created_at.desc(), InventorySnapshot.id.desc())
        .first()
    )


def _aggregate_snapshot_items(snapshot: InventorySnapshot) -> AggregatedItems:
    aggregated: AggregatedItems = {}

    for item in snapshot.items:
        product = item.product
        if product is None:
            continue

        _existing_product, quantity = aggregated.get(item.product_id, (product, 0))
        aggregated[item.product_id] = (product, quantity + item.quantity)

    return aggregated


def _sort_key(product: Product) -> tuple[str, str, int]:
    return (product.sku, product.name, product.id)


def _delta_status(delta: int) -> DeltaStatus:
    if delta > 0:
        return "added"
    if delta < 0:
        return "consumed"
    return "unchanged"


def _build_delta_items(current_items: AggregatedItems, baseline_items: AggregatedItems) -> list[DeltaItem]:
    all_product_ids = set(current_items) | set(baseline_items)
    products_by_id = {
        product_id: item[0]
        for product_id, item in {**baseline_items, **current_items}.items()
    }

    delta_items = []
    for product_id in sorted(all_product_ids, key=lambda id_: _sort_key(products_by_id[id_])):
        product = products_by_id[product_id]
        previous_quantity = baseline_items.get(product_id, (product, 0))[1]
        current_quantity = current_items.get(product_id, (product, 0))[1]
        delta = current_quantity - previous_quantity

        delta_items.append(
            DeltaItem(
                product=ProductInSnapshot.model_validate(product),
                previous_quantity=previous_quantity,
                current_quantity=current_quantity,
                delta=delta,
                status=_delta_status(delta),
            )
        )

    return delta_items


def compare_snapshots(
    db: Session, snapshot_id_a: int, snapshot_id_b: int | None
) -> list[DeltaItem]:
    current_snapshot = _load_snapshot(db, snapshot_id_a)
    if current_snapshot is None:
        raise SnapshotNotFoundError(f"Snapshot {snapshot_id_a} not found")

    baseline_items: AggregatedItems = {}
    if snapshot_id_b is not None:
        baseline_snapshot = _load_snapshot(db, snapshot_id_b)
        if baseline_snapshot is None:
            raise SnapshotNotFoundError(f"Snapshot {snapshot_id_b} not found")
        baseline_items = _aggregate_snapshot_items(baseline_snapshot)

    current_items = _aggregate_snapshot_items(current_snapshot)
    return _build_delta_items(current_items, baseline_items)


def get_daily_delta(db: Session, requested_date: date) -> DailyDeltaResponse | None:
    current_snapshot = _latest_snapshot_for_date(db, requested_date)
    if current_snapshot is None:
        return None

    baseline_date = requested_date - timedelta(days=1)
    baseline_snapshot = _latest_snapshot_for_date(db, baseline_date)
    baseline_snapshot_id = baseline_snapshot.id if baseline_snapshot else None

    return DailyDeltaResponse(
        date=requested_date,
        current_snapshot_id=current_snapshot.id,
        baseline_date=baseline_date,
        baseline_snapshot_id=baseline_snapshot_id,
        items=compare_snapshots(db, current_snapshot.id, baseline_snapshot_id),
    )


def get_stock_summary(db: Session) -> StockSummaryResponse | None:
    snapshot = _latest_snapshot(db)
    if snapshot is None:
        return None

    aggregated_items = _aggregate_snapshot_items(snapshot)
    items = [
        StockSummaryItem(
            product=ProductInSnapshot.model_validate(product),
            quantity=quantity,
        )
        for product, quantity in sorted(
            aggregated_items.values(), key=lambda item: _sort_key(item[0])
        )
    ]

    return StockSummaryResponse(
        snapshot_id=snapshot.id,
        snapshot_date=snapshot.created_at.date(),
        created_at=snapshot.created_at,
        items=items,
    )
