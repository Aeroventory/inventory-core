import { Product } from "./Product";

export interface InventoryBox {
  id: number;
  box_code: string;
  product_id: number;
  quantity: number;
  box_date: string;
  is_active: boolean;
  created_at: string;
  removed_at?: string | null;
  product: Product;
}

export interface InventoryBoxCreateDTO {
  product_id: number;
  quantity: number;
  box_date: string;
  box_code?: string | null;
}

export interface InventoryBoxUpdateDTO {
  product_id?: number;
  quantity?: number;
  box_date?: string;
  box_code?: string | null;
  is_active?: boolean;
}
