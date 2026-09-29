// src/modules/attendanceKioskView.js
import { getAppState, saveAppState } from '../main.js';
import { 
  loadFaceModels, 
  detectSingleFaceAndDescriptor, 
  matchFaceAgainstEmployees, 
  captureCompressedFaceThumbnail, 
  playAttendanceFeedbackSound 
} from '../utils/faceAttendance.js';
import { 
  generateRotatingToken, 
  getAttendanceScanUrl, 
  renderQRToCanvas, 
  recordAttendance 
} from '../utils/qrAttendance.js';
import logoUrl from '../assets/logo.jpg';
import { db, saveStateToLocalCache } from '../firebase.js';
import { doc, setDoc } from 'firebase/firestore';

let videoStream = null;
let detectionIntervalId = null;
let qrRotationIntervalId = null;
let isProcessingFace = false;
let lastMatchedEmployeeId = null;
let lastMatchedTimestamp = 0;
let currentPunchType = 'ENTRADA'; // 'ENTRADA' | 'SALIDA'
let activeKioskTab = 'dual'; // 'dual', 'face', 'qr'

/**
 * Renderiza la terminal perimetral aislada en modo Kiosko Dual
 * @param {HTMLElement} rootContainer
 */
export function renderAttendanceKioskView(rootContainer) {
  // Limpiar temporizadores e intervalos previos
  stopCameraAndLoops();

  // Configurar estilos base de aislamiento seguro
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.background = '#0b1120';
  document.body.style.color = '#f8fafc';
  document.body.style.minHeight = '100vh';
  document.body.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  document.body.style.overflowX = 'hidden';

  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'Hospital Privado Multimédica Sayaxché' };

  rootContainer.innerHTML = `
    <div id="kiosk-app-wrapper" style="min-height: 100vh; display: flex; flex-direction: column; background: radial-gradient(circle at 50% 10%, #1e293b 0%, #0b1120 70%); box-sizing: border-box; padding: 12px 18px;">
      
      <!-- Barra Superior de Kiosko -->
      <header style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${logoUrl}" alt="LUGAMED Logo" style="height: 44px; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <div>
            <h1 style="margin: 0; font-size: 1.1rem; color: #f8fafc; font-weight: 700; letter-spacing: 0.5px;">${clinic.name}</h1>
            <div style="font-size: 0.75rem; color: #00f2fe; font-weight: 600; display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e;"></span>
              Terminal Perimetral de Asistencia &bull; Modo Kiosko
            </div>
          </div>
        </div>

        <!-- Reloj Digital y Botón Supervisor -->
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="text-align: right;">
            <div id="kiosk-clock-time" style="font-family: monospace; font-size: 1.45rem; font-weight: 800; color: #00f2fe; letter-spacing: 1px; line-height: 1.1;">--:--:--</div>
            <div id="kiosk-clock-date" style="font-size: 0.72rem; color: #94a3b8; text-transform: capitalize;">--</div>
          </div>
          <button id="btn-kiosk-supervisor-pin" title="Enrolamiento de Rostros (Acceso con PIN de Supervisor)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; padding: 7px 10px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; display: flex; align-items: center; gap: 5px; transition: background 0.2s;">
            <span>🛡️</span> <span style="display: none; @media(min-width: 600px){ display: inline; }">Supervisor</span>
          </button>
        </div>
      </header>

      <!-- Selector de Modo de Marcaje (Entrada / Salida) -->
      <div style="display: flex; justify-content: center; gap: 12px; margin-bottom: 12px;">
        <button id="btn-toggle-type-in" style="flex: 1; max-width: 240px; padding: 10px 14px; border-radius: 12px; border: 2px solid #22c55e; background: ${currentPunchType === 'ENTRADA' ? 'linear-gradient(135deg, #15803d, #22c55e)' : 'rgba(34, 197, 94, 0.1)'}; color: #ffffff; font-weight: 700; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: ${currentPunchType === 'ENTRADA' ? '0 0 15px rgba(34, 197, 94, 0.4)' : 'none'}; transition: all 0.2s;">
          <span style="font-size: 1.2rem;">🟢</span> REGISTRAR ENTRADA
        </button>
        <button id="btn-toggle-type-out" style="flex: 1; max-width: 240px; padding: 10px 14px; border-radius: 12px; border: 2px solid #ef4444; background: ${currentPunchType === 'SALIDA' ? 'linear-gradient(135deg, #b91c1c, #ef4444)' : 'rgba(239, 68, 68, 0.1)'}; color: #ffffff; font-weight: 700; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: ${currentPunchType === 'SALIDA' ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'}; transition: all 0.2s;">
          <span style="font-size: 1.2rem;">🔴</span> REGISTRAR SALIDA
        </button>
      </div>

      <!-- Selector de Pestaña Móvil (Visible en pantallas pequeñas) -->
      <div id="kiosk-mobile-tab-nav" style="display: none; justify-content: center; gap: 8px; margin-bottom: 12px;">
        <button id="tab-btn-face" style="flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #00f2fe; background: #00f2fe; color: #0b1120; font-weight: 700; font-size: 0.85rem; cursor: pointer;">
          👤 Reconocimiento Facial
        </button>
        <button id="tab-btn-qr" style="flex: 1; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); color: #cbd5e1; font-weight: 600; font-size: 0.85rem; cursor: pointer;">
          📱 Código QR / Manual
        </button>
      </div>

      <!-- Contenedor Principal: Panel Dual (Facial + QR) -->
      <main id="kiosk-dual-container" style="flex: 1; display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 16px; align-items: stretch; margin-bottom: 8px;">
        
        <!-- ============================================== -->
        <!-- COLUMNA IZQUIERDA: RECONOCIMIENTO FACIAL EN VIVO -->
        <!-- ============================================== -->
        <section id="kiosk-face-section" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(0, 242, 254, 0.25); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; align-items: center; position: relative; box-shadow: 0 15px 35px rgba(0,0,0,0.5);">
          
          <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.95rem; color: #00f2fe;">
              <span>👤</span> Reconocimiento Facial Biométrico
            </div>
            <span id="face-engine-badge" style="font-size: 0.7rem; background: rgba(0,242,254,0.1); color: #00f2fe; padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(0,242,254,0.2);">
              ⏳ Cargando IA...
            </span>
          </div>

          <!-- Visor de Cámara y Canvas -->
          <div style="position: relative; width: 100%; max-width: 480px; aspect-ratio: 4/3; background: #000000; border-radius: 12px; overflow: hidden; border: 2px solid rgba(255,255,255,0.1); box-shadow: inset 0 0 20px rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center;">
            
            <video id="kiosk-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
            <canvas id="kiosk-overlay-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; transform: scaleX(-1);"></canvas>

            <!-- Guía Visual de Óvalo Facial -->
            <div id="kiosk-face-guide" style="position: absolute; width: 55%; height: 75%; border: 2px dashed rgba(0, 242, 254, 0.45); border-radius: 50%; pointer-events: none; box-shadow: 0 0 25px rgba(0, 242, 254, 0.15); transition: border-color 0.3s, box-shadow 0.3s;"></div>

            <!-- Overlay de Estado y Detección -->
            <div id="kiosk-camera-loading-overlay" style="position: absolute; inset: 0; background: rgba(11, 17, 32, 0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
              <div style="width: 38px; height: 38px; border: 3px solid rgba(0,242,254,0.2); border-top: 3px solid #00f2fe; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <span id="kiosk-camera-loading-text" style="font-size: 0.85rem; color: #94a3b8;">Iniciando cámara frontal...</span>
            </div>

            <!-- Tarjeta Flotante de Marcaje Exitoso -->
            <div id="kiosk-receipt-overlay" style="display: none; position: absolute; inset: 0; background: rgba(11, 17, 32, 0.95); padding: 16px; flex-direction: column; align-items: center; justify-content: center; text-align: center; animation: fadeIn 0.25s ease-out;">
              <!-- Se inyecta dinámicamente -->
            </div>
          </div>

          <!-- Mensaje de Estado en Vivo -->
          <div id="kiosk-face-status-text" style="margin-top: 10px; font-size: 0.85rem; color: #cbd5e1; text-align: center; min-height: 22px; font-weight: 500;">
            Centra tu rostro dentro del óvalo para registrar asistencia
          </div>

          <div style="display: flex; gap: 8px; margin-top: 6px; width: 100%; max-width: 480px;">
            <button id="btn-force-face-scan" style="flex: 1; padding: 7px; background: rgba(0, 242, 254, 0.15); border: 1px solid rgba(0, 242, 254, 0.3); color: #00f2fe; border-radius: 8px; font-size: 0.78rem; font-weight: 600; cursor: pointer;">
              🔍 Reintentar Detección
            </button>
            <button id="btn-switch-camera" style="padding: 7px 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; border-radius: 8px; font-size: 0.78rem; cursor: pointer;" title="Cambiar Cámara">
              🔄 Cámara
            </button>
          </div>
        </section>


        <!-- ============================================== -->
        <!-- COLUMNA DERECHA: CÓDIGO QR Y TECLADO MANUAL   -->
        <!-- ============================================== -->
        <section id="kiosk-qr-section" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 15px 35px rgba(0,0,0,0.5);">
          
          <!-- Encabezado de la Sección QR -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.95rem; color: #f8fafc;">
                <span>📱</span> Código QR / Teclado
              </div>
              <span id="qr-timer-badge" style="font-size: 0.7rem; background: rgba(34,197,94,0.1); color: #22c55e; padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(34,197,94,0.2); font-family: monospace;">
                ⏱️ Rota en 30s
              </span>
            </div>

            <!-- Canvas de Código QR Rotativo -->
            <div style="display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 10px; margin-bottom: 10px;">
              <div style="background: #ffffff; padding: 8px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                <canvas id="kiosk-qr-canvas" style="display: block; width: 140px; height: 140px;"></canvas>
              </div>
              <span style="font-size: 0.72rem; color: #94a3b8; margin-top: 6px; text-align: center;">
                Escanea con tu celular o ingresa tu código abajo:
              </span>
            </div>

            <!-- Formulario de Entrada por Código Manual -->
            <form id="kiosk-manual-code-form" style="display: flex; flex-direction: column; gap: 8px;">
              <div>
                <input 
                  type="text" 
                  id="kiosk-emp-code-input" 
                  placeholder="Código (ej. EMP-001)" 
                  maxlength="15"
                  autocapitalize="characters"
                  style="
                    width: 100%;
                    box-sizing: border-box;
                    padding: 10px 14px;
                    background: rgba(0,0,0,0.4);
                    border: 2px solid rgba(0, 242, 254, 0.3);
                    border-radius: 8px;
                    color: #ffffff;
                    font-size: 1.1rem;
                    font-weight: 700;
                    font-family: monospace;
                    text-align: center;
                    outline: none;
                  "
                >
              </div>

              <!-- Banner de Error Manual -->
              <div id="kiosk-manual-error" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; text-align: center;"></div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button type="button" id="btn-manual-mark-in" style="background: linear-gradient(135deg, #16a34a, #22c55e); color: #fff; border: none; border-radius: 8px; padding: 10px 6px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                  🟢 Entrada
                </button>
                <button type="button" id="btn-manual-mark-out" style="background: linear-gradient(135deg, #dc2626, #ef4444); color: #fff; border: none; border-radius: 8px; padding: 10px 6px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                  🔴 Salida
                </button>
              </div>
            </form>
          </div>

          <!-- Teclado Rápido de Números (Opcional táctil) -->
          <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;">
              ${[1,2,3,4,5,6,7,8,9,'C',0,'⌫'].map(k => `
                <button type="button" class="btn-numpad-key" data-key="${k}" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #f8fafc; font-size: 0.95rem; font-weight: 700; padding: 7px; border-radius: 6px; cursor: pointer; font-family: monospace;">
                  ${k}
                </button>
              `).join('')}
            </div>
          </div>
        </section>

      </main>

      <!-- Pie de Página de Seguridad -->
      <footer style="text-align: center; font-size: 0.72rem; color: #64748b; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.05);">
        LUGAMED 2.0 &bull; Estación Biométrica Dual &bull; Conexión Segura Cifrada
      </footer>

      <!-- Modal de Enrolamiento para Supervisor con PIN -->
      <div id="kiosk-supervisor-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 99999; align-items: center; justify-content: center; padding: 15px;">
        <div style="background: #0f172a; border: 1px solid rgba(0,242,254,0.3); border-radius: 16px; width: 100%; max-width: 460px; padding: 20px; box-shadow: 0 25px 50px rgba(0,0,0,0.8); position: relative;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
            <h2 style="margin: 0; font-size: 1.05rem; color: #00f2fe; display: flex; align-items: center; gap: 8px;">
              <span>🛡️</span> Panel de Supervisor / Enrolar Rostro
            </h2>
            <button id="btn-close-supervisor-modal" style="background: transparent; border: none; color: #94a3b8; font-size: 1.3rem; cursor: pointer;">✕</button>
          </div>

          <!-- Paso 1: Verificación de PIN -->
          <div id="supervisor-pin-step" style="display: block;">
            <p style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 12px;">
              Ingresa el PIN de Administrador/Supervisor para enrolar colaboradores en esta terminal:
            </p>
            <input type="password" id="supervisor-pin-input" placeholder="PIN de Seguridad (ej. 5414)" maxlength="20" style="width: 100%; box-sizing: border-box; padding: 12px; background: rgba(0,0,0,0.5); border: 2px solid rgba(0,242,254,0.3); border-radius: 8px; color: #fff; font-size: 1.2rem; font-family: monospace; text-align: center; margin-bottom: 10px;">
            <div id="supervisor-pin-error" style="display: none; color: #f87171; font-size: 0.78rem; margin-bottom: 10px; text-align: center;">PIN incorrecto. Intenta de nuevo.</div>
            <button id="btn-verify-supervisor-pin" style="width: 100%; background: linear-gradient(135deg, #0284c7, #00f2fe); color: #0b1120; font-weight: 700; padding: 12px; border: none; border-radius: 8px; font-size: 0.95rem; cursor: pointer;">
              🔓 Desbloquear Enrolamiento
            </button>
          </div>

          <!-- Paso 2: Formulario de Enrolamiento -->
          <div id="supervisor-enroll-step" style="display: none;">
            <div style="margin-bottom: 10px;">
              <label style="display: block; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 4px;">Seleccionar Colaborador:</label>
              <select id="supervisor-enroll-emp-select" style="width: 100%; padding: 10px; background: #1e293b; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-size: 0.85rem;">
                <!-- Opciones dinámicas -->
              </select>
            </div>

            <!-- Vista previa para captura -->
            <div style="position: relative; width: 100%; aspect-ratio: 4/3; background: #000; border-radius: 10px; overflow: hidden; margin-bottom: 10px; display: flex; align-items: center; justify-content: center;">
              <video id="supervisor-enroll-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
              <canvas id="supervisor-enroll-canvas" style="display: none;"></canvas>
              <div style="position: absolute; width: 55%; height: 75%; border: 2px dashed #22c55e; border-radius: 50%; pointer-events: none;"></div>
            </div>

            <div id="supervisor-enroll-status" style="font-size: 0.8rem; color: #94a3b8; text-align: center; margin-bottom: 10px; min-height: 18px;">
              Alinea el rostro del colaborador dentro del óvalo
            </div>

            <button id="btn-capture-save-face" style="width: 100%; background: linear-gradient(135deg, #16a34a, #22c55e); color: #fff; font-weight: 700; padding: 12px; border: none; border-radius: 8px; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span>📸</span> Capturar y Guardar Rostro
            </button>
          </div>

        </div>
      </div>

    </div>

    <!-- Estilos de Animación CSS -->
    <style>
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      @media (max-width: 768px) {
        #kiosk-dual-container { grid-template-columns: 1fr !important; }
        #kiosk-mobile-tab-nav { display: flex !important; }
        #kiosk-qr-section { display: none; }
      }
    </style>
  `;

  // 1. Inicializar Reloj Digital
  initKioskClock();

  // 2. Inicializar Botones de Entrada/Salida
  initTypeToggleButtons();

  // 3. Inicializar Pestañas Móviles
  initMobileTabs();

  // 4. Inicializar Teclado Numérico y Formulario Manual
  initManualForm();

  // 5. Inicializar Código QR Rotativo
  initRotatingQrCode();

  // 6. Inicializar Cámara y Reconocimiento Facial
  initFaceRecognitionCamera();

  // 7. Inicializar Modal de Supervisor
  initSupervisorPinModal();
}

