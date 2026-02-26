from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str


class ProductResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
