use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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

    // Optimize SQLite
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;",
    )?;

    // Create the devices table
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

    // Create the synced_media table
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
    let _ = conn.execute("ALTER TABLE synced_media ADD COLUMN is_favorite INTEGER DEFAULT 0", ());

    // Create indexes for fast lookup
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

    // Create app_settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        (),
    )?;

    // Seed default settings if not existing
    seed_default_settings(&conn)?;

    Ok(conn)
}

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
        ("delete_after_sync", "false"),
        ("skip_duplicates", "true"),
        ("include_videos", "true"),
        ("enable_notifications", "true"),
        ("minimize_to_tray", "true"),
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
    let mut stmt = match conn.prepare("SELECT 1 FROM synced_media WHERE file_hash_sha256 = ?1 LIMIT 1") {
        Ok(s) => s,
        Err(_) => return false,
    };

    stmt.exists(params![file_hash]).unwrap_or(false)
}

pub fn is_remote_path_or_hash_synced(conn: &Connection, device_id: &str, remote_path: &str) -> bool {
    let mut stmt = match conn.prepare("SELECT 1 FROM synced_media WHERE device_id = ?1 AND remote_path = ?2 LIMIT 1") {
        Ok(s) => s,
        Err(_) => return false,
    };

    stmt.exists(params![device_id, remote_path]).unwrap_or(false)
}

pub fn unsync_media_by_remote_path(conn: &Connection, device_id: &str, remote_path: &str) -> Result<usize> {
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
    get_synced_media(conn, Some(limit), None, false)
}

pub fn get_synced_media(
    conn: &Connection,
    limit: Option<usize>,
    device_id: Option<&str>,
    favorites_only: bool,
) -> Result<Vec<SyncedMediaItem>> {
    let mut query = String::from(
        "SELECT id, device_id, remote_path, local_path, file_size_bytes, file_hash_sha256, media_created_at, synced_at, deleted_from_phone, COALESCE(is_favorite, 0)
         FROM synced_media
         WHERE 1=1 "
    );

    if let Some(dev) = device_id {
        if !dev.is_empty() {
            query.push_str(&format!(" AND device_id = '{}' ", dev.replace('\'', "''")));
        }
    }

    if favorites_only {
        query.push_str(" AND is_favorite = 1 ");
    }

    query.push_str(" ORDER BY id DESC ");

    if let Some(l) = limit {
        query.push_str(&format!(" LIMIT {} ", l));
    }

    let mut stmt = conn.prepare(&query)?;

    let rows = stmt.query_map([], |row| {
        let deleted_int: i32 = row.get(8)?;
        let fav_int: i32 = row.get(9)?;
        Ok(SyncedMediaItem {
            id: row.get(0)?,
            device_id: row.get(1)?,
            remote_path: row.get(2)?,
            local_path: row.get(3)?,
            file_size_bytes: row.get(4)?,
            file_hash_sha256: row.get(5)?,
            media_created_at: row.get(6)?,
            synced_at: row.get(7)?,
            deleted_from_phone: deleted_int == 1,
            is_favorite: fav_int == 1,
        })
    })?;

    let mut result = Vec::new();
    for item in rows {
        if let Ok(m) = item {
            result.push(m);
        }
    }
    Ok(result)
}

pub fn clear_all_sync_history(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM synced_media", ())?;
    Ok(())
}

pub fn get_storage_stats(conn: &Connection) -> Result<StorageStats> {
    let total_files: i64 = conn.query_row(
        "SELECT COUNT(*) FROM synced_media",
        (),
        |row| row.get(0),
    ).unwrap_or(0);

    let total_bytes: i64 = conn.query_row(
        "SELECT COALESCE(SUM(file_size_bytes), 0) FROM synced_media",
        (),
        |row| row.get(0),
    ).unwrap_or(0);

    let total_devices: i64 = conn.query_row(
        "SELECT COUNT(*) FROM devices",
        (),
        |row| row.get(0),
    ).unwrap_or(0);

    let last_sync: Option<String> = conn.query_row(
        "SELECT MAX(synced_at) FROM synced_media",
        (),
        |row| row.get(0),
    ).ok();

    Ok(StorageStats {
        total_files_synced: total_files,
        total_bytes_synced: total_bytes,
        total_devices_connected: total_devices,
        last_sync_timestamp: last_sync,
    })
}