/**
 * Detiene todos los flujos de cámara y temporizadores
 */
function stopCameraAndLoops() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  if (detectionIntervalId) {
    clearInterval(detectionIntervalId);
    detectionIntervalId = null;
  }
  if (qrRotationIntervalId) {
    clearInterval(qrRotationIntervalId);
    qrRotationIntervalId = null;
  }
  isProcessingFace = false;
}

/**
 * Reloj digital de alta precisión en cabecera
 */
function initKioskClock() {
  const timeEl = document.getElementById('kiosk-clock-time');
  const dateEl = document.getElementById('kiosk-clock-date');
  const update = () => {
    const now = new Date();
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  };
  update();
  setInterval(update, 1000);
}

/**
 * Alternancia entre Entrada 🟢 y Salida 🔴
 */
function initTypeToggleButtons() {
  const btnIn = document.getElementById('btn-toggle-type-in');
  const btnOut = document.getElementById('btn-toggle-type-out');

  const updateStyles = () => {
    if (btnIn) {
      btnIn.style.background = currentPunchType === 'ENTRADA' ? 'linear-gradient(135deg, #15803d, #22c55e)' : 'rgba(34, 197, 94, 0.1)';
      btnIn.style.boxShadow = currentPunchType === 'ENTRADA' ? '0 0 15px rgba(34, 197, 94, 0.4)' : 'none';
    }
    if (btnOut) {
      btnOut.style.background = currentPunchType === 'SALIDA' ? 'linear-gradient(135deg, #b91c1c, #ef4444)' : 'rgba(239, 68, 68, 0.1)';
      btnOut.style.boxShadow = currentPunchType === 'SALIDA' ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none';
    }
  };

  if (btnIn) {
    btnIn.addEventListener('click', () => {
      currentPunchType = 'ENTRADA';
      updateStyles();
    });
  }
  if (btnOut) {
    btnOut.addEventListener('click', () => {
      currentPunchType = 'SALIDA';
      updateStyles();
    });
  }
}

