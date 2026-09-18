import React, { useState } from "react";
import { Play } from "lucide-react";
import { placeholderSrc, resolveMediaSrc } from "../../services/mediaUrl";

interface MediaThumbProps {
  /** Absolute local path of the media file, if it is reachable. */
  path?: string | null;
  isVideo?: boolean;
  alt: string;
  className?: string;
  /** Show the small play badge overlay for videos. */
  showVideoBadge?: boolean;
}

/**
 * Renders a real media thumbnail from disk, degrading to an inline placeholder
 * when the file is missing, unreadable, or we are running outside Tauri.
 * Replaces the previous hardcoded remote placeholder images.
 */
export const MediaThumb: React.FC<MediaThumbProps> = ({
  path,
  isVideo,
  alt,
  className,
  showVideoBadge = true,
}) => {
  const [failed, setFailed] = useState(false);
  const kind = isVideo ? "video" : "photo";
  const src = failed ? placeholderSrc(kind) : resolveMediaSrc(path);

  return (
    <>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className={className}
      />
      {isVideo && showVideoBadge && (
        <span className="absolute bottom-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 backdrop-blur-sm">
          <Play size={11} className="fill-current" />
        </span>
      )}
    </>
  );
};
