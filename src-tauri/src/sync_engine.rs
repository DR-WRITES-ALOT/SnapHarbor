use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::SystemTime;
use walkdir::WalkDir;

/// Largest block we read/write at a time while hashing or copying (1 MiB).
const BUFFER_SIZE: usize = 1024 * 1024;

/// Directory names we never descend into — OS bookkeeping folders that either
/// hold no user media or throw permission errors on a freshly mounted card.
const SKIPPED_DIRS: [&str; 6] = [
    "System Volume Information",
    "$RECYCLE.BIN",
    ".Trash",
    ".Trashes",
    "found.000",
    "Recovery",
];

/// Windows reserves these names for devices; they cannot be used for files or
/// folders no matter which extension they carry.
const RESERVED_NAMES: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredMediaFile {
    pub name: String,
    pub source_path: String,
    pub file_size_bytes: u64,
    pub created_at: Option<String>,
    pub is_video: bool,
    pub is_synced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummary {
    pub total_discovered: usize,
    pub total_bytes: u64,
    pub unsynced_count: usize,
    pub unsynced_bytes: u64,
    pub files: Vec<DiscoveredMediaFile>,
    /// True when this listing came from the demo/simulation layer.
    pub simulated: bool,
    /// Set when the scan could not be completed.
    pub error: Option<String>,
}

/// Stage of the pipeline a given file is currently in.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SyncPhase {
    Hashing,
    Copying,
    Verifying,
    Done,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProgressEvent {
    pub current_file: String,
    pub current_index: usize,
    pub total_files: usize,
    pub percent: u32,
    pub bytes_copied: u64,
    pub total_bytes: u64,
    pub status: String,
    pub completed: bool,
    pub error: Option<String>,
    pub phase: SyncPhase,
    pub cancelled: bool,
    pub simulated: bool,
}

/// What happened to a single file during placement.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlacementOutcome {
    /// The file was written into the vault at this path.
    Copied { path: PathBuf, bytes: u64 },
    /// An identical file (same SHA-256) was already at the destination and the
    /// existing copy was re-linked instead of being duplicated.
    Adopted { path: PathBuf, bytes: u64 },
    /// The transfer was cancelled by the user before completion.
    Cancelled,
}

pub fn is_video_extension(ext: &str) -> bool {
    let lower = ext.to_lowercase();
    ["mp4", "mov", "mkv", "avi", "webm", "3gp", "m4v"].contains(&lower.as_str())
}

pub fn is_photo_extension(ext: &str) -> bool {
    let lower = ext.to_lowercase();
    [
        "jpg", "jpeg", "png", "heic", "heif", "webp", "gif", "bmp", "tiff", "tif", "raw", "cr2",
        "nef", "dng", "arw",
    ]
    .contains(&lower.as_str())
}

pub fn is_media_extension(ext: &str, include_videos: bool) -> bool {
    if is_photo_extension(ext) {
        return true;
    }
    include_videos && is_video_extension(ext)
}

pub fn calculate_file_sha256(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; BUFFER_SIZE];

    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Hash a file while reporting progress, and stop early when cancelled.
///
/// Returns `Ok(None)` when the user cancelled before the hash completed.
pub fn hash_file_interruptible(
    path: &Path,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(u64),
) -> io::Result<Option<String>> {
    let mut reader = BufReader::with_capacity(BUFFER_SIZE, File::open(path)?);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; BUFFER_SIZE];
    let mut total = 0u64;

    loop {
        if cancel.load(Ordering::Relaxed) {
            return Ok(None);
        }
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
        total += count as u64;
        on_progress(total);
    }

    Ok(Some(format!("{:x}", hasher.finalize())))
}

/// True when a directory name is OS bookkeeping rather than user media.
fn is_skipped_dir(name: &str) -> bool {
    name.starts_with('$') || SKIPPED_DIRS.iter().any(|skip| skip.eq_ignore_ascii_case(name))
}

