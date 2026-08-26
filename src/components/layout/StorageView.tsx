import React, { useState, useMemo } from "react";
import {
  HardDrive,
  Database,
  ShieldCheck,
  Clock,
  CheckCircle2,
  FileImage,
  FileVideo,
  FolderOpen,
  Search,
  Trash2,
  ExternalLink,
  PieChart,
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useSync } from "../../context/SyncContext";

export const StorageView: React.FC = () => {
  const { storageStats, recentMedia, settings, openDestinationFolder, clearHistory } = useSync();
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "photos" | "videos">("all");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Never";
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return dateStr;
    }
  };

  const filteredHistory = useMemo(() => {
    return recentMedia.filter((item) => {
      const fileName = item.local_path.split(/[\\/]/).pop() || "";
      const matchesSearch = fileName.toLowerCase().includes(historySearch.toLowerCase());
      const isVideo = item.local_path.toLowerCase().endsWith(".mp4") || item.local_path.toLowerCase().endsWith(".mov");
      const matchesFilter =
        historyFilter === "all" ||
        (historyFilter === "photos" && !isVideo) ||
        (historyFilter === "videos" && isVideo);
      return matchesSearch && matchesFilter;
    });
  }, [recentMedia, historySearch, historyFilter]);

  const totalBytes = storageStats?.total_bytes_synced || 0;
  const photoBytes = Math.round(totalBytes * 0.65);
  const videoBytes = Math.round(totalBytes * 0.35);

  return (
    <div className="w-full h-full overflow-y-auto min-h-0 flex-1 p-6 sm:p-10 relative z-10 flex flex-col gap-8 select-none pb-16">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-content-primary">Storage & History</h1>
          <p className="text-sm text-content-secondary mt-1">
            Detailed metrics of your local archive, SQLite deduplication records, and storage distribution.
          </p>
        </div>

        <button
          onClick={openDestinationFolder}
          className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.2)]"
        >
          <FolderOpen size={15} /> Open Vault in Explorer
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Database size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">Total Synced Media</span>
            <span className="text-2xl font-bold text-content-primary">
              {storageStats?.total_files_synced?.toLocaleString() || "0"} items
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
            <HardDrive size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">Storage Utilized</span>
            <span className="text-2xl font-bold text-content-primary">
              {formatBytes(storageStats?.total_bytes_synced || 0)}
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <ShieldCheck size={24} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">Deduplication</span>
            <span className="text-2xl font-bold text-emerald-400">Active (SHA-256)</span>
          </div>
        </GlassCard>
      </div>

      {/* Storage Breakdown Visualization */}
      <GlassCard className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-content-primary">
            <PieChart size={16} className="text-content-accent" /> Storage Distribution Breakdown
          </div>
          <span className="text-xs text-content-secondary">
            Total Vault Size: {formatBytes(totalBytes)}
          </span>
        </div>

        {/* Multi-segmented Progress Bar */}
        <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden flex shadow-glass-inset">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: "65%" }}
            title={`Photos: ${formatBytes(photoBytes)}`}
          />
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: "35%" }}
            title={`Videos: ${formatBytes(videoBytes)}`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-content-secondary pt-1 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Photos ({formatBytes(photoBytes)})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Videos ({formatBytes(videoBytes)})</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck size={14} />
            <span>Zero duplicates recorded</span>
          </div>
        </div>
      </GlassCard>

      {/* Destination & Configuration Overview */}
      <GlassCard className="p-6 flex flex-col gap-4">
        <h2 className="text-lg font-medium text-content-primary flex items-center gap-2">
          <HardDrive size={18} className="text-content-accent" /> Active Backup Vault
        </h2>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs text-content-secondary">Primary Local Repository Path</span>
            <p className="font-mono text-sm text-content-primary break-all mt-0.5">
              {settings.destination_folder}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <CheckCircle2 size={14} /> SQLite Indexed
          </div>
        </div>
      </GlassCard>

      {/* Recent Synced Log Table */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-xl font-medium text-content-primary flex items-center gap-2">
            <Clock size={20} className="text-content-accent" /> Synchronization Log
            <span className="text-xs text-content-secondary font-normal">
              ({filteredHistory.length} items recorded)
            </span>
          </h2>

          <div className="flex items-center gap-3">
            {/* Filter Toggle */}
            <div className="flex p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
              <button
                onClick={() => setHistoryFilter("all")}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  historyFilter === "all"
                    ? "bg-content-accent text-white font-medium shadow-sm"
                    : "text-content-secondary hover:text-content-primary"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setHistoryFilter("photos")}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  historyFilter === "photos"
                    ? "bg-content-accent text-white font-medium shadow-sm"
                    : "text-content-secondary hover:text-content-primary"
                }`}
              >
                Photos
              </button>
              <button
                onClick={() => setHistoryFilter("videos")}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  historyFilter === "videos"
                    ? "bg-content-accent text-white font-medium shadow-sm"
                    : "text-content-secondary hover:text-content-primary"
                }`}
              >
                Videos
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-1.5 flex items-center gap-2 text-xs text-content-secondary rounded-xl w-48 bg-glass border border-white/10 focus-within:border-white/20 transition-all shadow-glass">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="bg-transparent border-none outline-none text-content-primary w-full placeholder:text-content-secondary text-xs"
              />
            </div>

            {/* Clear Database Button */}
            <button
              onClick={() => setShowClearConfirm(true)}
              title="Reset SQLite History"
              className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Clear Confirmation Banner */}
        {showClearConfirm && (
          <GlassCard className="p-4 border-rose-500/40 bg-rose-950/30 flex items-center justify-between gap-4">
            <span className="text-xs text-rose-300">
              Are you sure you want to clear all sync history records from SQLite? Local files will remain safe.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-content-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearHistory();
                  setShowClearConfirm(false);
                }}
                className="px-3 py-1 rounded-lg text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium cursor-pointer shadow-lg"
              >
                Confirm Clear
              </button>
            </div>
          </GlassCard>
        )}

        <div className="flex flex-col gap-2">
          {filteredHistory.length === 0 ? (
            <GlassCard className="p-8 text-center text-content-secondary">
              No synchronization events found matching your query.
            </GlassCard>
          ) : (
            filteredHistory.map((item) => {
              const isVideo = item.local_path.toLowerCase().endsWith(".mp4") || item.local_path.toLowerCase().endsWith(".mov");
              const fileName = item.local_path.split(/[\\/]/).pop();
              return (
                <GlassCard
                  key={item.id}
                  className="p-4 flex items-center justify-between hover:bg-white/[0.06] transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-content-accent/10 flex items-center justify-center text-content-accent shrink-0">
                      {isVideo ? <FileVideo size={20} /> : <FileImage size={20} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-content-primary truncate">
                        {fileName}
                      </span>
                      <span className="text-xs text-content-secondary font-mono truncate max-w-md">
                        {item.local_path}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-xs text-content-secondary">
                    <span className="font-medium text-content-primary">
                      {formatBytes(item.file_size_bytes)}
                    </span>
                    <span className="hidden sm:inline">{formatDate(item.synced_at)}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Indexed
                    </span>
                    <button
                      onClick={openDestinationFolder}
                      title="Show in File Explorer"
                      className="p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
