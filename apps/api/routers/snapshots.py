from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from core.security import get_current_user, require_admin
from db.session import get_db
from schemas.media import MediaAttachmentUpdate
from schemas.inventory_snapshot import (
    SnapshotCreate,
    SnapshotResponse,
    SnapshotItemCreate,
    SnapshotItemUpdate,
    SnapshotItemResponse,
)
from services.media_service import replace_snapshot_media
from services.file_service import upload_file, save_file
from services.snapshot_services import (
    get_all_snapshots,
    get_snapshot_by_id,
    get_latest_snapshot,
    create_snapshot,
    ingest_snapshot,
    delete_snapshot,
    add_snapshot_item,
    update_snapshot_item,
    delete_snapshot_item,
)
from services.vision_client import call_vision_infer
from services.file_service import UPLOADS_DIR

router = APIRouter(prefix="/snapshots", tags=["Snapshots"])


@router.post("/ingest", response_model=SnapshotResponse, status_code=status.HTTP_201_CREATED)
async def ingest(
    file: UploadFile = File(...),
    snapshot_date: Optional[date] = Form(None),
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    """Accept an image upload, call the vision service to infer inventory, and persist the snapshot."""
    temp_name = upload_file(file)
    saved_path = save_file(temp_name, folder="snapshots")

    abs_path = str(UPLOADS_DIR / saved_path)
    vision_results = await call_vision_infer(abs_path)

    snapshot = ingest_snapshot(db, saved_path, snapshot_date, vision_results)
    return snapshot


@router.get("/latest", response_model=SnapshotResponse)
def latest_snapshot(
    db: Session = Depends(get_db), _current_user=Depends(get_current_user)
):
    """Return the most recent snapshot with its items."""
    snapshot = get_latest_snapshot(db)
    if not snapshot:
        raise HTTPException(status_code=404, detail="No snapshots found")
    return snapshot


@router.get("/", response_model=list[SnapshotResponse])
def list_snapshots(
    db: Session = Depends(get_db), _current_user=Depends(get_current_user)
):
    return get_all_snapshots(db)


@router.get("/{snapshot_id}", response_model=SnapshotResponse)
def get_snapshot(
    snapshot_id: int,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    snapshot = get_snapshot_by_id(db, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


@router.post("/", response_model=SnapshotResponse, status_code=status.HTTP_201_CREATED)
def add_snapshot(
    snapshot_in: SnapshotCreate,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    return create_snapshot(db, snapshot_in)


@router.put("/{snapshot_id}/media", response_model=SnapshotResponse)
def edit_snapshot_media(
    snapshot_id: int,
    media_in: MediaAttachmentUpdate,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    snapshot = replace_snapshot_media(db, snapshot_id, media_in)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


@router.delete("/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_snapshot(
    snapshot_id: int,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    deleted = delete_snapshot(db, snapshot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Snapshot not found")


@router.post("/items", response_model=SnapshotItemResponse, status_code=status.HTTP_201_CREATED)
def add_item(
    item_in: SnapshotItemCreate,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    return add_snapshot_item(db, item_in)


@router.patch("/items/{item_id}", response_model=SnapshotItemResponse)
def edit_item(
    item_id: int,
    item_in: SnapshotItemUpdate,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    item = update_snapshot_item(db, item_id, item_in)
    if not item:
        raise HTTPException(status_code=404, detail="Snapshot item not found")
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(
    item_id: int,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    deleted = delete_snapshot_item(db, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Snapshot item not found")
