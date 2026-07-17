import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  ImageIcon,
  Package,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { DailyDeltaItem, DailyDeltaResponse, StockSummaryResponse } from "@/models/Report";
import { Snapshot } from "@/models/Snapshot";
import { getDailyDelta, getStockSummary } from "@/services/report-endpoints";
import { getSnapshots } from "@/services/snapshot-endpoints";

interface HealthStatus {
  status: string;
  database: string;
}

interface DashboardPageProps {
  health: HealthStatus | null;
  isAdmin: boolean;
  canAccessPlanner: boolean;
  onNavigate: (path: string) => void;
  onRefreshHealth: () => void;
}

interface MetricProps {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  tone?: "green" | "blue" | "warning";
}

function MetricCard({ icon: Icon, label, value, description, tone = "green" }: MetricProps) {
  const toneClass = {
    green: "bg-[#00684A]",
    blue: "bg-[#2563EB]",
    warning: "bg-[#B7791F]",
  }[tone];

  return (
    <Card className="p-4">
      <div className={cn("mb-5 grid h-10 w-10 place-items-center rounded-2xl text-white", toneClass)}>
        <Icon size={19} />
      </div>
      <p className="text-sm font-medium text-[#5B6B63]">{label}</p>
      <p className="mt-1 text-3xl font-medium text-[#10231B]">{value}</p>
      <p className="mt-2 text-xs font-semibold text-[#5B6B63]">{description}</p>
    </Card>
  );
}

