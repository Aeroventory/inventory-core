import api from "./axios-config";
import { Snapshot } from "../models/Snapshot";
import {
  AiSnapshotAnalyzeResponseDTO,
  AiSnapshotCreateDTO,
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
