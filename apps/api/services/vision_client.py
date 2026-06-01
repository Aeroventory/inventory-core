import json
import mimetypes
from pathlib import Path

import httpx
from fastapi import HTTPException

from core.config import settings


async def call_vision_infer(file_path: str) -> list[dict]:
    """
    Call the vision service /infer endpoint with an image file.

    Returns the list of detections, e.g.:
        [{"sku": "ABC-123", "count": 10, "confidence": 0.95, "meta": {}}, ...]
    """
    url = f"{settings.VISION_SERVICE_URL}/infer"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(file_path, "rb") as f:
                response = await client.post(url, files={"file": f})
    except httpx.ConnectError:
        raise HTTPException(
            status_code=502,
            detail="Vision service is unavailable",
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach vision service: {str(e)}",
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Vision service returned status {response.status_code}",
        )

    data = response.json()
    return data.get("detections", [])


async def call_vision_ai_analyze(
    file_path: str, product_catalog: list[dict]
) -> dict:
    """Call the vision service Gemini analysis endpoint with product context."""
    url = f"{settings.VISION_SERVICE_URL}/analyze"
    path = Path(file_path)
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            with open(path, "rb") as f:
                response = await client.post(
                    url,
                    data={"product_catalog": json.dumps(product_catalog)},
                    files={"file": (path.name, f, mime_type)},
                )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=502,
            detail="Vision service is unavailable",
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach vision service: {str(e)}",
        )

    if response.status_code != 200:
        detail = f"Vision service returned status {response.status_code}"
        try:
            error_data = response.json()
            detail = error_data.get("detail", detail)
        except ValueError:
            pass
        status_code = response.status_code if response.status_code in {400, 401, 403, 404, 409, 422, 429} else 502
        raise HTTPException(status_code=status_code, detail=detail)

    return response.json()
