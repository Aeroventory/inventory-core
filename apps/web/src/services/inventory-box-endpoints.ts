import api from "./axios-config";
import {
  InventoryBox,
  InventoryBoxCreateDTO,
  InventoryBoxUpdateDTO,
} from "@/models/InventoryBox";

export const getInventoryBoxes = (params?: {
  active?: boolean;
  product_id?: number;
  from?: string;
  to?: string;
}) => {
  return api.get<InventoryBox[]>("/inventory-boxes", { params });
};

export const createInventoryBox = (dto: InventoryBoxCreateDTO) => {
  return api.post<InventoryBox>("/inventory-boxes", dto);
};

export const updateInventoryBox = (boxId: number, dto: InventoryBoxUpdateDTO) => {
  return api.patch<InventoryBox>(`/inventory-boxes/${boxId}`, dto);
};

export const deleteInventoryBox = (boxId: number) => {
  return api.delete(`/inventory-boxes/${boxId}`);
};