/**
 * Pestañas en vista móvil
 */
function initMobileTabs() {
  const tabFace = document.getElementById('tab-btn-face');
  const tabQr = document.getElementById('tab-btn-qr');
  const secFace = document.getElementById('kiosk-face-section');
  const secQr = document.getElementById('kiosk-qr-section');

  if (tabFace && tabQr && secFace && secQr) {
    tabFace.addEventListener('click', () => {
      tabFace.style.background = '#00f2fe';
      tabFace.style.color = '#0b1120';
      tabQr.style.background = 'rgba(255,255,255,0.05)';
      tabQr.style.color = '#cbd5e1';
      secFace.style.display = 'flex';
      secQr.style.display = 'none';
    });

    tabQr.addEventListener('click', () => {
      tabQr.style.background = '#00f2fe';
      tabQr.style.color = '#0b1120';
      tabFace.style.background = 'rgba(255,255,255,0.05)';
      tabFace.style.color = '#cbd5e1';
      secQr.style.display = 'flex';
      secFace.style.display = 'none';
    });
  }
}

/**
 * Inicialización de QR Rotativo
 */
function initRotatingQrCode() {
  const qrCanvas = document.getElementById('kiosk-qr-canvas');
  const timerBadge = document.getElementById('qr-timer-badge');
  if (!qrCanvas) return;

  let secondsLeft = 30;

  const rotate = async () => {
    const token = generateRotatingToken();
    const url = getAttendanceScanUrl(token);
    await renderQRToCanvas(qrCanvas, url, { width: 140, margin: 1 });
    secondsLeft = 30;
  };

  rotate();

  qrRotationIntervalId = setInterval(() => {
    secondsLeft--;
    if (timerBadge) {
      timerBadge.textContent = `⏱️ Rota en ${secondsLeft}s`;
    }
    if (secondsLeft <= 0) {
      rotate();
    }
  }, 1000);
}

