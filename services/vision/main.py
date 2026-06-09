import asyncio
import json
import mimetypes
import os
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status

from schemas import AnalyzeResponse, Detection, InferResponse, InventoryDetection, ProductContext

app = FastAPI(title="Vision Inference Service", version="0.1.0")

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")


GEMINI_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "detections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "product_id": {
                        "type": "integer",
                        "description": "Existing product id from the supplied catalog when confidently matched.",
                    },
                    "sku": {"type": "string"},
                    "product_name": {"type": "string"},
                    "box_code": {
                        "type": "string",
                        "description": "Visible box, carton, pallet, QR, or label code when readable.",
                    },
                    "quantity": {
                        "type": "integer",
                        "description": "Number of units represented by this inventory row.",
                    },
                    "box_date": {
                        "type": "string",
                        "description": "Date visible on the box/label as YYYY-MM-DD when present.",
                    },
                    "confidence_score": {
                        "type": "number",
                        "description": "Confidence from 0 to 1.",
                    },
                    "location_site": {
                        "type": "string",
                        "description": "Visible site, warehouse, or facility hint when present.",
                    },
                    "location_aisle": {
                        "type": "string",
                        "description": "Visible aisle, bay, or section hint when present.",
                    },
                    "location_rack": {
                        "type": "string",
                        "description": "Visible rack, shelf, or row hint when present.",
                    },
                    "notes": {"type": "string"},
                },
                "required": ["quantity"],
            },
        },
        "unmatched": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string"},
                    "product_name": {"type": "string"},
                    "box_code": {"type": "string"},
                    "quantity": {"type": "integer"},
                    "box_date": {"type": "string"},
                    "confidence_score": {"type": "number"},
                    "location_site": {"type": "string"},
                    "location_aisle": {"type": "string"},
                    "location_rack": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": ["quantity"],
            },
        },
    },
    "required": ["detections", "unmatched"],
}


def _gemini_client():
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured for the vision service",
        )

    from google import genai

    return genai.Client(api_key=api_key)


def _read_products(product_catalog: str) -> list[ProductContext]:
    try:
        raw_products = json.loads(product_catalog or "[]")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="product_catalog must be valid JSON")
    if not isinstance(raw_products, list):
        raise HTTPException(status_code=400, detail="product_catalog must be a JSON array")
    return [ProductContext(**product) for product in raw_products]


def _prompt(products: list[ProductContext], image_count: int = 1) -> str:
    product_json = json.dumps(
        [product.model_dump(exclude_none=True) for product in products],
        ensure_ascii=False,
    )
    subject = (
        "these inventory snapshot images"
        if image_count > 1
        else "this inventory snapshot image"
    )
    multi_image_rules = (
        "\n- The supplied images are from one drone inventory capture. Merge them into one result set."
        "\n- If the same visible box appears in multiple images, return it once. Use box_code as the strongest dedupe key."
        if image_count > 1
        else ""
    )
    return f"""
Analyze {subject} and extract box-level inventory rows.

Known product catalog:
{product_json}

Rules:
- SKU is the authoritative product key. When a visible SKU matches the catalog, return that catalog product_id, sku, and product_name even if another label/name appears inconsistent.
- Match rows only to products from the catalog. Use product_id only when the visible SKU, label, QR pattern, name, or location clearly matches a catalog product.
- Put uncertain or unmatched rows in unmatched, not detections.
- Never invent new products or product IDs.
- For unmatched rows, still return any visible sku, product_name, box_code, quantity, date, and structured location hints.
- Use one row per visible box/carton/pallet group when possible.
- quantity must be a positive integer. Use 1 when a box is visible but no quantity is readable.
- box_date must be YYYY-MM-DD when a date is visible; otherwise omit it.
- Use location_site, location_aisle, and location_rack for structured visible location text instead of burying it only in notes.
- confidence_score must be between 0 and 1.
- Return only JSON matching the response schema.
{multi_image_rules}
""".strip()


def _parse_gemini_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        return json.loads(cleaned)


def _normalize_detection(row: dict) -> InventoryDetection | None:
    try:
        return InventoryDetection(**row)
    except Exception:
        return None


def _analyze_with_gemini(
    image_bytes: bytes,
    mime_type: str,
    products: list[ProductContext],
) -> AnalyzeResponse:
    return _analyze_with_gemini_images([(image_bytes, mime_type)], products)


