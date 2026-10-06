// src/modules/enfermeriaDepartment.js
import { saveAppState } from '../main.js';
import { db, doc, setDoc } from '../firebase.js';

// ==============================================================================
// 👩‍⚕️ SUBMÓDULO: GESTIÓN INTEGRAL DEL DEPARTAMENTO DE ENFERMERÍA (RRHH)
// ==============================================================================

// Catálogo Oficial de Turnos y Códigos
export const SHIFT_TYPES = {
  'M': { code: 'M', name: 'Mañana', hours: 8, schedule: '07:00 - 15:00', bg: '#0284c7', color: '#ffffff', lightBg: 'rgba(2, 132, 199, 0.15)', desc: 'Turno Matutino' },
  'T': { code: 'T', name: 'Tarde', hours: 8, schedule: '15:00 - 23:00', bg: '#16a34a', color: '#ffffff', lightBg: 'rgba(22, 163, 74, 0.15)', desc: 'Turno Vespertino' },
  'N': { code: 'N', name: 'Noche', hours: 12, schedule: '19:00 - 07:00', bg: '#dc2626', color: '#ffffff', lightBg: 'rgba(220, 38, 38, 0.15)', desc: 'Turno Nocturno' },
  'L': { code: 'L', name: 'Libre', hours: 0, schedule: 'Descanso Reglamentario', bg: '#64748b', color: '#ffffff', lightBg: 'rgba(100, 116, 139, 0.15)', desc: 'Descanso / Libre' },
  'M/T': { code: 'M/T', name: 'Mañana + Tarde', hours: 16, schedule: '07:00 - 23:00', bg: '#d97706', color: '#ffffff', lightBg: 'rgba(217, 119, 6, 0.15)', desc: 'Turno Doble Diurno' },
  '18H': { code: '18H', name: 'Especial 18 Horas', hours: 18, schedule: 'Jornada Especial 18h', bg: '#ca8a04', color: '#ffffff', lightBg: 'rgba(202, 138, 4, 0.2)', desc: 'Turno Especial 18 Horas' },
  '24H': { code: '24H', name: 'Especial 24 Horas', hours: 24, schedule: 'Jornada Continua 24h', bg: '#ea580c', color: '#ffffff', lightBg: 'rgba(234, 88, 12, 0.2)', desc: 'Turno Especial 24 Horas' },
  'D': { code: 'D', name: 'Día / Administrativo', hours: 8, schedule: '08:00 - 17:00', bg: '#6366f1', color: '#ffffff', lightBg: 'rgba(99, 102, 241, 0.15)', desc: 'Jornada Diurna Fija (8 Horas / Jefa)' },
  'P': { code: 'P', name: 'Permiso / Licencia', hours: 0, schedule: 'Permiso Oficial Autorizado', bg: '#db2777', color: '#ffffff', lightBg: 'rgba(219, 39, 119, 0.15)', desc: 'Permiso / Licencia' }
};

// Plantilla Maestra Oficial de Enfermería (Extraída del Roster Hospitalario de Sayaxché Petén)
export const DEFAULT_NURSING_ROSTER_SAMPLE = [
  { name: 'VANESSA MORALES', role: 'ENFERMERA PROFESIONAL', isJefa: true, isFixed8h: true, shifts: ['D','D','M','L','D','D','D','D','D','M','L','D','D','D','D','D','M','L','D','D','D','D','D','M','L','D','D','D','D','D','L'] },
  { name: 'E. ALBERTO LUCAS', role: 'ENFERMERO', isJefa: false, isFixed8h: false, shifts: ['L','L','18H','24H','L','L','N','L','L','18H','24H','L','L','N','L','L','18H','24H','L','L','N','L','L','18H','24H','L','L','N','L','L','18H'] },
  { name: 'A.E. SONIA AX', role: 'AUXILIAR DE ENFERMERIA', isJefa: false, isFixed8h: false, shifts: ['L','M','N','T','N','L','M','N','T','L','L','M','N','T','N','L','M','T','M/T','L','L','N','L','M','N','T','N','L','L','N','L'] },
  { name: 'A.E. AURA CHOC', role: 'AUXILIAR DE ENFERMERIA', isJefa: false, isFixed8h: false, shifts: ['L','N','L','T','M/T','L','M','N','T','L','L','18H','M','L','L','L','L','M','T','M/T','L','L','N','L','L','M','N','T','N','L','L'] },
  { name: 'E. FRANKLYN JUAREZ', role: 'ENFERMERO', isJefa: false, isFixed8h: false, shifts: ['L','N','T','N','L','T','L','N','L','L','18H','L','L','M','N','L','18H','L','M','N','L','L','M','T','18H','L','L','N','L','L','18H'] },
  { name: 'GAVINO HERNANDEZ', role: 'ENFERMERO', isJefa: false, isFixed8h: false, shifts: ['N','L','M','L','N','T','T','M','N','T','L','T','M','N','L','M','L','L','N','T','M','T','T','M','L','L','M','L','L','M','L'] },
  { name: 'A.E. JARVI SON', role: 'AUXILIAR DE ENFERMERIA', isJefa: false, isFixed8h: false, shifts: ['N','T','T','L','M','N','T','L','T','T','N','M','M','T','N','T','M','L','M','N','T','T','M','N','T','N','L','L','T','T','M'] },
  { name: 'A.E. WILSON XOL', role: 'AUXILIAR DE ENFERMERIA', isJefa: false, isFixed8h: false, shifts: ['N','T','L','M','T','N','T','L','M','N','T','M','M','L','M','N','T','M','L','N','T','T','M','N','L','T','M','T','N','T','M'] },
  { name: 'E. DOLORES TZUNJA', role: 'ENFERMERA', isJefa: false, isFixed8h: false, shifts: ['M','N','L','M','T','N','L','M','M','M','M','L','M','N','T','N','L','M','T','L','M','N','T','T','M','M','T','M','L','L','N'] },
  { name: 'A.E. GILBER TOC', role: 'AUXILIAR DE ENFERMERIA', isJefa: false, isFixed8h: false, shifts: ['T','M','N','L','M','M','T','T','M','M','L','N','T','M','M','T','M','L','M','M','T','T','M','T','M','L','N','T','T','M','N'] },
  { name: 'A.E. ESTER COC', role: 'AUXILIAR DE ENFERMERIA', isJefa: false, isFixed8h: false, shifts: ['T','M','M','N','L','M','N','T','M','T','M','T','N','T','T','M','T','L','M','M','T','N','T','M','L','M','T','N','L','N','T'] },
  { name: 'A.E. MARIELA CHOC', role: 'AUXILIAR DE ENFERMERIA', isJefa: false, isFixed8h: false, shifts: ['M','T','M','L','N','T','M','M','N','L','M','M','N','T','M','M','T','L','N','T','M','N','T','L','M','M','L','M','M','M','N'] }
];

let activeEnfSubTab = 'rol-turnos';
let currentRosterMonth = new Date().toISOString().substring(0, 7);

