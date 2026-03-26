import { useState, useEffect } from "react";
import ProductsPage from "./components/ProductsPage";
import SnapshotForm from "./components/SnapshotForm";
import SnapshotList from "./components/SnapshotList";
import api from "./services/axios-config";

interface HealthStatus {
  status: string;
  database: string;
}

type Tab = "products" | "snapshot" | "snapshots";

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("products");

  useEffect(() => {
    api
      .get<HealthStatus>("/health")
      .then((res) => setHealth(res.data))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-[1.75rem] font-bold mb-1">Inventory Core</h1>
      {health && (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-6 ${
            health.status === "healthy"
              ? "bg-emerald-500/15 text-emerald-500"
              : "bg-rose-500/15 text-rose-500"
          }`}
        >
          ● {health.status} — DB {health.database}
        </span>
      )}

      <div className="flex border-b border-slate-700 mb-6">
        {(["products", "snapshot", "snapshots"] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={`px-5 py-2.5 bg-transparent border-none text-sm font-medium cursor-pointer border-b-2 transition-all duration-200 -mb-px ${
              activeTab === tab
                ? "text-indigo-500 border-b-indigo-500"
                : "text-slate-400 border-b-transparent hover:text-slate-100"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "products"
              ? "Products"
              : tab === "snapshot"
              ? "New Snapshot"
              : "Snapshots"}
          </button>
        ))}
      </div>

      {activeTab === "products" && <ProductsPage />}
      {activeTab === "snapshot" && <SnapshotForm />}
      {activeTab === "snapshots" && <SnapshotList />}
    </div>
  );
}

export default App;
