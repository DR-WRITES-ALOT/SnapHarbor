import type {
  DeviceInfo,
  AppSettings,
  StorageStats,
  SyncedMediaItem,
  ScanSummary,
  SyncProgressEvent,
  SyncOutcome,
  DiscoveredMediaFile,
} from "../types";
import { DEFAULT_SETTINGS } from "../config/settings";
import { isTauriEnv } from "./mediaUrl";

/**
 * Tauri command bridge.
 *
 * IMPORTANT: inside a Tauri runtime backend errors are propagated to the caller.
 * They are *never* silently replaced with mock data — a failed backup must look
 * like a failed backup. The mock layer below is only used when the frontend runs
 * in a plain browser (`npm run dev` without the desktop shell), and everything it
 * returns is explicitly flagged as simulated.
 */
async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnv) {
    return fallbackInvoke<T>(cmd, args);
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/* ------------------------------------------------------------------ *
 * Browser-only demo layer (never reached inside the desktop app)
 * ------------------------------------------------------------------ */

const demoSettings: AppSettings = { ...DEFAULT_SETTINGS };
const demoFavorites = new Set<number>([1, 4, 7]);
const demoSyncedPaths = new Set<string>();

const demoDevices: DeviceInfo[] = [
  {
    id: "simulated_galaxy_s23",
    name: "Samsung Galaxy S23 (demo)",
    manufacturer: "Samsung Electronics",
    is_wpd: false,
    is_connected: true,
    total_space_bytes: 512_000_000_000,
    free_space_bytes: 142_500_000_000,
    battery_level: 88,
    is_simulated: true,
    kind: "simulated",
  },
  {
    id: "simulated_sony_sd",
    name: "Sony Alpha A7 IV (SD card demo)",
    manufacturer: "Sony",
    mount_path: "E:\\DCIM",
    is_wpd: false,
    is_connected: true,
    total_space_bytes: 128_000_000_000,
    free_space_bytes: 64_200_000_000,
    is_simulated: true,
    kind: "simulated",
  },
];

function demoGalleryItems(): SyncedMediaItem[] {
  return Array.from({ length: 48 }).map((_, i) => {
    const isVideo = i % 6 === 0;
    const dev = i % 2 === 0 ? "simulated_galaxy_s23" : "simulated_sony_sd";
    const date = new Date(Date.now() - i * 4 * 3600_000);
    const name = `IMG_${2400 + i}.${isVideo ? "MP4" : "JPG"}`;
    return {
      id: i + 1,
      device_id: dev,
      remote_path: `/DCIM/Camera/${name}`,
      local_path: `C:\\Users\\Photos\\SnapHarbor_Backups\\${date.getFullYear()}\\${String(
        date.getMonth() + 1,
      ).padStart(2, "0")}\\${name}`,
      file_size_bytes: isVideo ? 42_000_000 + i * 2_000_000 : 4_800_000 + i * 250_000,
      file_hash_sha256: `demo_hash_${i}`,
      media_created_at: date.toISOString(),
      synced_at: new Date(Date.now() - i * 1_800_000).toISOString(),
      deleted_from_phone: false,
      is_favorite: demoFavorites.has(i + 1),
      file_exists: false,
    };
  });
}

function demoScan(): ScanSummary {
  const files: DiscoveredMediaFile[] = Array.from({ length: 24 }).map((_, i) => {
    const isVideo = i % 5 === 0;
    const name = `IMG_${1000 + i}.${isVideo ? "MP4" : "JPG"}`;
    const source_path = `/DCIM/Camera/${name}`;
    return {
      name,
      source_path,
      file_size_bytes: isVideo ? 38_000_000 : 4_500_000 + i * 150_000,
      created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
      is_video: isVideo,
      is_synced: demoSyncedPaths.has(source_path),
    };
  });

  const unsynced = files.filter((f) => !f.is_synced);
  return {
    total_discovered: files.length,
    total_bytes: files.reduce((acc, f) => acc + f.file_size_bytes, 0),
    unsynced_count: unsynced.length,
    unsynced_bytes: unsynced.reduce((acc, f) => acc + f.file_size_bytes, 0),
    files,
    simulated: true,
  };
}

function fallbackInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const as = <V,>(value: V) => Promise.resolve(value as unknown as T);

  switch (cmd) {
    case "get_devices":
      return as(demoDevices);

    case "get_app_settings":
      return as({ ...demoSettings });

    case "update_app_setting": {
      const key = args?.key as keyof AppSettings;
      if (key) demoSettings[key] = String(args?.value ?? "");
      return as(true);
    }

    case "get_storage_stats":
      return as<StorageStats>({
        total_files_synced: demoGalleryItems().length,
        total_bytes_synced: demoGalleryItems().reduce(
          (acc, item) => acc + item.file_size_bytes,
          0,
        ),
        total_devices_connected: demoDevices.length,
        last_sync_timestamp: new Date().toISOString(),
      });

    case "get_recent_media":
    case "get_vault_gallery": {
      const limit = (args?.limit as number) ?? 24;
      const offset = (args?.offset as number) ?? 0;
      const deviceId = args?.deviceId as string | undefined;
      const favoritesOnly = Boolean(args?.favoritesOnly);

      let items = demoGalleryItems();
      if (deviceId) items = items.filter((item) => item.device_id === deviceId);
      if (favoritesOnly) items = items.filter((item) => item.is_favorite);
      return as(items.slice(offset, offset + limit));
    }

    case "toggle_media_favorite": {
      const mediaId = args?.mediaId as number;
      if (demoFavorites.has(mediaId)) {
        demoFavorites.delete(mediaId);
        return as(false);
      }
      demoFavorites.add(mediaId);
      return as(true);
    }

    case "scan_device_media":
      return as(demoScan());

    case "start_sync": {
      const selected = (args?.selectedFileNames as string[]) || [];
      const target = demoScan().files.filter((f) =>
        selected.length > 0 ? selected.includes(f.name) : true,
      );
      target.forEach((f) => demoSyncedPaths.add(f.source_path));
      return as<SyncOutcome>({
        synced: target.length,
        adopted: 0,
        skipped_duplicates: 0,
        failed: 0,
        errors: [],
        cancelled: false,
        simulated: true,
      });
    }

    case "cancel_sync":
      return as(true);

    case "unsync_media_item": {
      const remotePath = args?.remotePath as string | undefined;
      if (remotePath) demoSyncedPaths.delete(remotePath);
      return as(true);
    }

    case "clear_sync_history": {
      demoSyncedPaths.clear();
      return as(true);
    }

    case "send_desktop_notification":
      return as(undefined);

    default:
      return Promise.reject(new Error(`No demo handler for command "${cmd}"`));
  }
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export const tauriApi = {
  isDesktop: isTauriEnv,

  getDevices: () => invokeTauri<DeviceInfo[]>("get_devices"),

  getAppSettings: () => invokeTauri<AppSettings>("get_app_settings"),

  updateAppSetting: (key: string, value: string) =>
    invokeTauri<boolean>("update_app_setting", { key, value }),

  getStorageStats: () => invokeTauri<StorageStats>("get_storage_stats"),

  getRecentMedia: (limit = 24) => invokeTauri<SyncedMediaItem[]>("get_recent_media", { limit }),

  getVaultGallery: (limit = 100, offset = 0, deviceId?: string, favoritesOnly?: boolean) =>
    invokeTauri<SyncedMediaItem[]>("get_vault_gallery", {
      limit,
      offset,
      deviceId,
      favoritesOnly,
    }),

  toggleMediaFavorite: (mediaId: number) =>
    invokeTauri<boolean>("toggle_media_favorite", { mediaId }),

  clearSyncHistory: () => invokeTauri<boolean>("clear_sync_history"),

  scanDeviceMedia: (deviceId: string, path?: string) =>
    invokeTauri<ScanSummary>("scan_device_media", { deviceId, path }),

  unsyncMediaItem: (deviceId: string, remotePath: string) =>
    invokeTauri<boolean>("unsync_media_item", { deviceId, remotePath }),

  startSync: (
    deviceId: string,
    deviceName: string,
    sourcePath?: string,
    selectedFileNames?: string[],
  ) =>
    invokeTauri<SyncOutcome>("start_sync", {
      deviceId,
      deviceName,
      sourcePath,
      selectedFileNames,
    }),

  cancelSync: () => invokeTauri<boolean>("cancel_sync"),

  openPath: async (path: string): Promise<void> => {
    if (isTauriEnv) {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(path);
      return;
    }
    console.info("[demo] would open local path:", path);
  },

  sendDesktopNotification: async (title: string, body: string): Promise<void> => {
    if (isTauriEnv) {
      await invokeTauri("send_desktop_notification", { title, body });
      return;
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") new Notification(title, { body });
      }
    }
  },

  listenTraySyncTrigger: async (callback: () => void): Promise<() => void> => {
    if (!isTauriEnv) return () => {};
    const { listen } = await import("@tauri-apps/api/event");
    return listen("tray://trigger-sync", () => callback());
  },

  /** Subscribes to backend sync progress. Returns an unsubscribe function. */
  listenSyncProgress: async (
    callback: (event: SyncProgressEvent) => void,
    targetFiles?: DiscoveredMediaFile[],
  ): Promise<() => void> => {
    if (isTauriEnv) {
      const { listen } = await import("@tauri-apps/api/event");
      return listen<SyncProgressEvent>("sync://progress", (event) => callback(event.payload));
    }

    // Browser demo: synthesise progress so the UI can be developed without a device.
    const files =
      targetFiles && targetFiles.length > 0
        ? targetFiles.map((f) => ({ name: f.name, size: f.file_size_bytes }))
        : Array.from({ length: 12 }).map((_, i) => ({
            name: `IMG_${1000 + i}.JPG`,
            size: 4_500_000 + i * 200_000,
          }));

    const total = files.length;
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    let index = 0;
    let copied = 0;

    const timer = setInterval(() => {
      if (index >= total) {
        clearInterval(timer);
        return;
      }
      const item = files[index];
      copied += item.size;
      index += 1;
      callback({
        current_file: item.name,
        current_index: index,
        total_files: total,
        percent: Math.round((index / total) * 100),
        bytes_copied: copied,
        total_bytes: totalBytes,
        status: index === total ? "Sync completed" : `Copying ${index} of ${total}`,
        completed: index === total,
        phase: "copying",
        simulated: true,
      });
      if (index === total) clearInterval(timer);
    }, 280);

    return () => clearInterval(timer);
  },
};
