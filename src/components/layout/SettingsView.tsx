import React, { useState } from "react";
import { Folder, HardDrive, Shield, Video, RefreshCw, Check } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useSync } from "../../context/SyncContext";

export const SettingsView: React.FC = () => {
  const { settings, updateSetting } = useSync();
  const [folderInput, setFolderInput] = useState(settings.destination_folder);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveDestination = async () => {
    if (folderInput.trim()) {
      await updateSetting("destination_folder", folderInput.trim());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-10 relative z-10 flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-content-primary">Settings & Preferences</h1>
        <p className="text-sm text-content-secondary mt-1">
          Customize backup destination, date hierarchy rules, deduplication, and sync triggers.
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

        {/* Organization Format */}
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
        </GlassCard>

        {/* Sync Toggles */}
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
        </GlassCard>
      </div>
    </div>
  );
};
