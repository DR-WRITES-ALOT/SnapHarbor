export interface DeviceInfo {
  id: string;
  name: string;
  manufacturer?: string;
  mount_path?: string;
  is_wpd: boolean;
  is_connected: boolean;
  total_space_bytes?: number;
  free_space_bytes?: number;
  battery_level?: number;
  /** True for the built-in demo devices — never a real mount. */
  is_simulated?: boolean;
  /** How the device was discovered, for display purposes. */
  kind?: "removable" | "camera" | "internal" | "simulated";
}

export interface DiscoveredMediaFile {
  name: string;
  source_path: string;
  file_size_bytes: number;
  created_at?: string;
  is_video: boolean;
  is_synced?: boolean;
}

export interface ScanSummary {
  total_discovered: number;
  total_bytes: number;
  unsynced_count: number;
  unsynced_bytes: number;
  files: DiscoveredMediaFile[];
  /** True when the listing was produced by the demo/simulation layer. */
  simulated?: boolean;
  /** Populated when the scan could not be completed. */
  error?: string | null;
}

/** Per-file stage reported while a sync runs. */
export type SyncPhase = "hashing" | "copying" | "verifying" | "done" | "error";

export interface SyncProgressEvent {
  current_file: string;
  current_index: number;
  total_files: number;
  percent: number;
  bytes_copied: number;
  total_bytes: number;
  status: string;
  completed: boolean;
  error?: string | null;
  phase?: SyncPhase;
  cancelled?: boolean;
  simulated?: boolean;
}

/** Result of a finished (or cancelled) sync run. */
export interface SyncOutcome {
  synced: number;
  adopted: number;
  skipped_duplicates: number;
  failed: number;
  errors: string[];
  cancelled: boolean;
  simulated: boolean;
}

export interface SyncedMediaItem {
  id: number;
  device_id: string;
  remote_path?: string;
  local_path: string;
  file_size_bytes: number;
  file_hash_sha256: string;
  media_created_at?: string;
  synced_at: string;
  deleted_from_phone: boolean;
  is_favorite?: boolean;
  /** False when the recorded file is no longer on disk. */
  file_exists?: boolean;
}

export interface StorageStats {
  total_files_synced: number;
  total_bytes_synced: number;
  total_devices_connected: number;
  last_sync_timestamp?: string;
}

export interface AppSettings {
  destination_folder: string;
  organize_by_date: string;
  date_format: string;
  auto_sync_on_connect: string;
  auto_sync_interval_mins: string;
  min_battery_threshold: string;
  sound_alerts_enabled: string;
  skip_duplicates: string;
  include_videos: string;
  enable_notifications: string;
  minimize_to_tray: string;
  /** Enables the labelled demo devices / simulated transfers. */
  simulation_enabled: string;
}

export interface ToastMessage {
  id: string;
  type: "success" | "info" | "warning" | "error";
  title: string;
  description: string;
}
