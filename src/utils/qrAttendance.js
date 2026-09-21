// src/utils/qrAttendance.js
import QRCode from 'qrcode';
import { saveAppState } from '../main.js';

const QR_SECRET = 'LUGAMED_ATTENDANCE_SECRET_2026_TOTP';
const TOKEN_WINDOW_SECONDS = 30; // Rotación cada 30 segundos

/**
 * Función simple de hash para firma ligera de tokens en cliente
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Genera un token rotativo firmado con TTL de 30 segundos
 * @returns {string} Token firmado en Base64 URL-safe
 */
export function generateRotatingToken() {
  const now = Date.now();
  const windowIndex = Math.floor(now / (TOKEN_WINDOW_SECONDS * 1000));
  const exp = (windowIndex + 1) * (TOKEN_WINDOW_SECONDS * 1000);
  const signature = simpleHash(`${windowIndex}_${QR_SECRET}_${exp}`);

  const payload = {
    w: windowIndex,
    t: now,
    exp: exp,
    sig: signature
  };

  const jsonStr = JSON.stringify(payload);
  return btoa(jsonStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Valida si un token rotativo es legítimo y no ha expirado
 * @param {string} tokenStr - Token en base64
 * @returns {{ valid: boolean, error?: string, payload?: object }}
 */
export function verifyRotatingToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') {
    return { valid: false, error: 'Token no proporcionado o inválido.' };
  }

  try {
    let base64 = tokenStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = atob(base64);
    const payload = JSON.parse(jsonStr);

    if (!payload || typeof payload.w !== 'number' || !payload.exp || !payload.sig) {
      return { valid: false, error: 'Estructura de token ilegible o corrupta.' };
    }

    const expectedSig = simpleHash(`${payload.w}_${QR_SECRET}_${payload.exp}`);
    if (payload.sig !== expectedSig) {
      return { valid: false, error: 'Firma de seguridad inválida o manipulada.' };
    }

    const now = Date.now();
    const currentWindow = Math.floor(now / (TOKEN_WINDOW_SECONDS * 1000));

    const windowDiff = currentWindow - payload.w;
    if (windowDiff < 0 || windowDiff > 1) {
      return { 
        valid: false, 
        error: 'El código QR ha expirado. Por favor escanee el código actual en pantalla.',
        expired: true 
      };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Error al decodificar el token de asistencia: ' + err.message };
  }
}

/**
 * Construye la URL de marcaje perimetral para el escaneo móvil
 * @param {string} [token] - Token a codificar
 * @returns {string} URL completa de marcaje
 */
export function getAttendanceScanUrl(token = null) {
  const currentToken = token || generateRotatingToken();
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `${origin}${pathname}?view=asistencia&token=${encodeURIComponent(currentToken)}`;
}

/**
 * Renderiza el código QR en un elemento Canvas HTML5
 * @param {HTMLCanvasElement} canvasEl - Elemento canvas
 * @param {string} text - Texto o URL a codificar
 * @param {object} [options] - Opciones de renderizado QRCode
 * @returns {Promise<void>}
 */
export async function renderQRToCanvas(canvasEl, text, options = {}) {
  const defaultOpts = {
    width: options.width || 220,
    margin: options.margin !== undefined ? options.margin : 2,
    color: {
      dark: '#002244',
      light: '#ffffff'
    },
    errorCorrectionLevel: 'M'
  };
  return QRCode.toCanvas(canvasEl, text, { ...defaultOpts, ...options });
}

/**
 * Genera el Data URL de un código QR
 * @param {string} text - Texto o URL
 * @returns {Promise<string>}
 */
export async function generateQRDataURL(text) {
  return QRCode.toDataURL(text, {
    width: 260,
    margin: 2,
    color: {
      dark: '#002244',
      light: '#ffffff'
    }
  });
}

/**
 * Registra un evento de marcaje de asistencia (Entrada o Salida)
 * @param {object} params
 * @param {string} params.employeeCode - Código oficial de empleado
 * @param {'ENTRADA'|'SALIDA'} params.type - Tipo de marcaje
 * @param {string} [params.ipAddress] - Dirección IP detectada
 * @param {string} [params.userAgent] - Agente de usuario
 * @param {object} params.state - Estado global de la aplicación
 * @returns {Promise<{ success: boolean, message?: string, error?: string, record?: object, employee?: object }>}
 */
export async function recordAttendance({ employeeCode, type, ipAddress, userAgent, state }) {
  if (!employeeCode || typeof employeeCode !== 'string') {
    return { success: false, error: 'Por favor ingrese su Código de Empleado.' };
  }

  let cleanCode = employeeCode.trim().toUpperCase();
  // Normalizar códigos numéricos simples (ej: "1" o "001" -> "EMP-001")
  if (/^\d+$/.test(cleanCode)) {
    cleanCode = `EMP-${cleanCode.padStart(3, '0')}`;
  } else if (/^EMP\d+$/i.test(cleanCode)) {
    const numPart = cleanCode.replace(/^EMP/i, '');
    cleanCode = `EMP-${numPart.padStart(3, '0')}`;
  } else if (/^EMP-\d+$/i.test(cleanCode)) {
    const numPart = cleanCode.replace(/^EMP-/i, '');
    cleanCode = `EMP-${numPart.padStart(3, '0')}`;
  }

  state.administracion_employees = state.administracion_employees || [];
  state.administracion_asistencias = state.administracion_asistencias || [];

  // Buscar por código normalizado, código original, o ID de colaborador
  let employee = state.administracion_employees.find(e => 
    (e.employee_code && e.employee_code.trim().toUpperCase() === cleanCode) ||
    (e.employee_code && e.employee_code.trim().toUpperCase() === employeeCode.trim().toUpperCase()) ||
    (e.id && String(e.id).trim().toUpperCase() === employeeCode.trim().toUpperCase())
  );

  // Búsqueda alternativa por nombre exacto si el código no coincide
  if (!employee) {
    const rawInputLower = employeeCode.trim().toLowerCase();
    employee = state.administracion_employees.find(e => 
      e.name && e.name.trim().toLowerCase() === rawInputLower
    );
  }

  if (!employee) {
    return { 
      success: false, 
      error: `El código "${cleanCode}" no corresponde a ningún colaborador registrado en LUGAMED. Verifica tu código en Recursos Humanos.` 
    };
  }

  if (employee.status && employee.status !== 'Activo') {
    return { 
      success: false, 
      error: `El colaborador ${employee.name} (${employee.employee_code || cleanCode}) se encuentra en estado "${employee.status}". No puede marcar asistencia.` 
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const todayYMD = now.toLocaleDateString('en-CA');
  const currentTimeStr = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  // Anti-duplicados: verificar si marcó el mismo evento hace menos de 2 minutos (120,000 ms)
  const recentRecords = state.administracion_asistencias.filter(a => a.employee_id === employee.id);
  const lastRecord = recentRecords.length > 0 ? recentRecords[0] : null;

  if (lastRecord) {
    const lastTime = new Date(lastRecord.created_at).getTime();
    const diffMs = now.getTime() - lastTime;
    if (diffMs < 120000 && lastRecord.type === type) {
      const waitSeconds = Math.ceil((120000 - diffMs) / 1000);
      return {
        success: false,
        error: `Ya registraste tu ${type === 'ENTRADA' ? 'Entrada' : 'Salida'} hace un momento (${Math.floor(diffMs / 1000)}s atrás). Espera ${waitSeconds}s antes de marcar de nuevo para evitar duplicados.`
      };
    }
  }

  let shiftStartHour = 7;
  let shiftStartMinute = 0;
  const shift = employee.shift || 'Matutino';

  if (shift === 'Vespertino') {
    shiftStartHour = 13;
  } else if (shift === 'Nocturno') {
    shiftStartHour = 19;
  } else if (shift === 'Mixto') {
    shiftStartHour = 8;
  } else {
    shiftStartHour = 7;
  }

  let status = 'ON_TIME';
  let lateMinutes = 0;
  let hoursWorked = null;

  if (type === 'ENTRADA') {
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const totalMinutesNow = (currentHour * 60) + currentMin;
    const shiftTotalMinutes = (shiftStartHour * 60) + shiftStartMinute;

    if (totalMinutesNow > (shiftTotalMinutes + 15)) {
      status = 'LATE';
      lateMinutes = totalMinutesNow - shiftTotalMinutes;
    } else {
      status = 'ON_TIME';
      lateMinutes = 0;
    }
  } else if (type === 'SALIDA') {
    status = 'ON_TIME';
    const todaysEntry = state.administracion_asistencias.find(a => 
      a.employee_id === employee.id && a.date === todayYMD && a.type === 'ENTRADA'
    );
    if (todaysEntry && todaysEntry.time_in) {
      const inTime = new Date(todaysEntry.time_in).getTime();
      const outTime = now.getTime();
      const diffHours = (outTime - inTime) / (1000 * 60 * 60);
      hoursWorked = Math.max(0, parseFloat(diffHours.toFixed(2)));
    }
  }

  const newAttendance = {
    id: 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    employee_id: employee.id,
    employee_code: employee.employee_code,
    employee_name: employee.name,
    department: employee.department || employee.specialty || 'General',
    shift: employee.shift || 'Matutino',
    date: todayYMD,
    time_in: type === 'ENTRADA' ? nowIso : null,
    time_out: type === 'SALIDA' ? nowIso : null,
    time_str: currentTimeStr,
    type: type,
    status: status,
    lateMinutes: lateMinutes,
    hoursWorked: hoursWorked,
    ip_address: ipAddress || '192.168.1.100',
    user_agent: userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Móvil QR LUGAMED'),
    created_at: nowIso,
    updated_at: nowIso
  };

  state.administracion_asistencias.unshift(newAttendance);
  await saveAppState(state);

  return {
    success: true,
    message: `${type === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada correctamente para ${employee.name}.`,
    record: newAttendance,
    employee: employee
  };
}
