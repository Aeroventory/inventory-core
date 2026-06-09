import mimetypes
from datetime import date, datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from models.inventory_box import InventoryBox
from models.inventory_snapshot import InventorySnapshot
from models.inventory_snapshot_item import InventorySnapshotItem
from models.media import MediaAsset, ProductMediaAsset, SnapshotMediaAsset
from models.product import Product
from schemas.inventory_snapshot import (
    AiSnapshotAnalysisRow,
    AiSnapshotBoxPreview,
    AiSnapshotCreate,
    DroneSnapshotCreate,
    SnapshotCreate,
    SnapshotItemCreate,
    SnapshotItemUpdate,
)
from services.file_service import UPLOADS_DIR, save_file


def _snapshot_created_at(snapshot_date: date | None) -> datetime:
    if snapshot_date:
        return datetime.combine(snapshot_date, datetime.now().time())
    return datetime.now()


def _generate_box_code(product: Product, box_date: date) -> str:
    sku = product.sku or f"PRODUCT-{product.id}"
    return f"{sku}-{box_date:%Y%m%d}-{uuid4().hex[:8].upper()}"


def _normalize_box_code(box_code: str | None) -> str | None:
    if box_code is None:
        return None
    normalized = box_code.strip()
    return normalized or None


def validate_drone_image_paths(image_paths: list[str]) -> list[str]:
    if not image_paths:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one drone image is required",
        )

    drone_dir = (UPLOADS_DIR / "drone").resolve()
    normalized_paths: list[str] = []
    seen_paths: set[str] = set()

    for image_path in image_paths:
        normalized = str(image_path).strip().lstrip("/")
        if normalized.startswith("uploads/"):
            normalized = normalized.removeprefix("uploads/")
        if not normalized.startswith("drone/"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Drone snapshot images must be under uploads/drone",
            )

        candidate = (UPLOADS_DIR / normalized).resolve()
        if not candidate.is_relative_to(drone_dir) or not candidate.is_file():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Drone image not found: {normalized}",
            )
        if normalized in seen_paths:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Duplicate drone image path: {normalized}",
            )

        seen_paths.add(normalized)
        normalized_paths.append(normalized)

    return normalized_paths


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


def _soft_remove_boxes(db: Session, box_ids: list[int]) -> None:
    if not box_ids:
        return

    (
        db.query(InventoryBox)
        .filter(InventoryBox.id.in_(list(set(box_ids))), InventoryBox.is_active == True)
        .update(
            {
                InventoryBox.is_active: False,
                InventoryBox.removed_at: datetime.now(),
            },
            synchronize_session="fetch",
        )
    )


def _active_boxes_query(db: Session):
    return (
        db.query(InventoryBox)
        .options(joinedload(InventoryBox.product))
        .filter(InventoryBox.is_active == True)
        .order_by(InventoryBox.box_date, InventoryBox.id)
    )


def _box_preview(box: InventoryBox) -> AiSnapshotBoxPreview:
    return AiSnapshotBoxPreview(
        id=box.id,
        box_code=box.box_code,
        product_id=box.product_id,
        product_name=box.product.name if box.product else "",
        quantity=box.quantity,
        box_date=box.box_date,
    )


def _reviewed_box_codes(rows: list[AiSnapshotAnalysisRow]) -> set[str]:
    return {
        box_code
        for box_code in (_normalize_box_code(row.box_code) for row in rows)
        if box_code is not None
    }


def get_ai_snapshot_active_box_previews(db: Session) -> list[AiSnapshotBoxPreview]:
    return [_box_preview(box) for box in _active_boxes_query(db).all()]


def get_ai_snapshot_removed_box_previews(
    db: Session, rows: list[AiSnapshotAnalysisRow]
) -> list[AiSnapshotBoxPreview]:
    reviewed_codes = _reviewed_box_codes(rows)
    return [
        _box_preview(box)
        for box in _active_boxes_query(db).all()
        if box.box_code not in reviewed_codes
    ]


def _validate_ai_rows(db: Session, rows: list[AiSnapshotAnalysisRow]) -> dict[int, Product]:
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one reviewed AI row is required",
        )

    seen_codes: set[str] = set()
    product_ids = {row.product_id for row in rows if row.product_id is not None}
    products = (
        db.query(Product)
        .filter(Product.id.in_(product_ids))
        .all()
        if product_ids
        else []
    )
    product_by_id = {product.id: product for product in products}

    for row in rows:
        if row.product_id is None or row.product_id not in product_by_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Every reviewed AI row must reference an existing product",
            )
        box_code = _normalize_box_code(row.box_code)
        if box_code is None:
            continue
        if box_code in seen_codes:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Duplicate box code in reviewed AI rows: {box_code}",
            )
        seen_codes.add(box_code)

    return product_by_id


def _expected_removed_box_ids(db: Session, rows: list[AiSnapshotAnalysisRow]) -> set[int]:
    reviewed_codes = _reviewed_box_codes(rows)
    return {
        box.id
        for box in _active_boxes_query(db).all()
        if box.box_code not in reviewed_codes
    }


