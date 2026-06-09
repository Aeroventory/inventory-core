# Vision Inference Service

FastAPI service that uses Google AI Studio Gemini to extract reviewable
inventory detections from images.

## Endpoints

- `POST /analyze` — Accept an image file or image URL plus product catalog JSON, return matched and unmatched detections
- `POST /analyze/batch` — Accept multiple image files plus product catalog JSON, merge them into one deduplicated inventory result
- `POST /infer` — Legacy compatibility endpoint that returns detection results
- `GET /health` — Health check

## Response contract

```json
{
  "detections": [
    {
      "product_id": 1,
      "sku": "ABC-123",
      "product_name": "Panel",
      "box_code": "BOX-001",
      "quantity": 10,
      "box_date": "2026-05-31",
      "confidence_score": 0.95,
      "notes": "Label was clearly visible."
    }
  ],
  "unmatched": [],
  "raw_json": {},
  "model_version": "gemini-3.5-flash"
}
```

## Configuration

Set `GEMINI_API_KEY` in the repo `.env`. `GEMINI_MODEL` defaults to
`gemini-3.5-flash`.

## Running

```bash
docker compose -f infra/docker-compose.yml up vision
```

The service runs on port 8001 by default.
