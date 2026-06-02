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

Edit `.env` to configure ports, credentials, and URLs.

### 3. Start all services

Run from the **project root**:

```bash
docker compose -f infra/docker-compose.yml up --build
```

This will start:

- **PostgreSQL** database on port `DB_PORT` (default: 5432)
- **FastAPI** backend on `API_PORT` (default: 8003)
- **React** frontend on `WEB_PORT` (default: 3000)

Database migrations run automatically on startup.

If `DEFAULT_ADMIN_USERNAME` and `DEFAULT_ADMIN_PASSWORD` are present in `.env`
before the `users` migration runs, Docker Compose will seed that admin account
while creating the table. If the `users` table already exists and is empty,
register the first admin through `POST /auth/register`; if it already contains
users without an admin, promote/create one manually with a bcrypt password hash
or recreate the database volume.

### 4. Verify services are running

- API Health: http://localhost:8003/health
- API Docs: http://localhost:8003/docs
- Web App: http://localhost:3000

> Ports may differ based on your `.env` configuration.

## Stopping Services

```bash
docker compose -f infra/docker-compose.yml down
```

To remove volumes (database data):

```bash
docker compose -f infra/docker-compose.yml down -v
```

## Configuration

All configuration is managed through the root `.env` file:

| Variable                           | Default                         | Description                                   |
| ---------------------------------- | ------------------------------- | --------------------------------------------- |
| `POSTGRES_USER`                    | `postgres`                      | Database username                             |
| `POSTGRES_PASSWORD`                | `postgres`                      | Database password                             |
| `POSTGRES_DB`                      | `inventory`                     | Database name                                 |
| `SECRET_KEY`                       | —                               | API secret key (required)                     |
| `DEFAULT_ADMIN_USERNAME`           | —                               | Admin username seeded during migration if set |
| `DEFAULT_ADMIN_PASSWORD`           | —                               | Admin password seeded during migration if set |
| `API_PORT`                         | `8003`                          | API host port                                 |
| `WEB_PORT`                         | `3000`                          | Web app host port                             |
| `DB_PORT`                          | `5432`                          | Database host port                            |
| `CORS_ORIGINS`                     | `http://localhost:3000`         | Allowed CORS origins                          |
| `VITE_API_URL`                     | `http://localhost:8003`         | API URL for the frontend                      |
| `VISION_SERVICE_URL`               | `http://vision:8001`            | Vision service URL used by the API            |
| `GEMINI_API_KEY`                   | —                               | Google AI Studio key for vision analysis      |
| `GEMINI_MODEL`                     | `gemini-3.5-flash`              | Gemini model used by the vision service       |
| `DRONE_HOST`                       | `192.168.1.1`                   | Drone control host/IP                         |
| `DRONE_RTSP_PORT`                  | `7070`                          | Drone RTSP camera port                        |
| `DRONE_RTSP_URL`                   | `rtsp://192.168.1.1:7070/webcam` | Drone camera stream URL                       |
| `DRONE_VERBOSE_RTSP`               | `false`                         | Enables verbose RTSP logging                  |
| `DRONE_SPEED`                      | `30`                            | Default movement speed for mission commands   |
| `DRONE_AXIS_DELTA`                 | `90`                            | Axis delta for directional mission commands   |
| `DRONE_HOVER_THROTTLE`             | `128`                           | Neutral hover throttle value                  |
| `DRONE_TRIM_AIL`                   | `164`                           | Aileron trim value                            |
| `DRONE_TRIM_ELE`                   | `128`                           | Elevator trim value                           |
| `DRONE_TRIM_RUDD`                  | `128`                           | Rudder trim value                             |
| `DRONE_SEND_INTERVAL`              | `0.04`                          | Delay between drone command packets           |
| `DRONE_STREAM_TOKEN_TTL_SECONDS`   | `180`                           | Live stream token lifetime                    |

## Drone Mission Control

The drone page depends on the API being able to reach the drone over the
drone's Wi-Fi/network. In normal development or demos where that network is not
connected, the page shows a network guidance modal and keeps mission, photo, and
emergency controls from firing against an unreachable drone.

To use the live drone workflow:

1. Connect the API host machine to the drone network.
2. Confirm the drone settings in `.env` match the device.
3. Open the drone page and use the refresh action to reconnect.

## Development

### API (FastAPI)

The API code is mounted as a volume, so changes will auto-reload.

### Web (React)

The web code is mounted as a volume with hot module replacement enabled.
