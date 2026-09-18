mod db;
mod sync_engine;
mod wpd;

use db::{NewSyncedMedia, StorageStats, SyncedMediaItem};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use sync_engine::{
    generate_destination_path, hash_file_interruptible, place_file, scan_directory_media,
    DiscoveredMediaFile, PlacementOutcome, ScanSummary, SyncPhase, SyncProgressEvent,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_notification::NotificationExt;
use wpd::{DeviceInfo, WpdManager};

/// Shared application state.
pub struct AppState {
    /// Shared so background sync workers can hold their own handle to it.
    pub db_conn: Arc<Mutex<Option<rusqlite::Connection>>>,
    /// Set to true by `cancel_sync`; the running transfer checks it between
    /// files and between copy blocks.
    pub sync_cancel: Arc<AtomicBool>,
}

/// Result of a sync run, returned to the frontend so it can report exactly what
/// happened instead of assuming success.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncOutcome {
    /// Files actually written into the vault.
    pub synced: usize,
    /// Files that already existed in the vault with identical content and were
    /// re-linked rather than copied again.
    pub adopted: usize,
    /// Files skipped because identical content is already indexed.
    pub skipped_duplicates: usize,
    /// Files that could not be transferred.
    pub failed: usize,
    /// Human readable reasons for the failures (capped).
    pub errors: Vec<String>,
    pub cancelled: bool,
    /// True when nothing was written because this was a demo run.
    pub simulated: bool,
}

struct SyncJob {
    device_id: String,
    device_name: String,
    source_root: PathBuf,
    destination: PathBuf,
    selection: Option<Vec<String>>,
    date_format: String,
    organize_by_date: bool,
    skip_duplicates: bool,
    include_videos: bool,
    notify: bool,
}

/// Real devices are always produced by drive-letter discovery and carry a
/// `drive_X` id. Every other id comes from the demo switcher in the UI.
fn is_simulated_device_id(device_id: &str) -> bool {
    !device_id.starts_with("drive_")
}

/// Run `action` with a locked connection, if the database is available.
///
/// Keeps the locking boilerplate out of the transfer loop, where the nested
/// `lock()` / `as_ref()` matches otherwise fight the borrow checker (a guard
/// temporary outlives the `State` it came from).
fn with_conn<R>(
    db: &Arc<Mutex<Option<rusqlite::Connection>>>,
    action: impl FnOnce(&rusqlite::Connection) -> R,
) -> Option<R> {
    let lock = db.lock().ok()?;
    let conn = lock.as_ref()?;
    Some(action(conn))
}

/// Let the webview read the folders it needs for thumbnail and lightbox
/// previews.
///
/// Rather than opening the asset protocol up to the whole filesystem in
/// `tauri.conf.json`, the scope is widened at runtime to exactly two things:
/// the configured vault folder, and the mount roots of drives that are actually
/// plugged in right now.
fn allow_preview_paths(app: &AppHandle, paths: &[Option<String>]) {
    let scope = app.asset_protocol_scope();

    for path in paths.iter().flatten() {
        if path.trim().is_empty() {
            continue;
        }
        if let Err(error) = scope.allow_directory(path, true) {
            eprintln!("SnapHarbor: previews disabled for {} ({})", path, error);
        }
    }
}

fn emit_progress(app: &AppHandle, event: SyncProgressEvent) {
    let _ = app.emit("sync://progress", event);
}

fn error_event(
    file: &DiscoveredMediaFile,
    index: usize,
    total: usize,
    bytes_copied: u64,
    total_bytes: u64,
    message: String,
    simulated: bool,
) -> SyncProgressEvent {
    SyncProgressEvent {
        current_file: file.name.clone(),
        current_index: index,
        total_files: total,
        percent: (((index) as f64 / total.max(1) as f64) * 100.0) as u32,
        bytes_copied,
        total_bytes,
        status: format!("Failed: {}", file.name),
        completed: false,
        error: Some(message),
        phase: SyncPhase::Error,
        cancelled: false,
        simulated,
    }
}

