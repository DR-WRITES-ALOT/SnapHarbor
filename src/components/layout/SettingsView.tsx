import React, { useState } from "react";
import {
  Folder,
  HardDrive,
  Shield,
  RefreshCw,
  Check,
  FolderTree,
  RotateCcw,
  Bell,
  Sliders,
  BatteryCharging,
  Volume2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useSync } from "../../context/SyncContext";

export const SettingsView: React.FC = () => {
  const { settings, updateSetting, clearHistory, openDestinationFolder } = useSync();
  const [folderInput, setFolderInput] = useState(settings.destination_folder);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleSaveDestination = async () => {
    if (folderInput.trim()) {
      await updateSetting("destination_folder", folderInput.trim());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  const getTreePreview = (format: string) => {
    switch (format) {
      case "YYYY-MM-DD":
        return `SnapHarbor_Backups/
├── 📁 2026-08-27/
│   ├── 🖼️ IMG_1001.JPG
│   ├── 🖼️ IMG_1002.JPG
│   └── 🎥 VID_2004.MP4
└── 📁 2026-08-26/
    └── 🖼️ IMG_0998.JPG`;
      case "Device/YYYY-MM":
        return `SnapHarbor_Backups/
├── 📁 Galaxy_S23_Ultra/
│   └── 📁 2026/
│       └── 📁 08/
│           ├── 🖼️ IMG_1001.JPG
│           └── 🎥 VID_2004.MP4
└── 📁 Sony_Alpha_SD/
    └── 📁 2026/
        └── 📁 08/
            └── 🖼️ DSC_0042.JPG`;
      case "YYYY/MM":
      default:
        return `SnapHarbor_Backups/
├── 📁 2026/
│   ├── 📁 08/
│   │   ├── 🖼️ IMG_1001.JPG
│   │   ├── 🖼️ IMG_1002.JPG
│   │   └── 🎥 VID_2004.MP4
│   └── 📁 07/
│       └── 🖼️ IMG_0890.JPG
└── 📁 2025/
    └── 📁 12/
        └── 🖼️ IMG_0023.JPG`;
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto min-h-0 flex-1 p-6 sm:p-10 relative z-10 flex flex-col gap-8 select-none overscroll-contain pb-20">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-content-primary">Settings & Preferences</h1>
        <p className="text-sm text-content-secondary mt-1">
          Configure backup directories, automation rules, battery thresholds, deduplication, and system integration.
        </p>
      </div>

      <div className="flex flex-col gap-6 max-w-4xl pb-16">
        {/* Backup Vault Path */}
        <GlassCard className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Folder size={20} />
              </div>
              <div>
                <h2 className="text-base font-medium text-content-primary">Default Backup Destination</h2>
                <p className="text-xs text-content-secondary">
                  Where imported photos and videos will be saved on your Windows PC.
                </p>
              </div>
            </div>

            <button
              onClick={openDestinationFolder}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-content-secondary hover:text-content-primary text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink size={13} /> Open Folder
            </button>
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="e.g. C:\Users\Photos\SnapHarbor_Backups"
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-mono text-content-primary placeholder:text-content-secondary focus:outline-none focus:border-content-accent transition-colors"
            />
            <button
              onClick={handleSaveDestination}
              className="px-5 py-2.5 rounded-xl bg-content-accent text-white text-sm font-medium hover:bg-content-accent/90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(59,130,246,0.3)] cursor-pointer"
            >
              {savedSuccess ? <Check size={16} /> : null}
              {savedSuccess ? "Saved" : "Save Path"}
            </button>
          </div>
        </GlassCard>

        {/* Organization Format & Live Tree Preview */}
        <GlassCard className="p-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <HardDrive size={20} />
            </div>
            <div>
              <h2 className="text-base font-medium text-content-primary">Folder Structure Organization</h2>
              <p className="text-xs text-content-secondary">
                Choose how files are automatically categorized inside your vault.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "YYYY/MM", label: "Year / Month", example: "2026/08/IMG_001.jpg" },
              { id: "YYYY-MM-DD", label: "Exact Date", example: "2026-08-27/IMG_001.jpg" },
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

          {/* Dynamic Hierarchy Visualizer */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary flex items-center gap-1.5">
              <FolderTree size={14} className="text-content-accent" /> Live Vault Hierarchy Preview
            </span>
            <pre className="font-mono text-xs text-emerald-400/90 leading-relaxed overflow-x-auto p-2 bg-white/[0.02] rounded-xl border border-white/5">
              {getTreePreview(settings.date_format)}
            </pre>
          </div>
        </GlassCard>

        {/* Automation & Scheduling Rules */}
        <GlassCard className="p-6 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-base font-medium text-content-primary">Automation & Background Rules</h2>
              <p className="text-xs text-content-secondary">
                Configure automatic triggers, interval synchronization, and battery protection.
              </p>
            </div>
          </div>

          {/* Auto-Sync on Connect */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 text-cyan-400 flex items-center justify-center">
                <RefreshCw size={18} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content-primary">Auto-Sync on Device Plug-In</h3>
                <p className="text-xs text-content-secondary">
                  Automatically start backing up media the moment a phone or SD card is connected.
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
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
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

          <div className="h-px bg-white/5" />

          {/* Periodic Sync Interval */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 text-cyan-400 flex items-center justify-center">
                <Clock size={18} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content-primary">Periodic Sync Interval</h3>
                <p className="text-xs text-content-secondary">
                  Automatically re-check connected devices for newly captured photos in the background.
                </p>
              </div>
            </div>
            <select
              value={settings.auto_sync_interval_mins || "0"}
              onChange={(e) => updateSetting("auto_sync_interval_mins", e.target.value)}
              className="bg-[#121226] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-content-primary outline-none cursor-pointer"
            >
              <option value="0">Disabled (Manual Only)</option>
              <option value="15">Every 15 Minutes</option>
              <option value="30">Every 30 Minutes</option>
              <option value="60">Every 1 Hour</option>
              <option value="120">Every 2 Hours</option>
            </select>
          </div>

          <div className="h-px bg-white/5" />

          {/* Battery Guard Threshold */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 text-emerald-400 flex items-center justify-center">
                <BatteryCharging size={18} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content-primary">Battery Protection Guard</h3>
                <p className="text-xs text-content-secondary">
                  Pause automatic synchronization if the connected device's battery is below threshold.
                </p>
              </div>
            </div>
            <select
              value={settings.min_battery_threshold || "20"}
              onChange={(e) => updateSetting("min_battery_threshold", e.target.value)}
              className="bg-[#121226] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-content-primary outline-none cursor-pointer"
            >
              <option value="0">No Restriction</option>
              <option value="15">At least 15%</option>
              <option value="20">At least 20% (Recommended)</option>
              <option value="30">At least 30%</option>
              <option value="50">At least 50%</option>
            </select>
          </div>

          <div className="h-px bg-white/5" />

          {/* Sound Alerts */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 text-purple-400 flex items-center justify-center">
                <Volume2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content-primary">Audio Feedback Chimes</h3>
                <p className="text-xs text-content-secondary">
                  Play harmonic audio chimes on device recognition and sync completion.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                updateSetting(
                  "sound_alerts_enabled",
                  settings.sound_alerts_enabled === "true" ? "false" : "true"
                )
              }
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.sound_alerts_enabled === "true" ? "bg-purple-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.sound_alerts_enabled === "true" ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </GlassCard>

        {/* Media & Deduplication Toggles */}
        <GlassCard className="p-6 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-base font-medium text-content-primary">Media Integrity & Filtering</h2>
              <p className="text-xs text-content-secondary">
                Deduplication algorithms and file type filters.
              </p>
            </div>
          </div>

          {/* Deduplication */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-content-primary">Smart SHA-256 Deduplication</h3>
              <p className="text-xs text-content-secondary">
                Skip importing files that have already been backed up into SQLite database.
              </p>
            </div>
            <button
              onClick={() =>
                updateSetting("skip_duplicates", settings.skip_duplicates === "true" ? "false" : "true")
              }
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
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

          {/* Video inclusion */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-content-primary">Include Video Recordings</h3>
              <p className="text-xs text-content-secondary">
                Synchronize MP4, MOV, MKV, and AVI video recordings alongside photos.
              </p>
            </div>
            <button
              onClick={() =>
                updateSetting("include_videos", settings.include_videos === "true" ? "false" : "true")
              }
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
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
        </GlassCard>

        {/* Windows System Tray & Notifications */}
        <GlassCard className="p-6 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-base font-medium text-content-primary">Windows Desktop Integration</h2>
              <p className="text-xs text-content-secondary">
                System tray behavior and Windows OS toast notifications.
              </p>
            </div>
          </div>

          {/* Minimize to Tray */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-content-primary">Minimize to System Tray on Close (X)</h3>
              <p className="text-xs text-content-secondary">
                Keep SnapHarbor running in the background when the main window is closed.
              </p>
            </div>
            <button
              onClick={() =>
                updateSetting(
                  "minimize_to_tray",
                  settings.minimize_to_tray === "true" ? "false" : "true"
                )
              }
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.minimize_to_tray === "true" ? "bg-amber-500" : "bg-white/20"
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

          {/* Desktop Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-content-primary">Native Windows OS Notifications</h3>
              <p className="text-xs text-content-secondary">
                Show Windows toast notifications upon synchronization completion.
              </p>
            </div>
            <button
              onClick={() =>
                updateSetting(
                  "enable_notifications",
                  settings.enable_notifications === "true" ? "false" : "true"
                )
              }
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.enable_notifications === "true" ? "bg-amber-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.enable_notifications === "true" ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </GlassCard>

        {/* Database Maintenance */}
        <GlassCard className="p-6 flex flex-col gap-4 border-rose-500/20 bg-rose-950/[0.04]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <RotateCcw size={20} />
              </div>
              <div>
                <h2 className="text-base font-medium text-content-primary">Database Maintenance</h2>
                <p className="text-xs text-content-secondary">
                  Clear local SQLite history index (does not delete physical backed-up files on disk).
                </p>
              </div>
            </div>

            {showClearConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 text-content-secondary hover:text-content-primary text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    clearHistory();
                    setShowClearConfirm(false);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-lg cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 text-xs font-medium transition-colors cursor-pointer"
              >
                Reset SQLite Index
              </button>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
