from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.inventory_snapshot import SnapshotCreate, SnapshotResponse, SnapshotItemCreate, SnapshotItemUpdate, SnapshotItemResponse
from services.snapshot_services import (
    get_all_snapshots,
    get_snapshot_by_id,
    create_snapshot,
    delete_snapshot,
    add_snapshot_item,
    update_snapshot_item,
    delete_snapshot_item,
)

router = APIRouter(prefix="/snapshots", tags=["Snapshots"])


@router.get("/", response_model=list[SnapshotResponse])
def list_snapshots(db: Session = Depends(get_db)):
    return get_all_snapshots(db)


@router.get("/{snapshot_id}", response_model=SnapshotResponse)
def get_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snapshot = get_snapshot_by_id(db, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


@router.post("/", response_model=SnapshotResponse, status_code=status.HTTP_201_CREATED)
def add_snapshot(snapshot_in: SnapshotCreate, db: Session = Depends(get_db)):
    return create_snapshot(db, snapshot_in)


@router.delete("/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    deleted = delete_snapshot(db, snapshot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Snapshot not found")


@router.post("/items", response_model=SnapshotItemResponse, status_code=status.HTTP_201_CREATED)
def add_item(item_in: SnapshotItemCreate, db: Session = Depends(get_db)):
    return add_snapshot_item(db, item_in)


@router.patch("/items/{item_id}", response_model=SnapshotItemResponse)
def edit_item(item_id: int, item_in: SnapshotItemUpdate, db: Session = Depends(get_db)):
    item = update_snapshot_item(db, item_id, item_in)
    if not item:
        raise HTTPException(status_code=404, detail="Snapshot item not found")
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(item_id: int, db: Session = Depends(get_db)):
    deleted = delete_snapshot_item(db, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Snapshot item not found")
