export interface SnapshotCreateDTO {
  name: string;
  file_path: string;
}

export interface SnapshotItemCreateDTO {
  product_id: number;
  snapshot_id: number;
  quantity: number;
  confidence_score?: number | null;
}
