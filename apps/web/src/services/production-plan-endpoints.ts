import api from "./axios-config";
import {
  ProductionPlan,
  ProductionPlanBulkCreateDTO,
  ProductionPlanCreateDTO,
  ProductionPlanUpdateDTO,
} from "@/models/ProductionPlan";

export const getProductionPlans = (from: string, to: string) => {
  return api.get<ProductionPlan[]>("/production-plans", { params: { from, to } });
};

export const createProductionPlan = (dto: ProductionPlanCreateDTO) => {
  return api.post<ProductionPlan>("/production-plans", dto);
};

export const createProductionPlansBulk = (dto: ProductionPlanBulkCreateDTO) => {
  return api.post<ProductionPlan[]>("/production-plans/bulk", dto);
};

export const updateProductionPlan = (planId: number, dto: ProductionPlanUpdateDTO) => {
  return api.patch<ProductionPlan>(`/production-plans/${planId}`, dto);
};

export const deleteProductionPlan = (planId: number) => {
  return api.delete(`/production-plans/${planId}`);
};
