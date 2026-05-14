import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ImageIcon, RefreshCw, Search } from "lucide-react";

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
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshots = () => {
    setLoading(true);
    setError(null);
    getSnapshots()
      .then((res) => setSnapshots(res.data))
      .catch(() => setError("Failed to load snapshots from the API."))
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
        snapshot.file_path,
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
          <CardTitle>Snapshot history</CardTitle>
          <CardDescription>Saved inventory runs with image previews, item rows, and confidence-ready badges.</CardDescription>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} leftSlot={<Search size={16} />} placeholder="Search snapshots..." />
          <Button variant="secondary" onClick={fetchSnapshots} disabled={loading}>
            <RefreshCw size={16} />
            Refresh
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
          <EmptyState icon={ImageIcon} title="Loading snapshots" description="Calling GET /snapshots and waiting for saved inventory runs." />
        ) : filteredSnapshots.length === 0 ? (
          <EmptyState icon={ImageIcon} title="No snapshots found" description="Create a snapshot or clear the search filter to see image-backed runs here." />
        ) : (
          <div className="space-y-4">
            {filteredSnapshots.map((snapshot) => {
              const totalQuantity = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);
              return (
                <article key={snapshot.id} className="overflow-hidden rounded-2xl border border-[#D9E4DD] bg-white">
                  <div className="grid gap-4 p-4 lg:grid-cols-[160px_1fr]">
                    <div className="h-40 overflow-hidden rounded-2xl border border-[#D9E4DD] bg-[#EEF4F0]">
                      <img
                        src={`${API_URL}/uploads/${snapshot.file_path}`}
                        alt={snapshot.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-light text-[#10231B]">{snapshot.name}</h3>
                          <p className="mt-1 flex items-center gap-2 text-sm text-[#5B6B63]">
                            <CalendarDays size={15} />
                            {new Date(snapshot.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="blue">{snapshot.items.length} rows</Badge>
                          <Badge tone="green">{totalQuantity} units</Badge>
                        </div>
                      </div>

                      {snapshot.items.length === 0 ? (
                        <EmptyState icon={ImageIcon} title="No item rows" description="This snapshot exists, but no products were attached." className="mt-4 min-h-[120px]" />
                      ) : (
                        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#D9E4DD]">
                          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
                            <thead>
                              <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                                {["Product", "SKU", "Quantity", "Confidence", "Value"].map((heading) => (
                                  <th key={heading} className="border-b border-[#D9E4DD] px-3 py-2">
                                    {heading}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {snapshot.items.map((item) => (
                                <tr key={item.id} className="hover:bg-[#F7FAF8]">
                                  <td className="border-b border-[#D9E4DD] px-3 py-2 font-semibold text-[#10231B]">{item.product.name}</td>
                                  <td className="border-b border-[#D9E4DD] px-3 py-2 text-[#5B6B63]">{item.product.sku || "pending"}</td>
                                  <td className="border-b border-[#D9E4DD] px-3 py-2">
                                    <Badge tone="green">x {item.quantity}</Badge>
                                  </td>
                                  <td className="border-b border-[#D9E4DD] px-3 py-2">
                                    <Badge tone={confidenceTone(item.confidence_score)}>
                                      {item.confidence_score == null ? "pending" : `${Math.round(item.confidence_score * 100)}%`}
                                    </Badge>
                                  </td>
                                  <td className="border-b border-[#D9E4DD] px-3 py-2 font-semibold text-[#00684A]">₺{item.product.value}</td>
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
