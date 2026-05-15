import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Boxes,
  Database,
  ImageIcon,
  type LucideIcon,
  Package,
  RefreshCw,
  UploadCloud,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Product } from "@/models/Product";
import { Snapshot } from "@/models/Snapshot";
import { getProducts } from "@/services/product-endpoints";
import { getSnapshots } from "@/services/snapshot-endpoints";
import { cn } from "@/lib/utils";

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

export default function DashboardPage({
  health,
  isAdmin,
  canAccessPlanner,
  onNavigate,
  onRefreshHealth,
}: DashboardPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = () => {
    setLoading(true);
    setError(null);
    Promise.all([getProducts(), getSnapshots()])
      .then(([productRes, snapshotRes]) => {
        setProducts(productRes.data);
        setSnapshots(snapshotRes.data);
      })
      .catch(() => setError("Could not load dashboard data from the API."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const latestSnapshot = useMemo(() => {
    return [...snapshots].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
  }, [snapshots]);

  const totalUnits = latestSnapshot?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const trackedValue = products.reduce((sum, product) => sum + product.value, 0);
  const shortcuts = [
    { label: isAdmin ? "Create or edit products" : "Browse products", path: "/products", icon: Package },
    { label: isAdmin ? "Upload image and save snapshot" : "Review snapshots", path: "/snapshots", icon: UploadCloud },
    ...(canAccessPlanner ? [{ label: "Open production plan", path: "/production-plan", icon: Activity }] : []),
    ...(isAdmin ? [{ label: "Open the kitchen design contract", path: "/kitchen", icon: Activity }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge tone={health?.status === "healthy" ? "green" : "warning"}>
            {health ? `API ${health.status}` : "API unchecked"}
          </Badge>
          <h1 className="mt-3 text-3xl font-light text-[#10231B]">
            Inventory workflow console
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">
            A light, endpoint-first workspace for testing products, snapshots, uploads, and API health without opening Postman.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onRefreshHealth}>
            <RefreshCw size={16} />
            Check API
          </Button>
          {isAdmin && (
            <Button onClick={() => onNavigate("/snapshots")}>
              <UploadCloud size={16} />
              New Snapshot
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
          label="Products"
          value={loading ? "..." : products.length.toString()}
          description="Rows returned from /products"
        />
        <MetricCard
          icon={Boxes}
          label="Latest Units"
          value={loading ? "..." : totalUnits.toString()}
          description="Quantity total in the newest snapshot"
          tone="blue"
        />
        <MetricCard
          icon={ImageIcon}
          label="Snapshots"
          value={loading ? "..." : snapshots.length.toString()}
          description="Saved image-backed inventory runs"
        />
        <MetricCard
          icon={Database}
          label="DB Status"
          value={health?.database ?? "unknown"}
          description={`Tracked product value total: ${trackedValue}`}
          tone={health?.database === "connected" ? "green" : "warning"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Latest snapshot</CardTitle>
              <CardDescription>Fast check that the image workflow is producing useful inventory rows.</CardDescription>
            </div>
            <Button variant="soft" size="sm" onClick={() => onNavigate("/snapshots")}>
              View snapshots
              <ArrowRight size={14} />
            </Button>
          </CardHeader>
          <CardContent>
            {!latestSnapshot ? (
              <EmptyState
                icon={ImageIcon}
                title="No snapshots yet"
                description="Upload an image and save a snapshot to see the latest detected inventory here."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#D9E4DD]">
                <div className="flex flex-col gap-4 bg-[#F7FAF8] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-[#10231B]">{latestSnapshot.name}</p>
                    <p className="mt-1 text-sm text-[#5B6B63]">
                      {new Date(latestSnapshot.created_at).toLocaleString()} · {latestSnapshot.items.length} item rows
                    </p>
                  </div>
                  <Badge tone="blue">/{latestSnapshot.file_path}</Badge>
                </div>
                <div className="divide-y divide-[#D9E4DD] bg-white">
                  {latestSnapshot.items.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-[#10231B]">{item.product.name}</p>
                        <p className="text-xs text-[#5B6B63]">{item.product.sku || `Product #${item.product_id}`}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="green">x {item.quantity}</Badge>
                        <Badge tone={item.confidence_score == null ? "neutral" : item.confidence_score >= 0.85 ? "green" : "warning"}>
                          {item.confidence_score == null ? "confidence pending" : `${Math.round(item.confidence_score * 100)}%`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow shortcuts</CardTitle>
            <CardDescription>Move through the testing loop without leaving the console.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {shortcuts.map((item) => (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className="flex w-full items-center justify-between rounded-2xl border border-[#D9E4DD] bg-white p-4 text-left transition hover:border-[#00684A] hover:bg-[#F7FAF8]"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#E3F6EC] text-[#00684A]">
                    <item.icon size={18} />
                  </span>
                  <span className="font-medium text-[#10231B]">{item.label}</span>
                </span>
                <ArrowRight size={16} className="text-[#5B6B63]" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
