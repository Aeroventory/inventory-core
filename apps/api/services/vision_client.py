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
