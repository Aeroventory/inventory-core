import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ImagePlus, PackagePlus, Save, Trash2, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Product } from "@/models/Product";
import { saveFile, uploadFile } from "@/services/file-endpoints";
import { getProducts } from "@/services/product-endpoints";
import { addSnapshotItem, createSnapshot } from "@/services/snapshot-endpoints";

import { FilePond, registerPlugin } from "react-filepond";
import "filepond/dist/filepond.min.css";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

registerPlugin(FilePondPluginImagePreview);

interface PendingItem {
  product: Product;
  quantity: number;
}

interface SnapshotFormProps {
  onSaved?: () => void;
}

export default function SnapshotForm({ onSaved }: SnapshotFormProps) {
  const [name, setName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [filePath, setFilePath] = useState<string | null>(null);
  const [tempFilename, setTempFilename] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProducts = () => {
    getProducts()
      .then((res) => setProducts(res.data))
      .catch(() => setError("Failed to load products."));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const availableProducts = useMemo(
    () => products.filter((product) => !pendingItems.some((item) => item.product.id === product.id)),
    [products, pendingItems],
  );

  const totalQuantity = pendingItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const uploadRes = await uploadFile(file);
      const tempName = uploadRes.data.temp_filename;
      setTempFilename(tempName);

      const saveRes = await saveFile(tempName, "snapshots");
      setFilePath(saveRes.data.file_path);
    } catch {
      setError("Failed to upload and save the image.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddItem = (product: Product) => {
    const qty = Number.parseInt(quantities[product.id] || "0", 10);
    if (qty <= 0) return;

    setPendingItems((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (!existing) return [...items, { product, quantity: qty }];
      return items.map((item) =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + qty } : item,
      );
    });
    setQuantities({ ...quantities, [product.id]: "" });
  };

  const updatePendingQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) return;
    setPendingItems((items) =>
      items.map((item) => (item.product.id === productId ? { ...item, quantity } : item)),
    );
  };

  const removePendingItem = (productId: number) => {
    setPendingItems((items) => items.filter((item) => item.product.id !== productId));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Snapshot name is required.");
      return;
    }
    if (!filePath) {
      setError("Upload an image before saving the snapshot.");
      return;
    }
    if (pendingItems.length === 0) {
      setError("Add at least one product row to the snapshot.");
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

      setSuccess(`Snapshot "${name.trim()}" saved with ${pendingItems.length} item rows.`);
      setName("");
      setFilePath(null);
      setTempFilename(null);
      setPendingItems([]);
      setQuantities({});
      onSaved?.();
    } catch {
      setError("Failed to save snapshot.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>New snapshot</CardTitle>
            <CardDescription>Upload an image, pick products, and save a snapshot through the same API flow.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={filePath ? "green" : "neutral"}>{filePath ? "image saved" : "image pending"}</Badge>
            <Badge tone={pendingItems.length ? "blue" : "neutral"}>{pendingItems.length} rows · {totalQuantity} units</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-2xl border border-[#B6E8CC] bg-[#E3F6EC] px-4 py-3 text-sm font-semibold text-[#00684A]">
            <CheckCircle2 size={17} />
            {success}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">Snapshot name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. May 2026 Count" />
            </label>

            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">Snapshot image</span>
              <FilePond
                allowMultiple={false}
                acceptedFileTypes={["image/*"]}
                labelIdle='Drop an image or <span class="filepond--label-action">browse</span>'
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
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {uploading && <Badge tone="blue">uploading</Badge>}
                {tempFilename && <Badge tone="neutral">temp: {tempFilename}</Badge>}
                {filePath && <Badge tone="green">saved: {filePath}</Badge>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[#10231B]">Added items</p>
                <p className="text-sm text-[#5B6B63]">These rows will be POSTed to /snapshots/items after the snapshot is created.</p>
              </div>
              <PackagePlus size={20} className="text-[#00684A]" />
            </div>
            {pendingItems.length === 0 ? (
              <EmptyState icon={ImagePlus} title="No items added" description="Add product quantities from the list below." className="min-h-[150px] bg-white" />
            ) : (
              <div className="space-y-2">
                {pendingItems.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3 rounded-2xl border border-[#D9E4DD] bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[#10231B]">{item.product.name}</p>
                      <p className="text-xs text-[#5B6B63]">{item.product.sku || `Product #${item.product.id}`}</p>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) => updatePendingQuantity(item.product.id, Number(event.target.value))}
                      className="w-20 text-center"
                    />
                    <Button size="icon" variant="secondary" aria-label="Remove item" onClick={() => removePendingItem(item.product.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-[#10231B]">Add products</p>
              <p className="text-sm text-[#5B6B63]">Pick inventory rows and quantities for a manual snapshot.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={loadProducts}>
              Refresh products
            </Button>
          </div>

          {availableProducts.length === 0 ? (
            <EmptyState
              icon={PackagePlus}
              title={products.length === 0 ? "No products available" : "All products added"}
              description={products.length === 0 ? "Create products first, then return here to build a snapshot." : "Remove a row above to add it again."}
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {availableProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-[#D9E4DD] bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#10231B]">{product.name}</p>
                    <p className="text-xs text-[#5B6B63]">{product.sku || `Product #${product.id}`} · ₺{product.value}</p>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    value={quantities[product.id] || ""}
                    onChange={(event) => setQuantities({ ...quantities, [product.id]: event.target.value })}
                    placeholder="Qty"
                    className="w-24"
                  />
                  <Button variant="soft" size="sm" onClick={() => handleAddItem(product)}>
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button size="lg" className="w-full" disabled={saving || uploading} onClick={handleSave}>
          {saving ? <UploadCloud size={18} className="animate-pulse" /> : <Save size={18} />}
          {saving ? "Saving snapshot..." : "Save Snapshot"}
        </Button>
      </CardContent>
    </Card>
  );
}
