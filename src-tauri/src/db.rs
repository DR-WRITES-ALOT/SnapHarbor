use rusqlite::{params, Connection, Result, ToSql};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncedMediaItem {
    pub id: i64,
    pub device_id: String,
    pub remote_path: Option<String>,
    pub local_path: String,
    pub file_size_bytes: i64,
    pub file_hash_sha256: String,
    pub media_created_at: Option<String>,
    pub synced_at: String,
    pub deleted_from_phone: bool,
    pub is_favorite: bool,
    /// Whether the recorded file still exists on disk. Surfaced so the UI can
    /// flag index rows whose file was moved or deleted outside SnapHarbor.
    pub file_exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewSyncedMedia {
    pub device_id: String,
    pub remote_object_id: Option<String>,
    pub remote_path: Option<String>,
    pub local_path: String,
    pub file_size_bytes: i64,
    pub file_hash_sha256: String,
    pub media_created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    pub total_files_synced: i64,
    pub total_bytes_synced: i64,
    pub total_devices_connected: i64,
    pub last_sync_timestamp: Option<String>,
}

pub fn init_db(db_path: PathBuf) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS devices (
            device_id TEXT PRIMARY KEY,
            friendly_name TEXT NOT NULL,
            manufacturer TEXT,
            last_synced_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        (),
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS synced_media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            remote_object_id TEXT,
            remote_path TEXT,
            local_path TEXT NOT NULL,
            file_size_bytes INTEGER NOT NULL,
            file_hash_sha256 TEXT NOT NULL,
            media_created_at DATETIME,
            synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            deleted_from_phone INTEGER DEFAULT 0,
            is_favorite INTEGER DEFAULT 0,
            FOREIGN KEY(device_id) REFERENCES devices(device_id)
        )",
        (),
    )?;

    // Safe migration if is_favorite column does not exist
    let _ = conn.execute(
        "ALTER TABLE synced_media ADD COLUMN is_favorite INTEGER DEFAULT 0",
        (),
    );

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_media_hash ON synced_media(file_hash_sha256)",
        (),
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_device_remote ON synced_media(device_id, remote_path)",
        (),
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_media_fav ON synced_media(is_favorite)",
        (),
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        (),
    )?;

    seed_default_settings(&conn)?;

    Ok(conn)
}

/// Defaults for every setting the app understands.
///
/// Keep in sync with `src/config/settings.ts`, which mirrors these keys for the
/// frontend. `delete_after_sync` used to live here but was never read by any
/// code path, so it was removed rather than left looking functional.
fn seed_default_settings(conn: &Connection) -> Result<()> {
    let default_destination = dirs_next_or_default();

    let defaults = [
        ("destination_folder", default_destination.as_str()),
        ("organize_by_date", "true"),
        ("date_format", "YYYY/MM"),
        ("auto_sync_on_connect", "false"),
        ("auto_sync_interval_mins", "0"),
        ("min_battery_threshold", "20"),
        ("sound_alerts_enabled", "true"),
        ("skip_duplicates", "true"),
        ("include_videos", "true"),
        ("enable_notifications", "true"),
        ("minimize_to_tray", "true"),
        ("simulation_enabled", "false"),
    ];

    for (key, val) in defaults {
        conn.execute(
            "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?1, ?2)",
            params![key, val],
        )?;
    }

    Ok(())
}

fn dirs_next_or_default() -> String {
    if let Some(user_dirs) = std::env::var_os("USERPROFILE") {
        let mut p = PathBuf::from(user_dirs);
        p.push("Pictures");
        p.push("SnapHarbor");
        return p.to_string_lossy().to_string();
    }
    "./SnapHarbor_Backups".to_string()
}

pub fn get_setting(conn: &Connection, key: &str, default_value: &str) -> String {
    let mut stmt = match conn.prepare("SELECT value FROM app_settings WHERE key = ?1") {
        Ok(s) => s,
        Err(_) => return default_value.to_string(),
    };

    stmt.query_row(params![key], |row| row.get::<_, String>(0))
        .unwrap_or_else(|_| default_value.to_string())
}

