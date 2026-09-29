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
let isLoopRunning = false;
let isFrameInProgress = false;
let qrRotationIntervalId = null;
let isProcessingFace = false;
let lastMatchedEmployeeId = null;
let lastMatchedTimestamp = 0;
let currentPunchType = 'ENTRADA'; // 'ENTRADA' | 'SALIDA'
let activeKioskTab = 'face'; // 'face' | 'qr'

/**
 * Renderiza la terminal perimetral aislada en modo Kiosko Dual a Pantalla Completa
 * @param {HTMLElement} rootContainer
 */
export function renderAttendanceKioskView(rootContainer) {
  // Limpiar temporizadores e intervalos previos
  stopCameraAndLoops();

  // Configurar estilos base de aislamiento seguro y pantalla completa 100vh / 100dvh
  document.documentElement.style.height = '100%';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.width = '100vw';
  document.body.style.height = '100dvh';
  document.body.style.minHeight = '100vh';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#0b1120';
  document.body.style.color = '#f8fafc';
  document.body.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  document.body.style.userSelect = 'none';

  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'Hospital Privado Multimédica Sayaxché' };

  rootContainer.innerHTML = `
    <div id="kiosk-app-wrapper" style="
      width: 100vw;
      height: 100dvh;
      max-height: 100dvh;
      display: flex;
      flex-direction: column;
      background: radial-gradient(circle at 50% 10%, #1e293b 0%, #0b1120 100%);
      box-sizing: border-box;
      padding: clamp(6px, 1.5vw, 14px);
      overflow: hidden;
      position: relative;
    ">
      
      <!-- Barra Superior Compacta de Kiosko -->
      <header style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding-bottom: 6px;
        margin-bottom: 8px;
        flex-shrink: 0;
      ">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <img src="${logoUrl}" alt="LUGAMED Logo" style="height: clamp(32px, 5vw, 42px); object-fit: contain; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); flex-shrink: 0;">
          <div style="min-width: 0;">
            <h1 style="margin: 0; font-size: clamp(0.88rem, 2.2vw, 1.15rem); color: #f8fafc; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${clinic.name}</h1>
            <div style="font-size: clamp(0.68rem, 1.6vw, 0.76rem); color: #00f2fe; font-weight: 600; display: flex; align-items: center; gap: 5px;">
              <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; flex-shrink: 0;"></span>
              <span>Terminal Perimetral &bull; Kiosko</span>
            </div>
          </div>
        </div>

        <!-- Reloj Digital y Botones de Acción -->
        <div style="display: flex; align-items: center; gap: clamp(6px, 1.5vw, 12px); flex-shrink: 0;">
          <div style="text-align: right;">
            <div id="kiosk-clock-time" style="font-family: monospace; font-size: clamp(1.1rem, 3vw, 1.45rem); font-weight: 800; color: #00f2fe; letter-spacing: 1px; line-height: 1;">--:--:--</div>
            <div id="kiosk-clock-date" style="font-size: clamp(0.62rem, 1.4vw, 0.72rem); color: #94a3b8; text-transform: capitalize; margin-top: 2px;">--</div>
          </div>
          
          <button id="btn-kiosk-fullscreen" title="Pantalla Completa" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 0.85rem;">
            ⛶
          </button>

          <button id="btn-kiosk-supervisor-pin" title="Supervisor / Enrolamiento con PIN" style="background: rgba(0,242,254,0.1); border: 1px solid rgba(0,242,254,0.3); color: #00f2fe; padding: 6px 9px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
            <span>🛡️</span>
          </button>
        </div>
      </header>

      <!-- Selector de Modo de Marcaje (Entrada 🟢 / Salida 🔴) -->
      <div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 8px; flex-shrink: 0;">
        <button id="btn-toggle-type-in" style="
          flex: 1;
          max-width: 280px;
          padding: clamp(8px, 1.8vw, 12px) 14px;
          border-radius: 12px;
          border: 2px solid #22c55e;
          background: ${currentPunchType === 'ENTRADA' ? 'linear-gradient(135deg, #15803d, #22c55e)' : 'rgba(34, 197, 94, 0.1)'};
          color: #ffffff;
          font-weight: 800;
          font-size: clamp(0.85rem, 2vw, 1rem);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: ${currentPunchType === 'ENTRADA' ? '0 0 18px rgba(34, 197, 94, 0.45)' : 'none'};
          transition: all 0.2s;
        ">
          <span style="font-size: 1.15rem;">🟢</span> REGISTRAR ENTRADA
        </button>
        <button id="btn-toggle-type-out" style="
          flex: 1;
          max-width: 280px;
          padding: clamp(8px, 1.8vw, 12px) 14px;
          border-radius: 12px;
          border: 2px solid #ef4444;
          background: ${currentPunchType === 'SALIDA' ? 'linear-gradient(135deg, #b91c1c, #ef4444)' : 'rgba(239, 68, 68, 0.1)'};
          color: #ffffff;
          font-weight: 800;
          font-size: clamp(0.85rem, 2vw, 1rem);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: ${currentPunchType === 'SALIDA' ? '0 0 18px rgba(239, 68, 68, 0.45)' : 'none'};
          transition: all 0.2s;
        ">
          <span style="font-size: 1.15rem;">🔴</span> REGISTRAR SALIDA
        </button>
      </div>

      <!-- Selector de Pestañas (Visible en Móviles y Tablets en Vertical) -->
      <div id="kiosk-mobile-tab-nav" style="display: none; justify-content: center; gap: 8px; margin-bottom: 8px; flex-shrink: 0;">
        <button id="tab-btn-face" style="flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #00f2fe; background: #00f2fe; color: #0b1120; font-weight: 700; font-size: 0.85rem; cursor: pointer;">
          👤 Reconocimiento Facial
        </button>
        <button id="tab-btn-qr" style="flex: 1; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); color: #cbd5e1; font-weight: 600; font-size: 0.85rem; cursor: pointer;">
          📱 Código QR / Teclado
        </button>
      </div>

      <!-- Contenedor Principal: Se adapta dinámicamente a 100% del alto restante -->
      <main id="kiosk-dual-container" style="
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: clamp(8px, 1.5vw, 16px);
        align-items: stretch;
        margin-bottom: 4px;
        overflow: hidden;
      ">
        
        <!-- ============================================== -->
        <!-- SECCIÓN 1: RECONOCIMIENTO FACIAL PANTALLA COMPLETA -->
        <!-- ============================================== -->
        <section id="kiosk-face-section" style="
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(0, 242, 254, 0.25);
          border-radius: 14px;
          padding: clamp(6px, 1vw, 12px);
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          box-shadow: 0 15px 35px rgba(0,0,0,0.5);
          overflow: hidden;
          min-height: 0;
          height: 100%;
          box-sizing: border-box;
        ">
          
          <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: clamp(0.82rem, 1.8vw, 0.95rem); color: #00f2fe;">
              <span>👤</span> Reconocimiento Facial Biométrico
            </div>
            <span id="face-engine-badge" style="font-size: 0.68rem; background: rgba(0,242,254,0.1); color: #00f2fe; padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(0,242,254,0.2);">
              ⏳ Cargando IA...
            </span>
          </div>

          <!-- Visor de Cámara que llena el 100% del espacio disponible -->
          <div style="
            position: relative;
            width: 100%;
            flex: 1;
            min-height: 0;
            background: #000000;
            border-radius: 12px;
            overflow: hidden;
            border: 2px solid rgba(255,255,255,0.1);
            box-shadow: inset 0 0 25px rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            
            <video id="kiosk-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
            <canvas id="kiosk-overlay-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; transform: scaleX(-1);"></canvas>

            <!-- Guía Visual de Óvalo Facial Centrada -->
            <div id="kiosk-face-guide" style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: min(65vw, 300px);
              height: min(80vw, 380px);
              border: 3px dashed #00f2fe;
              border-radius: 50%;
              pointer-events: none;
              box-shadow: 0 0 25px rgba(0, 242, 254, 0.25);
              transition: all 0.2s;
            "></div>

            <!-- Overlay de Estado de Carga -->
            <div id="kiosk-camera-loading-overlay" style="position: absolute; inset: 0; background: rgba(11, 17, 32, 0.92); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
              <div style="width: 38px; height: 38px; border: 3px solid rgba(0,242,254,0.2); border-top: 3px solid #00f2fe; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <span id="kiosk-camera-loading-text" style="font-size: 0.85rem; color: #94a3b8;">Iniciando cámara frontal...</span>
            </div>

            <!-- Ficha Flotante de Marcaje Exitoso a Pantalla Completa -->
            <div id="kiosk-receipt-overlay" style="
              display: none;
              position: absolute;
              inset: 0;
              background: rgba(11, 17, 32, 0.96);
              padding: 16px;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              animation: fadeIn 0.2s ease-out;
              z-index: 10;
            "></div>

            <!-- Barra Flotante de Estado en Vivo (Inferior del Visor) -->
            <div id="kiosk-face-status-bar" style="
              position: absolute;
              bottom: 8px;
              left: 8px;
              right: 8px;
              background: rgba(15, 23, 42, 0.85);
              backdrop-filter: blur(8px);
              border: 1px solid rgba(255,255,255,0.12);
              border-radius: 10px;
              padding: 7px 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 8px;
              z-index: 5;
            ">
              <div id="kiosk-face-status-text" style="font-size: clamp(0.75rem, 1.8vw, 0.85rem); color: #cbd5e1; font-weight: 500; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                Centra tu rostro en el óvalo para registrar asistencia
              </div>
              <div style="display: flex; gap: 6px; flex-shrink: 0;">
                <button id="btn-force-face-scan" style="padding: 5px 8px; background: rgba(0, 242, 254, 0.18); border: 1px solid rgba(0, 242, 254, 0.35); color: #00f2fe; border-radius: 6px; font-size: 0.72rem; font-weight: 600; cursor: pointer;">
                  🔍 Reintentar
                </button>
                <button id="btn-switch-camera" style="padding: 5px 8px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; border-radius: 6px; font-size: 0.72rem; cursor: pointer;" title="Cambiar Cámara">
                  🔄
                </button>
              </div>
            </div>

          </div>

        </section>


        <!-- ============================================== -->
        <!-- SECCIÓN 2: CÓDIGO QR Y TECLADO TÁCTIL        -->
        <!-- ============================================== -->
        <section id="kiosk-qr-section" style="
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: clamp(8px, 1.5vw, 14px);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 15px 35px rgba(0,0,0,0.5);
          overflow-y: auto;
          min-height: 0;
          height: 100%;
          box-sizing: border-box;
        ">
          
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: clamp(0.82rem, 1.8vw, 0.95rem); color: #f8fafc;">
                <span>📱</span> Código QR / Teclado
              </div>
              <span id="qr-timer-badge" style="font-size: 0.68rem; background: rgba(34,197,94,0.1); color: #22c55e; padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(34,197,94,0.2); font-family: monospace;">
                ⏱️ Rota en 30s
              </span>
            </div>

            <!-- Canvas de Código QR Rotativo -->
            <div style="display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 8px; margin-bottom: 8px;">
              <div style="background: #ffffff; padding: 6px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                <canvas id="kiosk-qr-canvas" style="display: block; width: clamp(100px, 20vw, 130px); height: clamp(100px, 20vw, 130px);"></canvas>
              </div>
              <span style="font-size: 0.68rem; color: #94a3b8; margin-top: 4px; text-align: center;">
                Escanea con tu celular o teclea tu código abajo:
              </span>
            </div>

            <!-- Formulario de Entrada por Código Manual -->
            <form id="kiosk-manual-code-form" style="display: flex; flex-direction: column; gap: 6px;">
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
                    padding: clamp(8px, 1.5vw, 12px) 14px;
                    background: rgba(0,0,0,0.45);
                    border: 2px solid rgba(0, 242, 254, 0.35);
                    border-radius: 8px;
                    color: #ffffff;
                    font-size: clamp(1rem, 2.5vw, 1.25rem);
                    font-weight: 800;
                    font-family: monospace;
                    text-align: center;
                    outline: none;
                  "
                >
              </div>

              <!-- Banner de Error Manual -->
              <div id="kiosk-manual-error" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; padding: 6px 10px; border-radius: 6px; font-size: 0.75rem; text-align: center;"></div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button type="button" id="btn-manual-mark-in" style="background: linear-gradient(135deg, #16a34a, #22c55e); color: #fff; border: none; border-radius: 8px; padding: clamp(8px, 1.8vw, 11px) 6px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                  🟢 Entrada
                </button>
                <button type="button" id="btn-manual-mark-out" style="background: linear-gradient(135deg, #dc2626, #ef4444); color: #fff; border: none; border-radius: 8px; padding: clamp(8px, 1.8vw, 11px) 6px; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                  🔴 Salida
                </button>
              </div>
            </form>
          </div>

          <!-- Teclado Numérico Táctil Grande para Dedos -->
          <div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;">
              ${[1,2,3,4,5,6,7,8,9,'C',0,'⌫'].map(k => `
                <button type="button" class="btn-numpad-key" data-key="${k}" style="
                  background: rgba(255,255,255,0.05);
                  border: 1px solid rgba(255,255,255,0.12);
                  color: #f8fafc;
                  font-size: clamp(1rem, 2.5vw, 1.25rem);
                  font-weight: 800;
                  padding: clamp(8px, 1.8vw, 12px);
                  border-radius: 8px;
                  cursor: pointer;
                  font-family: monospace;
                  touch-action: manipulation;
                  transition: background 0.1s;
                ">
                  ${k}
                </button>
              `).join('')}
            </div>
          </div>
        </section>

      </main>

      <!-- Modal de Enrolamiento para Supervisor con PIN -->
      <div id="kiosk-supervisor-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 99999; align-items: center; justify-content: center; padding: 15px; box-sizing: border-box;">
        <div style="background: #0f172a; border: 1px solid rgba(0,242,254,0.3); border-radius: 16px; width: 100%; max-width: 460px; padding: 20px; box-shadow: 0 25px 50px rgba(0,0,0,0.8); position: relative; max-height: 95vh; overflow-y: auto;">
          
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
            <input type="password" id="supervisor-pin-input" placeholder="PIN (ej. 5414)" maxlength="20" style="width: 100%; box-sizing: border-box; padding: 12px; background: rgba(0,0,0,0.5); border: 2px solid rgba(0,242,254,0.3); border-radius: 8px; color: #fff; font-size: 1.2rem; font-family: monospace; text-align: center; margin-bottom: 10px;">
            <div id="supervisor-pin-error" style="display: none; color: #f87171; font-size: 0.78rem; margin-bottom: 10px; text-align: center;">PIN incorrecto. Intenta de nuevo.</div>
            <button id="btn-verify-supervisor-pin" style="width: 100%; background: linear-gradient(135deg, #0284c7, #00f2fe); color: #0b1120; font-weight: 700; padding: 12px; border: none; border-radius: 8px; font-size: 0.95rem; cursor: pointer;">
              🔓 Desbloquear Enrolamiento
            </button>
          </div>

          <!-- Paso 2: Formulario de Enrolamiento Instantáneo -->
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
              <div style="position: absolute; width: 55%; height: 75%; border: 2px dashed #22c55e; border-radius: 50%; pointer-events: none;"></div>
            </div>

            <div id="supervisor-enroll-status" style="font-size: 0.82rem; color: #cbd5e1; text-align: center; margin-bottom: 10px; min-height: 20px; font-weight: 500;">
              Alinea el rostro del colaborador dentro del óvalo
            </div>

            <button id="btn-capture-save-face" style="width: 100%; background: linear-gradient(135deg, #16a34a, #22c55e); color: #fff; font-weight: 700; padding: 12px; border: none; border-radius: 8px; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span>📸</span> Capturar y Guardar Rostro
            </button>
          </div>

        </div>
      </div>

    </div>

    <!-- Estilos de Animación y Media Queries Adaptativas para Tablets y Celulares -->
    <style>
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      
      /* En Celulares y Tablets en Vertical: Ocupar toda la pantalla y habilitar pestañas */
      @media (max-width: 900px), (orientation: portrait) {
        #kiosk-dual-container { 
          display: flex !important; 
          flex-direction: column !important;
          flex: 1 !important;
          height: 100% !important;
        }
        #kiosk-mobile-tab-nav { 
          display: flex !important; 
        }
        #kiosk-face-section {
          flex: 1 !important;
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
        }
        #kiosk-qr-section { 
          display: none !important; 
          flex: 1 !important;
          width: 100% !important;
          height: 100% !important;
        }
      }

      /* En Tablets y Pantallas en Horizontal: Vista Dual 2 Columnas */
      @media (min-width: 901px) and (orientation: landscape) {
        #kiosk-dual-container { 
          display: grid !important; 
          grid-template-columns: 1.15fr 0.85fr !important; 
        }
        #kiosk-mobile-tab-nav { 
          display: none !important; 
        }
        #kiosk-face-section { 
          display: flex !important; 
        }
        #kiosk-qr-section { 
          display: flex !important; 
        }
      }
    </style>
  `;

  // 1. Inicializar Reloj Digital
  initKioskClock();

  // 2. Inicializar Botón de Pantalla Completa
  initFullscreenToggle();

  // 3. Inicializar Botones de Entrada/Salida
  initTypeToggleButtons();

  // 4. Inicializar Pestañas Móviles
  initMobileTabs();

  // 5. Inicializar Teclado Numérico y Formulario Manual
  initManualForm();

  // 6. Inicializar Código QR Rotativo
  initRotatingQrCode();

  // 7. Inicializar Cámara y Reconocimiento Facial
  initFaceRecognitionCamera();

  // 8. Inicializar Modal de Supervisor
  initSupervisorPinModal();
}

