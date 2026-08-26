use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use walkdir::WalkDir;

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
}

pub fn is_media_extension(ext: &str, include_videos: bool) -> bool {
    let lower = ext.to_lowercase();
    let photo_extensions = ["jpg", "jpeg", "png", "heic", "webp", "gif", "bmp", "tiff", "raw", "cr2", "nef", "dng", "arw"];
    let video_extensions = ["mp4", "mov", "mkv", "avi", "webm", "3gp", "m4v"];

    if photo_extensions.contains(&lower.as_str()) {
        return true;
    }
    if include_videos && video_extensions.contains(&lower.as_str()) {
        return true;
    }
    false
}

pub fn calculate_file_sha256(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536]; // 64KB buffer

    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }

    let hash_result = hasher.finalize();
    Ok(format!("{:x}", hash_result))
}

pub fn scan_directory_media(source_dir: &Path, include_videos: bool) -> Vec<DiscoveredMediaFile> {
    let mut discovered = Vec::new();

    if !source_dir.exists() {
        return discovered;
    }

    for entry in WalkDir::new(source_dir)
        .max_depth(8)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if is_media_extension(ext, include_videos) {
                    let metadata = entry.metadata().ok();
                    let file_size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

                    let created_at = metadata.and_then(|m| m.created().or_else(|_| m.modified()).ok())
                        .map(|st: SystemTime| {
                            let dt: DateTime<Utc> = st.into();
                            dt.to_rfc3339()
                        });

                    let lower_ext = ext.to_lowercase();
                    let is_video = ["mp4", "mov", "mkv", "avi", "webm", "3gp"].contains(&lower_ext.as_str());

                    discovered.push(DiscoveredMediaFile {
                        name: path.file_name().and_then(|n| n.to_str()).unwrap_or("file").to_string(),
                        source_path: path.to_string_lossy().to_string(),
                        file_size_bytes,
                        created_at,
                        is_video,
                        is_synced: false,
                    });
                }
            }
        }
    }

    discovered
}

pub fn generate_destination_path(
    destination_root: &Path,
    device_name: &str,
    created_at_rfc3339: Option<&str>,
    file_name: &str,
    date_format: &str,
) -> PathBuf {
    let mut target_dir = destination_root.to_path_buf();

    let dt = created_at_rfc3339
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    match date_format {
        "YYYY/MM" => {
            target_dir.push(dt.format("%Y").to_string());
            target_dir.push(dt.format("%m").to_string());
        }
        "YYYY-MM-DD" => {
            target_dir.push(dt.format("%Y-%m-%d").to_string());
        }
        "Device/YYYY-MM" => {
            target_dir.push(device_name);
            target_dir.push(dt.format("%Y/%m").to_string());
        }
        _ => {
            target_dir.push(dt.format("%Y").to_string());
            target_dir.push(dt.format("%m").to_string());
        }
    }

    target_dir.push(file_name);
    target_dir
}

pub fn copy_media_file_safe(source_path: &Path, target_path: &Path) -> io::Result<u64> {
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Ensure unique target name if duplicate filename exists but distinct content
    let mut final_target = target_path.to_path_buf();
    if final_target.exists() {
        let stem = target_path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
        let ext = target_path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let mut counter = 1;
        while final_target.exists() {
            let new_name = if ext.is_empty() {
                format!("{}_{}", stem, counter)
            } else {
                format!("{}_{}.{}", stem, counter, ext)
            };
            final_target = target_path.with_file_name(new_name);
            counter += 1;
        }
    }

    fs::copy(source_path, &final_target)
}
