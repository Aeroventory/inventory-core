from datetime import date, datetime
from uuid import uuid4

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from models.inventory_box import InventoryBox
from models.inventory_snapshot import InventorySnapshot
from models.inventory_snapshot_item import InventorySnapshotItem
from models.media import ProductMediaAsset, SnapshotMediaAsset
from models.product import Product
from schemas.inventory_snapshot import SnapshotCreate, SnapshotItemCreate, SnapshotItemUpdate


def _snapshot_created_at(snapshot_date: date | None) -> datetime:
    if snapshot_date:
        return datetime.combine(snapshot_date, datetime.now().time())
    return datetime.now()


def _generate_box_code(product: Product, box_date: date) -> str:
    sku = product.sku or f"PRODUCT-{product.id}"
    return f"{sku}-{box_date:%Y%m%d}-{uuid4().hex[:8].upper()}"


def _snapshot_query(db: Session):
    return db.query(InventorySnapshot).options(
        joinedload(InventorySnapshot.items)
        .joinedload(InventorySnapshotItem.product)
        .joinedload(Product.media_links)
        .joinedload(ProductMediaAsset.media_asset),
        joinedload(InventorySnapshot.items).joinedload(InventorySnapshotItem.box),
        joinedload(InventorySnapshot.media_links).joinedload(SnapshotMediaAsset.media_asset),
    )


def _capture_active_boxes(
    db: Session,
    snapshot: InventorySnapshot,
    confidence_by_box_code: dict[str, float | None] | None = None,
) -> None:
    confidence_by_box_code = confidence_by_box_code or {}
    active_boxes = (
        db.query(InventoryBox)
        .options(joinedload(InventoryBox.product))
        .filter(InventoryBox.is_active == True)
        .order_by(InventoryBox.box_date, InventoryBox.id)
        .all()
    )

    for box in active_boxes:
        db.add(
            InventorySnapshotItem(
                box_id=box.id,
                box_code=box.box_code,
                product_id=box.product_id,
                snapshot_id=snapshot.id,
                quantity=box.quantity,
                box_date=box.box_date,
                confidence_score=confidence_by_box_code.get(box.box_code),
            )
        )


def _parse_detection_date(value, fallback: date) -> date:
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        return date.fromisoformat(value)
    return fallback


def _product_from_detection(db: Session, detection: dict) -> Product | None:
    product_id = detection.get("product_id")
    if product_id is not None:
        return db.query(Product).filter(Product.id == product_id).first()

    sku = detection.get("sku")
    if not sku:
        return None

    product = db.query(Product).filter(Product.sku == sku).first()
    if product:
        return product

    product = Product(name=sku, sku=sku, value=0)
    db.add(product)
    db.flush()
    return product


def _upsert_detected_box(
    db: Session, detection: dict, fallback_date: date
) -> tuple[InventoryBox | None, float | None]:
    product = _product_from_detection(db, detection)
    if product is None:
        return None, None

    quantity = detection.get("quantity", detection.get("count", 1))
    if quantity is None or int(quantity) <= 0:
        return None, None

    box_date = _parse_detection_date(
        detection.get("box_date") or detection.get("date"), fallback_date
    )
    box_code = (
        detection.get("box_code")
        or detection.get("box_id")
        or detection.get("id")
        or _generate_box_code(product, box_date)
    )
    confidence_score = detection.get("confidence")

    box = db.query(InventoryBox).filter(InventoryBox.box_code == str(box_code)).first()
    if box is None:
        box = InventoryBox(
            box_code=str(box_code),
            product_id=product.id,
            quantity=int(quantity),
            box_date=box_date,
            is_active=True,
        )
        db.add(box)
    else:
        box.product_id = product.id
        box.quantity = int(quantity)
        box.box_date = box_date
        box.is_active = True
        box.removed_at = None

    db.flush()
    return box, confidence_score


def get_all_snapshots(db: Session) -> list[InventorySnapshot]:
    return (
        _snapshot_query(db)
        .order_by(InventorySnapshot.created_at.desc(), InventorySnapshot.id.desc())
        .all()
    )


def get_snapshot_by_id(db: Session, snapshot_id: int) -> InventorySnapshot | None:
    return (
        _snapshot_query(db)
        .filter(InventorySnapshot.id == snapshot_id)
        .first()
    )


def create_snapshot(db: Session, snapshot_in: SnapshotCreate) -> InventorySnapshot:
    snapshot = InventorySnapshot(
        name=snapshot_in.name,
        file_path=snapshot_in.file_path,
        created_at=_snapshot_created_at(snapshot_in.snapshot_date),
        is_manual=snapshot_in.is_manual,
    )
    db.add(snapshot)
    db.flush()
    _capture_active_boxes(db, snapshot)
    db.commit()
    db.refresh(snapshot)
    return get_snapshot_by_id(db, snapshot.id)


def get_latest_snapshot(db: Session) -> InventorySnapshot | None:
    return (
        _snapshot_query(db)
        .order_by(InventorySnapshot.created_at.desc(), InventorySnapshot.id.desc())
        .first()
    )


def ingest_snapshot(
    db: Session,
    file_path: str,
    snapshot_date: date | None,
    vision_results: list[dict],
) -> InventorySnapshot:
    """Update inventory boxes from vision detections and capture the active pool."""
    capture_date = snapshot_date or datetime.now().date()
    confidence_by_box_code: dict[str, float | None] = {}

    for detection in vision_results:
        box, confidence_score = _upsert_detected_box(db, detection, capture_date)
        if box is not None:
            confidence_by_box_code[box.box_code] = confidence_score

    name = f"Snapshot {capture_date}"
    snapshot = InventorySnapshot(
        name=name,
        file_path=file_path,
        created_at=_snapshot_created_at(capture_date),
        is_manual=False,
    )
    db.add(snapshot)
    db.flush()

    _capture_active_boxes(db, snapshot, confidence_by_box_code)

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

    box_date = snapshot.created_at.date()
    box = InventoryBox(
        box_code=_generate_box_code(product, box_date),
        product_id=product.id,
        quantity=item_in.quantity,
        box_date=box_date,
        is_active=True,
    )
    db.add(box)
    db.flush()

    item = InventorySnapshotItem(
        box_id=box.id,
        box_code=box.box_code,
        product_id=item_in.product_id,
        snapshot_id=item_in.snapshot_id,
        quantity=item_in.quantity,
        box_date=box.box_date,
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
