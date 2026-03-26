import { Product } from "./Product";

export interface SnapshotItem {
  id: number;
  product_id: number;
  quantity: number;
  product: Product;
}

export interface Snapshot {
  id: number;
  name: string;
  created_at: string;
  file_path: string;
  items: SnapshotItem[];
}
