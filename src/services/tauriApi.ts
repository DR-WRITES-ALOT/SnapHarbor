import type {
  DeviceInfo,
  AppSettings,
  StorageStats,
  SyncedMediaItem,
  ScanSummary,
  SyncProgressEvent,
  DiscoveredMediaFile,
} from "../types";

// Check if running inside Tauri environment
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<T>(cmd, args);
    } catch (err) {
      console.warn(`Tauri invoke failed for [${cmd}], falling back:`, err);
    }
  }
  return fallbackInvoke<T>(cmd, args);
}

// Fallback handlers for browser development / mock testing
function fallbackInvoke<T>(cmd: string, _args?: Record<string, unknown>): Promise<T> {
  switch (cmd) {
    case "get_devices":
      return Promise.resolve([
        {
          id: "galaxy_s23_ultra",
          name: "Samsung Galaxy S23 Ultra",
          manufacturer: "Samsung Electronics",
          is_wpd: true,
          is_connected: true,
          total_space_bytes: 512_000_000_000,
          free_space_bytes: 142_500_000_000,
          battery_level: 88,
        },
        {
          id: "sony_alpha_sd",
          name: "Sony Alpha A7 IV (SD Card)",
          manufacturer: "Sony",
          mount_path: "E:\\DCIM",
          is_wpd: false,
          is_connected: true,
          total_space_bytes: 128_000_000_000,
          free_space_bytes: 64_200_000_000,
        },
      ] as unknown as T);

    case "get_app_settings":
      return Promise.resolve({
        destination_folder: "C:\\Users\\Photos\\SnapHarbor_Backups",
        organize_by_date: "true",
        date_format: "YYYY/MM",
        auto_sync_on_connect: "false",
        delete_after_sync: "false",
        skip_duplicates: "true",
        include_videos: "true",
        enable_notifications: "true",
        minimize_to_tray: "true",
      } as unknown as T);

    case "update_app_setting":
      return Promise.resolve(true as unknown as T);

    case "get_storage_stats":
      return Promise.resolve({
        total_files_synced: 1420,
        total_bytes_synced: 48_500_000_000,
        total_devices_connected: 2,
        last_sync_timestamp: new Date().toISOString(),
      } as unknown as T);

    case "get_recent_media":
      return Promise.resolve(
        Array.from({ length: 12 }).map((_, i) => ({
          id: i + 1,
          device_id: "galaxy_s23_ultra",
          local_path: `C:\\Users\\Photos\\SnapHarbor_Backups\\2026\\08\\IMG_${2400 + i}.JPG`,
          file_size_bytes: 4_800_000 + i * 250_000,
          file_hash_sha256: `hash_mock_${i}`,
          synced_at: new Date(Date.now() - i * 3600000).toISOString(),
          deleted_from_phone: false,
        })) as unknown as T
      );

    case "scan_device_media":
      return Promise.resolve({
        total_discovered: 24,
        total_bytes: 148_000_000,
        unsynced_count: 24,
        unsynced_bytes: 148_000_000,
        files: Array.from({ length: 24 }).map((_, i) => ({
          name: `IMG_${1000 + i}.${i % 5 === 0 ? "MP4" : "JPG"}`,
          source_path: `/DCIM/Camera/IMG_${1000 + i}.${i % 5 === 0 ? "MP4" : "JPG"}`,
          file_size_bytes: i % 5 === 0 ? 38_000_000 : 4_500_000 + i * 150_000,
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
          is_video: i % 5 === 0,
        })),
      } as unknown as T);

    case "start_sync":
      return Promise.resolve(24 as unknown as T);

    case "clear_sync_history":
      return Promise.resolve(true as unknown as T);

    case "send_desktop_notification":
      return Promise.resolve(undefined as unknown as T);

    default:
      return Promise.resolve({} as unknown as T);
  }
}

