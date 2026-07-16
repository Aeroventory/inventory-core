import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plane, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AiSnapshotModal from "@/components/AiSnapshotModal";
import DroneSnapshotModal from "@/components/DroneSnapshotModal";
import SnapshotForm from "@/components/SnapshotForm";
import SnapshotList from "@/components/SnapshotList";
import { useAuthStore } from "@/stores/auth-store";

export default function SnapshotsPage() {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [droneModalOpen, setDroneModalOpen] = useState(false);
  const isAdmin = useAuthStore((state) => state.isAdmin());

  const refreshSnapshots = () => setRefreshKey((value) => value + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge tone="green">{t("snapshots.page.badge")}</Badge>
          <h1 className="mt-3 text-3xl font-light text-[#10231B]">{t("snapshots.page.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">
            {t("snapshots.page.description")}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-2 sm:w-auto">
            <Button onClick={() => setAiModalOpen(true)}>
              <Sparkles size={18} />
              {t("snapshots.ai.openButton")}
            </Button>
            <Button variant="secondary" onClick={() => setDroneModalOpen(true)}>
              <Plane size={18} />
              {t("snapshots.drone.openButton")}
            </Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <SnapshotForm
          onSaved={refreshSnapshots}
        />
      )}
      <SnapshotList refreshKey={refreshKey} />
      {isAdmin && (
        <AiSnapshotModal
          open={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          onSaved={refreshSnapshots}
        />
      )}
      {isAdmin && (
        <DroneSnapshotModal
          open={droneModalOpen}
          onClose={() => setDroneModalOpen(false)}
          onSaved={refreshSnapshots}
        />
      )}
    </div>
  );
}
