from pydantic import BaseModel


class Detection(BaseModel):
    sku: str
    count: int
    confidence: float
    meta: dict = {}


class InferResponse(BaseModel):
    detections: list[Detection]
    model_version: str = "stub-0.1"