pub fn scan_directory_media(source_dir: &Path, include_videos: bool) -> Vec<DiscoveredMediaFile> {
    let mut discovered = Vec::new();

    if !source_dir.exists() {
        return discovered;
    }

    let walker = WalkDir::new(source_dir)
        .max_depth(8)
        .into_iter()
        .filter_entry(|entry| {
            if entry.file_type().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    // Never prune the root itself, only children of it.
                    if entry.depth() > 0 && is_skipped_dir(name) {
                        return false;
                    }
                }
            }
            true
        });

    for entry in walker.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
            continue;
        };
        if !is_media_extension(ext, include_videos) {
            continue;
        }

        let metadata = entry.metadata().ok();
        let file_size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let created_at = metadata
            .and_then(|m| m.created().or_else(|_| m.modified()).ok())
            .map(|st: SystemTime| {
                let dt: DateTime<Utc> = st.into();
                dt.to_rfc3339()
            });

        discovered.push(DiscoveredMediaFile {
            name: path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("file")
                .to_string(),
            source_path: path.to_string_lossy().to_string(),
            file_size_bytes,
            created_at,
            is_video: is_video_extension(ext),
            is_synced: false,
        });
    }

    discovered
}

/// Make a string safe to use as a single Windows path component.
///
/// Device names come straight from the OS (for example `Camera Storage (E:)`)
/// and used to be pushed into the destination path verbatim, which produced an
/// invalid path on Windows and made every copy into a `Device/YYYY-MM` vault
/// fail silently.
pub fn sanitize_path_component(raw: &str) -> String {
    let mut cleaned: String = raw
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if (c as u32) < 32 => '_',
            c => c,
        })
        .collect();

    // Windows silently strips trailing dots/spaces, which then collides with
    // the un-stripped name, so we do it explicitly.
    cleaned = cleaned.trim_end_matches(['.', ' ']).to_string();
    cleaned = cleaned.trim().to_string();

    if cleaned.is_empty() {
        return "Unknown".to_string();
    }

    // Keep well clear of the classic 260-char MAX_PATH limit.
    if cleaned.chars().count() > 120 {
        cleaned = cleaned.chars().take(120).collect();
    }

    let stem = cleaned
        .split('.')
        .next()
        .unwrap_or(&cleaned)
        .to_ascii_uppercase();
    if RESERVED_NAMES.contains(&stem.as_str()) {
        return format!("_{}", cleaned);
    }

    cleaned
}

/// Build the destination path for one file.
///
/// `organize_by_date` was previously ignored entirely — the setting existed in
/// the UI and the database but the engine always created date folders.
pub fn generate_destination_path(
    destination_root: &Path,
    device_name: &str,
    created_at_rfc3339: Option<&str>,
    file_name: &str,
    date_format: &str,
    organize_by_date: bool,
) -> PathBuf {
    let mut target_dir = destination_root.to_path_buf();

    if organize_by_date {
        let captured = created_at_rfc3339
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);

        match date_format {
            "YYYY-MM-DD" => {
                target_dir.push(captured.format("%Y-%m-%d").to_string());
            }
            "Device/YYYY-MM" => {
                target_dir.push(sanitize_path_component(device_name));
                target_dir.push(captured.format("%Y").to_string());
                target_dir.push(captured.format("%m").to_string());
            }
            _ => {
                target_dir.push(captured.format("%Y").to_string());
                target_dir.push(captured.format("%m").to_string());
            }
        }
    }

    target_dir.push(sanitize_path_component(file_name));
    target_dir
}

