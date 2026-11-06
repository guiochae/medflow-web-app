@echo off
setlocal
title Lugamed - WhatsApp Bridge (Consola de Diagnostico)
cd /d "%~dp0"
if exist "%~dp0node\node.exe" (
    set "PATH=%~dp0node;%PATH%"
)
echo ========================================================
echo    LUGAMED - Microservicio WhatsApp Bridge (Diagnostico)
echo ========================================================
echo.
echo Cerrando instancias previas en puerto 3001 si existen...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr /I "LISTENING ESCUCHANDO"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo Iniciando servidor en modo interactivo con salida en pantalla...
echo.
node server.js
pause
