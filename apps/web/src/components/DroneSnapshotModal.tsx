import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Camera,
  CircleStop,
  PackagePlus,
  Plane,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Trash2,
  UploadCloud,
  Video,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiSnapshotBoxPreviewDTO, AiSnapshotRowDTO } from "@/dtos/SnapshotDTO";
import { ProductDTO } from "@/dtos/ProductDTO";
import type { DroneMissionStatus, DronePhotoResponse, DroneStreamMode } from "@/models/Drone";
import { Product } from "@/models/Product";
import { cn } from "@/lib/utils";
import { getInventoryBoxes } from "@/services/inventory-box-endpoints";
import { createProduct, getProducts } from "@/services/product-endpoints";
import {
  analyzeDroneSnapshot,
  createDroneSnapshot,
} from "@/services/snapshot-endpoints";
import {
  captureDronePhoto,
  connectDrone,
  droneAssetUrl,
  droneMjpegUrl,
  droneWebSocketUrl,
  emergencyDrone,
  getDefaultDroneMission,
  getDroneMissionStatus,
  startDroneMission,
} from "@/services/drone-endpoints";

const FALLBACK_SCRIPT = `takeoff 0.06
up 2
forward 2.5
yaw_right 0.7
wait 1
photo
wait 1
yaw_right 0.7
forward 2.5
down 3
emergency 1
`;

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

interface DroneSnapshotModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
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

function apiErrorMessage(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
  return detail || (error instanceof Error ? error.message : fallback);
}

