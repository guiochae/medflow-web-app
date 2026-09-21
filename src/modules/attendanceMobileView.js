// src/modules/attendanceMobileView.js
import { getAppState, saveAppState } from '../main.js';
import { verifyRotatingToken, recordAttendance } from '../utils/qrAttendance.js';
import logoUrl from '../assets/logo.jpg';

/**
 * Renderiza la interfaz móvil perimetral de registro de asistencia
 * @param {HTMLElement} rootContainer - Elemento contenedor (generalmente document.body)
 */
export function renderAttendanceMobileView(rootContainer) {
  // Limpiar estilos del body para diseño móvil nativo y limpio
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.background = '#0b1120';
  document.body.style.color = '#f8fafc';
  document.body.style.minHeight = '100vh';
  document.body.style.display = 'flex';
  document.body.style.flexDirection = 'column';
  document.body.style.alignItems = 'center';
  document.body.style.justifyContent = 'center';

  // 1. Obtener y validar el token de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const tokenValidation = verifyRotatingToken(token);

  if (!tokenValidation.valid) {
    // Pantalla de Token Expirado o Inválido
    rootContainer.innerHTML = `
      <div style="
        width: 90%;
        max-width: 420px;
        margin: 20px auto;
        background: rgba(30, 41, 59, 0.95);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-top: 4px solid #ef4444;
        border-radius: 16px;
        padding: 2rem 1.5rem;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <div style="
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.2rem;
          margin: 0 auto 1.25rem auto;
        ">⚠️</div>

        <h2 style="color: #ef4444; margin: 0 0 0.5rem 0; font-size: 1.35rem;">Código QR Expirado</h2>
        <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem;">
          ${tokenValidation.error || 'El código QR temporal ha caducado o no es válido.'}
        </p>

        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; font-size: 0.82rem; color: #cbd5e1; margin-bottom: 1.5rem; text-align: left; border-left: 3px solid #00f2fe;">
          <strong>¿Qué debes hacer?</strong><br>
          1. Mira la pantalla del consultorio o recepción.<br>
          2. Escanea nuevamente el código QR actual que rota automáticamente.
        </div>

        <div style="font-size: 0.75rem; color: #64748b; font-family: monospace;">
          LUGAMED 2.0 &bull; Control de Asistencia Seguro
        </div>
      </div>
    `;
    return;
  }

  // 2. Pantalla de Marcaje de Asistencia Activa
  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'Hospital Privado Multimédica Sayaxché' };

  rootContainer.innerHTML = `
    <div style="
      width: 92%;
      max-width: 440px;
      margin: 20px auto;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-top: 4px solid #00f2fe;
      border-radius: 20px;
      padding: 1.75rem 1.5rem;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 25px rgba(0, 242, 254, 0.15);
      font-family: system-ui, -apple-system, sans-serif;
      box-sizing: border-box;
    ">
      
      <!-- Encabezado de la Institución -->
      <div style="text-align: center; margin-bottom: 1.25rem;">
        <img src="${logoUrl}" alt="LUGAMED Logo" style="height: 54px; object-fit: contain; margin-bottom: 8px; border-radius: 6px;">
        <h1 style="font-size: 1.15rem; color: #f8fafc; margin: 0; font-weight: 700; letter-spacing: 0.5px;">${clinic.name}</h1>
        <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(0, 242, 254, 0.1); color: #00f2fe; padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-top: 6px;">
          <span>🕒</span> Control de Asistencia del Personal
        </div>
      </div>

      <!-- Reloj Digital en Vivo -->
      <div style="
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px;
        padding: 10px;
        text-align: center;
        margin-bottom: 1.5rem;
      ">
        <div id="mob-live-time" style="font-family: monospace; font-size: 1.75rem; font-weight: 800; color: #00f2fe; letter-spacing: 2px;">
          --:--:--
        </div>
        <div id="mob-live-date" style="font-size: 0.78rem; color: #94a3b8; margin-top: 2px; text-transform: capitalize;">
          --
        </div>
      </div>

      <!-- Contenedor Principal de Formulario o Resultado -->
      <div id="mob-attendance-flow-container">
        
        <form id="mob-attendance-form" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">
              Código Oficial de Empleado:
            </label>
            <div style="position: relative;">
              <input 
                type="text" 
                id="mob-emp-code-input" 
                required 
                placeholder="Ej. EMP-001" 
                maxlength="15"
                autofocus
                autocapitalize="characters"
                style="
                  width: 100%;
                  box-sizing: border-box;
                  padding: 14px 16px;
                  background: rgba(0,0,0,0.4);
                  border: 2px solid rgba(0, 242, 254, 0.3);
                  border-radius: 10px;
                  color: #ffffff;
                  font-size: 1.25rem;
                  font-weight: 700;
                  font-family: monospace;
                  letter-spacing: 1px;
                  text-align: center;
                  outline: none;
                  transition: border-color 0.2s, box-shadow 0.2s;
                "
              >
            </div>
            <span style="font-size: 0.72rem; color: #64748b; margin-top: 4px; display: block; text-align: center;">
              Ingresa el código que recibiste por WhatsApp (ej. EMP-001).
            </span>
          </div>

          <!-- Mensaje de Error si ocurre -->
          <div id="mob-error-banner" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; padding: 10px; border-radius: 8px; font-size: 0.82rem; line-height: 1.4;"></div>

          <!-- Botones de Acción de Marcaje -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px;">
            <button 
              type="button" 
              id="btn-mob-mark-in" 
              style="
                background: linear-gradient(135deg, #16a34a, #22c55e);
                color: #ffffff;
                border: none;
                border-radius: 12px;
                padding: 16px 10px;
                font-size: 0.95rem;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);
                transition: transform 0.1s, opacity 0.2s;
              "
            >
              <span style="font-size: 1.5rem;">🟢</span>
              <span>MARCAR ENTRADA</span>
            </button>

            <button 
              type="button" 
              id="btn-mob-mark-out" 
              style="
                background: linear-gradient(135deg, #dc2626, #ef4444);
                color: #ffffff;
                border: none;
                border-radius: 12px;
                padding: 16px 10px;
                font-size: 0.95rem;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
                transition: transform 0.1s, opacity 0.2s;
              "
            >
              <span style="font-size: 1.5rem;">🔴</span>
              <span>MARCAR SALIDA</span>
            </button>
          </div>
        </form>

      </div>

      <!-- Footer Perimetral Seguro -->
      <div style="margin-top: 1.75rem; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1rem;">
        <span style="font-size: 0.72rem; color: #475569;">
          🔒 Conexión Segura &bull; Registro Perimetral Antifraude
        </span>
      </div>

    </div>
  `;

  // Inicializar reloj digital
  const timeEl = document.getElementById('mob-live-time');
  const dateEl = document.getElementById('mob-live-date');
  const updateClock = () => {
    const now = new Date();
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  };
  updateClock();
  setInterval(updateClock, 1000);

  // Auto-mayúsculas y foco en input
  const inputCode = document.getElementById('mob-emp-code-input');
  const errorBanner = document.getElementById('mob-error-banner');

  if (inputCode) {
    inputCode.addEventListener('input', () => {
      inputCode.value = inputCode.value.toUpperCase();
      if (errorBanner) errorBanner.style.display = 'none';
    });
  }

  // Interceptar submit del formulario para evitar recargas accidentales al presionar Enter en móvil
  const formEl = document.getElementById('mob-attendance-form');
  if (formEl) {
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      handleMarkAction('ENTRADA');
    });
  }

  // Handler de marcaje (Entrada o Salida)
  const handleMarkAction = async (type) => {
    const code = inputCode ? inputCode.value.trim().toUpperCase() : '';
    if (!code) {
      if (errorBanner) {
        errorBanner.textContent = '⚠️ Por favor, ingresa tu código de empleado.';
        errorBanner.style.display = 'block';
      }
      if (inputCode) inputCode.focus();
      return;
    }

    const btnIn = document.getElementById('btn-mob-mark-in');
    const btnOut = document.getElementById('btn-mob-mark-out');
    
    // Guardar contenido original de botones
    const origInHtml = btnIn ? btnIn.innerHTML : '<span style="font-size: 1.5rem;">🟢</span><span>MARCAR ENTRADA</span>';
    const origOutHtml = btnOut ? btnOut.innerHTML : '<span style="font-size: 1.5rem;">🔴</span><span>MARCAR SALIDA</span>';

    if (btnIn) {
      btnIn.disabled = true;
      btnIn.style.opacity = '0.65';
      if (type === 'ENTRADA') {
        btnIn.innerHTML = '<span style="font-size: 1.3rem;">⏳</span><span>REGISTRANDO...</span>';
      }
    }
    if (btnOut) {
      btnOut.disabled = true;
      btnOut.style.opacity = '0.65';
      if (type === 'SALIDA') {
        btnOut.innerHTML = '<span style="font-size: 1.3rem;">⏳</span><span>REGISTRANDO...</span>';
      }
    }

    const restoreButtons = () => {
      if (btnIn) {
        btnIn.disabled = false;
        btnIn.style.opacity = '1';
        btnIn.innerHTML = origInHtml;
      }
      if (btnOut) {
        btnOut.disabled = false;
        btnOut.style.opacity = '1';
        btnOut.innerHTML = origOutHtml;
      }
    };

    // Timeout de seguridad de 6 segundos para evitar bloqueo perpetuo
    const safetyTimeout = setTimeout(() => {
      restoreButtons();
    }, 6000);

    // Detectar IP aproximada o navegador
    const userAgent = navigator.userAgent;

    try {
      const currentState = getAppState();
      const result = await recordAttendance({
        employeeCode: code,
        type: type,
        ipAddress: 'Dispositivo Móvil',
        userAgent: userAgent,
        state: currentState
      });

      clearTimeout(safetyTimeout);

      if (!result.success) {
        if (errorBanner) {
          errorBanner.textContent = result.error || 'Error al procesar el marcaje.';
          errorBanner.style.display = 'block';
        }
        restoreButtons();
        return;
      }

      // Renderizar comprobante exitoso de asistencia
      renderSuccessReceipt(result.record, result.employee);
    } catch (err) {
      clearTimeout(safetyTimeout);
      console.error("Error en marcaje de asistencia:", err);
      if (errorBanner) {
        errorBanner.textContent = 'Error inesperado: ' + (err.message || err);
        errorBanner.style.display = 'block';
      }
      restoreButtons();
    }
  };

  const btnIn = document.getElementById('btn-mob-mark-in');
  const btnOut = document.getElementById('btn-mob-mark-out');
  if (btnIn) btnIn.addEventListener('click', () => handleMarkAction('ENTRADA'));
  if (btnOut) btnOut.addEventListener('click', () => handleMarkAction('SALIDA'));
}

