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
}

export interface DiscoveredMediaFile {
  name: string;
  source_path: string;
  file_size_bytes: number;
  created_at?: string;
  is_video: boolean;
}

export interface ScanSummary {
  total_discovered: number;
  total_bytes: number;
  unsynced_count: number;
  unsynced_bytes: number;
  files: DiscoveredMediaFile[];
}

export interface SyncProgressEvent {
  current_file: string;
  current_index: number;
  total_files: number;
  percent: number;
  bytes_copied: number;
  total_bytes: number;
  status: string;
  completed: boolean;
  error?: string;
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
  delete_after_sync: string;
  skip_duplicates: string;
  include_videos: string;
}
