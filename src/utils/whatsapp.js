import { getAppState } from '../main.js';

/**
 * Envía una notificación de WhatsApp al médico asignado de forma asíncrona (fire-and-forget)
 * mediante el microservicio local de whatsapp-bridge en el puerto 3001.
 * @param {string} nombreMedico - Nombre del médico
 * @param {string} telefonoMedico - Teléfono del médico
 * @param {string} nombrePaciente - Nombre del paciente
 * @returns {Promise<boolean>} Retorna true siempre de forma asíncrona
 */
export async function notifyDoctorViaWhatsApp(nombreMedico, telefonoMedico, nombrePaciente) {
  // 1. Limpieza del nombre del médico para remover prefijos si ya existen
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

  // 2. Llamada asíncrona no bloqueante (Fire-and-forget)
  fetch(`${bridgeUrl}/api/notify-doctor`, {
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
    console.log('✅ Notificación enviada exitosamente vía WhatsApp Bridge:', data);
  })
  .catch((error) => {
    console.error('❌ Error al conectar con WhatsApp Bridge:', error);
    // Disparar fallback visual en caso de fallo del microservicio
    showBridgeNotificationWarning(payload, error.message);
  });

  // Retornar de inmediato para evitar bloquear la experiencia del usuario en Medflow
  return true;
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
      No se pudo enviar la notificación automatizada. Verifica que el microservicio de NodeJS esté corriendo en el puerto 3001.
    </p>
    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
      <button id="btn-close-bridge-warning" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Cerrar</button>
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

  const removeWarning = () => {
    warningDiv.style.animation = 'slideIn 0.2s reverse ease-in';
    setTimeout(() => {
      warningDiv.remove();
      styleEl.remove();
    }, 200);
  };

  closeBtn.addEventListener('click', removeWarning);
  manualLink.addEventListener('click', removeWarning);

  // Cierre automático tras 10 segundos
  setTimeout(() => {
    if (document.body.contains(warningDiv)) {
      removeWarning();
    }
  }, 10000);
}
