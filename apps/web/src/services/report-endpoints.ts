import api from "./axios-config";
import {
  DailyDeltaResponse,
  PlanVsActualResponse,
  StockSummaryResponse,
} from "@/models/Report";

export const getStockSummary = () => {
  return api.get<StockSummaryResponse>("/reports/stock-summary");
};

export const getDailyDelta = (date: string) => {
  return api.get<DailyDeltaResponse>("/reports/daily-delta", { params: { date } });
};

export const getPlanVsActual = (from: string, to: string) => {
  return api.get<PlanVsActualResponse>("/reports/plan-vs-actual", {
    params: { from, to },
  });
};
