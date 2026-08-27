<div align="center">

# ⚓ SnapHarbor (v1.0.0)

**A high-performance, local-first photo & video media vault for Windows with smart SHA-256 deduplication, timeline gallery, automation rules, and modern glassmorphism aesthetics.**

[![Release](https://img.shields.io/badge/Release-v1.0.0-emerald?logo=github)](https://github.com)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app)
[![React 19](https://img.shields.io/badge/React-v19-61dafb?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-2021-DEA584?logo=rust)](https://www.rust-lang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/Database-SQLite3-003B57?logo=sqlite)](https://sqlite.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## ✨ Features

- **⚡ 1-Click Media Synchronization**: Seamlessly detect mobile devices (Android MTP, iOS), cameras, and SD cards / removable drives to back up photos and videos to local storage.
- **🎯 Selective File Sync & Protection**: Choose individual photos or select in bulk. Backed-up items are protected against accidental duplicate transfers.
- **🔄 Individual Unsync**: Reset sync records for individual files on the Home Dashboard with a 1-click reset button.
- **🖼️ Vault Photo & Video Gallery**: Browse your backed-up library organized by monthly timeline headers, filter by Favorites ⭐ / Photos / Videos / Devices, and toggle grid densities.
- **🛡️ Smart SHA-256 Deduplication**: Files are indexed in a local SQLite database (`autosync.db`). Duplicate photos are recognized instantly and never copied twice.
- **⚙️ Automation & Rules Suite**:
  - **Auto-Sync on Plug-In**: Automatically initiates backup the moment a phone or SD card is inserted.
  - **Interval Scheduler**: Background periodic checks (`Every 15m`, `30m`, `1h`, `2h`).
  - **Battery Protection Guard**: Automatically pauses auto-sync if device battery is below safety threshold (e.g. `< 20%`).
  - **Harmonic Audio Chimes**: Web Audio API synthesizer for pleasant harmonic completion chimes.
- **📂 Customizable Vault Hierarchy**: Organize backups automatically into configurable folder formats (`YYYY/MM`, `YYYY-MM-DD`, `Device/YYYY-MM`) with a real-time directory tree preview.
- **🔍 Full-Screen Inspection Lightbox**: Click any media thumbnail to view high-resolution previews, zoom in/out (50% to 300%), inspect EXIF capture timestamps and file size, and navigate via keyboard shortcuts.
- **📊 Storage Distribution Breakdown**: Visual analytics bar charting space consumed by Photos vs Videos vs Free Disk Space, along with a searchable sync history log.
- **🔔 Windows System Tray & Native Toast Notifications**: Minimizes quietly to the Windows system tray on close (`X`) so background transfers continue uninterrupted. Receives Windows OS toast alerts when sync completes.
- **🎮 Multi-Device Simulation Switcher**: Built-in hardware switcher to simulate and test various mobile phones, action cameras, and SD card drives in development.

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

## 📈 Feature Checklist (v1.0.0 Complete)

| Component | Status | Progress | Notes |
| :--- | :---: | :---: | :--- |
| **UI & Layout Design** | ✅ Complete | 100% | Dark glassmorphism, responsive dashboard, tabs, modals |
| **Photo Selection & Lightbox** | ✅ Complete | 100% | Multi-select, full-screen zoom, keyboard shortcuts |
| **Vault Gallery View** | ✅ Complete | 100% | Timeline clustering, favorites manager, density switcher |
| **Automation & Rules Engine** | ✅ Complete | 100% | Plug-in auto-trigger, interval scheduler, battery guard |
| **SQLite Deduplication Engine** | ✅ Complete | 100% | SHA-256 hash checking, `autosync.db` CRUD, unsync action |
| **Audio Synthesizer** | ✅ Complete | 100% | Web Audio harmonic major triad feedback chimes |
| **Background Sync & Streaming** | ✅ Complete | 100% | Real-time progress broadcasting, selective copying |
| **System Tray & OS Alerts** | ✅ Complete | 100% | Tray context menu, minimize-to-tray, toast alerts |
| **Vault Hierarchy Visualizer** | ✅ Complete | 100% | Dynamic ASCII folder tree preview |
| **Native Packaging & CI/CD** | ✅ Complete | 100% | Automated GitHub Actions `.exe` & `.msi` release workflow |

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
