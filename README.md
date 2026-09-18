<div align="center">

# ⚓ SnapHarbor (v1.0.0)

**A high-performance, local-first photo & video media vault for Windows with smart SHA-256 deduplication, timeline gallery, automation rules, and modern glassmorphism aesthetics.**

[![Release](https://img.shields.io/badge/Release-v1.0.0-emerald?logo=github)](https://github.com/DR-WRITES-ALOT/SnapHarbor/releases)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-v19-61dafb?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-2021-DEA584?logo=rust)](https://www.rust-lang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/Database-SQLite3-003B57?logo=sqlite)](https://sqlite.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## ✨ Features

- **⚡ 1-Click Media Synchronization**: Detects cameras, SD cards, USB readers and phones that mount as a drive letter, then backs up their photos and videos to local storage.
- **🎯 Selective File Sync & Protection**: Choose individual photos or select in bulk. Backed-up items are protected against accidental duplicate transfers.
- **🔄 Individual Unsync**: Reset sync records for individual files on the Home Dashboard with a 1-click reset button.
- **🖼️ Vault Photo & Video Gallery**: Browse your backed-up library with real thumbnails read straight off disk, organized by monthly timeline headers. Filter by Favorites ⭐ / Photos / Videos / Devices, toggle grid densities, play videos inline, and page through large vaults.
- **🛡️ Smart SHA-256 Deduplication**: Files are indexed in a local SQLite database (`autosync.db`). Duplicate photos are recognized instantly and never copied twice.
- **⚙️ Automation & Rules Suite**:
  - **Auto-Sync on Plug-In**: Automatically initiates backup the moment a phone or SD card is inserted.
  - **Interval Scheduler**: Background periodic checks (`Every 15m`, `30m`, `1h`, `2h`).
  - **Battery Protection Guard**: Automatically pauses auto-sync if device battery is below safety threshold (e.g. `< 20%`).
  - **Harmonic Audio Chimes**: Web Audio API synthesizer for pleasant harmonic completion chimes.
- **📂 Customizable Vault Hierarchy**: Organize backups automatically into configurable folder formats (`YYYY/MM`, `YYYY-MM-DD`, `Device/YYYY-MM`) with a real-time directory tree preview.
- **🔍 Full-Screen Inspection Lightbox**: Click any media thumbnail for a full-resolution preview (photos) or inline playback (videos), zoom 50–300%, check capture timestamp, size and source path, and navigate with the keyboard.
- **📊 Storage & Sync History**: Vault totals, deduplication status, configured destination, and a reverse-chronological log of every indexed transfer.
- **🔔 Windows System Tray & Native Toast Notifications**: Minimizes quietly to the Windows system tray on close (`X`) so background transfers continue uninterrupted. Receives Windows OS toast alerts when sync completes.
- **🎮 Demo / Simulation Mode**: An opt-in switcher (Settings → Demo Mode) that adds clearly labelled fake devices so the UI can be explored without hardware. Demo runs are simulated end-to-end — no files are written and nothing is added to the vault index.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Desktop Core** | [Tauri 2](https://tauri.app), [Rust](https://www.rust-lang.org/) (2021 Edition) |
| **Frontend Framework** | [React 19](https://react.dev), [TypeScript 5.8](https://www.typescriptlang.org/) |
| **Styling & Design** | [Tailwind CSS v4](https://tailwindcss.com), Custom Glassmorphism UI |
| **Animations** | [Framer Motion 13](https://www.framer.com/motion/) |
| **Database & Cache** | [SQLite](https://www.sqlite.org/) via [`rusqlite`](https://crates.io/crates/rusqlite) (WAL Mode) |
| **Audio Synthesizer** | Web Audio API Oscillator & Gain Envelope |
| **Icons & Media** | [Lucide Icons](https://lucide.dev) |
| **Build & Bundling** | [Vite 7](https://vite.dev) |

---

## 📈 Feature Status

| Component | Status | Notes |
| :--- | :---: | :--- |
| **UI & Layout Design** | ✅ Working | Dark glassmorphism, responsive dashboard, tabs, modals |
| **Photo Selection & Lightbox** | ✅ Working | Multi-select, real full-resolution previews, video playback, keyboard shortcuts |
| **Vault Gallery View** | ✅ Working | Timeline clustering, favorites, density switcher, paged loading |
| **SQLite Deduplication Engine** | ✅ Working | SHA-256 index in `autosync.db`, dedup, re-link on re-sync, unsync |
| **Automation & Rules Engine** | ✅ Working | Plug-in auto-trigger, interval scheduler, battery guard |
| **Media Preview Pipeline** | ✅ Working | Real thumbnails and playback via the Tauri asset protocol, scoped at runtime |
| **Background Sync & Cancellation** | ✅ Working | Streaming copy with progress, cancel support, atomic `.part` → rename writes |
| **System Tray & OS Alerts** | ✅ Working | Tray menu, minimize-to-tray, native notifications |
| **Audio Synthesizer** | ✅ Working | Web Audio harmonic feedback chimes |
| **Native Packaging & CI/CD** | ✅ Working | Tag-triggered GitHub release produces `.exe` / `.msi` |
| **MTP / PTP device support** | ❌ Not implemented | Phones and cameras that expose no drive letter are not discovered yet — see the roadmap below |
| **Removable-media delete-after-sync** | ❌ Not implemented | The old setting was dead config and has been removed rather than pretending to work |

---

## 🗺️ Roadmap / Known Limitations

- **MTP & PTP devices.** Discovery currently walks drive letters (`D:`–`Z:`), which covers SD cards, USB readers and cameras in mass-storage mode. Android phones and iOS devices speaking only MTP need the Windows Portable Devices API — the hook point is documented at the top of `src-tauri/src/wpd.rs`.
- **Thumbnails for video.** Video tiles show a play badge and an inline player rather than a decoded first frame, which would need a decoder (e.g. ffmpeg) bundled.
- **Delete-after-sync** is deliberately not implemented: deleting originals from removable media is destructive and there is no undo, so it should land only with a confirmation flow and verification.
- **Hashing speed.** Every byte is hashed before a file is copied (single pass, one thread). Large cards are I/O bound on the source; a size/partial-hash pre-filter would cut this further.

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run the frontend development server with hot reload
npm run dev

# 3. Compile the production bundle
npm run build
```

---

## 📦 Building the Native Windows Desktop App (`.exe` / `.msi`)

### Option A: 1-Click Batch Build (Local)
1. Run `install-build-tools.bat` to install the MSVC C++ Build Tools (if not already installed).
2. Run `build-desktop-app.bat` to build the standalone installer.

### Option B: Automated GitHub Releases (CI/CD)
Push a git tag to automatically trigger GitHub Actions:
```bash
git tag v1.0.0
git push origin v1.0.0
```
The GitHub Actions workflow will compile the release on a Windows runner and attach `.exe` and `.msi` setup installers directly to your repository's Releases tab!

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
