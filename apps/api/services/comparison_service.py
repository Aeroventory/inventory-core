from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session, joinedload

from models.inventory_snapshot import InventorySnapshot
from models.inventory_snapshot_item import InventorySnapshotItem
from models.product import Product
from models.production_plan import ProductionPlan
from schemas.inventory_snapshot import ProductInSnapshot
from schemas.report import (
    DailyDeltaResponse,
    DeltaBoxItem,
    DeltaItem,
    DeltaStatus,
    PlanVsActualItem,
    PlanVsActualResponse,
    StockSummaryItem,
    StockSummaryResponse,
)


class SnapshotNotFoundError(ValueError):
    pass


AggregatedItems = dict[int, tuple[Product, int]]
ConfidenceByProduct = dict[int, float | None]
SnapshotItemsByBox = dict[int, InventorySnapshotItem]


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


def _average_current_confidences(snapshot: InventorySnapshot) -> ConfidenceByProduct:
    confidence_values: dict[int, list[float]] = {}

    for item in snapshot.items:
        if item.product is None or item.confidence_score is None:
            continue
        confidence_values.setdefault(item.product_id, []).append(item.confidence_score)

    return {
        product_id: sum(values) / len(values)
        for product_id, values in confidence_values.items()
    }


def _sort_key(product: Product) -> tuple[str, str, int]:
    return (product.sku, product.name, product.id)


def _delta_status(delta: int) -> DeltaStatus:
    if delta > 0:
        return "added"
    if delta < 0:
        return "consumed"
    return "unchanged"


def _snapshot_items_by_box(snapshot: InventorySnapshot | None) -> SnapshotItemsByBox:
    if snapshot is None:
        return {}
    return {
        item.box_id: item
        for item in snapshot.items
        if item.box_id is not None and item.product is not None
    }


def _box_delta_item(item: InventorySnapshotItem) -> DeltaBoxItem:
    return DeltaBoxItem(
        box_id=item.box_id,
        box_code=item.box_code,
        product_id=item.product_id,
        quantity=item.quantity,
        box_date=item.box_date,
        confidence_score=item.confidence_score,
    )


def _product_totals(items: list[InventorySnapshotItem]) -> dict[int, tuple[Product, int]]:
    totals: dict[int, tuple[Product, int]] = {}
    for item in items:
        if item.product is None:
            continue
        product, quantity = totals.get(item.product_id, (item.product, 0))
        totals[item.product_id] = (product, quantity + item.quantity)
    return totals


def _items_by_product(
    items: list[InventorySnapshotItem],
) -> dict[int, list[InventorySnapshotItem]]:
    grouped: dict[int, list[InventorySnapshotItem]] = {}
    for item in items:
        if item.product is None:
            continue
        grouped.setdefault(item.product_id, []).append(item)
    return grouped


def _build_delta_items(
    current_snapshot: InventorySnapshot,
    baseline_snapshot: InventorySnapshot | None,
) -> list[DeltaItem]:
    current_by_box = _snapshot_items_by_box(current_snapshot)
    baseline_by_box = _snapshot_items_by_box(baseline_snapshot)

    added_items = [
        item for box_id, item in current_by_box.items() if box_id not in baseline_by_box
    ]
    removed_items = [
        item for box_id, item in baseline_by_box.items() if box_id not in current_by_box
    ]

    current_totals = _product_totals(list(current_by_box.values()))
    baseline_totals = _product_totals(list(baseline_by_box.values()))
    added_by_product = _items_by_product(added_items)
    removed_by_product = _items_by_product(removed_items)
    current_confidences = _average_current_confidences(current_snapshot)

    all_product_ids = set(current_totals) | set(baseline_totals)
    products_by_id = {
        product_id: item[0]
        for product_id, item in {**baseline_totals, **current_totals}.items()
    }

    delta_items = []
    for product_id in sorted(all_product_ids, key=lambda id_: _sort_key(products_by_id[id_])):
        product = products_by_id[product_id]
        previous_quantity = baseline_totals.get(product_id, (product, 0))[1]
        current_quantity = current_totals.get(product_id, (product, 0))[1]
        product_added_items = added_by_product.get(product_id, [])
        product_removed_items = removed_by_product.get(product_id, [])
        added_quantity = sum(item.quantity for item in product_added_items)
        removed_quantity = sum(item.quantity for item in product_removed_items)
        delta = added_quantity - removed_quantity

        delta_items.append(
            DeltaItem(
                product=ProductInSnapshot.model_validate(product),
                previous_quantity=previous_quantity,
                current_quantity=current_quantity,
                added_quantity=added_quantity,
                removed_quantity=removed_quantity,
                delta=delta,
                status=_delta_status(delta),
                confidence_score=current_confidences.get(product_id),
                added_boxes=[_box_delta_item(item) for item in product_added_items],
                removed_boxes=[_box_delta_item(item) for item in product_removed_items],
            )
        )

    return delta_items


def compare_snapshots(
    db: Session, snapshot_id_a: int, snapshot_id_b: int | None
) -> list[DeltaItem]:
    current_snapshot = _load_snapshot(db, snapshot_id_a)
    if current_snapshot is None:
        raise SnapshotNotFoundError(f"Snapshot {snapshot_id_a} not found")

    baseline_snapshot = None
    if snapshot_id_b is not None:
        baseline_snapshot = _load_snapshot(db, snapshot_id_b)
        if baseline_snapshot is None:
            raise SnapshotNotFoundError(f"Snapshot {snapshot_id_b} not found")

    return _build_delta_items(current_snapshot, baseline_snapshot)


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


def get_plan_vs_actual(
    db: Session, from_date: date, to_date: date
) -> PlanVsActualResponse:
    plans = (
        db.query(ProductionPlan)
        .options(joinedload(ProductionPlan.product))
        .filter(
            ProductionPlan.date >= from_date,
            ProductionPlan.date <= to_date,
        )
        .all()
    )

    snapshots_by_date: dict[date, InventorySnapshot | None] = {}
    actuals_by_date: dict[date, AggregatedItems] = {}
    for plan_date in {plan.date for plan in plans}:
        snapshot = _latest_snapshot_for_date(db, plan_date)
        snapshots_by_date[plan_date] = snapshot
        actuals_by_date[plan_date] = (
            _aggregate_snapshot_items(snapshot) if snapshot is not None else {}
        )

    items = []
    sorted_plans = sorted(
        plans,
        key=lambda plan: (
            plan.date,
            _sort_key(plan.product) if plan.product is not None else ("", "", plan.id),
        ),
    )
    for plan in sorted_plans:
        if plan.product is None:
            continue
        snapshot = snapshots_by_date.get(plan.date)
        actual_quantity = actuals_by_date.get(plan.date, {}).get(
            plan.product_id, (plan.product, 0)
        )[1]

        items.append(
            PlanVsActualItem(
                date=plan.date,
                product=ProductInSnapshot.model_validate(plan.product),
                planned_quantity=plan.target_quantity,
                actual_quantity=actual_quantity,
                variance=actual_quantity - plan.target_quantity,
                snapshot_id=snapshot.id if snapshot is not None else None,
            )
        )

    return PlanVsActualResponse(from_date=from_date, to_date=to_date, items=items)
