import httpx
from fastapi import HTTPException

from core.config import settings


async def call_vision_infer(file_path: str) -> list[dict]:
    """
    Call the vision service /infer endpoint with an image file.

    Returns a list of detected items, e.g.:
        [{"product_name": "Widget A", "quantity": 5}, ...]
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

    return response.json()
