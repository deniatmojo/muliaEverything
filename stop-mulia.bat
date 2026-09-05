@echo off
title Mulia Everything - Stopper
echo Menghentikan Backend & Frontend...

REM Hentikan proses node yang mendengarkan port 3001 dan 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 :5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Menghentikan MySQL Server Mulia (shutdown sopan, port 3307)...
"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqladmin.exe" -h 127.0.0.1 -P 3307 -u root -p"MuliaRoot2026!" shutdown 2>nul

echo.
echo Semua server sudah dihentikan.
pause
