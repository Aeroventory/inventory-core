"""
FastAPI mission endpoints for the HTJR drone.

Run this in the destination app with:
    uvicorn drone_mission_backend:app --host 0.0.0.0 --port 8000

This imports the standalone runtime from drone_stream_backend.py, not the old
fixed_drone.py / auto_mission.py scripts.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from fastapi import HTTPException
from pydantic import BaseModel

from drone_stream_backend import HtjrPacketState, app, runtime


DEFAULT_SCRIPT = """takeoff 0.06
wait 2
back 0.3
yaw_left 0.3
neutral 0.5
yaw_right 0.5
wait 0.6
photo
down 3
emergency 1
"""


class MissionRequest(BaseModel):
    script: str


@dataclass
class MissionStep:
    command: str
    seconds: float | None
    line_no: int
    raw: str


class MissionController:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.abort_event = threading.Event()
        self.thread: threading.Thread | None = None
        self.state = "idle"
        self.message = ""
        self.current_step = ""
        self.last_photo_path: str | None = None
        self.started_at: float | None = None
        self.finished_at: float | None = None

    def status(self) -> dict[str, object]:
        with self.lock:
            return {
                "state": self.state,
                "message": self.message,
                "current_step": self.current_step,
                "last_photo_path": self.last_photo_path,
                "started_at": self.started_at,
                "finished_at": self.finished_at,
                "drone": runtime.status(),
            }

    def start(self, script: str) -> dict[str, object]:
        steps = parse_mission_script(script)
        with self.lock:
            if self.thread is not None and self.thread.is_alive():
                raise HTTPException(status_code=409, detail="A mission is already running")
            self.abort_event.clear()
            self.state = "running"
            self.message = "Mission started"
            self.current_step = ""
            self.last_photo_path = None
            self.started_at = time.time()
            self.finished_at = None
            self.thread = threading.Thread(target=self._run, args=(steps,), daemon=True)
            self.thread.start()
        return {"state": "running", "steps": len(steps)}

    def emergency(self) -> dict[str, object]:
        self.abort_event.set()
        with self.lock:
            self.state = "emergency"
            self.message = "Emergency requested"
            self.current_step = "emergency"
        try:
            runtime.emergency(1.0)
        finally:
            with self.lock:
                self.finished_at = time.time()
        return self.status()

    def _run(self, steps: list[MissionStep]) -> None:
        try:
            runtime.ensure_started()
            runtime.neutral_for(0.30, "mission warmup")
            for step in steps:
                if self.abort_event.is_set():
                    with self.lock:
                        self.state = "emergency"
                        self.message = "Mission aborted by emergency"
                    return
                with self.lock:
                    self.current_step = f"line {step.line_no}: {step.raw}"
                self._execute_step(step)
            with self.lock:
                if self.state != "emergency":
                    self.state = "done"
                    self.message = "Mission complete"
        except Exception as exc:
            with self.lock:
                self.state = "error"
                self.message = str(exc)
        finally:
            with self.lock:
                self.finished_at = time.time()

    def _execute_step(self, step: MissionStep) -> None:
        seconds = step.seconds
        command = step.command

        if command == "takeoff":
            runtime.send_for(HtjrPacketState(flyup=True), seconds if seconds is not None else 0.06, "takeoff")
        elif command == "wait":
            runtime.neutral_for(require_seconds(step), "wait")
        elif command == "neutral":
            runtime.neutral_for(require_seconds(step), "neutral")
        elif command == "back":
            runtime.send_for(
                HtjrPacketState(ele=128 - runtime.config.axis_delta),
                require_seconds(step),
                "back",
            )
        elif command == "yaw_left":
            runtime.send_for(
                HtjrPacketState(rudd=128 - runtime.config.axis_delta),
                require_seconds(step),
                "yaw_left",
            )
        elif command == "yaw_right":
            runtime.send_for(
                HtjrPacketState(rudd=128 + runtime.config.axis_delta),
                require_seconds(step),
                "yaw_right",
            )
        elif command == "down":
            runtime.send_for(HtjrPacketState(flydown=True), require_seconds(step), "down")
        elif command == "photo":
            path = runtime.capture_photo()
            with self.lock:
                self.last_photo_path = path
                self.message = f"Saved photo: {path}"
        elif command == "emergency":
            runtime.emergency(seconds if seconds is not None else 1.0)
        else:  # parse_mission_script should prevent this.
            raise ValueError(f"Unsupported mission command: {command}")


mission_controller = MissionController()


def require_seconds(step: MissionStep) -> float:
    if step.seconds is None:
        raise ValueError(f"Line {step.line_no}: {step.command} requires seconds")
    return step.seconds


def parse_mission_script(script: str) -> list[MissionStep]:
    valid_commands = {
        "takeoff",
        "wait",
        "back",
        "yaw_left",
        "yaw_right",
        "down",
        "photo",
        "emergency",
        "neutral",
    }
    optional_seconds = {"takeoff", "emergency", "photo"}
    steps: list[MissionStep] = []

    for line_no, raw_line in enumerate(script.splitlines(), start=1):
        raw = raw_line.strip()
        if not raw or raw.startswith("#"):
            continue
        if "#" in raw:
            raw = raw.split("#", 1)[0].strip()
        parts = raw.split()
        command = parts[0].lower()
        if command not in valid_commands:
            raise HTTPException(
                status_code=400,
                detail=f"Line {line_no}: unsupported command {command!r}",
            )
        if len(parts) > 2:
            raise HTTPException(status_code=400, detail=f"Line {line_no}: too many arguments")
        seconds: float | None = None
        if len(parts) == 2:
            try:
                seconds = float(parts[1])
            except ValueError as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Line {line_no}: seconds must be a number",
                ) from exc
            if seconds < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Line {line_no}: seconds cannot be negative",
                )
        elif command not in optional_seconds:
            raise HTTPException(
                status_code=400,
                detail=f"Line {line_no}: {command} requires seconds",
            )
        steps.append(MissionStep(command=command, seconds=seconds, line_no=line_no, raw=raw))

    if not steps:
        raise HTTPException(status_code=400, detail="Mission script is empty")
    return steps


@app.get("/api/drone/mission/default")
def default_mission() -> dict[str, str]:
    return {"script": DEFAULT_SCRIPT}


@app.post("/api/drone/mission")
def start_mission(request: MissionRequest) -> dict[str, object]:
    return mission_controller.start(request.script)


@app.get("/api/drone/mission/status")
def mission_status() -> dict[str, object]:
    return mission_controller.status()


@app.post("/api/drone/emergency")
def emergency() -> dict[str, object]:
    return mission_controller.emergency()
