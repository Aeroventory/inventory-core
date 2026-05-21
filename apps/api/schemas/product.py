from typing import Optional

from pydantic import BaseModel, Field

from schemas.media import MediaAssetResponse


class ProductCreate(BaseModel):
    name: str
    value: int
    sku: str
    qr_code_pattern: Optional[str] = None
    location_site: Optional[str] = None
    location_aisle: Optional[str] = None
    location_rack: Optional[str] = None
    raw_materials: Optional[str] = None


class ProductResponse(BaseModel):
    id: int
    name: str
    value: int
    sku: str
    qr_code_pattern: Optional[str] = None
    location_site: Optional[str] = None
    location_aisle: Optional[str] = None
    location_rack: Optional[str] = None
    raw_materials: Optional[str] = None
    images: list[MediaAssetResponse] = Field(default_factory=list)
    primary_image: Optional[MediaAssetResponse] = None

    class Config:
        from_attributes = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    value: Optional[int] = None
    sku: Optional[str] = None
    qr_code_pattern: Optional[str] = None
    location_site: Optional[str] = None
    location_aisle: Optional[str] = None
    location_rack: Optional[str] = None
    raw_materials: Optional[str] = None
