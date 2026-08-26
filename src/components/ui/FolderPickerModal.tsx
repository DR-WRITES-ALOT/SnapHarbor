import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, HardDrive, Check, X, FolderOpen } from "lucide-react";
import { useSync } from "../../context/SyncContext";

interface FolderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSetting, addToast } = useSync();
  const [selectedPath, setSelectedPath] = useState(settings.destination_folder);

  if (!isOpen) return null;

  const presets = [
    {
      title: "Pictures / SnapHarbor",
      path: "C:\\Users\\User\\Pictures\\SnapHarbor",
      icon: "pictures",
    },
    {
      title: "Desktop / Photo Vault",
      path: "C:\\Users\\User\\Desktop\\Photo_Vault",
      icon: "desktop",
    },
    {
      title: "Secondary Drive (D:\\)",
      path: "D:\\Backups\\SnapHarbor",
      icon: "drive",
    },
    {
      title: "External Storage (E:\\)",
      path: "E:\\External_Storage\\MediaArchive",
      icon: "external",
    },
  ];

  const handleSave = async () => {
    if (selectedPath.trim()) {
      await updateSetting("destination_folder", selectedPath.trim());
      addToast("Destination Updated", `Save path set to: ${selectedPath.trim()}`, "success");
      onClose();
    }
  };

  const handleNativeBrowse = async () => {
    try {
      // In modern browsers, window.showDirectoryPicker() provides a native OS folder chooser
      if ("showDirectoryPicker" in window) {
        // @ts-expect-error browser showDirectoryPicker API
        const dirHandle = await window.showDirectoryPicker();
        if (dirHandle?.name) {
          const simulatedPath = `C:\\Users\\User\\Pictures\\${dirHandle.name}`;
          setSelectedPath(simulatedPath);
          addToast("Folder Selected", `Chosen: ${dirHandle.name}`, "info");
        }
      } else {
        addToast("Directory Selector", "Type custom folder path below", "info");
      }
    } catch {
      // User cancelled dialog
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-lg bg-[#111124]/95 border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Folder size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-content-primary">
                  Select Backup Destination
                </h3>
                <p className="text-xs text-content-secondary">
                  Choose where imported media will be saved on your computer.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-content-secondary hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
              Common Backup Locations
            </span>

            <div className="grid grid-cols-1 gap-2">
              {presets.map((preset) => {
                const isSelected = selectedPath === preset.path;
                return (
                  <button
                    key={preset.path}
                    onClick={() => setSelectedPath(preset.path)}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "bg-purple-500/15 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isSelected ? "bg-purple-500 text-white" : "bg-white/10 text-content-secondary"
                        }`}
                      >
                        <HardDrive size={16} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-content-primary">
                          {preset.title}
                        </span>
                        <span className="text-[10px] font-mono text-content-secondary truncate">
                          {preset.path}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="text-purple-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Path Input & Browse */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
                Custom Folder Path
              </span>
              <button
                onClick={handleNativeBrowse}
                className="text-xs text-content-accent hover:underline flex items-center gap-1 cursor-pointer"
              >
                <FolderOpen size={12} /> Browse PC...
              </button>
            </div>

            <input
              type="text"
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              placeholder="e.g. C:\Users\Username\Pictures\SnapHarbor"
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-content-primary placeholder:text-content-secondary focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-medium text-content-secondary hover:text-content-primary bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] cursor-pointer"
            >
              <Check size={14} /> Set Save Destination
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
