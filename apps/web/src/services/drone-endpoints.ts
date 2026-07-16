import api from "./axios-config";
import type {
  DroneDefaultMissionResponse,
  DroneMissionStartResponse,
  DroneMissionStatus,
  DronePhotoResponse,
  DroneRuntimeStatus,
} from "@/models/Drone";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8003";

function apiUrl(path: string) {
  return new URL(path, API_BASE_URL).toString();
}

export function droneMjpegUrl() {
  return apiUrl("/drone/stream.mjpg");
}

export function droneAssetUrl(path: string) {
  return new URL(path, API_BASE_URL).toString();
}

export function droneWebSocketUrl() {
  const url = new URL(apiUrl("/drone/ws/stream"));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export const getDroneStatus = () => api.get<DroneRuntimeStatus>("/drone/status");

export const connectDrone = () => api.post<DroneMissionStatus>("/drone/connect");

export const getDefaultDroneMission = () => api.get<DroneDefaultMissionResponse>("/drone/mission/default");

export const startDroneMission = (script: string) => {
  return api.post<DroneMissionStartResponse>("/drone/mission", { script });
};

export const getDroneMissionStatus = () => api.get<DroneMissionStatus>("/drone/mission/status");

export const emergencyDrone = () => api.post<DroneMissionStatus>("/drone/emergency");

export const captureDronePhoto = () => api.post<DronePhotoResponse>("/drone/photo");
