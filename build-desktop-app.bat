@echo off
echo ==========================================================
echo   Building SnapHarbor Native Windows Desktop Application
echo ==========================================================
echo.
echo 1. Building Frontend Bundle...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Compiling Rust Backend & Packaging Windows Installer...
call npx @tauri-apps/cli build
if %errorlevel% neq 0 (
    echo [ERROR] Native Tauri compilation failed.
    echo Make sure Visual Studio C++ Build Tools are installed.
    echo (You can run install-build-tools.bat to install them)
    pause
    exit /b %errorlevel%
)

echo.
echo ==========================================================
echo   [SUCCESS] SnapHarbor .exe Built Successfully!
echo   Location: src-tauri\target\release\
echo ==========================================================
pause
