import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Boxes,
  ChefHat,
  CircleHelp,
  ClipboardList,
  Database,
  Home,
  Images,
  LogOut,
  Menu,
  Package,
  Plane,
  RefreshCw,
  X,
  type LucideIcon,
} from "lucide-react";

import AboutDemoModal from "@/components/AboutDemoModal";
import LanguageSelect from "@/components/LanguageSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { navItems, type ViewId } from "@/lib/design";
import { cn } from "@/lib/utils";
import api from "@/services/axios-config";
import { useAuthStore } from "@/stores/auth-store";
import type { UserRole } from "@/types/auth";

interface HealthStatus {
  status: string;
  database: string;
}

export interface ProtectedOutletContext {
  health: HealthStatus | null;
  onRefreshHealth: () => void;
}

const viewIcons: Record<ViewId, LucideIcon> = {
  dashboard: Home,
  products: Package,
  snapshots: Boxes,
  drone: Plane,
  gallery: Images,
  dailyReport: BarChart3,
  productionPlan: ClipboardList,
  kitchen: ChefHat,
};

function isCurrentPath(pathname: string, itemPath: string) {
  return itemPath === "/" ? pathname === "/" : pathname.startsWith(itemPath);
}

export default function ProtectedLayout() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const navigate = useNavigate();

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (!("allowedRoles" in item)) return true;
      return (item.allowedRoles as readonly UserRole[]).includes(user?.role ?? "viewer");
    });
  }, [user?.role]);

  const activeItem =
    visibleNavItems.find((item) => isCurrentPath(location.pathname, item.path)) ?? visibleNavItems[0] ?? navItems[0];

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

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate("/login", { replace: true });
  };

  const translateState = (state: string | undefined, fallback = "unknown") => {
    const value = state ?? fallback;
    return t(`common.states.${value}`, { defaultValue: value });
  };

  const translateRole = (role: UserRole | undefined) => {
    const value = role ?? "viewer";
    return t(`common.roles.${value}`, { defaultValue: value });
  };

  const userRoleLabel = translateRole(user?.role);

  const sidebar = (
    <aside className="flex h-full flex-col border-r border-[#D9E4DD] bg-white/95 backdrop-blur">
      <div className="flex h-20 items-center gap-3 px-6">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#00684A] text-white shadow-[0_12px_24px_rgba(0,104,74,0.2)]">
          <Boxes size={23} />
        </div>
        <div>
          <p className="text-xl font-medium text-[#10231B]">{t("common.brand.name")}</p>
          <p className="text-xs font-semibold text-[#5B6B63]">{t("common.brand.consoleName")}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-3">
        {visibleNavItems.map((item) => {
          const Icon = viewIcons[item.id];
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition",
                  isActive ? "bg-[#E3F6EC] text-[#00684A]" : "text-[#10231B] hover:bg-[#F7FAF8] hover:text-[#00684A]",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} />
                  <span className="min-w-0">
                    <span className="block truncate">{t(item.labelKey)}</span>
                    <span className={cn("block truncate text-xs font-medium", isActive ? "text-[#00684A]/75" : "text-[#5B6B63]")}>
                      {t(item.descriptionKey)}
                    </span>
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="m-4 rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#00ED64]" />
          <p className="text-sm font-medium text-[#10231B]">{user?.username ?? t("layout.signedIn")}</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-[#5B6B63]">
          {t("layout.accessDescription", { role: userRoleLabel })}
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
            aria-label={t("common.aria.closeNavigationOverlay")}
            className="absolute inset-0 bg-[#10231B]/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(22rem,86vw)]">{sidebar}</div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-[#D9E4DD] bg-white/90 backdrop-blur xl:ml-[19rem]">
        <div className="flex h-20 items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Button variant="secondary" size="icon" className="xl:hidden" onClick={() => setMobileOpen(true)} aria-label={t("common.aria.openNavigation")}>
            <Menu size={19} />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#5B6B63]">
              <span>{t("common.brand.console")}</span>
              <span>/</span>
              <span className="text-[#10231B]">{t(activeItem.labelKey)}</span>
            </div>
            <p className="truncate text-lg font-light text-[#10231B]">{t(activeItem.descriptionKey)}</p>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Badge tone={health?.status === "healthy" ? "green" : "warning"}>
              <Activity size={13} />
              {translateState(health?.status, "checking")}
            </Badge>
            <Badge tone={health?.database === "connected" ? "green" : "danger"}>
              <Database size={13} />
              {t("common.badges.dbStatus", { status: translateState(health?.database) })}
            </Badge>
          </div>

          <LanguageSelect />

          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="rounded-full"
            aria-label={t("aboutDemo.actions.open")}
            onClick={() => setAboutOpen(true)}
          >
            <CircleHelp size={18} />
          </Button>

          <Button variant="secondary" size="icon" onClick={fetchHealth} disabled={healthLoading} aria-label={t("common.aria.refreshApiHealth")}>
            {healthLoading ? <RefreshCw size={17} className="animate-spin" /> : <RefreshCw size={17} />}
          </Button>

          <div className="hidden items-center gap-3 rounded-2xl border border-[#D9E4DD] bg-white px-3 py-2 sm:flex">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E3F6EC] text-sm font-medium uppercase text-[#00684A]">
              {user?.username.slice(0, 2) ?? t("layout.fallbackInitials")}
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-bold text-[#10231B]">{user?.username}</p>
              <p className="text-xs capitalize text-[#5B6B63]">{userRoleLabel}</p>
            </div>
          </div>

          <Button variant="secondary" size="icon" onClick={handleLogout} aria-label={t("common.aria.logOut")}>
            <LogOut size={17} />
          </Button>

          {mobileOpen && (
            <Button variant="secondary" size="icon" className="xl:hidden" onClick={() => setMobileOpen(false)} aria-label={t("common.aria.closeNavigation")}>
              <X size={18} />
            </Button>
          )}
        </div>
      </header>

      <AboutDemoModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <main className="px-4 py-6 sm:px-6 lg:px-8 xl:ml-[19rem]">
        <div className="mx-auto max-w-[1500px]">
          <Outlet context={{ health, onRefreshHealth: fetchHealth } satisfies ProtectedOutletContext} />
        </div>
      </main>
    </div>
  );
}
