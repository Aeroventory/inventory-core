import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext } from "react-router-dom";

import DailyComparisonPage from "@/components/DailyComparisonPage";
import DashboardPage from "@/components/DashboardOverviewPage";
import GalleryPage from "@/components/GalleryPage";
import KitchenPage from "@/components/KitchenPage";
import LoginPage from "@/components/LoginPage";
import ProductionPlanPage from "@/components/ProductionPlanningWorkspace";
import ProtectedLayout, { ProtectedOutletContext } from "@/components/ProtectedLayout";
import ProductsPage from "@/components/ProductsPage";
import SnapshotsPage from "@/components/SnapshotsPage";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/stores/auth-store";
import { Boxes } from "lucide-react";

function AuthLoading() {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-screen place-items-center bg-[#F7FAF8] px-4">
      <EmptyState
        icon={Boxes}
        title={t("app.loading.title")}
        description={t("app.loading.description")}
        className="max-w-md border border-[#D9E4DD] bg-white"
      />
    </div>
  );
}

function RequireAuth() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function RequirePlanner({ children }: { children: ReactNode }) {
  const canAccessPlanner = useAuthStore((state) => state.canAccessPlanner());

  if (!canAccessPlanner) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const isAdmin = useAuthStore((state) => state.isAdmin());

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function DashboardRoute() {
  const navigate = useNavigate();
  const { health, onRefreshHealth } = useOutletContext<ProtectedOutletContext>();
  const isAdmin = useAuthStore((state) => state.isAdmin());
  const canAccessPlanner = useAuthStore((state) => state.canAccessPlanner());

  return (
    <DashboardPage
      health={health}
      isAdmin={isAdmin}
      canAccessPlanner={canAccessPlanner}
      onNavigate={(path) => navigate(path)}
      onRefreshHealth={onRefreshHealth}
    />
  );
}

function App() {
  const initialized = useAuthStore((state) => state.initialized);
  const refreshUser = useAuthStore((state) => state.refreshUser);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  if (!initialized) {
    return <AuthLoading />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<ProtectedLayout />}>
          <Route index element={<DashboardRoute />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/snapshots" element={<SnapshotsPage />} />
          <Route
            path="/gallery"
            element={
              <RequireAdmin>
                <GalleryPage />
              </RequireAdmin>
            }
          />
          <Route path="/reports/daily" element={<DailyComparisonPage />} />
          <Route
            path="/production-plan"
            element={
              <RequirePlanner>
                <ProductionPlanPage />
              </RequirePlanner>
            }
          />
          <Route
            path="/kitchen"
            element={
              <RequireAdmin>
                <KitchenPage />
              </RequireAdmin>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
