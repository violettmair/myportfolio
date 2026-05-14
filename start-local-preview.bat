@echo off
cd /d "%~dp0"
echo Starting local portfolio preview...
echo.
echo This version uses Windows PowerShell, so Python is NOT required.
echo.
echo Open this address in your browser if it does not open automatically:
echo http://localhost:8000
echo.
echo Press Ctrl+C in this window when you are done.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-preview-server.ps1" -Port 8000
pause