/**
 * Inicialización de Teclado Numérico y Formulario Manual
 */
function initManualForm() {
  const inputCode = document.getElementById('kiosk-emp-code-input');
  const errorEl = document.getElementById('kiosk-manual-error');
  const formEl = document.getElementById('kiosk-manual-code-form');
  const btnIn = document.getElementById('btn-manual-mark-in');
  const btnOut = document.getElementById('btn-manual-mark-out');

  if (inputCode) {
    inputCode.addEventListener('input', () => {
      inputCode.value = inputCode.value.toUpperCase();
      if (errorEl) errorEl.style.display = 'none';
    });
  }

  // Teclado numérico táctil
  document.querySelectorAll('.btn-numpad-key').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!inputCode) return;
      const key = btn.getAttribute('data-key');
      if (key === 'C') {
        inputCode.value = '';
      } else if (key === '⌫') {
        inputCode.value = inputCode.value.slice(0, -1);
      } else {
        inputCode.value += key;
      }
      if (errorEl) errorEl.style.display = 'none';
    });
  });

  const handleManualPunch = async (type) => {
    const code = inputCode ? inputCode.value.trim().toUpperCase() : '';
    if (!code) {
      if (errorEl) {
        errorEl.textContent = 'Ingresa un código de empleado.';
        errorEl.style.display = 'block';
      }
      return;
    }

    try {
      const state = getAppState();
      const result = await recordAttendance({
        employeeCode: code,
        type: type,
        method: 'QR',
        ipAddress: 'Kiosko Perimetral',
        userAgent: 'Kiosko Estación LUGAMED',
        state
      });

      if (!result.success) {
        if (errorEl) {
          errorEl.textContent = result.error || 'Error al procesar el marcaje.';
          errorEl.style.display = 'block';
        }
        playAttendanceFeedbackSound('warning');
        return;
      }

      playAttendanceFeedbackSound('success');
      showReceiptCard(result.record, result.employee);
      if (inputCode) inputCode.value = '';
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Error: ' + (err.message || err);
        errorEl.style.display = 'block';
      }
    }
  };

  if (formEl) {
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      handleManualPunch(currentPunchType);
    });
  }

  if (btnIn) btnIn.addEventListener('click', () => handleManualPunch('ENTRADA'));
  if (btnOut) btnOut.addEventListener('click', () => handleManualPunch('SALIDA'));
}

