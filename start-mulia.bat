@echo off
title Mulia Everything - Starter
echo ============================================
echo   MENYALAKAN PROJECT MULIA EVERYTHING
echo ============================================
echo.

REM ---------- 1. MySQL Server ----------
netstat -ano | findstr ":3306" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [1/3] Menyalakan MySQL Server...
    start "MySQL Server" /min "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file=D:/mysql-conf/my.ini --console
    echo       Menunggu MySQL siap...
    timeout /t 10 /nobreak >nul
) else (
    echo [1/3] MySQL sudah berjalan.
)

REM ---------- 2. Backend API ----------
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [2/3] Menyalakan Backend API...
    start "Backend API (port 3001)" /D "D:\Aira Dynamics Zone\mulia.airadynamics\backend" cmd /k npm run dev
    timeout /t 5 /nobreak >nul
) else (
    echo [2/3] Backend sudah berjalan.
)

REM ---------- 3. Frontend ----------
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [3/3] Menyalakan Frontend...
    start "Frontend (port 5173)" /D "D:\Aira Dynamics Zone\mulia.airadynamics\frontend" cmd /k npm run dev
    timeout /t 5 /nobreak >nul
) else (
    echo [3/3] Frontend sudah berjalan.
)

echo.
echo ============================================
echo   Selesai! Buka browser ke:
echo   http://localhost:5173
echo   (API backend: http://localhost:3001)
echo ============================================
echo.
echo Jendela ini bisa ditutup. Server tetap jalan
echo di jendela "MySQL Server", "Backend API",
echo dan "Frontend" yang baru terbuka.
pause
