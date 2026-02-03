# Inventory Core

A monorepo for inventory management with vision capabilities.

## Project Structure

```
/apps
  /api        # FastAPI backend
  /web        # React frontend (Vite + TypeScript)
/services
  /vision     # Vision libraries and pipelines
/infra
  docker-compose.yml
/docs
```

## Prerequisites

- Docker and Docker Compose
- Git

## Local Development Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd inventory-core
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` if you need to customize database credentials.

### 3. Start all services

```bash
cd infra
docker compose up --build
```

This will start:
- **PostgreSQL** database on port 5432
- **FastAPI** backend on http://localhost:8000
- **React** frontend on http://localhost:3000

### 4. Verify services are running

- API Health: http://localhost:8000/health
- API Docs: http://localhost:8000/docs
- Web App: http://localhost:3000

## Stopping Services

```bash
cd infra
docker compose down
```

To remove volumes (database data):

```bash
docker compose down -v
```

## Development

### API (FastAPI)

The API code is mounted as a volume, so changes will auto-reload.

### Web (React)

The web code is mounted as a volume with hot module replacement enabled.

## Services

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:8000 | FastAPI backend |
| Web | http://localhost:3000 | React frontend |
| DB | localhost:5432 | PostgreSQL database |