export function isUserJefaEnfermeria(currentUser) {
  if (!currentUser) return false;
  const role = String(currentUser.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const name = String(currentUser.name || '').toLowerCase();
  return role.includes('enfermer') || role.includes('jefa') || name.includes('vanessa morales') || role.includes('admin');
}

export function isUserShiftAuthorizer(currentUser) {
  if (!currentUser) return false;
  const role = String(currentUser.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const name = String(currentUser.name || '').toLowerCase();
  return role.includes('admin') || role.includes('medico 1') || role.includes('médico 1') || name === 'administrador';
}

export function isEmployeeJefa(emp) {
  if (!emp) return false;
  const name = String(emp.name || '').toLowerCase();
  const pos = String(emp.position || emp.role || '').toLowerCase();
  return name.includes('vanessa morales') || pos.includes('jefa') || pos.includes('jefe') || emp.isJefa === true;
}

export function renderRrhhEnfermeria(container, state) {
  state.administracion_enfermeria_roles = state.administracion_enfermeria_roles || [];
  state.administracion_enfermeria_cambios = state.administracion_enfermeria_cambios || [];
  state.administracion_enfermeria_permisos = state.administracion_enfermeria_permisos || [];
  state.administracion_employees = state.administracion_employees || [];

  ensureNursingEmployeesSeeded(state);

  const pendingChangesCount = state.administracion_enfermeria_cambios.filter(c => c.status === 'Pendiente').length;
  const pendingPermitsCount = state.administracion_enfermeria_permisos.filter(p => p.status === 'Pendiente').length;

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px;">
      <div>
        <h2 style="font-size: 1.25rem; color: var(--accent-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
          <span>👩‍⚕️</span> Gestión Departamento de Enfermería
        </h2>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin: 2px 0 0 0;">
          Rol mensual de turnos, matriz de idoneidad y equidad, flujo de cambio de turnos y permisos de jornada.
        </p>
      </div>

      <div style="display: flex; gap: 8px; background: rgba(0,0,0,0.25); padding: 4px; border-radius: 8px; border: 1px solid var(--border-color); overflow-x: auto;">
        <button class="btn ${activeEnfSubTab === 'rol-turnos' ? 'btn-primary' : 'btn-secondary'} btn-small" id="enf-subtab-rol" style="padding: 6px 12px; font-size: 0.8rem;">
          📅 Rol de Turnos
        </button>
        <button class="btn ${activeEnfSubTab === 'cambios' ? 'btn-primary' : 'btn-secondary'} btn-small" id="enf-subtab-cambios" style="padding: 6px 12px; font-size: 0.8rem; position: relative;">
          🔄 Cambio de Turnos
          ${pendingChangesCount > 0 ? `<span style="position: absolute; top: -5px; right: -5px; background: #ef4444; color: #fff; font-size: 0.65rem; padding: 2px 6px; border-radius: 10px; font-weight: bold;">${pendingChangesCount}</span>` : ''}
        </button>
        <button class="btn ${activeEnfSubTab === 'permisos' ? 'btn-primary' : 'btn-secondary'} btn-small" id="enf-subtab-permisos" style="padding: 6px 12px; font-size: 0.8rem; position: relative;">
          📝 Permisos y Licencias
          ${pendingPermitsCount > 0 ? `<span style="position: absolute; top: -5px; right: -5px; background: #3b82f6; color: #fff; font-size: 0.65rem; padding: 2px 6px; border-radius: 10px; font-weight: bold;">${pendingPermitsCount}</span>` : ''}
        </button>
        <button class="btn ${activeEnfSubTab === 'personal' ? 'btn-primary' : 'btn-secondary'} btn-small" id="enf-subtab-personal" style="padding: 6px 12px; font-size: 0.8rem;">
          👥 Plantilla Enfermería
        </button>
      </div>
    </div>

    <div id="enf-content-area"></div>
  `;

  document.getElementById('enf-subtab-rol').addEventListener('click', () => { activeEnfSubTab = 'rol-turnos'; renderRrhhEnfermeria(container, state); });
  document.getElementById('enf-subtab-cambios').addEventListener('click', () => { activeEnfSubTab = 'cambios'; renderRrhhEnfermeria(container, state); });
  document.getElementById('enf-subtab-permisos').addEventListener('click', () => { activeEnfSubTab = 'permisos'; renderRrhhEnfermeria(container, state); });
  document.getElementById('enf-subtab-personal').addEventListener('click', () => { activeEnfSubTab = 'personal'; renderRrhhEnfermeria(container, state); });

  const contentArea = document.getElementById('enf-content-area');

  if (activeEnfSubTab === 'rol-turnos') {
    renderEnfermeriaRosterView(contentArea, state);
  } else if (activeEnfSubTab === 'cambios') {
    renderEnfermeriaShiftChangesView(contentArea, state);
  } else if (activeEnfSubTab === 'permisos') {
    renderEnfermeriaPermitsView(contentArea, state);
  } else if (activeEnfSubTab === 'personal') {
    renderEnfermeriaStaffDirectoryView(contentArea, state);
  }
}

function renderEnfermeriaRosterView(container, state) {
  const [yearStr, monthStr] = currentRosterMonth.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10) - 1;
  const totalDays = new Date(yearNum, monthNum + 1, 0).getDate();

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const dayLetters = ["D", "L", "M", "M", "J", "V", "S"];
  
  const currentMonthTitle = `${monthNames[monthNum]} de ${yearNum}`;

  const today = new Date();
  const curMonthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const curDayNum = today.getDate();
  const isInPlanningWindow = (curDayNum >= curMonthDays - 4);
  const isNextMonth = (new Date(yearNum, monthNum, 1) > new Date(today.getFullYear(), today.getMonth(), 1));

  let rosterObj = state.administracion_enfermeria_roles.find(r => r.month === currentRosterMonth);
  if (!rosterObj) {
    rosterObj = {
      id: `ROSTER-${currentRosterMonth}`,
      month: currentRosterMonth,
      status: 'Publicado',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: state.currentUser?.name || 'Jefa de Enfermería',
      schedule: {}
    };

    DEFAULT_NURSING_ROSTER_SAMPLE.forEach(sample => {
      rosterObj.schedule[sample.name] = {};
      for (let d = 1; d <= totalDays; d++) {
        rosterObj.schedule[sample.name][d] = (currentRosterMonth === '2026-10' && sample.shifts[d - 1]) 
          ? sample.shifts[d - 1] 
          : (sample.isFixed8h ? 'D' : 'L');
      }
    });

    state.administracion_enfermeria_roles.push(rosterObj);
  }

  const nursingStaff = getNursingEmployeesList(state);

  nursingStaff.forEach(emp => {
    if (!rosterObj.schedule[emp.name]) {
      rosterObj.schedule[emp.name] = {};
      for (let d = 1; d <= totalDays; d++) {
        rosterObj.schedule[emp.name][d] = isEmployeeJefa(emp) ? 'D' : 'L';
      }
    }
  });

  const fitnessIssues = evaluateRosterFitness(rosterObj.schedule, totalDays, nursingStaff);

  const dailyCoverage = { M: {}, T: {}, N: {}, '18H': {}, '24H': {}, 'M/T': {}, D: {} };
  for (let d = 1; d <= totalDays; d++) {
    dailyCoverage.M[d] = 0;
    dailyCoverage.T[d] = 0;
    dailyCoverage.N[d] = 0;
    dailyCoverage['18H'][d] = 0;
    dailyCoverage['24H'][d] = 0;
    dailyCoverage['M/T'][d] = 0;
    dailyCoverage.D[d] = 0;

    nursingStaff.forEach(emp => {
      const shift = rosterObj.schedule[emp.name]?.[d] || 'L';
      if (shift === 'M') dailyCoverage.M[d]++;
      else if (shift === 'T') dailyCoverage.T[d]++;
      else if (shift === 'N') dailyCoverage.N[d]++;
      else if (shift === '18H') dailyCoverage['18H'][d]++;
      else if (shift === '24H') dailyCoverage['24H'][d]++;
      else if (shift === 'M/T') dailyCoverage['M/T'][d]++;
      else if (shift === 'D') dailyCoverage.D[d]++;
    });
  }

  container.innerHTML = `
    <div class="glass-card" style="padding: 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-left: 4px solid var(--accent-primary);">
      
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="btn btn-secondary btn-small" id="btn-roster-prev-month" title="Mes Anterior" style="padding: 5px 10px;">◀</button>
        <div style="display: flex; flex-direction: column;">
          <strong style="font-size: 1.1rem; color: var(--accent-primary); text-transform: capitalize;">${currentMonthTitle}</strong>
          <span style="font-size: 0.72rem; color: var(--text-muted);">Estado: <strong style="color: #4ade80;">${rosterObj.status || 'Publicado'}</strong> &bull; Total Días: ${totalDays}</span>
        </div>
        <button class="btn btn-secondary btn-small" id="btn-roster-next-month" title="Mes Siguiente" style="padding: 5px 10px;">▶</button>
        <input type="month" id="input-roster-month" value="${currentRosterMonth}" style="background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; font-size: 0.8rem; margin-left: 6px;">
      </div>

      <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center; font-size: 0.72rem;">
        <span style="color: var(--text-muted); margin-right: 4px; font-weight: bold;">Códigos:</span>
        <span style="background: #0284c7; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">M: Mañana</span>
        <span style="background: #16a34a; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">T: Tarde</span>
        <span style="background: #dc2626; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">N: Noche</span>
        <span style="background: #64748b; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">L: Libre</span>
        <span style="background: #ca8a04; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">18H</span>
        <span style="background: #ea580c; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">24H</span>
        <span style="background: #6366f1; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">D: 8h</span>
        <span style="background: #db2777; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">P: Permiso</span>
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary btn-small" id="btn-roster-autofill" style="font-size: 0.78rem; padding: 6px 12px; border-color: rgba(0,242,254,0.3); color: var(--accent-primary);" title="Cargar sugerencia de distribución equitativa">
          ✨ Sugerir Rol Equitativo
        </button>
        <button class="btn btn-primary btn-small" id="btn-roster-save" style="font-size: 0.78rem; padding: 6px 12px;">
          💾 Guardar Rol
        </button>
        <button class="btn btn-secondary btn-small" id="btn-roster-print" style="font-size: 0.78rem; padding: 6px 12px; border-color: rgba(255,255,255,0.2);">
          🖨️ Imprimir Rol Oficial
        </button>
      </div>
    </div>

    ${isInPlanningWindow && isNextMonth ? `
      <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.4); border-radius: 6px; padding: 10px 14px; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.3rem;">✅</span>
        <div style="font-size: 0.8rem; color: #4ade80;">
          <strong>Ventana Oficial de Planificación Abierta:</strong> Estamos en los últimos 5 días del mes corriente. La Jefa del Departamento de Enfermería puede validar y publicar oficialmente el rol de turnos para el mes siguiente.
        </div>
      </div>
    ` : ''}

    ${fitnessIssues.length > 0 ? `
      <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 10px 14px; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #f87171; font-size: 0.82rem; display: flex; align-items: center; gap: 6px;">
            <span>⚠️</span> Observaciones de Idoneidad y Seguridad Médica (${fitnessIssues.length} alertas detectadas)
          </strong>
          <span style="font-size: 0.72rem; color: var(--text-muted);">Recomendación: Cuidar descanso de 24h post-guardia nocturna</span>
        </div>
        <div style="max-height: 80px; overflow-y: auto; margin-top: 6px; font-size: 0.75rem; color: #fca5a5; display: flex; flex-direction: column; gap: 4px;">
          ${fitnessIssues.slice(0, 5).map(issue => `<div>&bull; ${issue.message}</div>`).join('')}
          ${fitnessIssues.length > 5 ? `<div style="font-style: italic; color: #cbd5e1;">... y ${fitnessIssues.length - 5} alertas adicionales detectadas.</div>` : ''}
        </div>
      </div>
    ` : `
      <div style="background: rgba(34, 197, 94, 0.05); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 6px; padding: 8px 12px; margin-bottom: 1.25rem; font-size: 0.78rem; color: #4ade80; display: flex; align-items: center; gap: 8px;">
        <span>✨</span> <strong>Idoneidad Verificada:</strong> El rol respeta los descansos post-nocturnos y mantiene cobertura continua sin sobrecargas de fatiga.
      </div>
    `}

    <div class="glass-card" style="padding: 0.5rem; overflow-x: auto; margin-bottom: 1.5rem; border: 1px solid var(--border-color);">
      <table id="roster-grid-table" style="width: 100%; border-collapse: collapse; font-size: 0.75rem; text-align: center; white-space: nowrap; font-family: monospace;">
        <thead>
          <tr style="background: #0f172a; color: #94a3b8; border-bottom: 1px solid #334155;">
            <th style="padding: 6px 10px; text-align: left; position: sticky; left: 0; background: #0f172a; z-index: 5; border-right: 2px solid #334155; min-width: 160px;">
              NOMBRES
            </th>
            <th style="padding: 6px 8px; text-align: left; position: sticky; left: 160px; background: #0f172a; z-index: 5; border-right: 2px solid #334155; min-width: 110px;">
              CARGO
            </th>
            ${Array.from({ length: totalDays }, (_, i) => {
              const d = i + 1;
              const dateObj = new Date(yearNum, monthNum, d);
              const dayOfWeek = dateObj.getDay();
              const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
              return `
                <th style="padding: 4px 2px; min-width: 28px; width: 28px; ${isWeekend ? 'background: rgba(245, 158, 11, 0.2); color: #fbbf24; font-weight: 800;' : ''}">
                  ${d}
                </th>
              `;
            }).join('')}
            <th style="padding: 6px 4px; background: #1e293b; color: #38bdf8; border-left: 2px solid #334155; min-width: 32px;" title="Total Mañanas">M</th>
            <th style="padding: 6px 4px; background: #1e293b; color: #4ade80; min-width: 32px;" title="Total Tardes">T</th>
            <th style="padding: 6px 4px; background: #1e293b; color: #f87171; min-width: 32px;" title="Total Noches">N</th>
            <th style="padding: 6px 4px; background: #1e293b; color: #94a3b8; min-width: 32px;" title="Total Libres">L</th>
            <th style="padding: 6px 4px; background: #1e293b; color: #fbbf24; min-width: 38px;" title="Total Especiales (18H / 24H)">ESP</th>
            <th style="padding: 6px 6px; background: #1e293b; color: #a78bfa; border-left: 1px solid #334155; min-width: 50px;" title="Total Horas Estimadas">HRS</th>
          </tr>

          <tr style="background: #1e293b; color: #e2e8f0; font-weight: bold; border-bottom: 2px solid #475569;">
            <th style="padding: 4px 10px; text-align: left; position: sticky; left: 0; background: #1e293b; z-index: 5; border-right: 2px solid #334155; font-size: 0.7rem; color: var(--accent-primary);">
              ROL MENSUAL
            </th>
            <th style="padding: 4px 8px; text-align: left; position: sticky; left: 160px; background: #1e293b; z-index: 5; border-right: 2px solid #334155; font-size: 0.7rem; color: var(--text-muted);">
              JORNADA
            </th>
            ${Array.from({ length: totalDays }, (_, i) => {
              const d = i + 1;
              const dateObj = new Date(yearNum, monthNum, d);
              const dayOfWeek = dateObj.getDay();
              const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
              const letter = dayLetters[dayOfWeek];
              return `
                <th style="padding: 3px 2px; ${isWeekend ? 'background: rgba(245, 158, 11, 0.35); color: #fef08a;' : ''}">
                  ${letter}
                </th>
              `;
            }).join('')}
            <th colspan="6" style="padding: 3px; background: #0f172a; color: var(--text-muted); font-size: 0.68rem; border-left: 2px solid #334155;">
              TOTALES Y EQUIDAD
            </th>
          </tr>
        </thead>
        <tbody>
          ${nursingStaff.map((emp) => {
            const empSchedule = rosterObj.schedule[emp.name] || {};
            const isJefa = isEmployeeJefa(emp);

            let countM = 0, countT = 0, countN = 0, countL = 0, countEsp = 0, totalHours = 0;

            for (let d = 1; d <= totalDays; d++) {
              const shift = empSchedule[d] || (isJefa ? 'D' : 'L');
              if (shift === 'M') { countM++; totalHours += 8; }
              else if (shift === 'T') { countT++; totalHours += 8; }
              else if (shift === 'N') { countN++; totalHours += 12; }
              else if (shift === 'L') { countL++; }
              else if (shift === 'M/T') { countM++; countT++; totalHours += 16; }
              else if (shift === '18H') { countEsp++; totalHours += 18; }
              else if (shift === '24H') { countEsp++; totalHours += 24; }
              else if (shift === 'D') { totalHours += 8; }
              else if (shift === 'P') { /* Permiso */ }
            }

            return `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); ${isJefa ? 'background: rgba(99, 102, 241, 0.08); font-weight: bold;' : ''}" data-emp-name="${emp.name}">
                
                <td style="padding: 6px 10px; text-align: left; position: sticky; left: 0; background: ${isJefa ? '#1e1b4b' : '#0f172a'}; z-index: 4; border-right: 2px solid #334155; font-weight: bold; color: ${isJefa ? '#a5b4fc' : '#f8fafc'}; overflow: hidden; text-overflow: ellipsis;">
                  ${isJefa ? '👑 ' : ''}${emp.name}
                </td>

                <td style="padding: 6px 8px; text-align: left; position: sticky; left: 160px; background: ${isJefa ? '#1e1b4b' : '#0f172a'}; z-index: 4; border-right: 2px solid #334155; font-size: 0.68rem; color: ${isJefa ? '#c7d2fe' : 'var(--text-muted)'};">
                  ${emp.position || emp.role || 'Enfermero/a'}
                </td>

                ${Array.from({ length: totalDays }, (_, i) => {
                  const d = i + 1;
                  const dateObj = new Date(yearNum, monthNum, d);
                  const dayOfWeek = dateObj.getDay();
                  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
                  const shiftCode = empSchedule[d] || (isJefa ? 'D' : 'L');
                  const shiftDef = SHIFT_TYPES[shiftCode] || SHIFT_TYPES['L'];

                  const prevShift = empSchedule[d - 1];
                  const hasFatigueAlert = (prevShift === 'N' && (shiftCode === 'M' || shiftCode === '18H' || shiftCode === '24H'));

                  return `
                    <td class="roster-cell" 
                        data-emp="${emp.name}" 
                        data-day="${d}" 
                        style="padding: 2px; cursor: pointer; user-select: none; ${isWeekend ? 'background: rgba(245, 158, 11, 0.08);' : ''} ${hasFatigueAlert ? 'border: 2px solid #ef4444;' : ''}"
                        title="${emp.name} - Día ${d}: ${shiftDef.name} (${shiftDef.schedule}) [Haz clic para cambiar turno]">
                      <div style="background: ${shiftDef.bg}; color: ${shiftDef.color}; border-radius: 3px; font-weight: 800; font-size: 0.72rem; padding: 3px 0; line-height: 1; min-height: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.3);">
                        ${shiftCode}
                      </div>
                    </td>
                  `;
                }).join('')}

                <td style="padding: 6px 4px; font-weight: bold; color: #38bdf8; background: #0f172a; border-left: 2px solid #334155;">${countM}</td>
                <td style="padding: 6px 4px; font-weight: bold; color: #4ade80; background: #0f172a;">${countT}</td>
                <td style="padding: 6px 4px; font-weight: bold; color: #f87171; background: #0f172a;">${countN}</td>
                <td style="padding: 6px 4px; font-weight: bold; color: #94a3b8; background: #0f172a;">${countL}</td>
                <td style="padding: 6px 4px; font-weight: bold; color: #fbbf24; background: #0f172a;">${countEsp}</td>
                <td style="padding: 6px 6px; font-weight: bold; color: #a78bfa; background: #0f172a; border-left: 1px solid #334155;">${totalHours}h</td>
              </tr>
            `;
          }).join('')}

          <tr style="background: rgba(2, 132, 199, 0.15); border-top: 2px solid #0284c7; font-weight: bold; color: #38bdf8;">
            <td colspan="2" style="padding: 5px 10px; text-align: left; position: sticky; left: 0; background: #0f172a; z-index: 4; border-right: 2px solid #334155;">
              🔵 Cobertura Mañana (M)
            </td>
            ${Array.from({ length: totalDays }, (_, i) => {
              const d = i + 1;
              const count = (dailyCoverage.M[d] || 0) + (dailyCoverage['M/T'][d] || 0) + (dailyCoverage.D[d] || 0);
              const isLow = count < 2;
              return `<td style="padding: 4px 1px; ${isLow ? 'color: #f87171; font-weight: 900;' : ''}">${count}</td>`;
            }).join('')}
            <td colspan="6" style="background: #0f172a; border-left: 2px solid #334155; font-size: 0.68rem; color: var(--text-muted);">Personal Diurno</td>
          </tr>

          <tr style="background: rgba(220, 38, 38, 0.15); border-top: 1px solid #dc2626; font-weight: bold; color: #f87171;">
            <td colspan="2" style="padding: 5px 10px; text-align: left; position: sticky; left: 0; background: #0f172a; z-index: 4; border-right: 2px solid #334155;">
              🔴 Cobertura Noche (N)
            </td>
            ${Array.from({ length: totalDays }, (_, i) => {
              const d = i + 1;
              const count = (dailyCoverage.N[d] || 0) + (dailyCoverage['18H'][d] || 0) + (dailyCoverage['24H'][d] || 0);
              const isLow = count < 2;
              return `<td style="padding: 4px 1px; ${isLow ? 'color: #ef4444; font-weight: 900;' : ''}">${count}</td>`;
            }).join('')}
            <td colspan="6" style="background: #0f172a; border-left: 2px solid #334155; font-size: 0.68rem; color: var(--text-muted);">Guardia Nocturna</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const inputMonth = container.querySelector('#input-roster-month');
  if (inputMonth) {
    inputMonth.addEventListener('change', (e) => {
      currentRosterMonth = e.target.value;
      renderEnfermeriaRosterView(container, state);
    });
  }

  const btnPrev = container.querySelector('#btn-roster-prev-month');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      const d = new Date(yearNum, monthNum - 1, 1);
      currentRosterMonth = d.toISOString().substring(0, 7);
      renderEnfermeriaRosterView(container, state);
    });
  }

  const btnNext = container.querySelector('#btn-roster-next-month');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const d = new Date(yearNum, monthNum + 1, 1);
      currentRosterMonth = d.toISOString().substring(0, 7);
      renderEnfermeriaRosterView(container, state);
    });
  }

  const cycleOrder = ['M', 'T', 'N', 'L', 'M/T', '18H', '24H', 'D', 'P'];
  container.querySelectorAll('.roster-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const empName = cell.getAttribute('data-emp');
      const day = parseInt(cell.getAttribute('data-day'), 10);
      const currentCode = rosterObj.schedule[empName]?.[day] || 'L';
      const curIdx = cycleOrder.indexOf(currentCode);
      const nextCode = cycleOrder[(curIdx + 1) % cycleOrder.length];

      rosterObj.schedule[empName][day] = nextCode;
      rosterObj.updatedAt = new Date().toISOString();

      renderEnfermeriaRosterView(container, state);
    });
  });

  const btnAutofill = container.querySelector('#btn-roster-autofill');
  if (btnAutofill) {
    btnAutofill.addEventListener('click', () => {
      if (confirm(`¿Desea autogenerar una distribución equitativa de turnos para ${currentMonthTitle}? Esto respetará los descansos reglamentarios post-guardia nocturna.`)) {
        autogenerateEquitableRoster(rosterObj, totalDays, nursingStaff);
        saveAppState(state);
        alert(`✨ Rol optimizado y distribuido equitativamente para ${currentMonthTitle}.`);
        renderEnfermeriaRosterView(container, state);
      }
    });
  }

  const btnSave = container.querySelector('#btn-roster-save');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      rosterObj.updatedAt = new Date().toISOString();
      rosterObj.status = 'Publicado';
      await saveAppState(state);
      
      try {
        const docRef = doc(db, 'multimedica', `roster_${currentRosterMonth}`);
        await setDoc(docRef, { ...rosterObj, _collectionType: 'administracion_enfermeria_roles' }, { merge: true });
      } catch (e) {
        console.warn("Aviso Firestore Roster:", e);
      }

      alert(`✅ Rol de Turnos para ${currentMonthTitle} guardado y publicado correctamente.`);
      renderEnfermeriaRosterView(container, state);
    });
  }

  const btnPrint = container.querySelector('#btn-roster-print');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      printOfficialRosterDocument(rosterObj, totalDays, yearNum, monthNum, monthNames, dayLetters, nursingStaff, state);
    });
  }
}

