import QRCode from 'qrcode';
import { getAppState, saveAppState } from '../main.js';

let bridgeStatusCache = {
  online: false,
  isReady: false,
  qr: null,
  status: 'offline',
  error: null,
  lastCheck: 0
};

let detectedWorkingBridgeUrl = null;
let statusPollingInterval = null;

/**
 * Consulta el estado actual del microservicio local de WhatsApp.
 * Prueba tanto 127.0.0.1 como localhost para compatibilidad IPv4/IPv6 en Windows.
 * @returns {Promise<{online: boolean, isReady: boolean, qr: string|null, status?: string, error?: string|null, url?: string}>}
 */
export async function checkWhatsAppBridgeStatus() {
  const state = getAppState();
  const configuredUrl = state.clinicInfo && state.clinicInfo.whatsappBridgeUrl;

  const candidateUrls = configuredUrl
    ? [configuredUrl]
    : (detectedWorkingBridgeUrl
        ? [detectedWorkingBridgeUrl, 'http://127.0.0.1:3001', 'http://localhost:3001']
        : ['http://127.0.0.1:3001', 'http://localhost:3001']);

  const uniqueUrls = [...new Set(candidateUrls)];

  for (const url of uniqueUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${url}/api/status`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        mode: 'cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        detectedWorkingBridgeUrl = url;
        bridgeStatusCache = {
          online: true,
          isReady: !!data.isReady,
          qr: data.qr || null,
          status: data.status || (data.isReady ? 'ready' : (data.qr ? 'qr_ready' : 'starting')),
          error: data.error || null,
          browser: data.browser || null,
          url: url,
          lastCheck: Date.now()
        };
        return bridgeStatusCache;
      }
    } catch (err) {
      // Intentar la siguiente URL candidata
    }
  }

  bridgeStatusCache = {
    online: false,
    isReady: false,
    qr: null,
    status: 'offline',
    error: null,
    lastCheck: Date.now()
  };
  return bridgeStatusCache;
}

/**
 * Dispara el protocolo registrado en Windows (lugamed-bridge://start) para
 * iniciar silenciosamente el microservicio de WhatsApp si no estaba corriendo.
 */
export function triggerLaunchWhatsAppBridge() {
  console.log("🚀 Disparando inicio automático de WhatsApp Bridge vía protocolo Windows...");
  // 1. Enlace directo simulando click (muy eficaz en Chrome/Edge bajo interacción de usuario)
  try {
    const a = document.createElement('a');
    a.href = 'lugamed-bridge://start';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { a.remove(); } catch (_) {}
    }, 1500);
  } catch (err) {
    console.warn("Aviso al invocar enlace lugamed-bridge:", err);
  }

  // 2. Iframe oculto como método complementario
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'lugamed-bridge://start';
    document.body.appendChild(iframe);
    setTimeout(() => {
      try { iframe.remove(); } catch (_) {}
    }, 2500);
  } catch (_) {}
}

/**
 * Asegura que el microservicio de WhatsApp esté en ejecución.
 * Si está offline, invoca el inicio automático y sondea hasta que responda.
 */
export async function ensureWhatsAppBridgeRunning() {
  const initial = await checkWhatsAppBridgeStatus();
  if (initial.online) {
    return initial;
  }

  // Activar mediante protocolo
  triggerLaunchWhatsAppBridge();

  // Sondeo durante 6 segundos (4 intentos)
  for (let i = 0; i < 4; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const status = await checkWhatsAppBridgeStatus();
    if (status.online) {
      return status;
    }
  }

  return { online: false, isReady: false, qr: null };
}

/**
 * Envía una notificación de WhatsApp al médico asignado de forma asíncrona.
 * Soporta indicar la prioridad de atención (triaje), signos vitales y motivo de consulta.
 * @param {string} nombreMedico - Nombre del médico
 * @param {string} telefonoMedico - Teléfono del médico
 * @param {string} nombrePaciente - Nombre del paciente
 * @param {Object|boolean} options - Opciones adicionales ({ prioridad, signosVitales, motivo, customMessage }) o flag de reintento
 * @param {boolean} isRetry - Indica si ya es un reintento
 * @returns {Promise<boolean>} Retorna true de forma no bloqueante
 */
export async function notifyDoctorViaWhatsApp(nombreMedico, telefonoMedico, nombrePaciente, options = {}, isRetry = false) {
  if (typeof options === 'boolean') {
    isRetry = options;
    options = {};
  }

  let doctorNameClean = nombreMedico;
  if (doctorNameClean.toLowerCase().startsWith('dr. ') || doctorNameClean.toLowerCase().startsWith('dra. ')) {
    doctorNameClean = doctorNameClean.substring(4);
  } else if (doctorNameClean.toLowerCase().startsWith('dr.') || doctorNameClean.toLowerCase().startsWith('dra.')) {
    doctorNameClean = doctorNameClean.substring(3);
  }

  const { prioridad, signosVitales, motivo, customMessage } = options || {};

  // Para compatibilidad retroactiva con cualquier versión de puente local
  let patientDisplayName = nombrePaciente;
  if (prioridad) {
    const pNorm = String(prioridad).toUpperCase();
    if (pNorm.includes('EMERGENCIA') || pNorm.includes('CRITICA') || pNorm.includes('ALTA')) {
      patientDisplayName = `${nombrePaciente} [🚨 PRIORIDAD: EMERGENCIA]`;
    } else if (pNorm.includes('URGENCIA') || pNorm.includes('MODERADA') || pNorm.includes('MEDIA')) {
      patientDisplayName = `${nombrePaciente} [⚠️ PRIORIDAD: URGENCIA]`;
    } else {
      patientDisplayName = `${nombrePaciente} [🟢 PRIORIDAD: NORMAL]`;
    }
  }

  const payload = {
    nombreMedico: doctorNameClean,
    telefonoMedico: telefonoMedico,
    nombrePaciente: patientDisplayName,
    patientNameClean: nombrePaciente,
    prioridad: prioridad || null,
    signosVitales: signosVitales || null,
    motivo: motivo || null,
    customMessage: customMessage || null
  };

  const state = getAppState();
  const bridgeUrl = detectedWorkingBridgeUrl || (state.clinicInfo && state.clinicInfo.whatsappBridgeUrl) || 'http://127.0.0.1:3001';

  try {
    const response = await fetch(`${bridgeUrl}/api/notify-doctor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Notificación enviada exitosamente vía WhatsApp Bridge:', data);
    return true;
  } catch (error) {
    console.warn('⚠️ Falló el envío directo de WhatsApp:', error.message);

    // Si aún no hemos reintentado, intentar iniciar el puente y reintentar
    if (!isRetry) {
      console.log('🔄 Intentando levantar el puente y reintentar envío...');
      triggerLaunchWhatsAppBridge();
      await new Promise(r => setTimeout(r, 2500));
      return notifyDoctorViaWhatsApp(nombreMedico, telefonoMedico, nombrePaciente, options, true);
    }

    // Si persiste el fallo, mostrar advertencia interactiva con opción de inicio manual
    showBridgeNotificationWarning(payload, error.message);
    return false;
  }
}

