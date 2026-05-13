from datetime import date, datetime

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from models.inventory_snapshot import InventorySnapshot
from models.inventory_snapshot_item import InventorySnapshotItem
from models.product import Product
from schemas.inventory_snapshot import SnapshotCreate, SnapshotItemCreate, SnapshotItemUpdate


def get_all_snapshots(db: Session) -> list[InventorySnapshot]:
    return (
        db.query(InventorySnapshot)
        .options(joinedload(InventorySnapshot.items).joinedload(InventorySnapshotItem.product))
        .all()
    )


def get_snapshot_by_id(db: Session, snapshot_id: int) -> InventorySnapshot | None:
    return (
        db.query(InventorySnapshot)
        .options(joinedload(InventorySnapshot.items).joinedload(InventorySnapshotItem.product))
        .filter(InventorySnapshot.id == snapshot_id)
        .first()
    )


def create_snapshot(db: Session, snapshot_in: SnapshotCreate) -> InventorySnapshot:
    snapshot = InventorySnapshot(
        name=snapshot_in.name,
        file_path=snapshot_in.file_path,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def get_latest_snapshot(db: Session) -> InventorySnapshot | None:
    return (
        db.query(InventorySnapshot)
        .options(joinedload(InventorySnapshot.items).joinedload(InventorySnapshotItem.product))
        .order_by(InventorySnapshot.created_at.desc())
        .first()
    )


def ingest_snapshot(
    db: Session,
    file_path: str,
    snapshot_date: date | None,
    vision_results: list[dict],
) -> InventorySnapshot:
    """Create a snapshot from vision service inference results."""
    name = f"Snapshot {snapshot_date or datetime.now().strftime('%Y-%m-%d')}"
    snapshot = InventorySnapshot(
        name=name,
        file_path=file_path,
        created_at=datetime.combine(snapshot_date, datetime.min.time()) if snapshot_date else datetime.now(),
    )
    db.add(snapshot)
    db.flush()

    for detection in vision_results:
        sku = detection.get("sku")
        count = detection.get("count", 0)
        confidence_score = detection.get("confidence")

        product = db.query(Product).filter(Product.sku == sku).first()
        if not product:
            product = Product(name=sku, sku=sku, value=0)
            db.add(product)
            db.flush()

        snapshot_item = InventorySnapshotItem(
            product_id=product.id,
            snapshot_id=snapshot.id,
            quantity=count,
            confidence_score=confidence_score,
        )
        db.add(snapshot_item)

    db.commit()
    db.refresh(snapshot)

    return get_snapshot_by_id(db, snapshot.id)


def delete_snapshot(db: Session, snapshot_id: int) -> bool:
    snapshot = db.query(InventorySnapshot).filter(InventorySnapshot.id == snapshot_id).first()
    if not snapshot:
        return False
    db.delete(snapshot)
    db.commit()
    return True


def add_snapshot_item(db: Session, item_in: SnapshotItemCreate) -> InventorySnapshotItem:
    snapshot = db.query(InventorySnapshot).filter(InventorySnapshot.id == item_in.snapshot_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    product = db.query(Product).filter(Product.id == item_in.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = (
        db.query(InventorySnapshotItem)
        .filter(
            InventorySnapshotItem.snapshot_id == item_in.snapshot_id,
            InventorySnapshotItem.product_id == item_in.product_id,
        )
        .first()
    )

    if existing:
        existing.quantity += item_in.quantity
        if item_in.confidence_score is not None:
            existing.confidence_score = item_in.confidence_score
        db.commit()
        db.refresh(existing)
        return existing

    item = InventorySnapshotItem(
        product_id=item_in.product_id,
        snapshot_id=item_in.snapshot_id,
        quantity=item_in.quantity,
        confidence_score=item_in.confidence_score,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_snapshot_item(db: Session, item_id: int, item_in: SnapshotItemUpdate) -> InventorySnapshotItem | None:
    item = db.query(InventorySnapshotItem).filter(InventorySnapshotItem.id == item_id).first()
    if not item:
        return None
    item.quantity = item_in.quantity
    db.commit()
    db.refresh(item)
    return item


def delete_snapshot_item(db: Session, item_id: int) -> bool:
    item = db.query(InventorySnapshotItem).filter(InventorySnapshotItem.id == item_id).first()
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True
