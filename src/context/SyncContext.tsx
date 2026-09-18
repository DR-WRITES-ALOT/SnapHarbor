import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  DeviceInfo,
  AppSettings,
  StorageStats,
  SyncedMediaItem,
  ScanSummary,
  SyncProgressEvent,
  SyncOutcome,
  ToastMessage,
  DiscoveredMediaFile,
} from "../types";
import { tauriApi } from "../services/tauriApi";
import { soundEffects } from "../services/soundEffects";
import { DEFAULT_SETTINGS, isEnabled } from "../config/settings";

const GALLERY_PAGE_SIZE = 100;

interface SyncContextType {
  devices: DeviceInfo[];
  selectedDevice: DeviceInfo | null;
  setSelectedDevice: (device: DeviceInfo) => void;
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>;
  isSimulationEnabled: boolean;
  storageStats: StorageStats | null;
  recentMedia: SyncedMediaItem[];
  galleryMedia: SyncedMediaItem[];
  hasMoreGallery: boolean;
  loadMoreGallery: () => Promise<void>;
  scanSummary: ScanSummary | null;
  isScanning: boolean;
  isSyncing: boolean;
  syncProgress: SyncProgressEvent | null;
  lastSyncOutcome: SyncOutcome | null;
  processedFileNames: Set<string>;
  startSync: (selectedFiles?: DiscoveredMediaFile[]) => Promise<void>;
  cancelSync: () => Promise<void>;
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

const SyncContext = createContext<SyncContextType | undefined>(undefined);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevice, setSelectedDeviceState] = useState<DeviceInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [recentMedia, setRecentMedia] = useState<SyncedMediaItem[]>([]);
  const [galleryMedia, setGalleryMedia] = useState<SyncedMediaItem[]>([]);
  const [hasMoreGallery, setHasMoreGallery] = useState(false);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressEvent | null>(null);
  const [lastSyncOutcome, setLastSyncOutcome] = useState<SyncOutcome | null>(null);
  const [processedFileNames, setProcessedFileNames] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const prevDeviceIdRef = useRef<string | null>(null);
  const galleryFilterRef = useRef<{ deviceId?: string; favoritesOnly?: boolean }>({});

  const isSimulationEnabled = isEnabled(settings.simulation_enabled);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (title: string, description: string, type: ToastMessage["type"] = "info") => {
      const id = `${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, title, description, type }]);
      if (isEnabled(settings.sound_alerts_enabled) && type === "warning") {
        soundEffects.playWarning();
      }
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, type === "error" ? 9000 : 5000);
    },
    [settings.sound_alerts_enabled],
  );

  /** Surfaces a backend failure to the user instead of swallowing it. */
  const reportError = useCallback(
    (title: string, error: unknown) => {
      const message = errorMessage(error);
      console.error(`${title}:`, error);
      addToast(title, message, "error");
    },
    [addToast],
  );

  const setSelectedDevice = useCallback((device: DeviceInfo) => {
    setSelectedDeviceState(device);
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const devList = await tauriApi.getDevices();
      setDevices(devList);
      setSelectedDeviceState((prev) => {
        if (prev && devList.some((d) => d.id === prev.id)) return prev;
        return devList.length > 0 ? devList[0] : null;
      });
    } catch (error) {
      reportError("Could not list connected devices", error);
    }
  }, [reportError]);

  const refreshStorageStats = useCallback(async () => {
    try {
      const stats = await tauriApi.getStorageStats();
      setStorageStats(stats);
      const media = await tauriApi.getRecentMedia(24);
      setRecentMedia(media);
    } catch (error) {
      reportError("Could not load vault statistics", error);
    }
  }, [reportError]);

  const refreshGallery = useCallback(
    async (deviceId?: string, favoritesOnly?: boolean) => {
      galleryFilterRef.current = { deviceId, favoritesOnly };
      try {
        const gallery = await tauriApi.getVaultGallery(
          GALLERY_PAGE_SIZE,
          0,
          deviceId,
          favoritesOnly,
        );
        setGalleryMedia(gallery);
        setHasMoreGallery(gallery.length === GALLERY_PAGE_SIZE);
      } catch (error) {
        reportError("Could not load the vault gallery", error);
      }
    },
    [reportError],
  );

  const loadMoreGallery = useCallback(async () => {
    const { deviceId, favoritesOnly } = galleryFilterRef.current;
    try {
      const next = await tauriApi.getVaultGallery(
        GALLERY_PAGE_SIZE,
        galleryMedia.length,
        deviceId,
        favoritesOnly,
      );
      setGalleryMedia((prev) => [...prev, ...next]);
      setHasMoreGallery(next.length === GALLERY_PAGE_SIZE);
    } catch (error) {
      reportError("Could not load more media", error);
    }
  }, [galleryMedia.length, reportError]);

  const refreshScan = useCallback(
    async (device: DeviceInfo) => {
      setIsScanning(true);
      try {
        const summary = await tauriApi.scanDeviceMedia(device.id, device.mount_path);
        setScanSummary(summary);
        setProcessedFileNames(new Set());
        if (summary.error) {
          addToast("Scan Incomplete", summary.error, "error");
        }
      } catch (error) {
        setScanSummary(null);
        reportError("Could not scan this device", error);
      } finally {
        setIsScanning(false);
      }
    },
    [addToast, reportError],
  );

  const toggleFavorite = useCallback(
    async (mediaId: number) => {
      try {
        const isFav = await tauriApi.toggleMediaFavorite(mediaId);
        const apply = (items: SyncedMediaItem[]) =>
          items.map((item) => (item.id === mediaId ? { ...item, is_favorite: isFav } : item));
        setGalleryMedia(apply);
        setRecentMedia(apply);
      } catch (error) {
        reportError("Could not update the favorite", error);
      }
    },
    [reportError],
  );

  // Initial load
  useEffect(() => {
    tauriApi
      .getAppSettings()
      .then((loaded) => {
        if (loaded && Object.keys(loaded).length > 0) {
          setSettings((prev) => ({ ...prev, ...loaded }));
        }
      })
      .catch((error) => reportError("Could not load settings", error));

    refreshDevices();
    refreshStorageStats();
    refreshGallery();
  }, [refreshDevices, refreshStorageStats, refreshGallery, reportError]);

  // Rescan whenever the selected device changes
  useEffect(() => {
    if (selectedDevice) {
      refreshScan(selectedDevice);
    } else {
      setScanSummary(null);
    }
  }, [selectedDevice, refreshScan]);

  const updateSetting = useCallback(
    async (key: keyof AppSettings, value: string) => {
      const previous = settings[key];
      setSettings((prev) => ({ ...prev, [key]: value }));
      try {
        await tauriApi.updateAppSetting(key, value);
      } catch (error) {
        setSettings((prev) => ({ ...prev, [key]: previous }));
        reportError("Could not save that setting", error);
        return;
      }

      if (key === "simulation_enabled" && !isEnabled(value)) {
        setDevices((prev) => prev.filter((d) => !d.is_simulated));
        setSelectedDeviceState((prev) => (prev?.is_simulated ? null : prev));
      }
    },
    [settings, reportError],
  );

  const startSync = useCallback(
    async (selectedFiles?: DiscoveredMediaFile[]) => {
      if (isSyncing || !selectedDevice) return;

      const targetList = (
        selectedFiles && selectedFiles.length > 0 ? selectedFiles : scanSummary?.files || []
      ).filter((f) => !f.is_synced && !processedFileNames.has(f.name));

      if (targetList.length === 0) {
        addToast(
          "Already Backed Up",
          "The selected items are already safely backed up in your vault.",
          "info",
        );
        return;
      }

      // Battery guard (only meaningful when the device reports a battery level)
      const minBattery = parseInt(settings.min_battery_threshold || "0", 10);
      if (
        selectedDevice.battery_level !== undefined &&
        minBattery > 0 &&
        selectedDevice.battery_level < minBattery
      ) {
        addToast(
          "Battery Guard Active",
          `Device battery is ${selectedDevice.battery_level}% (below the ${minBattery}% safety threshold). Please charge the device before syncing.`,
          "warning",
        );
        return;
      }

      const totalFiles = targetList.length;
      const totalBytes = targetList.reduce((sum, f) => sum + f.file_size_bytes, 0);
      const isSelective = Boolean(selectedFiles && selectedFiles.length > 0);
      const isSimulatedDevice = Boolean(selectedDevice.is_simulated);

      setIsSyncing(true);
      setLastSyncOutcome(null);
      setSyncProgress({
        current_file: targetList[0]?.name || "Preparing transfer...",
        current_index: 0,
        total_files: totalFiles,
        percent: 0,
        bytes_copied: 0,
        total_bytes: totalBytes,
        status: `Starting ${isSelective ? "selective" : "full"} sync...`,
        completed: false,
        simulated: isSimulatedDevice,
      });

      addToast(
        isSelective ? "Selective Sync Started" : "Sync Started",
        `Transferring ${totalFiles} item${totalFiles === 1 ? "" : "s"} from ${selectedDevice.name}...`,
        "info",
      );

      let unsubscribe: (() => void) | undefined;

      try {
        unsubscribe = await tauriApi.listenSyncProgress((progress) => {
          setSyncProgress(progress);
          if (progress.current_file) {
            setProcessedFileNames((prev) => new Set(prev).add(progress.current_file));
          }
          if (progress.error) {
            addToast("Transfer Problem", progress.error, "error");
          }
        }, targetList);

        const outcome = await tauriApi.startSync(
          selectedDevice.id,
          selectedDevice.name,
          selectedDevice.mount_path,
          targetList.map((f) => f.name),
        );

        setLastSyncOutcome(outcome);

        if (outcome.cancelled) {
          addToast("Sync Cancelled", "The transfer was stopped. Nothing was left half-copied.", "warning");
        } else if (outcome.failed > 0) {
          addToast(
            "Sync Finished With Errors",
            `${outcome.failed} of ${totalFiles} file${totalFiles === 1 ? "" : "s"} could not be copied.${
              outcome.errors.length > 0 ? ` First error: ${outcome.errors[0]}` : ""
            }`,
            "error",
          );
        } else if (outcome.simulated) {
          addToast(
            "Demo Sync Finished",
            `Simulated ${totalFiles} transfer${totalFiles === 1 ? "" : "s"} for ${selectedDevice.name}. No files were written and nothing was added to your vault index.`,
            "warning",
          );
        } else {
          const adoptedNote =
            outcome.adopted > 0
              ? ` ${outcome.adopted} already existed in the vault and were re-linked.`
              : "";
          addToast(
            "Sync Complete",
            `Backed up ${outcome.synced} item${outcome.synced === 1 ? "" : "s"}${
              outcome.skipped_duplicates > 0
                ? `, skipped ${outcome.skipped_duplicates} duplicate${outcome.skipped_duplicates === 1 ? "" : "s"}`
                : ""
            }.${adoptedNote}`,
            "success",
          );

          if (isEnabled(settings.sound_alerts_enabled)) {
            soundEffects.playSyncComplete();
          }
          if (isEnabled(settings.enable_notifications)) {
            tauriApi
              .sendDesktopNotification(
                "SnapHarbor Sync Complete",
                `Backed up ${outcome.synced} item${outcome.synced === 1 ? "" : "s"} from ${selectedDevice.name}.`,
              )
              .catch(() => undefined);
          }
        }

        await refreshStorageStats();
        await refreshGallery();
        await refreshScan(selectedDevice);
        if (isEnabled(settings.sound_alerts_enabled) && outcome.cancelled) {
          soundEffects.playWarning();
        }
      } catch (error) {
        reportError("Sync Failed", error);
      } finally {
        setIsSyncing(false);
        setSyncProgress(null);
        unsubscribe?.();
      }
    },
    [
      isSyncing,
      selectedDevice,
      scanSummary,
      processedFileNames,
      settings.enable_notifications,
      settings.sound_alerts_enabled,
      settings.min_battery_threshold,
      refreshStorageStats,
      refreshGallery,
      refreshScan,
      addToast,
      reportError,
    ],
  );

  const cancelSync = useCallback(async () => {
    try {
      await tauriApi.cancelSync();
      addToast("Cancelling", "The current transfer will stop after the file being copied.", "info");
    } catch (error) {
      reportError("Could not cancel the sync", error);
    }
  }, [addToast, reportError]);

  const unsyncMedia = useCallback(
    async (deviceId: string, remotePath: string, fileName: string) => {
      try {
        await tauriApi.unsyncMediaItem(deviceId, remotePath);
        setProcessedFileNames((prev) => {
          const next = new Set(prev);
          next.delete(fileName);
          return next;
        });

        if (selectedDevice) await refreshScan(selectedDevice);
        await refreshStorageStats();
        await refreshGallery();

        addToast(
          "Media Unsynced",
          `"${fileName}" is no longer tracked. The copy in your vault was left untouched and will be re-linked (not duplicated) if you sync it again.`,
          "info",
        );
      } catch (error) {
        reportError("Could not unsync that item", error);
      }
    },
    [selectedDevice, refreshScan, refreshStorageStats, refreshGallery, addToast, reportError],
  );

  const clearHistory = useCallback(async () => {
    try {
      await tauriApi.clearSyncHistory();
      await refreshStorageStats();
      await refreshGallery();
      setProcessedFileNames(new Set());
      addToast(
        "Index Cleared",
        "The vault index was emptied. Files on disk were kept — syncing again will re-link them instead of copying duplicates.",
        "info",
      );
    } catch (error) {
      reportError("Could not clear the sync index", error);
    }
  }, [refreshStorageStats, refreshGallery, addToast, reportError]);

  const openDestinationFolder = useCallback(async () => {
    try {
      await tauriApi.openPath(settings.destination_folder);
      addToast("Vault Opened", `Opening ${settings.destination_folder}`, "info");
    } catch (error) {
      reportError("Could not open the vault folder", error);
    }
  }, [settings.destination_folder, addToast, reportError]);

  const addSimulatedDevice = useCallback(
    (device: DeviceInfo) => {
      const demoDevice: DeviceInfo = { ...device, is_simulated: true, kind: "simulated" };
      setDevices((prev) =>
        prev.some((d) => d.id === demoDevice.id) ? prev : [demoDevice, ...prev],
      );
      setSelectedDeviceState(demoDevice);
      setProcessedFileNames(new Set());
      addToast(
        "Demo Device Selected",
        `"${demoDevice.name}" is a simulated device. Transfers against it are labelled as demo and are never written to disk or to your vault index.`,
        "warning",
      );
    },
    [addToast],
  );

  // Auto-sync when a *real* device is connected
  useEffect(() => {
    if (!selectedDevice) return;

    const isNewDevice = prevDeviceIdRef.current !== selectedDevice.id;
    prevDeviceIdRef.current = selectedDevice.id;
    if (!isNewDevice) return;

    if (isEnabled(settings.sound_alerts_enabled)) {
      soundEffects.playDeviceConnected();
    }

    if (
      isEnabled(settings.auto_sync_on_connect) &&
      !isSyncing &&
      !selectedDevice.is_simulated &&
      selectedDevice.mount_path
    ) {
      const timer = setTimeout(() => {
        addToast("Auto-Sync Triggered", `Automatic backup initiated for ${selectedDevice.name}`, "info");
        startSync();
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [
    selectedDevice,
    settings.auto_sync_on_connect,
    settings.sound_alerts_enabled,
    isSyncing,
    startSync,
    addToast,
  ]);

  // Interval scheduler
  useEffect(() => {
    const intervalMins = parseInt(settings.auto_sync_interval_mins || "0", 10);
    if (intervalMins <= 0) return undefined;

    const intervalId = setInterval(
      () => {
        if (
          selectedDevice?.is_connected &&
          !selectedDevice.is_simulated &&
          selectedDevice.mount_path &&
          !isSyncing &&
          scanSummary &&
          scanSummary.unsynced_count > 0
        ) {
          addToast("Scheduled Sync", `Running periodic backup (${intervalMins}m interval)...`, "info");
          startSync();
        }
      },
      intervalMins * 60 * 1000,
    );

    return () => clearInterval(intervalId);
  }, [
    settings.auto_sync_interval_mins,
    selectedDevice,
    isSyncing,
    scanSummary,
    startSync,
    addToast,
  ]);

  // System tray "Start 1-Click Sync"
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    tauriApi
      .listenTraySyncTrigger(() => {
        startSync();
      })
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((error) => console.warn("Tray listener unavailable:", error));

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [startSync]);

  const value = useMemo<SyncContextType>(
    () => ({
      devices,
      selectedDevice,
      setSelectedDevice,
      settings,
      updateSetting,
      isSimulationEnabled,
      storageStats,
      recentMedia,
      galleryMedia,
      hasMoreGallery,
      loadMoreGallery,
      scanSummary,
      isScanning,
      isSyncing,
      syncProgress,
      lastSyncOutcome,
      processedFileNames,
      startSync,
      cancelSync,
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
    }),
    [
      devices,
      selectedDevice,
      setSelectedDevice,
      settings,
      updateSetting,
      isSimulationEnabled,
      storageStats,
      recentMedia,
      galleryMedia,
      hasMoreGallery,
      loadMoreGallery,
      scanSummary,
      isScanning,
      isSyncing,
      syncProgress,
      lastSyncOutcome,
      processedFileNames,
      startSync,
      cancelSync,
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
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
};
