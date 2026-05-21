import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ImagePlus, Save, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GallerySelector from "@/components/GallerySelector";
import { Input } from "@/components/ui/input";
import { MediaAsset } from "@/models/Media";
import { saveFile, uploadFile } from "@/services/file-endpoints";
import { updateSnapshotMedia } from "@/services/media-endpoints";
import { createSnapshot } from "@/services/snapshot-endpoints";

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

function mediaAttachments(images: MediaAsset[], primaryImageId: number | null) {
  return images.map((image, index) => ({
    media_asset_id: image.id,
    sort_order: index,
    is_primary: image.id === primaryImageId,
  }));
}

interface SnapshotFormProps {
  activeBoxCount?: number;
  activeUnitCount?: number;
  onSaved?: () => void;
}

export default function SnapshotForm({
  activeBoxCount = 0,
  activeUnitCount = 0,
  onSaved,
}: SnapshotFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(todayIso);
  const [isManual, setIsManual] = useState(true);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [tempFilename, setTempFilename] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<MediaAsset[]>([]);
  const [primaryImageId, setPrimaryImageId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t("snapshots.form.errors.snapshotNameRequired"));
      return;
    }
    if (!snapshotDate) {
      setError(t("snapshots.form.errors.snapshotDateRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const snapshotRes = await createSnapshot({
        name: name.trim(),
        file_path: filePath,
        snapshot_date: snapshotDate,
        is_manual: isManual,
      });
      if (selectedImages.length > 0) {
        await updateSnapshotMedia(snapshotRes.data.id, {
          attachments: mediaAttachments(selectedImages, primaryImageId),
        });
      }

      setSuccess(t("snapshots.form.success", { name: name.trim(), count: snapshotRes.data.items.length }));
      setName("");
      setSnapshotDate(todayIso());
      setIsManual(true);
      setFilePath(null);
      setTempFilename(null);
      setSelectedImages([]);
      setPrimaryImageId(null);
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
            <Badge tone={filePath || selectedImages.length ? "green" : "neutral"}>
              {filePath || selectedImages.length ? t("common.badges.imageSaved") : t("common.badges.imagePending")}
            </Badge>
            <Badge tone={isManual ? "purple" : "blue"}>
              {isManual ? t("snapshots.source.manual") : t("snapshots.source.drone")}
            </Badge>
            <Badge tone={activeBoxCount ? "blue" : "neutral"}>
              {t("common.formats.compactPair", {
                first: t("common.formats.boxes", { count: activeBoxCount }),
                second: t("common.formats.units", { count: activeUnitCount }),
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

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("snapshots.form.snapshotDate")}</span>
                <Input
                  type="date"
                  required
                  value={snapshotDate}
                  onChange={(event) => setSnapshotDate(event.target.value)}
                />
              </label>
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("snapshots.form.snapshotSource")}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isManual}
                  className="flex h-10 min-w-[170px] items-center justify-between gap-3 rounded-xl border border-[#D9E4DD] bg-white px-3 text-sm font-semibold text-[#10231B] outline-none transition focus:border-[#00684A] focus:ring-4 focus:ring-[rgba(0,104,74,0.12)]"
                  onClick={() => setIsManual((value) => !value)}
                >
                  <span>{isManual ? t("snapshots.source.manual") : t("snapshots.source.drone")}</span>
                  <span
                    className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                      isManual ? "justify-end bg-[#00684A]" : "justify-start bg-[#94A3B8]"
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
                  </span>
                </button>
              </div>
            </div>

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

            <GallerySelector
              selectedImages={selectedImages}
              primaryImageId={primaryImageId}
              onChange={(images, nextPrimaryImageId) => {
                setSelectedImages(images);
                setPrimaryImageId(nextPrimaryImageId);
              }}
              title={t("snapshots.form.galleryTitle")}
              description={t("snapshots.form.galleryDescription")}
            />
          </div>

          <div className="rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4">
            <ImagePlus size={22} className="mb-3 text-[#00684A]" />
            <p className="font-medium text-[#10231B]">{t("snapshots.form.poolCapture.title")}</p>
            <p className="mt-2 text-sm text-[#5B6B63]">{t("snapshots.form.poolCapture.description")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={activeBoxCount ? "blue" : "neutral"}>{t("common.formats.boxes", { count: activeBoxCount })}</Badge>
              <Badge tone={activeUnitCount ? "green" : "neutral"}>{t("common.formats.units", { count: activeUnitCount })}</Badge>
            </div>
          </div>
        </div>

        <Button size="lg" className="w-full" disabled={saving || uploading} onClick={handleSave}>
          {saving ? <UploadCloud size={18} className="animate-pulse" /> : <Save size={18} />}
          {saving ? t("common.actions.savingSnapshot") : t("common.actions.saveSnapshot")}
        </Button>
      </CardContent>
    </Card>
  );
}
