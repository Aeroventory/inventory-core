from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from core.security import get_current_user, require_admin
from db.session import get_db
from schemas.media import MediaAttachmentUpdate
from schemas.inventory_snapshot import (
    AiSnapshotAnalysisRow,
    AiSnapshotAnalyzeResponse,
    AiSnapshotBoxPreview,
    AiSnapshotCreate,
    AiSnapshotProductContext,
    SnapshotCreate,
    SnapshotResponse,
    SnapshotItemCreate,
    SnapshotItemUpdate,
    SnapshotItemResponse,
)
from services.media_service import replace_snapshot_media
from services.file_service import delete_temp_file, upload_file, save_file
from services.snapshot_services import (
    get_all_snapshots,
    get_snapshot_by_id,
    get_latest_snapshot,
    create_snapshot,
    create_ai_snapshot,
    get_ai_snapshot_active_box_previews,
    get_ai_snapshot_removed_box_previews,
    ingest_snapshot,
    delete_snapshot,
    add_snapshot_item,
    update_snapshot_item,
    delete_snapshot_item,
)
from services.vision_client import call_vision_ai_analyze, call_vision_infer
from services.file_service import TEMP_DIR, UPLOADS_DIR
from models.product import Product

router = APIRouter(prefix="/snapshots", tags=["Snapshots"])


def _product_catalog(db: Session) -> list[dict]:
    products = db.query(Product).order_by(Product.name, Product.id).all()
    return [
        AiSnapshotProductContext(
            id=product.id,
            name=product.name,
            sku=product.sku,
            qr_code_pattern=product.qr_code_pattern,
            location_site=product.location_site,
            location_aisle=product.location_aisle,
            location_rack=product.location_rack,
            raw_materials=product.raw_materials,
        ).model_dump()
        for product in products
    ]


def _clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = " ".join(str(value).strip().split())
    return cleaned or None


def _sku_key(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_text(value)
    return cleaned.upper() if cleaned else None


def _same_text(first: Optional[str], second: Optional[str]) -> bool:
    first_clean = _clean_text(first)
    second_clean = _clean_text(second)
    if first_clean is None or second_clean is None:
        return False
    return first_clean.casefold() == second_clean.casefold()


def _append_row_note(row: AiSnapshotAnalysisRow, note: str) -> None:
    existing = _clean_text(row.notes)
    row.notes = f"{existing} {note}" if existing else note


def _apply_product_match(
    row: AiSnapshotAnalysisRow,
    product: Product,
    *,
    match_reason: str,
) -> None:
    returned_product_id = row.product_id
    returned_sku = _clean_text(row.sku)
    returned_name = _clean_text(row.product_name)

    if (
        match_reason == "sku"
        and returned_product_id is not None
        and returned_product_id != product.id
    ):
        _append_row_note(
            row,
            f"Review warning: AI returned product_id {returned_product_id}, but SKU {product.sku} maps to product_id {product.id}.",
        )
    if (
        match_reason == "product_id"
        and returned_sku
        and _sku_key(returned_sku) != _sku_key(product.sku)
    ):
        _append_row_note(
            row,
            f"Review warning: AI returned SKU {returned_sku}, but product_id {product.id} maps to SKU {product.sku}.",
        )
    if returned_name and not _same_text(returned_name, product.name):
        _append_row_note(
            row,
            f"Review warning: AI returned product name '{returned_name}', but matched catalog product is '{product.name}'.",
        )

    row.product_id = product.id
    row.sku = product.sku
    row.product_name = product.name


def _coerce_ai_rows(db: Session, rows: list[dict]) -> tuple[list[AiSnapshotAnalysisRow], list[AiSnapshotAnalysisRow]]:
    products = db.query(Product).all()
    product_by_id = {product.id: product for product in products}
    product_by_sku: dict[str, Product] = {}
    for product in products:
        key = _sku_key(product.sku)
        if key:
            product_by_sku.setdefault(key, product)
    matched: list[AiSnapshotAnalysisRow] = []
    unmatched: list[AiSnapshotAnalysisRow] = []

    for raw_row in rows:
        row = AiSnapshotAnalysisRow(**raw_row)
        row.sku = _clean_text(row.sku)
        row.product_name = _clean_text(row.product_name)
        row.box_code = _clean_text(row.box_code)
        row.location_site = _clean_text(row.location_site)
        row.location_aisle = _clean_text(row.location_aisle)
        row.location_rack = _clean_text(row.location_rack)
        row.notes = _clean_text(row.notes)

        sku_product = product_by_sku.get(_sku_key(row.sku) or "")
        if sku_product is not None:
            _apply_product_match(row, sku_product, match_reason="sku")
            matched.append(row)
            continue

        id_product = product_by_id.get(row.product_id) if row.product_id is not None else None
        if id_product is not None:
            _apply_product_match(row, id_product, match_reason="product_id")
            matched.append(row)
            continue

        unmatched.append(row)

    return matched, unmatched


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


@router.post("/ai/analyze", response_model=AiSnapshotAnalyzeResponse)
async def analyze_ai_snapshot(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    """Analyze an uploaded snapshot image with Gemini and return reviewable rows."""
    temp_name = upload_file(file)
    abs_path = str(TEMP_DIR / temp_name)
    try:
        vision_response = await call_vision_ai_analyze(abs_path, _product_catalog(db))

        matched, unmatched = _coerce_ai_rows(
            db,
            [
                *vision_response.get("detections", []),
                *vision_response.get("unmatched", []),
            ],
        )
        active_boxes = get_ai_snapshot_active_box_previews(db)
        removed_boxes = get_ai_snapshot_removed_box_previews(db, matched)
    except Exception:
        delete_temp_file(temp_name)
        raise

    return AiSnapshotAnalyzeResponse(
        temp_filename=temp_name,
        detections=matched,
        unmatched=unmatched,
        active_boxes=active_boxes,
        removed_boxes=removed_boxes,
        raw_json=vision_response.get("raw_json", vision_response),
        model_version=vision_response.get("model_version"),
    )


@router.post("/ai/create", response_model=SnapshotResponse, status_code=status.HTTP_201_CREATED)
def create_from_ai_snapshot(
    snapshot_in: AiSnapshotCreate,
    db: Session = Depends(get_db),
    _admin_user=Depends(require_admin),
):
    return create_ai_snapshot(db, snapshot_in)


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
