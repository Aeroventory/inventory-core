import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import SnapshotForm from "@/components/SnapshotForm";
import SnapshotList from "@/components/SnapshotList";
import { useAuthStore } from "@/stores/auth-store";

export default function SnapshotsPage() {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const isAdmin = useAuthStore((state) => state.isAdmin());

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="green">{t("snapshots.page.badge")}</Badge>
        <h1 className="mt-3 text-3xl font-light text-[#10231B]">{t("snapshots.page.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">
          {t("snapshots.page.description")}
        </p>
      </div>

      {isAdmin && <SnapshotForm onSaved={() => setRefreshKey((value) => value + 1)} />}
      <SnapshotList refreshKey={refreshKey} />
    </div>
  );
}