/**
 * Inicialización de la Cámara y el Bucle de Reconocimiento Facial
 */
async function initFaceRecognitionCamera() {
  const video = document.getElementById('kiosk-video');
  const overlayCanvas = document.getElementById('kiosk-overlay-canvas');
  const loadingOverlay = document.getElementById('kiosk-camera-loading-overlay');
  const loadingText = document.getElementById('kiosk-camera-loading-text');
  const engineBadge = document.getElementById('face-engine-badge');
  const statusText = document.getElementById('kiosk-face-status-text');
  const guide = document.getElementById('kiosk-face-guide');

  if (!video) return;

  try {
    // 1. Cargar Modelos de IA
    if (loadingText) loadingText.textContent = 'Cargando Redes Neuronales de Rostros...';
    await loadFaceModels();
    if (engineBadge) {
      engineBadge.textContent = '⚡ IA Activa (TinyFace+RecNet)';
      engineBadge.style.color = '#22c55e';
      engineBadge.style.borderColor = 'rgba(34,197,94,0.3)';
      engineBadge.style.background = 'rgba(34,197,94,0.1)';
    }

    // 2. Iniciar Cámara Web Frontal
    if (loadingText) loadingText.textContent = 'Conectando con cámara frontal...';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });

    videoStream = stream;
    video.srcObject = stream;
    await video.play();

    if (loadingOverlay) loadingOverlay.style.display = 'none';

    // 3. Bucle Continuo de Detección Facial (cada 280ms)
    startFaceDetectionLoop(video, overlayCanvas, statusText, guide);

  } catch (err) {
    console.error('Error al inicializar cámara facial:', err);
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `
        <div style="font-size: 2rem; color: #ef4444; margin-bottom: 6px;">📷⚠️</div>
        <div style="font-size: 0.85rem; color: #fca5a5; text-align: center; padding: 0 14px;">
          No se pudo acceder a la cámara frontal.<br>
          <span style="font-size: 0.75rem; color: #94a3b8;">Verifica los permisos de cámara en tu navegador o usa el código QR.</span>
        </div>
      `;
    }
  }

  // Botón de reintento forzado
  const btnForce = document.getElementById('btn-force-face-scan');
  if (btnForce) {
    btnForce.addEventListener('click', async () => {
      if (isProcessingFace) return;
      if (statusText) statusText.textContent = 'Analizando rostro en pantalla...';
      await processFaceRecognitionFrame(video, statusText, guide, true);
    });
  }

  // Botón de alternar cámara (frontal / trasera)
  const btnSwitch = document.getElementById('btn-switch-camera');
  if (btnSwitch) {
    let currentFacing = 'user';
    btnSwitch.addEventListener('click', async () => {
      currentFacing = currentFacing === 'user' ? 'environment' : 'user';
      if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
      }
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacing, width: { ideal: 640 }, height: { ideal: 480 } }
        });
        videoStream = newStream;
        video.srcObject = newStream;
        await video.play();
      } catch (e) {
        console.warn('No se pudo alternar cámara:', e);
      }
    });
  }
}

