import * as XLSX from 'xlsx';
import logoUrl from '../assets/logo.jpg';

let currentReportTab = 'diario'; // 'diario', 'mensual', 'anual', 'empleado'

// Helper para formatear minutos a "Xh Ym"
function formatMinutes(mins) {
  if (!mins || isNaN(mins)) return '0m';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Helper para calcular diferencia de horas entre dos marcas
function calculateHoursDiff(timeInStr, timeOutStr) {
  if (!timeInStr || !timeOutStr) return 0;
  const dIn = new Date(timeInStr);
  const dOut = new Date(timeOutStr);
  const diffMs = dOut - dIn;
  if (diffMs <= 0) return 0;
  return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
}

// Helper para exportar a Excel XLSX
export function exportReportToExcel(headers, rows, sheetName, fileName) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

// Helper para exportar a CSV con BOM UTF-8
export function exportReportToCsv(headers, rows, fileName) {
  let csvContent = '\uFEFF';
  const data = [headers, ...rows];
  data.forEach(row => {
    const line = row.map(cell => {
      let val = cell === null || cell === undefined ? '' : String(cell);
      if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes(';')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(';');
    csvContent += line + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helper para abrir la vista previa de impresión con membrete oficial
export function openAttendanceReportPrintModal(title, subtitle, tableHtml, summaryHtml = '', state = {}) {
  const modal = document.getElementById('prescription-print-modal');
  const previewContainer = document.getElementById('prescription-preview-content');
  const printActionBtn = document.getElementById('btn-print-action');
  const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;

  if (!modal || !previewContainer || !printActionBtn) return;

  if (modalTitle) modalTitle.textContent = `Vista Preliminar: ${title}`;
  printActionBtn.innerHTML = '<span>🖨️</span> Imprimir Reporte / Guardar PDF';

  const clinic = state.clinicInfo || {
    name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ',
    address: 'Barrio El Centro, Sayaxché, Petén',
    phone: '(502) 7928-0000 / 5555-1234',
    email: 'contacto@multimedicasayaxche.com'
  };

  const printDate = new Date().toLocaleString('es-GT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  previewContainer.innerHTML = `
    <div class="prescription-preview-box" style="background: #fff; color: #000; padding: 20px; font-family: Arial, sans-serif;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <td style="border: none; padding: 0 0 10px 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  ${clinic.logoData 
                    ? `<img src="${clinic.logoData}" style="max-height: 80px; max-width: 180px; object-fit: contain;">`
                    : `<img src="${logoUrl}" style="max-height: 80px; max-width: 180px; object-fit: contain;">`}
                  <div>
                    <h2 style="margin: 0; font-size: 1.15rem; color: #0f172a; text-transform: uppercase;">${clinic.name}</h2>
                    <div style="font-size: 0.8rem; font-weight: bold; color: #475569;">DEPARTAMENTO DE RECURSOS HUMANOS Y CONTROL DE ASISTENCIA</div>
                    <div style="font-size: 0.75rem; color: #64748b;">${clinic.address} | Tel: ${clinic.phone}</div>
                  </div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: #475569;">
                  <strong>Fecha de Emisión:</strong><br>${printDate}<br>
                  <span style="font-size: 0.7rem; color: #94a3b8;">Sistema LUGAMED v5.0</span>
                </div>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: none; padding: 0;">
              <div style="text-align: center; margin-bottom: 15px; padding: 6px; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px;">
                <h3 style="margin: 0; font-size: 1rem; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${title}</h3>
                ${subtitle ? `<div style="font-size: 0.8rem; color: #334155; margin-top: 2px;">${subtitle}</div>` : ''}
              </div>

              ${summaryHtml ? `<div style="margin-bottom: 15px;">${summaryHtml}</div>` : ''}

              <div style="margin-top: 10px; overflow-x: auto;">
                ${tableHtml}
              </div>

              <!-- Firmas de Responsabilidad -->
              <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; font-size: 0.75rem; color: #334155; page-break-inside: avoid;">
                <div>
                  <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 5px auto;"></div>
                  <strong>Encargado de Recursos Humanos</strong><br>
                  <span>Hospital Multimédica Sayaxché</span>
                </div>
                <div>
                  <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 5px auto;"></div>
                  <strong>Dirección Médica / Administración</strong><br>
                  <span>Sello y Vo.Bo.</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  printActionBtn.onclick = () => window.print();
  modal.style.display = 'flex';
}

// =============================================================
// 📊 RENDERIZADOR PRINCIPAL DEL SUBMÓDULO DE REPORTES
// =============================================================
export function renderRrhhReportes(container, state) {
  state.administracion_asistencias = state.administracion_asistencias || [];
  state.administracion_employees = state.administracion_employees || [];
  state.administracion_asistencias_audit = state.administracion_asistencias_audit || [];

  container.innerHTML = `
    <!-- Barra de Selección de Tipos de Reporte -->
    <div class="glass-card" style="padding: 1rem; margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 style="font-size: 1.05rem; color: var(--accent-primary); margin: 0; font-family: var(--font-heading);">
            📊 Centro de Reportería y Análisis de Asistencia
          </h3>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin: 3px 0 0 0;">
            Genere reportes oficiales con membrete clínico, resúmenes operativos y exportaciones en Excel/CSV.
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn ${currentReportTab === 'diario' ? 'btn-primary' : 'btn-secondary'}" id="btn-rep-diario" style="padding: 6px 14px; font-size: 0.82rem;">📅 Reporte Diario</button>
          <button class="btn ${currentReportTab === 'mensual' ? 'btn-primary' : 'btn-secondary'}" id="btn-rep-mensual" style="padding: 6px 14px; font-size: 0.82rem;">🗓️ Reporte Mensual</button>
          <button class="btn ${currentReportTab === 'anual' ? 'btn-primary' : 'btn-secondary'}" id="btn-rep-anual" style="padding: 6px 14px; font-size: 0.82rem;">📈 Reporte Anual</button>
          <button class="btn ${currentReportTab === 'empleado' ? 'btn-primary' : 'btn-secondary'}" id="btn-rep-empleado" style="padding: 6px 14px; font-size: 0.82rem;">👤 Por Empleado</button>
        </div>
      </div>
    </div>

    <!-- Contenedor Dinámico del Reporte -->
    <div id="rrhh-report-view-container"></div>
  `;

  // Bind Switchers
  const reportView = container.querySelector('#rrhh-report-view-container');
  const btnD = container.querySelector('#btn-rep-diario');
  const btnM = container.querySelector('#btn-rep-mensual');
  const btnA = container.querySelector('#btn-rep-anual');
  const btnE = container.querySelector('#btn-rep-empleado');

  const updateActiveTab = (tab) => {
    currentReportTab = tab;
    renderRrhhReportes(container, state);
  };

  if (btnD) btnD.addEventListener('click', () => updateActiveTab('diario'));
  if (btnM) btnM.addEventListener('click', () => updateActiveTab('mensual'));
  if (btnA) btnA.addEventListener('click', () => updateActiveTab('anual'));
  if (btnE) btnE.addEventListener('click', () => updateActiveTab('empleado'));

  if (currentReportTab === 'diario') {
    renderDailyReport(reportView, state);
  } else if (currentReportTab === 'mensual') {
    renderMonthlyReport(reportView, state);
  } else if (currentReportTab === 'anual') {
    renderAnnualReport(reportView, state);
  } else if (currentReportTab === 'empleado') {
    renderEmployeeReport(reportView, state);
  }
}

// -------------------------------------------------------------
// 1. REPORTE DIARIO DE ASISTENCIA
// -------------------------------------------------------------
function renderDailyReport(container, state) {
  const todayYMD = new Date().toLocaleDateString('en-CA');
  let selectedDate = container.querySelector('#rep-daily-date')?.value || todayYMD;
  let selectedDept = container.querySelector('#rep-daily-dept')?.value || 'all';

  const activeEmployees = (state.administracion_employees || []).filter(e => e.status === 'Activo');
  const dayRecords = (state.administracion_asistencias || []).filter(a => a.date === selectedDate);

  // Mapeo por empleado para el día
  const employeeDayData = activeEmployees.map(emp => {
    const empRecords = dayRecords.filter(r => r.employee_id === emp.id || r.employee_code === emp.employee_code);
    const entry = empRecords.find(r => r.type === 'ENTRADA');
    const exit = empRecords.find(r => r.type === 'SALIDA');

    let hoursWorked = 0;
    if (entry && exit) {
      hoursWorked = calculateHoursDiff(entry.time_in, exit.time_out);
    }

    let status = 'SIN_REGISTRO';
    let lateMins = 0;
    if (entry) {
      status = entry.status;
      lateMins = entry.lateMinutes || 0;
    }

    return {
      employee: emp,
      entry: entry,
      exit: exit,
      hoursWorked: hoursWorked,
      status: status,
      lateMinutes: lateMins
    };
  }).filter(item => selectedDept === 'all' || item.employee.department === selectedDept);

  // Métricas
  const totalEmployees = employeeDayData.length;
  const presentCount = employeeDayData.filter(i => i.entry !== undefined).length;
  const onTimeCount = employeeDayData.filter(i => i.status === 'ON_TIME').length;
  const lateCount = employeeDayData.filter(i => i.status === 'LATE').length;
  const absentCount = totalEmployees - presentCount;
  const totalHoursDay = employeeDayData.reduce((acc, curr) => acc + curr.hoursWorked, 0);

  container.innerHTML = `
    <!-- Filtros y Botones de Exportación -->
    <div class="glass-card" style="padding: 1.25rem; margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 3px;">Fecha del Reporte:</label>
            <input type="date" id="rep-daily-date" value="${selectedDate}" style="padding: 6px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 3px;">Departamento:</label>
            <select id="rep-daily-dept" style="padding: 6px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
              <option value="all">Todos los departamentos</option>
              <option value="Hospitalización" ${selectedDept === 'Hospitalización' ? 'selected' : ''}>Hospitalización</option>
              <option value="Emergencias" ${selectedDept === 'Emergencias' ? 'selected' : ''}>Emergencias</option>
              <option value="Farmacia" ${selectedDept === 'Farmacia' ? 'selected' : ''}>Farmacia</option>
              <option value="Quirófano" ${selectedDept === 'Quirófano' ? 'selected' : ''}>Quirófano</option>
              <option value="Laboratorio" ${selectedDept === 'Laboratorio' ? 'selected' : ''}>Laboratorio</option>
              <option value="Imagenología" ${selectedDept === 'Imagenología' ? 'selected' : ''}>Imagenología</option>
              <option value="Consulta Externa" ${selectedDept === 'Consulta Externa' ? 'selected' : ''}>Consulta Externa</option>
              <option value="Administración" ${selectedDept === 'Administración' ? 'selected' : ''}>Administración</option>
              <option value="Mantenimiento" ${selectedDept === 'Mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
            </select>
          </div>
          <button class="btn btn-secondary btn-small" id="btn-rep-daily-refresh" style="align-self: flex-end; padding: 7px 12px;">🔄 Actualizar</button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-small" id="btn-exp-daily-pdf" style="padding: 7px 12px; font-weight: 600;">🖨️ Imprimir / PDF</button>
          <button class="btn btn-secondary btn-small" id="btn-exp-daily-excel" style="padding: 7px 12px; font-weight: 600; color: #22c55e;">📊 Excel (.xlsx)</button>
          <button class="btn btn-secondary btn-small" id="btn-exp-daily-csv" style="padding: 7px 12px; font-weight: 600;">📄 CSV</button>
        </div>
      </div>
    </div>

    <!-- Indicadores Clave del Día -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 1.25rem;">
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid var(--accent-primary);">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Personal Programado</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-top: 3px;">${totalEmployees}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">Plantilla activa</div>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #22c55e;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Presentes / Asistieron</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #22c55e; margin-top: 3px;">${presentCount}</div>
        <div style="font-size: 0.7rem; color: #22c55e;">${totalEmployees > 0 ? ((presentCount / totalEmployees) * 100).toFixed(0) : 0}% de asistencia</div>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #3b82f6;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">A Tiempo</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #60a5fa; margin-top: 3px;">${onTimeCount}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">Sin retardo</div>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #f59e0b;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Retardos</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #f59e0b; margin-top: 3px;">${lateCount}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">Fuera de tolerancia</div>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #ef4444;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Ausentes / Sin Entrada</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #ef4444; margin-top: 3px;">${absentCount}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">Sin registro hoy</div>
      </div>
    </div>

    <!-- Tabla Detallada Diaria -->
    <div class="glass-card" style="padding: 1.25rem;">
      <h3 style="font-size: 0.95rem; color: var(--accent-primary); margin: 0 0 1rem 0; font-family: var(--font-heading);">
        📋 Detalle de Marcajes del Día (${selectedDate})
      </h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
              <th style="padding: 8px;">Código</th>
              <th style="padding: 8px;">Colaborador</th>
              <th style="padding: 8px;">Depto / Cargo</th>
              <th style="padding: 8px;">Turno</th>
              <th style="padding: 8px; text-align: center;">Entrada</th>
              <th style="padding: 8px; text-align: center;">Salida</th>
              <th style="padding: 8px; text-align: center;">Horas</th>
              <th style="padding: 8px; text-align: center;">Estado Entrada</th>
              <th style="padding: 8px; text-align: center;">Retardo</th>
            </tr>
          </thead>
          <tbody>
            ${employeeDayData.length === 0
              ? `<tr><td colspan="9" style="text-align: center; padding: 25px; color: var(--text-muted);">No hay colaboradores registrados.</td></tr>`
              : employeeDayData.map(item => {
                  const entryTime = item.entry ? (item.entry.time_str || (item.entry.time_in ? new Date(item.entry.time_in).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : '--:--')) : '--:--';
                  const exitTime = item.exit ? (item.exit.time_str || (item.exit.time_out ? new Date(item.exit.time_out).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : '--:--')) : '--:--';
                  
                  let badge = '';
                  if (item.status === 'ON_TIME') badge = '<span style="background: rgba(34,197,94,0.15); color: #22c55e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem;">A Tiempo</span>';
                  else if (item.status === 'LATE') badge = `<span style="background: rgba(245,158,11,0.15); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem;">Retardo (+${item.lateMinutes}m)</span>`;
                  else if (item.status === 'MANUALLY_EDITED') badge = '<span style="background: rgba(59,130,246,0.15); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem;">Manual</span>';
                  else if (item.status === 'JUSTIFIED') badge = '<span style="background: rgba(168,85,247,0.15); color: #c084fc; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem;">Justificado</span>';
                  else badge = '<span style="background: rgba(239,68,68,0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem;">Sin Marcaje</span>';

                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                      <td style="padding: 8px;"><span style="font-family: monospace; color: var(--accent-primary); font-weight: bold;">${item.employee.employee_code || 'EMP-S/C'}</span></td>
                      <td style="padding: 8px; font-weight: bold; color: var(--text-primary);">${item.employee.name}</td>
                      <td style="padding: 8px; color: var(--text-muted); font-size: 0.75rem;">${item.employee.department || 'General'}<br><span style="color: #64748b;">${item.employee.position}</span></td>
                      <td style="padding: 8px; font-size: 0.75rem;">${item.employee.shift || 'Matutino'}</td>
                      <td style="padding: 8px; text-align: center; font-family: monospace; font-weight: bold; color: ${item.entry ? '#22c55e' : 'var(--text-muted)'};">${entryTime}</td>
                      <td style="padding: 8px; text-align: center; font-family: monospace; font-weight: bold; color: ${item.exit ? '#ef4444' : 'var(--text-muted)'};">${exitTime}</td>
                      <td style="padding: 8px; text-align: center; font-weight: bold;">${item.hoursWorked > 0 ? `${item.hoursWorked} hrs` : '--'}</td>
                      <td style="padding: 8px; text-align: center;">${badge}</td>
                      <td style="padding: 8px; text-align: center; color: ${item.lateMinutes > 0 ? '#f59e0b' : 'var(--text-muted)'}; font-weight: bold;">${item.lateMinutes > 0 ? `+${item.lateMinutes} min` : '0 min'}</td>
                    </tr>
                  `;
                }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Listeners
  container.querySelector('#btn-rep-daily-refresh').addEventListener('click', () => {
    renderDailyReport(container, state);
  });

  // Exportar Excel
  container.querySelector('#btn-exp-daily-excel').addEventListener('click', () => {
    const headers = ['Código', 'Colaborador', 'Departamento', 'Puesto', 'Turno', 'Hora Entrada', 'Hora Salida', 'Horas Trabajadas', 'Estado', 'Minutos Retardo'];
    const rows = employeeDayData.map(i => [
      i.employee.employee_code || '',
      i.employee.name,
      i.employee.department || '',
      i.employee.position || '',
      i.employee.shift || '',
      i.entry ? (i.entry.time_str || i.entry.time_in) : '',
      i.exit ? (i.exit.time_str || i.exit.time_out) : '',
      i.hoursWorked,
      i.status,
      i.lateMinutes
    ]);
    exportReportToExcel(headers, rows, 'Asistencia Diaria', `Reporte_Asistencia_Diario_${selectedDate}`);
  });

  // Exportar CSV
  container.querySelector('#btn-exp-daily-csv').addEventListener('click', () => {
    const headers = ['Código', 'Colaborador', 'Departamento', 'Puesto', 'Turno', 'Hora Entrada', 'Hora Salida', 'Horas Trabajadas', 'Estado', 'Minutos Retardo'];
    const rows = employeeDayData.map(i => [
      i.employee.employee_code || '',
      i.employee.name,
      i.employee.department || '',
      i.employee.position || '',
      i.employee.shift || '',
      i.entry ? (i.entry.time_str || i.entry.time_in) : '',
      i.exit ? (i.exit.time_str || i.exit.time_out) : '',
      i.hoursWorked,
      i.status,
      i.lateMinutes
    ]);
    exportReportToCsv(headers, rows, `Reporte_Asistencia_Diario_${selectedDate}`);
  });

  // Imprimir / PDF
  container.querySelector('#btn-exp-daily-pdf').addEventListener('click', () => {
    const summaryHtml = `
      <div style="display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; font-size: 0.78rem; margin-bottom: 12px;">
        <div><strong>Personal Programado:</strong> ${totalEmployees}</div>
        <div><strong>Presentes:</strong> ${presentCount}</div>
        <div><strong>A Tiempo:</strong> ${onTimeCount}</div>
        <div><strong>Retardos:</strong> ${lateCount}</div>
        <div><strong>Ausentes:</strong> ${absentCount}</div>
      </div>
    `;

    const tableRowsHtml = employeeDayData.map(i => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px; font-family: monospace; font-weight: bold;">${i.employee.employee_code || 'EMP-S/C'}</td>
        <td style="padding: 6px; font-weight: bold;">${i.employee.name}</td>
        <td style="padding: 6px;">${i.employee.department || 'General'}</td>
        <td style="padding: 6px;">${i.employee.shift || 'Matutino'}</td>
        <td style="padding: 6px; text-align: center; font-family: monospace;">${i.entry ? (i.entry.time_str || i.entry.time_in.substring(11, 16)) : '--:--'}</td>
        <td style="padding: 6px; text-align: center; font-family: monospace;">${i.exit ? (i.exit.time_str || i.exit.time_out.substring(11, 16)) : '--:--'}</td>
        <td style="padding: 6px; text-align: center;">${i.hoursWorked > 0 ? `${i.hoursWorked}h` : '--'}</td>
        <td style="padding: 6px; text-align: center; font-weight: bold;">${i.status}</td>
        <td style="padding: 6px; text-align: center;">${i.lateMinutes > 0 ? `+${i.lateMinutes}m` : '0m'}</td>
      </tr>
    `).join('');

    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 6px;">Código</th>
            <th style="padding: 6px;">Colaborador</th>
            <th style="padding: 6px;">Depto</th>
            <th style="padding: 6px;">Turno</th>
            <th style="padding: 6px; text-align: center;">Entrada</th>
            <th style="padding: 6px; text-align: center;">Salida</th>
            <th style="padding: 6px; text-align: center;">Horas</th>
            <th style="padding: 6px; text-align: center;">Estado</th>
            <th style="padding: 6px; text-align: center;">Retardo</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    `;

    openAttendanceReportPrintModal(
      'REPORTE DIARIO DE ASISTENCIA Y PUNTUALIDAD',
      `Fecha: ${selectedDate} | Departamento: ${selectedDept === 'all' ? 'Todos' : selectedDept}`,
      tableHtml,
      summaryHtml,
      state
    );
  });
}

// -------------------------------------------------------------
// 2. REPORTE MENSUAL DE ASISTENCIA
// -------------------------------------------------------------
function renderMonthlyReport(container, state) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let selectedMonth = container.querySelector('#rep-month-picker')?.value || defaultMonth;
  let selectedDept = container.querySelector('#rep-month-dept')?.value || 'all';

  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  const activeEmployees = (state.administracion_employees || []).filter(e => e.status === 'Activo');
  const monthRecords = (state.administracion_asistencias || []).filter(a => a.date && a.date.startsWith(selectedMonth));

  // Consolidado por Empleado
  const employeeMonthlyData = activeEmployees.map(emp => {
    const empRecords = monthRecords.filter(r => r.employee_id === emp.id || r.employee_code === emp.employee_code);
    
    // Días únicos de asistencia
    const uniqueDates = new Set(empRecords.map(r => r.date));
    const daysAttended = uniqueDates.size;
    
    const entries = empRecords.filter(r => r.type === 'ENTRADA');
    const onTimeCount = entries.filter(r => r.status === 'ON_TIME').length;
    const lateEntries = entries.filter(r => r.status === 'LATE');
    const lateDaysCount = lateEntries.length;
    const totalLateMinutes = lateEntries.reduce((acc, curr) => acc + (curr.lateMinutes || 0), 0);
    
    // Calcular horas sumando pares entrada-salida o registros
    let totalHours = 0;
    uniqueDates.forEach(d => {
      const dayRecs = empRecords.filter(r => r.date === d);
      const en = dayRecs.find(r => r.type === 'ENTRADA');
      const ex = dayRecs.find(r => r.type === 'SALIDA');
      if (en && ex) {
        totalHours += calculateHoursDiff(en.time_in, ex.time_out);
      } else if (en) {
        totalHours += 8; // Estimado base de jornada si no marcó salida
      }
    });

    const punctualityRate = entries.length > 0 ? ((onTimeCount / entries.length) * 100).toFixed(1) : '100.0';

    return {
      employee: emp,
      daysAttended: daysAttended,
      totalHours: parseFloat(totalHours.toFixed(1)),
      entriesCount: entries.length,
      onTimeCount: onTimeCount,
      lateDaysCount: lateDaysCount,
      totalLateMinutes: totalLateMinutes,
      punctualityRate: parseFloat(punctualityRate)
    };
  }).filter(item => selectedDept === 'all' || item.employee.department === selectedDept);

  // Totales globales del mes
  const globalTotalHours = employeeMonthlyData.reduce((acc, curr) => acc + curr.totalHours, 0);
  const globalTotalLates = employeeMonthlyData.reduce((acc, curr) => acc + curr.lateDaysCount, 0);
  const globalTotalLateMins = employeeMonthlyData.reduce((acc, curr) => acc + curr.totalLateMinutes, 0);
  const avgPunctuality = employeeMonthlyData.length > 0 
    ? (employeeMonthlyData.reduce((acc, curr) => acc + curr.punctualityRate, 0) / employeeMonthlyData.length).toFixed(1)
    : '100.0';

  container.innerHTML = `
    <!-- Filtros de Mes -->
    <div class="glass-card" style="padding: 1.25rem; margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 3px;">Mes / Año:</label>
            <input type="month" id="rep-month-picker" value="${selectedMonth}" style="padding: 6px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 3px;">Departamento:</label>
            <select id="rep-month-dept" style="padding: 6px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
              <option value="all">Todos los departamentos</option>
              <option value="Hospitalización" ${selectedDept === 'Hospitalización' ? 'selected' : ''}>Hospitalización</option>
              <option value="Emergencias" ${selectedDept === 'Emergencias' ? 'selected' : ''}>Emergencias</option>
              <option value="Farmacia" ${selectedDept === 'Farmacia' ? 'selected' : ''}>Farmacia</option>
              <option value="Quirófano" ${selectedDept === 'Quirófano' ? 'selected' : ''}>Quirófano</option>
              <option value="Laboratorio" ${selectedDept === 'Laboratorio' ? 'selected' : ''}>Laboratorio</option>
              <option value="Imagenología" ${selectedDept === 'Imagenología' ? 'selected' : ''}>Imagenología</option>
              <option value="Consulta Externa" ${selectedDept === 'Consulta Externa' ? 'selected' : ''}>Consulta Externa</option>
              <option value="Administración" ${selectedDept === 'Administración' ? 'selected' : ''}>Administración</option>
              <option value="Mantenimiento" ${selectedDept === 'Mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
            </select>
          </div>
          <button class="btn btn-secondary btn-small" id="btn-rep-month-refresh" style="align-self: flex-end; padding: 7px 12px;">🔄 Actualizar</button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-small" id="btn-exp-month-pdf" style="padding: 7px 12px; font-weight: 600;">🖨️ Imprimir / PDF</button>
          <button class="btn btn-secondary btn-small" id="btn-exp-month-excel" style="padding: 7px 12px; font-weight: 600; color: #22c55e;">📊 Excel (.xlsx)</button>
          <button class="btn btn-secondary btn-small" id="btn-exp-month-csv" style="padding: 7px 12px; font-weight: 600;">📄 CSV</button>
        </div>
      </div>
    </div>

    <!-- Indicadores Clave del Mes -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 1.25rem;">
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid var(--accent-primary);">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Total Horas del Mes</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-top: 3px;">${globalTotalHours} hrs</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">${daysInMonth} días calendario</div>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #22c55e;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Puntualidad Global</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #22c55e; margin-top: 3px;">${avgPunctuality}%</div>
        <div style="font-size: 0.7rem; color: #22c55e;">Índice de cumplimiento</div>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #f59e0b;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Retardos Acumulados</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #f59e0b; margin-top: 3px;">${globalTotalLates}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">${formatMinutes(globalTotalLateMins)} perdidos</div>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #3b82f6;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Total Marcajes Mes</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #60a5fa; margin-top: 3px;">${monthRecords.length}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">Eventos de Entrada/Salida</div>
      </div>
    </div>

    <!-- Tabla Consolidada Mensual -->
    <div class="glass-card" style="padding: 1.25rem;">
      <h3 style="font-size: 0.95rem; color: var(--accent-primary); margin: 0 0 1rem 0; font-family: var(--font-heading);">
        📊 Matriz Mensual de Asistencia y Puntualidad por Colaborador
      </h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
              <th style="padding: 8px;">Código</th>
              <th style="padding: 8px;">Colaborador</th>
              <th style="padding: 8px;">Depto / Puesto</th>
              <th style="padding: 8px; text-align: center;">Días Asistidos</th>
              <th style="padding: 8px; text-align: center;">Total Horas</th>
              <th style="padding: 8px; text-align: center;">A Tiempo</th>
              <th style="padding: 8px; text-align: center;">Días Retardo</th>
              <th style="padding: 8px; text-align: center;">Minutos Retardo</th>
              <th style="padding: 8px; text-align: center;">% Puntualidad</th>
            </tr>
          </thead>
          <tbody>
            ${employeeMonthlyData.length === 0
              ? `<tr><td colspan="9" style="text-align: center; padding: 25px; color: var(--text-muted);">No hay registros en el mes seleccionado.</td></tr>`
              : employeeMonthlyData.map(item => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 8px;"><span style="font-family: monospace; color: var(--accent-primary); font-weight: bold;">${item.employee.employee_code || 'EMP-S/C'}</span></td>
                    <td style="padding: 8px; font-weight: bold; color: var(--text-primary);">${item.employee.name}</td>
                    <td style="padding: 8px; color: var(--text-muted); font-size: 0.75rem;">${item.employee.department || 'General'}<br><span style="color: #64748b;">${item.employee.position}</span></td>
                    <td style="padding: 8px; text-align: center; font-weight: bold;">${item.daysAttended} / ${daysInMonth}</td>
                    <td style="padding: 8px; text-align: center; font-weight: bold; color: var(--accent-primary);">${item.totalHours} hrs</td>
                    <td style="padding: 8px; text-align: center; color: #22c55e; font-weight: bold;">${item.onTimeCount}</td>
                    <td style="padding: 8px; text-align: center; color: ${item.lateDaysCount > 0 ? '#f59e0b' : 'var(--text-muted)'}; font-weight: bold;">${item.lateDaysCount}</td>
                    <td style="padding: 8px; text-align: center; color: ${item.totalLateMinutes > 0 ? '#ef4444' : 'var(--text-muted)'};">${item.totalLateMinutes} min</td>
                    <td style="padding: 8px; text-align: center;">
                      <span style="padding: 2px 8px; border-radius: 10px; font-weight: bold; font-size: 0.75rem; background: ${item.punctualityRate >= 90 ? 'rgba(34,197,94,0.15)' : (item.punctualityRate >= 75 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)')}; color: ${item.punctualityRate >= 90 ? '#22c55e' : (item.punctualityRate >= 75 ? '#f59e0b' : '#ef4444')};">
                        ${item.punctualityRate}%
                      </span>
                    </td>
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Listeners
  container.querySelector('#btn-rep-month-refresh').addEventListener('click', () => {
    renderMonthlyReport(container, state);
  });

  // Exportar Excel
  container.querySelector('#btn-exp-month-excel').addEventListener('click', () => {
    const headers = ['Código', 'Colaborador', 'Departamento', 'Puesto', 'Días Asistidos', 'Total Horas', 'A Tiempo', 'Días con Retardo', 'Minutos Retardo Totales', '% Puntualidad'];
    const rows = employeeMonthlyData.map(i => [
      i.employee.employee_code || '',
      i.employee.name,
      i.employee.department || '',
      i.employee.position || '',
      i.daysAttended,
      i.totalHours,
      i.onTimeCount,
      i.lateDaysCount,
      i.totalLateMinutes,
      `${i.punctualityRate}%`
    ]);
    exportReportToExcel(headers, rows, 'Asistencia Mensual', `Reporte_Asistencia_Mensual_${selectedMonth}`);
  });

  // Exportar CSV
  container.querySelector('#btn-exp-month-csv').addEventListener('click', () => {
    const headers = ['Código', 'Colaborador', 'Departamento', 'Puesto', 'Días Asistidos', 'Total Horas', 'A Tiempo', 'Días con Retardo', 'Minutos Retardo Totales', '% Puntualidad'];
    const rows = employeeMonthlyData.map(i => [
      i.employee.employee_code || '',
      i.employee.name,
      i.employee.department || '',
      i.employee.position || '',
      i.daysAttended,
      i.totalHours,
      i.onTimeCount,
      i.lateDaysCount,
      i.totalLateMinutes,
      `${i.punctualityRate}%`
    ]);
    exportReportToCsv(headers, rows, `Reporte_Asistencia_Mensual_${selectedMonth}`);
  });

  // Imprimir / PDF
  container.querySelector('#btn-exp-month-pdf').addEventListener('click', () => {
    const summaryHtml = `
      <div style="display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; font-size: 0.78rem; margin-bottom: 12px;">
        <div><strong>Total Horas Laboradas:</strong> ${globalTotalHours} hrs</div>
        <div><strong>Puntualidad Global:</strong> ${avgPunctuality}%</div>
        <div><strong>Retardos Acumulados:</strong> ${globalTotalLates} (${formatMinutes(globalTotalLateMins)})</div>
        <div><strong>Total Marcajes:</strong> ${monthRecords.length}</div>
      </div>
    `;

    const tableRowsHtml = employeeMonthlyData.map(i => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px; font-family: monospace; font-weight: bold;">${i.employee.employee_code || 'EMP-S/C'}</td>
        <td style="padding: 6px; font-weight: bold;">${i.employee.name}</td>
        <td style="padding: 6px;">${i.employee.department || 'General'}</td>
        <td style="padding: 6px; text-align: center;">${i.daysAttended} / ${daysInMonth}</td>
        <td style="padding: 6px; text-align: center; font-weight: bold;">${i.totalHours} hrs</td>
        <td style="padding: 6px; text-align: center; color: #16a34a;">${i.onTimeCount}</td>
        <td style="padding: 6px; text-align: center;">${i.lateDaysCount}</td>
        <td style="padding: 6px; text-align: center;">${i.totalLateMinutes} min</td>
        <td style="padding: 6px; text-align: center; font-weight: bold;">${i.punctualityRate}%</td>
      </tr>
    `).join('');

    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 6px;">Código</th>
            <th style="padding: 6px;">Colaborador</th>
            <th style="padding: 6px;">Depto</th>
            <th style="padding: 6px; text-align: center;">Días Asist.</th>
            <th style="padding: 6px; text-align: center;">Total Horas</th>
            <th style="padding: 6px; text-align: center;">A Tiempo</th>
            <th style="padding: 6px; text-align: center;">Retardos</th>
            <th style="padding: 6px; text-align: center;">Min. Retardo</th>
            <th style="padding: 6px; text-align: center;">% Puntualidad</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    `;

    openAttendanceReportPrintModal(
      'REPORTE MENSUAL CONSOLIDADO DE ASISTENCIA',
      `Período: ${selectedMonth} | Departamento: ${selectedDept === 'all' ? 'Todos' : selectedDept}`,
      tableHtml,
      summaryHtml,
      state
    );
  });
}

// -------------------------------------------------------------
// 3. REPORTE ANUAL DE ASISTENCIA
// -------------------------------------------------------------
function renderAnnualReport(container, state) {
  const currentYear = new Date().getFullYear();
  let selectedYear = parseInt(container.querySelector('#rep-annual-year')?.value || currentYear, 10);

  const yearStr = String(selectedYear);
  const yearRecords = (state.administracion_asistencias || []).filter(a => a.date && a.date.startsWith(yearStr));
  const activeEmployees = (state.administracion_employees || []).filter(e => e.status === 'Activo');

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Agrupado por mes
  const monthsData = monthNames.map((mName, idx) => {
    const mStr = `${yearStr}-${String(idx + 1).padStart(2, '0')}`;
    const mRecs = yearRecords.filter(r => r.date && r.date.startsWith(mStr));
    const entries = mRecs.filter(r => r.type === 'ENTRADA');
    const onTime = entries.filter(r => r.status === 'ON_TIME').length;
    const lates = entries.filter(r => r.status === 'LATE').length;
    const lateMins = entries.filter(r => r.status === 'LATE').reduce((acc, curr) => acc + (curr.lateMinutes || 0), 0);
    const punctuality = entries.length > 0 ? ((onTime / entries.length) * 100).toFixed(1) : '--';

    return {
      monthName: mName,
      monthKey: mStr,
      totalRecords: mRecs.length,
      entriesCount: entries.length,
      onTimeCount: onTime,
      latesCount: lates,
      lateMinutes: lateMins,
      punctualityRate: punctuality
    };
  });

  // Agrupado por Departamento
  const departments = ['Hospitalización', 'Emergencias', 'Farmacia', 'Quirófano', 'Laboratorio', 'Imagenología', 'Consulta Externa', 'Administración', 'Mantenimiento'];
  const departmentData = departments.map(dept => {
    const deptEmployees = activeEmployees.filter(e => e.department === dept);
    const deptRecs = yearRecords.filter(r => r.department === dept);
    const entries = deptRecs.filter(r => r.type === 'ENTRADA');
    const onTime = entries.filter(r => r.status === 'ON_TIME').length;
    const lates = entries.filter(r => r.status === 'LATE').length;
    const punctuality = entries.length > 0 ? ((onTime / entries.length) * 100).toFixed(1) : '--';

    return {
      department: dept,
      employeesCount: deptEmployees.length,
      totalRecords: deptRecs.length,
      entriesCount: entries.length,
      onTimeCount: onTime,
      latesCount: lates,
      punctualityRate: punctuality
    };
  });

  // Métricas Globales Anuales
  const totalYearRecords = yearRecords.length;
  const totalYearEntries = yearRecords.filter(r => r.type === 'ENTRADA').length;
  const totalYearOnTime = yearRecords.filter(r => r.type === 'ENTRADA' && r.status === 'ON_TIME').length;
  const totalYearLates = yearRecords.filter(r => r.type === 'ENTRADA' && r.status === 'LATE').length;
  const globalYearPunctuality = totalYearEntries > 0 ? ((totalYearOnTime / totalYearEntries) * 100).toFixed(1) : '100.0';

  container.innerHTML = `
    <!-- Filtro de Año -->
    <div class="glass-card" style="padding: 1.25rem; margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 3px;">Año Fiscal:</label>
            <select id="rep-annual-year" style="padding: 6px 14px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; font-weight: bold;">
              <option value="2026" ${selectedYear === 2026 ? 'selected' : ''}>2026</option>
              <option value="2025" ${selectedYear === 2025 ? 'selected' : ''}>2025</option>
              <option value="2024" ${selectedYear === 2024 ? 'selected' : ''}>2024</option>
            </select>
          </div>
          <button class="btn btn-secondary btn-small" id="btn-rep-annual-refresh" style="align-self: flex-end; padding: 7px 12px;">🔄 Actualizar</button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-small" id="btn-exp-annual-pdf" style="padding: 7px 12px; font-weight: 600;">🖨️ Imprimir / PDF</button>
          <button class="btn btn-secondary btn-small" id="btn-exp-annual-excel" style="padding: 7px 12px; font-weight: 600; color: #22c55e;">📊 Excel (.xlsx)</button>
          <button class="btn btn-secondary btn-small" id="btn-exp-annual-csv" style="padding: 7px 12px; font-weight: 600;">📄 CSV</button>
        </div>
      </div>
    </div>

    <!-- Indicadores Anuales -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 1.25rem;">
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid var(--accent-primary);">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Total Marcajes en ${selectedYear}</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-top: 3px;">${totalYearRecords}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">${totalYearEntries} jornadas laborales</div>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #22c55e;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Puntualidad Anual</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #22c55e; margin-top: 3px;">${globalYearPunctuality}%</div>
        <div style="font-size: 0.7rem; color: #22c55e;">${totalYearOnTime} entradas puntuales</div>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #f59e0b;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Retardos Anuales</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #f59e0b; margin-top: 3px;">${totalYearLates}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">Incidencias registradas</div>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #3b82f6;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Colaboradores Activos</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: #60a5fa; margin-top: 3px;">${activeEmployees.length}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">En 9 departamentos</div>
      </div>
    </div>

    <!-- Tablas: Mensual y Departamental -->
    <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; align-items: start;">
      
      <!-- Tabla por Meses -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 0.95rem; color: var(--accent-primary); margin: 0 0 1rem 0; font-family: var(--font-heading);">
          📅 Comportamiento Mensual (${selectedYear})
        </h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
                <th style="padding: 6px;">Mes</th>
                <th style="padding: 6px; text-align: center;">Marcajes</th>
                <th style="padding: 6px; text-align: center;">A Tiempo</th>
                <th style="padding: 6px; text-align: center;">Retardos</th>
                <th style="padding: 6px; text-align: center;">% Puntualidad</th>
              </tr>
            </thead>
            <tbody>
              ${monthsData.map(m => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                  <td style="padding: 6px; font-weight: bold; color: var(--text-primary);">${m.monthName}</td>
                  <td style="padding: 6px; text-align: center;">${m.totalRecords}</td>
                  <td style="padding: 6px; text-align: center; color: #22c55e; font-weight: bold;">${m.onTimeCount}</td>
                  <td style="padding: 6px; text-align: center; color: ${m.latesCount > 0 ? '#f59e0b' : 'var(--text-muted)'}; font-weight: bold;">${m.latesCount}</td>
                  <td style="padding: 6px; text-align: center;">
                    <span style="font-weight: bold; color: ${m.punctualityRate !== '--' && parseFloat(m.punctualityRate) >= 90 ? '#22c55e' : (m.punctualityRate !== '--' && parseFloat(m.punctualityRate) >= 75 ? '#f59e0b' : '#ef4444')};">
                      ${m.punctualityRate !== '--' ? `${m.punctualityRate}%` : '--'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tabla por Departamentos -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 0.95rem; color: var(--accent-primary); margin: 0 0 1rem 0; font-family: var(--font-heading);">
          🏢 Distribución por Departamento
        </h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
                <th style="padding: 6px;">Departamento</th>
                <th style="padding: 6px; text-align: center;">Personal</th>
                <th style="padding: 6px; text-align: center;">Retardos</th>
                <th style="padding: 6px; text-align: center;">% Punt.</th>
              </tr>
            </thead>
            <tbody>
              ${departmentData.map(d => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                  <td style="padding: 6px; font-weight: bold; color: var(--text-primary);">${d.department}</td>
                  <td style="padding: 6px; text-align: center;">${d.employeesCount}</td>
                  <td style="padding: 6px; text-align: center; color: ${d.latesCount > 0 ? '#f59e0b' : 'var(--text-muted)'}; font-weight: bold;">${d.latesCount}</td>
                  <td style="padding: 6px; text-align: center; font-weight: bold; color: ${d.punctualityRate !== '--' && parseFloat(d.punctualityRate) >= 90 ? '#22c55e' : '#f59e0b'};">
                    ${d.punctualityRate !== '--' ? `${d.punctualityRate}%` : '--'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  // Listeners
  container.querySelector('#btn-rep-annual-refresh').addEventListener('click', () => {
    renderAnnualReport(container, state);
  });

  // Exportar Excel
  container.querySelector('#btn-exp-annual-excel').addEventListener('click', () => {
    const headers = ['Mes / Período', 'Total Marcajes', 'Entradas', 'A Tiempo', 'Retardos', 'Minutos Retardo', '% Puntualidad'];
    const rows = monthsData.map(m => [
      m.monthName,
      m.totalRecords,
      m.entriesCount,
      m.onTimeCount,
      m.latesCount,
      m.lateMinutes,
      m.punctualityRate !== '--' ? `${m.punctualityRate}%` : 'N/A'
    ]);
    exportReportToExcel(headers, rows, 'Anual Meses', `Reporte_Asistencia_Anual_${selectedYear}`);
  });

  // Exportar CSV
  container.querySelector('#btn-exp-annual-csv').addEventListener('click', () => {
    const headers = ['Mes / Período', 'Total Marcajes', 'Entradas', 'A Tiempo', 'Retardos', 'Minutos Retardo', '% Puntualidad'];
    const rows = monthsData.map(m => [
      m.monthName,
      m.totalRecords,
      m.entriesCount,
      m.onTimeCount,
      m.latesCount,
      m.lateMinutes,
      m.punctualityRate !== '--' ? `${m.punctualityRate}%` : 'N/A'
    ]);
    exportReportToCsv(headers, rows, `Reporte_Asistencia_Anual_${selectedYear}`);
  });

  // Imprimir / PDF
  container.querySelector('#btn-exp-annual-pdf').addEventListener('click', () => {
    const summaryHtml = `
      <div style="display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; font-size: 0.78rem; margin-bottom: 12px;">
        <div><strong>Total Marcajes Anuales:</strong> ${totalYearRecords}</div>
        <div><strong>Puntualidad Anual Global:</strong> ${globalYearPunctuality}%</div>
        <div><strong>Total Retardos:</strong> ${totalYearLates}</div>
        <div><strong>Personal Activo:</strong> ${activeEmployees.length}</div>
      </div>
    `;

    const monthsRowsHtml = monthsData.map(m => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px; font-weight: bold;">${m.monthName}</td>
        <td style="padding: 6px; text-align: center;">${m.totalRecords}</td>
        <td style="padding: 6px; text-align: center; color: #16a34a;">${m.onTimeCount}</td>
        <td style="padding: 6px; text-align: center;">${m.latesCount}</td>
        <td style="padding: 6px; text-align: center;">${m.lateMinutes} min</td>
        <td style="padding: 6px; text-align: center; font-weight: bold;">${m.punctualityRate !== '--' ? `${m.punctualityRate}%` : '--'}</td>
      </tr>
    `).join('');

    const deptRowsHtml = departmentData.map(d => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px; font-weight: bold;">${d.department}</td>
        <td style="padding: 6px; text-align: center;">${d.employeesCount}</td>
        <td style="padding: 6px; text-align: center;">${d.totalRecords}</td>
        <td style="padding: 6px; text-align: center;">${d.latesCount}</td>
        <td style="padding: 6px; text-align: center; font-weight: bold;">${d.punctualityRate !== '--' ? `${d.punctualityRate}%` : '--'}</td>
      </tr>
    `).join('');

    const tableHtml = `
      <h4 style="margin: 10px 0 6px 0; font-size: 0.85rem; color: #0f172a;">1. Resumen Mensual (${selectedYear})</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 6px;">Mes</th>
            <th style="padding: 6px; text-align: center;">Marcajes</th>
            <th style="padding: 6px; text-align: center;">A Tiempo</th>
            <th style="padding: 6px; text-align: center;">Retardos</th>
            <th style="padding: 6px; text-align: center;">Minutos Retardo</th>
            <th style="padding: 6px; text-align: center;">% Puntualidad</th>
          </tr>
        </thead>
        <tbody>
          ${monthsRowsHtml}
        </tbody>
      </table>

      <h4 style="margin: 15px 0 6px 0; font-size: 0.85rem; color: #0f172a;">2. Desempeño por Departamento</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 6px;">Departamento</th>
            <th style="padding: 6px; text-align: center;">Colaboradores</th>
            <th style="padding: 6px; text-align: center;">Marcajes</th>
            <th style="padding: 6px; text-align: center;">Retardos</th>
            <th style="padding: 6px; text-align: center;">% Puntualidad</th>
          </tr>
        </thead>
        <tbody>
          ${deptRowsHtml}
        </tbody>
      </table>
    `;

    openAttendanceReportPrintModal(
      'REPORTE ANUAL DE CONTROL DE ASISTENCIA Y PUNTUALIDAD',
      `Año Fiscal: ${selectedYear} | Consolidado General`,
      tableHtml,
      summaryHtml,
      state
    );
  });
}

// -------------------------------------------------------------
// 4. REPORTE INDIVIDUAL POR EMPLEADO
// -------------------------------------------------------------
function renderEmployeeReport(container, state) {
  const activeEmployees = (state.administracion_employees || []).filter(e => e.status === 'Activo');
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
  const todayYMD = now.toLocaleDateString('en-CA');

  let selectedEmpId = container.querySelector('#rep-emp-select')?.value || (activeEmployees[0] ? activeEmployees[0].id : null);
  let fromDate = container.querySelector('#rep-emp-from')?.value || firstDay;
  let toDate = container.querySelector('#rep-emp-to')?.value || todayYMD;

  const employee = activeEmployees.find(e => e.id === selectedEmpId) || activeEmployees[0];

  if (!employee) {
    container.innerHTML = `<div class="glass-card" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay colaboradores registrados en el sistema.</div>`;
    return;
  }

  // Filtrar registros del colaborador en rango de fechas
  const empRecords = (state.administracion_asistencias || []).filter(r => {
    const isEmp = r.employee_id === employee.id || r.employee_code === employee.employee_code;
    if (!isEmp) return false;
    if (fromDate && r.date < fromDate) return false;
    if (toDate && r.date > toDate) return false;
    return true;
  });

  // Agrupar por fecha
  const dateMap = {};
  empRecords.forEach(r => {
    if (!dateMap[r.date]) dateMap[r.date] = { date: r.date, entry: null, exit: null, audits: [] };
    if (r.type === 'ENTRADA') dateMap[r.date].entry = r;
    if (r.type === 'SALIDA') dateMap[r.date].exit = r;
  });

  const dailyLogs = Object.values(dateMap).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Métricas
  const totalDaysWorked = dailyLogs.length;
  let totalHours = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let totalLateMinutes = 0;

  dailyLogs.forEach(d => {
    if (d.entry && d.exit) {
      d.hours = calculateHoursDiff(d.entry.time_in, d.exit.time_out);
      totalHours += d.hours;
    } else if (d.entry) {
      d.hours = 8;
      totalHours += 8;
    } else {
      d.hours = 0;
    }

    if (d.entry) {
      if (d.entry.status === 'ON_TIME') onTimeCount++;
      if (d.entry.status === 'LATE') {
        lateCount++;
        totalLateMinutes += (d.entry.lateMinutes || 0);
      }
    }
  });

  const totalEntries = onTimeCount + lateCount;
  const punctualityRate = totalEntries > 0 ? ((onTimeCount / totalEntries) * 100).toFixed(1) : '100.0';

  container.innerHTML = `
    <!-- Filtros de Empleado y Rango -->
    <div class="glass-card" style="padding: 1.25rem; margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 3px;">Seleccionar Colaborador:</label>
            <select id="rep-emp-select" style="padding: 6px 12px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; font-weight: bold;">
              ${activeEmployees.map(e => `<option value="${e.id}" ${e.id === employee.id ? 'selected' : ''}>${e.employee_code || 'EMP-S/C'} - ${e.name} (${e.department})</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 3px;">Desde:</label>
            <input type="date" id="rep-emp-from" value="${fromDate}" style="padding: 6px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 3px;">Hasta:</label>
            <input type="date" id="rep-emp-to" value="${toDate}" style="padding: 6px 10px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
          </div>
          <button class="btn btn-secondary btn-small" id="btn-rep-emp-refresh" style="align-self: flex-end; padding: 7px 12px;">🔄 Actualizar</button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-small" id="btn-exp-emp-pdf" style="padding: 7px 12px; font-weight: 600;">🖨️ Hoja Oficial PDF</button>
          <button class="btn btn-secondary btn-small" id="btn-exp-emp-excel" style="padding: 7px 12px; font-weight: 600; color: #22c55e;">📊 Excel (.xlsx)</button>
          <button class="btn btn-secondary btn-small" id="btn-exp-emp-csv" style="padding: 7px 12px; font-weight: 600;">📄 CSV</button>
        </div>
      </div>
    </div>

    <!-- Ficha del Empleado y Métricas -->
    <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 15px; margin-bottom: 1.25rem;">
      
      <!-- Ficha del Colaborador -->
      <div class="glass-card" style="padding: 1.25rem; border-left: 4px solid var(--accent-primary);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <span style="background: rgba(0,242,254,0.15); color: var(--accent-primary); padding: 2px 8px; border-radius: 4px; font-family: monospace; font-weight: bold; font-size: 0.8rem;">
              ${employee.employee_code || 'EMP-S/C'}
            </span>
            <h3 style="margin: 6px 0 2px 0; font-size: 1.1rem; color: var(--text-primary); font-family: var(--font-heading);">${employee.name}</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${employee.position} &bull; <strong style="color: #cbd5e1;">${employee.department}</strong></span>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.78rem; color: var(--text-muted); border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 8px;">
          <div><strong>Turno Asignado:</strong> ${employee.shift || 'Matutino'}</div>
          <div><strong>WhatsApp:</strong> ${employee.whatsapp_number || employee.phone || 'N/A'}</div>
          <div><strong>Fecha Contrato:</strong> ${employee.hireDate || 'N/A'}</div>
          <div><strong>Sueldo Base:</strong> Q${parseFloat(employee.salary || 0).toFixed(2)}</div>
        </div>
      </div>

      <!-- Resumen en Rango -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="glass-card" style="padding: 0.9rem; border-left: 3px solid #22c55e;">
          <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Días Trabajados</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #22c55e; margin-top: 2px;">${totalDaysWorked} días</div>
          <div style="font-size: 0.68rem; color: var(--text-muted);">${totalHours.toFixed(1)} hrs registradas</div>
        </div>
        <div class="glass-card" style="padding: 0.9rem; border-left: 3px solid #3b82f6;">
          <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Índice de Puntualidad</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #60a5fa; margin-top: 2px;">${punctualityRate}%</div>
          <div style="font-size: 0.68rem; color: var(--text-muted);">${onTimeCount} entradas a tiempo</div>
        </div>
        <div class="glass-card" style="padding: 0.9rem; border-left: 3px solid #f59e0b;">
          <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Retardos en Período</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #f59e0b; margin-top: 2px;">${lateCount}</div>
          <div style="font-size: 0.68rem; color: var(--text-muted);">${totalLateMinutes} min acumulados</div>
        </div>
        <div class="glass-card" style="padding: 0.9rem; border-left: 3px solid #ef4444;">
          <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Faltas Registradas</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #ef4444; margin-top: 2px;">${employee.absences || 0}</div>
          <div style="font-size: 0.68rem; color: var(--text-muted);">${employee.warnings || 0} amonestaciones</div>
        </div>
      </div>

    </div>

    <!-- Tabla Detallada Día a Día -->
    <div class="glass-card" style="padding: 1.25rem;">
      <h3 style="font-size: 0.95rem; color: var(--accent-primary); margin: 0 0 1rem 0; font-family: var(--font-heading);">
        🗓️ Bitácora de Asistencia por Jornada (${fromDate} al ${toDate})
      </h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
              <th style="padding: 8px;">Fecha</th>
              <th style="padding: 8px; text-align: center;">Entrada</th>
              <th style="padding: 8px; text-align: center;">Salida</th>
              <th style="padding: 8px; text-align: center;">Horas Registradas</th>
              <th style="padding: 8px; text-align: center;">Estado</th>
              <th style="padding: 8px; text-align: center;">Minutos Retardo</th>
              <th style="padding: 8px;">Observaciones / Auditoría</th>
            </tr>
          </thead>
          <tbody>
            ${dailyLogs.length === 0
              ? `<tr><td colspan="7" style="text-align: center; padding: 25px; color: var(--text-muted);">No se encontraron marcajes para este colaborador en el rango seleccionado.</td></tr>`
              : dailyLogs.map(log => {
                  const entryTime = log.entry ? (log.entry.time_str || (log.entry.time_in ? new Date(log.entry.time_in).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : '--:--')) : '--:--';
                  const exitTime = log.exit ? (log.exit.time_str || (log.exit.time_out ? new Date(log.exit.time_out).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : '--:--')) : '--:--';

                  let statusBadge = '';
                  const st = log.entry ? log.entry.status : 'SIN_REGISTRO';
                  if (st === 'ON_TIME') statusBadge = '<span style="background: rgba(34,197,94,0.15); color: #22c55e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem;">🟢 A Tiempo</span>';
                  else if (st === 'LATE') statusBadge = `<span style="background: rgba(245,158,11,0.15); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem;">🟠 Retardo (+${log.entry.lateMinutes || 0}m)</span>`;
                  else if (st === 'MANUALLY_EDITED') statusBadge = '<span style="background: rgba(59,130,246,0.15); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem;">🔵 Manual</span>';
                  else if (st === 'JUSTIFIED') statusBadge = '<span style="background: rgba(168,85,247,0.15); color: #c084fc; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem;">🟣 Justificado</span>';
                  else statusBadge = '<span style="background: rgba(239,68,68,0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.72rem;">🔴 Sin Marcaje</span>';

                  const note = log.entry ? (log.entry.user_agent ? (log.entry.user_agent.includes('Mobile') ? '📱 App Móvil' : log.entry.user_agent) : 'Marcaje QR') : 'Sin registro';

                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                      <td style="padding: 8px; font-weight: bold; color: var(--text-primary);">${log.date}</td>
                      <td style="padding: 8px; text-align: center; font-family: monospace; font-weight: bold; color: ${log.entry ? '#22c55e' : 'var(--text-muted)'};">${entryTime}</td>
                      <td style="padding: 8px; text-align: center; font-family: monospace; font-weight: bold; color: ${log.exit ? '#ef4444' : 'var(--text-muted)'};">${exitTime}</td>
                      <td style="padding: 8px; text-align: center; font-weight: bold;">${log.hours > 0 ? `${log.hours} hrs` : '--'}</td>
                      <td style="padding: 8px; text-align: center;">${statusBadge}</td>
                      <td style="padding: 8px; text-align: center; color: ${log.entry && log.entry.lateMinutes > 0 ? '#f59e0b' : 'var(--text-muted)'}; font-weight: bold;">${log.entry && log.entry.lateMinutes > 0 ? `+${log.entry.lateMinutes} min` : '0 min'}</td>
                      <td style="padding: 8px; font-size: 0.72rem; color: var(--text-muted);">${note}</td>
                    </tr>
                  `;
                }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Listeners
  container.querySelector('#btn-rep-emp-refresh').addEventListener('click', () => {
    renderEmployeeReport(container, state);
  });

  // Exportar Excel
  container.querySelector('#btn-exp-emp-excel').addEventListener('click', () => {
    const headers = ['Fecha', 'Código', 'Colaborador', 'Hora Entrada', 'Hora Salida', 'Horas Registradas', 'Estado', 'Minutos Retardo'];
    const rows = dailyLogs.map(l => [
      l.date,
      employee.employee_code || '',
      employee.name,
      l.entry ? (l.entry.time_str || l.entry.time_in) : '',
      l.exit ? (l.exit.time_str || l.exit.time_out) : '',
      l.hours,
      l.entry ? l.entry.status : 'SIN_REGISTRO',
      l.entry ? (l.entry.lateMinutes || 0) : 0
    ]);
    exportReportToExcel(headers, rows, 'Asistencia Empleado', `Reporte_${employee.employee_code}_${fromDate}_al_${toDate}`);
  });

  // Exportar CSV
  container.querySelector('#btn-exp-emp-csv').addEventListener('click', () => {
    const headers = ['Fecha', 'Código', 'Colaborador', 'Hora Entrada', 'Hora Salida', 'Horas Registradas', 'Estado', 'Minutos Retardo'];
    const rows = dailyLogs.map(l => [
      l.date,
      employee.employee_code || '',
      employee.name,
      l.entry ? (l.entry.time_str || l.entry.time_in) : '',
      l.exit ? (l.exit.time_str || l.exit.time_out) : '',
      l.hours,
      l.entry ? l.entry.status : 'SIN_REGISTRO',
      l.entry ? (l.entry.lateMinutes || 0) : 0
    ]);
    exportReportToCsv(headers, rows, `Reporte_${employee.employee_code}_${fromDate}_al_${toDate}`);
  });

  // Imprimir / PDF
  container.querySelector('#btn-exp-emp-pdf').addEventListener('click', () => {
    const summaryHtml = `
      <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; background: #f8fafc; font-size: 0.78rem; margin-bottom: 12px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px;">
        <div>
          <strong>Colaborador:</strong> ${employee.name} (${employee.employee_code || 'EMP-S/C'})<br>
          <strong>Cargo / Depto:</strong> ${employee.position} - ${employee.department}<br>
          <strong>Turno Asignado:</strong> ${employee.shift || 'Matutino'}
        </div>
        <div>
          <strong>Días Trabajados en Período:</strong> ${totalDaysWorked} días<br>
          <strong>Horas Acumuladas:</strong> ${totalHours.toFixed(1)} hrs<br>
          <strong>Índice de Puntualidad:</strong> ${punctualityRate}% (${lateCount} retardos, ${totalLateMinutes} min)
        </div>
      </div>
    `;

    const tableRowsHtml = dailyLogs.map(l => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px; font-weight: bold;">${l.date}</td>
        <td style="padding: 6px; text-align: center; font-family: monospace;">${l.entry ? (l.entry.time_str || l.entry.time_in.substring(11, 16)) : '--:--'}</td>
        <td style="padding: 6px; text-align: center; font-family: monospace;">${l.exit ? (l.exit.time_str || l.exit.time_out.substring(11, 16)) : '--:--'}</td>
        <td style="padding: 6px; text-align: center; font-weight: bold;">${l.hours > 0 ? `${l.hours}h` : '--'}</td>
        <td style="padding: 6px; text-align: center;">${l.entry ? l.entry.status : 'SIN_REGISTRO'}</td>
        <td style="padding: 6px; text-align: center;">${l.entry && l.entry.lateMinutes > 0 ? `+${l.entry.lateMinutes}m` : '0m'}</td>
      </tr>
    `).join('');

    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 6px;">Fecha</th>
            <th style="padding: 6px; text-align: center;">Hora Entrada</th>
            <th style="padding: 6px; text-align: center;">Hora Salida</th>
            <th style="padding: 6px; text-align: center;">Horas Registradas</th>
            <th style="padding: 6px; text-align: center;">Estado Entrada</th>
            <th style="padding: 6px; text-align: center;">Retardo</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
    `;

    openAttendanceReportPrintModal(
      'HOJA DE REGISTRO INDIVIDUAL DE ASISTENCIA Y PUNTUALIDAD',
      `Período: ${fromDate} al ${toDate}`,
      tableHtml,
      summaryHtml,
      state
    );
  });
}
