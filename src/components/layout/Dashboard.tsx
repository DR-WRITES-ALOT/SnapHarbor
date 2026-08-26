import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useSync } from "../../context/SyncContext";

interface DashboardProps {
  onNavigateToSettings?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToSettings }) => {
  const {
    devices,
    selectedDevice,
    setSelectedDevice,
    settings,
    scanSummary,
    isScanning,
    isSyncing,
    syncProgress,
    startSync,
    refreshDevices,
  } = useSync();

  const [searchQuery, setSearchQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"all" | "photos" | "videos">("all");
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

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

  const currentPercent = syncProgress?.percent ?? 0;

  return (
    <div className="flex-1 h-full overflow-y-auto p-10 relative z-10 flex flex-col gap-8">
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

        <div className="flex items-center gap-3">
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
          <div className="px-4 py-2 flex items-center gap-2 text-sm text-content-secondary rounded-xl w-60 bg-glass border border-white/10 focus-within:border-white/20 transition-all shadow-glass">
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
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-content-accent/20 flex items-center justify-center text-content-accent shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <Smartphone size={24} />
              </div>
              <div className="flex flex-col">
                <div
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                >
                  <span className="text-lg font-medium text-content-primary group-hover:text-content-accent transition-colors">
                    {selectedDevice?.name || "No Device Connected"}
                  </span>
                  {devices.length > 1 && (
                    <ChevronDown size={16} className="text-content-secondary group-hover:text-content-primary" />
                  )}
                </div>
                <span className="text-xs text-content-secondary flex items-center gap-3 mt-0.5">
                  {selectedDevice?.battery_level && (
                    <span className="flex items-center gap-1">
                      <BatteryMedium size={14} /> {selectedDevice.battery_level}%
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <HardDrive size={14} />{" "}
                    {selectedDevice?.free_space_bytes
                      ? `${formatBytes(selectedDevice.free_space_bytes)} free`
                      : "Ready to sync"}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
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

          {/* Device Dropdown Menu */}
          {showDeviceDropdown && devices.length > 1 && (
            <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-xl bg-[#121226]/95 border border-white/10 backdrop-blur-xl shadow-2xl z-50 flex flex-col gap-1">
              {devices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setSelectedDevice(d);
                    setShowDeviceDropdown(false);
                  }}
                  className={`p-3 rounded-lg text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    selectedDevice?.id === d.id
                      ? "bg-content-accent/20 text-content-primary font-medium"
                      : "text-content-secondary hover:bg-white/5 hover:text-content-primary"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-[11px] opacity-70">
                      {d.manufacturer || (d.mount_path ? `Drive ${d.mount_path}` : "MTP Device")}
                    </span>
                  </div>
                  {selectedDevice?.id === d.id && <Check size={14} className="text-content-accent" />}
                </button>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Destination Card */}
        <GlassCard className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)] shrink-0">
              <FolderDown size={24} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-content-secondary font-medium uppercase tracking-wider">
                Save Destination
              </span>
              <span className="text-sm font-medium text-content-primary font-mono truncate max-w-xs xl:max-w-md mt-0.5">
                {settings.destination_folder}
              </span>
            </div>
          </div>
          <button
            onClick={onNavigateToSettings}
            title="Configure destination & rules"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-content-secondary hover:text-content-primary transition-colors cursor-pointer shrink-0"
          >
            <Settings2 size={20} />
          </button>
        </GlassCard>
      </div>

      {/* Action Bar & Live Sync Status */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={startSync}
            disabled={isSyncing || !selectedDevice}
            className={`bg-content-accent/20 hover:bg-content-accent/30 border border-content-accent/30 text-content-primary px-8 py-3.5 rounded-full flex items-center gap-3 font-medium transition-all shadow-[0_0_25px_rgba(59,130,246,0.25)] cursor-pointer ${
              isSyncing || !selectedDevice ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isSyncing ? (
              <Loader2 size={20} className="text-blue-400 animate-spin" />
            ) : (
              <CloudUpload size={20} className="text-blue-400" />
            )}
            {isSyncing ? "Syncing Media..." : "Start 1-Click Sync"}
          </button>

          {isSyncing && syncProgress && (
            <span className="text-xs text-content-secondary animate-pulse">
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
      <div className="flex flex-col gap-4 mt-2">
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
              const isItemProcessed =
                isSyncing && syncProgress && idx < syncProgress.current_index;
              const isCurrent =
                isSyncing && syncProgress && idx === syncProgress.current_index - 1;

              return (
                <GlassCard
                  key={item.source_path || idx}
                  className={`p-3 flex flex-col gap-2.5 group relative cursor-pointer hover:-translate-y-1 transition-all duration-300 ${
                    isCurrent ? "ring-2 ring-content-accent shadow-[0_0_20px_rgba(59,130,246,0.4)]" : ""
                  }`}
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-black/40 flex items-center justify-center">
                    {/* Media thumbnail simulation */}
                    <img
                      src={`https://picsum.photos/seed/${idx + 120}/300/300`}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />

                    {item.is_video && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white flex items-center gap-1 font-medium">
                        <Video size={10} /> Video
                      </div>
                    )}

                    {isItemProcessed && (
                      <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg">
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

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                        isItemProcessed
                          ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                          : "border-white/20 text-transparent group-hover:border-white/50 group-hover:text-white/50"
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
    </div>
  );
};
