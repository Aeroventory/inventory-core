from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from schemas.inventory_snapshot import ProductInSnapshot


class InventoryBoxCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    box_date: date
    box_code: str | None = None


class InventoryBoxUpdate(BaseModel):
    product_id: int | None = None
    quantity: int | None = Field(default=None, gt=0)
    box_date: date | None = None
    box_code: str | None = None
    is_active: bool | None = None


class InventoryBoxResponse(BaseModel):
    id: int
    box_code: str
    product_id: int
    quantity: int
    box_date: date
    is_active: bool
    created_at: datetime
    removed_at: datetime | None = None
    product: ProductInSnapshot

    model_config = ConfigDict(from_attributes=True)
