<div align="center">

# ⚓ SnapHarbor

**A high-performance, local-first photo & video backup tool for Windows with smart SHA-256 deduplication and modern glassmorphism aesthetics.**

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
- **🎯 Selective File Sync**: Choose individual photos or select in bulk with custom search & filter options (Photos vs Videos).
- **🛡️ Smart SHA-256 Deduplication**: Files are indexed in a local SQLite database (`autosync.db`). Duplicate photos are recognized instantly and never copied twice.
- **📂 Customizable Vault Hierarchy**: Organize backups automatically into configurable folder formats (`YYYY/MM`, `YYYY-MM-DD`, `Device/YYYY-MM`) with a real-time directory tree preview.
- **🔍 Full-Screen Inspection Lightbox**: Click any media thumbnail to view high-resolution previews, zoom in/out (50% to 300%), inspect EXIF capture timestamps and file size, and navigate via keyboard arrows.
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
| **Icons & Media** | [Lucide Icons](https://lucide.dev) |
| **Build & Bundling** | [Vite 7](https://vite.dev) |

---

## 📈 Project Progress (~85% Complete)

| Component | Status | Progress | Notes |
| :--- | :---: | :---: | :--- |
| **UI & Layout Design** | ✅ Complete | 100% | Dark glassmorphism, responsive dashboard, tabs, modals |
| **Photo Selection & Lightbox** | ✅ Complete | 100% | Multi-select, full-screen zoom, keyboard shortcuts |
| **Device & Drive Scanner** | ✅ Complete | 90% | Multi-device switcher, DCIM volume & WPD discovery |
| **SQLite Deduplication Engine** | ✅ Complete | 100% | SHA-256 hash checking, `autosync.db` CRUD |
| **Background Sync & Streaming** | ✅ Complete | 90% | Real-time progress broadcasting, selective copying |
| **System Tray & OS Alerts** | ✅ Complete | 100% | Tray context menu, minimize-to-tray, toast alerts |
| **Vault Hierarchy Visualizer** | ✅ Complete | 100% | Dynamic ASCII folder tree preview |
| **Native Packaging & CI/CD** | 🟡 Ready | 80% | Build scripts & GitHub Actions workflow configured |
| **Cloud Mirroring / NAS Sync** | ⏳ Planned | 0% | Phase 3 Roadmap |

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- [Rust & Cargo](https://www.rust-lang.org/tools/install)

### 1. Clone the Repository
```bash
git clone https://github.com/DR-WRITES-ALOT/SnapHarbor.git
cd SnapHarbor
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Frontend Development Server
```bash
npm run dev
```
Open **[http://localhost:1420/](http://localhost:1420/)** in your browser to interactively test all views, selections, and animations.

---

## 📦 Building the Native Windows Executable (`.exe`)

To compile the standalone Windows binary and installer locally:

1. **Install C++ Build Tools (if not already installed):**
   Double-click `install-build-tools.bat` (or run it from terminal) and accept the Windows UAC prompt.
2. **Build the Desktop Application:**
   Double-click `build-desktop-app.bat` (or run `npm run build && npx @tauri-apps/cli build`).
3. The generated release binary and installer will be located in:
   ```
   src-tauri/target/release/
   ```

---

## 🌐 How to Publish Releases on GitHub

SnapHarbor includes an automated **GitHub Actions CI/CD release workflow** ([`.github/workflows/release.yml`](.github/workflows/release.yml)).

### Method 1: Automated Release via Git Tag (Recommended)

1. Commit and push your changes to GitHub:
   ```bash
   git add .
   git commit -m "Prepare v0.1.0 release"
   git push origin improve
   ```
2. Create and push a version tag (e.g. `v0.1.0`):
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. GitHub Actions will automatically:
   - Spin up a clean Windows build runner
   - Compile the Rust backend and React frontend
   - Package `SnapHarbor.exe` and the `.msi` Windows installer
   - Publish a new public release on your repository's **Releases** page with downloadable assets!

### Method 2: Manual Release Upload

1. Run `build-desktop-app.bat` locally.
2. Go to your GitHub repository -> Click **Releases** -> **Draft a new release**.
3. Set your tag name (e.g. `v0.1.0`), title, and description.
4. Drag and drop the `.exe` or `.msi` file from `src-tauri/target/release/bundle/msi/` or `src-tauri/target/release/` into the upload box.
5. Click **Publish release**.

---

## 🗺️ Roadmap

- [x] Phase 1: Interactive Dark Glassmorphism UI & Dashboard
- [x] Phase 2: Rust Sync Engine, SQLite Deduplication, and System Tray Integration
- [x] Phase 2.5: Selective File Syncing, Lightbox Inspection Modal & Live Vault Tree Preview
- [ ] Phase 3: Automatic Wireless Sync over Local Wi-Fi (companion mobile receiver)
- [ ] Phase 4: Cloud Mirroring (Optional secondary sync to Google Drive, OneDrive, or local NAS)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
