@echo off
setlocal
title Instalador de WhatsApp Bridge - LUGAMED
cd /d "%~dp0"
more +6 "%~f0" | powershell.exe -NoProfile -ExecutionPolicy Bypass -Command -
exit /b %errorlevel%
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "       INSTALADOR AUTOMATICO - PUENTE DE WHATSAPP LUGAMED       " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configurando el servicio de WhatsApp para la recepcion..." -ForegroundColor White

$targetDir = "$env:USERPROFILE\LugamedWhatsAppBridge"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

# 1. Comprobar Node.js
Write-Host "[1/5] Verificando entorno de ejecucion (Node.js)..." -ForegroundColor Yellow
$hasNode = $false
try {
    $ver = & node -v 2>$null
    if ($ver) {
        $hasNode = $true
        Write-Host "      [OK] Node.js detectado en el sistema: $ver" -ForegroundColor Green
    }
} catch {}

if (-not $hasNode -and (Test-Path "$targetDir\node\node.exe")) {
    $hasNode = $true
    $env:PATH = "$targetDir\node;$env:PATH"
    Write-Host "      [OK] Node.js portatil detectado en $targetDir\node" -ForegroundColor Green
}

if (-not $hasNode) {
    Write-Host "      [INFO] Node.js no encontrado. Descargando componentes portatiles..." -ForegroundColor Yellow
    $zipPath = "$env:TEMP\node-portable.zip"
    $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"
    
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        (New-Object System.Net.WebClient).DownloadFile($nodeUrl, $zipPath)
    } catch {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $zipPath
    }

    Write-Host "      [INFO] Descomprimiendo en $targetDir\node..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath $targetDir -Force
    if (Test-Path "$targetDir\node-v20.18.0-win-x64") {
        if (Test-Path "$targetDir\node") { Remove-Item -Path "$targetDir\node" -Recurse -Force }
        Rename-Item -Path "$targetDir\node-v20.18.0-win-x64" -NewName "node"
    }
    Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
    $env:PATH = "$targetDir\node;$env:PATH"
    Write-Host "      [OK] Node.js configurado exitosamente." -ForegroundColor Green
}

# 2. Descargar archivos del puente
Write-Host "`n[2/5] Descargando archivos actualizados del puente..." -ForegroundColor Yellow
$baseUrl = "https://gestion-consultorio-gules.vercel.app/bridge"
$files = @("server.js", "package.json", "start-bridge.bat", "start-bridge-silent.vbs", "diagnostico-consola.bat")

foreach ($f in $files) {
    $dest = Join-Path $targetDir $f
    $url = "$baseUrl/$f"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        (New-Object System.Net.WebClient).DownloadFile($url, $dest)
    } catch {
        Invoke-WebRequest -Uri $url -OutFile $dest
    }
}
Write-Host "      [OK] Archivos del puente listos en: $targetDir" -ForegroundColor Green

# 3. Instalar librerias de Node.js
Write-Host "`n[3/5] Instalando librerias requeridas (esto toma ~20 segundos)..." -ForegroundColor Yellow
$env:PUPPETEER_SKIP_DOWNLOAD = "true"
$env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true"
Set-Location -Path $targetDir

$npmCmd = if (Test-Path "$targetDir\node\npm.cmd") { "$targetDir\node\npm.cmd" } else { (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source }
if (-not $npmCmd) { $npmCmd = "npm.cmd" }
& cmd.exe /c "cd /d `"$targetDir`" && `"$npmCmd`" install --omit=dev --no-audit --no-fund"
Write-Host "      [OK] Librerias instaladas." -ForegroundColor Green

# 4. Configurar auto-inicio al encender Windows
Write-Host "`n[4/5] Configurando auto-arranque silencioso al encender la PC..." -ForegroundColor Yellow
$startupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
if (Test-Path $startupDir) {
    Copy-Item -Path "$targetDir\start-bridge-silent.vbs" -Destination "$startupDir\Lugamed-WhatsApp-Bridge.vbs" -Force
    Write-Host "      [OK] Configurado en Inicio de Windows (Startup)." -ForegroundColor Green
}

# Registrar protocolo lugamed-bridge:// en HKCU
New-Item -Path "HKCU:\Software\Classes\lugamed-bridge" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Classes\lugamed-bridge" -Name "(Default)" -Value "URL:Lugamed Bridge Protocol"
Set-ItemProperty -Path "HKCU:\Software\Classes\lugamed-bridge" -Name "URL Protocol" -Value ""
New-Item -Path "HKCU:\Software\Classes\lugamed-bridge\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\Classes\lugamed-bridge\shell\open\command" -Name "(Default)" -Value "wscript.exe `"$targetDir\start-bridge-silent.vbs`" `"%1`""
Write-Host "      [OK] Protocolo de enlace web activado." -ForegroundColor Green

# Accesos directos en el Escritorio
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut("$env:USERPROFILE\Desktop\Iniciar WhatsApp Bridge.lnk")
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$targetDir\start-bridge-silent.vbs`""
$shortcut.WorkingDirectory = $targetDir
$shortcut.Description = "Iniciar Microservicio de WhatsApp Bridge Lugamed"
$shortcut.Save()

$diagShortcut = $wsh.CreateShortcut("$env:USERPROFILE\Desktop\WhatsApp Bridge - Consola Diagnostico.lnk")
$diagShortcut.TargetPath = "$targetDir\diagnostico-consola.bat"
$diagShortcut.WorkingDirectory = $targetDir
$diagShortcut.Description = "Consola de Diagnostico de WhatsApp Bridge Lugamed"
$diagShortcut.Save()
Write-Host "      [OK] Accesos directos creados en el Escritorio." -ForegroundColor Green

# 5. Iniciar y verificar inmediatamente el servicio
Write-Host "`n[5/5] Iniciando y verificando servicio de WhatsApp en segundo plano..." -ForegroundColor Yellow
Start-Process -FilePath "wscript.exe" -ArgumentList "`"$targetDir\start-bridge-silent.vbs`"" -WorkingDirectory $targetDir

$verified = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/status" -TimeoutSec 2 -ErrorAction Stop
        if ($resp.online -or $resp.success) {
            $verified = $true
            break
        }
    } catch {}
    Write-Host "." -NoNewline -ForegroundColor Gray
}
Write-Host ""

if ($verified) {
    Write-Host "      [OK] Microservicio verificado y respondiendo en http://127.0.0.1:3001." -ForegroundColor Green
    Write-Host "`n================================================================" -ForegroundColor Green
    Write-Host "       ¡INSTALACION Y CONFIGURACION COMPLETADA CON EXITO!       " -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "El servicio ya esta activo y funcionando en segundo plano.`n" -ForegroundColor White
    Write-Host "Regresa a la ventana de la clinica en tu navegador." -ForegroundColor Cyan
    Write-Host "La pantalla detectara automaticamente la conexion y te mostrara" -ForegroundColor Cyan
    Write-Host "el codigo QR para vincular WhatsApp en tu celular.`n" -ForegroundColor Cyan
    Write-Host "Esta ventana se cerrara en 8 segundos..." -ForegroundColor Gray
    Start-Sleep -Seconds 8
} else {
    Write-Host "      [AVISO] El microservicio tardo en responder en segundo plano." -ForegroundColor Yellow
    Write-Host "      Abriendo consola de diagnostico para verificar logs en pantalla..." -ForegroundColor Yellow
    Start-Process -FilePath "$targetDir\diagnostico-consola.bat" -WorkingDirectory $targetDir
    Start-Sleep -Seconds 4
}
