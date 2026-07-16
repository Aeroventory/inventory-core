import { Product } from "./Product";
import { MediaAsset } from "./Media";
import type { SnapshotType } from "@/dtos/SnapshotDTO";

export interface SnapshotItem {
  id: number;
  box_id: number;
  box_code: string;
  product_id: number;
  quantity: number;
  box_date: string;
  confidence_score?: number | null;
  product: Product;
}

export interface Snapshot {
  id: number;
  name: string;
  created_at: string;
  snapshot_type: SnapshotType;
  file_path?: string | null;
  images?: MediaAsset[];
  primary_image?: MediaAsset | null;
  items: SnapshotItem[];
}
