export interface SnapshotCreateDTO {
  name: string;
  file_path?: string | null;
  snapshot_date: string;
  is_manual: boolean;
}

export interface SnapshotItemCreateDTO {
  product_id: number;
  snapshot_id: number;
  quantity: number;
  confidence_score?: number | null;
}