#[tauri::command]
fn get_devices(app: AppHandle, state: State<'_, AppState>) -> Vec<DeviceInfo> {
    let simulation_enabled = {
        let lock = match state.db_conn.lock() {
            Ok(lock) => lock,
            Err(_) => return Vec::new(),
        };
        match lock.as_ref() {
            Some(conn) => db::is_setting_enabled(conn, "simulation_enabled", false),
            None => false,
        }
    };

    let devices = match WpdManager::new() {
        Ok(manager) => manager.get_connected_devices(simulation_enabled),
        Err(_) => Vec::new(),
    };

    // Real mounts can be previewed straight from the device.
    let roots: Vec<Option<String>> = devices
        .iter()
        .filter(|d| !d.is_simulated)
        .map(|d| d.mount_path.clone())
        .collect();
    allow_preview_paths(&app, &roots);

    devices
}

#[tauri::command]
fn get_app_settings(state: State<'_, AppState>) -> Result<HashMap<String, String>, String> {
    let lock = state.db_conn.lock().map_err(|e| e.to_string())?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    let keys = [
        "destination_folder",
        "organize_by_date",
        "date_format",
        "auto_sync_on_connect",
        "auto_sync_interval_mins",
        "min_battery_threshold",
        "sound_alerts_enabled",
        "skip_duplicates",
        "include_videos",
        "enable_notifications",
        "minimize_to_tray",
        "simulation_enabled",
    ];

    let mut map = HashMap::new();
    for k in keys {
        let val = db::get_setting(conn, k, "");
        map.insert(k.to_string(), val);
    }

    Ok(map)
}

