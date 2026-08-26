import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type {
  DeviceInfo,
  AppSettings,
  StorageStats,
  SyncedMediaItem,
  ScanSummary,
  SyncProgressEvent,
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
  scanSummary: ScanSummary | null;
  isScanning: boolean;
  isSyncing: boolean;
  syncProgress: SyncProgressEvent | null;
  startSync: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  refreshStorageStats: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  destination_folder: "C:\\Users\\Photos\\SnapHarbor_Backups",
  organize_by_date: "true",
  date_format: "YYYY/MM",
  auto_sync_on_connect: "false",
  delete_after_sync: "false",
  skip_duplicates: "true",
  include_videos: "true",
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [recentMedia, setRecentMedia] = useState<SyncedMediaItem[]>([]);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressEvent | null>(null);

  // Load initial settings and devices
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

  const refreshScan = useCallback(async (device: DeviceInfo) => {
    setIsScanning(true);
    try {
      const summary = await tauriApi.scanDeviceMedia(device.id, device.mount_path);
      setScanSummary(summary);
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
  }, [refreshDevices, refreshStorageStats]);

  useEffect(() => {
    if (selectedDevice) {
      refreshScan(selectedDevice);
    }
  }, [selectedDevice, refreshScan]);

  const updateSetting = async (key: keyof AppSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await tauriApi.updateAppSetting(key, value);
    } catch (e) {
      console.error(`Failed to update setting [${key}]:`, e);
    }
  };

  const startSync = async () => {
    if (isSyncing || !selectedDevice) return;

    setIsSyncing(true);
    setSyncProgress({
      current_file: "Preparing transfer...",
      current_index: 0,
      total_files: scanSummary?.unsynced_count || 1,
      percent: 0,
      bytes_copied: 0,
      total_bytes: scanSummary?.unsynced_bytes || 0,
      status: "Initializing...",
      completed: false,
    });

    let cleanupListener: (() => void) | undefined;

    try {
      cleanupListener = await tauriApi.listenSyncProgress((progress) => {
        setSyncProgress(progress);
        if (progress.completed) {
          setIsSyncing(false);
          refreshStorageStats();
          if (selectedDevice) {
            refreshScan(selectedDevice);
          }
        }
      });

      await tauriApi.startSync(
        selectedDevice.id,
        selectedDevice.name,
        selectedDevice.mount_path
      );
    } catch (err) {
      console.error("Sync error:", err);
      setIsSyncing(false);
    } finally {
      if (cleanupListener) {
        // Keep active for a moment if needed
      }
    }
  };

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
        scanSummary,
        isScanning,
        isSyncing,
        syncProgress,
        startSync,
        refreshDevices,
        refreshStorageStats,
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
