@echo off
setlocal enabledelayedexpansion
title Instalador de Auto-Inicio - WhatsApp Bridge Lugamed

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ========================================================
echo   Configurando Auto-Inicio de WhatsApp Bridge Lugamed
echo ========================================================
echo.

:: 1. Copiar script silencioso a la carpeta Inicio de Windows (Startup)
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_DIR%" (
    echo [1/3] Configurando auto-inicio en Windows Startup...
    copy /Y "%SCRIPT_DIR%start-bridge-silent.vbs" "%STARTUP_DIR%\Lugamed-WhatsApp-Bridge.vbs" >nul
    echo       [OK] Copiado a %STARTUP_DIR%\Lugamed-WhatsApp-Bridge.vbs
) else (
    echo [ALERTA] No se encontro la carpeta de Inicio de Windows.
)

:: 2. Registrar protocolo personalizado lugamed-bridge:// en el Registro de Windows (HKCU)
echo.
echo [2/3] Registrando protocolo en el sistema (lugamed-bridge://)...
reg add "HKCU\Software\Classes\lugamed-bridge" /ve /d "URL:Lugamed Bridge Protocol" /f >nul
reg add "HKCU\Software\Classes\lugamed-bridge" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\lugamed-bridge\shell\open\command" /ve /d "wscript.exe \"%SCRIPT_DIR%start-bridge-silent.vbs\" \"%%1\"" /f >nul
echo       [OK] Protocolo registrado exitosamente en HKCU\Software\Classes\lugamed-bridge

:: 3. Crear acceso directo en el Escritorio del usuario
echo.
echo [3/3] Creando acceso directo en el Escritorio...
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "SHORTCUT_VBS=%TEMP%\create_shortcut.vbs"
(
    echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
    echo sLinkFile = "%DESKTOP_DIR%\Iniciar WhatsApp Bridge.lnk"
    echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
    echo oLink.TargetPath = "wscript.exe"
    echo oLink.Arguments = """%SCRIPT_DIR%start-bridge-silent.vbs"""
    echo oLink.WorkingDirectory = "%SCRIPT_DIR%"
    echo oLink.Description = "Iniciar Microservicio de WhatsApp Bridge para Medflow"
    echo oLink.Save
) > "%SHORTCUT_VBS%"
cscript //nologo "%SHORTCUT_VBS%" >nul 2>&1
del "%SHORTCUT_VBS%" >nul 2>&1
echo       [OK] Acceso directo creado en el Escritorio.

echo.
echo ========================================================
echo   Configuracion completada exitosamente!
echo   El puente se iniciara automaticamente cada vez que se
echo   encienda la computadora o se inicie sesion.
echo ========================================================
echo.
