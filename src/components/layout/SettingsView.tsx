import React, { useState } from "react";
import {
  Folder,
  HardDrive,
  Shield,
  Video,
  RefreshCw,
  Bell,
  Minimize2,
  Check,
  FolderTree,
  RotateCcw,
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useSync } from "../../context/SyncContext";

export const SettingsView: React.FC = () => {
  const { settings, updateSetting, addToast, clearHistory } = useSync();
  const [folderInput, setFolderInput] = useState(settings.destination_folder);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveDestination = async () => {
    if (folderInput.trim()) {
      await updateSetting("destination_folder", folderInput.trim());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  const testNotification = () => {
    addToast("Notification Test", "Desktop and in-app alerts are active.", "info");
  };

  const renderTreePreview = () => {
    const root = settings.destination_folder.split(/[\\/]/).pop() || "SnapHarbor_Backups";
    switch (settings.date_format) {
      case "YYYY/MM":
        return (
          <div className="font-mono text-[11px] leading-relaxed text-content-secondary bg-black/40 p-4 rounded-xl border border-white/5">
            <div className="text-content-accent font-semibold flex items-center gap-1">
              <Folder size={12} /> {root}/
            </div>
            <div className="pl-4">├── 📁 2026/</div>
            <div className="pl-8">├── 📁 08/</div>
            <div className="pl-12">├── 🖼️ IMG_1001.JPG</div>
            <div className="pl-12">└── 🎥 VID_2004.MP4</div>
            <div className="pl-4">└── 📁 2026/07/...</div>
          </div>
        );
      case "YYYY-MM-DD":
        return (
          <div className="font-mono text-[11px] leading-relaxed text-content-secondary bg-black/40 p-4 rounded-xl border border-white/5">
            <div className="text-content-accent font-semibold flex items-center gap-1">
              <Folder size={12} /> {root}/
            </div>
            <div className="pl-4">├── 📁 2026-08-26/</div>
            <div className="pl-8">├── 🖼️ IMG_1001.JPG</div>
            <div className="pl-8">└── 🎥 VID_2004.MP4</div>
            <div className="pl-4">└── 📁 2026-08-25/...</div>
          </div>
        );
      case "Device/YYYY-MM":
        return (
          <div className="font-mono text-[11px] leading-relaxed text-content-secondary bg-black/40 p-4 rounded-xl border border-white/5">
            <div className="text-content-accent font-semibold flex items-center gap-1">
              <Folder size={12} /> {root}/
            </div>
            <div className="pl-4">├── 📁 Galaxy_S23/</div>
            <div className="pl-8">├── 📁 2026/08/</div>
            <div className="pl-12">├── 🖼️ IMG_1001.JPG</div>
            <div className="pl-12">└── 🎥 VID_2004.MP4</div>
            <div className="pl-4">└── 📁 Sony_Alpha_SD/...</div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto min-h-0 flex-1 p-6 sm:p-10 relative z-10 flex flex-col gap-8 select-none pb-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-content-primary">Settings & Preferences</h1>
        <p className="text-sm text-content-secondary mt-1">
          Customize backup destination, date hierarchy rules, deduplication, and background tray options.
        </p>
      </div>

      <div className="flex flex-col gap-6 max-w-4xl">
        {/* Backup Vault Path */}
        <GlassCard className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Folder size={20} />
            </div>
            <div>
              <h2 className="text-base font-medium text-content-primary">Default Backup Destination</h2>
              <p className="text-xs text-content-secondary">
                Where imported photos and videos will be saved on your Windows computer.
              </p>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="e.g. C:\Users\Photos\SnapHarbor_Backups"
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-mono text-content-primary placeholder:text-content-secondary focus:outline-none focus:border-content-accent transition-colors"
            />
            <button
              onClick={handleSaveDestination}
              className="px-5 py-2.5 rounded-xl bg-content-accent text-white text-sm font-medium hover:bg-content-accent/90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.3)] cursor-pointer shrink-0"
            >
              {savedSuccess ? <Check size={16} /> : null}
              {savedSuccess ? "Saved" : "Save Path"}
            </button>
          </div>
        </GlassCard>

        {/* Organization Format & Dynamic Tree Preview */}
        <GlassCard className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <HardDrive size={20} />
            </div>
            <div>
              <h2 className="text-base font-medium text-content-primary">Folder Structure Organization</h2>
              <p className="text-xs text-content-secondary">
                Choose how files are organized inside your destination directory.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "YYYY/MM", label: "Year / Month", example: "2026/08/IMG_001.jpg" },
              { id: "YYYY-MM-DD", label: "Exact Date", example: "2026-08-26/IMG_001.jpg" },
              { id: "Device/YYYY-MM", label: "Device / Month", example: "Galaxy_S23/2026/08/..." },
            ].map((option) => {
              const active = settings.date_format === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => updateSetting("date_format", option.id)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? "bg-content-accent/15 border-content-accent text-content-primary shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                      : "bg-white/[0.02] border-white/10 text-content-secondary hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="font-medium text-sm text-content-primary">{option.label}</div>
                  <div className="font-mono text-xs text-content-secondary mt-1">{option.example}</div>
                </button>
              );
            })}
          </div>

          {/* Interactive Live Directory Tree Preview */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-content-primary">
              <FolderTree size={14} className="text-content-accent" /> Live Vault Hierarchy Preview
            </div>
            {renderTreePreview()}
          </div>
        </GlassCard>

        {/* Sync & Windows Native Toggles */}
        <GlassCard className="p-6 flex flex-col gap-6">
          {/* Deduplication */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content-primary">Smart SHA-256 Deduplication</h3>
                <p className="text-xs text-content-secondary">
                  Skip importing files that have already been backed up into SQLite database.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updateSetting("skip_duplicates", settings.skip_duplicates === "true" ? "false" : "true")
              }
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                settings.skip_duplicates === "true" ? "bg-emerald-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.skip_duplicates === "true" ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-white/5" />

          {/* Desktop Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
                <Bell size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-content-primary">Windows Desktop Notifications</h3>
                  <button
                    onClick={testNotification}
                    className="text-[10px] text-content-accent hover:underline cursor-pointer"
                  >
                    (Test Alert)
                  </button>
                </div>
                <p className="text-xs text-content-secondary">
                  Show Windows toast notifications upon sync completion or errors.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updateSetting(
                  "enable_notifications",
                  settings.enable_notifications === "true" ? "false" : "true"
                )
              }
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                settings.enable_notifications === "true" ? "bg-violet-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.enable_notifications === "true" ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-white/5" />

          {/* Minimize to System Tray */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Minimize2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content-primary">Minimize to System Tray on Close</h3>
                <p className="text-xs text-content-secondary">
                  Keep SnapHarbor running in the background Windows tray when closing the window.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updateSetting(
                  "minimize_to_tray",
                  settings.minimize_to_tray === "true" ? "false" : "true"
                )
              }
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                settings.minimize_to_tray === "true" ? "bg-indigo-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.minimize_to_tray === "true" ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-white/5" />

          {/* Video inclusion */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Video size={20} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content-primary">Include Video Media</h3>
                <p className="text-xs text-content-secondary">
                  Synchronize MP4, MOV, MKV, and AVI video recordings alongside photos.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updateSetting("include_videos", settings.include_videos === "true" ? "false" : "true")
              }
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                settings.include_videos === "true" ? "bg-content-accent" : "bg-white/20"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.include_videos === "true" ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-white/5" />

          {/* Auto-Sync */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <RefreshCw size={20} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content-primary">Automatic Background Sync</h3>
                <p className="text-xs text-content-secondary">
                  Automatically start synchronization as soon as a recognized device is plugged in.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updateSetting(
                  "auto_sync_on_connect",
                  settings.auto_sync_on_connect === "true" ? "false" : "true"
                )
              }
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                settings.auto_sync_on_connect === "true" ? "bg-cyan-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.auto_sync_on_connect === "true" ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </GlassCard>

        {/* Database & Maintenance Card */}
        <GlassCard className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content-primary">Database Maintenance & Cache</h3>
                <p className="text-xs text-content-secondary">
                  Reset deduplication index records or restore default application preferences.
                </p>
              </div>
            </div>
            <button
              onClick={clearHistory}
              className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
            >
              Clear SQLite Index
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