/// Pick a free file name, appending `_1`, `_2`, ... when needed.
fn unique_target_path(target: &Path) -> PathBuf {
    if !target.exists() {
        return target.to_path_buf();
    }

    let parent = target.parent().map(Path::to_path_buf).unwrap_or_default();
    let stem = target
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file")
        .to_string();
    let ext = target.extension().and_then(|e| e.to_str()).unwrap_or("");

    let mut counter = 1;
    loop {
        let candidate_name = if ext.is_empty() {
            format!("{}_{}", stem, counter)
        } else {
            format!("{}_{}.{}", stem, counter, ext)
        };
        let candidate = parent.join(candidate_name);
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

fn part_path_for(target: &Path) -> PathBuf {
    let mut name = target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    name.push_str(".part");
    match target.parent() {
        Some(parent) => parent.join(name),
        None => PathBuf::from(name),
    }
}

/// Stream a file into `dest`, reporting bytes written. Returns `Ok(None)` if the
/// user cancelled mid-copy.
fn copy_streaming(
    source: &Path,
    dest: &Path,
    cancel: &AtomicBool,
    on_bytes: &mut impl FnMut(u64),
) -> io::Result<Option<u64>> {
    let mut reader = BufReader::with_capacity(BUFFER_SIZE, File::open(source)?);
    let mut writer = BufWriter::with_capacity(BUFFER_SIZE, File::create(dest)?);
    let mut buffer = vec![0u8; BUFFER_SIZE];
    let mut total = 0u64;

    loop {
        if cancel.load(Ordering::Relaxed) {
            return Ok(None);
        }
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        writer.write_all(&buffer[..count])?;
        total += count as u64;
        on_bytes(total);
    }

    writer.flush()?;
    writer.into_inner().map_err(|e| e.into_error())?.sync_all()?;
    Ok(Some(total))
}

/// Put `source` into the vault at `target`.
///
/// - If an identical file (matching `expected_hash`) is already at `target`, the
///   existing copy is adopted and reported back — this is what makes "clear the
///   index and sync again" re-link files instead of duplicating the vault.
/// - Otherwise the bytes are streamed to a `.part` file and renamed into place
///   only after the size is verified, so an interrupted or failed transfer can
///   never leave a truncated file that looks like a successful backup.
pub fn place_file(
    source: &Path,
    target: &Path,
    expected_hash: Option<&str>,
    cancel: &AtomicBool,
    mut on_bytes: impl FnMut(u64),
) -> io::Result<PlacementOutcome> {
    let source_size = fs::metadata(source)?.len();

    if target.exists() {
        let existing_size = fs::metadata(target)?.len();
        let hash_matches = match (expected_hash, existing_size == source_size) {
            (Some(expected), true) => calculate_file_sha256(target)
                .map(|existing| existing.eq_ignore_ascii_case(expected))
                .unwrap_or(false),
            _ => false,
        };

        if hash_matches {
            return Ok(PlacementOutcome::Adopted {
                path: target.to_path_buf(),
                bytes: existing_size,
            });
        }
    }

    let final_target = unique_target_path(target);
    if let Some(parent) = final_target.parent() {
        fs::create_dir_all(parent)?;
    }

    // Remove a leftover part file from a previous interrupted run.
    let part_path = part_path_for(&final_target);
    if part_path.exists() {
        let _ = fs::remove_file(&part_path);
    }

    let copied = match copy_streaming(source, &part_path, cancel, &mut on_bytes) {
        Ok(Some(bytes)) => bytes,
        Ok(None) => {
            let _ = fs::remove_file(&part_path);
            return Ok(PlacementOutcome::Cancelled);
        }
        Err(error) => {
            let _ = fs::remove_file(&part_path);
            return Err(error);
        }
    };

    if copied != source_size {
        let _ = fs::remove_file(&part_path);
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            format!(
                "only {} of {} bytes were copied — the source may have been disconnected",
                copied, source_size
            ),
        ));
    }

    let written = fs::metadata(&part_path)?.len();
    if written != source_size {
        let _ = fs::remove_file(&part_path);
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("verification failed: {} of {} bytes on disk", written, source_size),
        ));
    }

    fs::rename(&part_path, &final_target)?;

    Ok(PlacementOutcome::Copied {
        path: final_target,
        bytes: copied,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicBool;

    fn scratch_dir(label: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "snapharbor_test_{}_{}_{:?}",
            label,
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).expect("create scratch dir");
        path
    }

    #[test]
    fn sanitizes_windows_illegal_characters() {
        assert_eq!(
            sanitize_path_component("Camera Storage (E:)"),
            "Camera Storage (E_)"
        );
        assert_eq!(
            sanitize_path_component(r#"a<b>c:d"e/f\g|h?i*j"#),
            "a_b_c_d_e_f_g_h_i_j"
        );
    }

    #[test]
    fn sanitizes_reserved_and_degenerate_names() {
        assert_eq!(sanitize_path_component("CON"), "_CON");
        assert_eq!(sanitize_path_component("nul.txt"), "_nul.txt");
        assert_eq!(sanitize_path_component("   "), "Unknown");
        assert_eq!(sanitize_path_component(""), "Unknown");
        assert_eq!(sanitize_path_component("trailing."), "trailing");
        assert_eq!(sanitize_path_component("trailing   "), "trailing");
    }

    #[test]
    fn keeps_normal_names_untouched() {
        assert_eq!(sanitize_path_component("IMG_1001.JPG"), "IMG_1001.JPG");
        assert_eq!(sanitize_path_component("Galaxy S23 Ultra"), "Galaxy S23 Ultra");
    }

    #[test]
    fn destination_path_honours_organize_by_date() {
        let root = Path::new("vault");
        let dated = generate_destination_path(
            root,
            "Phone",
            Some("2026-08-27T10:00:00Z"),
            "IMG_1.JPG",
            "YYYY/MM",
            true,
        );
        assert_eq!(dated, Path::new("vault").join("2026").join("08").join("IMG_1.JPG"));

        let flat = generate_destination_path(
            root,
            "Phone",
            Some("2026-08-27T10:00:00Z"),
            "IMG_1.JPG",
            "YYYY/MM",
            false,
        );
        assert_eq!(flat, Path::new("vault").join("IMG_1.JPG"));
    }

    #[test]
    fn destination_path_sanitizes_device_folder_names() {
        let path = generate_destination_path(
            Path::new("vault"),
            "Camera Storage (E:)",
            Some("2026-08-27T10:00:00Z"),
            "DSC_0001.JPG",
            "Device/YYYY-MM",
            true,
        );
        let rendered = path.to_string_lossy().replace('\\', "/");
        assert!(
            !rendered.contains(':'),
            "device folder must not contain a colon: {rendered}"
        );
        assert!(rendered.contains("Camera Storage (E_)/2026/08/DSC_0001.JPG"));
    }

    #[test]
    fn media_extension_filtering() {
        assert!(is_media_extension("JPG", true));
        assert!(is_media_extension("heic", false));
        assert!(is_media_extension("m4v", true));
        assert!(!is_media_extension("m4v", false));
        assert!(!is_media_extension("txt", true));
        assert!(is_video_extension("MOV"));
        assert!(!is_video_extension("jpg"));
    }

    #[test]
    fn hashes_match_reference_value() {
        let dir = scratch_dir("hash");
        let file = dir.join("abc.txt");
        fs::write(&file, b"abc").unwrap();
        assert_eq!(
            calculate_file_sha256(&file).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn copied_file_matches_source() {
        let dir = scratch_dir("copy");
        let source = dir.join("source.bin");
        let payload = vec![7u8; 300_000];
        fs::write(&source, &payload).unwrap();
        let target = dir.join("vault").join("nested").join("source.bin");

        let cancel = AtomicBool::new(false);
        let mut seen = 0u64;
        let outcome = place_file(&source, &target, None, &cancel, |bytes| seen = bytes).unwrap();

        match outcome {
            PlacementOutcome::Copied { path, bytes } => {
                assert_eq!(path, target);
                assert_eq!(bytes, payload.len() as u64);
            }
            other => panic!("expected a copy, got {other:?}"),
        }
        assert_eq!(fs::read(&target).unwrap(), payload);
        assert_eq!(seen, payload.len() as u64);
        // the temporary part file must be gone
        assert!(!part_path_for(&target).exists());
    }

    #[test]
    fn identical_file_is_adopted_not_duplicated() {
        let dir = scratch_dir("adopt");
        let source = dir.join("IMG_1.JPG");
        fs::write(&source, b"identical-bytes").unwrap();
        let target = dir.join("vault").join("IMG_1.JPG");
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::write(&target, b"identical-bytes").unwrap();
        let hash = calculate_file_sha256(&source).unwrap();

        let cancel = AtomicBool::new(false);
        let outcome = place_file(&source, &target, Some(&hash), &cancel, |_| {}).unwrap();

        assert!(matches!(outcome, PlacementOutcome::Adopted { .. }));
        assert!(!dir.join("vault").join("IMG_1_1.JPG").exists());
    }

    #[test]
    fn different_content_at_same_path_gets_a_unique_name() {
        let dir = scratch_dir("unique");
        let source = dir.join("IMG_1.JPG");
        fs::write(&source, b"new-content").unwrap();
        let target = dir.join("vault").join("IMG_1.JPG");
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::write(&target, b"old-content").unwrap();
        let hash = calculate_file_sha256(&source).unwrap();

        let cancel = AtomicBool::new(false);
        let outcome = place_file(&source, &target, Some(&hash), &cancel, |_| {}).unwrap();

        match outcome {
            PlacementOutcome::Copied { path, .. } => {
                assert_eq!(path.file_name().unwrap(), "IMG_1_1.JPG");
            }
            other => panic!("expected a copy, got {other:?}"),
        }
        assert_eq!(fs::read(&target).unwrap(), b"old-content");
        assert_eq!(
            fs::read(dir.join("vault").join("IMG_1_1.JPG")).unwrap(),
            b"new-content"
        );
    }

    #[test]
    fn cancellation_leaves_no_partial_file() {
        let dir = scratch_dir("cancel");
        let source = dir.join("big.bin");
        fs::write(&source, vec![1u8; 200_000]).unwrap();
        let target = dir.join("vault").join("big.bin");
        let cancel = AtomicBool::new(true);

        let outcome = place_file(&source, &target, None, &cancel, |_| {}).unwrap();
        assert_eq!(outcome, PlacementOutcome::Cancelled);
        assert!(!target.exists());
        assert!(!part_path_for(&target).exists());
    }

    #[test]
    fn interruptible_hash_stops_when_cancelled() {
        let dir = scratch_dir("hashcancel");
        let file = dir.join("file.bin");
        fs::write(&file, vec![3u8; 100_000]).unwrap();

        let cancel = AtomicBool::new(true);
        assert!(hash_file_interruptible(&file, &cancel, |_| {}).unwrap().is_none());

        let cancel = AtomicBool::new(false);
        assert!(hash_file_interruptible(&file, &cancel, |_| {}).unwrap().is_some());
    }

    #[test]
    fn scan_skips_system_folders_and_finds_media() {
        let dir = scratch_dir("scan");
        fs::create_dir_all(dir.join("DCIM")).unwrap();
        fs::create_dir_all(dir.join("System Volume Information")).unwrap();
        fs::create_dir_all(dir.join("$RECYCLE.BIN")).unwrap();
        fs::write(dir.join("DCIM").join("IMG_0001.JPG"), b"photo").unwrap();
        fs::write(dir.join("DCIM").join("VID_0001.MP4"), b"video").unwrap();
        fs::write(dir.join("DCIM").join("notes.txt"), b"ignore me").unwrap();
        fs::write(
            dir.join("System Volume Information").join("IMG_9999.JPG"),
            b"bookkeeping",
        )
        .unwrap();

        let photos_only = scan_directory_media(&dir, false);
        assert_eq!(photos_only.len(), 1);
        assert_eq!(photos_only[0].name, "IMG_0001.JPG");

        let with_videos = scan_directory_media(&dir, true);
        assert_eq!(with_videos.len(), 2);
        assert!(with_videos.iter().any(|f| f.is_video));
    }
}
