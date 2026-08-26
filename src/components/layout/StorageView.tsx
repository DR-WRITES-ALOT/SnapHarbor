import React from "react";
import { HardDrive, Database, ShieldCheck, Clock, CheckCircle2, FileImage, FileVideo } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useSync } from "../../context/SyncContext";

export const StorageView: React.FC = () => {
  const { storageStats, recentMedia, settings } = useSync();

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

  return (
    <div className="w-full h-full overflow-y-auto min-h-0 flex-1 p-6 sm:p-10 relative z-10 flex flex-col gap-8 select-none overscroll-contain pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-content-primary">Storage & History</h1>
        <p className="text-sm text-content-secondary mt-1">
          Detailed metrics of your local archive and SQLite deduplication records.
        </p>
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
        <h2 className="text-xl font-medium text-content-primary flex items-center gap-2">
          <Clock size={20} className="text-content-accent" /> Recent Synchronization Log
        </h2>

        <div className="flex flex-col gap-2">
          {recentMedia.length === 0 ? (
            <GlassCard className="p-8 text-center text-content-secondary">
              No synchronization events logged yet. Connect a device and trigger a sync to begin.
            </GlassCard>
          ) : (
            recentMedia.map((item) => {
              const isVideo = item.local_path.toLowerCase().endsWith(".mp4") || item.local_path.toLowerCase().endsWith(".mov");
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
                        {item.local_path.split(/[\\/]/).pop()}
                      </span>
                      <span className="text-xs text-content-secondary font-mono truncate max-w-md">
                        {item.local_path}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 text-xs text-content-secondary">
                    <span className="font-medium text-content-primary">
                      {formatBytes(item.file_size_bytes)}
                    </span>
                    <span>{formatDate(item.synced_at)}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Indexed
                    </span>
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
