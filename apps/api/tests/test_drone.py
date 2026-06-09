from types import SimpleNamespace
import time

import pytest
from fastapi import HTTPException

import routers.drone as drone_router
from services.drone_mission import MissionController, parse_mission_script


def register_first_admin(client, username="admin", password="secret-password"):
    response = client.post(
        "/auth/register",
        json={"username": username, "password": password, "role": "admin"},
    )
    assert response.status_code == 201


def login(client, username, password):
    response = client.post(
        "/auth/login", data={"username": username, "password": password}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def register_user(client, admin_token, username, password, role):
    response = client.post(
        "/auth/register",
        json={"username": username, "password": password, "role": role},
        headers=auth_headers(admin_token),
    )
    assert response.status_code == 201


def test_parse_mission_script_accepts_comments_and_commands():
    steps = parse_mission_script(
        """
        # warmup
        takeoff 0.06
        wait 1 # hold
        photo
        emergency
        """
    )

    assert [step.command for step in steps] == ["takeoff", "wait", "photo", "emergency"]
    assert steps[0].seconds == 0.06
    assert steps[1].seconds == 1.0
    assert steps[2].seconds is None


@pytest.mark.parametrize(
    ("script", "detail"),
    [
        ("dance 1", "unsupported command"),
        ("wait", "requires seconds"),
        ("wait -1", "seconds cannot be negative"),
        ("# empty only", "Mission script is empty"),
    ],
)
def test_parse_mission_script_rejects_invalid_scripts(script, detail):
    with pytest.raises(HTTPException) as exc_info:
        parse_mission_script(script)

    assert exc_info.value.status_code == 400
    assert detail in exc_info.value.detail


def test_drone_routes_require_auth(client):
    assert client.get("/drone/status").status_code == 401
    assert client.post("/drone/connect").status_code == 401
    assert client.post("/drone/mission", json={"script": "wait 1"}).status_code == 401
    assert client.post("/drone/photo").status_code == 401
    assert client.post("/drone/stream-token").status_code == 401


def test_all_signed_in_roles_can_read_drone_status(client):
    register_first_admin(client)
    admin_token = login(client, "admin", "secret-password")
    register_user(client, admin_token, "planner", "planner-password", "planner")
    register_user(client, admin_token, "viewer", "viewer-password", "viewer")

    for username, password in [
        ("admin", "secret-password"),
        ("planner", "planner-password"),
        ("viewer", "viewer-password"),
    ]:
        token = login(client, username, password)
        response = client.get("/drone/status", headers=auth_headers(token))

        assert response.status_code == 200
        assert response.json()["connected"] is False


def test_mission_and_emergency_use_controller_without_drone_hardware(client, monkeypatch):
    register_first_admin(client)
    token = login(client, "admin", "secret-password")

    class FakeMissionController:
        def start(self, script):
            assert script == "wait 1"
            return {"state": "running", "steps": 1}

        def status(self):
            return {"state": "running", "message": "fake"}

        def emergency(self):
            return {"state": "emergency", "message": "Emergency requested"}

    monkeypatch.setattr(drone_router, "mission_controller", FakeMissionController())

    headers = auth_headers(token)
    start = client.post("/drone/mission", json={"script": "wait 1"}, headers=headers)
    status = client.get("/drone/mission/status", headers=headers)
    emergency = client.post("/drone/emergency", headers=headers)

    assert start.status_code == 200
    assert start.json() == {"state": "running", "steps": 1}
    assert status.json()["state"] == "running"
    assert emergency.json()["state"] == "emergency"


def test_photo_endpoint_returns_saved_path_without_drone_hardware(client, monkeypatch):
    register_first_admin(client)
    token = login(client, "admin", "secret-password")

    class FakeRuntime:
        def capture_photo(self):
            return SimpleNamespace(file_path="drone/photo.jpg", url="/uploads/drone/photo.jpg")

    monkeypatch.setattr(drone_router, "runtime", FakeRuntime())

    response = client.post("/drone/photo", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json() == {
        "file_path": "drone/photo.jpg",
        "url": "/uploads/drone/photo.jpg",
    }


def test_mission_status_tracks_multiple_photos():
    class FakeRuntime:
        def __init__(self):
            self.config = SimpleNamespace(axis_delta=90)
            self.photo_count = 0

        def status(self):
            return {"connected": True}

        def ensure_started(self):
            return None

        def neutral_for(self, seconds, label=""):
            return None

        def send_for(self, state, seconds, label=""):
            return None

        def capture_photo(self):
            self.photo_count += 1
            return SimpleNamespace(
                file_path=f"drone/photo-{self.photo_count}.jpg",
                url=f"/uploads/drone/photo-{self.photo_count}.jpg",
            )

        def emergency(self, seconds=1.0):
            return None

    controller = MissionController(FakeRuntime())
    response = controller.start("photo\nphoto")
    assert response == {"state": "running", "steps": 2}

    deadline = time.time() + 2
    status = controller.status()
    while status["state"] == "running" and time.time() < deadline:
        time.sleep(0.01)
        status = controller.status()

    assert status["state"] == "done"
    assert status["last_photo_path"] == "drone/photo-2.jpg"
    assert status["last_photo_url"] == "/uploads/drone/photo-2.jpg"
    assert status["photo_paths"] == ["drone/photo-1.jpg", "drone/photo-2.jpg"]
    assert status["photo_urls"] == [
        "/uploads/drone/photo-1.jpg",
        "/uploads/drone/photo-2.jpg",
    ]


def test_connect_endpoint_attempts_drone_connection(client, monkeypatch):
    register_first_admin(client)
    token = login(client, "admin", "secret-password")

    class FakeRuntime:
        def __init__(self):
            self.started = False

        def ensure_started(self):
            self.started = True

    class FakeMissionController:
        def status(self):
            return {
                "state": "idle",
                "drone": {"connected": fake_runtime.started},
            }

    fake_runtime = FakeRuntime()
    monkeypatch.setattr(drone_router, "runtime", fake_runtime)
    monkeypatch.setattr(drone_router, "mission_controller", FakeMissionController())

    response = client.post("/drone/connect", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["drone"]["connected"] is True


def test_stream_token_endpoint_and_mjpeg_validation(client, monkeypatch):
    register_first_admin(client)
    token = login(client, "admin", "secret-password")

    invalid = client.get("/drone/stream.mjpg?token=bad-token")
    assert invalid.status_code == 401

    class FakeRuntime:
        def ensure_started(self):
            return None

    def fake_generator(_runtime):
        yield b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: 4\r\n\r\ntest\r\n"

    monkeypatch.setattr(drone_router, "runtime", FakeRuntime())
    monkeypatch.setattr(drone_router, "mjpeg_frame_generator", fake_generator)

    token_response = client.post("/drone/stream-token", headers=auth_headers(token))
    assert token_response.status_code == 200
    assert token_response.json()["ttl_seconds"] == 180
    stream_token = token_response.json()["token"]
    assert drone_router.stream_tokens.validate(stream_token) is True

    # Issue a second token for the endpoint because validation is intentionally reusable
    # but this keeps the test independent of the direct validation assertion above.
    stream_token = client.post("/drone/stream-token", headers=auth_headers(token)).json()["token"]
    response = client.get(f"/drone/stream.mjpg?token={stream_token}")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("multipart/x-mixed-replace")
    assert b"test" in response.content
