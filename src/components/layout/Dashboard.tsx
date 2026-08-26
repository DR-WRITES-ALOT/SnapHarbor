import React, { useState, useMemo, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import {
  CloudUpload,
  Search,
  Check,
  Loader2,
  Smartphone,
  BatteryMedium,
  HardDrive,
  FolderDown,
  Settings2,
  Video,
  Image as ImageIcon,
  ChevronDown,
  RefreshCw,
  CheckSquare,
  Square,
  Eye,
  Camera,
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { MediaPreviewModal } from "../ui/MediaPreviewModal";
import { FolderPickerModal } from "../ui/FolderPickerModal";
import { useSync } from "../../context/SyncContext";
import type { DeviceInfo } from "../../types";

interface DashboardProps {
  onNavigateToSettings?: () => void;
}

const simulatedDevicePresets: DeviceInfo[] = [
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
    id: "iphone_15_pro",
    name: "Apple iPhone 15 Pro Max",
    manufacturer: "Apple Inc.",
    is_wpd: true,
    is_connected: true,
    total_space_bytes: 256_000_000_000,
    free_space_bytes: 78_400_000_000,
    battery_level: 94,
  },
  {
    id: "sony_alpha_sd",
    name: "Sony Alpha A7 IV (SD Card)",
    manufacturer: "Sony Corporation",
    mount_path: "E:\\DCIM",
    is_wpd: false,
    is_connected: true,
    total_space_bytes: 128_000_000_000,
    free_space_bytes: 42_200_000_000,
  },
  {
    id: "gopro_hero_12",
    name: "GoPro Hero 12 Black",
    manufacturer: "GoPro Inc.",
    mount_path: "F:\\DCIM\\100GOPRO",
    is_wpd: false,
    is_connected: true,
    total_space_bytes: 64_000_000_000,
    free_space_bytes: 18_600_000_000,
    battery_level: 72,
  },
];

export const Dashboard: React.FC<DashboardProps> = () => {
  const {
    selectedDevice,
    settings,
    scanSummary,
    isScanning,
    isSyncing,
    syncProgress,
    processedFileNames,
    startSync,
    refreshDevices,
    addSimulatedDevice,
  } = useSync();

  const [searchQuery, setSearchQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"all" | "photos" | "videos">("all");
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const filteredMedia = useMemo(() => {
    if (!scanSummary?.files) return [];
    return scanSummary.files.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter =
        mediaFilter === "all" ||
        (mediaFilter === "photos" && !item.is_video) ||
        (mediaFilter === "videos" && item.is_video);
      return matchesSearch && matchesFilter;
    });
  }, [scanSummary, searchQuery, mediaFilter]);

  const toggleSelectIndex = (idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === filteredMedia.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(filteredMedia.map((_, i) => i)));
    }
  };

  const handleSyncClick = () => {
    if (selectedIndices.size > 0) {
      const selectedFiles = Array.from(selectedIndices)
        .map((idx) => filteredMedia[idx])
        .filter(Boolean);
      startSync(selectedFiles);
      setSelectedIndices(new Set());
    } else {
      startSync();
    }
  };

  // Keyboard shortcut Ctrl+Enter to start sync
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isSyncing && selectedDevice) {
        e.preventDefault();
        handleSyncClick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSyncing, selectedDevice, selectedIndices, filteredMedia]);

  const currentPercent = syncProgress?.percent ?? 0;
  const allSelected = filteredMedia.length > 0 && selectedIndices.size === filteredMedia.length;

  return (
    <div className="w-full h-full overflow-y-auto min-h-0 flex-1 p-6 sm:p-10 relative z-10 flex flex-col gap-8 select-none overscroll-contain pb-20">
      {/* Header section */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-content-primary">
            Device Media
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            {isScanning
              ? "Scanning connected storage for media..."
              : `${scanSummary?.unsynced_count || 0} unsynced items ready for transfer`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Select All / Deselect Toggle */}
          <button
            onClick={toggleSelectAll}
            className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
              allSelected
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : "bg-white/[0.04] border-white/10 text-content-secondary hover:text-content-primary hover:bg-white/[0.08]"
            }`}
          >
            {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            <span>{allSelected ? "Deselect All" : "Select All"}</span>
          </button>

          {/* Media Type Filter buttons */}
          <div className="flex p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
            <button
              onClick={() => setMediaFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                mediaFilter === "all"
                  ? "bg-content-accent text-white font-medium shadow-sm"
                  : "text-content-secondary hover:text-content-primary"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setMediaFilter("photos")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                mediaFilter === "photos"
                  ? "bg-content-accent text-white font-medium shadow-sm"
                  : "text-content-secondary hover:text-content-primary"
              }`}
            >
              <ImageIcon size={12} /> Photos
            </button>
            <button
              onClick={() => setMediaFilter("videos")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                mediaFilter === "videos"
                  ? "bg-content-accent text-white font-medium shadow-sm"
                  : "text-content-secondary hover:text-content-primary"
              }`}
            >
              <Video size={12} /> Videos
            </button>
          </div>

          {/* Search box */}
          <div className="px-4 py-2 flex items-center gap-2 text-sm text-content-secondary rounded-xl w-56 bg-glass border border-white/10 focus-within:border-white/20 transition-all shadow-glass">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-content-primary w-full placeholder:text-content-secondary text-xs"
            />
          </div>
        </div>
      </div>

      {/* Device Info & Destination Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Card with Switcher */}
        <GlassCard className="p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-content-accent/20 flex items-center justify-center text-content-accent shadow-[0_0_15px_rgba(59,130,246,0.2)] shrink-0">
                {selectedDevice?.mount_path ? <Camera size={24} /> : <Smartphone size={24} />}
              </div>
              <div className="flex flex-col min-w-0">
                <div
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                >
                  <span className="text-lg font-medium text-content-primary group-hover:text-content-accent transition-colors truncate">
                    {selectedDevice?.name || "No Device Connected"}
                  </span>
                  <ChevronDown size={16} className="text-content-secondary group-hover:text-content-primary shrink-0" />
                </div>
                <span className="text-xs text-content-secondary flex items-center gap-3 mt-0.5">
                  {selectedDevice?.battery_level && (
                    <span className="flex items-center gap-1">
                      <BatteryMedium size={14} /> {selectedDevice.battery_level}%
                    </span>
                  )}
                  <span className="flex items-center gap-1 truncate">
                    <HardDrive size={14} />{" "}
                    {selectedDevice?.free_space_bytes
                      ? `${formatBytes(selectedDevice.free_space_bytes)} free`
                      : "Ready to sync"}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={refreshDevices}
                title="Refresh connected devices"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-white/5 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
              </button>
              <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30">
                {selectedDevice?.is_connected ? "Connected" : "Standby"}
              </div>
            </div>
          </div>

          {/* Device Dropdown Menu & Simulator Preset Picker */}
          {showDeviceDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 p-3 rounded-2xl bg-[#121226]/95 border border-white/15 backdrop-blur-xl shadow-2xl z-50 flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-content-secondary px-2">
                Available & Simulated Devices
              </span>
              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                {simulatedDevicePresets.map((preset) => {
                  const isSelected = selectedDevice?.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        addSimulatedDevice(preset);
                        setShowDeviceDropdown(false);
                      }}
                      className={`p-2.5 rounded-xl text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-content-accent/20 text-content-primary font-medium"
                          : "text-content-secondary hover:bg-white/5 hover:text-content-primary"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {preset.mount_path ? <Camera size={16} /> : <Smartphone size={16} />}
                        <div className="flex flex-col">
                          <span className="font-medium">{preset.name}</span>
                          <span className="text-[10px] opacity-70">
                            {preset.mount_path ? `Drive: ${preset.mount_path}` : "MTP Storage"} • {formatBytes(preset.free_space_bytes || 0)} free
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check size={14} className="text-content-accent" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Destination Card with interactive Folder Picker Modal */}
        <GlassCard
          className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/[0.06] transition-all group"
          onClick={() => setShowFolderPicker(true)}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 group-hover:bg-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)] shrink-0 transition-colors">
              <FolderDown size={24} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-content-secondary font-medium uppercase tracking-wider">
                Save Destination (Click to change)
              </span>
              <span className="text-sm font-medium text-content-primary font-mono truncate max-w-xs xl:max-w-md mt-0.5 group-hover:text-purple-300 transition-colors">
                {settings.destination_folder}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFolderPicker(true);
            }}
            title="Choose folder"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-purple-500/20 text-content-secondary hover:text-purple-300 transition-colors cursor-pointer shrink-0"
          >
            <Settings2 size={18} />
          </button>
        </GlassCard>
      </div>

      {/* Action Bar & Live Sync Status */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleSyncClick}
            disabled={isSyncing || !selectedDevice}
            title="Shortcut: Ctrl+Enter"
            className={`bg-content-accent/20 hover:bg-content-accent/30 border border-content-accent/30 text-content-primary px-8 py-3.5 rounded-full flex items-center gap-3 font-medium transition-all shadow-[0_0_25px_rgba(59,130,246,0.25)] cursor-pointer ${
              isSyncing || !selectedDevice ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isSyncing ? (
              <Loader2 size={20} className="text-blue-400 animate-spin" />
            ) : (
              <CloudUpload size={20} className="text-blue-400" />
            )}
            <span>
              {isSyncing
                ? "Syncing Media..."
                : selectedIndices.size > 0
                ? `Sync Selected (${selectedIndices.size} Items)`
                : "Start 1-Click Sync"}
            </span>
          </button>

          {selectedIndices.size > 0 && (
            <button
              onClick={() => setSelectedIndices(new Set())}
              className="px-4 py-2 rounded-xl text-xs text-content-secondary hover:text-content-primary bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Clear Selection ({selectedIndices.size})
            </button>
          )}

          {isSyncing && syncProgress && (
            <span className="text-xs text-content-secondary animate-pulse truncate max-w-xs">
              {syncProgress.status} ({syncProgress.current_file})
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 w-72">
          <span className="text-xs font-medium text-content-primary uppercase tracking-wider">
            Progress
          </span>
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden shadow-glass-inset">
            <div
              className="h-full bg-content-accent rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-all duration-300 ease-out"
              style={{ width: `${currentPercent}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-content-secondary min-w-[4ch]">
            {currentPercent}%
          </span>
        </div>
      </div>

      {/* Media Grid */}
      <div className="flex flex-col gap-4 mt-2 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-content-primary flex items-center gap-2">
            Discovered Media{" "}
            <span className="text-content-secondary font-normal text-sm">
              ({filteredMedia.length} {filteredMedia.length === 1 ? "Item" : "Items"})
            </span>
          </h2>
          <span className="text-xs text-content-secondary">
            Total: {formatBytes(scanSummary?.total_bytes || 0)}
          </span>
        </div>

        {filteredMedia.length === 0 ? (
          <GlassCard className="p-12 text-center text-content-secondary">
            {isScanning ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={28} className="animate-spin text-content-accent" />
                <span>Scanning connected device for photos and videos...</span>
              </div>
            ) : (
              <span>No media matches the current filter or search criteria.</span>
            )}
          </GlassCard>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredMedia.map((item, idx) => {
              const isSelected = selectedIndices.has(idx);
              const isItemProcessed = processedFileNames.has(item.name);
              const isCurrent = isSyncing && syncProgress?.current_file === item.name;

              return (
                <GlassCard
                  key={item.name}
                  onClick={() => toggleSelectIndex(idx)}
                  className={`p-3 flex flex-col gap-2.5 group relative cursor-pointer hover:-translate-y-1 transition-all duration-300 ${
                    isSelected
                      ? "ring-2 ring-emerald-500 bg-emerald-500/[0.06] shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                      : isCurrent
                      ? "ring-2 ring-content-accent shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                      : ""
                  }`}
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
                    {/* Media thumbnail */}
                    <img
                      src={`https://picsum.photos/seed/${idx + 120}/300/300`}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Preview Button on Hover */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewIndex(idx);
                      }}
                      title="Inspect Photo & Metadata"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity backdrop-blur-[1px] cursor-pointer"
                    >
                      <div className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-xs font-medium flex items-center gap-1.5 shadow-lg">
                        <Eye size={13} /> Preview
                      </div>
                    </div>

                    {item.is_video && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white flex items-center gap-1 font-medium pointer-events-none">
                        <Video size={10} /> Video
                      </div>
                    )}

                    {isItemProcessed && (
                      <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg animate-in zoom-in-50">
                          <Check size={18} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-end justify-between px-1">
                    <div className="flex flex-col text-[11px] text-content-secondary gap-0.5 truncate pr-2">
                      <span className="font-medium text-content-primary truncate">{item.name}</span>
                      <span>{formatBytes(item.file_size_bytes)}</span>
                    </div>

                    {/* Selection Checkbox */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectIndex(idx);
                      }}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                          : "border-white/30 text-transparent group-hover:border-white/60"
                      }`}
                    >
                      <Check size={12} />
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Full Media Preview Modal */}
      <AnimatePresence>
        {previewIndex !== null && filteredMedia[previewIndex] && (
          <MediaPreviewModal
            key="media-preview"
            mediaList={filteredMedia}
            currentIndex={previewIndex}
            onClose={() => setPreviewIndex(null)}
            onSelectIndex={setPreviewIndex}
            isSelected={selectedIndices.has(previewIndex)}
            onToggleSelect={toggleSelectIndex}
          />
        )}
      </AnimatePresence>

      {/* Folder Picker Modal */}
      <FolderPickerModal
        isOpen={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
      />
    </div>
  );
};
