from datetime import datetime
from pydantic import BaseModel


# --- Nested DTOs for responses ---

class ProductInSnapshot(BaseModel):
    id: int
    name: str
    value: int

    class Config:
        from_attributes = True


class SnapshotItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    product: ProductInSnapshot

    class Config:
        from_attributes = True


# --- Request DTOs ---

class SnapshotCreate(BaseModel):
    name: str
    file_path: str


class SnapshotItemCreate(BaseModel):
    product_id: int
    snapshot_id: int
    quantity: int


class SnapshotItemUpdate(BaseModel):
    quantity: int


# --- Response DTOs ---

class SnapshotResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    file_path: str
    items: list[SnapshotItemResponse]

    class Config:
        from_attributes = True
