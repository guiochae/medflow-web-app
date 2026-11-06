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

netstat -ano | findstr /R /C:":3001 .*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    exit /b 0
)

echo [INFO] Iniciando microservicio WhatsApp en segundo plano...
node server.js 1>> "%SCRIPT_DIR%out.log" 2>> "%SCRIPT_DIR%err.log"
