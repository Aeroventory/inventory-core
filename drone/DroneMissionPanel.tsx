import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

type StreamMode = "mjpeg" | "websocket";

type MissionStatus = {
  state?: string;
  message?: string;
  current_step?: string;
  last_photo_path?: string | null;
  drone?: {
    connected?: boolean;
    frames?: number;
    last_frame_age?: number | null;
    jpeg_drops?: number;
    last_drop?: string;
  };
};

const DEFAULT_SCRIPT = `takeoff 0.06
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

function wsUrl(path: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

export default function DroneMissionPanel() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [streamMode, setStreamMode] = useState<StreamMode>("mjpeg");
  const [wsFrameUrl, setWsFrameUrl] = useState<string>("");
  const [status, setStatus] = useState<MissionStatus>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lastObjectUrl = useRef<string>("");

  const mjpegUrl = useMemo(
    () => `/api/drone/stream.mjpg?ts=${streamMode === "mjpeg" ? Date.now() : 0}`,
    [streamMode],
  );

  useEffect(() => {
    if (streamMode !== "websocket") {
      if (lastObjectUrl.current) {
        URL.revokeObjectURL(lastObjectUrl.current);
        lastObjectUrl.current = "";
      }
      setWsFrameUrl("");
      return;
    }

    let cancelled = false;
    const socket = new WebSocket(wsUrl("/api/drone/ws/stream"));
    socket.binaryType = "blob";

    socket.onmessage = (event) => {
      if (cancelled || !(event.data instanceof Blob)) {
        return;
      }
      const nextUrl = URL.createObjectURL(event.data);
      const previousUrl = lastObjectUrl.current;
      lastObjectUrl.current = nextUrl;
      setWsFrameUrl(nextUrl);
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
    };

    socket.onerror = () => {
      setMessage("WebSocket stream error");
    };

    return () => {
      cancelled = true;
      socket.close();
      if (lastObjectUrl.current) {
        URL.revokeObjectURL(lastObjectUrl.current);
        lastObjectUrl.current = "";
      }
    };
  }, [streamMode]);

  async function refreshStatus() {
    const response = await fetch("/api/drone/mission/status");
    const data = await response.json();
    setStatus(data);
  }

  async function launchMission() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/drone/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Mission request failed");
      }
      setMessage(`Mission started (${data.steps} steps)`);
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mission request failed");
    } finally {
      setBusy(false);
    }
  }

  async function emergencyStop() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/drone/emergency", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Emergency request failed");
      }
      setStatus(data);
      setMessage("Emergency sent");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Emergency request failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refreshStatus().catch(() => undefined);
    const id = window.setInterval(() => {
      refreshStatus().catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section style={styles.shell}>
      <div style={styles.streamPanel}>
        <div style={styles.toolbar}>
          <button
            type="button"
            onClick={() => setStreamMode("mjpeg")}
            style={streamMode === "mjpeg" ? styles.activeButton : styles.button}
          >
            MJPEG
          </button>
          <button
            type="button"
            onClick={() => setStreamMode("websocket")}
            style={streamMode === "websocket" ? styles.activeButton : styles.button}
          >
            WebSocket
          </button>
          <button type="button" onClick={refreshStatus} style={styles.button}>
            Refresh
          </button>
        </div>

        {streamMode === "mjpeg" ? (
          <img src={mjpegUrl} alt="Drone stream" style={styles.streamImage} />
        ) : wsFrameUrl ? (
          <img src={wsFrameUrl} alt="Drone WebSocket stream" style={styles.streamImage} />
        ) : (
          <div style={styles.placeholder}>Waiting for WebSocket frames...</div>
        )}
      </div>

      <div style={styles.controlPanel}>
        <label style={styles.label}>
          Mission script
          <textarea
            value={script}
            onChange={(event) => setScript(event.target.value)}
            spellCheck={false}
            style={styles.textarea}
          />
        </label>

        <div style={styles.actions}>
          <button type="button" onClick={launchMission} disabled={busy} style={styles.primary}>
            Launch automission
          </button>
          <button type="button" onClick={emergencyStop} disabled={busy} style={styles.danger}>
            Emergency
          </button>
        </div>

        {message && <div style={styles.message}>{message}</div>}

        <div style={styles.statusBox}>
          <strong>Status:</strong> {status.state || "unknown"}
          <br />
          <strong>Step:</strong> {status.current_step || "-"}
          <br />
          <strong>Message:</strong> {status.message || "-"}
          <br />
          <strong>Photo:</strong> {status.last_photo_path || "-"}
          <br />
          <strong>Frames:</strong> {status.drone?.frames ?? 0}
          <br />
          <strong>Drops:</strong> {status.drone?.jpeg_drops ?? 0}
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 1fr) 380px",
    gap: 16,
    alignItems: "start",
    width: "100%",
  },
  streamPanel: {
    minWidth: 0,
  },
  toolbar: {
    display: "flex",
    gap: 8,
    marginBottom: 8,
  },
  streamImage: {
    display: "block",
    width: "100%",
    maxWidth: 800,
    aspectRatio: "4 / 3",
    objectFit: "contain",
    background: "#111",
    border: "1px solid #333",
  },
  placeholder: {
    display: "grid",
    placeItems: "center",
    width: "100%",
    maxWidth: 800,
    aspectRatio: "4 / 3",
    color: "#ddd",
    background: "#111",
    border: "1px solid #333",
  },
  controlPanel: {
    display: "grid",
    gap: 12,
  },
  label: {
    display: "grid",
    gap: 6,
    fontWeight: 600,
  },
  textarea: {
    minHeight: 250,
    resize: "vertical",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    lineHeight: 1.45,
    padding: 10,
  },
  actions: {
    display: "flex",
    gap: 8,
  },
  button: {
    padding: "8px 10px",
    border: "1px solid #999",
    background: "#f6f6f6",
    cursor: "pointer",
  },
  activeButton: {
    padding: "8px 10px",
    border: "1px solid #333",
    background: "#222",
    color: "#fff",
    cursor: "pointer",
  },
  primary: {
    padding: "10px 12px",
    border: "1px solid #1b6",
    background: "#159957",
    color: "#fff",
    cursor: "pointer",
  },
  danger: {
    padding: "10px 12px",
    border: "1px solid #b22",
    background: "#c62828",
    color: "#fff",
    cursor: "pointer",
  },
  message: {
    padding: 10,
    background: "#f4f4f4",
    border: "1px solid #ddd",
  },
  statusBox: {
    padding: 10,
    background: "#fafafa",
    border: "1px solid #ddd",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    lineHeight: 1.5,
  },
};
