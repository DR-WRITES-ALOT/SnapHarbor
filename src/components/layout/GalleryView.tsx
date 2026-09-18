import React, { useState, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Search,
  Star,
  Video,
  Image as ImageIcon,
  FolderOpen,
  Eye,
  Calendar,
  Copy,
  Smartphone,
  Check,
  Grid3X3,
  LayoutGrid,
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { MediaPreviewModal } from "../ui/MediaPreviewModal";
import { useSync } from "../../context/SyncContext";
import type { SyncedMediaItem, DiscoveredMediaFile } from "../../types";
import { tauriApi } from "../../services/tauriApi";

export const GalleryView: React.FC = () => {
  const { galleryMedia, toggleFavorite, openDestinationFolder, addToast } = useSync();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "photos" | "videos" | "favorites">("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [gridDensity, setGridDensity] = useState<"compact" | "normal">("normal");
  const [previewItemIndex, setPreviewItemIndex] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getFileName = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  const isVideoFile = (path: string) => {
    return /\.(mp4|mov|avi|mkv|webm)$/i.test(path);
  };

  // Unique devices in the gallery
  const uniqueDevices = useMemo(() => {
    const devs = new Set<string>();
    galleryMedia.forEach((item) => devs.add(item.device_id));
    return Array.from(devs);
  }, [galleryMedia]);

  // Filtered gallery media
  const filteredItems = useMemo(() => {
    return galleryMedia.filter((item) => {
      const fileName = getFileName(item.local_path).toLowerCase();
      const matchesSearch = fileName.includes(searchQuery.toLowerCase());
      const isVideo = isVideoFile(item.local_path);

      let matchesType = true;
      if (filterType === "photos") matchesType = !isVideo;
      if (filterType === "videos") matchesType = isVideo;
      if (filterType === "favorites") matchesType = !!item.is_favorite;

      const matchesDevice = deviceFilter === "all" || item.device_id === deviceFilter;

      return matchesSearch && matchesType && matchesDevice;
    });
  }, [galleryMedia, searchQuery, filterType, deviceFilter]);

  // Group media by Month/Year timeline
  const timelineGroups = useMemo(() => {
    const groups: { [key: string]: SyncedMediaItem[] } = {};

    filteredItems.forEach((item) => {
      const date = item.media_created_at
        ? new Date(item.media_created_at)
        : new Date(item.synced_at);
      const groupKey = isNaN(date.getTime())
        ? "Recent Backups"
        : date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    return groups;
  }, [filteredItems]);

  const handleCopyPath = (item: SyncedMediaItem) => {
    navigator.clipboard.writeText(item.local_path);
    setCopiedId(item.id);
    addToast("Path Copied", item.local_path, "info");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenInExplorer = (item: SyncedMediaItem) => {
    const parentFolder = item.local_path.substring(0, item.local_path.lastIndexOf("\\"));
    tauriApi.openPath(parentFolder || item.local_path);
    addToast("Opening Vault Folder", parentFolder, "info");
  };

  // Convert SyncedMediaItem[] into DiscoveredMediaFile[] for preview modal
  const previewMediaList: DiscoveredMediaFile[] = useMemo(() => {
    return filteredItems.map((item) => ({
      name: getFileName(item.local_path),
      source_path: item.local_path,
      file_size_bytes: item.file_size_bytes,
      created_at: item.media_created_at || item.synced_at,
      is_video: isVideoFile(item.local_path),
    }));
  }, [filteredItems]);

  const totalVaultBytes = filteredItems.reduce((acc, i) => acc + i.file_size_bytes, 0);

  return (
    <div className="w-full h-full overflow-y-auto min-h-0 flex-1 p-6 sm:p-10 relative z-10 flex flex-col gap-8 select-none overscroll-contain pb-20">
      {/* Header section */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-content-primary">
            Vault Gallery
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Browse and organize backed-up media across all connected devices ({filteredItems.length} items • {formatBytes(totalVaultBytes)})
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Open entire vault folder button */}
          <button
            onClick={openDestinationFolder}
            className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-content-secondary hover:text-content-primary text-xs font-medium flex items-center gap-2 transition-all cursor-pointer"
          >
            <FolderOpen size={14} /> Open Vault
          </button>

          {/* Grid density toggle */}
          <div className="flex p-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
            <button
              onClick={() => setGridDensity("normal")}
              title="Standard Grid"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                gridDensity === "normal"
                  ? "bg-content-accent text-white shadow-sm"
                  : "text-content-secondary hover:text-content-primary"
              }`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setGridDensity("compact")}
              title="Compact Grid"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                gridDensity === "compact"
                  ? "bg-content-accent text-white shadow-sm"
                  : "text-content-secondary hover:text-content-primary"
              }`}
            >
              <Grid3X3 size={14} />
            </button>
          </div>

          {/* Search box */}
          <div className="px-4 py-2 flex items-center gap-2 text-sm text-content-secondary rounded-xl w-56 bg-glass border border-white/10 focus-within:border-white/20 transition-all shadow-glass">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search in vault..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-content-primary w-full placeholder:text-content-secondary text-xs"
            />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/5 pb-4">
        {/* Media type tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              filterType === "all"
                ? "bg-content-accent text-white shadow-sm"
                : "bg-white/[0.04] border border-white/5 text-content-secondary hover:text-content-primary"
            }`}
          >
            All Media ({galleryMedia.length})
          </button>
          <button
            onClick={() => setFilterType("photos")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              filterType === "photos"
                ? "bg-content-accent text-white shadow-sm"
                : "bg-white/[0.04] border border-white/5 text-content-secondary hover:text-content-primary"
            }`}
          >
            <ImageIcon size={13} /> Photos
          </button>
          <button
            onClick={() => setFilterType("videos")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              filterType === "videos"
                ? "bg-content-accent text-white shadow-sm"
                : "bg-white/[0.04] border border-white/5 text-content-secondary hover:text-content-primary"
            }`}
          >
            <Video size={13} /> Videos
          </button>
          <button
            onClick={() => setFilterType("favorites")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              filterType === "favorites"
                ? "bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                : "bg-white/[0.04] border border-white/5 text-content-secondary hover:text-amber-400"
            }`}
          >
            <Star size={13} className={filterType === "favorites" ? "fill-white" : ""} /> Favorites
          </button>
        </div>

        {/* Device selector */}
        {uniqueDevices.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-content-secondary flex items-center gap-1">
              <Smartphone size={13} /> Device:
            </span>
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="bg-[#121226] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-content-primary outline-none cursor-pointer"
            >
              <option value="all">All Devices</option>
              {uniqueDevices.map((dev) => (
                <option key={dev} value={dev}>
                  {dev.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Timeline grouped gallery */}
      {Object.keys(timelineGroups).length === 0 ? (
        <GlassCard className="p-16 text-center text-content-secondary flex flex-col items-center gap-3">
          <ImageIcon size={36} className="text-content-secondary/40" />
          <span className="text-base font-medium text-content-primary">No Media Found in Vault</span>
          <span className="text-xs text-content-secondary max-w-sm">
            {searchQuery || filterType !== "all"
              ? "No items match your filter criteria."
              : "Perform a 1-click sync on the Dashboard to populate your Vault Gallery."}
          </span>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-10 pb-16">
          {Object.entries(timelineGroups).map(([groupTitle, items]) => (
            <div key={groupTitle} className="flex flex-col gap-4">
              {/* Timeline Group Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-content-accent" />
                  <h2 className="text-base font-semibold text-content-primary">{groupTitle}</h2>
                  <span className="text-xs text-content-secondary font-normal">
                    ({items.length} {items.length === 1 ? "item" : "items"})
                  </span>
                </div>
                <span className="text-xs text-content-secondary font-mono">
                  {formatBytes(items.reduce((sum, i) => sum + i.file_size_bytes, 0))}
                </span>
              </div>

              {/* Media Grid */}
              <div
                className={`grid gap-4 ${
                  gridDensity === "compact"
                    ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8"
                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                }`}
              >
                {items.map((item) => {
                  const globalIdx = filteredItems.findIndex((fi) => fi.id === item.id);
                  const isVideo = isVideoFile(item.local_path);
                  const fileName = getFileName(item.local_path);

                  return (
                    <GlassCard
                      key={item.id}
                      className="p-3 flex flex-col gap-2.5 group relative cursor-pointer hover:-translate-y-1 transition-all duration-300"
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
                        {/* Thumbnail */}
                        <img
                          src={`https://picsum.photos/seed/${item.id + 300}/300/300`}
                          alt={fileName}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />

                        {/* Hover Overlay with Preview & Actions */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col justify-between p-2.5 transition-opacity backdrop-blur-[1px]">
                          {/* Top row actions */}
                          <div className="flex items-center justify-between">
                            {/* Favorite Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(item.id);
                              }}
                              title={item.is_favorite ? "Favorited" : "Add to Favorites"}
                              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                                item.is_favorite
                                  ? "bg-amber-500 text-white shadow-lg"
                                  : "bg-black/60 text-white/80 hover:text-amber-400 hover:bg-black/80"
                              }`}
                            >
                              <Star size={13} className={item.is_favorite ? "fill-white" : ""} />
                            </button>

                            {/* Explorer Open Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInExplorer(item);
                              }}
                              title="Show in Windows Explorer"
                              className="p-1.5 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
                            >
                              <FolderOpen size={13} />
                            </button>
                          </div>

                          {/* Center Preview Button */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewItemIndex(globalIdx);
                            }}
                            className="self-center px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-xs font-medium text-white flex items-center gap-1.5 shadow-lg cursor-pointer"
                          >
                            <Eye size={13} /> Preview
                          </div>

                          {/* Bottom Copy Path Button */}
                          <div className="flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPath(item);
                              }}
                              title="Copy Vault Path"
                              className="p-1.5 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
                            >
                              {copiedId === item.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>

                        {/* Video badge (Bottom-Left to avoid overlap with Star button) */}
                        {isVideo && (
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] text-white flex items-center gap-1 font-medium pointer-events-none shadow-md z-10">
                            <Video size={10} /> Video
                          </div>
                        )}

                        {/* Persistent Favorite Star badge (Top-Left when not hovered) */}
                        {item.is_favorite && (
                          <div className="absolute top-2 left-2 p-1.5 rounded-full bg-amber-500 text-white shadow-lg pointer-events-none z-10 group-hover:opacity-0 transition-opacity">
                            <Star size={11} className="fill-white" />
                          </div>
                        )}
                      </div>

                      {/* File Details */}
                      <div className="flex flex-col text-[11px] text-content-secondary gap-0.5 px-1 truncate">
                        <span className="font-medium text-content-primary truncate">{fileName}</span>
                        <div className="flex items-center justify-between text-[10px]">
                          <span>{formatBytes(item.file_size_bytes)}</span>
                          <span className="opacity-60 truncate max-w-[90px]">
                            {item.device_id.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox inspection modal */}
      <AnimatePresence>
        {previewItemIndex !== null && previewMediaList[previewItemIndex] && (
          <MediaPreviewModal
            key="gallery-preview"
            mediaList={previewMediaList}
            currentIndex={previewItemIndex}
            onClose={() => setPreviewItemIndex(null)}
            onSelectIndex={setPreviewItemIndex}
            isSelected={false}
            onToggleSelect={() => {}}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
