from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.security import get_current_user, require_admin
from db.session import get_db
from schemas.inventory_box import (
    InventoryBoxCreate,
    InventoryBoxResponse,
    InventoryBoxUpdate,
)
from services.inventory_box_service import (
    create_inventory_box,
    get_inventory_boxes,
    remove_inventory_box,
    update_inventory_box,
)

router = APIRouter(prefix="/inventory-boxes", tags=["Inventory Boxes"])


@router.get("", response_model=list[InventoryBoxResponse])
def list_inventory_boxes(
    active: bool | None = None,
    product_id: int | None = None,
    from_date: Date | None = Query(None, alias="from"),
    to_date: Date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    return get_inventory_boxes(db, active, product_id, from_date, to_date)


@router.post("", response_model=InventoryBoxResponse, status_code=status.HTTP_201_CREATED)
def add_inventory_box(
    box_in: InventoryBoxCreate,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    return create_inventory_box(db, box_in)


@router.patch("/{box_id}", response_model=InventoryBoxResponse)
def edit_inventory_box(
    box_id: int,
    box_in: InventoryBoxUpdate,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    box = update_inventory_box(db, box_id, box_in)
    if box is None:
        raise HTTPException(status_code=404, detail="Inventory box not found")
    return box


@router.delete("/{box_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory_box(
    box_id: int,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    removed = remove_inventory_box(db, box_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Inventory box not found")