/**
 * Renderiza la pantalla de confirmación exitosa con detalles del colaborador
 */
function renderSuccessReceipt(record, employee) {
  const container = document.getElementById('mob-attendance-flow-container');
  if (!container) return;

  const emp = employee || { name: 'Colaborador LUGAMED', employee_code: 'EMP-S/C', position: 'Personal' };
  const rec = record || { type: 'ENTRADA', status: 'ON_TIME', time_str: new Date().toLocaleTimeString('es-GT') };

  const isEntry = rec.type === 'ENTRADA';
  const isLate = rec.status === 'LATE';

  const statusBadge = isEntry
    ? (isLate 
        ? `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 0.78rem;">⚠️ RETARDO (+${rec.lateMinutes || 0} min)</span>`
        : `<span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 0.78rem;">✅ A TIEMPO</span>`)
    : `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 0.78rem;">🏁 JORNADA FINALIZADA ${rec.hoursWorked ? `(${rec.hoursWorked} hrs)` : ''}</span>`;

  container.innerHTML = `
    <div style="
      background: rgba(34, 197, 94, 0.05);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 16px;
      padding: 1.5rem 1.25rem;
      text-align: center;
      animation: fadeIn 0.3s ease-out;
    ">
      <div style="
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: rgba(34, 197, 94, 0.2);
        color: #22c55e;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        margin: 0 auto 1rem auto;
      ">✓</div>

      <h2 style="color: #22c55e; margin: 0 0 4px 0; font-size: 1.25rem;">¡Marcaje Exitoso!</h2>
      <p style="color: #94a3b8; font-size: 0.82rem; margin: 0 0 1.25rem 0;">Se ha guardado tu registro en el sistema de RRHH.</p>

      <!-- Ficha de Datos Registrados -->
      <div style="
        background: rgba(0,0,0,0.35);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px;
        padding: 14px;
        text-align: left;
        font-size: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 1.25rem;
      ">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px;">
          <span style="color: #94a3b8;">Colaborador:</span>
          <strong style="color: #ffffff; text-align: right;">${emp.name}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px;">
          <span style="color: #94a3b8;">Código:</span>
          <strong style="color: #00f2fe; font-family: monospace;">${emp.employee_code || 'EMP-001'}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px;">
          <span style="color: #94a3b8;">Departamento / Puesto:</span>
          <span style="color: #ffffff;">${emp.position || 'Colaborador'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px;">
          <span style="color: #94a3b8;">Tipo de Marcaje:</span>
          <strong style="color: ${isEntry ? '#22c55e' : '#ef4444'};">${rec.type}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px;">
          <span style="color: #94a3b8;">Hora Registrada:</span>
          <strong style="color: #ffffff; font-family: monospace;">${rec.time_str || new Date().toLocaleTimeString('es-GT')}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px;">
          <span style="color: #94a3b8;">Estado de Puntualidad:</span>
          ${statusBadge}
        </div>
      </div>

      <button 
        type="button" 
        id="btn-mob-new-mark"
        style="
          width: 100%;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.2);
          color: #ffffff;
          padding: 12px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
        "
      >
        🔄 Realizar Otro Marcaje
      </button>
    </div>
  `;

  const btnNew = document.getElementById('btn-mob-new-mark');
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      renderAttendanceMobileView(document.body);
    });
  }
}
