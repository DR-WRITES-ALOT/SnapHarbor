import type { AppSettings } from "../types";

/**
 * Single source of truth for app settings on the frontend.
 *
 * These keys MUST stay in sync with `seed_default_settings()` in
 * `src-tauri/src/db.rs` — that function is the authority for defaults in the
 * SQLite `app_settings` table. Keeping them in one place here removes the
 * previous duplication between this module and the API mock layer.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  destination_folder: "./SnapHarbor_Backups",
  organize_by_date: "true",
  date_format: "YYYY/MM",
  auto_sync_on_connect: "false",
  auto_sync_interval_mins: "0",
  min_battery_threshold: "20",
  sound_alerts_enabled: "true",
  skip_duplicates: "true",
  include_videos: "true",
  enable_notifications: "true",
  minimize_to_tray: "true",
  simulation_enabled: "false",
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

/** Settings are persisted as strings; this keeps the "true" checks in one place. */
export function isEnabled(value: string | undefined | null): boolean {
  return (value ?? "").toLowerCase() === "true";
}

export const DATE_FORMAT_OPTIONS = [
  { id: "YYYY/MM", label: "Year / Month", example: "2026/08/IMG_001.jpg" },
  { id: "YYYY-MM-DD", label: "Exact Date", example: "2026-08-27/IMG_001.jpg" },
  {
    id: "Device/YYYY-MM",
    label: "Device / Month",
    example: "Galaxy_S23/2026/08/IMG_001.jpg",
  },
] as const;

/** Mirrors `sanitize_path_component()` in `src-tauri/src/sync_engine.rs`. */
export function sanitizePathComponent(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
}
