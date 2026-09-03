@echo off
title Mulia Everything - Stopper
echo Menghentikan Backend & Frontend...

REM Hentikan proses node yang mendengarkan port 3001 dan 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 :5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Menghentikan MySQL Server (shutdown sopan)...
"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqladmin.exe" -u root -p"MuliaRoot2026!" shutdown 2>nul

echo.
echo Semua server sudah dihentikan.
pause
