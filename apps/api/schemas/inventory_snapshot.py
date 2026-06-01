from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from schemas.media import MediaAssetResponse


# --- Nested DTOs for responses ---

class ProductInSnapshot(BaseModel):
    id: int
    name: str
    value: int
    sku: str
    qr_code_pattern: Optional[str] = None
    location_site: Optional[str] = None
    location_aisle: Optional[str] = None
    location_rack: Optional[str] = None
    raw_materials: Optional[str] = None
    primary_image: Optional[MediaAssetResponse] = None

    class Config:
        from_attributes = True


class SnapshotItemResponse(BaseModel):
    id: int
    box_id: int
    box_code: str
    product_id: int
    quantity: int
    box_date: date
    confidence_score: Optional[float] = None
    product: ProductInSnapshot

    class Config:
        from_attributes = True


# --- Request DTOs ---

class SnapshotCreate(BaseModel):
    name: str
    file_path: Optional[str] = None
    snapshot_date: Optional[date] = None
    is_manual: bool = True
    removed_box_ids: list[int] = Field(default_factory=list)


class SnapshotItemCreate(BaseModel):
    product_id: int
    snapshot_id: int
    quantity: int
    confidence_score: Optional[float] = None


class SnapshotIngest(BaseModel):
    """Schema for the snapshot_date form field in the ingest endpoint."""
    snapshot_date: Optional[date] = None


class SnapshotItemUpdate(BaseModel):
    quantity: int


class AiSnapshotProductContext(BaseModel):
    id: int
    name: str
    sku: str
    qr_code_pattern: Optional[str] = None
    location_site: Optional[str] = None
    location_aisle: Optional[str] = None
    location_rack: Optional[str] = None
    raw_materials: Optional[str] = None


class AiSnapshotAnalysisRow(BaseModel):
    product_id: Optional[int] = None
    sku: Optional[str] = None
    product_name: Optional[str] = None
    box_code: Optional[str] = None
    quantity: int = Field(default=1, gt=0)
    box_date: Optional[date] = None
    confidence_score: Optional[float] = Field(default=None, ge=0, le=1)
    location_site: Optional[str] = None
    location_aisle: Optional[str] = None
    location_rack: Optional[str] = None
    notes: Optional[str] = None


class AiSnapshotBoxPreview(BaseModel):
    id: int
    box_code: str
    product_id: int
    product_name: str
    quantity: int
    box_date: date


class AiSnapshotAnalyzeResponse(BaseModel):
    temp_filename: str
    detections: list[AiSnapshotAnalysisRow]
    unmatched: list[AiSnapshotAnalysisRow] = Field(default_factory=list)
    active_boxes: list[AiSnapshotBoxPreview] = Field(default_factory=list)
    removed_boxes: list[AiSnapshotBoxPreview] = Field(default_factory=list)
    raw_json: dict = Field(default_factory=dict)
    model_version: Optional[str] = None


class AiSnapshotCreate(BaseModel):
    name: str
    snapshot_date: date
    temp_filename: str
    rows: list[AiSnapshotAnalysisRow]
    confirmed_removed_box_ids: list[int] = Field(default_factory=list)


# --- Response DTOs ---

class SnapshotResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    is_manual: bool
    file_path: Optional[str] = None
    images: list[MediaAssetResponse] = Field(default_factory=list)
    primary_image: Optional[MediaAssetResponse] = None
    items: list[SnapshotItemResponse]

    class Config:
        from_attributes = True
