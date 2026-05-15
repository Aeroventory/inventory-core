import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      .catch(() => setError(t("snapshots.form.errors.loadProducts")));
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
      setError(t("snapshots.form.errors.uploadImage"));
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
      setError(t("snapshots.form.errors.snapshotNameRequired"));
      return;
    }
    if (!filePath) {
      setError(t("snapshots.form.errors.uploadBeforeSave"));
      return;
    }
    if (pendingItems.length === 0) {
      setError(t("snapshots.form.errors.addAtLeastOneProduct"));
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

      setSuccess(t("snapshots.form.success", { name: name.trim(), count: pendingItems.length }));
      setName("");
      setFilePath(null);
      setTempFilename(null);
      setPendingItems([]);
      setQuantities({});
      onSaved?.();
    } catch {
      setError(t("snapshots.form.errors.save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{t("snapshots.form.title")}</CardTitle>
            <CardDescription>{t("snapshots.form.description")}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={filePath ? "green" : "neutral"}>{filePath ? t("common.badges.imageSaved") : t("common.badges.imagePending")}</Badge>
            <Badge tone={pendingItems.length ? "blue" : "neutral"}>
              {t("common.formats.compactPair", {
                first: t("common.formats.itemRows", { count: pendingItems.length }),
                second: t("common.formats.units", { count: totalQuantity }),
              })}
            </Badge>
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
              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("snapshots.form.snapshotName")}</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("snapshots.form.snapshotNamePlaceholder")} />
            </label>

            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("snapshots.form.snapshotImage")}</span>
              <FilePond
                allowMultiple={false}
                acceptedFileTypes={["image/*"]}
                labelIdle={t("snapshots.form.filePondLabel")}
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
                {uploading && <Badge tone="blue">{t("common.badges.uploading")}</Badge>}
                {tempFilename && <Badge tone="neutral">{t("common.badges.tempFile", { filename: tempFilename })}</Badge>}
                {filePath && <Badge tone="green">{t("common.badges.savedFile", { path: filePath })}</Badge>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[#10231B]">{t("snapshots.form.addedItems.title")}</p>
                <p className="text-sm text-[#5B6B63]">{t("snapshots.form.addedItems.description")}</p>
              </div>
              <PackagePlus size={20} className="text-[#00684A]" />
            </div>
            {pendingItems.length === 0 ? (
              <EmptyState icon={ImagePlus} title={t("snapshots.form.addedItems.emptyTitle")} description={t("snapshots.form.addedItems.emptyDescription")} className="min-h-[150px] bg-white" />
            ) : (
              <div className="space-y-2">
                {pendingItems.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3 rounded-2xl border border-[#D9E4DD] bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[#10231B]">{item.product.name}</p>
                      <p className="text-xs text-[#5B6B63]">{item.product.sku || t("common.formats.productId", { id: item.product.id })}</p>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) => updatePendingQuantity(item.product.id, Number(event.target.value))}
                      className="w-20 text-center"
                    />
                    <Button size="icon" variant="secondary" aria-label={t("common.aria.removeItem")} onClick={() => removePendingItem(item.product.id)}>
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
              <p className="font-medium text-[#10231B]">{t("snapshots.form.addProducts.title")}</p>
              <p className="text-sm text-[#5B6B63]">{t("snapshots.form.addProducts.description")}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={loadProducts}>
              {t("common.actions.refreshProducts")}
            </Button>
          </div>

          {availableProducts.length === 0 ? (
            <EmptyState
              icon={PackagePlus}
              title={products.length === 0 ? t("snapshots.form.addProducts.emptyNoProductsTitle") : t("snapshots.form.addProducts.emptyAllAddedTitle")}
              description={products.length === 0 ? t("snapshots.form.addProducts.emptyNoProductsDescription") : t("snapshots.form.addProducts.emptyAllAddedDescription")}
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {availableProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-[#D9E4DD] bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#10231B]">{product.name}</p>
                    <p className="text-xs text-[#5B6B63]">
                      {t("common.formats.compactPair", {
                        first: product.sku || t("common.formats.productId", { id: product.id }),
                        second: t("common.formats.currencyTry", { value: product.value }),
                      })}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    value={quantities[product.id] || ""}
                    onChange={(event) => setQuantities({ ...quantities, [product.id]: event.target.value })}
                    placeholder={t("snapshots.form.addProducts.qtyPlaceholder")}
                    className="w-24"
                  />
                  <Button variant="soft" size="sm" onClick={() => handleAddItem(product)}>
                    {t("common.actions.add")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button size="lg" className="w-full" disabled={saving || uploading} onClick={handleSave}>
          {saving ? <UploadCloud size={18} className="animate-pulse" /> : <Save size={18} />}
          {saving ? t("common.actions.savingSnapshot") : t("common.actions.saveSnapshot")}
        </Button>
      </CardContent>
    </Card>
  );
}
