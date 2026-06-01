from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class ProductContext(BaseModel):
    id: int
    name: str
    sku: str
    qr_code_pattern: Optional[str] = None
    location_site: Optional[str] = None
    location_aisle: Optional[str] = None
    location_rack: Optional[str] = None
    raw_materials: Optional[str] = None


class InventoryDetection(BaseModel):
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


class AnalyzeResponse(BaseModel):
    detections: list[InventoryDetection] = Field(default_factory=list)
    unmatched: list[InventoryDetection] = Field(default_factory=list)
    raw_json: dict = Field(default_factory=dict)
    model_version: str


class Detection(BaseModel):
    sku: str | None = None
    product_id: int | None = None
    box_code: str | None = None
    box_date: date | None = None
    count: int
    quantity: int | None = None
    confidence: float | None = None
    meta: dict = {}


class InferResponse(BaseModel):
    detections: list[Detection]
    model_version: str = "stub-0.1"
