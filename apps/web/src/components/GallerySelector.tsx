import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ImageIcon, Search, Star, UploadCloud, X } from "lucide-react";
import { FilePond, registerPlugin } from "react-filepond";
import "filepond/dist/filepond.min.css";
import FilePondPluginImagePreview from "filepond-plugin-image-preview";
import "filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { MediaAsset } from "@/models/Media";
import { getMediaAssets, uploadMediaAssets } from "@/services/media-endpoints";

registerPlugin(FilePondPluginImagePreview);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8003";

interface GallerySelectorProps {
  selectedImages: MediaAsset[];
  primaryImageId?: number | null;
  onChange: (images: MediaAsset[], primaryImageId: number | null) => void;
  title?: string;
  description?: string;
}

export default function GallerySelector({
  selectedImages,
  primaryImageId,
  onChange,
  title,
  description,
}: GallerySelectorProps) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pondKey, setPondKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => new Set(selectedImages.map((image) => image.id)),
    [selectedImages],
  );

  const effectivePrimaryId = primaryImageId ?? selectedImages[0]?.id ?? null;

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return assets;
    return assets.filter((asset) =>
      [asset.original_filename, asset.file_path]
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
      .catch(() => setError(t("gallery.errors.load")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const setSelected = (images: MediaAsset[], nextPrimaryId: number | null) => {
    onChange(images, images.some((image) => image.id === nextPrimaryId) ? nextPrimaryId : images[0]?.id ?? null);
  };

  const toggleAsset = (asset: MediaAsset) => {
    if (selectedIds.has(asset.id)) {
      const nextImages = selectedImages.filter((image) => image.id !== asset.id);
      setSelected(nextImages, effectivePrimaryId === asset.id ? nextImages[0]?.id ?? null : effectivePrimaryId);
      return;
    }
    setSelected([...selectedImages, asset], effectivePrimaryId ?? asset.id);
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadMediaAssets(pendingFiles);
      const uploadedAssets = res.data;
      setAssets((current) => [...uploadedAssets, ...current]);
      setSelected([...selectedImages, ...uploadedAssets], effectivePrimaryId ?? uploadedAssets[0]?.id ?? null);
      setPendingFiles([]);
      setPondKey((value) => value + 1);
    } catch {
      setError(t("gallery.errors.upload"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-medium text-[#10231B]">{title ?? t("gallery.title")}</p>
          {description && <p className="mt-1 text-sm text-[#5B6B63]">{description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={selectedImages.length ? "green" : "neutral"}>
            {t("gallery.selectedCount", { count: selectedImages.length })}
          </Badge>
          {uploading && <Badge tone="blue">{t("common.badges.uploading")}</Badge>}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
          {error}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
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
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        leftSlot={<Search size={16} />}
        placeholder={t("gallery.searchPlaceholder")}
      />

      {loading ? (
        <EmptyState icon={ImageIcon} title={t("gallery.loadingTitle")} description={t("gallery.loadingDescription")} />
      ) : filteredAssets.length === 0 ? (
        <EmptyState icon={ImageIcon} title={t("gallery.emptyTitle")} description={t("gallery.emptyDescription")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAssets.map((asset) => {
            const isSelected = selectedIds.has(asset.id);
            const isPrimary = effectivePrimaryId === asset.id;
            return (
              <div key={asset.id} className="overflow-hidden rounded-2xl border border-[#D9E4DD] bg-white">
                <button
                  type="button"
                  className="relative block h-32 w-full overflow-hidden bg-[#EEF4F0] text-left"
                  onClick={() => toggleAsset(asset)}
                >
                  <img
                    src={`${API_URL}/uploads/${asset.file_path}`}
                    alt={asset.original_filename || asset.file_path}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-[#10231B] shadow-sm">
                    {isSelected ? <Check size={16} /> : <X size={15} />}
                  </span>
                </button>
                <div className="space-y-3 p-3">
                  <p className="truncate text-sm font-semibold text-[#10231B]">
                    {asset.original_filename || asset.file_path}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={isSelected ? "green" : "neutral"}>
                      {isSelected ? t("gallery.selected") : t("gallery.available")}
                    </Badge>
                    {isSelected && (
                      <Button
                        size="icon"
                        variant={isPrimary ? "soft" : "secondary"}
                        aria-label={t("gallery.makePrimary")}
                        onClick={() => setSelected(selectedImages, asset.id)}
                      >
                        <Star size={15} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
