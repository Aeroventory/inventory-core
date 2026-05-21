from datetime import date, datetime
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from models.inventory_box import InventoryBox
from models.product import Product
from schemas.inventory_box import InventoryBoxCreate, InventoryBoxUpdate


def _get_product_or_404(db: Session, product_id: int) -> Product:
    product = db.query(Product).filter(Product.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def _normalize_box_code(box_code: str | None) -> str | None:
    if box_code is None:
        return None
    normalized = box_code.strip()
    if not normalized:
        return None
    return normalized


def _generate_box_code(product: Product, box_date: date) -> str:
    sku = product.sku or f"PRODUCT-{product.id}"
    suffix = uuid4().hex[:8].upper()
    return f"{sku}-{box_date:%Y%m%d}-{suffix}"


def _ensure_unique_box_code(
    db: Session, box_code: str, exclude_box_id: int | None = None
) -> None:
    query = db.query(InventoryBox).filter(InventoryBox.box_code == box_code)
    if exclude_box_id is not None:
        query = query.filter(InventoryBox.id != exclude_box_id)
    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Box code already exists",
        )


def _commit_or_conflict(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Box code already exists",
        )


def get_inventory_boxes(
    db: Session,
    active: bool | None = None,
    product_id: int | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[InventoryBox]:
    if from_date and to_date and from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from must be before or equal to to",
        )

    query = db.query(InventoryBox).options(joinedload(InventoryBox.product))
    if active is not None:
        query = query.filter(InventoryBox.is_active == active)
    if product_id is not None:
        query = query.filter(InventoryBox.product_id == product_id)
    if from_date is not None:
        query = query.filter(InventoryBox.box_date >= from_date)
    if to_date is not None:
        query = query.filter(InventoryBox.box_date <= to_date)

    return query.order_by(InventoryBox.box_date, InventoryBox.id).all()


def create_inventory_box(db: Session, box_in: InventoryBoxCreate) -> InventoryBox:
    product = _get_product_or_404(db, box_in.product_id)
    box_code = _normalize_box_code(box_in.box_code) or _generate_box_code(
        product, box_in.box_date
    )
    _ensure_unique_box_code(db, box_code)

    box = InventoryBox(
        box_code=box_code,
        product_id=box_in.product_id,
        quantity=box_in.quantity,
        box_date=box_in.box_date,
        is_active=True,
    )
    db.add(box)
    _commit_or_conflict(db)
    db.refresh(box)
    return (
        db.query(InventoryBox)
        .options(joinedload(InventoryBox.product))
        .filter(InventoryBox.id == box.id)
        .first()
    )


def update_inventory_box(
    db: Session, box_id: int, box_in: InventoryBoxUpdate
) -> InventoryBox | None:
    box = db.query(InventoryBox).filter(InventoryBox.id == box_id).first()
    if box is None:
        return None

    update_data = box_in.model_dump(exclude_unset=True)
    if not update_data:
        return (
            db.query(InventoryBox)
            .options(joinedload(InventoryBox.product))
            .filter(InventoryBox.id == box.id)
            .first()
        )

    if "product_id" in update_data and update_data["product_id"] is not None:
        _get_product_or_404(db, update_data["product_id"])

    if "box_code" in update_data:
        box_code = _normalize_box_code(update_data["box_code"])
        if box_code is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Box code cannot be empty",
            )
        _ensure_unique_box_code(db, box_code, exclude_box_id=box.id)
        update_data["box_code"] = box_code

    if update_data.get("is_active") is False and box.is_active:
        update_data["removed_at"] = datetime.now()
    elif update_data.get("is_active") is True:
        update_data["removed_at"] = None

    for key, value in update_data.items():
        setattr(box, key, value)

    _commit_or_conflict(db)
    db.refresh(box)
    return (
        db.query(InventoryBox)
        .options(joinedload(InventoryBox.product))
        .filter(InventoryBox.id == box.id)
        .first()
    )


def remove_inventory_box(db: Session, box_id: int) -> bool:
    box = db.query(InventoryBox).filter(InventoryBox.id == box_id).first()
    if box is None:
        return False
    box.is_active = False
    box.removed_at = datetime.now()
    db.commit()
    return True
