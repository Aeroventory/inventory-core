from datetime import date as Date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from schemas.inventory_snapshot import ProductInSnapshot


DeltaStatus = Literal["added", "consumed", "unchanged"]


class DeltaBoxItem(BaseModel):
    box_id: int
    box_code: str
    product_id: int
    quantity: int
    box_date: Date
    confidence_score: float | None = None


class DeltaItem(BaseModel):
    product: ProductInSnapshot
    previous_quantity: int
    current_quantity: int
    added_quantity: int
    removed_quantity: int
    delta: int
    status: DeltaStatus
    confidence_score: float | None = None
    added_boxes: list[DeltaBoxItem] = Field(default_factory=list)
    removed_boxes: list[DeltaBoxItem] = Field(default_factory=list)


class DailyDeltaResponse(BaseModel):
    date: Date
    current_snapshot_id: int
    baseline_date: Date
    baseline_snapshot_id: int | None = None
    items: list[DeltaItem]


class StockSummaryItem(BaseModel):
    product: ProductInSnapshot
    quantity: int


class StockSummaryResponse(BaseModel):
    snapshot_id: int
    snapshot_date: Date
    created_at: datetime
    items: list[StockSummaryItem]


class PlanVsActualItem(BaseModel):
    date: Date
    product: ProductInSnapshot
    planned_quantity: int
    actual_quantity: int
    variance: int
    snapshot_id: int | None = None


class PlanVsActualResponse(BaseModel):
    from_date: Date
    to_date: Date
    items: list[PlanVsActualItem]
