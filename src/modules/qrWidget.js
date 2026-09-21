// src/modules/qrWidget.js
import { generateRotatingToken, getAttendanceScanUrl, renderQRToCanvas } from '../utils/qrAttendance.js';

let widgetTimerInterval = null;
let remainingSeconds = 30;
let isWidgetCollapsed = true; // Por defecto inicia minimizado para NO tapar el menú lateral
let widgetPosition = 'left'; // 'left' o 'right'
let clickOutsideHandler = null;
let escKeyHandler = null;

/**
 * Inicializa el Widget Flotante de QR Dinámico
 */
export function initQrWidget() {
  // Evitar duplicados
  let existingWidget = document.getElementById('lugamed-qr-floating-widget');
  if (existingWidget) {
    existingWidget.remove();
  }
  if (widgetTimerInterval) {
    clearInterval(widgetTimerInterval);
  }

  // Leer estado de minimizado y posición previos
  try {
    const savedCollapsed = localStorage.getItem('lugamed_qr_collapsed');
    // Si no está guardado, por defecto es TRUE (minimizado)
    isWidgetCollapsed = savedCollapsed === null ? true : savedCollapsed === 'true';
    widgetPosition = localStorage.getItem('lugamed_qr_position') || 'left';
  } catch (e) {
    isWidgetCollapsed = true;
    widgetPosition = 'left';
  }

  const widget = document.createElement('div');
  widget.id = 'lugamed-qr-floating-widget';
  applyWidgetPosition(widget);

  document.body.appendChild(widget);

  renderWidgetContent();

  // Iniciar ciclo de temporización y rotación cada segundo
  remainingSeconds = 30;
  widgetTimerInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      remainingSeconds = 30;
      updateQrCode();
    }
    updateTimerDisplay();
  }, 1000);

  // Escuchar tecla Escape para minimizar
  if (escKeyHandler) document.removeEventListener('keydown', escKeyHandler);
  escKeyHandler = (e) => {
    if (e.key === 'Escape' && !isWidgetCollapsed) {
      collapseWidget();
    }
  };
  document.addEventListener('keydown', escKeyHandler);

  // Escuchar clics afuera para auto-minimizar
  if (clickOutsideHandler) document.removeEventListener('click', clickOutsideHandler);
  clickOutsideHandler = (e) => {
    if (isWidgetCollapsed) return;
    const w = document.getElementById('lugamed-qr-floating-widget');
    if (w && !w.contains(e.target)) {
      collapseWidget();
    }
  };
  // Timeout para evitar que el clic inicial que abre el widget lo cierre de inmediato
  setTimeout(() => {
    document.addEventListener('click', clickOutsideHandler);
  }, 200);

  // Render inicial del QR si está expandido
  setTimeout(() => {
    if (!isWidgetCollapsed) {
      updateQrCode();
    }
  }, 100);
}

function applyWidgetPosition(widget) {
  if (!widget) return;
  if (widgetPosition === 'right') {
    widget.style.cssText = `
      position: fixed;
      bottom: 18px;
      right: 18px;
      left: auto;
      z-index: 1100;
      font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    `;
  } else {
    widget.style.cssText = `
      position: fixed;
      bottom: 18px;
      left: 18px;
      right: auto;
      z-index: 1100;
      font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    `;
  }
}

/**
 * Minimiza el widget y guarda la preferencia
 */
export function collapseWidget() {
  isWidgetCollapsed = true;
  try { localStorage.setItem('lugamed_qr_collapsed', 'true'); } catch(e){}
  renderWidgetContent();
}

/**
 * Expande el widget y guarda la preferencia
 */
export function expandWidget() {
  isWidgetCollapsed = false;
  try { localStorage.setItem('lugamed_qr_collapsed', 'false'); } catch(e){}
  renderWidgetContent();
  updateQrCode();
}

/**
 * Remueve el widget flotante (por ejemplo al cerrar sesión)
 */
export function removeQrWidget() {
  if (widgetTimerInterval) {
    clearInterval(widgetTimerInterval);
    widgetTimerInterval = null;
  }
  if (clickOutsideHandler) {
    document.removeEventListener('click', clickOutsideHandler);
    clickOutsideHandler = null;
  }
  if (escKeyHandler) {
    document.removeEventListener('keydown', escKeyHandler);
    escKeyHandler = null;
  }
  const existingWidget = document.getElementById('lugamed-qr-floating-widget');
  if (existingWidget) {
    existingWidget.remove();
  }
}

/**
 * Renderiza la interfaz del widget según su estado (colapsado o expandido)
 */
