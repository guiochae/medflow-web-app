import { saveAppState } from '../main.js';

// =============================================================
// 🕒 SUBMÓDULO: CONTROL Y GESTIÓN DE ASISTENCIAS CON AUDITORÍA
// =============================================================
export function renderRrhhAsistencia(container, state) {
  state.administracion_asistencias = state.administracion_asistencias || [];
  state.administracion_asistencias_audit = state.administracion_asistencias_audit || [];
  state.administracion_employees = state.administracion_employees || [];

  const todayYMD = new Date().toLocaleDateString('en-CA');
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');

  // Filtros en memoria (o defaults)
  let filterFrom = container.querySelector('#att-filter-from')?.value || firstDayOfMonth;
  let filterTo = container.querySelector('#att-filter-to')?.value || todayYMD;
  let filterEmp = container.querySelector('#att-filter-emp')?.value || 'all';
  let filterDept = container.querySelector('#att-filter-dept')?.value || 'all';
  let filterStatus = container.querySelector('#att-filter-status')?.value || 'all';
  let filterType = container.querySelector('#att-filter-type')?.value || 'all';

  // Métricas del día
  const todayRecords = state.administracion_asistencias.filter(a => a.date === todayYMD);
  const todayEntries = todayRecords.filter(a => a.type === 'ENTRADA');
  const todayExits = todayRecords.filter(a => a.type === 'SALIDA');
  const onTimeToday = todayEntries.filter(a => a.status === 'ON_TIME').length;
  const lateToday = todayEntries.filter(a => a.status === 'LATE').length;
  
  // Colaboradores con entrada hoy pero sin salida
  const entryEmpIds = new Set(todayEntries.map(e => e.employee_id));
  const exitEmpIds = new Set(todayExits.map(e => e.employee_id));
  let pendingExitCount = 0;
  entryEmpIds.forEach(id => {
    if (!exitEmpIds.has(id)) pendingExitCount++;
  });

  // Filtrado de Asistencias
  let filteredRecords = state.administracion_asistencias.filter(r => {
    if (filterFrom && r.date < filterFrom) return false;
    if (filterTo && r.date > filterTo) return false;
    if (filterEmp !== 'all' && r.employee_id !== filterEmp) return false;
    if (filterDept !== 'all' && r.department !== filterDept) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterType !== 'all' && r.type !== filterType) return false;
    return true;
  });

  // Ordenar cronológicamente descendente
  filteredRecords.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

  container.innerHTML = `
    <!-- Tarjetas de Métricas de Asistencia -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 1.5rem;">
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid var(--accent-primary);">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total Marcajes (Histórico)</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); margin-top: 4px;">
          ${state.administracion_asistencias.length}
        </div>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
          ${filteredRecords.length} en rango filtrado
        </div>
      </div>

      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #22c55e;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">A Tiempo Hoy</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: #22c55e; margin-top: 4px;">
          ${onTimeToday}
        </div>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
          Entradas puntuales registradas
        </div>
      </div>

      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #f59e0b;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Retardos Hoy</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: #f59e0b; margin-top: 4px;">
          ${lateToday}
        </div>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
          Entradas fuera de tolerancia
        </div>
      </div>

      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #3b82f6;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Jornadas Activas (Sin Salida)</div>
        <div style="font-size: 1.6rem; font-weight: 800; color: #60a5fa; margin-top: 4px;">
          ${pendingExitCount}
        </div>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
          Personal laborando en turno
        </div>
      </div>
    </div>

    <!-- Barra de Filtros y Acciones -->
    <div class="glass-card" style="padding: 1rem; margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
        <h3 style="font-size: 0.95rem; color: var(--accent-primary); margin: 0; font-family: var(--font-heading);">
          🔍 Filtros de Búsqueda y Auditoría
        </h3>
        <button class="btn btn-primary btn-small" id="btn-open-manual-attendance" style="padding: 6px 12px; font-weight: 600;">
          ➕ Registrar Marcaje Manual
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; font-size: 0.82rem;">
        <div>
          <label style="display: block; margin-bottom: 3px; color: var(--text-muted);">Desde:</label>
          <input type="date" id="att-filter-from" value="${filterFrom}" style="width: 100%; padding: 6px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 3px; color: var(--text-muted);">Hasta:</label>
          <input type="date" id="att-filter-to" value="${filterTo}" style="width: 100%; padding: 6px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 3px; color: var(--text-muted);">Colaborador:</label>
          <select id="att-filter-emp" style="width: 100%; padding: 6px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
            <option value="all">Todos los colaboradores</option>
            ${state.administracion_employees.map(e => `<option value="${e.id}" ${filterEmp === e.id ? 'selected' : ''}>${e.employee_code || 'EMP-S/C'} - ${e.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 3px; color: var(--text-muted);">Departamento:</label>
          <select id="att-filter-dept" style="width: 100%; padding: 6px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
            <option value="all">Todos los departamentos</option>
            <option value="Hospitalización" ${filterDept === 'Hospitalización' ? 'selected' : ''}>Hospitalización</option>
            <option value="Emergencias" ${filterDept === 'Emergencias' ? 'selected' : ''}>Emergencias</option>
            <option value="Farmacia" ${filterDept === 'Farmacia' ? 'selected' : ''}>Farmacia</option>
            <option value="Quirófano" ${filterDept === 'Quirófano' ? 'selected' : ''}>Quirófano</option>
            <option value="Laboratorio" ${filterDept === 'Laboratorio' ? 'selected' : ''}>Laboratorio</option>
            <option value="Imagenología" ${filterDept === 'Imagenología' ? 'selected' : ''}>Imagenología</option>
            <option value="Consulta Externa" ${filterDept === 'Consulta Externa' ? 'selected' : ''}>Consulta Externa</option>
            <option value="Administración" ${filterDept === 'Administración' ? 'selected' : ''}>Administración</option>
            <option value="Mantenimiento" ${filterDept === 'Mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 3px; color: var(--text-muted);">Estado:</label>
          <select id="att-filter-status" style="width: 100%; padding: 6px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
            <option value="all">Todos los estados</option>
            <option value="ON_TIME" ${filterStatus === 'ON_TIME' ? 'selected' : ''}>A Tiempo</option>
            <option value="LATE" ${filterStatus === 'LATE' ? 'selected' : ''}>Retardo</option>
            <option value="MANUALLY_EDITED" ${filterStatus === 'MANUALLY_EDITED' ? 'selected' : ''}>Editado Manualmente</option>
            <option value="JUSTIFIED" ${filterStatus === 'JUSTIFIED' ? 'selected' : ''}>Justificado</option>
            <option value="ABSENT" ${filterStatus === 'ABSENT' ? 'selected' : ''}>Ausente</option>
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 3px; color: var(--text-muted);">Tipo:</label>
          <select id="att-filter-type" style="width: 100%; padding: 6px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
            <option value="all">Todos los tipos</option>
            <option value="ENTRADA" ${filterType === 'ENTRADA' ? 'selected' : ''}>Entrada</option>
            <option value="SALIDA" ${filterType === 'SALIDA' ? 'selected' : ''}>Salida</option>
          </select>
        </div>
        <div style="display: flex; align-items: flex-end; gap: 6px;">
          <button class="btn btn-primary btn-small" id="btn-apply-att-filters" style="flex: 1; padding: 6px;">Filtrar</button>
          <button class="btn btn-secondary btn-small" id="btn-reset-att-filters" style="padding: 6px;" title="Limpiar filtros">🔄</button>
        </div>
      </div>
    </div>

    <!-- Tabla Principal de Marcajes de Asistencia -->
    <div class="glass-card" style="padding: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="font-size: 1rem; color: var(--accent-primary); margin: 0; font-family: var(--font-heading);">
          📋 Historial de Marcajes y Auditoría (${filteredRecords.length} registros)
        </h3>
      </div>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
              <th style="padding: 8px;">Fecha / Hora</th>
              <th style="padding: 8px;">Código</th>
              <th style="padding: 8px;">Colaborador</th>
              <th style="padding: 8px;">Depto / Turno</th>
              <th style="padding: 8px; text-align: center;">Tipo</th>
              <th style="padding: 8px; text-align: center;">Estado</th>
              <th style="padding: 8px;">Dispositivo / IP</th>
              <th style="padding: 8px; text-align: center;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRecords.length === 0
              ? `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted); font-style: italic;">No se encontraron registros de asistencia con los filtros seleccionados.</td></tr>`
              : filteredRecords.map(r => {
                  const hasAudit = state.administracion_asistencias_audit.some(aud => aud.attendance_record_id === r.id);
                  
                  let statusHtml = '';
                  if (r.status === 'ON_TIME') {
                    statusHtml = `<span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 0.72rem;">🟢 A Tiempo</span>`;
                  } else if (r.status === 'LATE') {
                    statusHtml = `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 0.72rem;">🟠 Retardo (+${r.lateMinutes || 0}m)</span>`;
                  } else if (r.status === 'MANUALLY_EDITED') {
                    statusHtml = `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 0.72rem;">🔵 Editado Manual</span>`;
                  } else if (r.status === 'JUSTIFIED') {
                    statusHtml = `<span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 0.72rem;">🟣 Justificado</span>`;
                  } else if (r.status === 'ABSENT') {
                    statusHtml = `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 0.72rem;">🔴 Inasistencia</span>`;
                  } else {
                    statusHtml = `<span style="background: rgba(255, 255, 255, 0.1); color: #fff; padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 0.72rem;">${r.status || 'Registrado'}</span>`;
                  }

                  const timeDisplay = r.time_str || (r.time_in ? new Date(r.time_in).toLocaleTimeString('es-GT') : (r.time_out ? new Date(r.time_out).toLocaleTimeString('es-GT') : '--:--'));

                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                      <td style="padding: 8px;">
                        <strong>${r.date}</strong><br>
                        <span style="font-family: monospace; color: var(--accent-primary); font-size: 0.75rem;">${timeDisplay}</span>
                      </td>
                      <td style="padding: 8px;">
                        <span style="background: rgba(0, 242, 254, 0.1); color: var(--accent-primary); padding: 1px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; font-size: 0.75rem;">
                          ${r.employee_code || 'EMP-S/C'}
                        </span>
                      </td>
                      <td style="padding: 8px;">
                        <strong style="color: var(--text-primary); font-size: 0.85rem;">${r.employee_name}</strong>
                      </td>
                      <td style="padding: 8px; color: var(--text-muted); font-size: 0.75rem;">
                        ${r.department || 'General'}<br>
                        <span style="color: #64748b;">Turno: ${r.shift || 'Matutino'}</span>
                      </td>
                      <td style="padding: 8px; text-align: center;">
                        <span style="padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.72rem; background: ${r.type === 'ENTRADA' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${r.type === 'ENTRADA' ? '#22c55e' : '#ef4444'};">
                          ${r.type === 'ENTRADA' ? '🟢 ENTRADA' : '🔴 SALIDA'}
                        </span>
                      </td>
                      <td style="padding: 8px; text-align: center;">
                        ${statusHtml}
                      </td>
                      <td style="padding: 8px; font-size: 0.72rem; color: var(--text-muted);">
                        <span>${r.ip_address || 'Red Interna'}</span><br>
                        <span style="font-size: 0.68rem; color: #64748b; max-width: 140px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.user_agent || ''}">${r.user_agent ? (r.user_agent.includes('Mobile') ? '📱 Smartphone' : '💻 Estación PC') : 'Móvil QR'}</span>
                      </td>
                      <td style="padding: 8px; text-align: center;">
                        <div style="display: flex; gap: 4px; justify-content: center;">
                          <button class="btn btn-secondary btn-small btn-edit-att" data-id="${r.id}" style="padding: 3px 6px; font-size: 0.72rem;" title="Editar Marcaje">✏️</button>
                          ${hasAudit ? `<button class="btn btn-small btn-view-audit" data-id="${r.id}" style="padding: 3px 6px; font-size: 0.72rem; background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4);" title="Ver Historial de Auditoría">📜</button>` : ''}
                          <button class="btn btn-secondary btn-small btn-delete-att" data-id="${r.id}" style="padding: 3px 6px; font-size: 0.72rem; color: var(--accent-danger);" title="Eliminar Registro">❌</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal para Registrar Marcaje Manual -->
    <div id="modal-manual-attendance" class="modal-overlay" style="display: none; z-index: 1200;">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h2>➕ Registrar Marcaje Manual (RRHH)</h2>
          <button class="modal-close" id="btn-close-manual-att-modal">&times;</button>
        </div>
        <form id="form-manual-attendance">
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 1.25rem;">
            <div class="form-group">
              <label>Colaborador *</label>
              <select id="man-att-emp-id" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
                <option value="" disabled selected>Seleccione colaborador...</option>
                ${state.administracion_employees.map(e => `<option value="${e.id}">${e.employee_code || 'EMP-S/C'} - ${e.name} (${e.position})</option>`).join('')}
              </select>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label>Fecha *</label>
                <input type="date" id="man-att-date" required value="${todayYMD}" style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
              </div>
              <div class="form-group">
                <label>Hora (HH:mm) *</label>
                <input type="time" id="man-att-time" required value="${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false })}" style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
              </div>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label>Tipo de Evento *</label>
                <select id="man-att-type" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
                  <option value="ENTRADA">🟢 ENTRADA</option>
                  <option value="SALIDA">🔴 SALIDA</option>
                </select>
              </div>
              <div class="form-group">
                <label>Estado de Marcaje *</label>
                <select id="man-att-status" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
                  <option value="ON_TIME">🟢 A Tiempo</option>
                  <option value="LATE">🟠 Retardo</option>
                  <option value="JUSTIFIED">🟣 Justificado</option>
                  <option value="MANUALLY_EDITED" selected>🔵 Editado Manualmente</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label style="color: var(--accent-primary); font-weight: bold;">Motivo / Justificación de RRHH (Obligatorio) *</label>
              <textarea id="man-att-reason" required rows="3" placeholder="Ej. Olvido de escaneo al ingresar por emergencia quirúrgica, falla temporal de conexión en celular..." style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-cancel-manual-att">Cancelar</button>
            <button type="submit" class="btn btn-success">💾 Guardar Asistencia Manual</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal para Edición Controlada de Asistencia -->
    <div id="modal-edit-attendance" class="modal-overlay" style="display: none; z-index: 1200;">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h2>✏️ Modificar Registro de Asistencia</h2>
          <button class="modal-close" id="btn-close-edit-att-modal">&times;</button>
        </div>
        <form id="form-edit-attendance">
          <input type="hidden" id="edit-att-id" value="">
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 1.25rem;">
            <div id="edit-att-employee-banner" style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.2); padding: 10px; border-radius: 6px; font-size: 0.85rem;">
              <strong>Colaborador:</strong> <span id="edit-att-emp-name"></span>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label>Fecha *</label>
                <input type="date" id="edit-att-date" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
              </div>
              <div class="form-group">
                <label>Hora Registrada *</label>
                <input type="time" id="edit-att-time" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
              </div>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label>Tipo de Evento *</label>
                <select id="edit-att-type" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
                  <option value="ENTRADA">🟢 ENTRADA</option>
                  <option value="SALIDA">🔴 SALIDA</option>
                </select>
              </div>
              <div class="form-group">
                <label>Estado *</label>
                <select id="edit-att-status" required style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
                  <option value="ON_TIME">🟢 A Tiempo</option>
                  <option value="LATE">🟠 Retardo</option>
                  <option value="JUSTIFIED">🟣 Justificado</option>
                  <option value="MANUALLY_EDITED">🔵 Editado Manualmente</option>
                  <option value="ABSENT">🔴 Inasistencia</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label style="color: var(--accent-primary); font-weight: bold;">Motivo / Justificación del Cambio (Auditoría Obligatoria) *</label>
              <textarea id="edit-att-reason" required rows="3" placeholder="Indique la justificación formal para modificar esta asistencia (se registrará en bitácora de auditoría)..." style="width: 100%; padding: 8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="btn-cancel-edit-att">Cancelar</button>
            <button type="submit" class="btn btn-primary">💾 Guardar Modificación y Auditar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal para Visualizar Historial de Auditoría -->
    <div id="modal-view-audit" class="modal-overlay" style="display: none; z-index: 1200;">
      <div class="modal-content" style="max-width: 650px;">
        <div class="modal-header">
          <h2>📜 Bitácora de Auditoría de Asistencia</h2>
          <button class="modal-close" id="btn-close-audit-modal">&times;</button>
        </div>
        <div class="modal-body" id="audit-modal-content" style="max-height: 60vh; overflow-y: auto; padding: 1.25rem;">
          <!-- Se inyectan logs de auditoría -->
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="btn-close-audit-footer">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  // Listeners de Filtros
  const applyBtn = container.querySelector('#btn-apply-att-filters');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      renderRrhhAsistencia(container, state);
    });
  }

  const resetBtn = container.querySelector('#btn-reset-att-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (container.querySelector('#att-filter-from')) container.querySelector('#att-filter-from').value = firstDayOfMonth;
      if (container.querySelector('#att-filter-to')) container.querySelector('#att-filter-to').value = todayYMD;
      if (container.querySelector('#att-filter-emp')) container.querySelector('#att-filter-emp').value = 'all';
      if (container.querySelector('#att-filter-dept')) container.querySelector('#att-filter-dept').value = 'all';
      if (container.querySelector('#att-filter-status')) container.querySelector('#att-filter-status').value = 'all';
      if (container.querySelector('#att-filter-type')) container.querySelector('#att-filter-type').value = 'all';
      renderRrhhAsistencia(container, state);
    });
  }

  // Bind Modal Manual Attendance
  const modalManual = container.querySelector('#modal-manual-attendance');
  const btnOpenManual = container.querySelector('#btn-open-manual-attendance');
  const btnCloseManual = container.querySelector('#btn-close-manual-att-modal');
  const btnCancelManual = container.querySelector('#btn-cancel-manual-att');

  if (btnOpenManual && modalManual) {
    btnOpenManual.addEventListener('click', () => {
      modalManual.style.display = 'flex';
    });
  }
  const closeManualModal = () => { if (modalManual) modalManual.style.display = 'none'; };
  if (btnCloseManual) btnCloseManual.addEventListener('click', closeManualModal);
  if (btnCancelManual) btnCancelManual.addEventListener('click', closeManualModal);

  // Submit Manual Attendance Form
  const formManual = container.querySelector('#form-manual-attendance');
  if (formManual) {
    formManual.addEventListener('submit', async (e) => {
      e.preventDefault();
      const empId = container.querySelector('#man-att-emp-id').value;
      const date = container.querySelector('#man-att-date').value;
      const timeStr = container.querySelector('#man-att-time').value;
      const type = container.querySelector('#man-att-type').value;
      const status = container.querySelector('#man-att-status').value;
      const reason = container.querySelector('#man-att-reason').value.trim();

      if (!reason) {
        alert("⚠️ El motivo / justificación de RRHH es estrictamente obligatorio para auditoría.");
        return;
      }

      const emp = state.administracion_employees.find(x => x.id === empId);
      if (!emp) {
        alert("Colaborador no encontrado.");
        return;
      }

      const currentUser = state.currentUser || { name: 'Administrador Maestro', id: 'Admin' };
      const nowIso = new Date().toISOString();

      const newRecord = {
        id: 'att-man-' + Date.now(),
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name: emp.name,
        department: emp.department || 'General',
        shift: emp.shift || 'Matutino',
        date: date,
        time_in: type === 'ENTRADA' ? `${date}T${timeStr}:00` : null,
        time_out: type === 'SALIDA' ? `${date}T${timeStr}:00` : null,
        time_str: timeStr + ':00',
        type: type,
        status: status,
        lateMinutes: 0,
        hoursWorked: null,
        ip_address: 'Ajuste Manual RRHH',
        user_agent: `Creado manualmente por ${currentUser.name}`,
        created_at: nowIso,
        updated_at: nowIso
      };

      state.administracion_asistencias.unshift(newRecord);

      // Registrar Auditoría
      const auditLog = {
        id: 'audit-' + Date.now(),
        attendance_record_id: newRecord.id,
        employee_id: emp.id,
        employee_name: emp.name,
        modified_by_user_id: currentUser.id || 'Admin',
        modified_by_user_name: currentUser.name || 'Administrador',
        previous_value: null,
        new_value: newRecord,
        reason: `Creación manual: ${reason}`,
        modified_at: nowIso
      };

      state.administracion_asistencias_audit.unshift(auditLog);
      await saveAppState(state);

      alert(`✅ Marcaje manual de ${type} registrado y auditado exitosamente para ${emp.name}.`);
      closeManualModal();
      renderRrhhAsistencia(container, state);
    });
  }

  // Bind Edit Attendance Buttons
  const modalEdit = container.querySelector('#modal-edit-attendance');
  const btnCloseEdit = container.querySelector('#btn-close-edit-att-modal');
  const btnCancelEdit = container.querySelector('#btn-cancel-edit-att');
  const closeEditModal = () => { if (modalEdit) modalEdit.style.display = 'none'; };
  if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEditModal);
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditModal);

  container.querySelectorAll('.btn-edit-att').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const rec = state.administracion_asistencias.find(a => a.id === id);
      if (!rec) return;

      container.querySelector('#edit-att-id').value = rec.id;
      container.querySelector('#edit-att-emp-name').textContent = `${rec.employee_name} (${rec.employee_code || 'EMP-S/C'})`;
      container.querySelector('#edit-att-date').value = rec.date;
      
      let timeVal = '08:00';
      if (rec.time_str) {
        timeVal = rec.time_str.substring(0, 5);
      } else if (rec.time_in) {
        timeVal = new Date(rec.time_in).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });
      } else if (rec.time_out) {
        timeVal = new Date(rec.time_out).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      container.querySelector('#edit-att-time').value = timeVal;
      container.querySelector('#edit-att-type').value = rec.type || 'ENTRADA';
      container.querySelector('#edit-att-status').value = rec.status || 'MANUALLY_EDITED';
      container.querySelector('#edit-att-reason').value = '';

      modalEdit.style.display = 'flex';
    });
  });

  // Submit Edit Attendance Form with Audit
  const formEdit = container.querySelector('#form-edit-attendance');
  if (formEdit) {
    formEdit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = container.querySelector('#edit-att-id').value;
      const rec = state.administracion_asistencias.find(a => a.id === id);
      if (!rec) return;

      const reason = container.querySelector('#edit-att-reason').value.trim();
      if (!reason) {
        alert("⚠️ Debe ingresar un motivo o justificación formal para auditar el cambio.");
        return;
      }

      const prevCopy = JSON.parse(JSON.stringify(rec));
      const currentUser = state.currentUser || { name: 'Administrador Maestro', id: 'Admin' };
      const nowIso = new Date().toISOString();

      rec.date = container.querySelector('#edit-att-date').value;
      const newTime = container.querySelector('#edit-att-time').value;
      rec.time_str = newTime + ':00';
      rec.type = container.querySelector('#edit-att-type').value;
      rec.status = container.querySelector('#edit-att-status').value;
      rec.updated_at = nowIso;

      if (rec.type === 'ENTRADA') {
        rec.time_in = `${rec.date}T${newTime}:00`;
      } else {
        rec.time_out = `${rec.date}T${newTime}:00`;
      }

      // Crear entrada de auditoría
      const auditLog = {
        id: 'audit-' + Date.now(),
        attendance_record_id: rec.id,
        employee_id: rec.employee_id,
        employee_name: rec.employee_name,
        modified_by_user_id: currentUser.id || 'Admin',
        modified_by_user_name: currentUser.name || 'Administrador',
        previous_value: prevCopy,
        new_value: JSON.parse(JSON.stringify(rec)),
        reason: reason,
        modified_at: nowIso
      };

      state.administracion_asistencias_audit.unshift(auditLog);
      await saveAppState(state);

      alert(`✅ Asistencia modificada correctamente y asentada en la bitácora de auditoría.`);
      closeEditModal();
      renderRrhhAsistencia(container, state);
    });
  }

  // Bind Ver Auditoría Buttons
  const modalAudit = container.querySelector('#modal-view-audit');
  const auditContent = container.querySelector('#audit-modal-content');
  const btnCloseAudit = container.querySelector('#btn-close-audit-modal');
  const btnCloseAuditFooter = container.querySelector('#btn-close-audit-footer');
  const closeAuditModal = () => { if (modalAudit) modalAudit.style.display = 'none'; };
  if (btnCloseAudit) btnCloseAudit.addEventListener('click', closeAuditModal);
  if (btnCloseAuditFooter) btnCloseAuditFooter.addEventListener('click', closeAuditModal);

  container.querySelectorAll('.btn-view-audit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const audits = state.administracion_asistencias_audit.filter(a => a.attendance_record_id === id);
      const rec = state.administracion_asistencias.find(a => a.id === id);

      if (audits.length === 0) {
        alert("No se registran modificaciones de auditoría para este registro.");
        return;
      }

      auditContent.innerHTML = `
        <div style="margin-bottom: 12px; font-size: 0.9rem;">
          <strong>Colaborador:</strong> ${rec ? rec.employee_name : 'Personal'} (${rec ? rec.employee_code : ''})<br>
          <span style="color: var(--text-muted); font-size: 0.8rem;">ID Registro: ${id}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${audits.map(a => `
            <div style="border: 1px solid var(--border-color); border-left: 3px solid var(--accent-primary); background: rgba(255,255,255,0.02); padding: 10px; border-radius: 6px; font-size: 0.82rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <strong style="color: var(--accent-primary);">👤 Modificado por: ${a.modified_by_user_name}</strong>
                <span style="color: var(--text-muted); font-size: 0.75rem;">📅 ${new Date(a.modified_at).toLocaleString('es-GT')}</span>
              </div>
              <div style="background: rgba(0,0,0,0.3); padding: 6px 8px; border-radius: 4px; margin: 6px 0;">
                <strong>Motivo / Justificación:</strong><br>
                <span style="color: #cbd5e1; font-style: italic;">"${a.reason}"</span>
              </div>
              ${a.previous_value ? `
                <div style="font-size: 0.75rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px;">
                  <div>
                    <span style="color: #ef4444; font-weight: bold;">Anterior:</span><br>
                    Fecha: ${a.previous_value.date} | Hora: ${a.previous_value.time_str || '--'}<br>
                    Estado: ${a.previous_value.status}
                  </div>
                  <div>
                    <span style="color: #22c55e; font-weight: bold;">Nuevo:</span><br>
                    Fecha: ${a.new_value.date} | Hora: ${a.new_value.time_str || '--'}<br>
                    Estado: ${a.new_value.status}
                  </div>
                </div>
              ` : `<span style="color: #60a5fa; font-size: 0.75rem;">Registro insertado inicialmente de forma manual por RRHH.</span>`}
            </div>
          `).join('')}
        </div>
      `;

      modalAudit.style.display = 'flex';
    });
  });

  // Bind Delete Attendance
  container.querySelectorAll('.btn-delete-att').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const rec = state.administracion_asistencias.find(a => a.id === id);
      if (!rec) return;

      const reason = prompt(`¿Confirma eliminar el registro de ${rec.type} de ${rec.employee_name} (${rec.date})?\n\nIngrese el motivo de la eliminación:`);
      if (reason !== null && reason.trim() !== '') {
        const currentUser = state.currentUser || { name: 'Administrador Maestro', id: 'Admin' };
        // Registrar log de auditoría por eliminación
        state.administracion_asistencias_audit.unshift({
          id: 'audit-del-' + Date.now(),
          attendance_record_id: rec.id,
          employee_id: rec.employee_id,
          employee_name: rec.employee_name,
          modified_by_user_id: currentUser.id || 'Admin',
          modified_by_user_name: currentUser.name || 'Administrador',
          previous_value: rec,
          new_value: { deleted: true },
          reason: `Eliminación: ${reason}`,
          modified_at: new Date().toISOString()
        });

        state.administracion_asistencias = state.administracion_asistencias.filter(a => a.id !== id);
        await saveAppState(state);
        alert("Marcaje eliminado y registrado en la bitácora de auditoría.");
        renderRrhhAsistencia(container, state);
      }
    });
  });
}
