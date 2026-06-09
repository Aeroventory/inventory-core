from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from models.inventory_snapshot import InventorySnapshot
from models.inventory_snapshot_item import InventorySnapshotItem
from models.media import MediaAsset, ProductMediaAsset, SnapshotMediaAsset
from models.product import Product
from schemas.media import MediaAttachmentInput, MediaAttachmentUpdate
from services.file_service import UPLOADS_DIR, delete_file, save_file, upload_file


def get_all_media_assets(db: Session) -> list[MediaAsset]:
    return db.query(MediaAsset).order_by(MediaAsset.created_at.desc(), MediaAsset.id.desc()).all()


def create_media_asset(db: Session, file: UploadFile, uploader_id: int | None) -> MediaAsset:
    content_type = file.content_type
    if content_type and not content_type.startswith("image/"):
        file.file.close()
        raise HTTPException(status_code=400, detail="Only image uploads are supported")

    original_filename = file.filename
    temp_filename = upload_file(file)
    file_path = save_file(temp_filename, folder="gallery")
    absolute_path = UPLOADS_DIR / file_path

    asset = MediaAsset(
        file_path=file_path,
        original_filename=original_filename,
        content_type=content_type,
        size_bytes=absolute_path.stat().st_size if absolute_path.exists() else 0,
        uploaded_by_user_id=uploader_id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def register_media_asset_from_local(db: Session, file_path: str, uploader_id: int | None = None) -> MediaAsset:
    absolute_path = UPLOADS_DIR / file_path
    original_filename = absolute_path.name
    
    asset = MediaAsset(
        file_path=file_path,
        original_filename=original_filename,
        content_type="image/jpeg",
        size_bytes=absolute_path.stat().st_size if absolute_path.exists() else 0,
        uploaded_by_user_id=uploader_id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def delete_media_asset(db: Session, media_asset_id: int) -> bool:
    asset = (
        db.query(MediaAsset)
        .options(
            joinedload(MediaAsset.product_links),
            joinedload(MediaAsset.snapshot_links),
        )
        .filter(MediaAsset.id == media_asset_id)
        .first()
    )
    if not asset:
        return False
    if asset.product_links or asset.snapshot_links:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Media asset is attached to a product or snapshot",
        )

    file_path = asset.file_path
    db.delete(asset)
    db.commit()
    delete_file(file_path)
    return True


def replace_product_media(
    db: Session,
    product_id: int,
    attachment_update: MediaAttachmentUpdate,
) -> Product | None:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None

    attachments = _normalize_attachments(attachment_update.attachments)
    _assert_media_assets_exist(db, [item["media_asset_id"] for item in attachments])

    db.query(ProductMediaAsset).filter(ProductMediaAsset.product_id == product_id).delete(
        synchronize_session=False
    )
    db.flush()
    for item in attachments:
        db.add(ProductMediaAsset(product_id=product_id, **item))
    db.commit()
    return _product_with_media(db, product_id)


def replace_snapshot_media(
    db: Session,
    snapshot_id: int,
    attachment_update: MediaAttachmentUpdate,
) -> InventorySnapshot | None:
    snapshot = db.query(InventorySnapshot).filter(InventorySnapshot.id == snapshot_id).first()
    if not snapshot:
        return None

    attachments = _normalize_attachments(attachment_update.attachments)
    _assert_media_assets_exist(db, [item["media_asset_id"] for item in attachments])

    db.query(SnapshotMediaAsset).filter(
        SnapshotMediaAsset.snapshot_id == snapshot_id
    ).delete(synchronize_session=False)
    db.flush()
    for item in attachments:
        db.add(SnapshotMediaAsset(snapshot_id=snapshot_id, **item))
    db.commit()
    return _snapshot_with_media(db, snapshot_id)


def _normalize_attachments(
    attachments: list[MediaAttachmentInput],
) -> list[dict[str, int | bool]]:
    normalized: list[dict[str, int | bool]] = []
    seen_ids: set[int] = set()
    primary_count = 0

    for index, attachment in enumerate(attachments):
        if attachment.media_asset_id in seen_ids:
            raise HTTPException(status_code=400, detail="Media assets cannot be duplicated")
        seen_ids.add(attachment.media_asset_id)
        if attachment.is_primary:
            primary_count += 1
        normalized.append(
            {
                "media_asset_id": attachment.media_asset_id,
                "sort_order": attachment.sort_order if attachment.sort_order is not None else index,
                "is_primary": attachment.is_primary,
            }
        )

    if primary_count > 1:
        raise HTTPException(status_code=400, detail="Only one primary image is allowed")
    if normalized and primary_count == 0:
        normalized[0]["is_primary"] = True

    return normalized


def _assert_media_assets_exist(db: Session, media_asset_ids: list[int]) -> None:
    if not media_asset_ids:
        return
    existing_ids = {
        row[0]
        for row in db.query(MediaAsset.id)
        .filter(MediaAsset.id.in_(media_asset_ids))
        .all()
    }
    missing_ids = sorted(set(media_asset_ids) - existing_ids)
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Media assets not found: {', '.join(str(id_) for id_ in missing_ids)}",
        )


def _product_with_media(db: Session, product_id: int) -> Product | None:
    return (
        db.query(Product)
        .options(joinedload(Product.media_links).joinedload(ProductMediaAsset.media_asset))
        .filter(Product.id == product_id)
        .first()
    )


def _snapshot_with_media(db: Session, snapshot_id: int) -> InventorySnapshot | None:
    return (
        db.query(InventorySnapshot)
        .options(
            joinedload(InventorySnapshot.media_links).joinedload(
                SnapshotMediaAsset.media_asset
            ),
            joinedload(InventorySnapshot.items)
            .joinedload(InventorySnapshotItem.product)
            .joinedload(Product.media_links)
            .joinedload(ProductMediaAsset.media_asset),
            joinedload(InventorySnapshot.items).joinedload(InventorySnapshotItem.box),
        )
        .filter(InventorySnapshot.id == snapshot_id)
        .first()
    )
