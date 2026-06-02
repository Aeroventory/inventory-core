import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Camera, CircleStop, Info, Plane, RefreshCw, RotateCcw, Send, Video, Wifi, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DroneMissionStatus, DronePhotoResponse, DroneStreamMode } from "@/models/Drone";
import {
  captureDronePhoto,
  connectDrone,
  createDroneStreamToken,
  droneAssetUrl,
  droneMjpegUrl,
  droneWebSocketUrl,
  emergencyDrone,
  getDefaultDroneMission,
  getDroneMissionStatus,
  startDroneMission,
} from "@/services/drone-endpoints";

const FALLBACK_SCRIPT = `takeoff 0.06
wait 2
back 0.3
yaw_left 0.3
neutral 0.5
yaw_right 0.5
wait 0.6
photo
down 3
emergency 1
`;

function apiErrorMessage(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
  return detail || (error instanceof Error ? error.message : fallback);
}

function formatRuntimeSeconds(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)}s`;
}

function photoHref(photo: DronePhotoResponse | null, status: DroneMissionStatus) {
  const path = photo?.url || status.last_photo_url;
  return path ? droneAssetUrl(path) : "";
}

export default function DroneMissionPage() {
  const { t } = useTranslation();
  const [script, setScript] = useState(FALLBACK_SCRIPT);
  const [streamMode, setStreamMode] = useState<DroneStreamMode>("mjpeg");
  const [streamToken, setStreamToken] = useState("");
  const [streamNonce, setStreamNonce] = useState(0);
  const [wsFrameUrl, setWsFrameUrl] = useState("");
  const [status, setStatus] = useState<DroneMissionStatus>({});
  const [lastPhoto, setLastPhoto] = useState<DronePhotoResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const connectionPromptShown = useRef(false);
  const lastObjectUrl = useRef("");

  const connected = Boolean(status.drone?.connected);
  const missionState = status.state || "idle";
  const missionTone = missionState === "error" || missionState === "emergency" ? "danger" : missionState === "running" ? "blue" : missionState === "done" ? "green" : "neutral";
  const currentPhotoHref = photoHref(lastPhoto, status);

  const mjpegUrl = useMemo(() => {
    if (!streamToken) return "";
    const url = new URL(droneMjpegUrl(streamToken));
    url.searchParams.set("ts", streamNonce.toString());
    return url.toString();
  }, [streamNonce, streamToken]);

  const showConnectionPrompt = (once = false) => {
    if (once && connectionPromptShown.current) return;
    connectionPromptShown.current = true;
    setConnectionModalOpen(true);
  };

  const ensureDroneConnected = () => {
    if (connected) return true;
    showConnectionPrompt();
    return false;
  };

  const refreshStatus = async () => {
    try {
      const response = await getDroneMissionStatus();
      setStatus(response.data);
      if (!response.data.drone?.connected) {
        showConnectionPrompt(true);
      }
    } catch (nextError) {
      showConnectionPrompt(true);
      throw nextError;
    }
  };

  const refreshConnection = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await connectDrone();
      setStatus(response.data);
      if (!response.data.drone?.connected) {
        showConnectionPrompt();
      } else {
        setConnectionModalOpen(false);
      }
      await refreshStreamToken();
      setMessage(t("drone.messages.connectionRefreshed"));
    } catch (nextError) {
      showConnectionPrompt();
      setError(apiErrorMessage(nextError, t("drone.errors.connection")));
    } finally {
      setBusy(false);
    }
  };

  const refreshStreamToken = async () => {
    setStreamLoading(true);
    setError(null);
    try {
      const response = await createDroneStreamToken();
      setStreamToken(response.data.token);
      setStreamNonce((value) => value + 1);
      return response.data.token;
    } catch (nextError) {
      showConnectionPrompt(true);
      setError(apiErrorMessage(nextError, t("drone.errors.streamToken")));
      return "";
    } finally {
      setStreamLoading(false);
    }
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
    try {
      const response = await captureDronePhoto();
      setLastPhoto(response.data);
      setMessage(t("drone.messages.photoSaved", { path: response.data.file_path }));
      await refreshStatus();
    } catch (nextError) {
      setError(apiErrorMessage(nextError, t("drone.errors.photo")));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refreshStatus().catch(() => undefined);
    void loadDefaultMission(false);
    void refreshStreamToken();

    const id = window.setInterval(() => {
      void refreshStatus().catch(() => undefined);
    }, 1500);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (streamMode !== "websocket") {
      if (lastObjectUrl.current) {
        URL.revokeObjectURL(lastObjectUrl.current);
        lastObjectUrl.current = "";
      }
      setWsFrameUrl("");
      return;
    }

    if (!streamToken) return;

    let cancelled = false;
    const socket = new WebSocket(droneWebSocketUrl(streamToken));
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
      showConnectionPrompt(true);
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
  }, [streamMode, streamToken, t]);

  useEffect(() => {
    if (!connectionModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConnectionModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [connectionModalOpen]);

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
    <div className="space-y-6">
      {connectionModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#10231B]/55 px-4 py-8" role="presentation" onMouseDown={() => setConnectionModalOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="drone-network-modal-title"
            aria-describedby="drone-network-modal-description"
            className="w-full max-w-lg rounded-2xl border border-[#D9E4DD] bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF7ED] text-[#B7791F]">
                  <Wifi size={20} />
                </div>
                <div>
                  <h2 id="drone-network-modal-title" className="text-xl font-semibold text-[#10231B]">
                    {t("drone.connectionModal.title")}
                  </h2>
                  <p id="drone-network-modal-description" className="mt-2 text-sm leading-6 text-[#5B6B63]">
                    {t("drone.connectionModal.description")}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setConnectionModalOpen(false)}
                aria-label={t("drone.connectionModal.close")}
                className="shrink-0"
              >
                <X size={17} />
              </Button>
            </div>

            <div className="mt-5 rounded-xl border border-[#D9E4DD] bg-[#F7FAF8] p-4 text-sm leading-6 text-[#10231B]">
              {t("drone.connectionModal.details")}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConnectionModalOpen(false)}>
                {t("drone.connectionModal.dismiss")}
              </Button>
              <Button type="button" onClick={() => void refreshConnection()} disabled={busy}>
                <RefreshCw size={16} />
                {t("common.actions.refresh")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge tone={connected ? "green" : "warning"}>
            <Wifi size={13} />
            {connected ? t("drone.connection.connected") : t("drone.connection.standby")}
          </Badge>
          <h1 className="mt-3 text-3xl font-light text-[#10231B]">{t("drone.page.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">{t("drone.page.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => showConnectionPrompt()}
            aria-label={t("drone.connectionModal.openInfo")}
            title={t("drone.connectionModal.openInfo")}
          >
            <Info size={16} />
          </Button>
          <Button variant="secondary" onClick={() => void refreshConnection()} disabled={busy}>
            <RefreshCw size={16} />
            {t("common.actions.refresh")}
          </Button>
          <Button variant="secondary" onClick={capturePhoto} disabled={busy}>
            <Camera size={16} />
            {t("drone.actions.capturePhoto")}
          </Button>
          <Button variant="danger" onClick={emergencyStop} disabled={busy}>
            <CircleStop size={16} />
            {t("drone.actions.emergency")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-2xl border border-[#B6E8CC] bg-[#E3F6EC] px-4 py-3 text-sm font-semibold text-[#00684A]">
          {message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video size={18} className="text-[#00684A]" />
                {t("drone.stream.title")}
              </CardTitle>
              <CardDescription>{t("drone.stream.description")}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
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
              <Button variant="secondary" size="sm" onClick={() => void refreshStreamToken()} disabled={streamLoading}>
                {streamLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {t("drone.actions.refreshStream")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-[#10231B] bg-[#09100D]">
              {streamImage}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-3">
                <p className="text-xs font-semibold uppercase text-[#5B6B63]">{t("drone.metrics.frames")}</p>
                <p className="mt-1 text-2xl font-medium text-[#10231B]">{status.drone?.frames ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-3">
                <p className="text-xs font-semibold uppercase text-[#5B6B63]">{t("drone.metrics.lastFrame")}</p>
                <p className="mt-1 text-2xl font-medium text-[#10231B]">{formatRuntimeSeconds(status.drone?.last_frame_age)}</p>
              </div>
              <div className="rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-3">
                <p className="text-xs font-semibold uppercase text-[#5B6B63]">{t("drone.metrics.drops")}</p>
                <p className="mt-1 text-2xl font-medium text-[#10231B]">{status.drone?.jpeg_drops ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-3">
                <p className="text-xs font-semibold uppercase text-[#5B6B63]">{t("drone.metrics.mode")}</p>
                <p className="mt-1 truncate text-lg font-medium text-[#10231B]">{t(`drone.stream.modes.${streamMode}`)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Plane size={18} className="text-[#00684A]" />
                  {t("drone.mission.title")}
                </CardTitle>
                <CardDescription>{t("drone.mission.description")}</CardDescription>
              </div>
              <Badge tone={missionTone}>{t(`drone.states.${missionState}`, { defaultValue: missionState })}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase text-[#5B6B63]">{t("drone.mission.scriptLabel")}</span>
              <textarea
                value={script}
                onChange={(event) => setScript(event.target.value)}
                spellCheck={false}
                className="min-h-[280px] w-full resize-y rounded-xl border border-[#D9E4DD] bg-white px-3 py-2 font-mono text-sm leading-6 text-[#10231B] outline-none transition focus:border-[#00684A] focus:ring-4 focus:ring-[rgba(0,104,74,0.12)]"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={launchMission} disabled={busy}>
                <Send size={16} />
                {t("drone.actions.launchMission")}
              </Button>
              <Button variant="secondary" onClick={() => void loadDefaultMission()} disabled={busy}>
                <RotateCcw size={16} />
                {t("drone.actions.loadDefault")}
              </Button>
            </div>

            <div className="space-y-3 rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#5B6B63]">{t("drone.status.step")}</p>
                <p className="mt-1 break-words text-sm font-semibold text-[#10231B]">{status.current_step || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#5B6B63]">{t("drone.status.message")}</p>
                <p className="mt-1 break-words text-sm text-[#10231B]">{status.message || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#5B6B63]">{t("drone.status.photo")}</p>
                {currentPhotoHref ? (
                  <a href={currentPhotoHref} target="_blank" rel="noreferrer" className="mt-1 block break-words text-sm font-semibold text-[#00684A] hover:text-[#00523A]">
                    {lastPhoto?.file_path || status.last_photo_path}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-[#10231B]">-</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
