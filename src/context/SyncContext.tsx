import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type {
  DeviceInfo,
  AppSettings,
  StorageStats,
  SyncedMediaItem,
  ScanSummary,
  SyncProgressEvent,
  ToastMessage,
  DiscoveredMediaFile,
} from "../types";
import { tauriApi } from "../services/tauriApi";
import { soundEffects } from "../services/soundEffects";

interface SyncContextType {
  devices: DeviceInfo[];
  selectedDevice: DeviceInfo | null;
  setSelectedDevice: (device: DeviceInfo) => void;
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>;
  storageStats: StorageStats | null;
  recentMedia: SyncedMediaItem[];
  galleryMedia: SyncedMediaItem[];
  scanSummary: ScanSummary | null;
  isScanning: boolean;
  isSyncing: boolean;
  syncProgress: SyncProgressEvent | null;
  processedFileNames: Set<string>;
  startSync: (selectedFiles?: DiscoveredMediaFile[]) => Promise<void>;
  refreshDevices: () => Promise<void>;
  refreshStorageStats: () => Promise<void>;
  refreshGallery: (deviceId?: string, favoritesOnly?: boolean) => Promise<void>;
  toggleFavorite: (mediaId: number) => Promise<void>;
  unsyncMedia: (deviceId: string, remotePath: string, fileName: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  openDestinationFolder: () => Promise<void>;
  addSimulatedDevice: (device: DeviceInfo) => void;
  toasts: ToastMessage[];
  addToast: (title: string, description: string, type?: ToastMessage["type"]) => void;
  dismissToast: (id: string) => void;
}

const defaultSettings: AppSettings = {
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
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [recentMedia, setRecentMedia] = useState<SyncedMediaItem[]>([]);
  const [galleryMedia, setGalleryMedia] = useState<SyncedMediaItem[]>([]);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressEvent | null>(null);
  const [processedFileNames, setProcessedFileNames] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const prevDeviceIdRef = useRef<string | null>(null);

  const addToast = useCallback(
    (title: string, description: string, type: ToastMessage["type"] = "info") => {
      const id = `${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, title, description, type }]);

      if (settings.sound_alerts_enabled === "true" && type === "warning") {
        soundEffects.playWarning();
      }

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    [settings.sound_alerts_enabled]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const devList = await tauriApi.getDevices();
      setDevices(devList);
      if (devList.length > 0 && !selectedDevice) {
        setSelectedDevice(devList[0]);
      }
    } catch (e) {
      console.error("Failed to load devices:", e);
    }
  }, [selectedDevice]);

  const refreshStorageStats = useCallback(async () => {
    try {
      const stats = await tauriApi.getStorageStats();
      setStorageStats(stats);
      const media = await tauriApi.getRecentMedia(24);
      setRecentMedia(media);
    } catch (e) {
      console.error("Failed to fetch storage stats:", e);
    }
  }, []);

  const refreshGallery = useCallback(async (deviceId?: string, favoritesOnly?: boolean) => {
    try {
      const gallery = await tauriApi.getVaultGallery(100, deviceId, favoritesOnly);
      setGalleryMedia(gallery);
    } catch (e) {
      console.error("Failed to fetch vault gallery:", e);
    }
  }, []);

  const toggleFavorite = useCallback(async (mediaId: number) => {
    try {
      const isFav = await tauriApi.toggleMediaFavorite(mediaId);
      setGalleryMedia((prev) =>
        prev.map((item) =>
          item.id === mediaId ? { ...item, is_favorite: isFav } : item
        )
      );
      setRecentMedia((prev) =>
        prev.map((item) =>
          item.id === mediaId ? { ...item, is_favorite: isFav } : item
        )
      );
      addToast(
        isFav ? "Added to Favorites" : "Removed from Favorites",
        `Updated photo status in vault.`,
        "info"
      );
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
    }
  }, [addToast]);

  const refreshScan = useCallback(async (device: DeviceInfo) => {
    setIsScanning(true);
    try {
      const summary = await tauriApi.scanDeviceMedia(device.id, device.mount_path);
      setScanSummary(summary);
      setProcessedFileNames(new Set());
    } catch (e) {
      console.error("Failed to scan device media:", e);
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    tauriApi.getAppSettings().then((s) => {
      if (s && Object.keys(s).length > 0) {
        setSettings((prev) => ({ ...prev, ...s }));
      }
    });
    refreshDevices();
    refreshStorageStats();
    refreshGallery();
  }, [refreshDevices, refreshStorageStats, refreshGallery]);

  useEffect(() => {
    if (selectedDevice) {
      refreshScan(selectedDevice);
    }
  }, [selectedDevice, refreshScan]);

  const updateSetting = async (key: keyof AppSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await tauriApi.updateAppSetting(key, value);
      addToast("Settings Updated", `${key.replace(/_/g, " ")} saved.`, "success");
    } catch (e) {
      console.error(`Failed to update setting [${key}]:`, e);
      addToast("Error Saving Setting", String(e), "error");
    }
  };

  const startSync = useCallback(
    async (selectedFiles?: DiscoveredMediaFile[]) => {
      if (isSyncing || !selectedDevice) return;

      const targetList = (
        selectedFiles && selectedFiles.length > 0
          ? selectedFiles
          : scanSummary?.files || []
      ).filter((f) => !f.is_synced && !processedFileNames.has(f.name));

      if (targetList.length === 0) {
        addToast(
          "Already Backed Up",
          "The selected items are already safely backed up in your vault.",
          "info"
        );
        return;
      }

      // Battery Guard Check
      const minBattery = parseInt(settings.min_battery_threshold || "0", 10);
      if (
        selectedDevice.battery_level !== undefined &&
        minBattery > 0 &&
        selectedDevice.battery_level < minBattery
      ) {
        addToast(
          "Battery Guard Active",
          `Device battery is ${selectedDevice.battery_level}% (below ${minBattery}% safety threshold). Please charge device before syncing.`,
          "warning"
        );
        return;
      }

      const totalFiles = targetList.length;
      const totalBytes = targetList.reduce((sum, f) => sum + f.file_size_bytes, 0);
      const isSelective = !!(selectedFiles && selectedFiles.length > 0);

      setIsSyncing(true);
      setSyncProgress({
        current_file: targetList[0]?.name || "Preparing transfer...",
        current_index: 0,
        total_files: totalFiles,
        percent: 0,
        bytes_copied: 0,
        total_bytes: totalBytes,
        status: `Starting ${isSelective ? "selective" : "full"} sync...`,
        completed: false,
      });

      addToast(
        isSelective ? "Selective Sync Started" : "Sync Started",
        `Transferring ${totalFiles} item${totalFiles === 1 ? "" : "s"} from ${selectedDevice.name}...`,
        "info"
      );

      let cleanupListener: (() => void) | undefined;

      try {
        cleanupListener = await tauriApi.listenSyncProgress((progress) => {
          setSyncProgress(progress);

          if (progress.current_file) {
            setProcessedFileNames((prev) => new Set([...prev, progress.current_file]));
          }

          if (progress.completed) {
            setIsSyncing(false);
            refreshStorageStats();
            refreshGallery();
            if (selectedDevice) {
              refreshScan(selectedDevice);
            }

            // Sound chime on completion
            if (settings.sound_alerts_enabled === "true") {
              soundEffects.playSyncComplete();
            }

            // Add synced items to processed set
            if (progress.synced_files) {
              setProcessedFileNames((prev) => new Set([...prev, ...progress.synced_files!]));
            }

            if (settings.enable_notifications === "true") {
              tauriApi.sendDesktopNotification(
                "SnapHarbor Sync Complete",
                `Backed up ${progress.total_files} items from ${selectedDevice.name} to vault.`
              );
            }

            addToast(
              "Sync Complete!",
              `Successfully backed up ${progress.total_files} items to your repository.`,
              "success"
            );
          }
        }, targetList);

        await tauriApi.startSync(
          selectedDevice.id,
          selectedDevice.name,
          selectedDevice.mount_path,
          targetList.map((f) => f.name)
        );
      } catch (err) {
        console.error("Sync error:", err);
        setIsSyncing(false);
        addToast("Sync Error", String(err), "error");
      } finally {
        if (cleanupListener) {
          // cleanup
        }
      }
    },
    [
      isSyncing,
      selectedDevice,
      scanSummary,
      settings.enable_notifications,
      settings.sound_alerts_enabled,
      settings.min_battery_threshold,
      refreshStorageStats,
      refreshGallery,
      addToast,
    ]
  );

  // Auto-Sync on Device Connect Trigger
  useEffect(() => {
    if (!selectedDevice) return;

    const isNewDevice = prevDeviceIdRef.current !== selectedDevice.id;
    prevDeviceIdRef.current = selectedDevice.id;

    if (isNewDevice && selectedDevice.is_connected) {
      if (settings.sound_alerts_enabled === "true") {
        soundEffects.playDeviceConnected();
      }

      if (settings.auto_sync_on_connect === "true" && !isSyncing) {
        // Wait 1.5s for scan summary to settle, then start sync
        const timer = setTimeout(() => {
          addToast(
            "Auto-Sync Triggered",
            `Automatic backup initiated for ${selectedDevice.name}`,
            "info"
          );
          startSync();
        }, 1500);

        return () => clearTimeout(timer);
      }
    }
  }, [selectedDevice, settings.auto_sync_on_connect, settings.sound_alerts_enabled, isSyncing, startSync, addToast]);

  // Interval Background Sync Scheduler
  useEffect(() => {
    const intervalMins = parseInt(settings.auto_sync_interval_mins || "0", 10);
    if (intervalMins <= 0) return;

    const intervalMs = intervalMins * 60 * 1000;
    const intervalId = setInterval(() => {
      if (
        selectedDevice?.is_connected &&
        !isSyncing &&
        scanSummary &&
        scanSummary.unsynced_count > 0
      ) {
        addToast(
          "Scheduled Sync",
          `Running periodic backup (${intervalMins}m interval)...`,
          "info"
        );
        startSync();
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [settings.auto_sync_interval_mins, selectedDevice, isSyncing, scanSummary, startSync, addToast]);

  const unsyncMedia = useCallback(
    async (deviceId: string, remotePath: string, fileName: string) => {
      try {
        await tauriApi.unsyncMediaItem(deviceId, remotePath);
        setProcessedFileNames((prev) => {
          const next = new Set(prev);
          next.delete(fileName);
          return next;
        });

        if (selectedDevice) {
          await refreshScan(selectedDevice);
        }
        await refreshStorageStats();
        await refreshGallery();

        addToast(
          "Media Unsynced",
          `"${fileName}" has been marked as unsynced and can be backed up again.`,
          "info"
        );
      } catch (e) {
        console.error("Failed to unsync media:", e);
        addToast("Error", "Could not unsync media item.", "error");
      }
    },
    [selectedDevice, refreshScan, refreshStorageStats, refreshGallery, addToast]
  );

  const clearHistory = async () => {
    try {
      await tauriApi.clearSyncHistory();
      await refreshStorageStats();
      await refreshGallery();
      setProcessedFileNames(new Set());
      addToast("Database Reset", "All past synchronization records cleared.", "info");
    } catch (e) {
      console.error("Failed to clear history:", e);
      addToast("Error", "Could not clear database history.", "error");
    }
  };

  const openDestinationFolder = async () => {
    try {
      await tauriApi.openPath(settings.destination_folder);
      addToast("Vault Opened", `Opening ${settings.destination_folder}`, "info");
    } catch (e) {
      console.error("Failed to open path:", e);
    }
  };

  const addSimulatedDevice = (device: DeviceInfo) => {
    setDevices((prev) => {
      const exists = prev.some((d) => d.id === device.id);
      if (exists) return prev;
      return [device, ...prev];
    });
    setSelectedDevice(device);
    setProcessedFileNames(new Set());
    addToast("Device Connected", `Mounted: ${device.name}`, "success");
  };

  // Listen to system tray sync trigger
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    tauriApi.listenTraySyncTrigger(() => {
      startSync();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [startSync]);

  return (
    <SyncContext.Provider
      value={{
        devices,
        selectedDevice,
        setSelectedDevice,
        settings,
        updateSetting,
        storageStats,
        recentMedia,
        galleryMedia,
        scanSummary,
        isScanning,
        isSyncing,
        syncProgress,
        processedFileNames,
        startSync,
        refreshDevices,
        refreshStorageStats,
        refreshGallery,
        toggleFavorite,
        unsyncMedia,
        clearHistory,
        openDestinationFolder,
        addSimulatedDevice,
        toasts,
        addToast,
        dismissToast,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
};