/// Settings are stored as text; this keeps the parsing in one place.
pub fn is_setting_enabled(conn: &Connection, key: &str, default: bool) -> bool {
    let fallback = if default { "true" } else { "false" };
    get_setting(conn, key, fallback).eq_ignore_ascii_case("true")
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn register_or_update_device(
    conn: &Connection,
    device_id: &str,
    friendly_name: &str,
    manufacturer: Option<&str>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO devices (device_id, friendly_name, manufacturer, last_synced_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(device_id) DO UPDATE SET
            friendly_name = excluded.friendly_name,
            manufacturer = COALESCE(excluded.manufacturer, devices.manufacturer),
            last_synced_at = CURRENT_TIMESTAMP",
        params![device_id, friendly_name, manufacturer],
    )?;
    Ok(())
}

pub fn is_file_synced(conn: &Connection, file_hash: &str) -> bool {
    let mut stmt =
        match conn.prepare("SELECT 1 FROM synced_media WHERE file_hash_sha256 = ?1 LIMIT 1") {
            Ok(s) => s,
            Err(_) => return false,
        };

    stmt.exists(params![file_hash]).unwrap_or(false)
}

/// Local path of an already-indexed file with this hash, if we have one.
/// Used to re-link a copy instead of writing a byte-identical duplicate.
pub fn find_local_path_by_hash(conn: &Connection, file_hash: &str) -> Option<String> {
    let mut stmt = conn
        .prepare(
            "SELECT local_path FROM synced_media
             WHERE file_hash_sha256 = ?1
             ORDER BY (SELECT 1) LIMIT 1",
        )
        .ok()?;

    stmt.query_row(params![file_hash], |row| row.get::<_, String>(0))
        .ok()
}

pub fn is_remote_path_or_hash_synced(conn: &Connection, device_id: &str, remote_path: &str) -> bool {
    let mut stmt = match conn.prepare(
        "SELECT 1 FROM synced_media WHERE device_id = ?1 AND remote_path = ?2 LIMIT 1",
    ) {
        Ok(s) => s,
        Err(_) => return false,
    };

    stmt.exists(params![device_id, remote_path]).unwrap_or(false)
}

pub fn unsync_media_by_remote_path(
    conn: &Connection,
    device_id: &str,
    remote_path: &str,
) -> Result<usize> {
    conn.execute(
        "DELETE FROM synced_media WHERE device_id = ?1 AND remote_path = ?2",
        params![device_id, remote_path],
    )
}

pub fn record_synced_file(conn: &Connection, item: &NewSyncedMedia) -> Result<i64> {
    conn.execute(
        "INSERT INTO synced_media (
            device_id, remote_object_id, remote_path, local_path, 
            file_size_bytes, file_hash_sha256, media_created_at, is_favorite
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)",
        params![
            item.device_id,
            item.remote_object_id,
            item.remote_path,
            item.local_path,
            item.file_size_bytes,
            item.file_hash_sha256,
            item.media_created_at
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn toggle_favorite(conn: &Connection, media_id: i64) -> Result<bool> {
    conn.execute(
        "UPDATE synced_media SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?1",
        params![media_id],
    )?;

    let mut stmt = conn.prepare("SELECT is_favorite FROM synced_media WHERE id = ?1")?;
    let fav: i32 = stmt.query_row(params![media_id], |row| row.get(0)).unwrap_or(0);
    Ok(fav == 1)
}

pub fn get_recent_synced_media(conn: &Connection, limit: usize) -> Result<Vec<SyncedMediaItem>> {
    get_synced_media(conn, Some(limit), 0, None, false)
}

/// Query the vault index.
///
/// Filters are bound as SQL parameters rather than interpolated into the query
/// string, and `offset` allows the gallery to page through large vaults instead
/// of silently truncating at one page.
pub fn get_synced_media(
    conn: &Connection,
    limit: Option<usize>,
    offset: usize,
    device_id: Option<&str>,
    favorites_only: bool,
) -> Result<Vec<SyncedMediaItem>> {
    let mut query = String::from(
        "SELECT id, device_id, remote_path, local_path, file_size_bytes, file_hash_sha256,
                media_created_at, synced_at, deleted_from_phone, COALESCE(is_favorite, 0)
         FROM synced_media
         WHERE 1=1",
    );

    let device_filter: Option<String> = device_id
        .filter(|d| !d.is_empty())
        .map(|d| d.to_string());

    let mut bindings: Vec<&dyn ToSql> = Vec::new();
    if let Some(device) = device_filter.as_ref() {
        query.push_str(" AND device_id = ?1");
        bindings.push(device);
    }

    if favorites_only {
        query.push_str(" AND is_favorite = 1");
    }

    query.push_str(" ORDER BY id DESC");

    if let Some(l) = limit {
        // usize cannot carry an injection payload.
        query.push_str(&format!(" LIMIT {}", l));
    }
    if offset > 0 {
        query.push_str(&format!(" OFFSET {}", offset));
    }

    let mut stmt = conn.prepare(&query)?;

    let rows = stmt.query_map(rusqlite::params_from_iter(bindings), |row| {
        let deleted_int: i32 = row.get(8)?;
        let fav_int: i32 = row.get(9)?;
        let local_path: String = row.get(3)?;
        let file_exists = Path::new(&local_path).exists();
        Ok(SyncedMediaItem {
            id: row.get(0)?,
            device_id: row.get(1)?,
            remote_path: row.get(2)?,
            local_path,
            file_size_bytes: row.get(4)?,
            file_hash_sha256: row.get(5)?,
            media_created_at: row.get(6)?,
            synced_at: row.get(7)?,
            deleted_from_phone: deleted_int == 1,
            is_favorite: fav_int == 1,
            file_exists,
        })
    })?;

    // Rows that fail to map are skipped rather than aborting the whole query,
    // which keeps one unreadable record from blanking the gallery.
    Ok(rows.flatten().collect())
}

pub fn clear_all_sync_history(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM synced_media", ())?;
    Ok(())
}

pub fn get_storage_stats(conn: &Connection) -> Result<StorageStats> {
    let total_files: i64 = conn
        .query_row("SELECT COUNT(*) FROM synced_media", (), |row| row.get(0))
        .unwrap_or(0);

    let total_bytes: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(file_size_bytes), 0) FROM synced_media",
            (),
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_devices: i64 = conn
        .query_row("SELECT COUNT(*) FROM devices", (), |row| row.get(0))
        .unwrap_or(0);

    let last_sync: Option<String> = conn
        .query_row("SELECT MAX(synced_at) FROM synced_media", (), |row| row.get(0))
        .ok();

    Ok(StorageStats {
        total_files_synced: total_files,
        total_bytes_synced: total_bytes,
        total_devices_connected: total_devices,
        last_sync_timestamp: last_sync,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory_db() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                friendly_name TEXT NOT NULL,
                manufacturer TEXT,
                last_synced_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS synced_media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                remote_object_id TEXT,
                remote_path TEXT,
                local_path TEXT NOT NULL,
                file_size_bytes INTEGER NOT NULL,
                file_hash_sha256 TEXT NOT NULL,
                media_created_at DATETIME,
                synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                deleted_from_phone INTEGER DEFAULT 0,
                is_favorite INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
        )
        .expect("schema");
        conn
    }

    fn sample(device_id: &str, hash: &str, name: &str) -> NewSyncedMedia {
        NewSyncedMedia {
            device_id: device_id.to_string(),
            remote_object_id: None,
            remote_path: Some(format!("/DCIM/Camera/{}", name)),
            local_path: format!("vault/{}", name),
            file_size_bytes: 10,
            file_hash_sha256: hash.to_string(),
            media_created_at: None,
        }
    }

    #[test]
    fn settings_round_trip_and_boolean_helper() {
        let conn = memory_db();
        set_setting(&conn, "skip_duplicates", "true").unwrap();
        assert!(is_setting_enabled(&conn, "skip_duplicates", false));
        set_setting(&conn, "skip_duplicates", "false").unwrap();
        assert!(!is_setting_enabled(&conn, "skip_duplicates", true));
        // unknown keys fall back to the provided default
        assert!(is_setting_enabled(&conn, "nope", true));
        assert!(!is_setting_enabled(&conn, "nope", false));
    }

    #[test]
    fn duplicate_detection_and_lookup_by_hash() {
        let conn = memory_db();
        assert!(!is_file_synced(&conn, "hash_a"));
        record_synced_file(&conn, &sample("dev1", "hash_a", "IMG_1.JPG")).unwrap();
        assert!(is_file_synced(&conn, "hash_a"));
        assert_eq!(
            find_local_path_by_hash(&conn, "hash_a").as_deref(),
            Some("vault/IMG_1.JPG")
        );
        assert!(find_local_path_by_hash(&conn, "missing").is_none());
    }

    #[test]
    fn filters_are_bound_parameters_not_interpolation() {
        let conn = memory_db();
        record_synced_file(&conn, &sample("dev1", "hash_a", "IMG_1.JPG")).unwrap();
        record_synced_file(&conn, &sample("dev2", "hash_b", "IMG_2.JPG")).unwrap();

        // A malicious-looking device id must be treated as a literal value.
        let injected = get_synced_media(&conn, None, 0, Some("dev1' OR '1'='1"), false).unwrap();
        assert!(injected.is_empty(), "query must not be injectable");

        let dev1 = get_synced_media(&conn, None, 0, Some("dev1"), false).unwrap();
        assert_eq!(dev1.len(), 1);
        assert_eq!(dev1[0].device_id, "dev1");
    }

    #[test]
    fn pagination_returns_disjoint_pages() {
        let conn = memory_db();
        for i in 0..10 {
            record_synced_file(&conn, &sample("dev1", &format!("hash_{}", i), "IMG.JPG")).unwrap();
        }

        let first = get_synced_media(&conn, Some(4), 0, None, false).unwrap();
        let second = get_synced_media(&conn, Some(4), 4, None, false).unwrap();
        let third = get_synced_media(&conn, Some(4), 8, None, false).unwrap();

        assert_eq!(first.len(), 4);
        assert_eq!(second.len(), 4);
        assert_eq!(third.len(), 2);

        let mut ids: Vec<i64> = first.iter().chain(second.iter()).chain(third.iter()).map(|m| m.id).collect();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), 10, "pages must not overlap");
    }

    #[test]
    fn favorites_filter_and_toggle() {
        let conn = memory_db();
        let id = record_synced_file(&conn, &sample("dev1", "hash_a", "IMG_1.JPG")).unwrap();
        assert!(get_synced_media(&conn, None, 0, None, true).unwrap().is_empty());

        assert!(toggle_favorite(&conn, id).unwrap());
        assert_eq!(get_synced_media(&conn, None, 0, None, true).unwrap().len(), 1);

        assert!(!toggle_favorite(&conn, id).unwrap());
        assert!(get_synced_media(&conn, None, 0, None, true).unwrap().is_empty());
    }

    #[test]
    fn file_exists_reflects_disk_state() {
        let conn = memory_db();
        record_synced_file(&conn, &sample("dev1", "hash_a", "IMG_1.JPG")).unwrap();
        let items = get_synced_media(&conn, None, 0, None, false).unwrap();
        assert_eq!(items.len(), 1);
        // "vault/IMG_1.JPG" was never written in this test
        assert!(!items[0].file_exists);
    }
}
