import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, PackagePlus, Plus, RotateCcw, Save, Sparkles, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AiSnapshotBoxPreviewDTO,
  AiSnapshotRowDTO,
} from "@/dtos/SnapshotDTO";
import { ProductDTO } from "@/dtos/ProductDTO";
import { Product } from "@/models/Product";
import { getInventoryBoxes } from "@/services/inventory-box-endpoints";
import { createProduct, getProducts } from "@/services/product-endpoints";
import { analyzeAiSnapshot, createAiSnapshot } from "@/services/snapshot-endpoints";

import { FilePond, registerPlugin } from "react-filepond";
import "filepond/dist/filepond.min.css";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

registerPlugin(FilePondPluginImagePreview);

function todayIso() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
}

type DraftRow = AiSnapshotRowDTO & { localId: string };

interface ProductCreationDraft {
  name: string;
  sku: string;
  value: string;
  location_site: string;
  location_aisle: string;
  location_rack: string;
  raw_materials: string;
}

const rowId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const draftRows = (rows: AiSnapshotRowDTO[]) =>
  rows.map((row) => ({ ...row, localId: rowId() }));

const cleanOptional = (value?: string | null) => {
  const cleaned = value?.trim();
  return cleaned || undefined;
};

const skuKey = (value?: string | null) => value?.trim().toUpperCase() ?? "";

const rowLocation = (row: Pick<AiSnapshotRowDTO, "location_site" | "location_aisle" | "location_rack">) =>
  [row.location_site, row.location_aisle, row.location_rack]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" / ");

const productDraftFromRow = (row: DraftRow): ProductCreationDraft => ({
  name: row.product_name?.trim() || row.sku?.trim() || "",
  sku: row.sku?.trim() || "",
  value: "0",
  location_site: row.location_site?.trim() || "",
  location_aisle: row.location_aisle?.trim() || "",
  location_rack: row.location_rack?.trim() || "",
  raw_materials: "",
});

interface AiSnapshotModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AiSnapshotModal({ open, onClose, onSaved }: AiSnapshotModalProps) {
  const { i18n, t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeBoxes, setActiveBoxes] = useState<AiSnapshotBoxPreviewDTO[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(todayIso);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tempFilename, setTempFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [unmatchedRows, setUnmatchedRows] = useState<DraftRow[]>([]);
  const [rawJson, setRawJson] = useState<Record<string, unknown> | null>(null);
  const [modelVersion, setModelVersion] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productDraftRowId, setProductDraftRowId] = useState<string | null>(null);
  const [creatingProductRowId, setCreatingProductRowId] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductCreationDraft>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingCatalog(true);
    setError(null);
    Promise.all([getProducts(), getInventoryBoxes({ active: true })])
      .then(([productRes, boxRes]) => {
        setProducts(productRes.data);
        setActiveBoxes(
          boxRes.data.map((box) => ({
            id: box.id,
            box_code: box.box_code,
            product_id: box.product_id,
            product_name: box.product.name,
            quantity: box.quantity,
            box_date: box.box_date,
          })),
        );
      })
      .catch(() => {
        const message = t("snapshots.ai.errors.loadCatalog");
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoadingCatalog(false));
  }, [open, t]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const removedBoxes = useMemo(() => {
    const reviewedCodes = new Set(
      rows
        .map((row) => row.box_code?.trim())
        .filter((boxCode): boxCode is string => Boolean(boxCode)),
    );
    return activeBoxes.filter((box) => !reviewedCodes.has(box.box_code));
  }, [activeBoxes, rows]);

  const totalQuantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

  const reset = () => {
    setSnapshotName("");
    setSnapshotDate(todayIso());
    setFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setTempFilename(null);
    setRows([]);
    setUnmatchedRows([]);
    setRawJson(null);
    setModelVersion(null);
    setProductDrafts({});
    setProductDraftRowId(null);
    setCreatingProductRowId(null);
    setError(null);
  };

  const handleClose = () => {
    if (saving || analyzing) return;
    reset();
    onClose();
  };

  const updateRow = (localId: string, patch: Partial<DraftRow>) => {
    setRows((current) =>
      current.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    );
  };

  const updateUnmatchedRow = (localId: string, patch: Partial<DraftRow>) => {
    setUnmatchedRows((current) =>
      current.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    );
  };

  const productPatch = (productId: number | null) => {
    const product = products.find((item) => item.id === productId);
    return {
      product_id: product?.id ?? null,
      product_name: product?.name ?? null,
      sku: product?.sku ?? null,
    };
  };

