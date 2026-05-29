from pydantic import BaseModel


class DroneMissionRequest(BaseModel):
    script: str


class DroneMissionStartResponse(BaseModel):
    state: str
    steps: int


class DroneDefaultMissionResponse(BaseModel):
    script: str


class DronePhotoResponse(BaseModel):
    file_path: str
    url: str


class DroneStreamTokenResponse(BaseModel):
    token: str
    expires_at: float
    ttl_seconds: int
