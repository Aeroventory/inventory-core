export type SnapshotType = "manual" | "AI" | "drone";

export interface SnapshotCreateDTO {
  name: string;
  file_path?: string | null;
  snapshot_date: string;
  snapshot_type?: SnapshotType;
  removed_box_ids?: number[];
}

export interface SnapshotItemCreateDTO {
  product_id: number;
  snapshot_id: number;
  quantity: number;
  confidence_score?: number | null;
}

export interface AiSnapshotRowDTO {
  product_id?: number | null;
  sku?: string | null;
  product_name?: string | null;
  box_code?: string | null;
  quantity: number;
  box_date?: string | null;
  confidence_score?: number | null;
  location_site?: string | null;
  location_aisle?: string | null;
  location_rack?: string | null;
  notes?: string | null;
}

export interface AiSnapshotBoxPreviewDTO {
  id: number;
  box_code: string;
  product_id: number;
  product_name: string;
  quantity: number;
  box_date: string;
}

export interface AiSnapshotAnalyzeResponseDTO {
  temp_filename: string;
  detections: AiSnapshotRowDTO[];
  unmatched: AiSnapshotRowDTO[];
  active_boxes: AiSnapshotBoxPreviewDTO[];
  removed_boxes: AiSnapshotBoxPreviewDTO[];
  raw_json: Record<string, unknown>;
  model_version?: string | null;
}

export interface AiSnapshotCreateDTO {
  name: string;
  snapshot_date: string;
  temp_filename: string;
  rows: AiSnapshotRowDTO[];
  confirmed_removed_box_ids: number[];
}

export interface DroneSnapshotAnalyzeResponseDTO {
  image_paths: string[];
  detections: AiSnapshotRowDTO[];
  unmatched: AiSnapshotRowDTO[];
  active_boxes: AiSnapshotBoxPreviewDTO[];
  removed_boxes: AiSnapshotBoxPreviewDTO[];
  raw_json: Record<string, unknown>;
  model_version?: string | null;
}

export interface DroneSnapshotCreateDTO {
  name: string;
  snapshot_date: string;
  image_paths: string[];
  rows: AiSnapshotRowDTO[];
  confirmed_removed_box_ids: number[];
}
