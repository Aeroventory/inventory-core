from typing import Optional
from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    value: int


class ProductResponse(BaseModel):
    id: int
    name: str
    value: int

    class Config:
        from_attributes = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    value: Optional[int] = None
