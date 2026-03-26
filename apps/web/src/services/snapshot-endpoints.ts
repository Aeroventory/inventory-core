import api from "./axios-config";
import { Snapshot } from "../models/Snapshot";
import { SnapshotCreateDTO, SnapshotItemCreateDTO } from "../dtos/SnapshotDTO";

export const getSnapshots = () => {
  return api.get<Snapshot[]>("/snapshots/");
};

export const createSnapshot = (dto: SnapshotCreateDTO) => {
  return api.post<Snapshot>("/snapshots/", dto);
};

export const addSnapshotItem = (dto: SnapshotItemCreateDTO) => {
  return api.post("/snapshots/items", dto);
};