def _validate_removed_confirmation(
    db: Session,
    rows: list[AiSnapshotAnalysisRow],
    confirmed_removed_box_ids: list[int],
) -> set[int]:
    expected_removed_ids = _expected_removed_box_ids(db, rows)
    confirmed_removed_ids = set(confirmed_removed_box_ids)

    if expected_removed_ids != confirmed_removed_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Active inventory changed during review",
                "expected_removed_box_ids": sorted(expected_removed_ids),
            },
        )

    return expected_removed_ids


def _sync_reviewed_rows(
    db: Session,
    rows: list[AiSnapshotAnalysisRow],
    snapshot_date: date,
    product_by_id: dict[int, Product],
) -> dict[str, float | None]:
    confidence_by_box_code: dict[str, float | None] = {}

    for row in rows:
        product = product_by_id[row.product_id]
        box_date = row.box_date or snapshot_date
        box_code = _normalize_box_code(row.box_code) or _generate_box_code(
            product, box_date
        )
        box = db.query(InventoryBox).filter(InventoryBox.box_code == box_code).first()
        if box is None:
            box = InventoryBox(
                box_code=box_code,
                product_id=product.id,
                quantity=row.quantity,
                box_date=box_date,
                is_active=True,
            )
            db.add(box)
        else:
            box.product_id = product.id
            box.quantity = row.quantity
            box.box_date = box_date
            box.is_active = True
            box.removed_at = None
        confidence_by_box_code[box_code] = row.confidence_score

    return confidence_by_box_code


def _soft_remove_expected_boxes(db: Session, expected_removed_ids: set[int]) -> None:
    if expected_removed_ids:
        (
            db.query(InventoryBox)
            .filter(InventoryBox.id.in_(expected_removed_ids))
            .update(
                {
                    InventoryBox.is_active: False,
                    InventoryBox.removed_at: datetime.now(),
                },
                synchronize_session="fetch",
            )
        )


def _ensure_snapshot_media_asset(db: Session, image_path: str) -> MediaAsset:
    asset = db.query(MediaAsset).filter(MediaAsset.file_path == image_path).first()
    if asset is not None:
        return asset

    absolute_path = UPLOADS_DIR / image_path
    asset = MediaAsset(
        file_path=image_path,
        original_filename=Path(image_path).name,
        content_type=mimetypes.guess_type(image_path)[0],
        size_bytes=absolute_path.stat().st_size if absolute_path.exists() else 0,
    )
    db.add(asset)
    db.flush()
    return asset


def _attach_snapshot_images(
    db: Session, snapshot: InventorySnapshot, image_paths: list[str]
) -> None:
    for index, image_path in enumerate(image_paths):
        asset = _ensure_snapshot_media_asset(db, image_path)
        db.add(
            SnapshotMediaAsset(
                snapshot_id=snapshot.id,
                media_asset_id=asset.id,
                sort_order=index,
                is_primary=index == 0,
            )
        )


def create_ai_snapshot(db: Session, snapshot_in: AiSnapshotCreate) -> InventorySnapshot:
    product_by_id = _validate_ai_rows(db, snapshot_in.rows)
    expected_removed_ids = _validate_removed_confirmation(
        db, snapshot_in.rows, snapshot_in.confirmed_removed_box_ids
    )

    file_path = save_file(snapshot_in.temp_filename, folder="snapshots")
    confidence_by_box_code = _sync_reviewed_rows(
        db, snapshot_in.rows, snapshot_in.snapshot_date, product_by_id
    )
    _soft_remove_expected_boxes(db, expected_removed_ids)

    snapshot = InventorySnapshot(
        name=snapshot_in.name,
        file_path=file_path,
        created_at=_snapshot_created_at(snapshot_in.snapshot_date),
        snapshot_type="AI",
    )
    db.add(snapshot)
    db.flush()

    _capture_active_boxes(db, snapshot, confidence_by_box_code)

    db.commit()
    db.refresh(snapshot)
    return get_snapshot_by_id(db, snapshot.id)


def create_drone_snapshot(
    db: Session, snapshot_in: DroneSnapshotCreate
) -> InventorySnapshot:
    image_paths = validate_drone_image_paths(snapshot_in.image_paths)
    product_by_id = _validate_ai_rows(db, snapshot_in.rows)
    expected_removed_ids = _validate_removed_confirmation(
        db, snapshot_in.rows, snapshot_in.confirmed_removed_box_ids
    )
    confidence_by_box_code = _sync_reviewed_rows(
        db, snapshot_in.rows, snapshot_in.snapshot_date, product_by_id
    )
    _soft_remove_expected_boxes(db, expected_removed_ids)

    snapshot = InventorySnapshot(
        name=snapshot_in.name,
        file_path=image_paths[0],
        created_at=_snapshot_created_at(snapshot_in.snapshot_date),
        snapshot_type="drone",
    )
    db.add(snapshot)
    db.flush()
    _attach_snapshot_images(db, snapshot, image_paths)

    _capture_active_boxes(db, snapshot, confidence_by_box_code)

    db.commit()
    db.refresh(snapshot)
    return get_snapshot_by_id(db, snapshot.id)


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
    _soft_remove_boxes(db, snapshot_in.removed_box_ids)

    snapshot = InventorySnapshot(
        name=snapshot_in.name,
        file_path=snapshot_in.file_path,
        created_at=_snapshot_created_at(snapshot_in.snapshot_date),
        snapshot_type=snapshot_in.snapshot_type,
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
        snapshot_type="AI",
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
