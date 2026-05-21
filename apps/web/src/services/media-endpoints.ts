import api from "./axios-config";
import { Product } from "@/models/Product";
import { Snapshot } from "@/models/Snapshot";
import { MediaAsset } from "@/models/Media";

export interface MediaAttachmentInput {
  media_asset_id: number;
  sort_order?: number;
  is_primary?: boolean;
}

export interface MediaAttachmentUpdateDTO {
  attachments: MediaAttachmentInput[];
}

export const getMediaAssets = () => {
  return api.get<MediaAsset[]>("/media/");
};

export const uploadMediaAssets = (files: File[]) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return api.post<MediaAsset[]>("/media/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deleteMediaAsset = (mediaAssetId: number) => {
  return api.delete(`/media/${mediaAssetId}`);
};

export const updateProductMedia = (productId: number, dto: MediaAttachmentUpdateDTO) => {
  return api.put<Product>(`/products/${productId}/media`, dto);
};

export const updateSnapshotMedia = (snapshotId: number, dto: MediaAttachmentUpdateDTO) => {
  return api.put<Snapshot>(`/snapshots/${snapshotId}/media`, dto);
};