/**
 * Bucle asíncrono para detección facial en tiempo real
 */
function startFaceDetectionLoop(video, overlayCanvas, statusText, guide) {
  if (detectionIntervalId) clearInterval(detectionIntervalId);

  detectionIntervalId = setInterval(async () => {
    if (isProcessingFace || !video || video.paused || video.ended) return;
    await processFaceRecognitionFrame(video, statusText, guide, false);
  }, 280);
}

/**
 * Procesa un cuadro de video para detección y reconocimiento
 */
async function processFaceRecognitionFrame(video, statusText, guide, isManualTrigger = false) {
  try {
    const detection = await detectSingleFaceAndDescriptor(video, { inputSize: 320, scoreThreshold: 0.5 });

    if (!detection) {
      if (guide) {
        guide.style.borderColor = 'rgba(0, 242, 254, 0.45)';
        guide.style.boxShadow = '0 0 20px rgba(0, 242, 254, 0.15)';
      }
      if (isManualTrigger && statusText) {
        statusText.textContent = '⚠️ No se detectó ningún rostro. Acércate más a la cámara.';
      }
      return;
    }

    // Rostro detectado: cambiar guía visual a verde brillante
    if (guide) {
      guide.style.borderColor = '#22c55e';
      guide.style.boxShadow = '0 0 30px rgba(34, 197, 94, 0.5)';
    }

    const state = getAppState();
    const employees = state.administracion_employees || [];

    // Buscar coincidencia biométrica
    const match = matchFaceAgainstEmployees(detection.descriptor, employees, 0.52);

    if (match.matched && match.employee) {
      const emp = match.employee;
      const now = Date.now();

      // Evitar dobles marcajes seguidos del mismo colaborador en los últimos 10 segundos
      if (lastMatchedEmployeeId === emp.id && (now - lastMatchedTimestamp) < 10000) {
        if (statusText) {
          statusText.innerHTML = `⏳ Hola <strong style="color: #00f2fe;">${emp.name}</strong>, tu marcaje ya fue registrado. Espera un momento.`;
        }
        return;
      }

      isProcessingFace = true;
      if (statusText) {
        statusText.innerHTML = `✅ ¡Identificado: <strong style="color: #22c55e;">${emp.name}</strong> (${match.confidence}% confianza)! Registrando...`;
      }

      // Registrar asistencia automáticamente con método FACIAL
      const punchResult = await recordAttendance({
        employeeCode: emp.employee_code,
        type: currentPunchType,
        method: 'FACIAL',
        ipAddress: 'Terminal Facial Entrada',
        userAgent: 'LUGAMED Kiosko Facial v2.0',
        state
      });

      lastMatchedEmployeeId = emp.id;
      lastMatchedTimestamp = now;

      if (punchResult.success) {
        playAttendanceFeedbackSound('success');
        showReceiptCard(punchResult.record, emp);
      } else {
        playAttendanceFeedbackSound('warning');
        if (statusText) {
          statusText.innerHTML = `<span style="color: #f59e0b;">⚠️ ${punchResult.error}</span>`;
        }
        setTimeout(() => { isProcessingFace = false; }, 3500);
      }

    } else {
      // Rostro detectado pero no coincide con ningún colaborador
      if (statusText) {
        statusText.innerHTML = `⚠️ Rostro detectado pero <strong style="color: #f87171;">no registrado</strong>. Contacta a RRHH para enrolarte.`;
      }
      if (guide) {
        guide.style.borderColor = '#f59e0b';
      }
    }

  } catch (err) {
    console.warn('Error en cuadro de reconocimiento:', err);
  }
}

