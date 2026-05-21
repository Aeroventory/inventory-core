import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Factory,
  PackageCheck,
  Plus,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Product } from "@/models/Product";
import { ProductionPlan } from "@/models/ProductionPlan";
import { PlanVsActualItem } from "@/models/Report";
import {
  createProductionPlan,
  createProductionPlansBulk,
  deleteProductionPlan,
  getProductionPlans,
  updateProductionPlan,
} from "@/services/production-plan-endpoints";
import { getProducts } from "@/services/product-endpoints";
import { getPlanVsActual } from "@/services/report-endpoints";

type PlanningView = "week" | "month";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number) {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function cellKey(productId: number, date: string) {
  return `${productId}:${date}`;
}

function isWholeQuantity(value: number) {
  return Number.isInteger(value) && value >= 0;
}

export default function ProductionPlanningWorkspace() {
  const { i18n, t } = useTranslation();
  const [view, setView] = useState<PlanningView>("week");
  const [windowStart, setWindowStart] = useState(todayIso());
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [actuals, setActuals] = useState<PlanVsActualItem[]>([]);
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const [bulkDraft, setBulkDraft] = useState({
    product_id: "",
    from: todayIso(),
    to: addDays(todayIso(), 6),
    target_quantity: "",
  });
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateColumns = useMemo(() => {
    const count = view === "week" ? 7 : 30;
    return Array.from({ length: count }, (_value, index) => addDays(windowStart, index));
  }, [view, windowStart]);

  const fromDate = dateColumns[0];
  const toDate = dateColumns[dateColumns.length - 1];

  const planByCell = useMemo(() => {
    return new Map(plans.map((plan) => [cellKey(plan.product_id, plan.date), plan]));
  }, [plans]);

  const productById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const plannedUnits = plans.reduce((sum, plan) => sum + plan.target_quantity, 0);
  const plannedProducts = new Set(plans.map((plan) => plan.product_id)).size;
  const maxAbsVariance = Math.max(1, ...actuals.map((item) => Math.abs(item.variance)));

  const formatDate = (dateIso: string) => {
    return new Date(`${dateIso}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage);
  };

  const formatCompactDate = (dateIso: string) => {
    return new Date(`${dateIso}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage, {
      day: "numeric",
      month: "short",
    });
  };

  const fetchPlanningData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productRes, planRes, actualRes] = await Promise.all([
        getProducts(),
        getProductionPlans(fromDate, toDate),
        getPlanVsActual(fromDate, toDate),
      ]);
      setProducts(productRes.data);
      setPlans(planRes.data);
      setActuals(actualRes.data.items);
      setCellDrafts(
        Object.fromEntries(
          planRes.data.map((plan) => [cellKey(plan.product_id, plan.date), String(plan.target_quantity)]),
        ),
      );
      if (!bulkDraft.product_id && productRes.data[0]) {
        setBulkDraft((draft) => ({ ...draft, product_id: String(productRes.data[0].id) }));
      }
    } catch {
      setError(t("productionPlan.errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPlanningData();
  }, [fromDate, toDate]);

  const handleCellBlur = async (productId: number, date: string) => {
    const key = cellKey(productId, date);
    const existing = planByCell.get(key);
    const rawValue = (cellDrafts[key] ?? "").trim();

    if (!rawValue) {
      if (!existing) return;
      setSavingCell(key);
      setError(null);
      try {
        await deleteProductionPlan(existing.id);
        await fetchPlanningData();
      } catch {
        setError(t("productionPlan.errors.saveCell"));
      } finally {
        setSavingCell(null);
      }
      return;
    }

    const targetQuantity = Number(rawValue);
    if (!isWholeQuantity(targetQuantity)) {
      setError(t("productionPlan.errors.invalidQuantity"));
      setCellDrafts((drafts) => ({
        ...drafts,
        [key]: existing ? String(existing.target_quantity) : "",
      }));
      return;
    }

    if (existing?.target_quantity === targetQuantity) return;

    setSavingCell(key);
    setError(null);
    try {
      if (existing) {
        await updateProductionPlan(existing.id, { target_quantity: targetQuantity });
      } else {
        await createProductionPlan({ product_id: productId, date, target_quantity: targetQuantity });
      }
      await fetchPlanningData();
    } catch {
      setError(t("productionPlan.errors.saveCell"));
    } finally {
      setSavingCell(null);
    }
  };

  const handleBulkSubmit = async () => {
    const productId = Number(bulkDraft.product_id);
    const targetQuantity = Number(bulkDraft.target_quantity);
    if (!productId || !bulkDraft.from || !bulkDraft.to || bulkDraft.from > bulkDraft.to) {
      setError(t("productionPlan.errors.invalidRange"));
      return;
    }
    if (!isWholeQuantity(targetQuantity)) {
      setError(t("productionPlan.errors.invalidQuantity"));
      return;
    }

    setBulkSaving(true);
    setError(null);
    try {
      await createProductionPlansBulk({
        product_id: productId,
        from: bulkDraft.from,
        to: bulkDraft.to,
        target_quantity: targetQuantity,
      });
      setWindowStart(bulkDraft.from);
      await fetchPlanningData();
    } catch {
      setError(t("productionPlan.errors.bulk"));
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge tone="purple">{t("productionPlan.badge")}</Badge>
          <h1 className="mt-3 text-3xl font-light text-[#10231B]">{t("productionPlan.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">{t("productionPlan.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={view === "week" ? "soft" : "secondary"} onClick={() => setView("week")}>
            {t("productionPlan.view.week")}
          </Button>
          <Button variant={view === "month" ? "soft" : "secondary"} onClick={() => setView("month")}>
            {t("productionPlan.view.month")}
          </Button>
          <Button variant="secondary" size="icon" onClick={() => setWindowStart(addDays(windowStart, view === "week" ? -7 : -30))} aria-label={t("productionPlan.actions.previousWindow")}>
            <ChevronLeft size={17} />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => setWindowStart(addDays(windowStart, view === "week" ? 7 : 30))} aria-label={t("productionPlan.actions.nextWindow")}>
            <ChevronRight size={17} />
          </Button>
          <Button variant="secondary" onClick={() => void fetchPlanningData()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
            {t("common.actions.refresh")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-2xl bg-[#00684A] text-white">
            <Factory size={19} />
          </div>
          <p className="text-sm font-medium text-[#5B6B63]">{t("productionPlan.metrics.products.label")}</p>
          <p className="mt-1 text-3xl font-medium text-[#10231B]">{loading ? "..." : plannedProducts}</p>
          <p className="mt-2 text-xs font-semibold text-[#5B6B63]">{t("productionPlan.metrics.products.description")}</p>
        </Card>
        <Card className="p-4">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-2xl bg-[#2563EB] text-white">
            <PackageCheck size={19} />
          </div>
          <p className="text-sm font-medium text-[#5B6B63]">{t("productionPlan.metrics.plannedUnits.label")}</p>
          <p className="mt-1 text-3xl font-medium text-[#10231B]">{loading ? "..." : plannedUnits}</p>
          <p className="mt-2 text-xs font-semibold text-[#5B6B63]">{t("productionPlan.metrics.plannedUnits.description")}</p>
        </Card>
        <Card className="p-4">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-2xl bg-[#B7791F] text-white">
            <CalendarDays size={19} />
          </div>
          <p className="text-sm font-medium text-[#5B6B63]">{t("productionPlan.metrics.window.label")}</p>
          <p className="mt-1 text-2xl font-medium text-[#10231B]">{formatCompactDate(fromDate)} - {formatCompactDate(toDate)}</p>
          <p className="mt-2 text-xs font-semibold text-[#5B6B63]">{t("productionPlan.metrics.window.description")}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("productionPlan.bulk.title")}</CardTitle>
          <CardDescription>{t("productionPlan.bulk.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_auto]">
            <label className="relative">
              <span className="sr-only">{t("common.labels.product")}</span>
              <select
                value={bulkDraft.product_id}
                onChange={(event) => setBulkDraft({ ...bulkDraft, product_id: event.target.value })}
                className="h-10 w-full rounded-xl border border-[#D9E4DD] bg-white px-3 text-sm font-semibold text-[#10231B] outline-none transition focus:border-[#00684A] focus:ring-4 focus:ring-[rgba(0,104,74,0.12)]"
              >
                <option value="">{t("productionPlan.bulk.productPlaceholder")}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </label>
            <Input type="date" value={bulkDraft.from} onChange={(event) => setBulkDraft({ ...bulkDraft, from: event.target.value })} />
            <Input type="date" value={bulkDraft.to} onChange={(event) => setBulkDraft({ ...bulkDraft, to: event.target.value })} />
            <Input
              type="number"
              min={0}
              step={1}
              value={bulkDraft.target_quantity}
              onChange={(event) => setBulkDraft({ ...bulkDraft, target_quantity: event.target.value })}
              placeholder={t("productionPlan.bulk.quantityPlaceholder")}
            />
            <Button onClick={handleBulkSubmit} disabled={bulkSaving || loading || products.length === 0}>
              <Plus size={16} />
              {bulkSaving ? t("productionPlan.actions.saving") : t("productionPlan.bulk.apply")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("productionPlan.board.title")}</CardTitle>
          <CardDescription>{t("productionPlan.board.description", { from: formatDate(fromDate), to: formatDate(toDate) })}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <EmptyState icon={ClipboardList} title={t("productionPlan.board.loadingTitle")} description={t("productionPlan.board.loadingDescription")} />
          ) : products.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t("productionPlan.board.emptyProductsTitle")} description={t("productionPlan.board.emptyProductsDescription")} />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#D9E4DD]">
              <table className="w-full border-separate border-spacing-0 text-left text-sm" style={{ minWidth: `${260 + dateColumns.length * 112}px` }}>
                <thead>
                  <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                    <th className="sticky left-0 z-10 border-b border-[#D9E4DD] bg-[#F7FAF8] px-4 py-3">{t("common.labels.product")}</th>
                    {dateColumns.map((date) => (
                      <th key={date} className="border-b border-[#D9E4DD] px-3 py-3 text-center">
                        {formatCompactDate(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-[#F7FAF8]">
                      <td className="sticky left-0 z-10 border-b border-[#D9E4DD] bg-white px-4 py-3">
                        <p className="font-semibold text-[#10231B]">{product.name}</p>
                        <p className="text-xs text-[#5B6B63]">{product.sku}</p>
                      </td>
                      {dateColumns.map((date) => {
                        const key = cellKey(product.id, date);
                        const existing = planByCell.get(key);
                        return (
                          <td key={key} className="border-b border-[#D9E4DD] px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={cellDrafts[key] ?? ""}
                              onChange={(event) => setCellDrafts((drafts) => ({ ...drafts, [key]: event.target.value }))}
                              onBlur={() => void handleCellBlur(product.id, date)}
                              className={cn(
                                "h-9 text-center",
                                existing && "border-[#B6E8CC] bg-[#F4FBF7] font-semibold",
                                savingCell === key && "opacity-60",
                              )}
                              aria-label={t("productionPlan.board.cellLabel", { product: product.name, date: formatDate(date) })}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("productionPlan.actuals.title")}</CardTitle>
          <CardDescription>{t("productionPlan.actuals.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <EmptyState icon={PackageCheck} title={t("productionPlan.actuals.loadingTitle")} description={t("productionPlan.actuals.loadingDescription")} />
          ) : actuals.length === 0 ? (
            <EmptyState icon={PackageCheck} title={t("productionPlan.actuals.emptyTitle")} description={t("productionPlan.actuals.emptyDescription")} />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#D9E4DD]">
              <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                    {[
                      t("common.labels.date"),
                      t("common.labels.product"),
                      t("common.labels.planned"),
                      t("common.labels.actual"),
                      t("common.labels.variance"),
                    ].map((heading) => (
                      <th key={heading} className="border-b border-[#D9E4DD] px-4 py-3">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {actuals.map((item) => {
                    const product = productById.get(item.product.id) ?? item.product;
                    const varianceWidth = Math.round((Math.abs(item.variance) / maxAbsVariance) * 100);
                    return (
                      <tr key={`${item.product.id}:${item.date}`} className="hover:bg-[#F7FAF8]">
                        <td className="border-b border-[#D9E4DD] px-4 py-3 text-[#5B6B63]">{formatDate(item.date)}</td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          <p className="font-semibold text-[#10231B]">{product.name}</p>
                          <p className="text-xs text-[#5B6B63]">{product.sku}</p>
                        </td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">{item.planned_quantity}</td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">{item.actual_quantity}</td>
                        <td className="border-b border-[#D9E4DD] px-4 py-3">
                          <div className="flex min-w-[220px] items-center gap-3">
                            <Badge tone={item.variance >= 0 ? "green" : "danger"}>
                              {item.variance > 0 ? `+${item.variance}` : item.variance}
                            </Badge>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF4F0]">
                              <div
                                className={cn("h-full rounded-full", item.variance >= 0 ? "bg-[#00684A]" : "bg-[#C2410C]")}
                                style={{ width: `${Math.max(8, varianceWidth)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
