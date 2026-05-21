import { Product } from "@/models/Product";

export type DeltaStatus = "added" | "consumed" | "unchanged";

export interface DeltaBoxItem {
  box_id: number;
  box_code: string;
  product_id: number;
  quantity: number;
  box_date: string;
  confidence_score?: number | null;
}

export interface DailyDeltaItem {
  product: Product;
  previous_quantity: number;
  current_quantity: number;
  added_quantity: number;
  removed_quantity: number;
  delta: number;
  status: DeltaStatus;
  confidence_score?: number | null;
  added_boxes: DeltaBoxItem[];
  removed_boxes: DeltaBoxItem[];
}

export interface DailyDeltaResponse {
  date: string;
  current_snapshot_id: number;
  baseline_date: string;
  baseline_snapshot_id?: number | null;
  items: DailyDeltaItem[];
}

export interface StockSummaryItem {
  product: Product;
  quantity: number;
}

export interface StockSummaryResponse {
  snapshot_id: number;
  snapshot_date: string;
  created_at: string;
  items: StockSummaryItem[];
}

export interface PlanVsActualItem {
  date: string;
  product: Product;
  planned_quantity: number;
  actual_quantity: number;
  variance: number;
  snapshot_id?: number | null;
}

export interface PlanVsActualResponse {
  from_date: string;
  to_date: string;
  items: PlanVsActualItem[];
}
