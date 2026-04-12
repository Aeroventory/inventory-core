# Vision Inference Service

Stub FastAPI service that provides inventory detection from images.

## Endpoints

- `POST /infer` — Accept an image file or image URL, return detection results
- `GET /health` — Health check

## Response contract

```json
{
  "detections": [
    {
      "sku": "ABC-123",
      "count": 10,
      "confidence": 0.95,
      "meta": {}
    }
  ],
  "model_version": "stub-0.1"
}
```

## Running

```bash
docker compose -f infra/docker-compose.yml up vision
```

The service runs on port 8001 by default.
