import { useState, useEffect } from "react";
import { Product } from "../models/Product";
import { getProducts } from "../services/product-endpoints";
import { uploadFile, saveFile } from "../services/file-endpoints";
import { createSnapshot, addSnapshotItem } from "../services/snapshot-endpoints";

import { FilePond, registerPlugin } from "react-filepond";
import "filepond/dist/filepond.min.css";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

registerPlugin(FilePondPluginImagePreview);

const inputClasses =
  "bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 rounded-lg text-sm outline-none transition-colors duration-200 focus:border-indigo-500 placeholder:text-slate-400/60";

const labelClasses =
  "block text-[0.8125rem] font-medium text-slate-400 mb-1.5 uppercase tracking-wider";

interface PendingItem {
  product: Product;
  quantity: number;
}

export default function SnapshotForm() {
  const [name, setName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [filePath, setFilePath] = useState<string | null>(null);
  const [, setTempFilename] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    getProducts()
      .then((res) => setProducts(res.data))
      .catch(() => setError("Failed to load products"));
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      const uploadRes = await uploadFile(file);
      const tempName = uploadRes.data.temp_filename;
      setTempFilename(tempName);

      const saveRes = await saveFile(tempName, "snapshots");
      setFilePath(saveRes.data.file_path);
      setError(null);
    } catch {
      setError("Failed to upload file");
    }
  };

  const handleAddItem = (product: Product) => {
    const qty = parseInt(quantities[product.id] || "0", 10);
    if (qty <= 0) return;

    const existing = pendingItems.find((i) => i.product.id === product.id);
    if (existing) {
      setPendingItems(
        pendingItems.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + qty }
            : i
        )
      );
    } else {
      setPendingItems([...pendingItems, { product, quantity: qty }]);
    }

    setQuantities({ ...quantities, [product.id]: "" });
  };

  const handleRemoveItem = (productId: number) => {
    setPendingItems(pendingItems.filter((i) => i.product.id !== productId));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Snapshot name is required");
      return;
    }
    if (!filePath) {
      setError("Please upload an image first");
      return;
    }
    if (pendingItems.length === 0) {
      setError("Add at least one product");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const snapshotRes = await createSnapshot({
        name: name.trim(),
        file_path: filePath,
      });
      const snapshotId = snapshotRes.data.id;

      for (const item of pendingItems) {
        await addSnapshotItem({
          product_id: item.product.id,
          snapshot_id: snapshotId,
          quantity: item.quantity,
        });
      }

      setSuccess(`Snapshot "${name}" created successfully!`);
      setName("");
      setFilePath(null);
      setTempFilename(null);
      setPendingItems([]);
      setQuantities({});
    } catch {
      setError("Failed to save snapshot");
    } finally {
      setSaving(false);
    }
  };

  const availableProducts = products.filter(
    (p) => !pendingItems.some((i) => i.product.id === p.id)
  );

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-slate-100">
        New Inventory Snapshot
      </h2>

      {error && (
        <p className="text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg text-[0.8125rem] mb-4">
          {error}
        </p>
      )}
      {success && (
        <p className="text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg text-[0.8125rem] mb-4">
          {success}
        </p>
      )}

      <div className="mb-5">
        <label className={labelClasses}>Snapshot Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. March 2026 Count"
          className={`${inputClasses} w-full`}
        />
      </div>

      <div className="mb-5">
        <label className={labelClasses}>Snapshot Image</label>
        <FilePond
          allowMultiple={false}
          acceptedFileTypes={["image/*"]}
          labelIdle='Drag & drop an image or <span class="filepond--label-action">Browse</span>'
          onaddfile={(_error, fileItem) => {
            if (fileItem?.file) {
              handleFileUpload(fileItem.file as File);
            }
          }}
          onremovefile={() => {
            setFilePath(null);
            setTempFilename(null);
          }}
        />
        {filePath && (
          <p className="text-emerald-500 text-[0.8125rem] mt-1.5">
            ✓ Image saved: {filePath}
          </p>
        )}
      </div>

      <div className="mb-5">
        <label className={labelClasses}>Added Items</label>
        {pendingItems.length === 0 ? (
          <p className="text-slate-400 text-sm italic">No items added yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pendingItems.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg"
              >
                <span className="font-medium flex-1">
                  {item.product.name}
                </span>
                <div className="flex items-center gap-1.5 text-indigo-500 font-semibold text-sm mx-3">
                  <span>×</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val > 0) {
                        setPendingItems(
                          pendingItems.map((i) =>
                            i.product.id === item.product.id
                              ? { ...i, quantity: val }
                              : i
                          )
                        );
                      }
                    }}
                    className={`${inputClasses} w-[70px] text-center`}
                  />
                </div>
                <button
                  onClick={() => handleRemoveItem(item.product.id)}
                  className="cursor-pointer font-medium rounded-lg transition-all duration-200 text-xs px-2.5 py-1 bg-transparent text-rose-500 border border-rose-500 hover:bg-rose-500 hover:text-white"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-5">
        <label className={labelClasses}>Add Products</label>
        {availableProducts.length === 0 ? (
          <p className="text-slate-400 text-sm italic">
            {products.length === 0
              ? "No products created yet. Go to Products tab first."
              : "All products added."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {availableProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg"
              >
                <span className="flex-1 text-sm">
                  {p.name}{" "}
                  <span className="text-emerald-500 text-[0.8125rem] font-semibold">
                    ₺{p.value}
                  </span>
                </span>
                <input
                  type="number"
                  min="1"
                  value={quantities[p.id] || ""}
                  onChange={(e) =>
                    setQuantities({ ...quantities, [p.id]: e.target.value })
                  }
                  placeholder="Qty"
                  className={`${inputClasses} w-[80px]`}
                />
                <button
                  onClick={() => handleAddItem(p)}
                  className="cursor-pointer font-medium rounded-lg transition-all duration-200 text-xs px-2.5 py-1 bg-slate-800 text-slate-100 border border-slate-700 hover:border-indigo-500 hover:text-indigo-500"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="border-none cursor-pointer font-medium rounded-lg transition-all duration-200 text-base px-8 py-3 w-full mt-4 bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Saving..." : "Save Snapshot"}
      </button>
    </div>
  );
}
