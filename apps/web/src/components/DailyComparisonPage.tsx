import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, CalendarDays, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DailyDeltaItem, DailyDeltaResponse } from "@/models/Report";
import { getDailyDelta } from "@/services/report-endpoints";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function confidenceTone(confidence?: number | null): "green" | "warning" | "danger" | "neutral" {
  if (confidence == null) return "neutral";
  if (confidence >= 0.85) return "green";
  if (confidence >= 0.65) return "warning";
  return "danger";
}

function deltaTone(item: DailyDeltaItem): "green" | "danger" | "neutral" {
  if (item.delta > 0) return "green";
  if (item.delta < 0) return "danger";
  return "neutral";
}

export default function DailyComparisonPage() {
  const { i18n, t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDate = searchParams.get("date") || todayIso();
  const [report, setReport] = useState<DailyDeltaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (value: string) => {
    return new Date(`${value}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage);
  };

  const loadReport = async (date: string) => {
    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const response = await getDailyDelta(date);
      setReport(response.data);
    } catch (loadError) {
      const status = (loadError as { response?: { status?: number } }).response?.status;
      setReport(null);
      if (status === 404) {
        setNotFound(true);
      } else {
        const message = t("reportsDaily.errors.load");
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport(selectedDate);
  }, [selectedDate]);

  const totals = useMemo(() => {
    const items = report?.items ?? [];
    return {
      increases: items.reduce((sum, item) => sum + item.added_quantity, 0),
      decreases: items.reduce((sum, item) => sum + item.removed_quantity, 0),
      unchanged: items.filter((item) => item.delta === 0).length,
    };
  }, [report]);

  const handleDateChange = (date: string) => {
    setSearchParams({ date });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge tone="blue">{t("reportsDaily.badge")}</Badge>
          <h1 className="mt-3 text-3xl font-light text-[#10231B]">{t("reportsDaily.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">{t("reportsDaily.description")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="date"
            value={selectedDate}
            onChange={(event) => handleDateChange(event.target.value)}
            leftSlot={<CalendarDays size={16} />}
            aria-label={t("reportsDaily.dateLabel")}
          />
          <Button variant="secondary" onClick={() => void loadReport(selectedDate)} disabled={loading}>
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
          <p className="text-sm font-medium text-[#5B6B63]">{t("reportsDaily.metrics.increases")}</p>
          <p className="mt-1 text-3xl font-medium text-[#00684A]">{loading ? "..." : totals.increases}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-[#5B6B63]">{t("reportsDaily.metrics.decreases")}</p>
          <p className="mt-1 text-3xl font-medium text-[#C2410C]">{loading ? "..." : totals.decreases}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-[#5B6B63]">{t("reportsDaily.metrics.unchanged")}</p>
          <p className="mt-1 text-3xl font-medium text-[#10231B]">{loading ? "..." : totals.unchanged}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("reportsDaily.table.title")}</CardTitle>
          <CardDescription>
            {report
              ? t("reportsDaily.table.descriptionWithDates", {
                  date: formatDate(report.date),
                  baseline: formatDate(report.baseline_date),
                })
              : t("reportsDaily.table.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <EmptyState icon={BarChart3} title={t("reportsDaily.loadingTitle")} description={t("reportsDaily.loadingDescription")} />
          ) : notFound ? (
            <EmptyState icon={BarChart3} title={t("reportsDaily.emptyTitle")} description={t("reportsDaily.emptyDescription", { date: formatDate(selectedDate) })} />
          ) : !report || report.items.length === 0 ? (
            <EmptyState icon={BarChart3} title={t("reportsDaily.noRowsTitle")} description={t("reportsDaily.noRowsDescription")} />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#D9E4DD]">
              <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                    {[
                      t("common.labels.product"),
                      t("common.labels.sku"),
                      t("reportsDaily.table.yesterday"),
                      t("reportsDaily.table.today"),
                      t("reportsDaily.table.added"),
                      t("reportsDaily.table.removed"),
                      t("common.labels.delta"),
                      t("common.labels.confidence"),
                      t("common.labels.status"),
                      t("reportsDaily.table.boxes"),
                    ].map((heading) => (
                      <th key={heading} className="border-b border-[#D9E4DD] px-4 py-3">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {report.items.map((item) => (
                    <tr
                      key={item.product.id}
                      className={cn(
                        "transition hover:bg-[#F7FAF8]",
                        item.delta > 0 && "bg-[#F4FBF7]",
                        item.delta < 0 && "bg-[#FFF7F4]",
                      )}
                    >
                      <td className="border-b border-[#D9E4DD] px-4 py-3 font-semibold text-[#10231B]">{item.product.name}</td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3 text-[#5B6B63]">{item.product.sku}</td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">{item.previous_quantity}</td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">{item.current_quantity}</td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        <Badge tone={item.added_quantity > 0 ? "green" : "neutral"}>+{item.added_quantity}</Badge>
                      </td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        <Badge tone={item.removed_quantity > 0 ? "danger" : "neutral"}>-{item.removed_quantity}</Badge>
                      </td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        <Badge tone={deltaTone(item)}>{item.delta > 0 ? `+${item.delta}` : item.delta}</Badge>
                      </td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        <Badge tone={confidenceTone(item.confidence_score)}>
                          {item.confidence_score == null
                            ? t("common.badges.confidencePending")
                            : t("common.badges.confidencePercent", { value: Math.round(item.confidence_score * 100) })}
                        </Badge>
                      </td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        <Badge tone={deltaTone(item)}>{t(`reportsDaily.status.${item.status}`)}</Badge>
                      </td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        <details className="min-w-[210px]">
                          <summary className="cursor-pointer text-xs font-semibold text-[#00684A]">
                            {t("reportsDaily.table.boxDetails")}
                          </summary>
                          <div className="mt-2 space-y-2">
                            {item.added_boxes.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase text-[#00684A]">{t("reportsDaily.table.added")}</p>
                                {item.added_boxes.map((box) => (
                                  <p key={`added-${box.box_id}`} className="mt-1 text-xs text-[#5B6B63]">
                                    {box.box_code} · +{box.quantity}
                                  </p>
                                ))}
                              </div>
                            )}
                            {item.removed_boxes.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase text-[#C2410C]">{t("reportsDaily.table.removed")}</p>
                                {item.removed_boxes.map((box) => (
                                  <p key={`removed-${box.box_id}`} className="mt-1 text-xs text-[#5B6B63]">
                                    {box.box_code} · -{box.quantity}
                                  </p>
                                ))}
                              </div>
                            )}
                            {item.added_boxes.length === 0 && item.removed_boxes.length === 0 && (
                              <p className="text-xs text-[#5B6B63]">{t("reportsDaily.table.noBoxChanges")}</p>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
