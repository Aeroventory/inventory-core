from typing import Optional
from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    value: int
    sku: str
    qr_code_pattern: Optional[str] = None
    location_site: Optional[str] = None
    location_aisle: Optional[str] = None
    location_rack: Optional[str] = None


class ProductResponse(BaseModel):
    id: int
    name: str
    value: int
    sku: str
    qr_code_pattern: Optional[str] = None
    location_site: Optional[str] = None
    location_aisle: Optional[str] = None
    location_rack: Optional[str] = None

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