  const refreshProducts = async () => {
    const response = await getProducts();
    setProducts(response.data);
    return response.data;
  };

  const findProductBySku = (sku?: string | null, productList = products) => {
    const key = skuKey(sku);
    return key ? productList.find((product) => skuKey(product.sku) === key) : undefined;
  };

  const moveUnmatchedRowToReviewed = (row: DraftRow, product: Product) => {
    const reviewedRow: DraftRow = {
      ...row,
      localId: rowId(),
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
    };

    setRows((current) => [...current, reviewedRow]);
    setUnmatchedRows((current) => current.filter((item) => item.localId !== row.localId));
    setProductDrafts((current) => {
      const next = { ...current };
      delete next[row.localId];
      return next;
    });
    setProductDraftRowId((current) => (current === row.localId ? null : current));
    setCreatingProductRowId((current) => (current === row.localId ? null : current));
  };

  const startProductCreation = (row: DraftRow) => {
    const existing = findProductBySku(row.sku);
    if (existing) {
      moveUnmatchedRowToReviewed(row, existing);
      toast.info(t("snapshots.ai.productCreate.existingSkuUsed", { sku: existing.sku }));
      return;
    }

    setProductDrafts((current) => ({
      ...current,
      [row.localId]: current[row.localId] ?? productDraftFromRow(row),
    }));
    setProductDraftRowId(row.localId);
  };

  const updateProductDraft = (row: DraftRow, patch: Partial<ProductCreationDraft>) => {
    setProductDrafts((current) => ({
      ...current,
      [row.localId]: {
        ...(current[row.localId] ?? productDraftFromRow(row)),
        ...patch,
      },
    }));
  };

