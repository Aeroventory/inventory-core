import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import SnapshotForm from "@/components/SnapshotForm";
import SnapshotList from "@/components/SnapshotList";
import { useAuthStore } from "@/stores/auth-store";

export default function SnapshotsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const isAdmin = useAuthStore((state) => state.isAdmin());

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="green">Snapshots API</Badge>
        <h1 className="mt-3 text-3xl font-light text-[#10231B]">Snapshots</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">
          Upload images, create manual snapshot rows, and inspect the saved inventory history in one workflow.
        </p>
      </div>

      {isAdmin && <SnapshotForm onSaved={() => setRefreshKey((value) => value + 1)} />}
      <SnapshotList refreshKey={refreshKey} />
    </div>
  );
}