function renderWidgetContent() {
  const widget = document.getElementById('lugamed-qr-floating-widget');
  if (!widget) return;
  applyWidgetPosition(widget);

  if (isWidgetCollapsed) {
    // Modo Minimizado (Pill flotante ultra-compacto, no invasivo)
    widget.innerHTML = `
      <div id="btn-expand-qr-widget" style="
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid var(--accent-primary, #00f2fe);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35), 0 0 10px rgba(0, 242, 254, 0.2);
        padding: 7px 14px;
        border-radius: 30px;
        color: #ffffff;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 600;
        backdrop-filter: blur(12px);
        user-select: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      " title="Clic para desplegar el Código QR de Asistencia">
        <span style="font-size: 1.1rem; line-height: 1;">📷</span>
        <span style="letter-spacing: 0.3px;">QR Asistencia</span>
        <span id="qr-mini-timer" style="
          background: rgba(0, 242, 254, 0.18);
          color: var(--accent-primary, #00f2fe);
          padding: 2px 7px;
          border-radius: 12px;
          font-family: var(--font-mono, monospace);
          font-size: 0.72rem;
          font-weight: bold;
        ">${remainingSeconds}s</span>
        <span style="color: var(--accent-primary, #00f2fe); font-size: 0.75rem; font-weight: bold;">▲</span>
      </div>
    `;

    const expandBtn = widget.querySelector('#btn-expand-qr-widget');
    if (expandBtn) {
      expandBtn.addEventListener('mouseenter', () => {
        expandBtn.style.transform = 'scale(1.04)';
        expandBtn.style.boxShadow = '0 6px 22px rgba(0, 242, 254, 0.35)';
      });
      expandBtn.addEventListener('mouseleave', () => {
        expandBtn.style.transform = 'scale(1)';
        expandBtn.style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.35), 0 0 10px rgba(0, 242, 254, 0.2)';
      });
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        expandWidget();
      });
    }
  } else {
    // Modo Expandido (Tarjeta emergente flotante completa con botón de Minimizar destacado)
    widget.innerHTML = `
      <div style="
        width: 270px;
        background: rgba(15, 23, 42, 0.98);
        border: 1px solid var(--border-color, rgba(255,255,255,0.18));
        border-top: 3px solid var(--accent-primary, #00f2fe);
        border-radius: 14px;
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 242, 254, 0.2);
        padding: 14px;
        color: var(--text-primary, #f8fafc);
        backdrop-filter: blur(16px);
        animation: fadeInScale 0.2s ease-out;
      ">
        <style>
          @keyframes fadeInScale {
            from { opacity: 0; transform: translateY(10px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        </style>

        <!-- Header con botón Minimizar Claro y Visible -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 1.15rem;">🕒</span>
            <strong style="font-size: 0.82rem; letter-spacing: 0.5px; color: var(--accent-primary, #00f2fe); text-transform: uppercase;">Control de Asistencia</strong>
          </div>
          
          <div style="display: flex; align-items: center; gap: 4px;">
            <button id="btn-toggle-position" title="${widgetPosition === 'left' ? 'Mover a la derecha' : 'Mover a la izquierda'}" style="
              background: rgba(255,255,255,0.06);
              border: 1px solid rgba(255,255,255,0.15);
              color: var(--text-muted, #94a3b8);
              font-size: 0.72rem;
              cursor: pointer;
              padding: 3px 6px;
              border-radius: 4px;
              transition: all 0.2s;
            ">${widgetPosition === 'left' ? '➡️' : '⬅️'}</button>
            
            <button id="btn-collapse-qr-widget" title="Minimizar (no tapar menú)" style="
              background: rgba(239, 68, 68, 0.15);
              border: 1px solid rgba(239, 68, 68, 0.4);
              color: #fca5a5;
              font-size: 0.72rem;
              font-weight: bold;
              cursor: pointer;
              padding: 3px 8px;
              border-radius: 4px;
              display: flex;
              align-items: center;
              gap: 4px;
              transition: all 0.2s;
            ">
              <span>✕</span>
              <span>Minimizar</span>
            </button>
          </div>
        </div>

        <!-- Contenedor del Canvas QR -->
        <div style="
          background: #ffffff;
          padding: 8px;
          border-radius: 8px;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
          margin-bottom: 10px;
        ">
          <canvas id="qr-widget-canvas" style="display: block; max-width: 100%; border-radius: 4px;"></canvas>
        </div>

        <!-- Barra de Progreso y Temporizador -->
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted, #94a3b8); margin-bottom: 4px;">
            <span>Código QR Dinámico</span>
            <span id="qr-widget-timer-text" style="font-family: var(--font-mono, monospace); font-weight: bold; color: var(--accent-primary, #00f2fe);">
              Rota en: ${remainingSeconds}s
            </span>
          </div>
          <div style="width: 100%; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
            <div id="qr-widget-progress-bar" style="
              height: 100%;
              width: ${(remainingSeconds / 30) * 100}%;
              background: linear-gradient(90deg, var(--accent-primary, #00f2fe), #22c55e);
              transition: width 1s linear;
            "></div>
          </div>
        </div>

        <!-- Instrucciones -->
        <p style="
          font-size: 0.7rem;
          color: var(--text-muted, #94a3b8);
          margin: 0 0 10px 0;
          text-align: center;
          line-height: 1.3;
        ">
          📱 Escanea con la cámara de tu smartphone para marcar <strong>Entrada</strong> o <strong>Salida</strong>.
        </p>

        <!-- Botones de Acción -->
        <div style="display: flex; gap: 6px;">
          <button id="btn-copy-qr-link" style="
            flex: 1;
            background: rgba(255,255,255,0.06);
            border: 1px solid var(--border-color, rgba(255,255,255,0.2));
            color: var(--text-primary, #fff);
            padding: 6px 8px;
            border-radius: 6px;
            font-size: 0.72rem;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
          ">🔗 Copiar Enlace</button>
          
          <button id="btn-force-refresh-qr" style="
            background: rgba(0,242,254,0.12);
            border: 1px solid var(--accent-primary, #00f2fe);
            color: var(--accent-primary, #00f2fe);
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 0.72rem;
            cursor: pointer;
            font-weight: bold;
          " title="Refrescar QR ahora">🔄</button>
          
          <button id="btn-footer-collapse" style="
            background: rgba(255,255,255,0.06);
            border: 1px solid var(--border-color, rgba(255,255,255,0.2));
            color: var(--text-muted, #94a3b8);
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 0.72rem;
            cursor: pointer;
          " title="Ocultar">▼</button>
        </div>
      </div>
    `;

    // Listeners del Modo Expandido
    const collapseBtn = widget.querySelector('#btn-collapse-qr-widget');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        collapseWidget();
      });
    }

    const footerCollapseBtn = widget.querySelector('#btn-footer-collapse');
    if (footerCollapseBtn) {
      footerCollapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        collapseWidget();
      });
    }

    const togglePosBtn = widget.querySelector('#btn-toggle-position');
    if (togglePosBtn) {
      togglePosBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        widgetPosition = widgetPosition === 'left' ? 'right' : 'left';
        try { localStorage.setItem('lugamed_qr_position', widgetPosition); } catch(err){}
        applyWidgetPosition(widget);
        renderWidgetContent();
        updateQrCode();
      });
    }

    const copyBtn = widget.querySelector('#btn-copy-qr-link');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const scanUrl = getAttendanceScanUrl();
        navigator.clipboard.writeText(scanUrl).then(() => {
          copyBtn.textContent = '✅ Copiado';
          setTimeout(() => { copyBtn.textContent = '🔗 Copiar Enlace'; }, 2000);
        }).catch(() => {
          prompt('Copia este enlace de marcaje:', scanUrl);
        });
      });
    }

    const refreshBtn = widget.querySelector('#btn-force-refresh-qr');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        remainingSeconds = 30;
        updateQrCode();
        updateTimerDisplay();
      });
    }
  }
}

/**
 * Actualiza el código QR renderizado en el Canvas
 */
function updateQrCode() {
  if (isWidgetCollapsed) return;
  const canvas = document.getElementById('qr-widget-canvas');
  if (!canvas) return;

  const scanUrl = getAttendanceScanUrl();
  renderQRToCanvas(canvas, scanUrl, { width: 210, margin: 1 });
}

/**
 * Actualiza los indicadores numéricos y barra de progreso
 */
function updateTimerDisplay() {
  if (isWidgetCollapsed) {
    const miniTimer = document.getElementById('qr-mini-timer');
    if (miniTimer) {
      miniTimer.textContent = `${remainingSeconds}s`;
    }
  } else {
    const textTimer = document.getElementById('qr-widget-timer-text');
    const progressBar = document.getElementById('qr-widget-progress-bar');
    if (textTimer) {
      textTimer.textContent = `Rota en: ${remainingSeconds}s`;
    }
    if (progressBar) {
      progressBar.style.width = `${(remainingSeconds / 30) * 100}%`;
    }
  }
}