/**
 * Muestra una advertencia visual (toast/alerta) en la interfaz si el microservicio está offline o falla.
 * @param {Object} payload - Los datos del médico y paciente
 * @param {string} errorDetails - Detalles del error ocurrido
 */
function showBridgeNotificationWarning(payload, errorDetails) {
  // Crear un contenedor de alerta/toast flotante y elegante en pantalla
  const warningDiv = document.createElement('div');
  warningDiv.id = 'whatsapp-bridge-warning';
  warningDiv.style.position = 'fixed';
  warningDiv.style.bottom = '20px';
  warningDiv.style.right = '20px';
  warningDiv.style.zIndex = '99999';
  warningDiv.style.background = 'rgba(23, 23, 37, 0.95)';
  warningDiv.style.border = '1px solid var(--accent-danger)';
  warningDiv.style.borderRadius = '8px';
  warningDiv.style.padding = '16px';
  warningDiv.style.maxWidth = '360px';
  warningDiv.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
  warningDiv.style.backdropFilter = 'blur(10px)';
  warningDiv.style.fontFamily = 'var(--font-sans)';
  warningDiv.style.color = 'var(--text-primary)';
  warningDiv.style.display = 'flex';
  warningDiv.style.flexDirection = 'column';
  warningDiv.style.gap = '10px';
  warningDiv.style.animation = 'slideIn 0.3s ease-out';

  // Construir link manual (wa.me) como plan de contingencia (fallback)
  let cleanPhone = String(payload.telefonoMedico || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 8) {
    cleanPhone = '502' + cleanPhone;
  }
  const fallbackMessage = `Estimado Dr. ${payload.nombreMedico}, el paciente ${payload.nombrePaciente} espera por tu atencion en tu consultorio`;
  const fallbackUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fallbackMessage)}`;

  warningDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 1.25rem;">⚠️</span>
      <strong style="color: var(--accent-danger); font-size: 0.9rem;">WhatsApp Bridge Desconectado</strong>
    </div>
    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0; line-height: 1.4;">
      No se pudo enviar la notificación automatizada. Verifica que el microservicio esté activo en el puerto 3001.
    </p>
    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; flex-wrap: wrap;">
      <button id="btn-close-bridge-warning" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Cerrar</button>
      <button id="btn-open-installer" style="background: var(--accent-primary); border: none; color: white; padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">📥 Instalar / Iniciar Puente</button>
      <a href="${fallbackUrl}" target="_blank" id="btn-open-fallback-manual" style="background: var(--accent-danger); border: none; color: white; padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; text-decoration: none; display: inline-block; text-align: center;">Enviar Manual</a>
    </div>
  `;

  // Remover advertencias anteriores de la UI
  const existingWarning = document.getElementById('whatsapp-bridge-warning');
  if (existingWarning) {
    existingWarning.remove();
  }

  document.body.appendChild(warningDiv);

  // Agregar animación de entrada
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(styleEl);

  // Asignar listeners para cerrar la alerta
  const closeBtn = warningDiv.querySelector('#btn-close-bridge-warning');
  const manualLink = warningDiv.querySelector('#btn-open-fallback-manual');
  const openInstallerBtn = warningDiv.querySelector('#btn-open-installer');

  const removeWarning = () => {
    warningDiv.style.animation = 'slideIn 0.2s reverse ease-in';
    setTimeout(() => {
      warningDiv.remove();
      styleEl.remove();
    }, 200);
  };

  closeBtn.addEventListener('click', removeWarning);
  manualLink.addEventListener('click', removeWarning);
  if (openInstallerBtn) {
    openInstallerBtn.addEventListener('click', () => {
      removeWarning();
      showWhatsAppInstallationModal();
    });
  }

  // Cierre automático tras 10 segundos
  setTimeout(() => {
    if (document.body.contains(warningDiv)) {
      removeWarning();
    }
  }, 10000);
}

/**
 * Solicita al microservicio local cerrar la sesión de WhatsApp para generar un nuevo código QR.
 * @returns {Promise<boolean>}
 */
