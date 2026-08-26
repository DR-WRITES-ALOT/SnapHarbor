import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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

  const addToast = useCallback(
    (title: string, description: string, type: ToastMessage["type"] = "info") => {
      const id = `${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, title, description, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
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
        setSettings(s);
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

      const targetList =
        selectedFiles && selectedFiles.length > 0
          ? selectedFiles
          : scanSummary?.files || [];

      if (targetList.length === 0) {
        addToast("No Media", "No media files available to sync.", "warning");
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
    [isSyncing, selectedDevice, scanSummary, settings.enable_notifications, refreshStorageStats, refreshGallery, addToast]
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
