use serde::{Deserialize, Serialize};
use std::path::Path;

/// Windows drive type codes (winbase.h).
const DRIVE_REMOVABLE: u32 = 2;
const DRIVE_FIXED: u32 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeviceKind {
    /// Removable media: SD cards, USB sticks, card readers.
    Removable,
    /// Drive that carries a DCIM layout, i.e. a camera or a phone exposing
    /// mass storage.
    Camera,
    /// Fixed (internal) volume that happens to hold a media folder.
    Internal,
    /// Built-in demo device. Never backed by real hardware.
    Simulated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub manufacturer: Option<String>,
    pub mount_path: Option<String>,
    pub is_wpd: bool,
    pub is_connected: bool,
    pub total_space_bytes: Option<u64>,
    pub free_space_bytes: Option<u64>,
    pub battery_level: Option<u32>,
    /// True for demo devices so the UI can label them honestly.
    pub is_simulated: bool,
    pub kind: DeviceKind,
}

/// Device discovery.
///
/// ## Scope, honestly
///
/// This manager enumerates **drive letters with media folders on them** — that
/// covers SD cards, USB card readers, action cameras and phones that expose
/// mass storage. Cameras in PTP mode, and Android/iOS devices that only speak
/// MTP, get no drive letter and are therefore **not** discovered yet: MTP needs
/// the Windows Portable Devices API (`IPortableDeviceManager`), which is not
/// implemented in this codebase. `is_wpd` is always `false` and
/// `remote_object_id` is never populated in the database.
///
/// Adding MTP means: re-adding the `windows` crate with the
/// `Win32_Devices_PortableDevices` feature here, enumerating devices, and
/// streaming each object to `sync_engine::place_file` instead of copying from a
/// mounted path.
pub struct WpdManager {}

impl WpdManager {
    pub fn new() -> Result<Self, String> {
        Ok(Self {})
    }

    /// Enumerate candidate devices.
    ///
    /// When `simulation_enabled` is true a single clearly-labelled demo device
    /// is appended. Nothing is ever fabricated when simulation is off — an empty
    /// list is a truthful answer and the UI now says so.
    pub fn get_connected_devices(&self, simulation_enabled: bool) -> Vec<DeviceInfo> {
        let mut devices = self.scan_drive_letters();

        if simulation_enabled {
            devices.push(simulated_device());
        }

        devices
    }

    fn scan_drive_letters(&self) -> Vec<DeviceInfo> {
        let mut devices = Vec::new();

        for drive_char in b'D'..=b'Z' {
            let letter = drive_char as char;
            let root_str = format!("{}:\\", letter);
            let root_path = Path::new(&root_str);

            if !root_path.exists() {
                continue;
            }

            let dcim_path = root_path.join("DCIM");
            let pictures_path = root_path.join("Pictures");
            let has_dcim = dcim_path.exists();
            let has_pictures = pictures_path.exists();
            let drive_type = drive_type_of(&root_str);

            // A fixed volume only interests us if the user actually keeps media
            // at its root; otherwise every internal partition would show up as a
            // "device". Removable media is always listed.
            let is_removable = drive_type == Some(DRIVE_REMOVABLE);
            if !is_removable && !has_dcim && !has_pictures {
                continue;
            }

            let (kind, label) = if has_dcim {
                (DeviceKind::Camera, "Camera Storage")
            } else if is_removable {
                (DeviceKind::Removable, "Removable Drive")
            } else if drive_type == Some(DRIVE_FIXED) {
                (DeviceKind::Internal, "Media Drive")
            } else {
                (DeviceKind::Removable, "Removable Drive")
            };

            let (total_space, free_space) = free_space_of(&root_str);

            devices.push(DeviceInfo {
                id: format!("drive_{}", letter),
                name: format!("{} ({}:)", label, letter),
                manufacturer: if has_dcim {
                    Some("Portable Device".into())
                } else {
                    Some("External Storage".into())
                },
                mount_path: Some(root_str),
                is_wpd: false,
                is_connected: true,
                total_space_bytes: total_space,
                free_space_bytes: free_space,
                battery_level: None,
                is_simulated: false,
                kind,
            });
        }

        devices
    }
}

/// The demo device used when simulation mode is switched on explicitly.
fn simulated_device() -> DeviceInfo {
    DeviceInfo {
        id: "simulated_galaxy_s23".to_string(),
        name: "Samsung Galaxy S23 (demo)".to_string(),
        manufacturer: Some("Samsung Electronics".to_string()),
        mount_path: None,
        is_wpd: false,
        is_connected: true,
        total_space_bytes: Some(128_000_000_000),
        free_space_bytes: Some(42_500_000_000),
        battery_level: Some(84),
        is_simulated: true,
        kind: DeviceKind::Simulated,
    }
}

#[cfg(windows)]
fn drive_type_of(root: &str) -> Option<u32> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    let wide: Vec<u16> = OsStr::new(root)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        extern "system" {
            fn GetDriveTypeW(lpRootPathName: *const u16) -> u32;
        }
        Some(GetDriveTypeW(wide.as_ptr()))
    }
}

#[cfg(not(windows))]
fn drive_type_of(_root: &str) -> Option<u32> {
    None
}

#[cfg(windows)]
fn free_space_of(root: &str) -> (Option<u64>, Option<u64>) {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    let wide: Vec<u16> = OsStr::new(root)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut free_to_caller = 0u64;
    let mut total_bytes = 0u64;
    let mut total_free = 0u64;

    unsafe {
        extern "system" {
            fn GetDiskFreeSpaceExW(
                lpDirectoryName: *const u16,
                lpFreeBytesAvailableToCaller: *mut u64,
                lpTotalNumberOfBytes: *mut u64,
                lpTotalNumberOfFreeBytes: *mut u64,
            ) -> i32;
        }

        if GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_to_caller,
            &mut total_bytes,
            &mut total_free,
        ) != 0
        {
            return (Some(total_bytes), Some(free_to_caller));
        }
    }

    (None, None)
}

#[cfg(not(windows))]
fn free_space_of(_root: &str) -> (Option<u64>, Option<u64>) {
    (None, None)
}