function renderEnfermeriaShiftChangesView(container, state) {
  const currentUser = state.currentUser;
  const isAuthorizer = isUserShiftAuthorizer(currentUser);

  const [yearStr, monthStr] = currentRosterMonth.split('-');
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const currentMonthTitle = `${monthNames[parseInt(monthStr, 10) - 1]} de ${yearStr}`;

  const monthChanges = state.administracion_enfermeria_cambios.filter(c => {
    return c.month === currentRosterMonth || (c.date && c.date.startsWith(currentRosterMonth));
  });
  const approvedCount = monthChanges.filter(c => c.status === 'Autorizado').length;
  const pendingCount = monthChanges.filter(c => c.status === 'Pendiente').length;
  const totalOccupied = approvedCount + pendingCount;
  const maxAllowed = 5;
  const isLimitReached = totalOccupied >= maxAllowed;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 1.25rem;">
      
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid ${isLimitReached ? '#ef4444' : '#0284c7'};">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Límite Mensual de Cambios (Regla 3)</div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
          <span style="font-size: 1.6rem; font-weight: 900; color: ${isLimitReached ? '#f87171' : 'var(--accent-primary)'};">
            ${totalOccupied} / ${maxAllowed}
          </span>
          <span style="font-size: 0.72rem; color: ${isLimitReached ? '#ef4444' : '#4ade80'}; font-weight: bold;">
            ${isLimitReached ? '⛔ LÍMITE ALCANZADO' : `✅ ${maxAllowed - totalOccupied} Disponibles`}
          </span>
        </div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
          Máximo 5 cambios autorizables por mes en el hospital.
        </div>
      </div>

      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #6366f1;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Operación de Solicitud (Regla 1)</div>
        <div style="font-size: 1rem; font-weight: bold; color: #a5b4fc; margin-top: 4px;">
          👑 Jefa Depto. Enfermería
        </div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
          Usuario activo: <strong>${currentUser?.name || 'Enfermería'}</strong>
        </div>
      </div>

      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #16a34a;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Autorización Oficial (Regla 2)</div>
        <div style="font-size: 1rem; font-weight: bold; color: #4ade80; margin-top: 4px;">
          🛡️ Administrador o Médico 1
        </div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">
          ${isAuthorizer ? '✅ Tienes atribuciones de autorización' : '🔒 Requiere firma de Dirección/Admin'}
        </div>
      </div>

    </div>

    <div class="glass-card" style="padding: 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <label style="font-size: 0.85rem; font-weight: bold; color: var(--text-primary);">Periodo:</label>
        <input type="month" id="input-shift-changes-month" value="${currentRosterMonth}" style="background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; font-size: 0.82rem;">
      </div>

      <div>
        <button class="btn btn-primary" id="btn-open-new-shift-change" ${isLimitReached ? 'disabled title="Límite mensual de 5 cambios alcanzado"' : ''} style="font-size: 0.85rem; padding: 8px 16px;">
          ➕ Solicitar Cambio de Turno (Boleta Oficial)
        </button>
      </div>
    </div>

    ${isLimitReached ? `
      <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 12px; margin-bottom: 1.25rem; color: #fca5a5; font-size: 0.82rem; display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.5rem;">⛔</span>
        <div>
          <strong>Límite de Cambios de Turno Alcanzado para ${currentMonthTitle}:</strong>
          <br>El sistema ha registrado los 5 cambios reglamentarios permitidos para este mes. Según la política hospitalaria, no se autorizarán cambios adicionales salvo disposición extraordinaria de Dirección Médica.
        </div>
      </div>
    ` : ''}

    <div class="glass-card" style="padding: 1.25rem;">
      <h3 style="font-size: 1rem; color: var(--text-primary); margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <span>📋 Boletas de Cambio de Turno - ${currentMonthTitle}</span>
        <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: normal;">${monthChanges.length} Registro(s)</span>
      </h3>

      ${monthChanges.length === 0 ? `
        <div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 2rem 0; font-size: 0.85rem;">
          No se han solicitado cambios de turno para el mes seleccionado (${currentMonthTitle}).
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${monthChanges.map(change => {
            const isPending = change.status === 'Pendiente';
            const isApproved = change.status === 'Autorizado';
            const isRejected = change.status === 'Rechazado';

            return `
              <div style="background: rgba(255,255,255,0.02); border: 1px solid ${isApproved ? 'rgba(34, 197, 94, 0.3)' : isRejected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(2, 132, 199, 0.3)'}; border-radius: 8px; padding: 14px; display: grid; grid-template-columns: 1.2fr 2fr 1.2fr; gap: 15px; align-items: center;">
                
                <div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">BOLETA OFICIAL NO.</div>
                  <strong style="font-size: 1.15rem; color: #ef4444; font-family: monospace; letter-spacing: 1px;">
                    ${change.voucherNumber || '000000'}
                  </strong>
                  <div style="margin-top: 6px;">
                    <span style="font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; font-weight: bold; background: ${isApproved ? 'rgba(34, 197, 94, 0.15)' : isRejected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${isApproved ? '#4ade80' : isRejected ? '#f87171' : '#fbbf24'}; border: 1px solid ${isApproved ? '#22c55e' : isRejected ? '#ef4444' : '#f59e0b'};">
                      ${change.status}
                    </span>
                  </div>
                </div>

                <div style="font-size: 0.8rem; line-height: 1.4;">
                  <div>
                    <strong style="color: var(--accent-primary);">Fecha del Turno:</strong> ${change.date} &bull; 
                    <strong style="color: var(--accent-secondary);">Turno:</strong> <span style="background: #0284c7; color: #fff; padding: 1px 6px; border-radius: 3px; font-weight: bold; font-size: 0.72rem;">${change.shift}</span>
                  </div>
                  <div style="margin-top: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                    <div>👤 <strong>Responsable:</strong> <span style="color: #f87171;">${change.originalEmpName}</span></div>
                    <div>🔄 <strong>Reemplazante:</strong> <span style="color: #4ade80;">${change.replacementEmpName}</span></div>
                  </div>
                  ${change.reason ? `<div style="margin-top: 4px; color: var(--text-muted); font-size: 0.75rem;">💬 <em>"${change.reason}"</em></div>` : ''}
                  <div style="margin-top: 4px; font-size: 0.7rem; color: var(--text-muted);">
                    Solicitado por: <strong>${change.requestedBy || 'Jefa de Servicio'}</strong> &bull; ${new Date(change.createdAt).toLocaleDateString('es-GT')}
                    ${change.authorizedBy ? `<br>Autorizado por: <strong style="color: #4ade80;">${change.authorizedBy}</strong>` : ''}
                  </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; align-items: flex-end;">
                  <button class="btn btn-secondary btn-small btn-print-shift-voucher" data-id="${change.id}" style="padding: 4px 10px; font-size: 0.75rem; width: 100%;">
                    🖨️ Boleta Oficial
                  </button>

                  ${isPending ? `
                    <div style="display: flex; gap: 6px; width: 100%;">
                      <button class="btn btn-primary btn-small btn-approve-shift-change" data-id="${change.id}" ${!isAuthorizer ? 'disabled title="Requiere ser Administrador o Médico 1"' : ''} style="flex: 1; padding: 4px 6px; font-size: 0.72rem; background: #16a34a; border-color: #16a34a;">
                        ✅ Autorizar
                      </button>
                      <button class="btn btn-danger btn-small btn-reject-shift-change" data-id="${change.id}" ${!isAuthorizer ? 'disabled title="Requiere ser Administrador o Médico 1"' : ''} style="flex: 1; padding: 4px 6px; font-size: 0.72rem;">
                        ❌ Rechazar
                      </button>
                    </div>
                  ` : ''}
                </div>

              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;

  const inputMonth = container.querySelector('#input-shift-changes-month');
  if (inputMonth) {
    inputMonth.addEventListener('change', (e) => {
      currentRosterMonth = e.target.value;
      renderEnfermeriaShiftChangesView(container, state);
    });
  }

  const btnNew = container.querySelector('#btn-open-new-shift-change');
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      openNewShiftChangeModal(state, () => {
        renderEnfermeriaShiftChangesView(container, state);
      });
    });
  }

  container.querySelectorAll('.btn-approve-shift-change').forEach(btn => {
    btn.addEventListener('click', async () => {
      const changeId = btn.getAttribute('data-id');
      const change = state.administracion_enfermeria_cambios.find(c => c.id === changeId);
      if (!change) return;

      if (!confirm(`¿Confirma autorizar el Cambio de Turno No. ${change.voucherNumber} para que ${change.replacementEmpName} cubra a ${change.originalEmpName} el día ${change.date}?`)) {
        return;
      }

      change.status = 'Autorizado';
      change.authorizedBy = currentUser?.name || 'Administrador';
      change.authorizedAt = new Date().toISOString();

      applyShiftChangeToRoster(change, state);

      await saveAppState(state);
      alert(`✅ Cambio de Turno No. ${change.voucherNumber} autorizado exitosamente y actualizado en el Rol de Turnos.`);
      renderEnfermeriaShiftChangesView(container, state);
    });
  });

  container.querySelectorAll('.btn-reject-shift-change').forEach(btn => {
    btn.addEventListener('click', async () => {
      const changeId = btn.getAttribute('data-id');
      const change = state.administracion_enfermeria_cambios.find(c => c.id === changeId);
      if (!change) return;

      const reason = prompt("Motivo del rechazo de la solicitud de cambio de turno:");
      if (reason === null) return;

      change.status = 'Rechazado';
      change.rejectedReason = reason;
      change.authorizedBy = currentUser?.name || 'Administrador';
      change.authorizedAt = new Date().toISOString();

      await saveAppState(state);
      alert(`❌ Solicitud de Cambio No. ${change.voucherNumber} rechazada.`);
      renderEnfermeriaShiftChangesView(container, state);
    });
  });

  container.querySelectorAll('.btn-print-shift-voucher').forEach(btn => {
    btn.addEventListener('click', () => {
      const changeId = btn.getAttribute('data-id');
      const change = state.administracion_enfermeria_cambios.find(c => c.id === changeId);
      if (change) {
        printShiftChangeVoucher(change, state);
      }
    });
  });
}

