import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, RefreshCw, Search, Trash2, UploadCloud } from "lucide-react";
import { toast } from "react-toastify";
import { FilePond, registerPlugin } from "react-filepond";
import "filepond/dist/filepond.min.css";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { MediaAsset } from "@/models/Media";
import { deleteMediaAsset, getMediaAssets, uploadMediaAssets } from "@/services/media-endpoints";

registerPlugin(FilePondPluginImagePreview);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8003";

export default function GalleryPage() {
  const { i18n, t } = useTranslation();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pondKey, setPondKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return assets;
    return assets.filter((asset) =>
      [asset.original_filename, asset.file_path, asset.content_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [assets, query]);

  const fetchAssets = () => {
    setLoading(true);
    setError(null);
    getMediaAssets()
      .then((res) => setAssets(res.data))
      .catch(() => {
        const message = t("gallery.errors.load");
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadMediaAssets(pendingFiles);
      setAssets((current) => [...res.data, ...current]);
      setPendingFiles([]);
      setPondKey((value) => value + 1);
      toast.success(t("gallery.success.upload", { count: res.data.length }));
    } catch {
      const message = t("gallery.errors.upload");
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (assetId: number) => {
    setDeletingId(assetId);
    setError(null);
    try {
      await deleteMediaAsset(assetId);
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
      toast.success(t("gallery.success.delete"));
    } catch {
      const message = t("gallery.errors.delete");
      setError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge tone="green">{t("gallery.badge")}</Badge>
          <h1 className="mt-3 text-3xl font-light text-[#10231B]">{t("gallery.pageTitle")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">{t("gallery.pageDescription")}</p>
        </div>
        <Button variant="secondary" onClick={fetchAssets} disabled={loading}>
          <RefreshCw size={16} />
          {t("common.actions.refresh")}
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("gallery.uploadTitle")}</CardTitle>
          <CardDescription>{t("gallery.uploadDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <FilePond
            key={pondKey}
            allowMultiple
            acceptedFileTypes={["image/*"]}
            labelIdle={t("gallery.filePondLabel")}
            onupdatefiles={(fileItems) => {
              setPendingFiles(fileItems.map((item) => item.file as File).filter(Boolean));
            }}
          />
          <Button onClick={handleUpload} disabled={pendingFiles.length === 0 || uploading}>
            <UploadCloud size={16} />
            {t("gallery.upload")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>{t("gallery.libraryTitle")}</CardTitle>
            <CardDescription>{t("gallery.selectedCount", { count: filteredAssets.length })}</CardDescription>
          </div>
          <div className="w-full xl:w-80">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              leftSlot={<Search size={16} />}
              placeholder={t("gallery.searchPlaceholder")}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <EmptyState icon={ImageIcon} title={t("gallery.loadingTitle")} description={t("gallery.loadingDescription")} />
          ) : filteredAssets.length === 0 ? (
            <EmptyState icon={ImageIcon} title={t("gallery.emptyTitle")} description={t("gallery.emptyDescription")} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filteredAssets.map((asset) => (
                <article key={asset.id} className="overflow-hidden rounded-2xl border border-[#D9E4DD] bg-white">
                  <div className="h-48 overflow-hidden bg-[#EEF4F0]">
                    <img
                      src={`${API_URL}/uploads/${asset.file_path}`}
                      alt={asset.original_filename || asset.file_path}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="truncate font-semibold text-[#10231B]">
                        {asset.original_filename || asset.file_path}
                      </p>
                      <p className="mt-1 truncate text-xs text-[#5B6B63]">/{asset.file_path}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="blue">{asset.content_type || t("common.states.unknown")}</Badge>
                      <Badge tone="neutral">{new Date(asset.created_at).toLocaleDateString(i18n.resolvedLanguage)}</Badge>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(asset.id)}
                      disabled={deletingId === asset.id}
                    >
                      <Trash2 size={15} />
                      {t("common.actions.delete")}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
