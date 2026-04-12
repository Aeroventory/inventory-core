from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile, status

from schemas import Detection, InferResponse

app = FastAPI(title="Vision Inference Service", version="0.1.0")

# Deterministic stub detections returned for every request
STUB_DETECTIONS = [
    Detection(sku="ABC-123", count=10, confidence=0.95, meta={}),
    Detection(sku="DEF-456", count=5, confidence=0.88, meta={}),
    Detection(sku="GHI-789", count=3, confidence=0.92, meta={}),
]


@app.post("/infer", response_model=InferResponse, status_code=status.HTTP_200_OK)
async def infer(
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
):
    """
    Accept an image file OR image URL and return detection results.

    This is a stub implementation that returns deterministic fake data.
    """
    if file is None and image_url is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail="Either 'file' or 'image_url' must be provided",
        )

    # Consume the uploaded file (if any) so the connection closes cleanly
    if file:
        await file.read()

    return InferResponse(detections=STUB_DETECTIONS)


@app.get("/health", status_code=status.HTTP_200_OK)
def health():
    return {"status": "healthy", "model_version": "stub-0.1"}
