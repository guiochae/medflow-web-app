@echo off
setlocal enabledelayedexpansion
title Lugamed - WhatsApp Bridge

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

if exist "%SCRIPT_DIR%node\node.exe" (
    set "PATH=%SCRIPT_DIR%node;%PATH%"
)

echo ========================================================
echo    LUGAMED - Microservicio WhatsApp Bridge
echo ========================================================
echo.

:: 1. Si el servidor ya responde en http://127.0.0.1:3001, salir limpiamente sin abrir duplicados
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/ping' -TimeoutSec 1 -ErrorAction Stop; if ($r.ok -or $r.online -or $r.success) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] El microservicio ya esta activo y respondiendo en el puerto 3001.
    exit /b 0
)

:: 2. Auto-actualizar silenciosamente server.js si hay conexion a Internet
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://gestion-consultorio-gules.vercel.app/bridge/server.js', '%SCRIPT_DIR%server.js') } catch {}" >nul 2>&1

:: 3. Iniciar el microservicio con Node.js
echo [INFO] Iniciando microservicio WhatsApp en segundo plano...
node server.js 1>> "%SCRIPT_DIR%out.log" 2>> "%SCRIPT_DIR%err.log"
