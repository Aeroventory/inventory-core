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
        db.commit()
        db.refresh(existing)
        return existing

    item = InventorySnapshotItem(
        product_id=item_in.product_id,
        snapshot_id=item_in.snapshot_id,
        quantity=item_in.quantity,
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
