export interface ProductionPlan {
  id: number;
  product_id: number;
  target_quantity: number;
  date: string;
  created_by?: number | null;
}

export interface ProductionPlanCreateDTO {
  product_id: number;
  target_quantity: number;
  date: string;
}

export interface ProductionPlanUpdateDTO {
  product_id?: number;
  target_quantity?: number;
  date?: string;
}

export interface ProductionPlanBulkCreateDTO {
  product_id: number;
  target_quantity: number;
  from: string;
  to: string;
}
