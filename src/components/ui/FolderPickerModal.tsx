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
      path: "C:\\Users\\Photos\\Pictures\\SnapHarbor",
      icon: "pictures",
    },
    {
      title: "Desktop / Photo_Vault",
      path: "C:\\Users\\Photos\\Desktop\\Photo_Vault",
      icon: "desktop",
    },
    {
      title: "D: Drive / Backups / MediaVault",
      path: "D:\\Backups\\MediaVault",
      icon: "drive_d",
    },
    {
      title: "E: Drive / ExternalArchive",
      path: "E:\\External_Storage\\MediaArchive",
      icon: "drive_e",
    },
  ];

  const handleSave = async () => {
    if (!selectedPath.trim()) {
      addToast("Invalid Path", "Please provide a valid folder path.", "warning");
      return;
    }
    await updateSetting("destination_folder", selectedPath.trim());
    addToast("Destination Updated", `Save folder set to ${selectedPath.trim()}`, "success");
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm select-none">
        {/* Backdrop */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-lg bg-[#121226]/95 border border-white/15 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <FolderOpen size={20} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-semibold text-content-primary">
                  Choose Save Destination
                </h3>
                <span className="text-xs text-content-secondary">
                  Where photos and videos will be stored
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-content-secondary hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Custom Path Input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-content-secondary">
              Custom Directory Path
            </label>
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-white/[0.04] border border-white/10 focus-within:border-purple-500/50 transition-all">
              <Folder size={18} className="text-purple-400 ml-2 shrink-0" />
              <input
                type="text"
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
                placeholder="e.g. C:\Backups\SnapHarbor"
                className="bg-transparent border-none outline-none text-xs font-mono text-content-primary w-full px-2"
              />
            </div>
          </div>

          {/* Recommended Presets */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-content-secondary">
              Quick Storage Presets
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((preset) => {
                const isSelected = selectedPath === preset.path;
                return (
                  <div
                    key={preset.path}
                    onClick={() => setSelectedPath(preset.path)}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "bg-purple-500/20 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <HardDrive size={16} className={isSelected ? "text-purple-300" : "text-content-secondary"} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-content-primary truncate">
                          {preset.title}
                        </span>
                        <span className="text-[10px] font-mono text-content-secondary truncate opacity-70">
                          {preset.path}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-purple-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-medium text-content-secondary hover:text-content-primary bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all cursor-pointer"
            >
              Set Destination
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
