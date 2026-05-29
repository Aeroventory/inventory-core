from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse

from core.config import settings
from core.security import get_current_user
from schemas.drone import (
    DroneDefaultMissionResponse,
    DroneMissionRequest,
    DroneMissionStartResponse,
    DronePhotoResponse,
    DroneStreamTokenResponse,
)
from services.drone_mission import DEFAULT_SCRIPT, MissionController
from services.drone_runtime import DroneConfig, DroneRuntime, mjpeg_frame_generator
from services.drone_tokens import StreamTokenStore
from services.file_service import UPLOADS_DIR

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
stream_tokens = StreamTokenStore(settings.DRONE_STREAM_TOKEN_TTL_SECONDS)


def close_drone_runtime() -> None:
    runtime.close()


@router.get("/status")
def drone_status(_current_user=Depends(get_current_user)) -> dict[str, object]:
    return runtime.status()


@router.post("/connect")
async def connect_drone(_current_user=Depends(get_current_user)) -> dict[str, object]:
    try:
        await asyncio.to_thread(runtime.ensure_started)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return mission_controller.status()


@router.get("/mission/default", response_model=DroneDefaultMissionResponse)
def default_mission(_current_user=Depends(get_current_user)) -> dict[str, str]:
    return {"script": DEFAULT_SCRIPT}


@router.post("/mission", response_model=DroneMissionStartResponse)
def start_mission(
    request: DroneMissionRequest,
    _current_user=Depends(get_current_user),
) -> dict[str, object]:
    return mission_controller.start(request.script)


@router.get("/mission/status")
def mission_status(_current_user=Depends(get_current_user)) -> dict[str, object]:
    return mission_controller.status()


@router.post("/emergency")
def emergency(_current_user=Depends(get_current_user)) -> dict[str, object]:
    return mission_controller.emergency()


@router.post("/photo", response_model=DronePhotoResponse)
async def capture_photo(_current_user=Depends(get_current_user)) -> DronePhotoResponse:
    try:
        photo = await asyncio.to_thread(runtime.capture_photo)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return DronePhotoResponse(file_path=photo.file_path, url=photo.url)


@router.post("/stream-token", response_model=DroneStreamTokenResponse)
def create_stream_token(_current_user=Depends(get_current_user)) -> DroneStreamTokenResponse:
    token, expires_at = stream_tokens.issue()
    return DroneStreamTokenResponse(
        token=token,
        expires_at=expires_at,
        ttl_seconds=stream_tokens.ttl_seconds,
    )


@router.get("/stream.mjpg")
async def drone_mjpeg_stream(token: str = Query("")) -> StreamingResponse:
    if not stream_tokens.validate(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid stream token")
    try:
        await asyncio.to_thread(runtime.ensure_started)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return StreamingResponse(
        mjpeg_frame_generator(runtime),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.websocket("/ws/stream")
async def drone_websocket_stream(websocket: WebSocket, token: str = Query("")) -> None:
    if not stream_tokens.validate(token):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    try:
        await asyncio.to_thread(runtime.ensure_started)
        last_seen = 0
        while True:
            item = await asyncio.to_thread(runtime.wait_for_frame, last_seen, 5.0)
            if item is None:
                await websocket.send_json({"type": "heartbeat"})
                continue
            last_seen, jpeg = item
            await websocket.send_bytes(jpeg)
    except WebSocketDisconnect:
        return
    except Exception as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
