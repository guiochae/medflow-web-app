// src/modules/qrWidget.js
import { generateRotatingToken, getAttendanceScanUrl, renderQRToCanvas } from '../utils/qrAttendance.js';

let widgetTimerInterval = null;
let currentWindowSeconds = 30;
let remainingSeconds = 30;
let isWidgetCollapsed = false;

/**
 * Inicializa el Widget Flotante de QR Dinámico en la esquina inferior izquierda
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

  // Leer estado de minimizado previo
  try {
    isWidgetCollapsed = localStorage.getItem('lugamed_qr_collapsed') === 'true';
  } catch (e) {
    isWidgetCollapsed = false;
  }

  const widget = document.createElement('div');
  widget.id = 'lugamed-qr-floating-widget';
  widget.style.cssText = `
    position: fixed;
    bottom: 16px;
    left: 16px;
    z-index: 1000;
    font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;

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

  // Render inicial del QR
  setTimeout(() => {
    updateQrCode();
  }, 100);
}

/**
 * Remueve el widget flotante (por ejemplo al cerrar sesión)
 */
export function removeQrWidget() {
  if (widgetTimerInterval) {
    clearInterval(widgetTimerInterval);
    widgetTimerInterval = null;
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

  if (isWidgetCollapsed) {
    // Modo Minimizado (Pill flotante elegante)
    widget.innerHTML = `
      <div id="btn-expand-qr-widget" style="
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid var(--accent-primary, #00f2fe);
        box-shadow: 0 4px 15px rgba(0, 242, 254, 0.25);
        padding: 8px 14px;
        border-radius: 30px;
        color: #fff;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 600;
        backdrop-filter: blur(10px);
        user-select: none;
      ">
        <span style="font-size: 1.1rem;">📷</span>
        <span>QR Asistencia</span>
        <span id="qr-mini-timer" style="
          background: rgba(0, 242, 254, 0.2);
          color: var(--accent-primary, #00f2fe);
          padding: 2px 6px;
          border-radius: 10px;
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
        ">${remainingSeconds}s</span>
        <span style="color: var(--text-muted, #94a3b8); font-size: 0.75rem;">▲</span>
      </div>
    `;

    const expandBtn = widget.querySelector('#btn-expand-qr-widget');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        isWidgetCollapsed = false;
        try { localStorage.setItem('lugamed_qr_collapsed', 'false'); } catch(e){}
        renderWidgetContent();
        updateQrCode();
      });
    }
  } else {
    // Modo Expandido (Tarjeta completa con QR y temporizador)
    widget.innerHTML = `
      <div style="
        width: 260px;
        background: rgba(15, 23, 42, 0.96);
        border: 1px solid var(--border-color, rgba(255,255,255,0.15));
        border-top: 3px solid var(--accent-primary, #00f2fe);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 242, 254, 0.15);
        padding: 14px;
        color: var(--text-primary, #f8fafc);
        backdrop-filter: blur(12px);
      ">
        <!-- Header del Widget -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 1.1rem;">🕒</span>
            <strong style="font-size: 0.82rem; letter-spacing: 0.5px; color: var(--accent-primary, #00f2fe); text-transform: uppercase;">Control de Asistencia</strong>
          </div>
          <button id="btn-collapse-qr-widget" title="Minimizar Widget" style="
            background: transparent;
            border: none;
            color: var(--text-muted, #94a3b8);
            font-size: 1.1rem;
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 4px;
            line-height: 1;
            transition: color 0.2s;
          ">&minus;</button>
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

        <!-- Instrucciones y Acciones -->
        <p style="
          font-size: 0.7rem;
          color: var(--text-muted, #94a3b8);
          margin: 0 0 8px 0;
          text-align: center;
          line-height: 1.3;
        ">
          📱 Escanea con la cámara de tu teléfono móvil para marcar <strong>Entrada</strong> o <strong>Salida</strong>.
        </p>

        <div style="display: flex; gap: 6px;">
          <button id="btn-copy-qr-link" style="
            flex: 1;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border-color, rgba(255,255,255,0.15));
            color: var(--text-primary, #fff);
            padding: 5px;
            border-radius: 4px;
            font-size: 0.7rem;
            cursor: pointer;
            transition: all 0.2s;
          ">🔗 Copiar Enlace</button>
          <button id="btn-force-refresh-qr" style="
            background: rgba(0,242,254,0.1);
            border: 1px solid var(--accent-primary, #00f2fe);
            color: var(--accent-primary, #00f2fe);
            padding: 5px 8px;
            border-radius: 4px;
            font-size: 0.7rem;
            cursor: pointer;
          " title="Refrescar QR ahora">🔄</button>
        </div>
      </div>
    `;

    const collapseBtn = widget.querySelector('#btn-collapse-qr-widget');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        isWidgetCollapsed = true;
        try { localStorage.setItem('lugamed_qr_collapsed', 'true'); } catch(e){}
        renderWidgetContent();
      });
    }

    const copyBtn = widget.querySelector('#btn-copy-qr-link');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const scanUrl = getAttendanceScanUrl();
        navigator.clipboard.writeText(scanUrl).then(() => {
          copyBtn.textContent = '✅ Copiado';
          setTimeout(() => { copyBtn.textContent = '🔗 Copiar Enlace'; }, 2000);
        }).catch(() => {
          prompt('Copia este enlace de marcaje:', scanUrl);
        });
      });
    }

    const refreshBtn = widget.querySelector('#btn-force-force-qr') || widget.querySelector('#btn-force-refresh-qr');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
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
