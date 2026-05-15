from datetime import date as Date, datetime
from typing import Literal

from pydantic import BaseModel

from schemas.inventory_snapshot import ProductInSnapshot


DeltaStatus = Literal["added", "consumed", "unchanged"]


class DeltaItem(BaseModel):
    product: ProductInSnapshot
    previous_quantity: int
    current_quantity: int
    delta: int
    status: DeltaStatus


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