#[tauri::command]
fn update_app_setting(
    app: AppHandle,
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<bool, String> {
    let lock = state.db_conn.lock().map_err(|e| e.to_string())?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    db::set_setting(conn, &key, &value).map_err(|e| e.to_string())?;

    if key == "destination_folder" {
        allow_preview_paths(&app, &[Some(value)]);
    }

    Ok(true)
}

#[tauri::command]
fn get_storage_stats(state: State<'_, AppState>) -> Result<StorageStats, String> {
    let lock = state.db_conn.lock().map_err(|e| e.to_string())?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    db::get_storage_stats(conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_recent_media(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<SyncedMediaItem>, String> {
    let lock = state.db_conn.lock().map_err(|e| e.to_string())?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    db::get_recent_synced_media(conn, limit.unwrap_or(24)).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_vault_gallery(
    state: State<'_, AppState>,
    limit: Option<usize>,
    offset: Option<usize>,
    device_id: Option<String>,
    favorites_only: Option<bool>,
) -> Result<Vec<SyncedMediaItem>, String> {
    let lock = state.db_conn.lock().map_err(|e| e.to_string())?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    db::get_synced_media(
        conn,
        limit,
        offset.unwrap_or(0),
        device_id.as_deref(),
        favorites_only.unwrap_or(false),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_media_favorite(state: State<'_, AppState>, media_id: i64) -> Result<bool, String> {
    let lock = state.db_conn.lock().map_err(|e| e.to_string())?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    db::toggle_favorite(conn, media_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn unsync_media_item(
    state: State<'_, AppState>,
    device_id: String,
    remote_path: String,
) -> Result<bool, String> {
    let lock = state.db_conn.lock().map_err(|e| e.to_string())?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    db::unsync_media_by_remote_path(conn, &device_id, &remote_path).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn clear_sync_history(state: State<'_, AppState>) -> Result<bool, String> {
    let lock = state.db_conn.lock().map_err(|e| e.to_string())?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    db::clear_all_sync_history(conn).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Build the demo listing used by simulation mode.
///
/// This is only ever reached when the user has switched demo mode on in
/// Settings, and the result is flagged so the UI can label it. The app never
/// invents media on its own any more.
fn simulated_scan(include_videos: bool) -> ScanSummary {
    let mut files = Vec::new();

    for i in 1..=24 {
        let is_video = include_videos && i % 5 == 0;
        let size = if is_video {
            45_000_000 + i * 2_500_000
        } else {
            3_500_000 + i * 400_000
        };
        let name = format!("IMG_{:04}.{}", 1000 + i, if is_video { "MP4" } else { "JPG" });

        files.push(DiscoveredMediaFile {
            name: name.clone(),
            source_path: format!("/DCIM/Camera/{}", name),
            file_size_bytes: size as u64,
            created_at: Some(chrono::Utc::now().to_rfc3339()),
            is_video,
            is_synced: false,
        });
    }

    let total_bytes: u64 = files.iter().map(|f| f.file_size_bytes).sum();
    let unsynced_count = files.len();
    let unsynced_bytes = total_bytes;

    ScanSummary {
        total_discovered: files.len(),
        total_bytes,
        unsynced_count,
        unsynced_bytes,
        files,
        simulated: true,
        error: None,
    }
}

#[tauri::command]
fn scan_device_media(
    state: State<'_, AppState>,
    device_id: String,
    path: Option<String>,
) -> Result<ScanSummary, String> {
    let lock = state.db_conn.lock().map_err(|e| e.to_string())?;
    let conn = lock.as_ref().ok_or("Database not initialized")?;

    let include_videos = db::is_setting_enabled(conn, "include_videos", true);
    let simulation_enabled = db::is_setting_enabled(conn, "simulation_enabled", false);

    if is_simulated_device_id(&device_id) {
        if !simulation_enabled {
            return Err(
                "This is a demo device and demo mode is switched off. Enable it in Settings, or select a real camera, SD card, or drive."
                    .to_string(),
            );
        }
        return Ok(simulated_scan(include_videos));
    }

    let source_path = match path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => {
            return Ok(ScanSummary {
                total_discovered: 0,
                total_bytes: 0,
                unsynced_count: 0,
                unsynced_bytes: 0,
                files: Vec::new(),
                simulated: false,
                error: Some(
                    "This device does not expose a readable folder. Cameras and phones must be mounted as a drive (mass storage) to be scanned."
                        .to_string(),
                ),
            })
        }
    };

    if !source_path.exists() {
        return Ok(ScanSummary {
            total_discovered: 0,
            total_bytes: 0,
            unsynced_count: 0,
            unsynced_bytes: 0,
            files: Vec::new(),
            simulated: false,
            error: Some(format!("{} is not accessible right now.", source_path.display())),
        });
    }

    let mut discovered = scan_directory_media(&source_path, include_videos);
    for file in &mut discovered {
        file.is_synced = db::is_remote_path_or_hash_synced(conn, &device_id, &file.source_path);
    }

    let total_discovered = discovered.len();
    let total_bytes: u64 = discovered.iter().map(|f| f.file_size_bytes).sum();
    let unsynced_count = discovered.iter().filter(|f| !f.is_synced).count();
    let unsynced_bytes: u64 = discovered
        .iter()
        .filter(|f| !f.is_synced)
        .map(|f| f.file_size_bytes)
        .sum();

    Ok(ScanSummary {
        total_discovered,
        total_bytes,
        unsynced_count,
        unsynced_bytes,
        files: discovered,
        simulated: false,
        error: None,
    })
}

#[tauri::command]
fn send_desktop_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    let _ = app.notification().builder().title(title).body(body).show();
    Ok(())
}

/// Ask the running transfer to stop.
#[tauri::command]
fn cancel_sync(state: State<'_, AppState>) -> Result<bool, String> {
    state.sync_cancel.store(true, Ordering::SeqCst);
    Ok(true)
}

/// Demo transfer: emits believable progress and writes nothing at all.
fn run_simulated_sync(
    app: AppHandle,
    device_name: String,
    selection: Option<Vec<String>>,
    include_videos: bool,
    cancel: Arc<AtomicBool>,
) -> SyncOutcome {
    let scan = simulated_scan(include_videos);
    let targets: Vec<DiscoveredMediaFile> = match selection {
        Some(names) if !names.is_empty() => scan
            .files
            .into_iter()
            .filter(|f| names.contains(&f.name))
            .collect(),
        _ => scan.files,
    };

    let total = targets.len();
    let total_bytes: u64 = targets.iter().map(|f| f.file_size_bytes).sum();
    let mut copied_bytes = 0u64;
    let mut cancelled = false;

    for (index, file) in targets.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            cancelled = true;
            break;
        }

        std::thread::sleep(std::time::Duration::from_millis(120));
        copied_bytes += file.file_size_bytes;

        emit_progress(
            &app,
            SyncProgressEvent {
                current_file: file.name.clone(),
                current_index: index + 1,
                total_files: total,
                percent: (((index + 1) as f64 / total.max(1) as f64) * 100.0) as u32,
                bytes_copied: copied_bytes,
                total_bytes,
                status: format!("Demo transfer {} of {}", index + 1, total),
                completed: index + 1 == total,
                error: None,
                phase: SyncPhase::Copying,
                cancelled: false,
                simulated: true,
            },
        );
    }

    emit_progress(
        &app,
        SyncProgressEvent {
            current_file: String::new(),
            current_index: total,
            total_files: total,
            percent: 100,
            bytes_copied: copied_bytes,
            total_bytes,
            status: if cancelled {
                format!("Demo run cancelled for {}", device_name)
            } else {
                format!("Demo run finished for {}", device_name)
            },
            completed: true,
            error: None,
            phase: SyncPhase::Done,
            cancelled,
            simulated: true,
        },
    );

    SyncOutcome {
        synced: 0,
        adopted: 0,
        skipped_duplicates: 0,
        failed: 0,
        errors: Vec::new(),
        cancelled,
        simulated: true,
    }
}

/// Point a device path at a byte-identical copy that is already in the vault.
///
/// Without this, a file skipped as a duplicate would stay flagged as "unsynced"
/// on the device forever and be re-hashed on every run.
fn link_existing_copy(
    conn: &rusqlite::Connection,
    job: &SyncJob,
    hash: &str,
    file: &DiscoveredMediaFile,
) {
    if db::is_remote_path_or_hash_synced(conn, &job.device_id, &file.source_path) {
        return;
    }

    let Some(existing) = db::find_local_path_by_hash(conn, hash) else {
        return;
    };

    let record = NewSyncedMedia {
        device_id: job.device_id.clone(),
        remote_object_id: None,
        remote_path: Some(file.source_path.clone()),
        local_path: existing,
        file_size_bytes: file.file_size_bytes as i64,
        file_hash_sha256: hash.to_string(),
        media_created_at: file.created_at.clone(),
    };

    let _ = db::record_synced_file(conn, &record);
}

/// The real transfer. Runs on a blocking thread so the UI and the async runtime
/// stay responsive, and checks `cancel` between files and between copy blocks.
fn run_real_sync(
    app: AppHandle,
    job: SyncJob,
    cancel: Arc<AtomicBool>,
    db: Arc<Mutex<Option<rusqlite::Connection>>>,
) -> SyncOutcome {
    let mut outcome = SyncOutcome {
        synced: 0,
        adopted: 0,
        skipped_duplicates: 0,
        failed: 0,
        errors: Vec::new(),
        cancelled: false,
        simulated: false,
    };

    let mut files = scan_directory_media(&job.source_root, job.include_videos);
    if let Some(selection) = job.selection.as_ref() {
        if !selection.is_empty() {
            files.retain(|f| selection.contains(&f.name));
        }
    }

    let total = files.len();
    let total_bytes: u64 = files.iter().map(|f| f.file_size_bytes).sum();

    if total == 0 {
        let message = if job.selection.as_ref().is_some_and(|s| !s.is_empty()) {
            "None of the selected files are present on the device any more."
        } else {
            "No supported photos or videos were found on this device."
        };
        outcome.failed = 0;
        outcome.errors.push(message.to_string());
        emit_progress(
            &app,
            SyncProgressEvent {
                current_file: String::new(),
                current_index: 0,
                total_files: 0,
                percent: 100,
                bytes_copied: 0,
                total_bytes: 0,
                status: message.to_string(),
                completed: true,
                error: Some(message.to_string()),
                phase: SyncPhase::Error,
                cancelled: false,
                simulated: false,
            },
        );
        return outcome;
    }

    let mut copied_bytes = 0u64;

    for (index, file) in files.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            outcome.cancelled = true;
            break;
        }

        let source = PathBuf::from(&file.source_path);
        let position = index + 1;

        // ---- 1. Hash the source (needed for dedup and for adoption) ----------
        emit_progress(
            &app,
            SyncProgressEvent {
                current_file: file.name.clone(),
                current_index: index,
                total_files: total,
                percent: ((index as f64 / total as f64) * 100.0) as u32,
                bytes_copied: copied_bytes,
                total_bytes,
                status: format!("Analysing {} of {}", position, total),
                completed: false,
                error: None,
                phase: SyncPhase::Hashing,
                cancelled: false,
                simulated: false,
            },
        );

        let hash = match hash_file_interruptible(&source, &cancel, |_| {}) {
            Ok(Some(hash)) => hash,
            Ok(None) => {
                outcome.cancelled = true;
                break;
            }
            Err(error) => {
                let message = format!("{}: {}", file.name, error);
                outcome.failed += 1;
                if outcome.errors.len() < 20 {
                    outcome.errors.push(message.clone());
                }
                emit_progress(
                    &app,
                    error_event(file, position, total, copied_bytes, total_bytes, message, false),
                );
                continue;
            }
        };

        // ---- 2. Skip files whose content is already in the vault ------------
        if job.skip_duplicates {
            let already_known = with_conn(&db, |conn| {
                let known = db::is_file_synced(conn, &hash);
                if known {
                    // Point this device+path at the copy we already have, so the
                    // device stops reporting the file as new on every scan.
                    link_existing_copy(conn, &job, &hash, file);
                }
                known
            })
            .unwrap_or(false);

            if already_known {
                outcome.skipped_duplicates += 1;
                copied_bytes += file.file_size_bytes;
                emit_progress(
                    &app,
                    SyncProgressEvent {
                        current_file: file.name.clone(),
                        current_index: position,
                        total_files: total,
                        percent: ((position as f64 / total as f64) * 100.0) as u32,
                        bytes_copied: copied_bytes,
                        total_bytes,
                        status: format!("Already in vault ({})", file.name),
                        completed: position == total,
                        error: None,
                        phase: SyncPhase::Done,
                        cancelled: false,
                        simulated: false,
                    },
                );
                continue;
            }
        }

        // ---- 3. Place the file (atomic copy, or adopt an existing copy) -----
        let target = generate_destination_path(
            &job.destination,
            &job.device_name,
            file.created_at.as_deref(),
            &file.name,
            &job.date_format,
            job.organize_by_date,
        );

        emit_progress(
            &app,
            SyncProgressEvent {
                current_file: file.name.clone(),
                current_index: index,
                total_files: total,
                percent: ((index as f64 / total as f64) * 100.0) as u32,
                bytes_copied: copied_bytes,
                total_bytes,
                status: format!("Copying {} of {}", position, total),
                completed: false,
                error: None,
                phase: SyncPhase::Copying,
                cancelled: false,
                simulated: false,
            },
        );

        // Byte-level progress, throttled so we do not flood the event channel.
        let mut last_reported = 0u64;
        let app_for_progress = app.clone();
        let file_name = file.name.clone();
        let bytes_before_file = copied_bytes;

        let placed = place_file(&source, &target, Some(&hash), &cancel, move |copied| {
            if copied - last_reported < 8 * 1024 * 1024 {
                return;
            }
            last_reported = copied;
            emit_progress(
                &app_for_progress,
                SyncProgressEvent {
                    current_file: file_name.clone(),
                    current_index: index,
                    total_files: total,
                    percent: ((index as f64 / total as f64) * 100.0) as u32,
                    bytes_copied: bytes_before_file + copied,
                    total_bytes,
                    status: format!("Copying {} of {}", position, total),
                    completed: false,
                    error: None,
                    phase: SyncPhase::Copying,
                    cancelled: false,
                    simulated: false,
                },
            );
        });

        match placed {
            Ok(PlacementOutcome::Copied { path, bytes }) => {
                copied_bytes += bytes;
                outcome.synced += 1;

                let record = NewSyncedMedia {
                    device_id: job.device_id.clone(),
                    remote_object_id: None,
                    remote_path: Some(file.source_path.clone()),
                    local_path: path.to_string_lossy().to_string(),
                    file_size_bytes: bytes as i64,
                    file_hash_sha256: hash.clone(),
                    media_created_at: file.created_at.clone(),
                };

                match with_conn(&db, |conn| db::record_synced_file(conn, &record)) {
                    Some(Err(error)) => {
                        let message =
                            format!("{} was copied but could not be indexed: {}", file.name, error);
                        outcome.failed += 1;
                        if outcome.errors.len() < 20 {
                            outcome.errors.push(message.clone());
                        }
                        emit_progress(
                            &app,
                            error_event(
                                file,
                                position,
                                total,
                                copied_bytes,
                                total_bytes,
                                message,
                                false,
                            ),
                        );
                    }
                    None => {
                        let message = format!(
                            "{} was copied but the index is unavailable, so it is not tracked yet.",
                            file.name
                        );
                        outcome.failed += 1;
                        if outcome.errors.len() < 20 {
                            outcome.errors.push(message.clone());
                        }
                    }
                    Some(Ok(_)) => {}
                }
            }
            Ok(PlacementOutcome::Adopted { path, bytes }) => {
                copied_bytes += bytes;
                outcome.adopted += 1;

                with_conn(&db, |conn| {
                    if !db::is_remote_path_or_hash_synced(conn, &job.device_id, &file.source_path) {
                        let record = NewSyncedMedia {
                            device_id: job.device_id.clone(),
                            remote_object_id: None,
                            remote_path: Some(file.source_path.clone()),
                            local_path: path.to_string_lossy().to_string(),
                            file_size_bytes: bytes as i64,
                            file_hash_sha256: hash.clone(),
                            media_created_at: file.created_at.clone(),
                        };
                        let _ = db::record_synced_file(conn, &record);
                    }
                });
            }
            Ok(PlacementOutcome::Cancelled) => {
                outcome.cancelled = true;
                break;
            }
            Err(error) => {
                let message = format!("{}: {}", file.name, error);
                outcome.failed += 1;
                if outcome.errors.len() < 20 {
                    outcome.errors.push(message.clone());
                }
                emit_progress(
                    &app,
                    error_event(file, position, total, copied_bytes, total_bytes, message, false),
                );
                continue;
            }
        }

        emit_progress(
            &app,
            SyncProgressEvent {
                current_file: file.name.clone(),
                current_index: position,
                total_files: total,
                percent: ((position as f64 / total as f64) * 100.0) as u32,
                bytes_copied: copied_bytes,
                total_bytes,
                status: format!("Stored {} of {}", position, total),
                completed: position == total,
                error: None,
                phase: SyncPhase::Done,
                cancelled: false,
                simulated: false,
            },
        );
    }

    emit_progress(
        &app,
        SyncProgressEvent {
            current_file: String::new(),
            current_index: total,
            total_files: total,
            percent: 100,
            bytes_copied: copied_bytes,
            total_bytes,
            status: if outcome.cancelled {
                "Sync cancelled".to_string()
            } else if outcome.failed > 0 {
                format!("Finished with {} error(s)", outcome.failed)
            } else {
                "Sync complete".to_string()
            },
            completed: true,
            error: outcome.errors.first().cloned(),
            phase: if outcome.failed > 0 {
                SyncPhase::Error
            } else {
                SyncPhase::Done
            },
            cancelled: outcome.cancelled,
            simulated: false,
        },
    );

    if job.notify && !outcome.cancelled {
        let title = if outcome.failed > 0 {
            "SnapHarbor finished with errors"
        } else {
            "SnapHarbor Sync Complete"
        };
        let body = if outcome.failed > 0 {
            format!(
                "{} backed up, {} failed. {}",
                outcome.synced,
                outcome.failed,
                outcome.errors.first().cloned().unwrap_or_default()
            )
        } else {
            format!(
                "Backed up {} item(s) from {}{}",
                outcome.synced,
                job.device_name,
                if outcome.adopted > 0 {
                    format!(", re-linked {}", outcome.adopted)
                } else {
                    String::new()
                }
            )
        };
        let _ = app.notification().builder().title(title).body(body).show();
    }

    outcome
}

#[tauri::command]
async fn start_sync(
    app: AppHandle,
    device_id: String,
    device_name: String,
    source_path: Option<String>,
    selected_file_names: Option<Vec<String>>,
) -> Result<SyncOutcome, String> {
    // Grab the shared handles once, then let go of the State borrow entirely.
    let (db, cancel) = {
        let state = app.state::<AppState>();
        state.sync_cancel.store(false, Ordering::SeqCst);
        (state.db_conn.clone(), state.sync_cancel.clone())
    };

    // Read configuration before doing any heavy work.
    let (
        dest_dir,
        date_format,
        organize_by_date,
        skip_dupes,
        include_videos,
        notify,
        simulation_enabled,
    ) = match with_conn(&db, |conn| {
        (
            db::get_setting(conn, "destination_folder", "./SnapHarbor_Backups"),
            db::get_setting(conn, "date_format", "YYYY/MM"),
            db::is_setting_enabled(conn, "organize_by_date", true),
            db::is_setting_enabled(conn, "skip_duplicates", true),
            db::is_setting_enabled(conn, "include_videos", true),
            db::is_setting_enabled(conn, "enable_notifications", true),
            db::is_setting_enabled(conn, "simulation_enabled", false),
        )
    }) {
        Some(config) => config,
        None => return Err("Database not initialized".to_string()),
    };

    with_conn(&db, |conn| {
        let _ = db::register_or_update_device(conn, &device_id, &device_name, None);
    });

    // Demo devices never touch the disk or the index.
    if is_simulated_device_id(&device_id) {
        if !simulation_enabled {
            return Err(
                "This is a demo device and demo mode is switched off. Enable it in Settings, or select a real device."
                    .to_string(),
            );
        }

        let app_handle = app.clone();
        let device = device_name.clone();
        return tauri::async_runtime::spawn_blocking(move || {
            run_simulated_sync(app_handle, device, selected_file_names, include_videos, cancel)
        })
        .await
        .map_err(|e| e.to_string());
    }

    let source_root = match source_path {
        Some(path) if !path.trim().is_empty() => PathBuf::from(path),
        _ => {
            return Err(
                "This device does not expose a readable path, so nothing can be copied. Cameras and phones must be mounted as a drive (mass storage mode) to be synced."
                    .to_string(),
            )
        }
    };

    if !source_root.exists() {
        return Err(format!(
            "{} is not accessible. Reconnect the device and try again.",
            source_root.display()
        ));
    }

    let destination = PathBuf::from(&dest_dir);
    if let Err(error) = std::fs::create_dir_all(&destination) {
        return Err(format!(
            "Could not create the vault folder {}: {}",
            destination.display(),
            error
        ));
    }

    let job = SyncJob {
        device_id,
        device_name,
        source_root,
        destination,
        selection: selected_file_names,
        date_format,
        organize_by_date,
        skip_duplicates: skip_dupes,
        include_videos,
        notify,
    };

    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || run_real_sync(app_handle, job, cancel, db))
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            db_conn: Arc::new(Mutex::new(None)),
            sync_cancel: Arc::new(AtomicBool::new(false)),
        })
        .setup(|app| {
            // Setup SQLite Database in app data dir
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            let _ = std::fs::create_dir_all(&app_data_dir);

            let db_path = app_data_dir.join("autosync.db");
            let conn = db::init_db(db_path).expect("Failed to initialize SQLite database");

            // Store DB in state
            let state = app.state::<AppState>();
            *state.db_conn.lock().unwrap() = Some(conn);

            // Vault thumbnails need the asset protocol to reach this folder.
            let destination = app
                .state::<AppState>()
                .db_conn
                .lock()
                .ok()
                .and_then(|lock| {
                    lock.as_ref()
                        .map(|conn| db::get_setting(conn, "destination_folder", ""))
                })
                .unwrap_or_default();
            allow_preview_paths(app.handle(), &[Some(destination)]);

            // Setup System Tray Menu
            let show_item = MenuItem::with_id(app, "show", "Show SnapHarbor", true, None::<&str>)?;
            let sync_item =
                MenuItem::with_id(app, "start_sync", "Start 1-Click Sync", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit SnapHarbor", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[&show_item, &sync_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip("SnapHarbor AutoSync")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "start_sync" => {
                        let _ = app.emit("tray://trigger-sync", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app);

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                let should_minimize = {
                    if let Ok(lock) = state.db_conn.lock() {
                        if let Some(conn) = lock.as_ref() {
                            db::is_setting_enabled(conn, "minimize_to_tray", true)
                        } else {
                            true
                        }
                    } else {
                        true
                    }
                };

                if should_minimize {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_devices,
            get_app_settings,
            update_app_setting,
            get_storage_stats,
            get_recent_media,
            get_vault_gallery,
            toggle_media_favorite,
            scan_device_media,
            clear_sync_history,
            unsync_media_item,
            send_desktop_notification,
            start_sync,
            cancel_sync
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