function formatRuntimeSeconds(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)}s`;
}

function uniquePaths(paths: string[]) {
  return Array.from(new Set(paths.filter(Boolean)));
}

function photoHref(path: string) {
  return droneAssetUrl(`/uploads/${path}`);
}

export default function DroneSnapshotModal({ open, onClose, onSaved }: DroneSnapshotModalProps) {
  const { i18n, t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeBoxes, setActiveBoxes] = useState<AiSnapshotBoxPreviewDTO[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(todayIso);
  const [script, setScript] = useState(FALLBACK_SCRIPT);
  const [streamMode, setStreamMode] = useState<DroneStreamMode>("mjpeg");
  const [streamNonce, setStreamNonce] = useState(0);
  const [wsFrameUrl, setWsFrameUrl] = useState("");
  const [status, setStatus] = useState<DroneMissionStatus>({});
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [unmatchedRows, setUnmatchedRows] = useState<DraftRow[]>([]);
  const [rawJson, setRawJson] = useState<Record<string, unknown> | null>(null);
  const [modelVersion, setModelVersion] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productDraftRowId, setProductDraftRowId] = useState<string | null>(null);
  const [creatingProductRowId, setCreatingProductRowId] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductCreationDraft>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastObjectUrl = useRef("");
  const autoAnalyzedPhotoKey = useRef("");

  const connected = Boolean(status.drone?.connected);
  const missionState = status.state || "idle";
  const missionTone: "danger" | "blue" | "green" | "neutral" =
    missionState === "error" || missionState === "emergency"
      ? "danger"
      : missionState === "running"
        ? "blue"
        : missionState === "done"
          ? "green"
          : "neutral";
  const photoKey = photoPaths.join("|");

  const mjpegUrl = useMemo(() => {
    const url = new URL(droneMjpegUrl());
    url.searchParams.set("ts", streamNonce.toString());
    return url.toString();
  }, [streamNonce]);

  const removedBoxes = useMemo(() => {
    const reviewedCodes = new Set(
      rows
        .map((row) => row.box_code?.trim())
        .filter((boxCode): boxCode is string => Boolean(boxCode)),
    );
    return activeBoxes.filter((box) => !reviewedCodes.has(box.box_code));
  }, [activeBoxes, rows]);

  const totalQuantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

  const mergePhotoPaths = (paths: Array<string | null | undefined>) => {
    const cleanPaths = paths.filter((path): path is string => Boolean(path));
    if (cleanPaths.length === 0) return;
    setPhotoPaths((current) => uniquePaths([...current, ...cleanPaths]));
  };

  const resetReview = () => {
    setRows([]);
    setUnmatchedRows([]);
    setRawJson(null);
    setModelVersion(null);
    setProductDrafts({});
    setProductDraftRowId(null);
    setCreatingProductRowId(null);
  };

  const reset = () => {
    setSnapshotName("");
    setSnapshotDate(todayIso());
    setScript(FALLBACK_SCRIPT);
    setStreamMode("mjpeg");
    setStreamNonce(0);
    setWsFrameUrl("");
    setStatus({});
    setPhotoPaths([]);
    resetReview();
    setMessage(null);
    setError(null);
    autoAnalyzedPhotoKey.current = "";
  };

  const handleClose = () => {
    if (busy || saving || analyzing) return;
    reset();
    onClose();
  };

  const showConnectionPrompt = () => {
    setError(t("drone.connectionModal.details"));
  };

  const ensureDroneConnected = () => {
    if (connected) return true;
    showConnectionPrompt();
    return false;
  };

  const refreshStatus = async () => {
    const response = await getDroneMissionStatus();
    setStatus(response.data);
    mergePhotoPaths([...(response.data.photo_paths ?? []), response.data.last_photo_path]);
    if (!response.data.drone?.connected) {
      showConnectionPrompt();
    }
    return response.data;
  };

  const refreshConnection = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await connectDrone();
      setStatus(response.data);
      mergePhotoPaths([...(response.data.photo_paths ?? []), response.data.last_photo_path]);
      refreshStream();
      setMessage(t("drone.messages.connectionRefreshed"));
    } catch (nextError) {
      setError(apiErrorMessage(nextError, t("drone.errors.connection")));
    } finally {
      setBusy(false);
    }
  };

  const refreshStream = () => {
    setStreamNonce((value) => value + 1);
  };

  const loadDefaultMission = async (showMessage = true) => {
    setError(null);
    try {
      const response = await getDefaultDroneMission();
      setScript(response.data.script);
      if (showMessage) setMessage(t("drone.messages.defaultLoaded"));
    } catch (nextError) {
      setError(apiErrorMessage(nextError, t("drone.errors.defaultMission")));
    }
  };

  const launchMission = async () => {
    if (!ensureDroneConnected()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    resetReview();
    autoAnalyzedPhotoKey.current = "";
    try {
      const response = await startDroneMission(script);
      setMessage(t("drone.messages.missionStarted", { count: response.data.steps }));
      await refreshStatus();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, t("drone.errors.mission")));
    } finally {
      setBusy(false);
    }
  };

  const emergencyStop = async () => {
    if (!ensureDroneConnected()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await emergencyDrone();
      setStatus(response.data);
      setMessage(t("drone.messages.emergencySent"));
    } catch (nextError) {
      setError(apiErrorMessage(nextError, t("drone.errors.emergency")));
    } finally {
      setBusy(false);
    }
  };

  const capturePhoto = async () => {
    if (!ensureDroneConnected()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    resetReview();
    autoAnalyzedPhotoKey.current = "";
    try {
      const response = await captureDronePhoto();
      const photo: DronePhotoResponse = response.data;
      mergePhotoPaths([photo.file_path]);
      setMessage(t("drone.messages.photoSaved", { path: photo.file_path }));
      await refreshStatus();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, t("drone.errors.photo")));
    } finally {
      setBusy(false);
    }
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
      const nextMessage = t("snapshots.ai.errors.productFields");
      setError(nextMessage);
      toast.error(nextMessage);
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
      const statusCode = (caught as { response?: { status?: number } }).response?.status;
      if (statusCode === 409) {
        const refreshedProducts = await refreshProducts();
        const product = findProductBySku(sku, refreshedProducts);
        if (product) {
          moveUnmatchedRowToReviewed({ ...row, sku }, product);
          toast.info(t("snapshots.ai.productCreate.existingSkuUsed", { sku: product.sku }));
          return;
        }
      }

      const nextMessage = t("snapshots.ai.errors.productCreate");
      setError(nextMessage);
      toast.error(nextMessage);
    } finally {
      setCreatingProductRowId(null);
    }
  };

  const analyzePhotos = async (sourcePhotoPaths = photoPaths) => {
    const paths = uniquePaths(sourcePhotoPaths);
    if (paths.length === 0) {
      const nextMessage = t("snapshots.drone.errors.photoRequired");
      setError(nextMessage);
      toast.error(nextMessage);
      return;
    }

    setAnalyzing(true);
    setError(null);
    try {
      const response = await analyzeDroneSnapshot(paths);
      setPhotoPaths(response.data.image_paths);
      setRows(draftRows(response.data.detections));
      setUnmatchedRows(draftRows(response.data.unmatched));
      setProductDrafts({});
      setProductDraftRowId(null);
      setCreatingProductRowId(null);
      setRawJson(response.data.raw_json);
      setModelVersion(response.data.model_version ?? null);
      setActiveBoxes(response.data.active_boxes);
      if (!snapshotName.trim()) {
        setSnapshotName(t("snapshots.drone.defaultName", { date: snapshotDate }));
      }
      autoAnalyzedPhotoKey.current = response.data.image_paths.join("|");
    } catch {
      const nextMessage = t("snapshots.drone.errors.analyze");
      setError(nextMessage);
      toast.error(nextMessage);
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
      const nextMessage = t("snapshots.form.errors.snapshotNameRequired");
      setError(nextMessage);
      toast.error(nextMessage);
      return;
    }
    if (!snapshotDate) {
      const nextMessage = t("snapshots.form.errors.snapshotDateRequired");
      setError(nextMessage);
      toast.error(nextMessage);
      return;
    }
    if (photoPaths.length === 0) {
      const nextMessage = t("snapshots.drone.errors.photoRequired");
      setError(nextMessage);
      toast.error(nextMessage);
      return;
    }
    if (rows.length === 0 || rows.some((row) => !row.product_id || Number(row.quantity) <= 0)) {
      const nextMessage = t("snapshots.ai.errors.reviewRows");
      setError(nextMessage);
      toast.error(nextMessage);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await createDroneSnapshot({
        name: snapshotName.trim(),
        snapshot_date: snapshotDate,
        image_paths: photoPaths,
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
      toast.success(t("snapshots.drone.success", { name: snapshotName.trim(), count: response.data.items.length }));
      onSaved();
      reset();
      onClose();
    } catch (caught) {
      const statusCode = (caught as { response?: { status?: number } }).response?.status;
      const nextMessage = statusCode === 409 ? t("snapshots.ai.errors.stalePool") : t("snapshots.drone.errors.create");
      setError(nextMessage);
      toast.error(nextMessage);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage);

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
        const nextMessage = t("snapshots.ai.errors.loadCatalog");
        setError(nextMessage);
        toast.error(nextMessage);
      })
      .finally(() => setLoadingCatalog(false));

    void refreshStatus().catch(() => undefined);
    void loadDefaultMission(false);
    refreshStream();

    const id = window.setInterval(() => {
      void refreshStatus().catch(() => undefined);
    }, 1500);

    return () => window.clearInterval(id);
  }, [open, t]);

  useEffect(() => {
    if (!open || streamMode !== "websocket") {
      if (lastObjectUrl.current) {
        URL.revokeObjectURL(lastObjectUrl.current);
        lastObjectUrl.current = "";
      }
      setWsFrameUrl("");
      return;
    }

    let cancelled = false;
    const socket = new WebSocket(droneWebSocketUrl());
    socket.binaryType = "blob";

    socket.onmessage = (event) => {
      if (cancelled || !(event.data instanceof Blob)) return;
      const nextUrl = URL.createObjectURL(event.data);
      const previousUrl = lastObjectUrl.current;
      lastObjectUrl.current = nextUrl;
      setWsFrameUrl(nextUrl);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
    };

    socket.onerror = () => {
      setError(t("drone.errors.websocket"));
    };

    return () => {
      cancelled = true;
      socket.close();
      if (lastObjectUrl.current) {
        URL.revokeObjectURL(lastObjectUrl.current);
        lastObjectUrl.current = "";
      }
    };
  }, [open, streamMode, streamNonce, t]);

  useEffect(() => {
    if (!open || missionState !== "done" || photoPaths.length === 0 || analyzing || rows.length > 0) return;
    if (autoAnalyzedPhotoKey.current === photoKey) return;
    autoAnalyzedPhotoKey.current = photoKey;
    void analyzePhotos(photoPaths);
  }, [analyzing, missionState, open, photoKey, photoPaths, rows.length]);

  if (!open) return null;

  const streamImage =
    streamMode === "mjpeg" ? (
      mjpegUrl ? (
        <img src={mjpegUrl} alt={t("drone.stream.alt")} className="h-full w-full object-contain" />
      ) : (
        <div className="grid h-full place-items-center text-sm font-semibold text-white/70">{t("drone.stream.waiting")}</div>
      )
    ) : wsFrameUrl ? (
      <img src={wsFrameUrl} alt={t("drone.stream.websocketAlt")} className="h-full w-full object-contain" />
    ) : (
      <div className="grid h-full place-items-center text-sm font-semibold text-white/70">{t("drone.stream.waiting")}</div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,35,27,0.42)] p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drone-snapshot-title"
        className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[#D9E4DD] bg-white shadow-[0_24px_70px_rgba(16,35,27,0.22)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#D9E4DD] px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Plane size={18} className="text-[#00684A]" />
              <h2 id="drone-snapshot-title" className="text-lg font-medium text-[#10231B]">
                {t("snapshots.drone.title")}
              </h2>
              <Badge tone={connected ? "green" : "warning"}>
                <Wifi size={13} />
                {connected ? t("drone.connection.connected") : t("drone.connection.standby")}
              </Badge>
              {modelVersion && <Badge tone="blue">{modelVersion}</Badge>}
            </div>
            <p className="mt-1 text-sm text-[#5B6B63]">{t("snapshots.drone.description")}</p>
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
            {message && (
              <div className="rounded-xl border border-[#B6E8CC] bg-[#E3F6EC] px-4 py-3 text-sm font-semibold text-[#00684A]">
                {message}
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
              <div className="space-y-5">
                <div className="rounded-xl border border-[#D9E4DD] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Video size={17} className="text-[#00684A]" />
                      <h3 className="text-sm font-semibold text-[#10231B]">{t("drone.stream.title")}</h3>
                    </div>
                    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#D9E4DD] bg-white p-1">
                      {(["mjpeg", "websocket"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setStreamMode(mode)}
                          className={cn(
                            "h-8 rounded-lg px-3 text-xs font-bold transition",
                            streamMode === mode ? "bg-[#00684A] text-white" : "text-[#5B6B63] hover:bg-[#F7FAF8]",
                          )}
                        >
                          {t(`drone.stream.modes.${mode}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 aspect-[4/3] overflow-hidden rounded-xl border border-[#10231B] bg-[#09100D]">
                    {streamImage}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Badge tone="blue">{t("drone.metrics.frames")}: {status.drone?.frames ?? 0}</Badge>
                    <Badge tone="neutral">{t("drone.metrics.lastFrame")}: {formatRuntimeSeconds(status.drone?.last_frame_age)}</Badge>
                    <Badge tone="neutral">{t("drone.metrics.drops")}: {status.drone?.jpeg_drops ?? 0}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void refreshConnection()} disabled={busy}>
                      <RefreshCw size={14} />
                      {t("common.actions.refresh")}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={refreshStream}>
                      <RefreshCw size={14} />
                      {t("drone.actions.refreshStream")}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => void capturePhoto()} disabled={busy}>
                      <Camera size={14} />
                      {t("drone.actions.capturePhoto")}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => void emergencyStop()} disabled={busy}>
                      <CircleStop size={14} />
                      {t("drone.actions.emergency")}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#D9E4DD] bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Plane size={17} className="text-[#00684A]" />
                      <h3 className="text-sm font-semibold text-[#10231B]">{t("drone.mission.title")}</h3>
                    </div>
                    <Badge tone={missionTone}>{t(`drone.states.${missionState}`, { defaultValue: missionState })}</Badge>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("drone.mission.scriptLabel")}</span>
                    <textarea
                      value={script}
                      onChange={(event) => setScript(event.target.value)}
                      spellCheck={false}
                      className="min-h-[180px] w-full resize-y rounded-xl border border-[#D9E4DD] bg-white px-3 py-2 font-mono text-sm leading-6 text-[#10231B] outline-none transition focus:border-[#00684A] focus:ring-4 focus:ring-[rgba(0,104,74,0.12)]"
                    />
                  </label>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button onClick={() => void launchMission()} disabled={busy}>
                      <Send size={16} />
                      {t("drone.actions.launchMission")}
                    </Button>
                    <Button variant="secondary" onClick={() => void loadDefaultMission()} disabled={busy}>
                      <RotateCcw size={16} />
                      {t("drone.actions.loadDefault")}
                    </Button>
                  </div>
                  <div className="mt-3 rounded-xl border border-[#D9E4DD] bg-[#F7FAF8] p-3 text-sm text-[#10231B]">
                    <p><span className="font-semibold">{t("drone.status.step")}:</span> {status.current_step || "-"}</p>
                    <p className="mt-1"><span className="font-semibold">{t("drone.status.message")}:</span> {status.message || "-"}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#D9E4DD] bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[#10231B]">{t("snapshots.drone.photosTitle")}</h3>
                    <Badge tone={photoPaths.length ? "green" : "neutral"}>{t("snapshots.drone.photoBadge", { count: photoPaths.length })}</Badge>
                  </div>
                  {photoPaths.length === 0 ? (
                    <p className="text-sm text-[#5B6B63]">{t("snapshots.drone.emptyPhotos")}</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {photoPaths.map((path) => (
                        <a key={path} href={photoHref(path)} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-[#D9E4DD] bg-[#EEF4F0]">
                          <img src={photoHref(path)} alt={path} className="aspect-video w-full object-cover" />
                          <span className="block truncate px-2 py-1 text-xs font-semibold text-[#00684A] group-hover:text-[#00523A]">{path}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <Button className="mt-3 w-full" onClick={() => void analyzePhotos()} disabled={analyzing || loadingCatalog || photoPaths.length === 0}>
                    {analyzing ? <UploadCloud size={18} className="animate-pulse" /> : <Camera size={18} />}
                    {analyzing ? t("snapshots.ai.actions.analyzing") : t("snapshots.drone.actions.analyze")}
                  </Button>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("snapshots.form.snapshotName")}</span>
                    <Input
                      value={snapshotName}
                      onChange={(event) => setSnapshotName(event.target.value)}
                      placeholder={t("snapshots.drone.namePlaceholder")}
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
                            {t("snapshots.drone.emptyRows")}
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
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#D9E4DD] px-6 py-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={handleClose} disabled={busy || saving || analyzing}>
            {t("common.actions.cancel")}
          </Button>
          <Button onClick={() => void handleCreate()} disabled={saving || analyzing || photoPaths.length === 0 || rows.length === 0}>
            {saving ? <UploadCloud size={18} className="animate-pulse" /> : <Save size={18} />}
            {saving ? t("common.actions.savingSnapshot") : t("snapshots.drone.actions.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