export async function logoutWhatsAppBridge() {
  const state = getAppState();
  const bridgeUrl = detectedWorkingBridgeUrl || (state.clinicInfo && state.clinicInfo.whatsappBridgeUrl) || 'http://127.0.0.1:3001';
  try {
    const res = await fetch(`${bridgeUrl}/api/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors'
    });
    bridgeStatusCache = { ...bridgeStatusCache, isReady: false, qr: null, status: 'starting' };
    updateWhatsAppPillUI(bridgeStatusCache);
    return res.ok;
  } catch (err) {
    console.warn('Aviso al desvincular WhatsApp:', err.message);
    return false;
  }
}

/**
 * Muestra el modal interactivo con el código QR para vincular WhatsApp Web o gestionar la sesión actual.
 * Se adapta automáticamente al estado del microservicio: vinculado, esperando escaneo, iniciando o fuera de línea.
 * @param {string|null} qrData - Cadena opcional del código QR. Si no se pasa, consulta el microservicio en vivo.
 */
export async function showWhatsAppQrModal(qrData = null) {
  const existingModal = document.getElementById('whatsapp-qr-modal');
  if (existingModal) existingModal.remove();

  // Iniciar automáticamente el microservicio local de inmediato
  triggerLaunchWhatsAppBridge();

  const modal = document.createElement('div');
  modal.id = 'whatsapp-qr-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '999999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.background = 'rgba(0, 0, 0, 0.78)';
  modal.style.backdropFilter = 'blur(6px)';
  modal.style.padding = '16px';

  let currentQr = qrData;
  let status = bridgeStatusCache || { online: false, isReady: false, qr: qrData };

  // Renderizar directamente la vista del código QR
  modal.innerHTML = `
    <div class="glass-card" style="background: #181826; border: 1px solid var(--accent-primary); border-radius: 14px; padding: 24px; max-width: 440px; width: 92%; text-align: center; box-shadow: 0 15px 40px rgba(0,0,0,0.65); position: relative;">
      <button id="btn-close-wa-qr-x" style="position: absolute; top: 12px; right: 14px; background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
      
      <div id="wa-qr-modal-body">
        <div style="font-size: 2.2rem; margin-bottom: 6px;">📲</div>
        <h3 style="margin: 0 0 6px 0; color: var(--text-primary); font-family: var(--font-heading); font-size: 1.3rem;">
          Código QR de WhatsApp
        </h3>
        <p style="font-size: 0.83rem; color: var(--text-muted); line-height: 1.4; margin: 0 0 16px 0;">
          Escanea el código con el celular de recepción para activar el envío automático de notificaciones a los médicos.
        </p>

        <!-- Contenedor del código QR / Loader -->
        <div id="wa-qr-wrapper" style="background: white; padding: 12px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.3); min-width: 240px; min-height: 240px; position: relative;">
          <canvas id="wa-qr-canvas" style="display: ${currentQr ? 'block' : 'none'}; width: 220px; height: 220px;"></canvas>
          <div id="wa-qr-placeholder" style="display: ${currentQr ? 'none' : 'flex'}; flex-direction: column; align-items: center; justify-content: center; height: 220px; width: 220px; color: #1e293b; gap: 10px; text-align: center; padding: 10px;">
            <div style="width: 38px; height: 38px; border: 3px solid rgba(0, 242, 254, 0.2); border-top-color: #00f2fe; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <span style="font-size: 0.88rem; font-weight: 700; color: #0f172a;" id="wa-placeholder-title">Iniciando WhatsApp...</span>
            <span style="font-size: 0.75rem; color: #64748b; line-height: 1.3;" id="wa-placeholder-subtitle">Levantando el puente y generando código QR automáticamente...</span>
          </div>
        </div>

        <!-- Estado interactivo en vivo -->
        <div id="wa-qr-status" style="font-size: 0.82rem; color: #38bdf8; margin-bottom: 14px; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600;">
          <span class="wa-indicator-dot connecting" style="width: 10px; height: 10px;"></span>
          <span id="wa-qr-status-msg">${currentQr ? '¡Código QR listo! Esperando escaneo...' : 'Iniciando WhatsApp Bridge en segundo plano...'}</span>
        </div>

        <!-- Instrucciones paso a paso -->
        <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; text-align: left; font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
          <strong style="color: var(--text-primary); display: block; margin-bottom: 3px;">Cómo escanear en tu celular:</strong>
          1. Abre <strong>WhatsApp</strong> en el teléfono.<br>
          2. Ve a <strong>Ajustes / Menú (⋮) ➔ Dispositivos vinculados</strong>.<br>
          3. Toca <strong>Vincular un dispositivo</strong> y apunta tu cámara a la pantalla.
        </div>

        <!-- Ayuda alternativa (solo visible si tras 15 segundos no responde) -->
        <div id="wa-qr-delayed-help" style="display: none; background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.25); border-radius: 8px; padding: 8px 12px; margin-bottom: 14px; font-size: 0.78rem; color: var(--text-muted);">
          ¿El servicio no inicia? Si es la primera vez que se usa en esta PC:<br>
          <a href="/bridge/Instalador-WhatsApp-Lugamed.bat" download style="color: #fbbf24; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;">
            <span>📥</span> Descargar Instalador de 1 Clic (.bat)
          </a>
        </div>

        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="btn-close-wa-qr" style="background: rgba(255,255,255,0.08); border: 1px solid var(--border-color); color: var(--text-muted); padding: 8px 22px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const canvas = modal.querySelector('#wa-qr-canvas');
  const placeholder = modal.querySelector('#wa-qr-placeholder');
  const statusMsg = modal.querySelector('#wa-qr-status-msg');
  const statusDot = modal.querySelector('#wa-qr-status .wa-indicator-dot');
  const closeBtn = modal.querySelector('#btn-close-wa-qr');
  const closeX = modal.querySelector('#btn-close-wa-qr-x');
  const delayedHelp = modal.querySelector('#wa-qr-delayed-help');

  const closeModal = () => {
    clearInterval(qrCheckInterval);
    modal.remove();
  };
  if (closeBtn) closeBtn.onclick = closeModal;
  if (closeX) closeX.onclick = closeModal;

  // Si ya tenemos QR previo, dibujarlo de inmediato
  if (canvas && currentQr) {
    canvas.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    QRCode.toCanvas(canvas, currentQr, { width: 220, margin: 1 }, (err) => {
      if (err) console.error("Error al renderizar QR en canvas:", err);
    });
  }

  let attempts = 0;
  // Bucle de sondeo constante cada 1.2 segundos
  const qrCheckInterval = setInterval(async () => {
    if (!document.body.contains(modal)) {
      clearInterval(qrCheckInterval);
      return;
    }

    attempts++;

    // Re-disparar el protocolo cada 5 segundos si sigue offline
    if (attempts % 4 === 0 && (!status || !status.online)) {
      triggerLaunchWhatsAppBridge();
    }

    // Mostrar enlace de descarga tras 15 segundos si no ha levantado
    if (attempts >= 12 && (!status || !status.online)) {
      if (delayedHelp) delayedHelp.style.display = 'block';
    }

    try {
      status = await checkWhatsAppBridgeStatus();
      updateWhatsAppPillUI(status);

      if (status.online && status.isReady) {
        clearInterval(qrCheckInterval);
        const body = modal.querySelector('#wa-qr-modal-body');
        if (body) {
          body.innerHTML = `
            <div style="font-size: 2.8rem; margin-bottom: 8px;">✅</div>
            <h3 style="margin: 0 0 8px 0; color: #22c55e; font-family: var(--font-heading); font-size: 1.35rem;">
              ¡WhatsApp Vinculado y Activo!
            </h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin: 0 0 18px 0;">
              El microservicio local está conectado exitosamente a WhatsApp Web.<br>
              Las notificaciones de pacientes y prioridad se enviarán de forma automática.
            </p>
            <div style="background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 0.82rem; color: #22c55e; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600;">
              <span class="wa-indicator-dot online"></span>
              <span>Sesión activa y lista en esta computadora</span>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button id="btn-relink-wa-session" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); color: #f87171; padding: 8px 14px; border-radius: 6px; font-size: 0.82rem; cursor: pointer;">
                🔄 Cambiar Celular / Desvincular
              </button>
              <button id="btn-close-wa-done" style="background: var(--accent-primary); border: none; color: white; padding: 8px 22px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                Listo
              </button>
            </div>
          `;
          const relinkBtn = body.querySelector('#btn-relink-wa-session');
          if (relinkBtn) {
            relinkBtn.onclick = async () => {
              if (!confirm("¿Deseas desvincular la sesión actual para escanear un nuevo código QR?")) return;
              relinkBtn.disabled = true;
              relinkBtn.textContent = "Desvinculando...";
              await logoutWhatsAppBridge();
              showWhatsAppQrModal();
            };
          }
          const doneBtn = body.querySelector('#btn-close-wa-done');
          if (doneBtn) doneBtn.onclick = closeModal;
        }
        return;
      }

      if (status.qr) {
        if (delayedHelp) delayedHelp.style.display = 'none';
        if (currentQr !== status.qr) {
          currentQr = status.qr;
          if (canvas) {
            canvas.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
            QRCode.toCanvas(canvas, currentQr, { width: 220, margin: 1 });
          }
        }
        if (statusMsg) {
          statusMsg.textContent = '¡Código QR listo! Esperando escaneo con tu celular...';
        }
        if (statusDot) {
          statusDot.className = 'wa-indicator-dot qr-needed';
        }
      } else if (status.online) {
        if (statusMsg) {
          statusMsg.textContent = 'Conectando con WhatsApp Web... Generando código QR...';
        }
        if (statusDot) {
          statusDot.className = 'wa-indicator-dot connecting';
        }
      } else {
        if (statusMsg) {
          statusMsg.textContent = `Iniciando servicio de WhatsApp automáticamente (${attempts}s)...`;
        }
        if (statusDot) {
          statusDot.className = 'wa-indicator-dot connecting';
        }
      }
    } catch (err) {
      console.warn("Sondeo WhatsApp Qr:", err);
    }
  }, 1200);
}

/**
 * Muestra un modal interactivo con el instalador automático de WhatsApp
 * para cualquier computadora de recepción donde el puente aún no esté instalado o ejecutándose.
 */
export function showWhatsAppInstallationModal() {
  const existingModal = document.getElementById('whatsapp-install-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'whatsapp-install-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '999998';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.background = 'rgba(0, 0, 0, 0.82)';
  modal.style.backdropFilter = 'blur(8px)';
  modal.style.padding = '16px';

  modal.innerHTML = `
    <div class="glass-card" style="background: #141422; border: 1px solid var(--accent-primary); border-radius: 14px; padding: 26px; max-width: 520px; width: 100%; box-shadow: 0 20px 45px rgba(0,0,0,0.8); animation: slideIn 0.3s ease-out; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.8rem;">📲</span>
          <h3 style="margin: 0; color: var(--text-primary); font-family: var(--font-heading); font-size: 1.25rem;">
            WhatsApp Automático para Recepción
          </h3>
        </div>
        <button id="btn-close-wa-install-x" style="background: none; border: none; color: var(--text-muted); font-size: 1.4rem; cursor: pointer; padding: 4px 8px; border-radius: 4px;">&times;</button>
      </div>

      <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.5; margin: 0 0 16px 0;">
        Para enviar automáticamente los mensajes a los médicos al ingresar o asignar pacientes, instala el puente oficial en esta computadora con un solo clic:
      </p>

      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 16px; margin-bottom: 18px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <div style="background: var(--accent-primary); color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; flex-shrink: 0;">1</div>
          <div style="flex: 1;">
            <strong style="color: var(--text-primary); font-size: 0.9rem; display: block; margin-bottom: 6px;">Descarga el instalador automático:</strong>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <a href="/bridge/Instalador-WhatsApp-Lugamed.bat" download="Instalador-WhatsApp-Lugamed.bat" style="background: #22c55e; color: #0f172a; text-decoration: none; padding: 8px 14px; border-radius: 6px; font-weight: 700; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">
                <span>📥</span> Descargar Instalador (.BAT)
              </a>
              <a href="/bridge/Instalador-WhatsApp-Lugamed.zip" download="Instalador-WhatsApp-Lugamed.zip" style="background: rgba(255,255,255,0.08); color: var(--text-primary); text-decoration: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border-color);">
                <span>📦</span> Opción ZIP
              </a>
            </div>
            <span style="font-size: 0.74rem; color: var(--text-muted); display: block; margin-top: 6px;">
              💡 Si el navegador muestra advertencia al descargar, selecciona "Conservar" o "Descargar de todos modos".
            </span>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <div style="background: var(--accent-primary); color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; flex-shrink: 0;">2</div>
          <div style="flex: 1;">
            <strong style="color: var(--text-primary); font-size: 0.9rem; display: block;">Ejecuta el archivo descargado (doble clic)</strong>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0 0 0; line-height: 1.4;">
              El asistente configurará todo en segundo plano y activará el inicio automático al encender esta computadora.
            </p>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <div style="background: var(--accent-primary); color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem; flex-shrink: 0;">3</div>
          <div style="flex: 1;">
            <strong style="color: var(--text-primary); font-size: 0.9rem; display: block;">Escanea el código QR de WhatsApp</strong>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0 0 0; line-height: 1.4;">
              En cuanto el instalador inicie el puente, esta pantalla te mostrará automáticamente el código QR para vincular WhatsApp en tu celular.
            </p>
          </div>
        </div>
      </div>

      <div id="wa-installer-live-indicator" style="background: rgba(234, 179, 8, 0.1); border: 1px dashed rgba(234, 179, 8, 0.4); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 0.85rem; color: #eab308; margin-bottom: 18px; text-align: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="wa-indicator-dot connecting"></span>
          <span id="wa-installer-status-text">Detectando microservicio en esta computadora...</span>
        </div>
        <a href="http://127.0.0.1:3001/api/status" target="_blank" style="font-size: 0.75rem; color: #38bdf8; text-decoration: underline; opacity: 0.85;">
          Probar conectividad local (127.0.0.1:3001)
        </a>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button id="btn-dismiss-wa-install" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 8px 16px; border-radius: 6px; font-size: 0.82rem; cursor: pointer;">
          Configurar más tarde
        </button>
        <button id="btn-recheck-wa-bridge" style="background: rgba(255,255,255,0.08); border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 16px; border-radius: 6px; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <span>🔄</span> Verificar Conexión
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = (remember = false) => {
    if (remember) {
      sessionStorage.setItem('wa_install_modal_dismissed', 'true');
    }
    if (document.body.contains(modal)) {
      modal.remove();
    }
  };

  const closeX = modal.querySelector('#btn-close-wa-install-x');
  const dismissBtn = modal.querySelector('#btn-dismiss-wa-install');
  const recheckBtn = modal.querySelector('#btn-recheck-wa-bridge');
  const statusBox = modal.querySelector('#wa-installer-live-indicator');
  const statusText = modal.querySelector('#wa-installer-status-text');

  if (closeX) closeX.onclick = () => closeModal(true);
  if (dismissBtn) dismissBtn.onclick = () => closeModal(true);

  let pollAttempts = 0;
  const checkAndTransition = async () => {
    pollAttempts++;
    const status = await checkWhatsAppBridgeStatus();
    if (status.online) {
      if (statusBox && statusText) {
        statusBox.style.background = 'rgba(34, 197, 94, 0.15)';
        statusBox.style.borderColor = 'rgba(34, 197, 94, 0.5)';
        statusBox.style.color = '#22c55e';
        if (status.isReady) {
          statusText.textContent = '✅ ¡Puente de WhatsApp listo y vinculado!';
        } else if (status.qr) {
          statusText.textContent = '📲 Microservicio conectado. Mostrando código QR...';
        } else if (status.status === 'starting') {
          statusText.textContent = '⏳ Microservicio activo en esta PC. Iniciando motor de WhatsApp...';
        } else if (status.error) {
          statusBox.style.background = 'rgba(239, 68, 68, 0.15)';
          statusBox.style.borderColor = 'rgba(239, 68, 68, 0.5)';
          statusBox.style.color = '#ef4444';
          statusText.textContent = `⚠️ Microservicio con alerta: ${status.error}`;
        } else {
          statusText.textContent = '✅ ¡Microservicio detectado en esta computadora!';
        }
      }
      setTimeout(() => {
        closeModal(false);
        updateWhatsAppPillUI(status);
        if (status.qr && !status.isReady) {
          showWhatsAppQrModal(status.qr);
        }
      }, 1000);
      return true;
    } else {
      if (pollAttempts >= 4 && statusText) {
        statusText.innerHTML = '<span>🟡 Esperando microservicio... Si el instalador ya finalizó, abre el acceso directo <strong>"WhatsApp Bridge - Consola Diagnostico"</strong> en el Escritorio.</span>';
      }
    }
    return false;
  };

  if (recheckBtn) {
    recheckBtn.onclick = async () => {
      recheckBtn.disabled = true;
      recheckBtn.textContent = 'Verificando...';
      triggerLaunchWhatsAppBridge();
      await new Promise(r => setTimeout(r, 1500));
      const online = await checkAndTransition();
      if (!online) {
        recheckBtn.disabled = false;
        recheckBtn.innerHTML = '<span>🔄</span> Verificar Conexión';
      }
    };
  }

  // Polling automático mientras el modal esté visible
  const installPollInterval = setInterval(async () => {
    if (!document.body.contains(modal)) {
      clearInterval(installPollInterval);
      return;
    }
    const online = await checkAndTransition();
    if (online) {
      clearInterval(installPollInterval);
    }
  }, 2000);
}

/**
 * Inicializa el monitoreo y el botón/indicador de estado de WhatsApp para el rol de RECEPCIONISTA (y Admin).
 * @param {Object} currentUser - Usuario autenticado
 */
export function initWhatsAppReceptionistBridge(currentUser) {
  if (!currentUser) return;
  const roleLower = String(currentUser.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isReceptionist = roleLower.includes('recepcionista') || roleLower.includes('recep') || roleLower.includes('admin') || roleLower.includes('administrador');

  const sidebarActionItem = document.getElementById('sidebar-whatsapp-action-item');
  const navLinks = document.querySelector('.nav-links');

  if (!isReceptionist) {
    if (sidebarActionItem) sidebarActionItem.style.display = 'none';
    const pill = document.getElementById('whatsapp-sidebar-status-container');
    if (pill) pill.style.display = 'none';
    return;
  }

  // 1. Mostrar o inyectar el botón en la barra lateral para el rol de RECEPCIONISTA
  if (sidebarActionItem) {
    sidebarActionItem.style.display = 'block';
  } else if (navLinks) {
    const li = document.createElement('li');
    li.className = 'sidebar-action-item';
    li.id = 'sidebar-whatsapp-action-item';
    li.style.marginTop = '10px';
    li.style.paddingTop = '8px';
    li.style.borderTop = '1px solid rgba(255, 255, 255, 0.08)';
    li.innerHTML = `
      <button id="btn-sidebar-whatsapp-qr" type="button" class="sidebar-whatsapp-btn" title="Mostrar código QR para vincular WhatsApp">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="icon">📲</span>
          <span class="text">Código QR WhatsApp</span>
        </div>
        <span id="sidebar-wa-badge" class="sidebar-wa-badge">QR</span>
      </button>
    `;
    navLinks.appendChild(li);
  }

  // 2. Asociar el evento click del botón para abrir el modal del código QR
  const qrBtn = document.getElementById('btn-sidebar-whatsapp-qr');
  if (qrBtn && !qrBtn.dataset.bound) {
    qrBtn.dataset.bound = 'true';
    qrBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Cerrar menú móvil si está desplegado
      const sidebar = document.getElementById('main-sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) overlay.classList.remove('active');
      }
      // Iniciar el puente inmediatamente en el gesto del usuario y mostrar el modal del QR directo
      triggerLaunchWhatsAppBridge();
      showWhatsAppQrModal();
    });
  }

  // 3. Inyectar estilos para el pill de WhatsApp si no existen
  if (!document.getElementById('whatsapp-pill-styles')) {
    const style = document.createElement('style');
    style.id = 'whatsapp-pill-styles';
    style.textContent = `
      @keyframes wa-pulse {
        0% { transform: scale(0.95); opacity: 0.8; }
        50% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(0.95); opacity: 0.8; }
      }
      .whatsapp-status-pill {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 5px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        margin: 6px 15px;
        transition: all 0.2s ease;
        user-select: none;
      }
      .whatsapp-status-pill:hover {
        filter: brightness(1.15);
      }
      .whatsapp-status-pill.online {
        background: rgba(34, 197, 94, 0.12);
        color: #22c55e;
        border: 1px solid rgba(34, 197, 94, 0.3);
      }
      .whatsapp-status-pill.connecting {
        background: rgba(234, 179, 8, 0.12);
        color: #eab308;
        border: 1px solid rgba(234, 179, 8, 0.3);
      }
      .whatsapp-status-pill.qr-needed {
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        border: 1px solid rgba(59, 130, 246, 0.4);
      }
      .whatsapp-status-pill.offline {
        background: rgba(239, 68, 68, 0.12);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }
      .wa-indicator-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
      .wa-indicator-dot.online { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
      .wa-indicator-dot.connecting { background: #eab308; animation: wa-pulse 1.2s infinite; }
      .wa-indicator-dot.qr-needed { background: #3b82f6; animation: wa-pulse 1.2s infinite; }
      .wa-indicator-dot.offline { background: #ef4444; }
    `;
    document.head.appendChild(style);
  }

  // 4. Colocar el pill en el sidebar debajo de la información del usuario
  const sidebarUser = document.getElementById('sidebar-user-container');
  if (sidebarUser) {
    let pillContainer = document.getElementById('whatsapp-sidebar-status-container');
    if (!pillContainer) {
      pillContainer = document.createElement('div');
      pillContainer.id = 'whatsapp-sidebar-status-container';
      sidebarUser.insertAdjacentElement('afterend', pillContainer);
    }
  }

  // 5. Iniciar comprobación y auto-arranque silencioso si está offline
  ensureWhatsAppBridgeRunning().then(status => {
    updateWhatsAppPillUI(status);
    if (status.qr && !status.isReady) {
      showWhatsAppQrModal(status.qr);
    }
  });

  // 6. Polling periódico cada 15 segundos
  if (statusPollingInterval) clearInterval(statusPollingInterval);
  statusPollingInterval = setInterval(async () => {
    const status = await checkWhatsAppBridgeStatus();
    updateWhatsAppPillUI(status);
  }, 15000);

  // 7. Comprobación y envío automático de recordatorios de citas de 48 horas
  setTimeout(() => {
    checkAndSend48hAppointmentReminders().catch(() => {});
  }, 3500);

  if (window._waRemindersInterval) clearInterval(window._waRemindersInterval);
  window._waRemindersInterval = setInterval(() => {
    checkAndSend48hAppointmentReminders().catch(() => {});
  }, 15 * 60 * 1000); // Revisar automáticamente cada 15 minutos
}

/**
 * Actualiza visualmente el badge de estado de WhatsApp en el sidebar y en el botón de navegación.
 * @param {Object} status - Estado devuelto por checkWhatsAppBridgeStatus
 */
export function updateWhatsAppPillUI(status) {
  // 1. Actualizar el badge del botón de navegación en la barra lateral
  const sidebarBadge = document.getElementById('sidebar-wa-badge');
  if (sidebarBadge) {
    sidebarBadge.className = 'sidebar-wa-badge';
    if (status.online) {
      if (status.isReady) {
        sidebarBadge.classList.add('online');
        sidebarBadge.textContent = 'Activo';
      } else if (status.qr) {
        sidebarBadge.classList.add('qr-needed');
        sidebarBadge.textContent = 'Escanear QR';
      } else {
        sidebarBadge.classList.add('connecting');
        sidebarBadge.textContent = 'Iniciando';
      }
    } else {
      sidebarBadge.classList.add('offline');
      sidebarBadge.textContent = 'Offline';
    }
  }

  // 2. Actualizar el pill debajo del perfil del usuario
  const container = document.getElementById('whatsapp-sidebar-status-container');
  if (!container) return;

  let stateClass = 'offline';
  let dotClass = 'offline';
  let labelText = 'WhatsApp Inactivo (Instalar)';
  let tooltipText = 'El puente de WhatsApp no está instalado o activo en esta computadora. Haz clic para vincular o iniciar.';

  if (status.online) {
    if (status.isReady) {
      stateClass = 'online';
      dotClass = 'online';
      labelText = 'WhatsApp Activo';
      tooltipText = 'Puente conectado. Los mensajes a médicos se enviarán de forma automática. Clic para ver estado.';
    } else if (status.qr) {
      stateClass = 'qr-needed';
      dotClass = 'qr-needed';
      labelText = 'Vincular WhatsApp (QR)';
      tooltipText = 'Se requiere escanear el código QR para vincular WhatsApp Web. Clic para ver código QR.';
    } else {
      stateClass = 'connecting';
      dotClass = 'connecting';
      labelText = 'Conectando WhatsApp...';
      tooltipText = 'El puente está cargando la sesión guardada en esta computadora...';
    }
  }

  container.innerHTML = `
    <div class="whatsapp-status-pill ${stateClass}" title="${tooltipText}">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="wa-indicator-dot ${dotClass}"></span>
        <span>${labelText}</span>
      </div>
      <span style="font-size: 0.72rem; opacity: 0.8;">💬</span>
    </div>
  `;

  const pill = container.querySelector('.whatsapp-status-pill');
  if (pill) {
    pill.onclick = async () => {
      showWhatsAppQrModal();
    };
  }
}

/**
 * Envía la notificación formal de bienvenida y código oficial de asistencia al empleado vía WhatsApp Bridge.
 * @param {object} employee - Datos del empleado { name, whatsapp_number, employee_code }
 * @returns {Promise<boolean>} Retorna true siempre de forma asíncrona/no bloqueante
 */
export async function notifyEmployeeWelcome(employee) {
  if (!employee || !employee.whatsapp_number || !employee.employee_code) {
    console.warn('⚠️ No se puede enviar WhatsApp: faltan datos del empleado.');
    return false;
  }

  const payload = {
    employeeName: employee.name,
    phoneNumber: employee.whatsapp_number,
    employeeCode: employee.employee_code
  };

  const state = getAppState();
  const bridgeUrl = detectedWorkingBridgeUrl || (state.clinicInfo && state.clinicInfo.whatsappBridgeUrl) || 'http://127.0.0.1:3001';

  fetch(`${bridgeUrl}/api/notify-employee`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  .then(async (response) => {
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error HTTP ${response.status}`);
    }
    return response.json();
  })
  .then((data) => {
    console.log(`✅ Código ${employee.employee_code} enviado a ${employee.name} vía WhatsApp Bridge:`, data);
  })
  .catch((error) => {
    console.warn('ℹ️ WhatsApp Bridge offline o no respondió para empleado:', error.message);
  });

  return true;
}

/**
 * Formatea el mensaje oficial de recordatorio de cita 48 horas antes.
 * Template requerido al pie de la letra:
 * "Hola 'NOMBRE DEL PACIENTE', Te saludamos de HOSPITAL MULTIMECA SAYAXCHÉ, te recordamos que tienes una cita el 'nombre del dia' 'dia' de 'nombre del mes' con el  'nombre del medico' a las 'hora'."
 * @param {string} patientName - Nombre completo del paciente
 * @param {string} appDateStr - Fecha en formato YYYY-MM-DD
 * @param {string} appTimeStr - Hora en formato HH:MM
 * @param {string} doctorName - Nombre del médico tratante
 * @returns {string} Mensaje formateado
 */
export function formatAppointmentReminderMessage(patientName, appDateStr, appTimeStr, doctorName) {
  const parts = String(appDateStr || '').split('-');
  let dayOfWeek = 'el día agendado';
  let dayOfMonth = '';
  let monthName = '';

  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    // Mediodía local para evitar desfases de huso horario
    const dt = new Date(y, m, d, 12, 0, 0);

    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    dayOfWeek = dayNames[dt.getDay()] || '';
    monthName = monthNames[dt.getMonth()] || '';
    dayOfMonth = dt.getDate();
  }

  // Formato de hora (ej. 14:00 -> 2:00 PM, 09:30 -> 9:30 AM)
  let formattedTime = appTimeStr || 'la hora programada';
  if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(appTimeStr)) {
    const [hh, mm] = appTimeStr.split(':').map(n => parseInt(n, 10));
    const period = hh >= 12 ? 'PM' : 'AM';
    const hour12 = hh % 12 === 0 ? 12 : hh % 12;
    formattedTime = `${hour12}:${mm.toString().padStart(2, '0')} ${period}`;
  }

  let docClean = doctorName || 'Médico Tratante';
  if (!docClean.toLowerCase().startsWith('dr') && !docClean.toLowerCase().startsWith('médic')) {
    docClean = `Dr. ${docClean}`;
  }

  return `Hola ${patientName}, Te saludamos de HOSPITAL MULTIMECA SAYAXCHÉ, te recordamos que tienes una cita el ${dayOfWeek} ${dayOfMonth} de ${monthName} con el  ${docClean} a las ${formattedTime}.`;
}

