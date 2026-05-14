import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  ChefHat,
  Database,
  Home,
  Menu,
  Package,
  RefreshCw,
  X,
  type LucideIcon,
} from "lucide-react";

import DashboardPage from "@/components/DashboardPage";
import KitchenPage from "@/components/KitchenPage";
import ProductsPage from "@/components/ProductsPage";
import SnapshotsPage from "@/components/SnapshotsPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { navItems, type ViewId } from "@/lib/design";
import { cn } from "@/lib/utils";
import api from "@/services/axios-config";

interface HealthStatus {
  status: string;
  database: string;
}

const viewIcons: Record<ViewId, LucideIcon> = {
  dashboard: Home,
  products: Package,
  snapshots: Boxes,
  kitchen: ChefHat,
};

function viewFromPath(pathname: string): ViewId {
  if (pathname.startsWith("/products")) return "products";
  if (pathname.startsWith("/snapshots") || pathname.startsWith("/snapshot")) return "snapshots";
  if (pathname.startsWith("/kitchen")) return "kitchen";
  return "dashboard";
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeView = useMemo(() => viewFromPath(currentPath), [currentPath]);
  const activeItem = navItems.find((item) => item.id === activeView) ?? navItems[0];

  const fetchHealth = () => {
    setHealthLoading(true);
    api
      .get<HealthStatus>("/health")
      .then((res) => setHealth(res.data))
      .catch(() => setHealth({ status: "degraded", database: "disconnected" }))
      .finally(() => setHealthLoading(false));
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState(null, "", path);
    setCurrentPath(path);
    setMobileOpen(false);
  };

  const renderPage = () => {
    if (activeView === "products") return <ProductsPage />;
    if (activeView === "snapshots") return <SnapshotsPage />;
    if (activeView === "kitchen") return <KitchenPage />;
    return <DashboardPage health={health} onNavigate={navigate} onRefreshHealth={fetchHealth} />;
  };

  const sidebar = (
    <aside className="flex h-full flex-col border-r border-[#D9E4DD] bg-white/95 backdrop-blur">
      <div className="flex h-20 items-center gap-3 px-6">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#00684A] text-white shadow-[0_12px_24px_rgba(0,104,74,0.2)]">
          <Boxes size={23} />
        </div>
        <div>
          <p className="text-xl font-medium text-[#10231B]">Aeroventory</p>
          <p className="text-xs font-semibold text-[#5B6B63]">Inventory Core Console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-3">
        {navItems.map((item) => {
          const Icon = viewIcons[item.id];
          const isActive = item.id === activeView;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition",
                isActive
                  ? "bg-[#E3F6EC] text-[#00684A]"
                  : "text-[#10231B] hover:bg-[#F7FAF8] hover:text-[#00684A]",
              )}
            >
              <Icon size={18} />
              <span className="min-w-0">
                <span className="block truncate">{item.label}</span>
                <span className={cn("block truncate text-xs font-medium", isActive ? "text-[#00684A]/75" : "text-[#5B6B63]")}>
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="m-4 rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#00ED64]" />
          <p className="text-sm font-medium text-[#10231B]">Dev workflow UI</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-[#5B6B63]">
          Built for endpoint and workflow testing. Kitchen keeps the design steady.
        </p>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-[19rem] xl:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-[#10231B]/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(22rem,86vw)]">{sidebar}</div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-[#D9E4DD] bg-white/90 backdrop-blur xl:ml-[19rem]">
        <div className="flex h-20 items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Button variant="secondary" size="icon" className="xl:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu size={19} />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#5B6B63]">
              <span>Console</span>
              <span>/</span>
              <span className="text-[#10231B]">{activeItem.label}</span>
            </div>
            <p className="truncate text-lg font-light text-[#10231B]">{activeItem.description}</p>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Badge tone={health?.status === "healthy" ? "green" : "warning"}>
              <Activity size={13} />
              {health?.status ?? "checking"}
            </Badge>
            <Badge tone={health?.database === "connected" ? "green" : "danger"}>
              <Database size={13} />
              DB {health?.database ?? "unknown"}
            </Badge>
          </div>

          <Button variant="secondary" size="icon" onClick={fetchHealth} disabled={healthLoading} aria-label="Refresh API health">
            {healthLoading ? <RefreshCw size={17} className="animate-spin" /> : <RefreshCw size={17} />}
          </Button>

          <div className="hidden items-center gap-3 rounded-2xl border border-[#D9E4DD] bg-white px-3 py-2 sm:flex">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E3F6EC] text-sm font-medium text-[#00684A]">
              EX
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-bold text-[#10231B]">Example</p>
              <p className="text-xs text-[#5B6B63]">Project console</p>
            </div>
          </div>

          {mobileOpen && (
            <Button variant="secondary" size="icon" className="xl:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
              <X size={18} />
            </Button>
          )}
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8 xl:ml-[19rem]">
        <div className="mx-auto max-w-[1500px]">{renderPage()}</div>
      </main>
    </div>
  );
}

export default App;
