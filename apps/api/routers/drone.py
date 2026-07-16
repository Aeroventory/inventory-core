from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, status, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from db.session import get_db

from core.config import settings
from schemas.drone import (
    DroneDefaultMissionResponse,
    DroneMissionRequest,
    DroneMissionStartResponse,
    DronePhotoResponse,
)
from services.drone_mission import DEFAULT_SCRIPT, MissionController
from services.drone_runtime import DroneConfig, DroneRuntime, mjpeg_frame_generator
from services.file_service import UPLOADS_DIR
from services.media_service import register_media_asset_from_local

router = APIRouter(prefix="/drone", tags=["Drone"])


def _runtime_from_settings() -> DroneRuntime:
    return DroneRuntime(
        DroneConfig(
            host=settings.DRONE_HOST,
            port=settings.DRONE_RTSP_PORT,
            url=settings.DRONE_RTSP_URL,
            client_port_base=settings.DRONE_CLIENT_PORT_BASE,
            verbose_rtsp=settings.DRONE_VERBOSE_RTSP,
            speed=settings.DRONE_SPEED,
            axis_delta=settings.DRONE_AXIS_DELTA,
            hover_throttle=settings.DRONE_HOVER_THROTTLE,
            trim_ail=settings.DRONE_TRIM_AIL,
            trim_ele=settings.DRONE_TRIM_ELE,
            trim_rudd=settings.DRONE_TRIM_RUDD,
            send_interval=settings.DRONE_SEND_INTERVAL,
            capture_dir=str(UPLOADS_DIR / "drone"),
        )
    )


runtime = _runtime_from_settings()
mission_controller = MissionController(runtime)


def close_drone_runtime() -> None:
    runtime.close()


@router.get("/status")
def drone_status() -> dict[str, object]:
    return runtime.status()


@router.post("/connect")
async def connect_drone() -> dict[str, object]:
    try:
        await asyncio.to_thread(runtime.ensure_started)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return mission_controller.status()


@router.get("/mission/default", response_model=DroneDefaultMissionResponse)
def default_mission() -> dict[str, str]:
    return {"script": DEFAULT_SCRIPT}


@router.post("/mission", response_model=DroneMissionStartResponse)
def start_mission(request: DroneMissionRequest) -> dict[str, object]:
    return mission_controller.start(request.script)


@router.get("/mission/status")
def mission_status() -> dict[str, object]:
    return mission_controller.status()


@router.post("/emergency")
def emergency() -> dict[str, object]:
    return mission_controller.emergency()


@router.post("/photo", response_model=DronePhotoResponse)
async def capture_photo(db: Session = Depends(get_db)) -> DronePhotoResponse:
    try:
        photo = await asyncio.to_thread(runtime.capture_photo)
        await asyncio.to_thread(register_media_asset_from_local, db, photo.file_path)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return DronePhotoResponse(file_path=photo.file_path, url=photo.url)


@router.get("/stream.mjpg")
async def drone_mjpeg_stream(request: Request) -> StreamingResponse:
    try:
        await asyncio.to_thread(runtime.ensure_started)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return StreamingResponse(
        mjpeg_frame_generator(runtime, request.is_disconnected),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.websocket("/ws/stream")
async def drone_websocket_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        await asyncio.to_thread(runtime.ensure_started)
        last_seen = 0
        while runtime.is_running():
            item = await asyncio.to_thread(runtime.wait_for_frame, last_seen, 0.5)
            if item is None:
                await websocket.send_json({"type": "heartbeat"})
                continue
            last_seen, jpeg = item
            await websocket.send_bytes(jpeg)
    except (WebSocketDisconnect, asyncio.CancelledError):
        return
    except Exception as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
