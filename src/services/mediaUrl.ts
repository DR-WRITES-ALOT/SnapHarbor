import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Media URL resolution.
 *
 * SnapHarbor stores absolute local paths in SQLite (`synced_media.local_path`).
 * To render those files we hand the path to Tauri's `convertFileSrc`, which
 * rewrites it into an `asset:` URL served by the Rust side. The asset protocol
 * must be enabled in `tauri.conf.json` (`app.security.assetProtocol`).
 *
 * Outside a Tauri runtime (plain `npm run dev` in a browser) local files are not
 * reachable at all, so we render an inline SVG placeholder instead of hitting the
 * network — the app has no remote dependencies by design.
 */

export const isTauriEnv =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const VIDEO_EXTENSIONS = ["mp4", "mov", "mkv", "avi", "webm", "3gp", "m4v"];

const PHOTO_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "heic",
  "heif",
  "webp",
  "gif",
  "bmp",
  "tiff",
  "tif",
  "raw",
  "cr2",
  "nef",
  "dng",
  "arw",
];

export function extensionOf(path?: string | null): string {
  if (!path) return "";
  const clean = path.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  if (dot === -1 || dot === clean.length - 1) return "";
  return clean.slice(dot + 1).toLowerCase();
}

export function isVideoPath(path?: string | null): boolean {
  return VIDEO_EXTENSIONS.includes(extensionOf(path));
}

export function isPhotoPath(path?: string | null): boolean {
  return PHOTO_EXTENSIONS.includes(extensionOf(path));
}

/** File name for display, from either a Windows or POSIX style path. */
export function fileNameOf(path?: string | null): string {
  if (!path) return "";
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** Parent folder for either a Windows or POSIX style path. */
export function parentFolderOf(path?: string | null): string {
  if (!path) return "";
  const idx = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return idx > 0 ? path.slice(0, idx) : path;
}

const PHOTO_PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
<rect width="320" height="320" fill="#0d0d1a"/>
<g stroke="#ffffff" stroke-opacity="0.16" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
<rect x="92" y="104" width="136" height="110" rx="16"/>
<circle cx="130" cy="142" r="12"/>
<path d="M100 200l38-36 27 25 31-29 26 26"/>
</g>
<text x="160" y="252" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="15" fill="#ffffff" fill-opacity="0.30">Preview unavailable</text>
</svg>`;

const VIDEO_PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
<rect width="320" height="320" fill="#0d0d1a"/>
<g stroke="#ffffff" stroke-opacity="0.16" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
<rect x="82" y="100" width="156" height="112" rx="18"/>
<path d="M142 132l40 24-40 24z" fill="#ffffff" fill-opacity="0.22" stroke="none"/>
</g>
<text x="160" y="252" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="15" fill="#ffffff" fill-opacity="0.30">Video</text>
</svg>`;

const placeholders: Record<"photo" | "video", string> = {
  photo: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PHOTO_PLACEHOLDER)}`,
  video: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(VIDEO_PLACEHOLDER)}`,
};

export function placeholderSrc(kind: "photo" | "video" = "photo"): string {
  return placeholders[kind];
}

/** True when a real file can be loaded from `path` in this runtime. */
export function canLoadLocalFile(path?: string | null): boolean {
  return Boolean(isTauriEnv && path);
}

/**
 * Resolve a stored absolute path into a URL the webview can render.
 * Falls back to an inline placeholder when unavailable — never a network URL.
 */
export function resolveMediaSrc(path?: string | null): string {
  const kind = isVideoPath(path) ? "video" : "photo";
  if (!canLoadLocalFile(path)) return placeholderSrc(kind);
  try {
    return convertFileSrc(path as string);
  } catch {
    return placeholderSrc(kind);
  }
}