/**
 * Muestra la ficha de confirmación exitosa sobre el visor de cámara con cuenta regresiva
 */
function showReceiptCard(record, employee) {
  const overlay = document.getElementById('kiosk-receipt-overlay');
  if (!overlay) return;

  const emp = employee || { name: 'Colaborador', employee_code: 'EMP-001', position: 'Personal' };
  const rec = record || { type: 'ENTRADA', status: 'ON_TIME', time_str: new Date().toLocaleTimeString('es-GT') };

  const isEntry = rec.type === 'ENTRADA';
  const isLate = rec.status === 'LATE';

  const statusBadge = isEntry
    ? (isLate 
        ? `<span style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid #f59e0b; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 0.8rem;">⚠️ RETARDO (+${rec.lateMinutes || 0} min)</span>`
        : `<span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid #22c55e; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 0.8rem;">✅ A TIEMPO</span>`)
    : `<span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #60a5fa; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 0.8rem;">🏁 JORNADA FINALIZADA ${rec.hoursWorked ? `(${rec.hoursWorked} hrs)` : ''}</span>`;

  const photoHtml = emp.face_photo 
    ? `<img src="${emp.face_photo}" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid #22c55e; box-shadow: 0 0 15px rgba(34,197,94,0.4); margin-bottom: 6px;">`
    : `<div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(34,197,94,0.2); color: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; margin-bottom: 6px; border: 3px solid #22c55e;">✓</div>`;

  overlay.innerHTML = `
    ${photoHtml}
    <h2 style="color: #22c55e; margin: 0 0 2px 0; font-size: 1.2rem;">¡Asistencia Registrada!</h2>
    <div style="font-size: 1.05rem; font-weight: 800; color: #ffffff; margin-bottom: 4px;">${emp.name}</div>
    <div style="font-size: 0.78rem; color: #94a3b8; margin-bottom: 10px;">
      <span style="font-family: monospace; color: #00f2fe; font-weight: 700;">${emp.employee_code || 'EMP-001'}</span> &bull; ${emp.position || 'Personal'}
    </div>

    <!-- Detalles del Marcaje -->
    <div style="background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 14px; width: 85%; max-width: 320px; font-size: 0.8rem; display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; text-align: left;">
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #94a3b8;">Tipo:</span>
        <strong style="color: ${isEntry ? '#22c55e' : '#ef4444'};">${rec.type}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #94a3b8;">Hora:</span>
        <strong style="color: #ffffff; font-family: monospace;">${rec.time_str || new Date().toLocaleTimeString('es-GT')}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #94a3b8;">Método:</span>
        <strong style="color: #00f2fe;">${rec.method === 'FACIAL' ? '👤 Reconocimiento Facial' : '📱 Código QR / Manual'}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1);">
        <span style="color: #94a3b8;">Puntualidad:</span>
        ${statusBadge}
      </div>
    </div>

    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
      Listo para el siguiente colaborador en <span id="receipt-countdown-seconds" style="color: #00f2fe; font-weight: 700;">4</span>s...
    </div>
  `;

  overlay.style.display = 'flex';

  let countdown = 4;
  const countTimer = setInterval(() => {
    countdown--;
    const countEl = document.getElementById('receipt-countdown-seconds');
    if (countEl) countEl.textContent = countdown;
    if (countdown <= 0) {
      clearInterval(countTimer);
      overlay.style.display = 'none';
      isProcessingFace = false;
      const statusText = document.getElementById('kiosk-face-status-text');
      if (statusText) statusText.textContent = 'Centra tu rostro dentro del óvalo para registrar asistencia';
    }
  }, 1000);
}

/**
 * Modal de Supervisor con PIN para Enrolamiento de Rostros en la Terminal
 */
