/**
 * Envía una notificación de WhatsApp al médico asignado usando un enlace profundo.
 * @param {string} nombreMedico - Nombre del médico
 * @param {string} telefonoMedico - Teléfono del médico (limpiado de espacios, guiones)
 * @param {string} nombrePaciente - Nombre del paciente
 * @returns {Promise<boolean>} Retorna true si se pudo abrir, false si fue bloqueado
 */
export async function notifyDoctorViaWhatsApp(nombreMedico, telefonoMedico, nombrePaciente) {
  try {
    // 1. Limpieza de formato del número telefónico
    let cleanPhone = String(telefonoMedico || '').replace(/[^0-9]/g, '');

    // Validación del código de área internacional (para Guatemala: longitud de 8 dígitos se le antepone 502)
    if (cleanPhone.length === 8) {
      cleanPhone = '502' + cleanPhone;
    }

    // 2. Limpieza del nombre del médico para remover prefijos si ya existen en el template
    let doctorNameClean = nombreMedico;
    if (doctorNameClean.toLowerCase().startsWith('dr. ') || doctorNameClean.toLowerCase().startsWith('dra. ')) {
      doctorNameClean = doctorNameClean.substring(4);
    } else if (doctorNameClean.toLowerCase().startsWith('dr.') || doctorNameClean.toLowerCase().startsWith('dra.')) {
      doctorNameClean = doctorNameClean.substring(3);
    }

    // 3. Construcción del Mensaje
    const message = `Estimado Dr. ${doctorNameClean}, el paciente ${nombrePaciente} espera por tu atencion en tu consultorio`;
    const encodedMessage = encodeURIComponent(message);

    // 4. Enlace profundo oficial de WhatsApp (wa.me)
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    // 5. Intentar abrir en una nueva pestaña (despierta la app local si está instalada)
    const newWindow = window.open(whatsappUrl, '_blank');

    // 6. Detección de bloqueador de ventanas emergentes (pop-ups)
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      console.warn("La ventana emergente de WhatsApp fue bloqueada por el navegador.");
      showPopupBlockerWarning(whatsappUrl);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error al enviar la notificación de WhatsApp:", error);
    return false;
  }
}

/**
 * Muestra una advertencia visual (toast/alerta) en caso de que el navegador bloquee la ventana emergente.
 * @param {string} url - El enlace de WhatsApp para abrir manualmente
 */
function showPopupBlockerWarning(url) {
  // Crear un contenedor de alerta/toast flotante y elegante en pantalla
  const warningDiv = document.createElement('div');
  warningDiv.id = 'whatsapp-popup-warning';
  warningDiv.style.position = 'fixed';
  warningDiv.style.bottom = '20px';
  warningDiv.style.right = '20px';
  warningDiv.style.zIndex = '99999';
  warningDiv.style.background = 'rgba(23, 23, 37, 0.95)';
  warningDiv.style.border = '1px solid var(--accent-primary)';
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

  warningDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 1.25rem;">⚠️</span>
      <strong style="color: var(--accent-primary); font-size: 0.9rem;">Ventana emergente bloqueada</strong>
    </div>
    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0; line-height: 1.4;">
      El navegador bloqueó la apertura automática de WhatsApp. Puedes enviarlo haciendo clic en el siguiente botón:
    </p>
    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
      <button id="btn-close-wa-warning" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Cerrar</button>
      <a href="${url}" target="_blank" id="btn-open-wa-manual" style="background: var(--accent-primary); border: none; color: white; padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; text-decoration: none; display: inline-block; text-align: center;">Enviar WhatsApp</a>
    </div>
  `;

  // Evitar alertas duplicadas
  const existingWarning = document.getElementById('whatsapp-popup-warning');
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

  // Funciones para cerrar
  const closeBtn = warningDiv.querySelector('#btn-close-wa-warning');
  const manualLink = warningDiv.querySelector('#btn-open-wa-manual');

  const removeWarning = () => {
    warningDiv.style.animation = 'slideIn 0.2s reverse ease-in';
    setTimeout(() => {
      warningDiv.remove();
      styleEl.remove();
    }, 200);
  };

  closeBtn.addEventListener('click', removeWarning);
  manualLink.addEventListener('click', removeWarning);

  // Auto-cerrar después de 12 segundos
  setTimeout(() => {
    if (document.body.contains(warningDiv)) {
      removeWarning();
    }
  }, 12000);
}
