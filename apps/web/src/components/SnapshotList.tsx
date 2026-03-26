import { useState, useEffect } from "react";
import { Snapshot } from "../models/Snapshot";
import { getSnapshots } from "../services/snapshot-endpoints";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8003";

export default function SnapshotList() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const fetchSnapshots = () => {
    getSnapshots()
      .then((res) => setSnapshots(res.data))
      .catch(() => setError("Failed to load snapshots"));
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-slate-100">
        Inventory Snapshots
      </h2>

      {error && (
        <p className="text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg text-[0.8125rem] mb-4">
          {error}
        </p>
      )}

      {snapshots.length === 0 ? (
        <p className="text-slate-400 text-sm italic">No snapshots yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {snapshots.map((s) => (
            <div
              key={s.id}
              className="p-4 px-5 bg-slate-900 border border-slate-700 rounded-xl transition-colors duration-200 hover:border-indigo-500"
            >
              <div className="flex gap-4">
                <img
                  src={`${API_URL}/uploads/${s.file_path}`}
                  alt={s.name}
                  className="w-[120px] h-[120px] object-cover rounded-lg border border-slate-700 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <h3 className="text-base font-semibold">{s.name}</h3>
                    <span className="text-slate-400 text-xs">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {s.items.length === 0 ? (
                    <p className="text-slate-400 text-sm italic mt-2">
                      No items.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-700">
                      {s.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 text-sm py-1"
                        >
                          <span className="flex-1">
                            {item.product.name}
                          </span>
                          <span className="text-indigo-500 font-semibold text-sm mx-4">
                            × {item.quantity}
                          </span>
                          <span className="text-emerald-500 text-[0.8125rem] font-semibold">
                            ₺{item.product.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
