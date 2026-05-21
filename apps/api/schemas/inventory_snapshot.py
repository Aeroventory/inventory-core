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