function renderEnfermeriaPermitsView(container, state) {
  const currentUser = state.currentUser;
  const isAuthorizer = isUserShiftAuthorizer(currentUser);
  const eligibleStaff = getNursingEmployeesList(state);

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; align-items: flex-start;">
      
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
          <span>📝</span> Solicitar Permiso / Licencia
        </h3>
        
        <form id="form-nursing-permit" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="form-group">
            <label style="font-size: 0.82rem;">Colaborador (Jornada 8h / Jefa de Servicio) *</label>
            <select id="permit-emp-name" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
              <option value="">-- Seleccione Colaborador --</option>
              ${eligibleStaff.map(e => `
                <option value="${e.name}">
                  ${isEmployeeJefa(e) ? '👑 ' : ''}${e.name} (${e.position || 'Enfermería'})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label style="font-size: 0.82rem;">Tipo de Permiso / Motivo *</label>
            <select id="permit-type" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
              <option value="Personal / Asuntos Propios">Personal / Asuntos Propios</option>
              <option value="Cita Médica / IGSS">Cita Médica / IGSS</option>
              <option value="Capacitación / Académico">Capacitación / Académico</option>
              <option value="Duelo / Calamidad Doméstica">Duelo / Calamidad Doméstica</option>
              <option value="Vacaciones Reglamentarias">Vacaciones Reglamentarias</option>
              <option value="Día Compensatorio">Día Compensatorio</option>
            </select>
          </div>

          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label style="font-size: 0.82rem;">Fecha Inicio *</label>
              <input type="date" id="permit-date-start" required value="${new Date().toISOString().substring(0, 10)}" style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
            </div>
            <div class="form-group">
              <label style="font-size: 0.82rem;">Fecha Fin *</label>
              <input type="date" id="permit-date-end" required value="${new Date().toISOString().substring(0, 10)}" style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
            </div>
          </div>

          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label style="font-size: 0.82rem;">Goce de Sueldo *</label>
              <select id="permit-with-pay" style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
                <option value="Con Goce">Con Goce de Sueldo</option>
                <option value="Sin Goce">Sin Goce de Sueldo</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-size: 0.82rem;">Horas / Duración</label>
              <input type="text" id="permit-hours" value="Jornada Completa (8h)" placeholder="Ej. 4 horas / 8 horas" style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
            </div>
          </div>

          <div class="form-group">
            <label style="font-size: 0.82rem;">Justificación / Observaciones</label>
            <textarea id="permit-notes" rows="2" placeholder="Detalles de la ausencia justificada..." style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.82rem;"></textarea>
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top: 6px; padding: 9px;">
            📄 Registrar Solicitud de Permiso
          </button>
        </form>
      </div>

      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1rem; color: var(--text-primary); margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <span>📋 Historial de Permisos y Licencias</span>
          <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: normal;">${state.administracion_enfermeria_permisos.length} Registrados</span>
        </h3>

        ${state.administracion_enfermeria_permisos.length === 0 ? `
          <div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 2rem 0; font-size: 0.85rem;">
            No se registran solicitudes de permisos en el departamento.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto;">
            ${state.administracion_enfermeria_permisos.map(p => {
              const isApproved = p.status === 'Aprobado';
              const isRejected = p.status === 'Rechazado';
              return `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid ${isApproved ? 'rgba(34, 197, 94, 0.3)' : isRejected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}; border-radius: 6px; padding: 12px; font-size: 0.8rem;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                      <strong style="color: var(--accent-primary); font-size: 0.88rem;">${p.empName}</strong>
                      <div style="color: var(--text-muted); font-size: 0.72rem;">Tipo: <strong>${p.type}</strong> (${p.withPay})</div>
                    </div>
                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; font-weight: bold; background: ${isApproved ? 'rgba(34, 197, 94, 0.15)' : isRejected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${isApproved ? '#4ade80' : isRejected ? '#f87171' : '#fbbf24'};">
                      ${p.status}
                    </span>
                  </div>

                  <div style="margin-top: 6px; font-size: 0.75rem; color: var(--text-secondary);">
                    📅 <strong>Periodo:</strong> ${p.dateStart} al ${p.dateEnd} (${p.hours})
                    ${p.notes ? `<div style="margin-top: 2px; color: var(--text-muted);">💬 ${p.notes}</div>` : ''}
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px;">
                    <span style="font-size: 0.7rem; color: var(--text-muted);">
                      Registrado: ${new Date(p.createdAt).toLocaleDateString('es-GT')}
                    </span>
                    <div style="display: flex; gap: 6px;">
                      ${p.status === 'Pendiente' ? `
                        <button class="btn btn-primary btn-small btn-approve-permit" data-id="${p.id}" ${!isAuthorizer ? 'disabled' : ''} style="padding: 2px 8px; font-size: 0.7rem; background: #16a34a;">
                          Aprobar
                        </button>
                        <button class="btn btn-danger btn-small btn-reject-permit" data-id="${p.id}" ${!isAuthorizer ? 'disabled' : ''} style="padding: 2px 8px; font-size: 0.7rem;">
                          Rechazar
                        </button>
                      ` : ''}
                      <button class="btn btn-secondary btn-small btn-print-permit" data-id="${p.id}" style="padding: 2px 8px; font-size: 0.7rem;">
                        🖨️ Boleta
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

    </div>
  `;

  const form = container.querySelector('#form-nursing-permit');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const empName = container.querySelector('#permit-emp-name').value;
      const type = container.querySelector('#permit-type').value;
      const dateStart = container.querySelector('#permit-date-start').value;
      const dateEnd = container.querySelector('#permit-date-end').value;
      const withPay = container.querySelector('#permit-with-pay').value;
      const hours = container.querySelector('#permit-hours').value;
      const notes = container.querySelector('#permit-notes').value;

      const newPermit = {
        id: `PERMIT-${Date.now()}`,
        empName: empName,
        type: type,
        dateStart: dateStart,
        dateEnd: dateEnd,
        withPay: withPay,
        hours: hours,
        notes: notes,
        status: 'Pendiente',
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'Jefa de Enfermería'
      };

      state.administracion_enfermeria_permisos.unshift(newPermit);
      await saveAppState(state);
      alert(`✅ Solicitud de permiso para ${empName} registrada correctamente.`);
      renderEnfermeriaPermitsView(container, state);
    });
  }

  container.querySelectorAll('.btn-approve-permit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pId = btn.getAttribute('data-id');
      const permit = state.administracion_enfermeria_permisos.find(x => x.id === pId);
      if (!permit) return;

      permit.status = 'Aprobado';
      permit.approvedBy = currentUser?.name || 'Administrador';
      permit.approvedAt = new Date().toISOString();

      applyPermitToRoster(permit, state);

      await saveAppState(state);
      alert(`✅ Permiso para ${permit.empName} aprobado y reflejado en el Rol de Turnos.`);
      renderEnfermeriaPermitsView(container, state);
    });
  });

  container.querySelectorAll('.btn-reject-permit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pId = btn.getAttribute('data-id');
      const permit = state.administracion_enfermeria_permisos.find(x => x.id === pId);
      if (!permit) return;

      permit.status = 'Rechazado';
      permit.approvedBy = currentUser?.name || 'Administrador';
      permit.approvedAt = new Date().toISOString();

      await saveAppState(state);
      alert(`❌ Permiso rechazado.`);
      renderEnfermeriaPermitsView(container, state);
    });
  });

  container.querySelectorAll('.btn-print-permit').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-id');
      const permit = state.administracion_enfermeria_permisos.find(x => x.id === pId);
      if (permit) {
        printPermitDocument(permit, state);
      }
    });
  });
}

