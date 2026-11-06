@echo off
setlocal enabledelayedexpansion
title Instalador de WhatsApp Bridge - LUGAMED

chcp 65001 >nul 2>&1
color 0b

echo ================================================================
echo        INSTALADOR AUTOMATICO - PUENTE DE WHATSAPP LUGAMED
echo ================================================================
echo.
echo Este asistente configurara el puente automatico de WhatsApp
echo en esta computadora para la recepcion de la clinica.
echo.
echo Presiona cualquier tecla para comenzar o espera 5 segundos...
timeout /t 5 >nul

set "TARGET_DIR=%USERPROFILE%\LugamedWhatsAppBridge"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
cd /d "%TARGET_DIR%"

echo.
echo [1/5] Verificando entorno de ejecucion (Node.js)...

set "HAS_NODE=0"
where node >nul 2>&1
if %errorlevel% equ 0 (
    set "HAS_NODE=1"
    echo       [OK] Node.js detectado en el sistema.
) else if exist "%TARGET_DIR%\node\node.exe" (
    set "HAS_NODE=1"
    set "PATH=%TARGET_DIR%\node;%PATH%"
    echo       [OK] Node.js portatil detectado en %TARGET_DIR%\node
)

if "!HAS_NODE!"=="0" (
    echo       [INFO] Node.js no encontrado. Descargando componentes portatiles...
    echo       Descargando Node.js LTS oficial (esto solo se realiza la primera vez)...
    curl.exe -fSL -# -o "%TEMP%\node-portable.zip" "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"
    if %errorlevel% neq 0 (
        echo       [ERROR] No se pudo descargar Node.js. Por favor verifica la conexion a Internet.
        echo.
        pause
        exit /b 1
    )
    echo       [INFO] Descomprimiendo componentes en %TARGET_DIR%\node...
    tar.exe -xf "%TEMP%\node-portable.zip" -C "%TARGET_DIR%"
    if exist "%TARGET_DIR%\node-v20.18.0-win-x64" (
        move /y "%TARGET_DIR%\node-v20.18.0-win-x64" "%TARGET_DIR%\node" >nul 2>&1
    )
    del "%TEMP%\node-portable.zip" >nul 2>&1
    set "PATH=%TARGET_DIR%\node;%PATH%"
    echo       [OK] Node.js portatil configurado exitosamente.
)

echo.
echo [2/5] Descargando componentes actualizados del puente...
set "BASE_URL=https://gestion-consultorio-gules.vercel.app/bridge"

curl.exe -fsSL "%BASE_URL%/server.js" -o "%TARGET_DIR%\server.js"
curl.exe -fsSL "%BASE_URL%/package.json" -o "%TARGET_DIR%\package.json"
curl.exe -fsSL "%BASE_URL%/start-bridge.bat" -o "%TARGET_DIR%\start-bridge.bat"
curl.exe -fsSL "%BASE_URL%/start-bridge-silent.vbs" -o "%TARGET_DIR%\start-bridge-silent.vbs"

if not exist "%TARGET_DIR%\server.js" (
    echo [ERROR] No se pudieron descargar los archivos del puente. Verifica tu conexion a Internet.
    echo.
    pause
    exit /b 1
)
echo       [OK] Componentes descargados correctamente en:
echo            %TARGET_DIR%

echo.
echo [3/5] Instalando librerias de comunicacion (esto tomara unos 20-40 segundos)...
set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
call npm install --omit=dev --no-audit --no-fund
if %errorlevel% neq 0 (
    if exist "%TARGET_DIR%\node\npm.cmd" (
        call "%TARGET_DIR%\node\npm.cmd" install --omit=dev --no-audit --no-fund
    )
)
echo       [OK] Librerias instaladas y listas.

echo.
echo [4/5] Configurando inicio automatico al encender la computadora...

:: 1. Carpeta de Inicio de Windows (Startup)
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP_DIR%" (
    copy /Y "%TARGET_DIR%\start-bridge-silent.vbs" "%STARTUP_DIR%\Lugamed-WhatsApp-Bridge.vbs" >nul
    echo       [OK] Auto-inicio registrado en Inicio de Windows (Startup).
)

:: 2. Protocolo de activacion instantanea lugamed-bridge://
reg add "HKCU\Software\Classes\lugamed-bridge" /ve /d "URL:Lugamed Bridge Protocol" /f >nul 2>&1
reg add "HKCU\Software\Classes\lugamed-bridge" /v "URL Protocol" /d "" /f >nul 2>&1
reg add "HKCU\Software\Classes\lugamed-bridge\shell\open\command" /ve /d "wscript.exe \"%TARGET_DIR%\start-bridge-silent.vbs\" \"%%1\"" /f >nul 2>&1
echo       [OK] Protocolo de enlace web activado.

:: 3. Acceso directo en el Escritorio
set "SHORTCUT_VBS=%TEMP%\create_shortcut.vbs"
(
    echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
    echo sLinkFile = "%USERPROFILE%\Desktop\Iniciar WhatsApp Bridge.lnk"
    echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
    echo oLink.TargetPath = "wscript.exe"
    echo oLink.Arguments = """%TARGET_DIR%\start-bridge-silent.vbs"""
    echo oLink.WorkingDirectory = "%TARGET_DIR%"
    echo oLink.Description = "Iniciar Microservicio de WhatsApp Bridge Lugamed"
    echo oLink.Save
) > "%SHORTCUT_VBS%"
cscript //nologo "%SHORTCUT_VBS%" >nul 2>&1
del "%SHORTCUT_VBS%" >nul 2>&1
echo       [OK] Acceso directo creado en el Escritorio.

echo.
echo [5/5] Iniciando microservicio de WhatsApp en segundo plano...
wscript.exe "%TARGET_DIR%\start-bridge-silent.vbs"

echo.
color 0a
echo ================================================================
echo   ¡INSTALACION Y CONFIGURACION COMPLETADA CON EXITO!
echo.
echo   El puente ya se encuentra ejecutandose en segundo plano.
echo.
echo   Paso siguiente:
echo   1. Regresa a la ventana de la clinica en tu navegador web.
echo   2. La pantalla detectara automaticamente la conexion.
echo   3. Escanea el codigo QR que aparecera en pantalla con tu celular.
echo.
echo   Esta ventana se cerrara automaticamente en 8 segundos...
echo ================================================================
timeout /t 8 >nul
exit /b 0