  const createProductFromRow = async (row: DraftRow) => {
    const draft = productDrafts[row.localId] ?? productDraftFromRow(row);
    const name = draft.name.trim();
    const sku = draft.sku.trim();
    const value = Number(draft.value);

    if (!name || !sku || !Number.isFinite(value)) {
      const message = t("snapshots.ai.errors.productFields");
      setError(message);
      toast.error(message);
      return;
    }

    const existing = findProductBySku(sku);
    if (existing) {
      moveUnmatchedRowToReviewed({ ...row, sku }, existing);
      toast.info(t("snapshots.ai.productCreate.existingSkuUsed", { sku: existing.sku }));
      return;
    }

    setCreatingProductRowId(row.localId);
    setError(null);

    const payload: ProductDTO = {
      name,
      sku,
      value,
      location_site: cleanOptional(draft.location_site),
      location_aisle: cleanOptional(draft.location_aisle),
      location_rack: cleanOptional(draft.location_rack),
      raw_materials: cleanOptional(draft.raw_materials),
    };

    try {
      const response = await createProduct(payload);
      const refreshedProducts = await refreshProducts();
      const product = refreshedProducts.find((item) => item.id === response.data.id) ?? response.data;
      moveUnmatchedRowToReviewed({ ...row, sku, product_name: name }, product);
      toast.success(t("snapshots.ai.productCreate.success", { name: product.name }));
    } catch (caught) {
      const status = (caught as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        const refreshedProducts = await refreshProducts();
        const product = findProductBySku(sku, refreshedProducts);
        if (product) {
          moveUnmatchedRowToReviewed({ ...row, sku }, product);
          toast.info(t("snapshots.ai.productCreate.existingSkuUsed", { sku: product.sku }));
          return;
        }
      }

      const message = t("snapshots.ai.errors.productCreate");
      setError(message);
      toast.error(message);
    } finally {
      setCreatingProductRowId(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      const message = t("snapshots.ai.errors.imageRequired");
      setError(message);
      toast.error(message);
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const response = await analyzeAiSnapshot(file);
      setTempFilename(response.data.temp_filename);
      setRows(draftRows(response.data.detections));
      setUnmatchedRows(draftRows(response.data.unmatched));
      setProductDrafts({});
      setProductDraftRowId(null);
      setCreatingProductRowId(null);
      setRawJson(response.data.raw_json);
      setModelVersion(response.data.model_version ?? null);
      setActiveBoxes(response.data.active_boxes);
      if (!snapshotName.trim()) {
        setSnapshotName(t("snapshots.ai.defaultName", { date: snapshotDate }));
      }
    } catch {
      const message = t("snapshots.ai.errors.analyze");
      setError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const addUnmatchedRow = (row: DraftRow) => {
    if (!row.product_id) return;
    const product = products.find((item) => item.id === row.product_id);
    if (!product) return;
    moveUnmatchedRowToReviewed(row, product);
  };

  const restoreRemovedBox = (box: AiSnapshotBoxPreviewDTO) => {
    const product = products.find((item) => item.id === box.product_id);
    setRows((current) => [
      ...current,
      {
        localId: rowId(),
        product_id: box.product_id,
        product_name: product?.name ?? box.product_name,
        sku: product?.sku ?? null,
        box_code: box.box_code,
        quantity: box.quantity,
        box_date: box.box_date,
        confidence_score: null,
      },
    ]);
  };

  const handleCreate = async () => {
    if (!snapshotName.trim()) {
      const message = t("snapshots.form.errors.snapshotNameRequired");
      setError(message);
      toast.error(message);
      return;
    }
    if (!snapshotDate) {
      const message = t("snapshots.form.errors.snapshotDateRequired");
      setError(message);
      toast.error(message);
      return;
    }
    if (!tempFilename) {
      const message = t("snapshots.ai.errors.analyzeFirst");
      setError(message);
      toast.error(message);
      return;
    }
    if (rows.length === 0 || rows.some((row) => !row.product_id || Number(row.quantity) <= 0)) {
      const message = t("snapshots.ai.errors.reviewRows");
      setError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await createAiSnapshot({
        name: snapshotName.trim(),
        snapshot_date: snapshotDate,
        temp_filename: tempFilename,
        rows: rows.map((row) => ({
          product_id: row.product_id,
          sku: row.sku,
          product_name: row.product_name,
          box_code: row.box_code?.trim() || null,
          quantity: Number(row.quantity),
          box_date: row.box_date || snapshotDate,
          confidence_score: row.confidence_score,
          location_site: row.location_site,
          location_aisle: row.location_aisle,
          location_rack: row.location_rack,
          notes: row.notes,
        })),
        confirmed_removed_box_ids: removedBoxes.map((box) => box.id),
      });
      toast.success(t("snapshots.ai.success", { name: snapshotName.trim(), count: response.data.items.length }));
      onSaved();
      reset();
      onClose();
    } catch (caught) {
      const status = (caught as { response?: { status?: number } }).response?.status;
      const message = status === 409 ? t("snapshots.ai.errors.stalePool") : t("snapshots.ai.errors.create");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,35,27,0.42)] p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-snapshot-title"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#D9E4DD] bg-white shadow-[0_24px_70px_rgba(16,35,27,0.22)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#D9E4DD] px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles size={18} className="text-[#00684A]" />
              <h2 id="ai-snapshot-title" className="text-lg font-medium text-[#10231B]">
                {t("snapshots.ai.title")}
              </h2>
              {modelVersion && <Badge tone="blue">{modelVersion}</Badge>}
            </div>
            <p className="mt-1 text-sm text-[#5B6B63]">{t("snapshots.ai.description")}</p>
          </div>
          <Button size="icon" variant="ghost" aria-label={t("common.actions.cancel")} onClick={handleClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {error && (
              <div className="rounded-xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
                {error}
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
              <div className="space-y-5">
                <div className="grid h-52 place-items-center overflow-hidden rounded-xl border border-[#D9E4DD] bg-[#EEF4F0]">
                  {previewUrl ? (
                    <img src={previewUrl} alt={t("snapshots.ai.previewAlt")} className="h-full w-full object-cover" />
                  ) : (
                    <Sparkles size={28} className="text-[#5B6B63]" />
                  )}
                </div>
                <FilePond
                  allowMultiple={false}
                  acceptedFileTypes={["image/*"]}
                  labelIdle={t("snapshots.form.filePondLabel")}
                  onaddfile={(_error, fileItem) => {
                    if (!fileItem?.file) return;
                    const nextFile = fileItem.file as File;
                    setFile(nextFile);
                    setTempFilename(null);
                    setRows([]);
                    setUnmatchedRows([]);
                    setProductDrafts({});
                    setProductDraftRowId(null);
                    setCreatingProductRowId(null);
                    setRawJson(null);
                    setPreviewUrl((current) => {
                      if (current) URL.revokeObjectURL(current);
                      return URL.createObjectURL(nextFile);
                    });
                  }}
                  onremovefile={() => {
                    setFile(null);
                    setPreviewUrl((current) => {
                      if (current) URL.revokeObjectURL(current);
                      return null;
                    });
                    setTempFilename(null);
                    setRows([]);
                    setUnmatchedRows([]);
                    setProductDrafts({});
                    setProductDraftRowId(null);
                    setCreatingProductRowId(null);
                    setRawJson(null);
                  }}
                />
                <Button className="w-full" onClick={handleAnalyze} disabled={analyzing || loadingCatalog || !file}>
                  {analyzing ? <UploadCloud size={18} className="animate-pulse" /> : <Sparkles size={18} />}
                  {analyzing ? t("snapshots.ai.actions.analyzing") : t("snapshots.ai.actions.analyze")}
                </Button>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("snapshots.form.snapshotName")}</span>
                    <Input
                      value={snapshotName}
                      onChange={(event) => setSnapshotName(event.target.value)}
                      placeholder={t("snapshots.ai.namePlaceholder")}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("snapshots.form.snapshotDate")}</span>
                    <Input type="date" value={snapshotDate} onChange={(event) => setSnapshotDate(event.target.value)} />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tone={rows.length ? "blue" : "neutral"}>{t("common.formats.itemRows", { count: rows.length })}</Badge>
                  <Badge tone={totalQuantity ? "green" : "neutral"}>{t("common.formats.units", { count: totalQuantity })}</Badge>
                  <Badge tone={unmatchedRows.length ? "warning" : "green"}>{t("snapshots.ai.unmatchedBadge", { count: unmatchedRows.length })}</Badge>
                  <Badge tone={removedBoxes.length ? "warning" : "green"}>{t("snapshots.ai.removedBadge", { count: removedBoxes.length })}</Badge>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#D9E4DD]">
                  <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left text-sm">
                    <thead>
                      <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                        {[t("common.labels.product"), t("common.labels.box"), t("common.labels.quantity"), t("common.labels.date"), t("common.labels.confidence"), t("common.labels.actions")].map((heading) => (
                          <th key={heading} className="border-b border-[#D9E4DD] px-3 py-2">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td className="px-3 py-5 text-sm text-[#5B6B63]" colSpan={6}>
                            {t("snapshots.ai.emptyRows")}
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.localId} className="hover:bg-[#F7FAF8]">
                            <td className="border-b border-[#D9E4DD] px-3 py-2">
                              <select
                                className="h-10 w-full rounded-xl border border-[#D9E4DD] bg-white px-3 text-sm text-[#10231B] outline-none focus:border-[#00684A] focus:ring-4 focus:ring-[rgba(0,104,74,0.12)]"
                                value={row.product_id ?? ""}
                                onChange={(event) => updateRow(row.localId, productPatch(event.target.value ? Number(event.target.value) : null))}
                              >
                                <option value="">{t("snapshots.boxes.form.productPlaceholder")}</option>
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>
                                ))}
                              </select>
                            </td>
                            <td className="border-b border-[#D9E4DD] px-3 py-2">
                              <Input value={row.box_code ?? ""} onChange={(event) => updateRow(row.localId, { box_code: event.target.value })} />
                            </td>
                            <td className="border-b border-[#D9E4DD] px-3 py-2">
                              <Input type="number" min="1" value={row.quantity} onChange={(event) => updateRow(row.localId, { quantity: Number(event.target.value) })} />
                            </td>
                            <td className="border-b border-[#D9E4DD] px-3 py-2">
                              <Input type="date" value={row.box_date ?? snapshotDate} onChange={(event) => updateRow(row.localId, { box_date: event.target.value })} />
                            </td>
                            <td className="border-b border-[#D9E4DD] px-3 py-2">
                              <Badge tone="neutral">
                                {row.confidence_score == null ? t("common.states.pending") : t("common.badges.confidencePercent", { value: Math.round(row.confidence_score * 100) })}
                              </Badge>
                            </td>
                            <td className="border-b border-[#D9E4DD] px-3 py-2">
                              <Button size="icon" variant="danger" aria-label={t("common.actions.delete")} onClick={() => setRows((current) => current.filter((item) => item.localId !== row.localId))}>
                                <Trash2 size={15} />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {unmatchedRows.length > 0 && (
              <div className="rounded-xl border border-[#E2C675] bg-[#FFF9E6] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#7A5410]">
                  <AlertTriangle size={17} />
                  {t("snapshots.ai.unmatchedTitle")}
                </div>
                <div className="space-y-2">
                  {unmatchedRows.map((row) => {
                    const draft = productDrafts[row.localId] ?? productDraftFromRow(row);
                    const isDraftOpen = productDraftRowId === row.localId;
                    const isCreatingProduct = creatingProductRowId === row.localId;
                    const location = rowLocation(row);

                    return (
                      <div key={row.localId} className="space-y-3 rounded-xl bg-white p-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#10231B]">{row.product_name || row.sku || t("common.states.unknown")}</p>
                            <p className="truncate text-xs text-[#5B6B63]">{row.notes || location || row.box_code || t("common.states.pending")}</p>
                          </div>
                          <select
                            className="h-10 rounded-xl border border-[#D9E4DD] bg-white px-3 text-sm text-[#10231B] outline-none focus:border-[#00684A] focus:ring-4 focus:ring-[rgba(0,104,74,0.12)]"
                            value={row.product_id ?? ""}
                            onChange={(event) => updateUnmatchedRow(row.localId, productPatch(event.target.value ? Number(event.target.value) : null))}
                          >
                            <option value="">{t("snapshots.boxes.form.productPlaceholder")}</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>
                            ))}
                          </select>
                          <Button variant="secondary" onClick={() => addUnmatchedRow(row)} disabled={!row.product_id}>
                            <Plus size={15} />
                            {t("common.actions.add")}
                          </Button>
                          <Button variant="soft" onClick={() => startProductCreation(row)} disabled={isCreatingProduct}>
                            <PackagePlus size={15} />
                            {t("snapshots.ai.productCreate.action")}
                          </Button>
                        </div>

                        {isDraftOpen && (
                          <div className="grid gap-3 rounded-xl border border-[#D9E4DD] bg-[#F7FAF8] p-3 sm:grid-cols-3">
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("common.labels.product")}</span>
                              <Input value={draft.name} onChange={(event) => updateProductDraft(row, { name: event.target.value })} />
                            </label>
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("common.labels.sku")}</span>
                              <Input value={draft.sku} onChange={(event) => updateProductDraft(row, { sku: event.target.value })} />
                            </label>
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("common.labels.value")}</span>
                              <Input type="number" min="0" value={draft.value} onChange={(event) => updateProductDraft(row, { value: event.target.value })} />
                            </label>
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("common.labels.site")}</span>
                              <Input value={draft.location_site} onChange={(event) => updateProductDraft(row, { location_site: event.target.value })} />
                            </label>
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("common.labels.aisle")}</span>
                              <Input value={draft.location_aisle} onChange={(event) => updateProductDraft(row, { location_aisle: event.target.value })} />
                            </label>
                            <label className="block">
                              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("common.labels.rack")}</span>
                              <Input value={draft.location_rack} onChange={(event) => updateProductDraft(row, { location_rack: event.target.value })} />
                            </label>
                            <label className="block sm:col-span-2">
                              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("common.labels.rawMaterials")}</span>
                              <Input value={draft.raw_materials} onChange={(event) => updateProductDraft(row, { raw_materials: event.target.value })} />
                            </label>
                            <div className="flex items-end gap-2">
                              <Button className="flex-1" onClick={() => createProductFromRow(row)} disabled={isCreatingProduct}>
                                {isCreatingProduct ? <UploadCloud size={15} className="animate-pulse" /> : <Save size={15} />}
                                {isCreatingProduct ? t("snapshots.ai.productCreate.creating") : t("snapshots.ai.productCreate.save")}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setProductDraftRowId(null)}
                                disabled={isCreatingProduct}
                              >
                                {t("common.actions.cancel")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {removedBoxes.length > 0 && (
              <div className="rounded-xl border border-[#E2C675] bg-[#FFF9E6] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#7A5410]">
                  <AlertTriangle size={17} />
                  {t("snapshots.ai.removedTitle")}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {removedBoxes.map((box) => (
                    <div key={box.id} className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#10231B]">{box.box_code}</p>
                        <p className="truncate text-xs text-[#5B6B63]">
                          {box.product_name} · {box.quantity} · {formatDate(box.box_date)}
                        </p>
                      </div>
                      <Button size="sm" variant="soft" onClick={() => restoreRemovedBox(box)}>
                        <RotateCcw size={15} />
                        {t("common.actions.restore")}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rawJson && (
              <details className="rounded-xl border border-[#D9E4DD] bg-[#F7FAF8]">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#10231B]">{t("snapshots.ai.rawJson")}</summary>
                <pre className="max-h-72 overflow-auto border-t border-[#D9E4DD] p-4 text-xs text-[#10231B]">
                  {JSON.stringify(rawJson, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#D9E4DD] px-6 py-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={handleClose} disabled={saving || analyzing}>
            {t("common.actions.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={saving || analyzing || !tempFilename || rows.length === 0}>
            {saving ? <UploadCloud size={18} className="animate-pulse" /> : <Save size={18} />}
            {saving ? t("common.actions.savingSnapshot") : t("snapshots.ai.actions.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
