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

// In-memory mock store for favorites & synced paths in browser testing mode
const mockFavorites = new Set<number>([1, 4, 7]);
const simulatedSyncedPaths = new Set<string>();

// Fallback handlers for browser development / mock testing
function fallbackInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
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
        auto_sync_interval_mins: "0",
        min_battery_threshold: "20",
        sound_alerts_enabled: "true",
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
        total_files_synced: 1420 + simulatedSyncedPaths.size,
        total_bytes_synced: 48_500_000_000 + simulatedSyncedPaths.size * 5_000_000,
        total_devices_connected: 2,
        last_sync_timestamp: new Date().toISOString(),
      } as unknown as T);

    case "get_recent_media":
    case "get_vault_gallery": {
      const favoritesOnly = args?.favoritesOnly as boolean | undefined;
      const deviceId = args?.deviceId as string | undefined;

      const items = Array.from({ length: 32 }).map((_, i) => {
        const isVideo = i % 6 === 0;
        const dev = i % 2 === 0 ? "galaxy_s23_ultra" : "sony_alpha_sd";
        const dateOffset = i * 4 * 3600000;
        const date = new Date(Date.now() - dateOffset);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");

        return {
          id: i + 1,
          device_id: dev,
          remote_path: `/DCIM/Camera/IMG_${2400 + i}.${isVideo ? "MP4" : "JPG"}`,
          local_path: `C:\\Users\\Photos\\SnapHarbor_Backups\\${y}\\${m}\\IMG_${2400 + i}.${isVideo ? "MP4" : "JPG"}`,
          file_size_bytes: isVideo ? 42_000_000 + i * 2_000_000 : 4_800_000 + i * 250_000,
          file_hash_sha256: `hash_mock_${i}`,
          media_created_at: date.toISOString(),
          synced_at: new Date(Date.now() - i * 1800000).toISOString(),
          deleted_from_phone: false,
          is_favorite: mockFavorites.has(i + 1),
        };
      });

      let filtered = items;
      if (deviceId) {
        filtered = filtered.filter((item) => item.device_id === deviceId);
      }
      if (favoritesOnly) {
        filtered = filtered.filter((item) => item.is_favorite);
      }

      return Promise.resolve(filtered as unknown as T);
    }

    case "toggle_media_favorite": {
      const mediaId = args?.mediaId as number;
      if (mockFavorites.has(mediaId)) {
        mockFavorites.delete(mediaId);
        return Promise.resolve(false as unknown as T);
      } else {
        mockFavorites.add(mediaId);
        return Promise.resolve(true as unknown as T);
      }
    }

    case "scan_device_media": {
      const files = Array.from({ length: 24 }).map((_, i) => {
        const isVideo = i % 5 === 0;
        const name = `IMG_${1000 + i}.${isVideo ? "MP4" : "JPG"}`;
        const source_path = `/DCIM/Camera/${name}`;
        const is_synced = simulatedSyncedPaths.has(source_path);
        return {
          name,
          source_path,
          file_size_bytes: isVideo ? 38_000_000 : 4_500_000 + i * 150_000,
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
          is_video: isVideo,
          is_synced,
        };
      });

      const total_bytes = files.reduce((acc, f) => acc + f.file_size_bytes, 0);
      const unsynced = files.filter((f) => !f.is_synced);
      const unsynced_bytes = unsynced.reduce((acc, f) => acc + f.file_size_bytes, 0);

      return Promise.resolve({
        total_discovered: files.length,
        total_bytes,
        unsynced_count: unsynced.length,
        unsynced_bytes,
        files,
      } as unknown as T);
    }

    case "start_sync": {
      const selected = (args?.selectedFileNames as string[]) || [];
      if (selected.length > 0) {
        selected.forEach((name) => simulatedSyncedPaths.add(`/DCIM/Camera/${name}`));
      } else {
        for (let i = 0; i < 24; i++) {
          const isVideo = i % 5 === 0;
          simulatedSyncedPaths.add(`/DCIM/Camera/IMG_${1000 + i}.${isVideo ? "MP4" : "JPG"}`);
        }
      }
      return Promise.resolve(24 as unknown as T);
    }

    case "unsync_media_item": {
      const remotePath = args?.remotePath as string | undefined;
      if (remotePath) {
        simulatedSyncedPaths.delete(remotePath);
      }
      return Promise.resolve(true as unknown as T);
    }

    case "clear_sync_history": {
      simulatedSyncedPaths.clear();
      return Promise.resolve(true as unknown as T);
    }

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
    invokeTauri<SyncedMediaItem[]>("get_recent_media", { limit: limit || 12 }),
  getVaultGallery: (limit?: number, deviceId?: string, favoritesOnly?: boolean) =>
    invokeTauri<SyncedMediaItem[]>("get_vault_gallery", { limit: limit || 100, deviceId, favoritesOnly }),
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