/**
 * Detiene todos los flujos de cámara y temporizadores
 */
function stopCameraAndLoops() {
  isLoopRunning = false;
  isFrameInProgress = false;
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  if (qrRotationIntervalId) {
    clearInterval(qrRotationIntervalId);
    qrRotationIntervalId = null;
  }
  isProcessingFace = false;
}

/**
 * Activa o desactiva la pantalla completa nativa en tablets y celulares
 */
function initFullscreenToggle() {
  const btn = document.getElementById('btn-kiosk-fullscreen');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      btn.textContent = '✕';
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        btn.textContent = '⛶';
      }
    }
  });
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
      btnIn.style.boxShadow = currentPunchType === 'ENTRADA' ? '0 0 18px rgba(34, 197, 94, 0.45)' : 'none';
    }
    if (btnOut) {
      btnOut.style.background = currentPunchType === 'SALIDA' ? 'linear-gradient(135deg, #b91c1c, #ef4444)' : 'rgba(239, 68, 68, 0.1)';
      btnOut.style.boxShadow = currentPunchType === 'SALIDA' ? '0 0 18px rgba(239, 68, 68, 0.45)' : 'none';
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
 * Pestañas en vista móvil / tablet vertical
 */
function initMobileTabs() {
  const tabFace = document.getElementById('tab-btn-face');
  const tabQr = document.getElementById('tab-btn-qr');
  const secFace = document.getElementById('kiosk-face-section');
  const secQr = document.getElementById('kiosk-qr-section');

  if (tabFace && tabQr && secFace && secQr) {
    tabFace.addEventListener('click', () => {
      activeKioskTab = 'face';
      tabFace.style.background = '#00f2fe';
      tabFace.style.color = '#0b1120';
      tabQr.style.background = 'rgba(255,255,255,0.05)';
      tabQr.style.color = '#cbd5e1';
      secFace.style.setProperty('display', 'flex', 'important');
      secQr.style.setProperty('display', 'none', 'important');
    });

    tabQr.addEventListener('click', () => {
      activeKioskTab = 'qr';
      tabQr.style.background = '#00f2fe';
      tabQr.style.color = '#0b1120';
      tabFace.style.background = 'rgba(255,255,255,0.05)';
      tabFace.style.color = '#cbd5e1';
      secQr.style.setProperty('display', 'flex', 'important');
      secFace.style.setProperty('display', 'none', 'important');
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
    await renderQRToCanvas(qrCanvas, url, { width: 130, margin: 1 });
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
 * Inicialización de la Cámara y el Bucle de Reconocimiento Facial Ultra-rápido
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

    const updateBadgeCount = () => {
      if (!engineBadge) return;
      const state = getAppState();
      const employees = state.administracion_employees || [];
      const enrolledCount = employees.filter(e => {
        if (!e.face_descriptor) return false;
        if (Array.isArray(e.face_descriptor) && e.face_descriptor.length === 128) return true;
        if (typeof e.face_descriptor === 'object' && Object.keys(e.face_descriptor).length === 128) return true;
        return false;
      }).length;

      if (enrolledCount > 0) {
        engineBadge.textContent = `⚡ IA Activa (${enrolledCount} rostros)`;
        engineBadge.style.color = '#22c55e';
        engineBadge.style.borderColor = 'rgba(34,197,94,0.3)';
        engineBadge.style.background = 'rgba(34,197,94,0.1)';
      } else {
        engineBadge.textContent = `⚠️ 0 Rostros Enrolados`;
        engineBadge.style.color = '#f59e0b';
        engineBadge.style.borderColor = 'rgba(245,158,11,0.3)';
        engineBadge.style.background = 'rgba(245,158,11,0.1)';
      }
    };
    updateBadgeCount();

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
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    await video.play();

    if (loadingOverlay) loadingOverlay.style.display = 'none';

    // 3. Bucle Continuo de Detección Facial Reactivo
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
      await processFaceRecognitionFrame(video, overlayCanvas, statusText, guide, true);
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
 * Bucle asíncrono no-bloqueante para detección facial continua en tiempo real (75ms)
 */
function startFaceDetectionLoop(video, overlayCanvas, statusText, guide) {
  isLoopRunning = true;

  const tick = async () => {
    if (!isLoopRunning) return;

    if (!isProcessingFace && !isFrameInProgress && video && !video.paused && !video.ended && video.readyState >= 2) {
      isFrameInProgress = true;
      try {
        await processFaceRecognitionFrame(video, overlayCanvas, statusText, guide, false);
      } catch (err) {
        console.warn('Error en cuadro de reconocimiento:', err);
      } finally {
        isFrameInProgress = false;
      }
    }

    if (isLoopRunning) {
      setTimeout(tick, isProcessingFace ? 350 : 75);
    }
  };

  tick();
}

/**
 * Procesa un cuadro de video para detección y reconocimiento inmediato
 */
async function processFaceRecognitionFrame(video, overlayCanvas, statusText, guide, isManualTrigger = false) {
  const ctx = overlayCanvas ? overlayCanvas.getContext('2d') : null;
  if (overlayCanvas && video.videoWidth > 0 && video.videoHeight > 0) {
    if (overlayCanvas.width !== video.videoWidth || overlayCanvas.height !== video.videoHeight) {
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;
    }
  }

  try {
    const detection = await detectSingleFaceAndDescriptor(video, { inputSize: 320, scoreThreshold: 0.25 });

    if (!detection) {
      if (ctx && overlayCanvas) {
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
      if (guide) {
        guide.style.borderColor = '#00f2fe';
        guide.style.boxShadow = '0 0 20px rgba(0, 242, 254, 0.2)';
      }
      if (isManualTrigger && statusText) {
        statusText.textContent = '⚠️ No se detectó ningún rostro. Centra tu cara en el óvalo.';
      }
      return;
    }

    const box = detection.detection.box;
    const state = getAppState();
    const employees = state.administracion_employees || [];

    // Buscar coincidencia biométrica con umbral amplio y tolerante (0.68)
    const match = matchFaceAgainstEmployees(detection.descriptor, employees, 0.68);

    // Dibujar recuadro neón en canvas overlay
    if (ctx && overlayCanvas) {
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      const isMatched = match.matched && match.employee;
      const strokeColor = isMatched ? '#22c55e' : '#f59e0b';

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 15;

      // Dibujar esquinas del recuadro
      const x = box.x;
      const y = box.y;
      const w = box.width;
      const h = box.height;
      const cornerLen = Math.min(26, w * 0.25);

      ctx.beginPath();
      // Esquina Sup Izq
      ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
      // Esquina Sup Der
      ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
      // Esquina Inf Der
      ctx.moveTo(x + w, y + h - cornerLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cornerLen, y + h);
      // Esquina Inf Izq
      ctx.moveTo(x + cornerLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cornerLen);
      ctx.stroke();
    }

    if (match.matched && match.employee) {
      const emp = match.employee;
      const now = Date.now();

      // Guía visual verde brillante
      if (guide) {
        guide.style.borderColor = '#22c55e';
        guide.style.boxShadow = '0 0 35px rgba(34, 197, 94, 0.7)';
      }

      // Evitar dobles marcajes seguidos del mismo colaborador en los últimos 8 segundos
      if (lastMatchedEmployeeId === emp.id && (now - lastMatchedTimestamp) < 8000) {
        if (statusText) {
          statusText.innerHTML = `⏳ Hola <strong style="color: #00f2fe;">${emp.name}</strong>, tu asistencia ya fue registrada.`;
        }
        return;
      }

      isProcessingFace = true;
      lastMatchedEmployeeId = emp.id;
      lastMatchedTimestamp = now;

      if (statusText) {
        statusText.innerHTML = `✅ ¡Identificado: <strong style="color: #22c55e;">${emp.name}</strong> (${match.confidence}% confianza)!`;
      }

      // 1. Sonido y Confirmación Visual INMEDIATA (0 ms lag)
      playAttendanceFeedbackSound('success');

      // 2. Registrar asistencia asíncrona inmediata en segundo plano
      recordAttendance({
        employeeCode: emp.employee_code,
        type: currentPunchType,
        method: 'FACIAL',
        ipAddress: 'Terminal Facial Entrada',
        userAgent: 'LUGAMED Kiosko Facial v2.0',
        state
      }).then(punchResult => {
        if (punchResult && punchResult.success) {
          showReceiptCard(punchResult.record, emp);
        } else if (punchResult && !punchResult.success) {
          if (statusText) {
            statusText.innerHTML = `<span style="color: #f59e0b;">⚠️ ${punchResult.error}</span>`;
          }
          setTimeout(() => { isProcessingFace = false; }, 2500);
        }
      }).catch(err => {
        console.error("Error registrando marcaje facial:", err);
      });

    } else {
      // Rostro detectado pero no coincide con ningún colaborador
      if (guide) {
        guide.style.borderColor = '#f59e0b';
        guide.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.5)';
      }
      if (statusText) {
        statusText.innerHTML = `⚠️ Rostro detectado pero <strong style="color: #f87171;">no registrado</strong>. Contacta a RRHH para enrolarte.`;
      }
    }

  } catch (err) {
    console.warn('Error en cuadro de reconocimiento:', err);
  }
}

/**
 * Muestra la ficha de confirmación exitosa sobre el visor de cámara con cuenta regresiva y botón de avance rápido
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
    ? `<img src="${emp.face_photo}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #22c55e; box-shadow: 0 0 20px rgba(34,197,94,0.5); margin-bottom: 8px;">`
    : `<div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(34,197,94,0.2); color: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin-bottom: 8px; border: 3px solid #22c55e;">✓</div>`;

  overlay.innerHTML = `
    ${photoHtml}
    <h2 style="color: #22c55e; margin: 0 0 2px 0; font-size: 1.3rem;">¡Asistencia Registrada!</h2>
    <div style="font-size: 1.15rem; font-weight: 800; color: #ffffff; margin-bottom: 4px;">${emp.name}</div>
    <div style="font-size: 0.82rem; color: #94a3b8; margin-bottom: 12px;">
      <span style="font-family: monospace; color: #00f2fe; font-weight: 700;">${emp.employee_code || 'EMP-001'}</span> &bull; ${emp.position || 'Personal'}
    </div>

    <!-- Detalles del Marcaje -->
    <div style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; width: 90%; max-width: 320px; font-size: 0.85rem; display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; text-align: left;">
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #94a3b8;">Tipo:</span>
        <strong style="color: ${isEntry ? '#22c55e' : '#ef4444'}; font-size: 0.95rem;">${rec.type}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #94a3b8;">Hora:</span>
        <strong style="color: #ffffff; font-family: monospace;">${rec.time_str || new Date().toLocaleTimeString('es-GT')}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #94a3b8;">Método:</span>
        <strong style="color: #00f2fe;">${rec.method === 'FACIAL' ? '👤 Reconocimiento Facial' : '📱 Código QR / Manual'}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.12);">
        <span style="color: #94a3b8;">Puntualidad:</span>
        ${statusBadge}
      </div>
    </div>

    <button id="btn-close-receipt-instant" style="
      background: linear-gradient(135deg, #15803d, #22c55e);
      color: #ffffff;
      border: none;
      padding: 10px 24px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(34,197,94,0.4);
    ">
      ✅ Siguiente Colaborador (<span id="receipt-countdown-seconds">3</span>s)
    </button>
  `;

  overlay.style.display = 'flex';

  let countdown = 3;
  let timerId = null;

  const closeReceipt = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    overlay.style.display = 'none';
    isProcessingFace = false;
    const statusText = document.getElementById('kiosk-face-status-text');
    if (statusText) statusText.textContent = 'Centra tu rostro en el óvalo para registrar asistencia';
  };

  const btnCloseInstant = document.getElementById('btn-close-receipt-instant');
  if (btnCloseInstant) {
    btnCloseInstant.addEventListener('click', closeReceipt);
  }

  timerId = setInterval(() => {
    countdown--;
    const countEl = document.getElementById('receipt-countdown-seconds');
    if (countEl) countEl.textContent = countdown;
    if (countdown <= 0) {
      closeReceipt();
    }
  }, 1000);
}

/**
 * Modal de Supervisor con PIN para Enrolamiento de Rostros en la Terminal (Instantáneo)
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
  let supLiveDescriptor = null;
  let supLiveBox = null;
  let supervisorLoopId = null;
  let isSupCapturing = false;

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
    if (supervisorLoopId) {
      clearInterval(supervisorLoopId);
      supervisorLoopId = null;
    }
    if (supervisorStream) {
      supervisorStream.getTracks().forEach(t => t.stop());
      supervisorStream = null;
    }
    modal.style.display = 'none';
    isSupCapturing = false;
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);

  // Verificación de PIN
  if (btnVerifyPin && pinInput) {
    btnVerifyPin.addEventListener('click', async () => {
      const enteredPin = pinInput.value.trim();
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

        // Iniciar cámara de enrolamiento y pre-detección en tiempo real
        try {
          supervisorStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
          });
          enrollVideo.srcObject = supervisorStream;
          await enrollVideo.play();

          if (supervisorLoopId) clearInterval(supervisorLoopId);
          supervisorLoopId = setInterval(async () => {
            if (isSupCapturing || !enrollVideo || enrollVideo.paused || enrollVideo.ended) return;
            try {
              const detection = await detectSingleFaceAndDescriptor(enrollVideo, { inputSize: 224, scoreThreshold: 0.4 });
              if (detection) {
                supLiveDescriptor = Array.from(detection.descriptor);
                supLiveBox = detection.detection.box;
                if (enrollStatus && !isSupCapturing) {
                  enrollStatus.innerHTML = '<span style="color: #22c55e; font-weight: 700;">🟢 Rostro detectado &bull; ¡Listo para capturar!</span>';
                }
              }
            } catch (e) {}
          }, 160);

        } catch (e) {
          enrollStatus.textContent = 'Error al abrir cámara para enrolamiento.';
        }

      } else {
        if (pinError) pinError.style.display = 'block';
      }
    });
  }

  // Capturar y Guardar Rostro INMEDIATO
  if (btnCapture && empSelect && enrollVideo) {
    btnCapture.addEventListener('click', async () => {
      const selectedEmpId = empSelect.value;
      if (!selectedEmpId || isSupCapturing) return;

      isSupCapturing = true;
      btnCapture.disabled = true;

      try {
        const photoThumbnail = captureCompressedFaceThumbnail(enrollVideo, supLiveBox);

        let descriptorToSave = supLiveDescriptor;
        if (!descriptorToSave || descriptorToSave.length !== 128) {
          const quick = await detectSingleFaceAndDescriptor(enrollVideo, { inputSize: 224, scoreThreshold: 0.4 }).catch(() => null);
          if (quick) {
            descriptorToSave = Array.from(quick.descriptor);
          }
        }

        const state = getAppState();
        const emp = (state.administracion_employees || []).find(e => e.id === selectedEmpId);

        if (emp) {
          emp.face_photo = photoThumbnail;
          if (descriptorToSave && descriptorToSave.length === 128) {
            emp.face_descriptor = descriptorToSave;
          }
          emp.face_enrolled_at = new Date().toISOString();

          // Guardar asíncrono en Firestore en segundo plano
          saveStateToLocalCache();
          const docRef = doc(db, 'multimedica', 'catalog_administracion_employees');
          setDoc(docRef, { _collectionType: 'catalog_administracion_employees', items: state.administracion_employees }, { merge: true }).catch(console.warn);

          const indRef = doc(db, 'multimedica', emp.id);
          setDoc(indRef, { ...emp, _collectionType: 'administracion_employees' }, { merge: true }).catch(console.warn);
          saveAppState(state).catch(console.warn);

          playAttendanceFeedbackSound('success');
          if (enrollStatus) {
            enrollStatus.innerHTML = `<span style="color: #22c55e; font-weight: 800;">✅ ¡Rostro de ${emp.name} enrolado exitosamente!</span>`;
          }

          setTimeout(() => {
            closeModal();
            btnCapture.disabled = false;
            isSupCapturing = false;
          }, 500);
        }

      } catch (err) {
        console.error('Error al capturar rostro:', err);
        if (enrollStatus) enrollStatus.textContent = 'Error al procesar: ' + err.message;
        btnCapture.disabled = false;
        isSupCapturing = false;
      }
    });
  }
}
