import QRCode from 'qrcode';
import { getAppState } from '../main.js';

let bridgeStatusCache = {
  online: false,
  isReady: false,
  qr: null,
  lastCheck: 0
};

let statusPollingInterval = null;

/**
 * Consulta el estado actual del microservicio local de WhatsApp.
 * @returns {Promise<{online: boolean, isReady: boolean, qr: string|null}>}
 */
export async function checkWhatsAppBridgeStatus() {
  const state = getAppState();
  const bridgeUrl = (state.clinicInfo && state.clinicInfo.whatsappBridgeUrl) || 'http://localhost:3001';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(`${bridgeUrl}/api/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      bridgeStatusCache = {
        online: true,
        isReady: !!data.isReady,
        qr: data.qr || null,
        lastCheck: Date.now()
      };
      return bridgeStatusCache;
    } else {
      bridgeStatusCache = { online: false, isReady: false, qr: null, lastCheck: Date.now() };
      return bridgeStatusCache;
    }
  } catch (err) {
    bridgeStatusCache = { online: false, isReady: false, qr: null, lastCheck: Date.now() };
    return bridgeStatusCache;
  }
}

/**
 * Dispara el protocolo registrado en Windows (lugamed-bridge://start) para
 * iniciar silenciosamente el microservicio de WhatsApp si no estaba corriendo.
 */
export function triggerLaunchWhatsAppBridge() {
  console.log("🚀 Disparando inicio automático de WhatsApp Bridge vía protocolo Windows...");
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'lugamed-bridge://start';
    document.body.appendChild(iframe);
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        iframe.remove();
      }
    }, 2500);
  } catch (err) {
    console.warn("Aviso al invocar protocolo lugamed-bridge:", err);
  }
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
 * Si el microservicio está apagado, intenta iniciarlo automáticamente y reintentar.
 * @param {string} nombreMedico - Nombre del médico
 * @param {string} telefonoMedico - Teléfono del médico
 * @param {string} nombrePaciente - Nombre del paciente
 * @param {boolean} isRetry - Indica si ya es un reintento
 * @returns {Promise<boolean>} Retorna true de forma no bloqueante
 */
export async function notifyDoctorViaWhatsApp(nombreMedico, telefonoMedico, nombrePaciente, isRetry = false) {
  let doctorNameClean = nombreMedico;
  if (doctorNameClean.toLowerCase().startsWith('dr. ') || doctorNameClean.toLowerCase().startsWith('dra. ')) {
    doctorNameClean = doctorNameClean.substring(4);
  } else if (doctorNameClean.toLowerCase().startsWith('dr.') || doctorNameClean.toLowerCase().startsWith('dra.')) {
    doctorNameClean = doctorNameClean.substring(3);
  }

  const payload = {
    nombreMedico: doctorNameClean,
    telefonoMedico: telefonoMedico,
    nombrePaciente: nombrePaciente
  };

  const state = getAppState();
  const bridgeUrl = (state.clinicInfo && state.clinicInfo.whatsappBridgeUrl) || 'http://localhost:3001';

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
      return notifyDoctorViaWhatsApp(nombreMedico, telefonoMedico, nombrePaciente, true);
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
      <button id="btn-start-bridge-now" style="background: var(--accent-primary); border: none; color: white; padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">🚀 Iniciar Puente</button>
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
  const startBridgeBtn = warningDiv.querySelector('#btn-start-bridge-now');

  const removeWarning = () => {
    warningDiv.style.animation = 'slideIn 0.2s reverse ease-in';
    setTimeout(() => {
      warningDiv.remove();
      styleEl.remove();
    }, 200);
  };

  closeBtn.addEventListener('click', removeWarning);
  manualLink.addEventListener('click', removeWarning);
  if (startBridgeBtn) {
    startBridgeBtn.addEventListener('click', async () => {
      startBridgeBtn.disabled = true;
      startBridgeBtn.textContent = 'Iniciando...';
      triggerLaunchWhatsAppBridge();
      await new Promise(r => setTimeout(r, 2500));
      removeWarning();
      notifyDoctorViaWhatsApp(payload.nombreMedico, payload.telefonoMedico, payload.nombrePaciente);
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
 * Muestra el modal con código QR para vincular WhatsApp Web directamente en la pantalla de Medflow.
 * @param {string} qrData - Cadena de datos del código QR de whatsapp-web.js
 */
export function showWhatsAppQrModal(qrData) {
  const existingModal = document.getElementById('whatsapp-qr-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'whatsapp-qr-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.zIndex = '999999';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.background = 'rgba(0, 0, 0, 0.75)';
  modal.style.backdropFilter = 'blur(6px)';

  modal.innerHTML = `
    <div class="glass-card" style="background: #181826; border: 1px solid var(--accent-primary); border-radius: 12px; padding: 24px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 15px 35px rgba(0,0,0,0.6);">
      <div style="font-size: 2.2rem; margin-bottom: 8px;">📲</div>
      <h3 style="margin: 0 0 8px 0; color: var(--text-primary); font-family: var(--font-heading);">Vincular WhatsApp de Recepción</h3>
      <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; margin: 0 0 16px 0;">
        Abre <strong>WhatsApp</strong> en el celular de recepción:<br>
        <strong>Ajustes ➔ Dispositivos vinculados ➔ Vincular un dispositivo</strong><br>
        y escanea este código QR en pantalla:
      </p>
      
      <div style="background: white; padding: 12px; border-radius: 8px; display: inline-block; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        <canvas id="wa-qr-canvas" style="display: block;"></canvas>
      </div>

      <div id="wa-qr-status" style="font-size: 0.8rem; color: #eab308; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <span>⏳</span> Esperando escaneo del código...
      </div>

      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="btn-close-wa-qr" style="background: rgba(255,255,255,0.08); border: 1px solid var(--border-color); color: var(--text-muted); padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; cursor: pointer;">Cerrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const canvas = modal.querySelector('#wa-qr-canvas');
  if (canvas && qrData) {
    QRCode.toCanvas(canvas, qrData, { width: 220, margin: 1 }, (err) => {
      if (err) console.error("Error al renderizar código QR en canvas:", err);
    });
  }

  const closeBtn = modal.querySelector('#btn-close-wa-qr');
  if (closeBtn) closeBtn.onclick = () => modal.remove();

  // Sondeo cada 2 segundos hasta que se complete la vinculación
  const qrCheckInterval = setInterval(async () => {
    if (!document.body.contains(modal)) {
      clearInterval(qrCheckInterval);
      return;
    }
    const status = await checkWhatsAppBridgeStatus();
    if (status.isReady) {
      clearInterval(qrCheckInterval);
      const stEl = modal.querySelector('#wa-qr-status');
      if (stEl) {
        stEl.style.color = '#22c55e';
        stEl.innerHTML = '✅ ¡WhatsApp Vinculado Exitosamente!';
      }
      setTimeout(() => {
        if (document.body.contains(modal)) modal.remove();
        updateWhatsAppPillUI({ online: true, isReady: true, qr: null });
      }, 1500);
    } else if (status.qr && status.qr !== qrData) {
      qrData = status.qr;
      if (canvas) {
        QRCode.toCanvas(canvas, qrData, { width: 220, margin: 1 });
      }
    }
  }, 2000);
}

/**
 * Inicializa el monitoreo y el indicador de estado de WhatsApp para el rol de RECEPCIONISTA.
 * @param {Object} currentUser - Usuario autenticado
 */
export function initWhatsAppReceptionistBridge(currentUser) {
  if (!currentUser) return;
  const roleLower = String(currentUser.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isReceptionist = roleLower.includes('recepcionista') || roleLower.includes('recep') || roleLower.includes('admin') || roleLower.includes('administrador');
  if (!isReceptionist) return;

  // 1. Inyectar estilos para el pill de WhatsApp si no existen
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

  // 2. Colocar el pill en el sidebar debajo de la información del usuario
  const sidebarUser = document.getElementById('sidebar-user-container');
  if (sidebarUser) {
    let pillContainer = document.getElementById('whatsapp-sidebar-status-container');
    if (!pillContainer) {
      pillContainer = document.createElement('div');
      pillContainer.id = 'whatsapp-sidebar-status-container';
      sidebarUser.insertAdjacentElement('afterend', pillContainer);
    }
  }

  // 3. Iniciar comprobación y auto-arranque si está offline
  ensureWhatsAppBridgeRunning().then(status => {
    updateWhatsAppPillUI(status);
  });

  // 4. Polling periódico cada 15 segundos
  if (statusPollingInterval) clearInterval(statusPollingInterval);
  statusPollingInterval = setInterval(async () => {
    const status = await checkWhatsAppBridgeStatus();
    updateWhatsAppPillUI(status);
  }, 15000);
}

/**
 * Actualiza visualmente el badge de estado de WhatsApp en el sidebar.
 * @param {Object} status - Estado devuelto por checkWhatsAppBridgeStatus
 */
export function updateWhatsAppPillUI(status) {
  const container = document.getElementById('whatsapp-sidebar-status-container');
  if (!container) return;

  let stateClass = 'offline';
  let dotClass = 'offline';
  let labelText = 'WhatsApp Inactivo (Iniciar)';
  let tooltipText = 'El puente de WhatsApp no está activo. Haz clic para iniciarlo automáticamente.';

  if (status.online) {
    if (status.isReady) {
      stateClass = 'online';
      dotClass = 'online';
      labelText = 'WhatsApp Activo';
      tooltipText = 'Puente conectado. Los mensajes a médicos se enviarán de forma automática.';
    } else if (status.qr) {
      stateClass = 'qr-needed';
      dotClass = 'qr-needed';
      labelText = 'Vincular WhatsApp (QR)';
      tooltipText = 'Se requiere escanear el código QR para vincular WhatsApp Web. Clic para escanear.';
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
      if (status.online && status.qr && !status.isReady) {
        showWhatsAppQrModal(status.qr);
      } else if (!status.online) {
        pill.className = 'whatsapp-status-pill connecting';
        pill.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="wa-indicator-dot connecting"></span>
            <span>Iniciando puente...</span>
          </div>
        `;
        triggerLaunchWhatsAppBridge();
        await new Promise(r => setTimeout(r, 2000));
        const newSt = await checkWhatsAppBridgeStatus();
        updateWhatsAppPillUI(newSt);
        if (newSt.online && newSt.qr && !newSt.isReady) {
          showWhatsAppQrModal(newSt.qr);
        }
      } else if (status.isReady) {
        alert("✅ Microservicio de WhatsApp Bridge Activo y Conectado.\n\nLos mensajes automáticos a los médicos asignados se enviarán inmediatamente desde esta computadora.");
      }
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
  const bridgeUrl = (state.clinicInfo && state.clinicInfo.whatsappBridgeUrl) || 'http://localhost:3001';

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

