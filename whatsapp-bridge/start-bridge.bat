@echo off
setlocal enabledelayedexpansion
title Lugamed - WhatsApp Bridge

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ========================================================
echo    LUGAMED - Microservicio WhatsApp Bridge
echo ========================================================
echo.

netstat -ano | findstr /R /C:":3001 .*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] El puente de WhatsApp ya esta activo y escuchando en el puerto 3001.
    timeout /t 3 >nul
    exit /b 0
)

echo [INFO] Iniciando microservicio WhatsApp en segundo plano...
echo [INFO] Directorio: %SCRIPT_DIR%
echo.

node server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] El microservicio se detuvo con codigo %errorlevel%.
    pause
)