function renderEnfermeriaStaffDirectoryView(container, state) {
  const staff = getNursingEmployeesList(state);

  container.innerHTML = `
    <div class="glass-card" style="padding: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 style="font-size: 1rem; color: var(--accent-primary); margin: 0;">👥 Plantilla Oficial de Personal de Enfermería</h3>
          <span style="font-size: 0.78rem; color: var(--text-muted);">${staff.length} Colaboradores Activos en el Departamento</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
        ${staff.map(emp => {
          const isJefa = isEmployeeJefa(emp);
          return `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid ${isJefa ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-color)'}; border-radius: 8px; padding: 12px; display: flex; gap: 12px; align-items: center;">
              <div style="width: 44px; height: 44px; border-radius: 50%; background: ${isJefa ? '#4338ca' : '#0369a1'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; font-weight: bold;">
                ${isJefa ? '👑' : '👩‍⚕️'}
              </div>
              <div style="flex: 1; overflow: hidden;">
                <div style="font-weight: bold; font-size: 0.88rem; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
                  ${emp.name}
                </div>
                <div style="font-size: 0.75rem; color: ${isJefa ? '#a5b4fc' : 'var(--accent-primary)'}; font-weight: 600;">
                  ${emp.position || emp.role || 'Enfermería'}
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
                  Código: <strong style="color: #38bdf8; font-family: monospace;">${emp.employee_code || 'EMP-S/C'}</strong> &bull; ${emp.whatsapp_number || emp.phone || 'Sin tel.'}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function openNewShiftChangeModal(state, onSavedCallback) {
  const staff = getNursingEmployeesList(state);
  const eligibleTurnPersonnel = staff.filter(e => !isEmployeeJefa(e));

  const existingVouchers = (state.administracion_enfermeria_cambios || []).map(c => parseInt(c.voucherNumber || '0', 10)).filter(n => !isNaN(n));
  const maxVoucher = existingVouchers.length > 0 ? Math.max(...existingVouchers) : 233;
  const nextVoucherStr = String(maxVoucher + 1).padStart(6, '0');

  let modal = document.getElementById('modal-nursing-shift-change');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-nursing-shift-change';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.85)';
    modal.style.zIndex = '99999';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '15px';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background: #0f172a; border: 1px solid rgba(0,242,254,0.3); border-radius: 12px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; padding: 20px; box-shadow: 0 25px 50px rgba(0,0,0,0.8); color: #fff; font-family: system-ui, -apple-system, sans-serif;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 15px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.4rem;">🔄</span>
          <div>
            <h3 style="margin: 0; font-size: 1.05rem; color: var(--accent-primary);">Solicitud de Cambio de Turno</h3>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Hospital Privado Multimédica &bull; Sayaxché Petén</span>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.7rem; color: var(--text-muted);">BOLETA NO.</div>
          <strong style="color: #ef4444; font-size: 1.1rem; font-family: monospace;">${nextVoucherStr}</strong>
        </div>
      </div>

      <form id="form-create-shift-change" style="display: flex; flex-direction: column; gap: 12px;">
        
        <div class="form-row" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 10px;">
          <div class="form-group">
            <label style="font-size: 0.82rem; font-weight: bold;">Fecha del Turno a Cambiar *</label>
            <input type="date" id="sc-date" required value="${new Date().toISOString().substring(0, 10)}" style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
          </div>
          <div class="form-group">
            <label style="font-size: 0.82rem; font-weight: bold;">Turno (M, T, N...) *</label>
            <select id="sc-shift" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
              <option value="M">M - Mañana (07:00 - 15:00)</option>
              <option value="T">T - Tarde (15:00 - 23:00)</option>
              <option value="N">N - Noche (19:00 - 07:00)</option>
              <option value="18H">18H - Especial 18 Horas</option>
              <option value="24H">24H - Especial 24 Horas</option>
              <option value="M/T">M/T - Doble Turno Diurno</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label style="font-size: 0.82rem; font-weight: bold; color: #f87171;">
            👤 Nombre de la Persona Responsable del Turno *
          </label>
          <select id="sc-original-emp" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
            <option value="">-- Seleccionar Persona Responsable --</option>
            ${eligibleTurnPersonnel.map(e => `
              <option value="${e.name}">${e.name} (${e.position || 'Enfermería'})</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label style="font-size: 0.82rem; font-weight: bold; color: #4ade80;">
            🔄 Nombre de la Persona Reemplazante *
          </label>
          <select id="sc-replacement-emp" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
            <option value="">-- Seleccionar Persona Reemplazante --</option>
            ${eligibleTurnPersonnel.map(e => `
              <option value="${e.name}">${e.name} (${e.position || 'Enfermería'})</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label style="font-size: 0.82rem;">Motivo / Justificación del Cambio</label>
          <textarea id="sc-reason" rows="2" placeholder="Motivo de fuerza mayor, compensación, etc..." style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.82rem;"></textarea>
        </div>

        <div style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.15); border-radius: 6px; padding: 10px; font-size: 0.72rem; color: var(--text-muted);">
          ℹ️ Esta solicitud generará la Boleta Oficial con las 4 firmas requeridas: <strong>Persona Responsable</strong>, <strong>Persona Reemplazante</strong>, <strong>Jefa de Servicio</strong> y <strong>Autorización AD</strong>.
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
          <button type="button" class="btn btn-secondary btn-small" id="btn-cancel-shift-change">Cancelar</button>
          <button type="submit" class="btn btn-primary btn-small">Emitir Boleta de Cambio</button>
        </div>
      </form>

    </div>
  `;

  modal.style.display = 'flex';

  const closeFn = () => { modal.style.display = 'none'; };
  document.getElementById('btn-cancel-shift-change').addEventListener('click', closeFn);

  const form = document.getElementById('form-create-shift-change');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dateVal = document.getElementById('sc-date').value;
    const shiftVal = document.getElementById('sc-shift').value;
    const origEmp = document.getElementById('sc-original-emp').value;
    const replEmp = document.getElementById('sc-replacement-emp').value;
    const reasonVal = document.getElementById('sc-reason').value;

    if (origEmp === replEmp) {
      alert("⚠️ La persona responsable y la reemplazante no pueden ser la misma.");
      return;
    }

    const monthTarget = dateVal.substring(0, 7);

    const monthChanges = state.administracion_enfermeria_cambios.filter(c => {
      return (c.month === monthTarget || (c.date && c.date.startsWith(monthTarget))) && (c.status === 'Autorizado' || c.status === 'Pendiente');
    });

    if (monthChanges.length >= 5) {
      alert(`⛔ Límite mensual excedido (Regla 3):\n\nEl sistema ya cuenta con ${monthChanges.length} cambios de turno en trámite/autorizados para el mes ${monthTarget}.\nEl reglamento del hospital rechaza automáticamente solicitudes adicionales.`);
      return;
    }

    const newChange = {
      id: `SC-${Date.now()}`,
      voucherNumber: nextVoucherStr,
      month: monthTarget,
      date: dateVal,
      shift: shiftVal,
      originalEmpName: origEmp,
      replacementEmpName: replEmp,
      reason: reasonVal,
      status: 'Pendiente',
      requestedBy: state.currentUser?.name || 'Vanessa Morales (Jefa de Servicio)',
      createdAt: new Date().toISOString()
    };

    state.administracion_enfermeria_cambios.unshift(newChange);
    await saveAppState(state);

    alert(`✅ Boleta de Cambio de Turno No. ${nextVoucherStr} registrada exitosamente. Pendiente de autorización por Administrador o Médico 1.`);
    closeFn();
    if (onSavedCallback) onSavedCallback();
  });
}

export function printShiftChangeVoucher(change, state) {
  const printWindow = window.open('', '_blank', 'width=850,height=600');
  if (!printWindow) {
    alert("Por favor habilite las ventanas emergentes en su navegador para imprimir la boleta.");
    return;
  }

  const [y, m, d] = (change.date || '').split('-');
  const formattedDate = (d && m && y) ? `${d}/${m}/${y}` : change.date;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Boleta de Cambio de Turno No. ${change.voucherNumber || '000000'}</title>
      <style>
        @page { size: auto; margin: 15mm; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          margin: 0;
          padding: 20px;
          color: #000;
          background: #fff;
        }
        .voucher-box {
          border: 2px solid #000;
          border-radius: 8px;
          padding: 25px 30px;
          max-width: 680px;
          margin: 0 auto;
          position: relative;
        }
        .header-title {
          text-align: center;
          margin-bottom: 20px;
        }
        .header-title h2 {
          margin: 0;
          font-size: 1.35rem;
          letter-spacing: 1px;
          font-weight: 800;
        }
        .header-title h3 {
          margin: 4px 0 0 0;
          font-size: 1.15rem;
          font-weight: bold;
          letter-spacing: 0.5px;
        }
        .voucher-number {
          position: absolute;
          top: 25px;
          right: 30px;
          color: #d32f2f;
          font-size: 1.3rem;
          font-weight: 900;
          font-family: monospace;
        }
        .row-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 18px;
          font-size: 1rem;
          font-weight: bold;
        }
        .field-line {
          margin-bottom: 18px;
          font-size: 0.95rem;
          display: flex;
          align-items: baseline;
        }
        .field-label {
          font-weight: bold;
          white-space: nowrap;
          margin-right: 8px;
        }
        .field-value {
          border-bottom: 1px solid #000;
          flex: 1;
          padding-left: 10px;
          font-size: 1rem;
          font-weight: 600;
        }
        .signatures-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px 30px;
          margin-top: 45px;
          padding-top: 10px;
        }
        .signature-item {
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #000;
          margin-top: 35px;
          padding-top: 5px;
          font-size: 0.8rem;
          font-weight: bold;
          text-transform: uppercase;
        }
        .footer-note {
          margin-top: 30px;
          font-size: 0.65rem;
          color: #555;
          text-align: right;
        }
      </style>
    </head>
    <body>
      <div class="voucher-box">
        <div class="voucher-number">00${change.voucherNumber || '0234'}</div>

        <div class="header-title">
          <h2>HOSPITAL PRIVADO MULTIMEDICA</h2>
          <h3>CONTROL DE CAMBIO DE TURNO</h3>
        </div>

        <div class="row-info">
          <div>CAMBIO NO. <span style="color: #d32f2f; font-family: monospace;">${change.voucherNumber || '000234'}</span></div>
          <div>TURNO (M. T. N.): <span style="border-bottom: 1px solid #000; padding: 0 15px;">${change.shift || 'M'}</span></div>
          <div>FECHA: <span style="border-bottom: 1px solid #000; padding: 0 10px;">${formattedDate}</span></div>
        </div>

        <div class="field-line">
          <span class="field-label">NOMBRE DE LA PERSONA RESPONSABLE DEL TURNO:</span>
          <span class="field-value">${change.originalEmpName || ''}</span>
        </div>

        <div class="field-line">
          <span class="field-label">NOMBRE DE LA PERSONA REEPLAZANTE:</span>
          <span class="field-value">${change.replacementEmpName || ''}</span>
        </div>

        <div class="signatures-container">
          <div class="signature-item">
            <div style="font-size: 0.85rem; min-height: 20px;">${change.originalEmpName || ''}</div>
            <div class="signature-line">FIRMA DE LA PERSONA RESPONSABLE</div>
          </div>
          <div class="signature-item">
            <div style="font-size: 0.85rem; min-height: 20px;">${change.replacementEmpName || ''}</div>
            <div class="signature-line">FIRMA DE LA PERSONA REEPLAZANTE</div>
          </div>
          <div class="signature-item">
            <div style="font-size: 0.85rem; min-height: 20px;">Vanessa Morales</div>
            <div class="signature-line">FIRMA DE JEFA DE SERVICIO</div>
          </div>
          <div class="signature-item">
            <div style="font-size: 0.85rem; min-height: 20px;">${change.authorizedBy ? `AUTORIZADO: ${change.authorizedBy}` : ''}</div>
            <div class="signature-line">AUTORIZACIÓN AD.</div>
          </div>
        </div>

        <div class="footer-note">
          IMPRIME: "Hospital Privado Multimédica" &bull; Correlativo ${change.voucherNumber || '000234'} &bull; Estado: ${change.status || 'Registrado'}
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

export function printOfficialRosterDocument(rosterObj, totalDays, yearNum, monthNum, monthNames, dayLetters, nursingStaff, state) {
  const printWindow = window.open('', '_blank', 'width=1100,height=750');
  if (!printWindow) {
    alert("Por favor habilite las ventanas emergentes para imprimir el rol oficial.");
    return;
  }

  const monthTitle = `${monthNames[monthNum].toUpperCase()} DE ${yearNum}`;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Rol de Turnos - ${monthTitle}</title>
      <style>
        @page { size: landscape; margin: 8mm; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          margin: 0;
          padding: 10px;
          color: #000;
          background: #fff;
          font-size: 9px;
        }
        .header {
          text-align: center;
          margin-bottom: 10px;
        }
        .header h1 {
          margin: 0;
          font-size: 15px;
          letter-spacing: 1px;
        }
        .header h2 {
          margin: 2px 0 0 0;
          font-size: 13px;
          color: #222;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          text-align: center;
          font-family: monospace;
          font-size: 8.5px;
        }
        th, td {
          border: 1px solid #000;
          padding: 3px 1px;
        }
        th {
          background: #f1f5f9;
        }
        .weekend {
          background: #fed7aa !important;
          font-weight: bold;
        }
        .name-col {
          text-align: left;
          padding-left: 4px;
          white-space: nowrap;
          font-weight: bold;
        }
        .signatures {
          display: flex;
          justify-content: space-around;
          margin-top: 30px;
          page-break-inside: avoid;
        }
        .sign-box {
          text-align: center;
          width: 250px;
          border-top: 1px solid #000;
          padding-top: 4px;
          font-size: 9px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>HOSPITAL PRIVADO DE SAYAXCHE PETEN</h1>
        <h2>ROL DE TURNOS DE ENFERMERÍA - ${monthTitle}</h2>
      </div>

      <table>
        <thead>
          <tr>
            <th class="name-col" rowspan="2" style="width: 130px;">NOMBRES</th>
            <th class="name-col" rowspan="2" style="width: 100px;">ROL</th>
            ${Array.from({ length: totalDays }, (_, i) => {
              const d = i + 1;
              const isWeekend = ([0, 6].includes(new Date(yearNum, monthNum, d).getDay()));
              return `<th class="${isWeekend ? 'weekend' : ''}">${d}</th>`;
            }).join('')}
            <th>M</th><th>T</th><th>N</th><th>L</th><th>ESP</th><th>HRS</th>
          </tr>
          <tr>
            ${Array.from({ length: totalDays }, (_, i) => {
              const d = i + 1;
              const dayOfWeek = new Date(yearNum, monthNum, d).getDay();
              const isWeekend = ([0, 6].includes(dayOfWeek));
              return `<th class="${isWeekend ? 'weekend' : ''}">${dayLetters[dayOfWeek]}</th>`;
            }).join('')}
            <th colspan="6">TOTALES</th>
          </tr>
        </thead>
        <tbody>
          ${nursingStaff.map(emp => {
            const sched = rosterObj.schedule[emp.name] || {};
            let cM=0, cT=0, cN=0, cL=0, cEsp=0, h=0;
            for (let d=1; d<=totalDays; d++) {
              const s = sched[d] || 'L';
              if (s==='M') { cM++; h+=8; }
              else if (s==='T') { cT++; h+=8; }
              else if (s==='N') { cN++; h+=12; }
              else if (s==='L') { cL++; }
              else if (s==='M/T') { cM++; cT++; h+=16; }
              else if (s==='18H') { cEsp++; h+=18; }
              else if (s==='24H') { cEsp++; h+=24; }
              else if (s==='D') { h+=8; }
            }
            return `
              <tr>
                <td class="name-col">${emp.name}</td>
                <td class="name-col" style="font-size: 7.5px;">${emp.position || emp.role || 'Enfermero/a'}</td>
                ${Array.from({ length: totalDays }, (_, i) => {
                  const d = i + 1;
                  const isWeekend = ([0, 6].includes(new Date(yearNum, monthNum, d).getDay()));
                  const s = sched[d] || 'L';
                  return `<td class="${isWeekend ? 'weekend' : ''}">${s}</td>`;
                }).join('')}
                <td>${cM}</td><td>${cT}</td><td>${cN}</td><td>${cL}</td><td>${cEsp}</td><td><strong>${h}h</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sign-box">
          VANESSA MORALES<br>
          ENFERMERA PROFESIONAL / JEFA DE SERVICIO
        </div>
        <div class="sign-box">
          DIRECCIÓN MÉDICA / ADMINISTRACIÓN<br>
          HOSPITAL PRIVADO MULTIMEDICA
        </div>
      </div>

      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

export function printPermitDocument(permit, state) {
  const printWindow = window.open('', '_blank', 'width=800,height=550');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Constancia de Permiso - ${permit.empName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 25px; color: #000; }
        .box { border: 2px solid #000; border-radius: 8px; padding: 25px; max-width: 650px; margin: 0 auto; }
        h2 { text-align: center; margin: 0 0 4px 0; }
        h3 { text-align: center; margin: 0 0 20px 0; color: #444; font-size: 1rem; }
        .item { margin-bottom: 12px; font-size: 0.95rem; }
        .signs { display: flex; justify-content: space-around; margin-top: 50px; }
        .sign { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 4px; font-size: 0.8rem; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>HOSPITAL PRIVADO MULTIMEDICA</h2>
        <h3>BOLETA DE AUTORIZACIÓN DE PERMISO / LICENCIA</h3>
        <div class="item"><strong>Colaborador:</strong> ${permit.empName}</div>
        <div class="item"><strong>Tipo de Permiso:</strong> ${permit.type} (${permit.withPay})</div>
        <div class="item"><strong>Periodo de Ausencia:</strong> Del ${permit.dateStart} al ${permit.dateEnd} (${permit.hours})</div>
        <div class="item"><strong>Motivo / Justificación:</strong> ${permit.notes || 'Permiso reglamentario'}</div>
        <div class="item"><strong>Estado:</strong> ${permit.status} ${permit.approvedBy ? `&bull; Autorizado por: ${permit.approvedBy}` : ''}</div>
        
        <div class="signs">
          <div class="sign">FIRMA DEL COLABORADOR</div>
          <div class="sign">FIRMA JEFA DE ENFERMERÍA</div>
          <div class="sign">AUTORIZACIÓN DIRECCIÓN</div>
        </div>
      </div>
      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function evaluateRosterFitness(schedule, totalDays, staff) {
  const issues = [];

  staff.forEach(emp => {
    const empSched = schedule[emp.name] || {};
    let consecutiveWorkDays = 0;

    for (let d = 1; d <= totalDays; d++) {
      const shift = empSched[d] || 'L';
      const prevShift = empSched[d - 1];

      if (prevShift === 'N' && (shift === 'M' || shift === '18H' || shift === '24H')) {
        issues.push({
          emp: emp.name,
          day: d,
          message: `${emp.name}: Turno Noche el día ${d-1} seguido inmediatamente de ${shift} el día ${d} (Sin descanso reglamentario de 24h).`
        });
      }

      if (shift !== 'L' && shift !== 'P') {
        consecutiveWorkDays++;
        if (consecutiveWorkDays > 6) {
          issues.push({
            emp: emp.name,
            day: d,
            message: `${emp.name}: Acumula ${consecutiveWorkDays} días consecutivos de trabajo en el día ${d} sin descanso reglamentario.`
          });
        }
      } else {
        consecutiveWorkDays = 0;
      }
    }
  });

  return issues;
}

function autogenerateEquitableRoster(rosterObj, totalDays, staff) {
  const rotationCycle = ['M', 'T', 'N', 'L', 'M', 'T', 'L'];

  staff.forEach((emp, empIdx) => {
    const isJefa = isEmployeeJefa(emp);
    rosterObj.schedule[emp.name] = {};

    if (isJefa) {
      for (let d = 1; d <= totalDays; d++) {
        const dayOfWeek = (d % 7);
        rosterObj.schedule[emp.name][d] = (dayOfWeek === 0 || d % 7 === 4) ? 'L' : 'D';
      }
    } else {
      for (let d = 1; d <= totalDays; d++) {
        const cycleIdx = (d + empIdx * 2) % rotationCycle.length;
        rosterObj.schedule[emp.name][d] = rotationCycle[cycleIdx];
      }
    }
  });
}

function applyShiftChangeToRoster(change, state) {
  const [y, m, dStr] = (change.date || '').split('-');
  const monthKey = `${y}-${m}`;
  const dayNum = parseInt(dStr, 10);

  let roster = state.administracion_enfermeria_roles.find(r => r.month === monthKey);
  if (!roster) return;

  if (roster.schedule[change.originalEmpName] && roster.schedule[change.replacementEmpName]) {
    const prevReplacementShift = roster.schedule[change.replacementEmpName][dayNum] || 'L';
    roster.schedule[change.originalEmpName][dayNum] = prevReplacementShift;
    roster.schedule[change.replacementEmpName][dayNum] = change.shift;
    roster.updatedAt = new Date().toISOString();
  }
}

function applyPermitToRoster(permit, state) {
  const [y, m, dStr] = (permit.dateStart || '').split('-');
  const monthKey = `${y}-${m}`;
  const startDay = parseInt(dStr, 10);
  const endDay = parseInt((permit.dateEnd || '').split('-')[2] || dStr, 10);

  let roster = state.administracion_enfermeria_roles.find(r => r.month === monthKey);
  if (!roster) return;

  if (roster.schedule[permit.empName]) {
    for (let d = startDay; d <= endDay; d++) {
      roster.schedule[permit.empName][d] = 'P';
    }
    roster.updatedAt = new Date().toISOString();
  }
}

export function getNursingEmployeesList(state) {
  const emps = state.administracion_employees || [];
  const nursing = emps.filter(e => {
    if (!e) return false;
    const dept = String(e.department || '').toLowerCase();
    const pos = String(e.position || e.role || '').toLowerCase();
    const name = String(e.name || '').toLowerCase();
    return dept.includes('enfermer') || pos.includes('enfermer') || pos.includes('auxiliar') || pos.includes('jefa') || name.includes('vanessa morales');
  });

  return nursing.length > 0 ? nursing : emps;
}

export function ensureNursingEmployeesSeeded(state) {
  state.administracion_employees = state.administracion_employees || [];
  
  DEFAULT_NURSING_ROSTER_SAMPLE.forEach((sample, idx) => {
    const exists = state.administracion_employees.some(e => e.name && e.name.trim().toLowerCase() === sample.name.toLowerCase());
    if (!exists) {
      state.administracion_employees.push({
        id: `emp-enf-${idx + 1}`,
        employee_code: `EMP-0${String(10 + idx + 1)}`,
        name: sample.name,
        position: sample.role,
        department: 'Enfermería',
        shift: sample.isFixed8h ? 'Matutino (8 Horas)' : 'Rotativo Asistencial',
        salary: sample.isJefa ? 6500.00 : 4200.00,
        phone: '+502 5555-010' + idx,
        whatsapp_number: '+502 5555-010' + idx,
        status: 'Activo',
        isJefa: sample.isJefa,
        isFixed8h: sample.isFixed8h,
        hireDate: '2024-01-15'
      });
    }
  });
}
