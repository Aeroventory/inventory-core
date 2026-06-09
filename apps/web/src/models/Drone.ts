export type DroneStreamMode = "mjpeg" | "websocket";

export interface DroneRuntimeStatus {
  connected?: boolean;
  frames?: number;
  last_frame_age?: number | null;
  jpeg_drops?: number;
  last_drop?: string;
  config?: Record<string, unknown>;
}

export interface DroneMissionStatus {
  state?: string;
  message?: string;
  current_step?: string;
  last_photo_path?: string | null;
  last_photo_url?: string | null;
  photo_paths?: string[];
  photo_urls?: string[];
  started_at?: number | null;
  finished_at?: number | null;
  drone?: DroneRuntimeStatus;
}

export interface DroneMissionStartResponse {
  state: string;
  steps: number;
}

export interface DroneDefaultMissionResponse {
  script: string;
}

export interface DronePhotoResponse {
  file_path: string;
  url: string;
}