function DeltaList({
  title,
  icon: Icon,
  items,
  emptyText,
  tone,
}: {
  title: string;
  icon: LucideIcon;
  items: DailyDeltaItem[];
  emptyText: string;
  tone: "green" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-[#D9E4DD] bg-white">
      <div className="flex items-center gap-2 border-b border-[#D9E4DD] px-4 py-3">
        <Icon size={17} className={tone === "green" ? "text-[#00684A]" : "text-[#C2410C]"} />
        <p className="text-sm font-semibold text-[#10231B]">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-[#5B6B63]">{emptyText}</p>
      ) : (
        <div className="divide-y divide-[#D9E4DD]">
          {items.map((item) => (
            <div key={item.product.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#10231B]">{item.product.name}</p>
                <p className="truncate text-xs text-[#5B6B63]">{item.product.sku}</p>
              </div>
              <Badge tone={tone}>{item.delta > 0 ? `+${item.delta}` : item.delta}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardOverviewPage({
  isAdmin,
  canAccessPlanner,
  onNavigate,
  onRefreshHealth,
}: DashboardPageProps) {
  const { i18n, t } = useTranslation();
  const [summary, setSummary] = useState<StockSummaryResponse | null>(null);
  const [dailyDelta, setDailyDelta] = useState<DailyDeltaResponse | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (value: string | undefined) => {
    if (!value) return t("common.states.missing");
    return new Date(`${value}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage);
  };

  const formatDateTime = (value: string) => {
    return new Date(value).toLocaleString(i18n.resolvedLanguage);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    setDailyDelta(null);

    const [summaryResult, snapshotResult] = await Promise.allSettled([
      getStockSummary(),
      getSnapshots(),
    ]);

    if (snapshotResult.status === "fulfilled") {
      setSnapshots(snapshotResult.value.data);
    } else {
      setSnapshots([]);
    }

    if (summaryResult.status === "fulfilled") {
      const stockSummary = summaryResult.value.data;
      setSummary(stockSummary);
      try {
        const deltaResponse = await getDailyDelta(stockSummary.snapshot_date);
        setDailyDelta(deltaResponse.data);
      } catch {
        setDailyDelta(null);
      }
    } else {
      setSummary(null);
    }

    if (summaryResult.status === "rejected" && snapshotResult.status === "rejected") {
      const message = t("dashboard.errors.loadData");
      setError(message);
      toast.error(message);
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  const recentSnapshots = useMemo(() => {
    return [...snapshots]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [snapshots]);

  const totalUnits = summary?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const topGainers = useMemo(() => {
    return [...(dailyDelta?.items ?? [])]
      .filter((item) => item.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3);
  }, [dailyDelta]);
  const topLosers = useMemo(() => {
    return [...(dailyDelta?.items ?? [])]
      .filter((item) => item.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 3);
  }, [dailyDelta]);

  const shortcuts = [
    { label: t("dashboard.shortcuts.openDailyComparison"), path: "/reports/daily", icon: BarChart3 },
    { label: isAdmin ? t("dashboard.shortcuts.uploadImageAndSaveSnapshot") : t("dashboard.shortcuts.reviewSnapshots"), path: "/snapshots", icon: UploadCloud },
    ...(canAccessPlanner ? [{ label: t("dashboard.shortcuts.openProductionPlan"), path: "/production-plan", icon: CalendarDays }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="mt-3 text-3xl font-light text-[#10231B]">{t("dashboard.hero.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">{t("dashboard.hero.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onRefreshHealth}>
            <RefreshCw size={16} />
            {t("common.actions.checkApi")}
          </Button>
          {isAdmin && (
            <Button onClick={() => onNavigate("/snapshots")}>
              <UploadCloud size={16} />
              {t("common.actions.newSnapshot")}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Package}
          label={t("dashboard.metrics.products.label")}
          value={loading ? t("dashboard.metrics.loadingValue") : (summary?.items.length ?? 0).toString()}
          description={t("dashboard.metrics.products.description")}
        />
        <MetricCard
          icon={Boxes}
          label={t("dashboard.metrics.latestUnits.label")}
          value={loading ? t("dashboard.metrics.loadingValue") : totalUnits.toString()}
          description={t("dashboard.metrics.latestUnits.description")}
          tone="blue"
        />
        <MetricCard
          icon={CalendarDays}
          label={t("dashboard.metrics.latestSnapshotDate.label")}
          value={loading ? t("dashboard.metrics.loadingValue") : formatDate(summary?.snapshot_date)}
          description={summary ? t("dashboard.metrics.latestSnapshotDate.description", { id: summary.snapshot_id }) : t("dashboard.metrics.latestSnapshotDate.empty")}
          tone="warning"
        />
        <MetricCard
          icon={ImageIcon}
          label={t("dashboard.metrics.snapshots.label")}
          value={loading ? t("dashboard.metrics.loadingValue") : snapshots.length.toString()}
          description={t("dashboard.metrics.snapshots.description")}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t("dashboard.dailyDelta.title")}</CardTitle>
              <CardDescription>
                {dailyDelta
                  ? t("dashboard.dailyDelta.descriptionWithDate", {
                      date: formatDate(dailyDelta.date),
                      baseline: formatDate(dailyDelta.baseline_date),
                    })
                  : t("dashboard.dailyDelta.description")}
              </CardDescription>
            </div>
            <Button variant="soft" size="sm" onClick={() => onNavigate(`/reports/daily${summary ? `?date=${summary.snapshot_date}` : ""}`)} className="shrink-0 whitespace-nowrap px-4">
              {t("dashboard.dailyDelta.openReport")}
              <ArrowRight size={14} />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <EmptyState icon={BarChart3} title={t("dashboard.dailyDelta.loadingTitle")} description={t("dashboard.dailyDelta.loadingDescription")} />
            ) : !dailyDelta ? (
              <EmptyState icon={BarChart3} title={t("dashboard.dailyDelta.emptyTitle")} description={t("dashboard.dailyDelta.emptyDescription")} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <DeltaList
                  title={t("dashboard.dailyDelta.gainers")}
                  icon={TrendingUp}
                  items={topGainers}
                  emptyText={t("dashboard.dailyDelta.noGainers")}
                  tone="green"
                />
                <DeltaList
                  title={t("dashboard.dailyDelta.losers")}
                  icon={TrendingDown}
                  items={topLosers}
                  emptyText={t("dashboard.dailyDelta.noLosers")}
                  tone="danger"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t("dashboard.recentSnapshots.title")}</CardTitle>
              <CardDescription>{t("dashboard.recentSnapshots.description")}</CardDescription>
            </div>
            <Button variant="soft" size="sm" onClick={() => onNavigate("/snapshots")} className="shrink-0 whitespace-nowrap px-4">
              {t("common.actions.viewSnapshots")}
              <ArrowRight size={14} />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <EmptyState icon={ImageIcon} title={t("dashboard.recentSnapshots.loadingTitle")} description={t("dashboard.recentSnapshots.loadingDescription")} />
            ) : recentSnapshots.length === 0 ? (
              <EmptyState icon={ImageIcon} title={t("dashboard.recentSnapshots.emptyTitle")} description={t("dashboard.recentSnapshots.emptyDescription")} />
            ) : (
              <div className="divide-y divide-[#D9E4DD] overflow-hidden rounded-2xl border border-[#D9E4DD]">
                {recentSnapshots.map((snapshot) => {
                  const snapshotDate = snapshot.created_at.slice(0, 10);
                  const totalQuantity = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
                  return (
                    <button
                      key={snapshot.id}
                      onClick={() => onNavigate(`/reports/daily?date=${snapshotDate}`)}
                      className="flex w-full items-center justify-between gap-4 bg-white px-4 py-3 text-left transition hover:bg-[#F7FAF8]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#10231B]">{snapshot.name}</span>
                        <span className="mt-1 block truncate text-xs text-[#5B6B63]">{formatDateTime(snapshot.created_at)}</span>
                      </span>
                      <span className="flex shrink-0 flex-wrap justify-end gap-2">
                        <Badge tone="blue">{t("common.formats.boxes", { count: snapshot.items.length })}</Badge>
                        <Badge tone="green">{t("common.formats.units", { count: totalQuantity })}</Badge>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.shortcuts.title")}</CardTitle>
          <CardDescription>{t("dashboard.shortcuts.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {shortcuts.map((item) => (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className="flex min-h-[74px] items-center justify-between gap-3 rounded-2xl border border-[#D9E4DD] bg-white p-4 text-left transition hover:border-[#00684A] hover:bg-[#F7FAF8]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#E3F6EC] text-[#00684A]">
                  <item.icon size={18} />
                </span>
                <span className="min-w-0 truncate font-medium leading-5 text-[#10231B]">{item.label}</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-[#5B6B63]" />
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