/**
 * Calcula la diferencia en horas entre el momento actual y la cita programada.
 * Retorna número positivo si la cita está en el futuro, o negativo si ya pasó.
 * @param {string} appDateStr - Fecha YYYY-MM-DD
 * @param {string} appTimeStr - Hora HH:MM
 * @returns {number|null} Diferencia en horas
 */
export function getAppointmentTimeDiffHours(appDateStr, appTimeStr) {
  if (!appDateStr) return null;
  const timePart = appTimeStr || '08:00';
  const parts = String(appDateStr).split('-');
  if (parts.length !== 3) return null;

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  let hh = 8, mm = 0;
  if (timePart.includes(':')) {
    const [h, min] = timePart.split(':');
    hh = parseInt(h, 10) || 0;
    mm = parseInt(min, 10) || 0;
  }

  const appDate = new Date(y, m, d, hh, mm, 0);
  const now = new Date();

  return (appDate.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * Envía un mensaje genérico de WhatsApp al paciente utilizando el microservicio local,
 * con fallback retroactivo en caso de que el puente local aún tenga la versión anterior.
 * @param {string} phoneNumber - Teléfono del paciente
 * @param {string} message - Texto del mensaje
 * @returns {Promise<boolean>} Retorna true si se entregó al microservicio
 */
export async function sendWhatsAppMessageToPatient(phoneNumber, message) {
  if (!phoneNumber || !message) return false;

  const cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '');
  if (!cleanPhone) return false;

  const state = getAppState();
  const bridgeUrl = detectedWorkingBridgeUrl || (state.clinicInfo && state.clinicInfo.whatsappBridgeUrl) || 'http://127.0.0.1:3001';

  // Intento 1: Endpoint directo /api/send-message
  try {
    const res = await fetch(`${bridgeUrl}/api/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: cleanPhone, message })
    });
    if (res.ok) {
      return true;
    }
  } catch (_) {
    // Si falla o la ruta no existe en el puente local anterior, probar fallback
  }

  // Intento 2: Fallback retroactivo usando /api/notify-doctor con customMessage
  try {
    const fallbackRes = await fetch(`${bridgeUrl}/api/notify-doctor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombreMedico: 'HOSPITAL MULTIMECA SAYAXCHÉ',
        telefonoMedico: cleanPhone,
        nombrePaciente: 'Paciente',
        customMessage: message
      })
    });
    return fallbackRes.ok;
  } catch (err) {
    console.warn('Fallo al enviar mensaje a paciente vía WhatsApp Bridge:', err.message);
    return false;
  }
}