def _analyze_with_gemini_images(
    images: list[tuple[bytes, str]],
    products: list[ProductContext],
) -> AnalyzeResponse:
    from google.genai import types

    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required")

    client = _gemini_client()
    image_parts = [
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        for image_bytes, mime_type in images
    ]
    response = client.models.generate_content(
        model=DEFAULT_MODEL,
        contents=[
            *image_parts,
            _prompt(products, image_count=len(images)),
        ],
        config={
            "response_mime_type": "application/json",
            "response_json_schema": GEMINI_RESPONSE_SCHEMA,
        },
    )
    raw_json = _parse_gemini_json(response.text or "{}")
    raw_detections = raw_json.get("detections", [])
    raw_unmatched = raw_json.get("unmatched", [])

    detections = [
        detection
        for detection in (_normalize_detection(row) for row in raw_detections)
        if detection is not None
    ]
    unmatched = [
        detection
        for detection in (_normalize_detection(row) for row in raw_unmatched)
        if detection is not None
    ]
    return AnalyzeResponse(
        detections=detections,
        unmatched=unmatched,
        raw_json=raw_json,
        model_version=DEFAULT_MODEL,
    )


async def _read_uploaded_image(file: UploadFile) -> tuple[bytes, str]:
    image_bytes = await file.read()
    mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0]
    return image_bytes, mime_type or "image/jpeg"


async def _read_image(file: Optional[UploadFile], image_url: Optional[str]) -> tuple[bytes, str]:
    if file is None and image_url is None:
        raise HTTPException(
            status_code=400,
            detail="Either 'file' or 'image_url' must be provided",
        )

    if file is not None:
        return await _read_uploaded_image(file)

    import httpx

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(image_url)
        response.raise_for_status()
        mime_type = response.headers.get("content-type", "image/jpeg").split(";")[0]
        return response.content, mime_type


@app.post("/analyze", response_model=AnalyzeResponse, status_code=status.HTTP_200_OK)
async def analyze(
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    product_catalog: str = Form("[]"),
):
    products = _read_products(product_catalog)
    image_bytes, mime_type = await _read_image(file, image_url)
    try:
        return await asyncio.to_thread(
            _analyze_with_gemini,
            image_bytes,
            mime_type,
            products,
        )
    except HTTPException:
        raise
    except Exception as exc:
        status_code = getattr(exc, "status_code", 502)
        message = str(exc)
        if status_code == 429 or "RESOURCE_EXHAUSTED" in message:
            raise HTTPException(
                status_code=429,
                detail="Gemini quota or billing is exhausted. Check Google AI Studio billing/credits for this API key.",
            )
        raise HTTPException(
            status_code=502,
            detail=f"Gemini analysis failed: {message}",
        )


@app.post("/analyze/batch", response_model=AnalyzeResponse, status_code=status.HTTP_200_OK)
async def analyze_batch(
    files: list[UploadFile] = File(...),
    product_catalog: str = Form("[]"),
):
    products = _read_products(product_catalog)
    if not files:
        raise HTTPException(status_code=400, detail="At least one image is required")
    images = [await _read_uploaded_image(file) for file in files]
    try:
        return await asyncio.to_thread(
            _analyze_with_gemini_images,
            images,
            products,
        )
    except HTTPException:
        raise
    except Exception as exc:
        status_code = getattr(exc, "status_code", 502)
        message = str(exc)
        if status_code == 429 or "RESOURCE_EXHAUSTED" in message:
            raise HTTPException(
                status_code=429,
                detail="Gemini quota or billing is exhausted. Check Google AI Studio billing/credits for this API key.",
            )
        raise HTTPException(
            status_code=502,
            detail=f"Gemini analysis failed: {message}",
        )


@app.post("/infer", response_model=InferResponse, status_code=status.HTTP_200_OK)
async def infer(
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
):
    """
    Accept an image file OR image URL and return detection results.
    Legacy endpoint kept for API compatibility.
    """
    analysis = await analyze(file=file, image_url=image_url, product_catalog="[]")
    detections = [
        Detection(
            sku=row.sku,
            product_id=row.product_id,
            box_code=row.box_code,
            box_date=row.box_date,
            count=row.quantity,
            quantity=row.quantity,
            confidence=row.confidence_score,
            meta={"product_name": row.product_name, "notes": row.notes},
        )
        for row in [*analysis.detections, *analysis.unmatched]
    ]

    return InferResponse(detections=detections, model_version=analysis.model_version)


@app.get("/health", status_code=status.HTTP_200_OK)
def health():
    configured = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    return {
        "status": "healthy" if configured else "degraded",
        "model_version": DEFAULT_MODEL,
        "gemini_configured": configured,
    }
