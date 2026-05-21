import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarDays, ImageIcon, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Snapshot } from "@/models/Snapshot";
import { getSnapshots } from "@/services/snapshot-endpoints";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8003";

function confidenceTone(confidence?: number | null): "green" | "warning" | "danger" | "neutral" {
  if (confidence == null) return "neutral";
  if (confidence >= 0.85) return "green";
  if (confidence >= 0.65) return "warning";
  return "danger";
}

interface SnapshotListProps {
  refreshKey?: number;
}

export default function SnapshotList({ refreshKey = 0 }: SnapshotListProps) {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshots = () => {
    setLoading(true);
    setError(null);
    getSnapshots()
      .then((res) => setSnapshots(res.data))
      .catch(() => setError(t("snapshots.list.error")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSnapshots();
  }, [refreshKey]);

  const filteredSnapshots = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const ordered = [...snapshots].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (!normalized) return ordered;
    return ordered.filter((snapshot) => {
      const haystack = [
        snapshot.name,
        snapshot.file_path ?? "",
        snapshot.primary_image?.original_filename ?? "",
        ...(snapshot.images ?? []).map((image) => image.original_filename ?? image.file_path),
        ...snapshot.items.map((item) => item.box_code),
        ...snapshot.items.map((item) => item.product.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [snapshots, query]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <CardTitle>{t("snapshots.list.title")}</CardTitle>
          <CardDescription>{t("snapshots.list.description")}</CardDescription>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} leftSlot={<Search size={16} />} placeholder={t("snapshots.list.searchPlaceholder")} />
          <Button variant="secondary" onClick={fetchSnapshots} disabled={loading}>
            <RefreshCw size={16} />
            {t("common.actions.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
            {error}
          </div>
        )}

        {loading ? (
          <EmptyState icon={ImageIcon} title={t("snapshots.list.loadingTitle")} description={t("snapshots.list.loadingDescription")} />
        ) : filteredSnapshots.length === 0 ? (
          <EmptyState icon={ImageIcon} title={t("snapshots.list.emptyTitle")} description={t("snapshots.list.emptyDescription")} />
        ) : (
          <div className="space-y-4">
            {filteredSnapshots.map((snapshot) => {
              const totalQuantity = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
              const snapshotDate = snapshot.created_at.slice(0, 10);
              const primaryImagePath = snapshot.primary_image?.file_path ?? snapshot.file_path;
              const galleryImages = snapshot.images ?? [];
              return (
                <article key={snapshot.id} className="overflow-hidden rounded-2xl border border-[#D9E4DD] bg-white">
                  <div className="grid gap-4 p-4 lg:grid-cols-[160px_1fr]">
                    <div className="grid h-40 place-items-center overflow-hidden rounded-2xl border border-[#D9E4DD] bg-[#EEF4F0]">
                      {primaryImagePath ? (
                        <img
                          src={`${API_URL}/uploads/${primaryImagePath}`}
                          alt={snapshot.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon size={28} className="text-[#5B6B63]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-light text-[#10231B]">{snapshot.name}</h3>
                          <p className="mt-1 flex items-center gap-2 text-sm text-[#5B6B63]">
                            <CalendarDays size={15} />
                            {new Date(snapshot.created_at).toLocaleString(i18n.resolvedLanguage)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={snapshot.is_manual ? "purple" : "blue"}>
                            {snapshot.is_manual ? t("snapshots.source.manual") : t("snapshots.source.drone")}
                          </Badge>
                          {galleryImages.length > 0 && (
                            <Badge tone="green">{t("gallery.selectedCount", { count: galleryImages.length })}</Badge>
                          )}
                          <Badge tone="blue">{t("common.formats.boxes", { count: snapshot.items.length })}</Badge>
                          <Badge tone="green">{t("common.formats.units", { count: totalQuantity })}</Badge>
                          <Button variant="soft" size="sm" onClick={() => navigate(`/reports/daily?date=${snapshotDate}`)}>
                            {t("snapshots.list.compare")}
                            <ArrowRight size={14} />
                          </Button>
                        </div>
                      </div>

                      {galleryImages.length > 1 && (
                        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                          {galleryImages.map((image) => (
                            <div key={image.id} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#D9E4DD] bg-[#EEF4F0]">
                              <img
                                src={`${API_URL}/uploads/${image.file_path}`}
                                alt={image.original_filename || snapshot.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {snapshot.items.length === 0 ? (
                        <EmptyState icon={ImageIcon} title={t("snapshots.list.noRowsTitle")} description={t("snapshots.list.noRowsDescription")} className="mt-4 min-h-[120px]" />
                      ) : (
                        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#D9E4DD]">
                          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
                            <thead>
                              <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                                {[
                                  t("common.labels.box"),
                                  t("common.labels.product"),
                                  t("common.labels.date"),
                                  t("common.labels.quantity"),
                                  t("common.labels.confidence"),
                                  t("common.labels.value"),
                                ].map((heading) => (
                                  <th key={heading} className="border-b border-[#D9E4DD] px-3 py-2">
                                    {heading}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {snapshot.items.map((item) => (
                                <tr key={item.id} className="hover:bg-[#F7FAF8]">
                                  <td className="border-b border-[#D9E4DD] px-3 py-2 font-semibold text-[#10231B]">{item.box_code}</td>
                                  <td className="border-b border-[#D9E4DD] px-3 py-2">
                                    <p className="font-semibold text-[#10231B]">{item.product.name}</p>
                                    <p className="text-xs text-[#5B6B63]">{item.product.sku || t("common.states.pending")}</p>
                                  </td>
                                  <td className="border-b border-[#D9E4DD] px-3 py-2 text-[#5B6B63]">
                                    {new Date(`${item.box_date}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage)}
                                  </td>
                                  <td className="border-b border-[#D9E4DD] px-3 py-2">
                                    <Badge tone="green">{t("common.badges.quantity", { count: item.quantity })}</Badge>
                                  </td>
                                  <td className="border-b border-[#D9E4DD] px-3 py-2">
                                    <Badge tone={confidenceTone(item.confidence_score)}>
                                      {item.confidence_score == null
                                        ? t("common.states.pending")
                                        : t("common.badges.confidencePercent", { value: Math.round(item.confidence_score * 100) })}
                                    </Badge>
                                  </td>
                                  <td className="border-b border-[#D9E4DD] px-3 py-2 font-semibold text-[#00684A]">{t("common.formats.currencyTry", { value: item.product.value })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
