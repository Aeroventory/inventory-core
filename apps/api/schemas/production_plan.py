from datetime import date as Date

from pydantic import BaseModel, ConfigDict, Field


class PlanCreate(BaseModel):
    product_id: int
    target_quantity: int = Field(ge=0)
    date: Date


class PlanUpdate(BaseModel):
    product_id: int | None = None
    target_quantity: int | None = Field(default=None, ge=0)
    date: Date | None = None


class PlanBulkCreate(BaseModel):
    product_id: int
    target_quantity: int = Field(ge=0)
    from_date: Date = Field(alias="from")
    to_date: Date = Field(alias="to")

    model_config = ConfigDict(populate_by_name=True)


class PlanResponse(BaseModel):
    id: int
    product_id: int
    target_quantity: int
    date: Date
    created_by: int | None = None

    model_config = ConfigDict(from_attributes=True)
