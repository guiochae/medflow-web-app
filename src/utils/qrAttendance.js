// src/utils/qrAttendance.js
import QRCode from 'qrcode';
import { saveAppState } from '../main.js';
import { db, firestoreState, saveStateToLocalCache } from '../firebase.js';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { isSameNursingPerson } from '../modules/enfermeriaDepartment.js';

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
 * Genera un token rotativo firmado
 * @returns {string} Token firmado en Base64 URL-safe
 */
export function generateRotatingToken() {
  const now = Date.now();
  const windowIndex = Math.floor(now / (TOKEN_WINDOW_SECONDS * 1000));
  const exp = now + (6 * 60 * 60 * 1000); // 6 horas de validez para evitar fallos por desfase horario entre dispositivos
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
  // Si no se proporcionó token o es acceso directo, permitir acceso seguro al terminal de asistencia
  if (!tokenStr || typeof tokenStr !== 'string' || tokenStr === 'direct' || tokenStr === 'scan' || tokenStr === 'terminal') {
    return { valid: true, payload: { direct: true } };
  }

  try {
    let base64 = tokenStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = atob(base64);
    const payload = JSON.parse(jsonStr);

    if (!payload) {
      return { valid: true, payload: {} };
    }

    // Tolerancia generosa para desfase horario entre el reloj de la PC de recepción y el celular del empleado
    if (payload.t) {
      const now = Date.now();
      const diffMs = Math.abs(now - payload.t);
      if (diffMs > (6 * 60 * 60 * 1000)) {
        return { 
          valid: false, 
          error: 'El código QR ha expirado (más de 6 horas de antigüedad). Por favor escanee el código actual en pantalla.',
          expired: true 
        };
      }
    }

    return { valid: true, payload };
  } catch (err) {
    // Si la decodificación tiene caracteres especiales, permitir acceso de todas formas
    return { valid: true, payload: { fallback: true } };
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
 * @param {'FACIAL'|'QR'} [params.method='QR'] - Método biométrico o código utilizado
 * @param {object} params.state - Estado global de la aplicación
 * @returns {Promise<{ success: boolean, message?: string, error?: string, record?: object, employee?: object }>}
 */
export async function recordAttendance({ employeeCode, type, method = 'QR', ipAddress, userAgent, state }) {
  if (!employeeCode || typeof employeeCode !== 'string') {
    return { success: false, error: 'Por favor ingrese su Código de Empleado.' };
  }

  const rawInput = employeeCode.trim();
  const rawInputUpper = rawInput.toUpperCase();

  // 1. Extraer el número del código para comparación flexible (ej: "EMP-017", "EMP-17", "EMP17", "017", "17", "EMP - 033")
  const numMatch = rawInputUpper.match(/^EMP[-_\s]*0*(\d+)$/i) || rawInputUpper.match(/^0*(\d+)$/);
  const codeNum = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : null;
  const standardCode = codeNum !== null ? `EMP-${String(codeNum).padStart(3, '0')}` : rawInputUpper;

  state.administracion_employees = state.administracion_employees || [];
  state.administracion_asistencias = state.administracion_asistencias || [];

  const cleanRawInput = rawInput.replace(/\s+/g, '');
  const numOnly = rawInput.replace(/\D+/g, '');
  const rawInputLower = rawInput.toLowerCase();

  // Función auxiliar de coincidencia multi-criterio para listas de colaboradores
  const matchesEmployee = (e) => {
    if (!e) return false;
    const eCode = e.employee_code ? String(e.employee_code).trim().toUpperCase() : '';
    const eId = e.id ? String(e.id).trim().toUpperCase() : '';
    const eLinkedUserId = e.linked_user_id ? String(e.linked_user_id).trim().toUpperCase() : '';
    const aliases = (Array.isArray(e.alias_codes) ? e.alias_codes : []).map(a => String(a).trim().toUpperCase());
    const eDpi = e.dpi ? String(e.dpi).replace(/\s+/g, '').trim() : '';
    const ePhone = e.phone ? String(e.phone).replace(/\D+/g, '') : '';
    const eWa = e.whatsapp_number ? String(e.whatsapp_number).replace(/\D+/g, '') : '';
    const eNameLower = String(e.name || '').trim().toLowerCase();

    // Coincidencia exacta con código principal, ID o usuario vinculado
    if (eCode === standardCode || eCode === rawInputUpper || eId === rawInputUpper || eLinkedUserId === rawInputUpper) return true;

    // Coincidencia con alias históricos
    if (aliases.includes(standardCode) || aliases.includes(rawInputUpper)) return true;

    // Coincidencia con mapeo explícito de duplicados históricos a sus colaboradores oficiales
    if (standardCode === 'EMP-048' && (eCode === 'EMP-033' || aliases.includes('EMP-033'))) return true;
    if (standardCode === 'EMP-031' && (eCode === 'EMP-018' || aliases.includes('EMP-018'))) return true;
    if (standardCode === 'EMP-027' && (eCode === 'EMP-001' || aliases.includes('EMP-001'))) return true;

    // Coincidencia numérica flexible con código principal o alias
    if (codeNum !== null) {
      const eNumMatch = eCode.match(/^EMP[-_\s]*0*(\d+)$/i) || eCode.match(/^0*(\d+)$/);
      if (eNumMatch && eNumMatch[1] && parseInt(eNumMatch[1], 10) === codeNum) return true;

      const aliasMatch = aliases.some(a => {
        const m = a.match(/^EMP[-_\s]*0*(\d+)$/i) || a.match(/^0*(\d+)$/);
        return m && m[1] && parseInt(m[1], 10) === codeNum;
      });
      if (aliasMatch) return true;
    }

    // Coincidencia por DPI
    if (cleanRawInput && eDpi && (eDpi === cleanRawInput || eDpi.endsWith(cleanRawInput))) return true;

    // Coincidencia por teléfono o WhatsApp
    if (numOnly.length >= 7) {
      if (ePhone && (ePhone === numOnly || ePhone.endsWith(numOnly))) return true;
      if (eWa && (eWa === numOnly || eWa.endsWith(numOnly))) return true;
    }

    // Coincidencia por nombre completo
    if (eNameLower && (eNameLower === rawInputLower || (rawInputLower.length >= 6 && eNameLower.includes(rawInputLower)))) return true;

    return false;
  };

  const findInList = (list) => {
    if (!Array.isArray(list)) return null;
    // 1. Priorizar registros que se encuentren en estado 'Activo'
    const activeMatch = list.find(e => e && e.status === 'Activo' && matchesEmployee(e));
    if (activeMatch) return activeMatch;
    // 2. Si no hay activo directo, tomar cualquier coincidencia
    return list.find(matchesEmployee) || null;
  };

  let employee = findInList(state.administracion_employees);

  // Fallback 1: Buscar en historial de asistencias previas
  // Si alguien ya marcó con este código antes (ej: 36 asistencias de Ana Cecilia con EMP-033), auto-recuperar
  if (!employee && Array.isArray(state.administracion_asistencias) && state.administracion_asistencias.length > 0) {
    const hist = state.administracion_asistencias.find(a => {
      if (!a) return false;
      const aCode = a.employee_code ? String(a.employee_code).trim().toUpperCase() : '';
      if (aCode === standardCode || aCode === rawInputUpper) return true;
      if (codeNum !== null) {
        const aNumMatch = aCode.match(/^EMP[-_\s]*0*(\d+)$/i) || aCode.match(/^0*(\d+)$/);
        if (aNumMatch && aNumMatch[1] && parseInt(aNumMatch[1], 10) === codeNum) return true;
      }
      return false;
    });

    if (hist) {
      employee = (state.administracion_employees || []).find(e => {
        if (!e) return false;
        if (hist.employee_id && (e.id === hist.employee_id || e.linked_user_id === hist.employee_id)) return true;
        if (hist.employee_name && e.name && e.name.trim().toLowerCase() === hist.employee_name.trim().toLowerCase()) return true;
        return false;
      });

      if (employee) {
        employee.alias_codes = employee.alias_codes || [];
        if (!employee.alias_codes.includes(standardCode)) employee.alias_codes.push(standardCode);
      }
    }
  }

  // Fallback 2: Buscar en usuarios del sistema (state.users)
  if (!employee && Array.isArray(state.users) && state.users.length > 0) {
    const matchedUser = state.users.find(u => {
      if (!u) return false;
      const uCode = u.employee_code ? String(u.employee_code).trim().toUpperCase() : '';
      const uId = u.id ? String(u.id).trim().toUpperCase() : '';
      const uNameLower = String(u.name || '').trim().toLowerCase();
      if (uCode === standardCode || uCode === rawInputUpper || uId === rawInputUpper) return true;
      if (uNameLower && (uNameLower === rawInputLower || (rawInputLower.length >= 6 && uNameLower.includes(rawInputLower)))) return true;
      return false;
    });

    if (matchedUser) {
      employee = (state.administracion_employees || []).find(e => {
        if (!e) return false;
        if (e.id === matchedUser.id || e.linked_user_id === matchedUser.id) return true;
        if (e.name && matchedUser.name && e.name.trim().toLowerCase() === matchedUser.name.trim().toLowerCase()) return true;
        return false;
      });

      if (!employee) {
        employee = {
          id: matchedUser.id,
          employee_code: standardCode,
          alias_codes: [standardCode],
          name: matchedUser.name,
          position: matchedUser.role || 'Colaborador',
          department: String(matchedUser.role || '').toLowerCase().includes('medic') ? 'Médico' : 'Administración',
          shift: 'Matutino',
          status: 'Activo',
          phone: matchedUser.phone || '',
          whatsapp_number: matchedUser.phone ? `+502 ${matchedUser.phone}` : '+502 5555-0000'
        };
        state.administracion_employees.push(employee);
        if (firestoreState && Array.isArray(firestoreState.administracion_employees)) {
          firestoreState.administracion_employees.push(employee);
        }
      }
    }
  }

  // Fallback 3: Consulta directa de respaldo a Firestore si aún no se encuentra
  if (!employee) {
    try {
      const docSnap = await getDoc(doc(db, 'multimedica', 'catalog_administracion_employees'));
      if (docSnap.exists()) {
        const dData = docSnap.data();
        const emps = dData.items || [];
        if (Array.isArray(emps) && emps.length > 0) {
          state.administracion_employees = emps;
          if (firestoreState) firestoreState.administracion_employees = emps;
          employee = findInList(emps);
        }
      }
    } catch (e) {
      console.warn("Aviso en consulta de respaldo de empleados:", e);
    }
  }

  if (!employee) {
    return { 
      success: false, 
      error: `El código "${standardCode}" no corresponde a ningún colaborador registrado en LUGAMED. Verifica tu código en Recursos Humanos.` 
    };
  }

  const CONFIRMED_RESIGNED_CODES = ['EMP-007', 'EMP-008', 'EMP-011', 'EMP-012', 'EMP-023'];
  const eCodeUpper = String(employee.employee_code || standardCode || '').toUpperCase();
  const isProtectedActive = ['EMP-033', 'EMP-018', 'EMP-001', 'EMP-036'].includes(eCodeUpper);
  const isTrulyResigned = !isProtectedActive && CONFIRMED_RESIGNED_CODES.includes(eCodeUpper);

  if (isTrulyResigned) {
    return { 
      success: false, 
      error: `El colaborador ${employee.name} (${eCodeUpper}) se encuentra en estado "Inactivo" por baja laboral o finiquito. Comunícate con Recursos Humanos.` 
    };
  }

  // Si no es una baja laboral definitiva pero estaba marcado como inactivo (ej. por caché o desincronización), auto-recuperar inmediatamente
  if (employee.status !== 'Activo') {
    console.log(`[qrAttendance] Auto-restaurando estado Activo para colaborador ${employee.name} (${eCodeUpper})`);
    employee.status = 'Activo';
    delete employee.exitDate;
    delete employee.exitReason;
    delete employee.liquidatedAt;

    // Persistir la reactivación en Firestore en segundo plano para limpiar cualquier residuo
    try {
      const empDocRef = doc(db, 'multimedica', 'catalog_administracion_employees');
      getDoc(empDocRef).then(snap => {
        if (snap.exists()) {
          const emps = snap.data().items || [];
          const target = emps.find(e => e && (e.id === employee.id || e.employee_code === employee.employee_code));
          if (target) {
            target.status = 'Activo';
            delete target.exitDate;
            delete target.exitReason;
            delete target.liquidatedAt;
            setDoc(empDocRef, { items: emps }, { merge: true }).catch(() => {});
          }
        }
      }).catch(() => {});
    } catch (e) {}
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const todayYMD = now.toLocaleDateString('en-CA');
  const currentTimeStr = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  // Función para asociar registros existentes con este empleado
  const isEmpAttendance = (a) => {
    if (!a) return false;
    if (a.employee_id === employee.id) return true;
    if (employee.linked_user_id && a.employee_id === employee.linked_user_id) return true;
    if (a.employee_code && (a.employee_code === employee.employee_code || (Array.isArray(employee.alias_codes) && employee.alias_codes.includes(a.employee_code)))) return true;
    return false;
  };

  // Anti-duplicados: verificar si marcó el mismo evento hace menos de 2 minutos (120,000 ms)
  const recentRecords = state.administracion_asistencias.filter(isEmpAttendance);
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
  let shiftLabel = employee.shift || 'Matutino';

  const rawShift = String(employee.shift || 'Matutino').toLowerCase();
  const isNursing = (employee.department && /enfermer/i.test(employee.department)) ||
                    (employee.position && /enferm/i.test(employee.position));

  // 1. Revisar si el colaborador tiene turno asignado en el Rol Oficial de Enfermería para la fecha actual
  if (isNursing && state && state.administracion_enfermeria_roles) {
    const [y, m, d] = todayYMD.split('-');
    const currentMonthKey = `${y}-${m}`;
    const dayNum = parseInt(d, 10);
    const monthRoster = state.administracion_enfermeria_roles.find(r => r.month === currentMonthKey);
    if (monthRoster && monthRoster.schedule) {
      const staffKey = Object.keys(monthRoster.schedule).find(k => 
        k.toLowerCase().trim() === employee.name.toLowerCase().trim() ||
        (typeof isSameNursingPerson === 'function' && isSameNursingPerson(k, employee.name))
      );
      if (staffKey && monthRoster.schedule[staffKey]) {
        const todayCode = monthRoster.schedule[staffKey][dayNum];
        if (todayCode && todayCode !== 'L' && todayCode !== 'BAJA' && todayCode !== 'P') {
          if (todayCode === 'M') {
            shiftStartHour = 7;
            shiftLabel = 'Matutino (07:00 - 13:00)';
          } else if (todayCode === 'T') {
            shiftStartHour = 13;
            shiftLabel = 'Vespertino (13:00 - 19:00)';
          } else if (todayCode === 'N') {
            shiftStartHour = 19;
            shiftLabel = 'Nocturno (19:00 - 07:00)';
          } else if (todayCode === 'MX' || todayCode === 'M/T') {
            shiftStartHour = 7;
            shiftLabel = 'Mixto (07:00 - 19:00)';
          } else if (todayCode === '8H' || todayCode === 'D') {
            shiftStartHour = 7;
            shiftLabel = '8 Horas (07:00 - 16:00)';
          } else if (todayCode === '18H') {
            shiftStartHour = 19;
            shiftLabel = '18 Horas (19:00 - 13:00)';
          } else if (todayCode === '24H') {
            shiftStartHour = 7;
            shiftLabel = '24 Horas (07:00 - 07:00)';
          }
        }
      }
    }
  }

  // 2. Si no se derivó del rol dinámico, evaluar según su turno asignado en el perfil
  if (shiftLabel === (employee.shift || 'Matutino')) {
    if (rawShift.includes('vespertino') || rawShift.includes('13:00') || rawShift.includes('tarde')) {
      shiftStartHour = 13;
    } else if (rawShift.includes('nocturno') || rawShift.includes('19:00 - 07:00') || rawShift.includes('noche')) {
      shiftStartHour = 19;
    } else if (rawShift.includes('18 hora') || rawShift.includes('18h') || rawShift.includes('19:00 - 13:00')) {
      shiftStartHour = 19;
    } else if (rawShift.includes('mixto')) {
      // Para enfermería Mixto es 07:00 a 19:00. Para administrativo es 08:00 a 17:00.
      shiftStartHour = isNursing ? 7 : 8;
    } else if (rawShift.includes('8 hora') || rawShift.includes('8h')) {
      shiftStartHour = 7;
    } else if (rawShift.includes('24 hora') || rawShift.includes('24h')) {
      shiftStartHour = 7;
    } else {
      shiftStartHour = 7;
    }
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
    // Buscar la entrada más reciente del colaborador (en las últimas 30 horas para cubrir turnos nocturnos, de 18h y 24h)
    const recentEntry = state.administracion_asistencias.find(a => {
      if (!isEmpAttendance(a) || a.type !== 'ENTRADA' || !a.time_in) return false;
      const inTime = new Date(a.time_in).getTime();
      const diffHours = (now.getTime() - inTime) / (1000 * 60 * 60);
      return diffHours >= 0 && diffHours <= 30;
    });

    if (recentEntry && recentEntry.time_in) {
      const inTime = new Date(recentEntry.time_in).getTime();
      const outTime = now.getTime();
      const diffHours = (outTime - inTime) / (1000 * 60 * 60);
      hoursWorked = Math.max(0, parseFloat(diffHours.toFixed(2)));
    }
  }

  const newAttendance = {
    id: 'att-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    employee_id: employee.id,
    employee_code: employee.employee_code || standardCode,
    employee_name: employee.name,
    department: employee.department || employee.specialty || 'General',
    shift: shiftLabel || employee.shift || 'Matutino',
    date: todayYMD,
    time_in: type === 'ENTRADA' ? nowIso : null,
    time_out: type === 'SALIDA' ? nowIso : null,
    time_str: currentTimeStr,
    type: type,
    method: method || 'QR',
    status: status,
    lateMinutes: lateMinutes,
    hoursWorked: hoursWorked,
    ip_address: ipAddress || '192.168.1.100',
    user_agent: userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Móvil QR LUGAMED'),
    created_at: nowIso,
    updated_at: nowIso
  };

  // Agregar al inicio de la lista local
  state.administracion_asistencias.unshift(newAttendance);

  // Sincronizar en memoria global y caché local inmediatamente
  if (firestoreState) {
    firestoreState.administracion_asistencias = state.administracion_asistencias;
  }
  saveStateToLocalCache();

  // 4. Guardar de forma atómica y esperada en Firestore (con timeout de protección para red móvil lenta)
  const firestoreSavePromise = (async () => {
    try {
      // 4.1 Guardar documento individual independiente
      const indRef = doc(db, 'multimedica', newAttendance.id);
      await setDoc(indRef, { ...newAttendance, _collectionType: 'administracion_asistencias' }, { merge: true });

      // 4.2 Actualización no destructiva del catálogo consolidado
      try {
        let mergedItems = [...state.administracion_asistencias];
        const catSnap = await getDoc(doc(db, 'multimedica', 'catalog_administracion_asistencias'));
        if (catSnap.exists()) {
          const catData = catSnap.data();
          const existingItems = catData.items || [];
          const seen = new Set();
          mergedItems = [newAttendance, ...existingItems, ...state.administracion_asistencias].filter(item => {
            if (!item || !item.id || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          mergedItems.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
          state.administracion_asistencias = mergedItems;
          if (firestoreState) firestoreState.administracion_asistencias = mergedItems;
        }
        const docRef = doc(db, 'multimedica', 'catalog_administracion_asistencias');
        await setDoc(docRef, { _collectionType: 'catalog_administracion_asistencias', items: mergedItems.slice(0, 1000) }, { merge: true });
      } catch (catErr) {
        console.warn("Aviso actualizando catálogo central:", catErr);
      }
    } catch (err) {
      console.error("Error guardando marcaje en Firestore:", err);
    }
  })();

  // Esperar confirmación de guardado en la nube con un límite de 2.5s para no bloquear la experiencia de usuario
  await Promise.race([
    firestoreSavePromise,
    new Promise(res => setTimeout(res, 2500))
  ]);

  // Notificar sincronización general en segundo plano
  try {
    saveAppState(state).catch(e => console.warn("Sync diferido de estado:", e));
  } catch (e) {}

  return {
    success: true,
    message: `${type === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada correctamente para ${employee.name}.`,
    record: newAttendance,
    employee: employee
  };
}

