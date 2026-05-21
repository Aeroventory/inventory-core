from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from core.security import get_current_user, require_admin
from db.session import get_db
from schemas.media import MediaAssetResponse
from services.media_service import (
    create_media_asset,
    delete_media_asset,
    get_all_media_assets,
)

router = APIRouter(prefix="/media", tags=["Media"])


@router.get("/", response_model=list[MediaAssetResponse])
def list_media_assets(
    db: Session = Depends(get_db), _current_user=Depends(get_current_user)
):
    return get_all_media_assets(db)


@router.post("/upload", response_model=list[MediaAssetResponse], status_code=status.HTTP_201_CREATED)
def upload_media_assets(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    admin_user=Depends(require_admin),
):
    return [create_media_asset(db, file, admin_user.id) for file in files]


@router.delete("/{media_asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_media_asset(
    media_asset_id: int,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    deleted = delete_media_asset(db, media_asset_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Media asset not found")
