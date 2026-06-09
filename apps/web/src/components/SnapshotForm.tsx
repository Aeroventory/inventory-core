import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, UploadCloud } from "lucide-react";
import { toast } from "react-toastify";

import CameraCaptureButton from "@/components/CameraCaptureButton";
import InventoryBoxPool from "@/components/InventoryBoxPool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveFile, uploadFile } from "@/services/file-endpoints";
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

interface SnapshotFormProps {
  onSaved?: () => void;
}

export default function SnapshotForm({ onSaved }: SnapshotFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(todayIso);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [_tempFilename, setTempFilename] = useState<string | null>(null);
  const [stagedRemovedBoxIds, setStagedRemovedBoxIds] = useState<number[]>([]);
  const [poolRefreshKey, setPoolRefreshKey] = useState(0);
  const [poolStats, setPoolStats] = useState({ activeBoxCount: 0, activeUnitCount: 0 });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const uploadRes = await uploadFile(file);
      const tempName = uploadRes.data.temp_filename;
      setTempFilename(tempName);

      const saveRes = await saveFile(tempName, "snapshots");
      setFilePath(saveRes.data.file_path);
      toast.success(t("snapshots.form.uploadSuccess"));
    } catch {
      const message = t("snapshots.form.errors.uploadImage");
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
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
    setSaving(true);
    setError(null);

    try {
      const snapshotRes = await createSnapshot({
        name: name.trim(),
        file_path: filePath,
        snapshot_date: snapshotDate,
        snapshot_type: "manual",
        removed_box_ids: Array.from(new Set(stagedRemovedBoxIds)),
      });

      toast.success(t("snapshots.form.success", { name: name.trim(), count: snapshotRes.data.items.length }));
      setName("");
      setSnapshotDate(todayIso());
      setFilePath(null);
      setTempFilename(null);
      setStagedRemovedBoxIds([]);
      setPoolRefreshKey((value) => value + 1);
      onSaved?.();
    } catch {
      const message = t("snapshots.form.errors.save");
      setError(message);
      toast.error(message);
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
            <Badge tone={filePath ? "green" : "neutral"}>
              {filePath ? t("common.badges.imageSaved") : t("common.badges.imagePending")}
            </Badge>
            <Badge tone="purple">{t("snapshots.source.manual")}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("snapshots.form.snapshotName")}</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("snapshots.form.snapshotNamePlaceholder")} />
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("snapshots.form.snapshotDate")}</span>
              <Input
                type="date"
                required
                value={snapshotDate}
                onChange={(event) => setSnapshotDate(event.target.value)}
              />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("snapshots.form.snapshotImage")}</span>
            <div className="space-y-3">
              <FilePond
                allowMultiple={false}
                acceptedFileTypes={["image/*"]}
                labelIdle={t("snapshots.form.filePondLabel")}
                onaddfile={(_error, fileItem) => {
                  if (fileItem?.file) {
                    void handleFileUpload(fileItem.file as File);
                  }
                }}
                onremovefile={() => {
                  setFilePath(null);
                  setTempFilename(null);
                }}
              />
              <CameraCaptureButton
                filenamePrefix="camera-snapshot"
                buttonLabel={t("camera.actions.open")}
                title={t("camera.snapshotTitle")}
                disabled={uploading}
                onCapture={(file) => void handleFileUpload(file)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {uploading && <Badge tone="blue">{t("common.badges.uploading")}</Badge>}
              {filePath && <Badge tone="green">{t("common.badges.savedFile", { path: filePath })}</Badge>}
            </div>
          </div>
        </div>

        <section className="space-y-4 rounded-xl border border-[#D9E4DD] bg-white p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h3 className="text-base font-medium text-[#10231B]">{t("snapshots.form.poolCapture.title")}</h3>
              <p className="mt-1 text-sm text-[#5B6B63]">{t("snapshots.form.poolCapture.description")}</p>
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <Badge tone={poolStats.activeBoxCount ? "blue" : "neutral"}>{t("common.formats.boxes", { count: poolStats.activeBoxCount })}</Badge>
              <Badge tone={poolStats.activeUnitCount ? "green" : "neutral"}>{t("common.formats.units", { count: poolStats.activeUnitCount })}</Badge>
              <Badge tone={stagedRemovedBoxIds.length ? "warning" : "neutral"}>
                {t("snapshots.boxes.markedForRemovalBadge", { count: stagedRemovedBoxIds.length })}
              </Badge>
            </div>
          </div>
          <InventoryBoxPool
            isAdmin
            embedded
            refreshKey={poolRefreshKey}
            stagedRemovedBoxIds={stagedRemovedBoxIds}
            onStagedRemovedBoxIdsChange={setStagedRemovedBoxIds}
            onStatsChange={setPoolStats}
          />
        </section>

        <Button size="lg" className="w-full" disabled={saving || uploading} onClick={handleSave}>
          {saving ? <UploadCloud size={18} className="animate-pulse" /> : <Save size={18} />}
          {saving ? t("common.actions.savingSnapshot") : t("common.actions.saveSnapshot")}
        </Button>
      </CardContent>
    </Card>
  );
}