export const tauriApi = {
  getDevices: () => invokeTauri<DeviceInfo[]>("get_devices"),
  getAppSettings: () => invokeTauri<AppSettings>("get_app_settings"),
  updateAppSetting: (key: string, value: string) =>
    invokeTauri<boolean>("update_app_setting", { key, value }),
  getStorageStats: () => invokeTauri<StorageStats>("get_storage_stats"),
  getRecentMedia: (limit?: number) =>
    invokeTauri<SyncedMediaItem[]>("get_recent_media", { limit }),
  clearSyncHistory: () => invokeTauri<boolean>("clear_sync_history"),
  scanDeviceMedia: (deviceId: string, path?: string) =>
    invokeTauri<ScanSummary>("scan_device_media", { deviceId, path }),
  startSync: (
    deviceId: string,
    deviceName: string,
    sourcePath?: string,
    selectedFileNames?: string[]
  ) =>
    invokeTauri<number>("start_sync", {
      deviceId,
      deviceName,
      sourcePath,
      selectedFileNames,
    }),

  openPath: async (path: string): Promise<void> => {
    if (isTauri) {
      try {
        const { openPath } = await import("@tauri-apps/plugin-opener");
        await openPath(path);
        return;
      } catch (e) {
        console.warn("Failed to open path with Tauri opener:", e);
      }
    }
    console.info("Opening local path:", path);
  },

  sendDesktopNotification: async (title: string, body: string): Promise<void> => {
    if (isTauri) {
      await invokeTauri("send_desktop_notification", { title, body });
      return;
    }

    // Web Notification API fallback in browser
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          new Notification(title, { body });
        }
      }
    }
  },

  listenTraySyncTrigger: async (callback: () => void): Promise<() => void> => {
    if (isTauri) {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const unlisten = await listen("tray://trigger-sync", () => {
          callback();
        });
        return unlisten;
      } catch (err) {
        console.warn("Could not attach tray sync event listener:", err);
      }
    }
    return () => {};
  },

  listenSyncProgress: async (
    callback: (event: SyncProgressEvent) => void,
    targetFiles?: DiscoveredMediaFile[]
  ): Promise<() => void> => {
    if (isTauri) {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const unlisten = await listen<SyncProgressEvent>("sync://progress", (event) => {
          callback(event.payload);
        });
        return unlisten;
      } catch (err) {
        console.warn("Could not attach Tauri event listener:", err);
      }
    }

    // Fallback simulation timer for browser testing
    const filesToSync: Array<{ name: string; size: number }> =
      targetFiles && targetFiles.length > 0
        ? targetFiles.map((f) => ({ name: f.name, size: f.file_size_bytes }))
        : Array.from({ length: 12 }).map((_, i) => ({
            name: `IMG_${1000 + i}.JPG`,
            size: 4_500_000 + i * 200_000,
          }));

    const total = filesToSync.length;
    const totalBytes = filesToSync.reduce((acc, f) => acc + f.size, 0);
    let currentIndex = 0;
    let bytesCopied = 0;
    const syncedNames: string[] = [];

    const interval = setInterval(() => {
      if (currentIndex < total) {
        const currentItem = filesToSync[currentIndex];
        bytesCopied += currentItem.size;
        syncedNames.push(currentItem.name);
        currentIndex += 1;

        const percent = Math.min(Math.round((currentIndex / total) * 100), 100);
        const isComplete = currentIndex === total;

        callback({
          current_file: currentItem.name,
          current_index: currentIndex,
          total_files: total,
          percent,
          bytes_copied: bytesCopied,
          total_bytes: totalBytes,
          status: isComplete ? "Sync completed!" : `Transferring ${currentIndex} of ${total}`,
          completed: isComplete,
          synced_files: [...syncedNames],
        });

        if (isComplete) {
          clearInterval(interval);
        }
      } else {
        clearInterval(interval);
      }
    }, 280);

    return () => clearInterval(interval);
  },
};
