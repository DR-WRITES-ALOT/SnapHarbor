@echo off
echo ==========================================================
echo   Installing Visual Studio C++ Build Tools for SnapHarbor
echo ==========================================================
echo.
echo This will install the MSVC C++ Linker (link.exe) and Windows SDK
echo required by Tauri to compile native .exe Windows applications.
echo.
echo Please click 'Yes' on the Windows Administrator (UAC) prompt if requested.
echo.
start "" "%~dp0vs_BuildTools.exe" --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive
echo.
echo Installer has launched in the background.
echo Once the installation completes, run build-desktop-app.bat to create the .exe!
pause