/**
 * Envía el recordatorio oficial de una cita específica de un paciente y guarda el registro en su historial.
 * @param {string} patientId - ID del paciente
 * @param {number} appointmentIndex - Índice de la cita en patient.appointments
 * @returns {Promise<{success: boolean, message: string, logEntry: object}>}
 */
export async function sendSingleAppointmentReminder(patientId, appointmentIndex) {
  const state = getAppState();
  const patient = (state.patients || []).find(p => p.id === patientId);
  if (!patient || !Array.isArray(patient.appointments) || !patient.appointments[appointmentIndex]) {
    throw new Error('Paciente o cita no encontrada.');
  }

  const app = patient.appointments[appointmentIndex];
  const patientPhone = patient.telephone || patient.phone || patient.whatsapp_number;
  if (!patientPhone) {
    throw new Error(`El paciente ${patient.name} no tiene número de teléfono registrado.`);
  }

  const doctorName = app.doctorName || patient.assignedDoctorName || 'Dr. Carlos Mendoza';
  const reminderMessage = formatAppointmentReminderMessage(patient.name, app.date, app.time, doctorName);

  const ok = await sendWhatsAppMessageToPatient(patientPhone, reminderMessage);
  if (!ok) {
    throw new Error('No se pudo enviar el mensaje a través de WhatsApp Web. Verifica que el microservicio esté activo y vinculado.');
  }

  const sentAt = new Date().toISOString();
  app.reminder48hSent = true;
  app.reminder48hSentAt = sentAt;

  if (!Array.isArray(patient.whatsappMessagesLog)) {
    patient.whatsappMessagesLog = [];
  }

  const logEntry = {
    id: `wamsg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    type: 'RECORDATORIO_CITA_48H',
    sentAt: sentAt,
    recipientName: patient.name,
    recipientPhone: patientPhone,
    appointmentDate: app.date,
    appointmentTime: app.time,
    doctorName: doctorName,
    message: reminderMessage,
    status: 'ENVIADO'
  };

  patient.whatsappMessagesLog.unshift(logEntry);
  saveAppState(state);

  return { success: true, message: reminderMessage, logEntry };
}

/**
 * Revisa todas las citas de todos los pacientes en la ventana de 48 horas previas y envía recordatorios automáticos.
 * Lleva un registro en patient.whatsappMessagesLog y marca app.reminder48hSent.
 * @returns {Promise<{sent: number, checked: number}>}
 */
export async function checkAndSend48hAppointmentReminders() {
  const state = getAppState();
  if (!state || !Array.isArray(state.patients)) return { sent: 0, checked: 0 };

  let sentCount = 0;
  let checkedCount = 0;
  let modified = false;

  for (const patient of state.patients) {
    if (!Array.isArray(patient.appointments)) continue;

    for (const app of patient.appointments) {
      checkedCount++;
      if (app.reminder48hSent) continue;

      const diffHours = getAppointmentTimeDiffHours(app.date, app.time);
      // Ventana de 48 horas (entre 0 y 48 horas hacia el futuro)
      if (diffHours !== null && diffHours > 0 && diffHours <= 48) {
        const patientPhone = patient.telephone || patient.phone || patient.whatsapp_number;
        if (!patientPhone) continue;

        const doctorName = app.doctorName || patient.assignedDoctorName || 'Dr. Carlos Mendoza';
        const reminderText = formatAppointmentReminderMessage(patient.name, app.date, app.time, doctorName);

        try {
          const success = await sendWhatsAppMessageToPatient(patientPhone, reminderText);
          if (success) {
            const sentAt = new Date().toISOString();
            app.reminder48hSent = true;
            app.reminder48hSentAt = sentAt;

            if (!Array.isArray(patient.whatsappMessagesLog)) {
              patient.whatsappMessagesLog = [];
            }

            patient.whatsappMessagesLog.unshift({
              id: `wamsg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              type: 'RECORDATORIO_CITA_48H',
              sentAt: sentAt,
              recipientName: patient.name,
              recipientPhone: patientPhone,
              appointmentDate: app.date,
              appointmentTime: app.time,
              doctorName: doctorName,
              message: reminderText,
              status: 'ENVIADO'
            });

            sentCount++;
            modified = true;
            console.log(`✅ [Recordatorio 48h] Enviado a ${patient.name} (${patientPhone}) para cita del ${app.date} ${app.time}`);
          }
        } catch (err) {
          console.warn(`Error al enviar recordatorio a ${patient.name}:`, err.message);
        }
      }
    }
  }

  if (modified) {
    saveAppState(state);
  }

  return { sent: sentCount, checked: checkedCount };
}

