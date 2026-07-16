import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Check, RefreshCw, VideoOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CameraCaptureButtonProps {
  onCapture: (file: File) => void;
  disabled?: boolean;
  filenamePrefix?: string;
  buttonLabel?: string;
  title?: string;
}

function filenameTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "").replace(/:/g, "");
}

function safeFilenamePrefix(prefix?: string) {
  const normalized = (prefix || "camera-capture")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "camera-capture";
}

function streamErrorKey(error: unknown) {
  if (!(error instanceof DOMException)) return "start";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "permission";
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") return "notFound";
  return "start";
}

export default function CameraCaptureButton({
  onCapture,
  disabled,
  filenamePrefix,
  buttonLabel,
  title,
}: CameraCaptureButtonProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  const revokeCapturedUrl = useCallback(() => {
    setCapturedUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  const stopStream = useCallback(() => {
    requestIdRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const resetCapture = useCallback(() => {
    setCapturedFile(null);
    revokeCapturedUrl();
  }, [revokeCapturedUrl]);

  const closeModal = useCallback(() => {
    stopStream();
    resetCapture();
    setError(null);
    setStarting(false);
    setOpen(false);
  }, [resetCapture, stopStream]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("camera.errors.unsupported"));
      return;
    }

    stopStream();
    setStarting(true);
    setError(null);
    const requestId = requestIdRef.current;

    try {
      let nextStream: MediaStream;
      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (nextError) {
        if (
          nextError instanceof DOMException &&
          (nextError.name === "OverconstrainedError" || nextError.name === "ConstraintNotSatisfiedError")
        ) {
          nextStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } else {
          throw nextError;
        }
      }

      if (requestId !== requestIdRef.current) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = nextStream;
      setStream(nextStream);
    } catch (nextError) {
      setError(t(`camera.errors.${streamErrorKey(nextError)}`));
    } finally {
      if (requestId === requestIdRef.current) setStarting(false);
    }
  }, [stopStream, t]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;
    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => undefined);
  }, [stream]);

  useEffect(() => {
    if (!open || capturedFile) return;
    void startCamera();
  }, [capturedFile, open, startCamera]);

  useEffect(() => {
    return () => {
      stopStream();
      revokeCapturedUrl();
    };
  }, [revokeCapturedUrl, stopStream]);

  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setError(t("camera.errors.noFrame"));
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError(t("camera.errors.capture"));
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) {
      setError(t("camera.errors.capture"));
      return;
    }

    const file = new File(
      [blob],
      `${safeFilenamePrefix(filenamePrefix)}-${filenameTimestamp()}.jpg`,
      { type: "image/jpeg", lastModified: Date.now() },
    );
    stopStream();
    revokeCapturedUrl();
    setCapturedFile(file);
    setCapturedUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleRetake = () => {
    resetCapture();
  };

  const handleUsePhoto = () => {
    if (!capturedFile) return;
    onCapture(capturedFile);
    closeModal();
  };

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>
        <Camera size={16} />
        {buttonLabel ?? t("camera.actions.open")}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,35,27,0.42)] p-3">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-capture-title"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#D9E4DD] bg-white shadow-[0_24px_70px_rgba(16,35,27,0.22)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#D9E4DD] px-6 py-5">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-[#00684A]" />
                <h2 id="camera-capture-title" className="text-lg font-medium text-[#10231B]">
                  {title ?? t("camera.title")}
                </h2>
              </div>
              <Button size="icon" variant="ghost" aria-label={t("common.actions.cancel")} onClick={closeModal}>
                <X size={18} />
              </Button>
            </div>

            <div className="space-y-4 overflow-y-auto px-6 py-5">
              {error && (
                <div className="rounded-xl border border-[#F7B8A4] bg-[#FFF1ED] px-4 py-3 text-sm font-semibold text-[#C2410C]">
                  {error}
                </div>
              )}

              <div className="grid aspect-video place-items-center overflow-hidden rounded-xl border border-[#D9E4DD] bg-[#10231B]">
                {capturedUrl ? (
                  <img src={capturedUrl} alt={t("camera.previewAlt")} className="h-full w-full object-contain" />
                ) : stream ? (
                  <video
                    ref={videoRef}
                    className="h-full w-full object-contain"
                    autoPlay
                    muted
                    playsInline
                    aria-label={t("camera.liveLabel")}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-sm font-semibold text-white/70">
                    {starting ? <RefreshCw size={28} className="animate-spin" /> : <VideoOff size={28} />}
                    <span>{starting ? t("camera.actions.starting") : t("camera.states.notStarted")}</span>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  <X size={16} />
                  {t("common.actions.cancel")}
                </Button>
                {capturedFile ? (
                  <>
                    <Button type="button" variant="secondary" onClick={handleRetake}>
                      <RefreshCw size={16} />
                      {t("camera.actions.retake")}
                    </Button>
                    <Button type="button" onClick={handleUsePhoto}>
                      <Check size={16} />
                      {t("camera.actions.usePhoto")}
                    </Button>
                  </>
                ) : stream ? (
                  <Button type="button" onClick={handleCapture} disabled={starting}>
                    <Camera size={16} />
                    {t("camera.actions.capture")}
                  </Button>
                ) : (
                  <Button type="button" onClick={() => void startCamera()} disabled={starting}>
                    <RefreshCw size={16} className={starting ? "animate-spin" : undefined} />
                    {starting ? t("camera.actions.starting") : t("camera.actions.retry")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
