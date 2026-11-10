@echo off
setlocal enabledelayedexpansion
title Lugamed - Instalador de WhatsApp Bridge Oficial
color 0A

echo =====================================================================
echo       HOSPITAL MULTIMEDICA SAYAXCHE - PUENTE DE WHATSAPP
echo =====================================================================
echo.

set "TARGET_DIR=%USERPROFILE%\LugamedWhatsAppBridge"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
cd /d "%TARGET_DIR%"

echo [1/4] Verificando Node.js en esta computadora...
set "NODE_CMD="

where node >nul 2>&1
if %errorlevel% equ 0 (
    set "NODE_CMD=node"
    echo       [OK] Node.js detectado en el sistema.
)

if not defined NODE_CMD (
    if exist "%TARGET_DIR%\node\node.exe" (
        set "NODE_CMD=%TARGET_DIR%\node\node.exe"
        set "PATH=%TARGET_DIR%\node;%PATH%"
        echo       [OK] Node.js portatil detectado en %TARGET_DIR%\node.
    )
)

if not defined NODE_CMD (
    echo       [INFO] Descargando componentes ligeros de Node.js...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $z = Join-Path $env:TEMP 'node-win-x64.zip'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip' -OutFile $z; Expand-Archive -Path $z -DestinationPath '%TARGET_DIR%' -Force; if (Test-Path '%TARGET_DIR%\node-v20.18.0-win-x64') { if (Test-Path '%TARGET_DIR%\node') { Remove-Item '%TARGET_DIR%\node' -Recurse -Force }; Rename-Item '%TARGET_DIR%\node-v20.18.0-win-x64' -NewName 'node' }; Remove-Item $z -Force -ErrorAction SilentlyContinue"
    if exist "%TARGET_DIR%\node\node.exe" (
        set "NODE_CMD=%TARGET_DIR%\node\node.exe"
        set "PATH=%TARGET_DIR%\node;%PATH%"
        echo       [OK] Node.js portatil configurado exitosamente.
    ) else (
        echo       [ERROR] No se pudo descargar Node.js. Por favor verifica tu conexion a Internet.
        pause
        exit /b 1
    )
)

echo [2/4] Actualizando archivos del servidor desde la clinica...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $base = 'https://gestion-consultorio-gules.vercel.app/bridge'; @('server.js', 'package.json', 'start-bridge.bat', 'start-bridge-silent.vbs', 'diagnostico-consola.bat') | ForEach-Object { try { (New-Object System.Net.WebClient).DownloadFile(\"$base/$_`\", (Join-Path '%TARGET_DIR%' $_)) } catch {} }"
echo       [OK] Archivos actualizados.

echo [3/4] Verificando dependencias necesarias (express, whatsapp-web.js)...
if not exist "%TARGET_DIR%\node_modules\whatsapp-web.js" (
    echo       [INFO] Instalando librerias de WhatsApp (esto solo se hace una vez)...
    set "PUPPETEER_SKIP_DOWNLOAD=true"
    set "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true"
    if exist "%TARGET_DIR%\node\npm.cmd" (
        call "%TARGET_DIR%\node\npm.cmd" install --omit=dev --no-audit --no-fund
    ) else (
        call npm install --omit=dev --no-audit --no-fund
    )
    echo       [OK] Librerias instaladas.
) else (
    echo       [OK] Dependencias verificadas y listas.
)

echo [4/4] Configurando accesos directos y auto-inicio en Windows...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$wsh = New-Object -ComObject WScript.Shell; $s1 = $wsh.CreateShortcut(\"$env:USERPROFILE\Desktop\Iniciar WhatsApp Bridge.lnk\"); $s1.TargetPath = 'wscript.exe'; $s1.Arguments = \"`\"%TARGET_DIR%\start-bridge-silent.vbs`\"\"; $s1.WorkingDirectory = '%TARGET_DIR%'; $s1.Description = 'Iniciar WhatsApp Bridge Lugamed'; $s1.Save(); $startup = \"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\"; if (Test-Path $startup) { Copy-Item -Path '%TARGET_DIR%\start-bridge-silent.vbs' -Destination \"$startup\Lugamed-WhatsApp-Bridge.vbs\" -Force }; New-Item -Path 'HKCU:\Software\Classes\lugamed-bridge' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\Software\Classes\lugamed-bridge' -Name '(Default)' -Value 'URL:Lugamed Bridge Protocol'; Set-ItemProperty -Path 'HKCU:\Software\Classes\lugamed-bridge' -Name 'URL Protocol' -Value ''; New-Item -Path 'HKCU:\Software\Classes\lugamed-bridge\shell\open\command' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\Software\Classes\lugamed-bridge\shell\open\command' -Name '(Default)' -Value \"wscript.exe `\"%TARGET_DIR%\start-bridge-silent.vbs`\" `\"%%1`\"\";" >nul 2>&1
echo       [OK] Acceso directo creado en el Escritorio y en Inicio de Windows.

echo.
echo =====================================================================
echo       INICIANDO MICROSERVICIO DE WHATSAPP (PUERTO 3001)...
echo =====================================================================
echo.
echo  * Abre la aplicacion de la clinica en tu navegador.
echo  * El codigo QR aparecera automaticamente en la pantalla de la clinica.
echo  * MANTEN ESTA VENTANA ABIERTA mientras uses el sistema en la clinica.
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr /I "LISTENING ESCUCHANDO"') do (
    taskkill /PID %%a /F >nul 2>&1
)

"%NODE_CMD%" server.js

echo.
echo El servicio se ha detenido. Presiona cualquier tecla para salir...
pause >nul