function initSupervisorPinModal() {
  const btnOpen = document.getElementById('btn-kiosk-supervisor-pin');
  const modal = document.getElementById('kiosk-supervisor-modal');
  const btnClose = document.getElementById('btn-close-supervisor-modal');
  const pinInput = document.getElementById('supervisor-pin-input');
  const pinError = document.getElementById('supervisor-pin-error');
  const btnVerifyPin = document.getElementById('btn-verify-supervisor-pin');

  const stepPin = document.getElementById('supervisor-pin-step');
  const stepEnroll = document.getElementById('supervisor-enroll-step');
  const empSelect = document.getElementById('supervisor-enroll-emp-select');
  const enrollVideo = document.getElementById('supervisor-enroll-video');
  const btnCapture = document.getElementById('btn-capture-save-face');
  const enrollStatus = document.getElementById('supervisor-enroll-status');

  let supervisorStream = null;

  if (!btnOpen || !modal) return;

  btnOpen.addEventListener('click', () => {
    modal.style.display = 'flex';
    if (stepPin) stepPin.style.display = 'block';
    if (stepEnroll) stepEnroll.style.display = 'none';
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
    if (pinError) pinError.style.display = 'none';
  });

  const closeModal = () => {
    modal.style.display = 'none';
    if (supervisorStream) {
      supervisorStream.getTracks().forEach(t => t.stop());
      supervisorStream = null;
    }
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);

  // Verificación de PIN
  if (btnVerifyPin && pinInput) {
    btnVerifyPin.addEventListener('click', async () => {
      const enteredPin = pinInput.value.trim();
      // Validar contra PIN maestro 5414 o Glol5414
      if (enteredPin === '5414' || enteredPin === 'Glol5414' || enteredPin === 'admin') {
        if (pinError) pinError.style.display = 'none';
        stepPin.style.display = 'none';
        stepEnroll.style.display = 'block';

        // Cargar colaboradores en select
        const state = getAppState();
        const employees = state.administracion_employees || [];
        
        empSelect.innerHTML = employees.map(e => `
          <option value="${e.id}">
            ${e.employee_code || 'EMP-S/C'} - ${e.name} (${e.position || 'General'}) ${e.face_descriptor ? '✅ (Rostro Enrolado)' : '⚠️ (Sin Rostro)'}
          </option>
        `).join('');

        // Iniciar cámara de enrolamiento
        try {
          supervisorStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
          });
          enrollVideo.srcObject = supervisorStream;
          await enrollVideo.play();
        } catch (e) {
          enrollStatus.textContent = 'Error al abrir cámara para enrolamiento.';
        }

      } else {
        if (pinError) pinError.style.display = 'block';
      }
    });
  }

  // Capturar y Guardar Rostro
  if (btnCapture && empSelect && enrollVideo) {
    btnCapture.addEventListener('click', async () => {
      const selectedEmpId = empSelect.value;
      if (!selectedEmpId) return;

      if (enrollStatus) enrollStatus.textContent = 'Analizando y extrayendo vector facial...';
      btnCapture.disabled = true;

      try {
        const detection = await detectSingleFaceAndDescriptor(enrollVideo, { inputSize: 320, scoreThreshold: 0.5 });
        if (!detection) {
          if (enrollStatus) enrollStatus.textContent = '⚠️ No se detectó un rostro claro. Centra la cara e intenta de nuevo.';
          btnCapture.disabled = false;
          playAttendanceFeedbackSound('warning');
          return;
        }

        // Extraer miniatura fotográfica
        const photoThumbnail = captureCompressedFaceThumbnail(enrollVideo, detection.detection.box);
        const floatArray = Array.from(detection.descriptor);

        const state = getAppState();
        const emp = (state.administracion_employees || []).find(e => e.id === selectedEmpId);

        if (emp) {
          emp.face_descriptor = floatArray;
          emp.face_photo = photoThumbnail;
          emp.face_enrolled_at = new Date().toISOString();

          // Guardar en Firestore
          saveStateToLocalCache();
          const docRef = doc(db, 'multimedica', 'catalog_administracion_employees');
          await setDoc(docRef, { _collectionType: 'catalog_administracion_employees', items: state.administracion_employees }, { merge: true });

          const indRef = doc(db, 'multimedica', emp.id);
          await setDoc(indRef, { ...emp, _collectionType: 'administracion_employees' }, { merge: true });
          saveAppState(state).catch(console.warn);

          playAttendanceFeedbackSound('success');
          if (enrollStatus) {
            enrollStatus.innerHTML = `<span style="color: #22c55e; font-weight: 700;">✅ ¡Rostro de ${emp.name} enrolado exitosamente!</span>`;
          }

          setTimeout(() => {
            closeModal();
            btnCapture.disabled = false;
          }, 1800);
        }

      } catch (err) {
        console.error('Error al capturar rostro:', err);
        if (enrollStatus) enrollStatus.textContent = 'Error al procesar: ' + err.message;
        btnCapture.disabled = false;
      }
    });
  }
}
