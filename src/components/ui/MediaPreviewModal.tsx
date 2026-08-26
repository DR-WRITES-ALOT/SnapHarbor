import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Calendar,
  HardDrive,
  Video,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import type { DiscoveredMediaFile } from "../../types";

interface MediaPreviewModalProps {
  mediaList: DiscoveredMediaFile[];
  currentIndex: number;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
  isSelected: boolean;
  onToggleSelect: (index: number) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  mediaList,
  currentIndex,
  onClose,
  onSelectIndex,
  isSelected,
  onToggleSelect,
}) => {
  const [zoom, setZoom] = useState(1);

  const currentItem = mediaList[currentIndex];
  const total = mediaList.length;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setZoom(1);
      onSelectIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setZoom(1);
      onSelectIndex(currentIndex + 1);
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === " ") {
        e.preventDefault();
        onToggleSelect(currentIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, total, isSelected]);

  if (!currentItem) return null;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Unknown";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/85 backdrop-blur-md">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-5xl h-[85vh] bg-[#0f0f1c]/95 border border-white/15 rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Media Preview Area */}
        <div className="flex-1 h-full relative bg-black/60 flex items-center justify-center overflow-hidden group">
          {/* Image / Video Display */}
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          >
            {currentItem.is_video ? (
              <div className="flex flex-col items-center gap-4 text-content-secondary">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-white">
                  <Video size={36} />
                </div>
                <span className="text-sm font-medium">{currentItem.name}</span>
                <span className="text-xs opacity-60">Video Preview Available on Local Storage</span>
              </div>
            ) : (
              <img
                src={`https://picsum.photos/seed/${currentIndex + 120}/1200/800`}
                alt={currentItem.name}
                className="max-w-full max-h-full object-contain select-none"
              />
            )}
          </div>

          {/* Navigation Arrows */}
          {currentIndex > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer shadow-lg z-20"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {currentIndex < total - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-white flex items-center justify-center backdrop-blur-md transition-all cursor-pointer shadow-lg z-20"
            >
              <ChevronRight size={24} />
            </button>
          )}

          {/* Zoom Controls */}
          {!currentItem.is_video && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md text-white text-xs z-20">
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="px-2 font-mono">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Metadata & Actions Sidebar */}
        <div className="w-full md:w-80 h-full border-t md:border-t-0 md:border-l border-white/10 bg-glass/40 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="flex flex-col gap-6">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
                Item {currentIndex + 1} of {total}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-content-secondary hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Title & Type */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-content-accent text-xs font-medium">
                {currentItem.is_video ? <Video size={14} /> : <ImageIcon size={14} />}
                <span>{currentItem.is_video ? "Video Media" : "Photo Image"}</span>
              </div>
              <h3 className="text-lg font-semibold text-content-primary break-all">
                {currentItem.name}
              </h3>
            </div>

            {/* Metadata Details */}
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-content-secondary flex items-center gap-1.5">
                  <HardDrive size={13} /> Size
                </span>
                <span className="font-mono text-content-primary font-medium">
                  {formatBytes(currentItem.file_size_bytes)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-content-secondary flex items-center gap-1.5">
                  <Calendar size={13} /> Captured
                </span>
                <span className="text-content-primary">{formatDate(currentItem.created_at)}</span>
              </div>

              <div className="flex flex-col gap-1 pt-2 border-t border-white/5">
                <span className="text-content-secondary">Device Source Path</span>
                <span className="font-mono text-[10px] text-content-primary/80 break-all">
                  {currentItem.source_path}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col gap-3 mt-6">
            <button
              onClick={() => onToggleSelect(currentIndex)}
              className={`w-full py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isSelected
                  ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  : "bg-content-accent/20 hover:bg-content-accent/30 text-content-primary border border-content-accent/30"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                  isSelected ? "border-white bg-white text-emerald-600" : "border-white/40"
                }`}
              >
                {isSelected && <Check size={12} />}
              </div>
              <span>{isSelected ? "Selected for Sync" : "Select this Item"}</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-medium text-content-secondary hover:text-content-primary bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
