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
