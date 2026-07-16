import api from "./axios-config";
import { Snapshot } from "../models/Snapshot";
import {
  AiSnapshotAnalyzeResponseDTO,
  AiSnapshotCreateDTO,
  DroneSnapshotAnalyzeResponseDTO,
  DroneSnapshotCreateDTO,
  SnapshotCreateDTO,
  SnapshotItemCreateDTO,
} from "../dtos/SnapshotDTO";

export const getSnapshots = () => {
  return api.get<Snapshot[]>("/snapshots/");
};

export const createSnapshot = (dto: SnapshotCreateDTO) => {
  return api.post<Snapshot>("/snapshots/", dto);
};

export const addSnapshotItem = (dto: SnapshotItemCreateDTO) => {
  return api.post("/snapshots/items", dto);
};

export const analyzeAiSnapshot = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<AiSnapshotAnalyzeResponseDTO>("/snapshots/ai/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const createAiSnapshot = (dto: AiSnapshotCreateDTO) => {
  return api.post<Snapshot>("/snapshots/ai/create", dto);
};

export const analyzeDroneSnapshot = (imagePaths: string[]) => {
  return api.post<DroneSnapshotAnalyzeResponseDTO>("/snapshots/drone/analyze", {
    image_paths: imagePaths,
  });
};

export const createDroneSnapshot = (dto: DroneSnapshotCreateDTO) => {
  return api.post<Snapshot>("/snapshots/drone/create", dto);
};
