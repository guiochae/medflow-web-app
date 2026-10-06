// src/modules/reportesAdmin.js
import * as XLSX from 'xlsx';
import logoUrl from '../assets/logo.jpg';

let activeReportTab = 'dashboard'; // 'dashboard', 'clinica', 'farmacia', 'laboratorio', 'hospitalizacion', 'rrhh', 'personalizado'
let selectedPeriod = 'mes'; // 'hoy', 'ayer', 'semana', 'mes', 'mes_anterior', 'anio', 'historico', 'personalizado'
let customStartDate = '';
let customEndDate = '';

// Estado temporal del constructor de reportes personalizados
let customReportConfig = {
  dataSource: 'billing',
  period: 'mes',
  customStart: '',
  customEnd: '',
  statusFilter: 'todos',
  doctorFilter: 'todos',
  searchQuery: '',
  selectedColumns: []
};

// ==========================================
// 📅 HELPERS DE FECHAS Y RANGOS
// ==========================================
export function getDateRangeBounds(period, startStr = '', endStr = '') {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (period === 'hoy') {
    // start y end ya están configurados
  } else if (period === 'ayer') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (period === 'semana') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Lunes
    start = new Date(now.setDate(diff));
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'mes') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === 'mes_anterior') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (period === 'anio') {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (period === 'historico') {
    start = new Date(2000, 0, 1, 0, 0, 0, 0);
    end = new Date(2099, 11, 31, 23, 59, 59, 999);
  } else if (period === 'personalizado' && startStr && endStr) {
    start = new Date(startStr + 'T00:00:00');
    end = new Date(endStr + 'T23:59:59');
  }

  return { start, end };
}

function isDateInRange(dateValue, range) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return false;
  return d >= range.start && d <= range.end;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return 'N/D';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) {
    return String(dateStr);
  }
}

function formatDateTimeDisplay(dateStr) {
  if (!dateStr) return 'N/D';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return String(dateStr);
  }
}

// ==========================================
// 📥 EXPORTADORES A EXCEL, CSV E IMPRESIÓN
// ==========================================
export function exportReportToExcel(headers, rows, sheetName, fileName) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Reporte').substring(0, 31));
  XLSX.writeFile(wb, `${fileName || 'reporte_medflow'}.xlsx`);
}

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
  link.setAttribute('download', `${fileName || 'reporte_medflow'}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function openOfficialReportPrintModal(title, subtitle, tableHtml, summaryHtml = '', state = {}) {
  const modal = document.getElementById('prescription-print-modal');
  const previewContainer = document.getElementById('prescription-preview-content');
  const printActionBtn = document.getElementById('btn-print-action');
  const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;

  if (!modal || !previewContainer || !printActionBtn) {
    const win = window.open('', '_blank');
    if (!win) {
      alert("Por favor habilita ventanas emergentes para imprimir el reporte.");
      return;
    }
    const clinic = state.clinicInfo || { name: 'Hospital Privado Multimédica Sayaxché', address: 'Sayaxché, Petén', phone: '2200-0000' };
    win.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>${clinic.name}</h2>
          <h3>${title}</h3>
          <p>${subtitle}</p>
          ${summaryHtml}
          ${tableHtml}
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
    return;
  }

  if (modalTitle) modalTitle.textContent = `Informe Oficial: ${title}`;
  printActionBtn.innerHTML = '<span>🖨️</span> Imprimir / Guardar PDF';

  const clinic = state.clinicInfo || {
    name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ',
    address: 'Barrio El Centro, Sayaxché, Petén, Guatemala',
    phone: '(502) 7928-0000 / 5555-1234',
    email: 'contacto@multimedicasayaxche.com'
  };

  const printDate = new Date().toLocaleString('es-GT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  previewContainer.innerHTML = `
    <div class="prescription-preview-box" style="background: #fff; color: #000; padding: 24px; font-family: Arial, sans-serif;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <td style="border: none; padding: 0 0 12px 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                  ${clinic.logoData 
                    ? `<img src="${clinic.logoData}" style="max-height: 75px; max-width: 160px; object-fit: contain;">`
                    : `<img src="${logoUrl}" style="max-height: 75px; max-width: 160px; object-fit: contain;">`}
                  <div>
                    <h2 style="margin: 0; font-size: 1.15rem; color: #0f172a; text-transform: uppercase;">${clinic.name}</h2>
                    <div style="font-size: 0.8rem; font-weight: bold; color: #0284c7;">DIRECCIÓN GENERAL Y CONTROL ADMINISTRATIVO</div>
                    <div style="font-size: 0.75rem; color: #64748b;">${clinic.address} | Tel: ${clinic.phone}</div>
                  </div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: #475569;">
                  <strong>Fecha de Emisión:</strong><br>${printDate}<br>
                  <span style="font-size: 0.7rem; color: #94a3b8;">Sistema Hospitalario LUGAMED</span>
                </div>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: none; padding: 0;">
              <div style="text-align: center; margin-bottom: 15px; padding: 8px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px;">
                <h3 style="margin: 0; font-size: 1.05rem; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${title}</h3>
                ${subtitle ? `<div style="font-size: 0.82rem; color: #475569; margin-top: 3px;">${subtitle}</div>` : ''}
              </div>

              ${summaryHtml ? `<div style="margin-bottom: 15px;">${summaryHtml}</div>` : ''}

              <div style="margin-top: 10px; overflow-x: auto;">
                ${tableHtml}
              </div>

              <!-- Firmas de Responsabilidad -->
              <div style="margin-top: 45px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; font-size: 0.75rem; color: #334155; page-break-inside: avoid;">
                <div>
                  <div style="border-top: 1px solid #000; width: 75%; margin: 0 auto 5px auto;"></div>
                  <strong>Responsable de Emisión / Auditoría</strong><br>
                  <span>Hospital Multimédica Sayaxché</span>
                </div>
                <div>
                  <div style="border-top: 1px solid #000; width: 75%; margin: 0 auto 5px auto;"></div>
                  <strong>Dirección Médica / Gerencia General</strong><br>
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

// ==========================================
// 📈 RENDER PRINCIPAL DE LA PESTAÑA REPORTES
// ==========================================
export function renderReportesTab(container, state) {
  container.innerHTML = `
    <!-- Barra Superior: Filtro Global de Fechas y Sub-pestañas -->
    <div class="glass-card" style="margin-bottom: 1.5rem; padding: 14px 18px; border-left: 4px solid var(--accent-primary);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.6rem;">📈</span>
          <div>
            <h3 style="margin: 0; font-family: var(--font-heading); color: var(--accent-primary); font-size: 1.2rem;">Centro de Reportes y Analítica Hospitalaria</h3>
            <p style="margin: 2px 0 0 0; color: var(--text-muted); font-size: 0.85rem;">Métricas de desempeño clínico, financiero, inventarios y personal en tiempo real.</p>
          </div>
        </div>

        <!-- Filtro Rápido de Período -->
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: bold;">Período:</span>
          <select id="report-global-period" style="padding: 6px 12px; font-size: 0.85rem; border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);">
            <option value="hoy" ${selectedPeriod === 'hoy' ? 'selected' : ''}>📅 Hoy</option>
            <option value="ayer" ${selectedPeriod === 'ayer' ? 'selected' : ''}>⏮️ Ayer</option>
            <option value="semana" ${selectedPeriod === 'semana' ? 'selected' : ''}>📆 Esta Semana</option>
            <option value="mes" ${selectedPeriod === 'mes' ? 'selected' : ''}>📊 Este Mes (Actual)</option>
            <option value="mes_anterior" ${selectedPeriod === 'mes_anterior' ? 'selected' : ''}>⏪ Mes Anterior</option>
            <option value="anio" ${selectedPeriod === 'anio' ? 'selected' : ''}>📈 Este Año</option>
            <option value="historico" ${selectedPeriod === 'historico' ? 'selected' : ''}>🏛️ Histórico Completo</option>
            <option value="personalizado" ${selectedPeriod === 'personalizado' ? 'selected' : ''}>⚙️ Personalizado (Rango)</option>
          </select>

          <div id="report-custom-dates-wrapper" style="display: ${selectedPeriod === 'personalizado' ? 'flex' : 'none'}; gap: 6px; align-items: center;">
            <input type="date" id="report-custom-start" value="${customStartDate}" style="padding: 5px 8px; font-size: 0.8rem; border-radius: 4px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);">
            <span style="color: var(--text-muted); font-size: 0.8rem;">al</span>
            <input type="date" id="report-custom-end" value="${customEndDate}" style="padding: 5px 8px; font-size: 0.8rem; border-radius: 4px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);">
            <button class="btn btn-secondary btn-small" id="btn-apply-custom-dates" style="padding: 5px 10px; font-size: 0.8rem;">Aplicar</button>
          </div>
        </div>
      </div>

      <!-- Navegación de Sub-Pestañas de Reportes -->
      <div style="display: flex; gap: 8px; margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; overflow-x: auto; font-size: 0.85rem;">
        <button class="btn ${activeReportTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}" id="rep-tab-dashboard" style="padding: 6px 12px; white-space: nowrap;">📊 Resumen Ejecutivo</button>
        <button class="btn ${activeReportTab === 'clinica' ? 'btn-primary' : 'btn-secondary'}" id="rep-tab-clinica" style="padding: 6px 12px; white-space: nowrap;">🩺 Consultas & Pacientes</button>
        <button class="btn ${activeReportTab === 'farmacia' ? 'btn-primary' : 'btn-secondary'}" id="rep-tab-farmacia" style="padding: 6px 12px; white-space: nowrap;">💊 Farmacia & Inventario</button>
        <button class="btn ${activeReportTab === 'laboratorio' ? 'btn-primary' : 'btn-secondary'}" id="rep-tab-laboratorio" style="padding: 6px 12px; white-space: nowrap;">🔬 Laboratorio & Imagen</button>
        <button class="btn ${activeReportTab === 'hospitalizacion' ? 'btn-primary' : 'btn-secondary'}" id="rep-tab-hospitalizacion" style="padding: 6px 12px; white-space: nowrap;">🏥 Hospitalización & Quirófano</button>
        <button class="btn ${activeReportTab === 'rrhh' ? 'btn-primary' : 'btn-secondary'}" id="rep-tab-rrhh" style="padding: 6px 12px; white-space: nowrap;">👥 Personal & Nóminas</button>
        <button class="btn ${activeReportTab === 'personalizado' ? 'btn-primary' : 'btn-secondary'}" id="rep-tab-personalizado" style="padding: 6px 12px; white-space: nowrap; border-color: var(--accent-secondary); color: ${activeReportTab === 'personalizado' ? '#fff' : 'var(--accent-secondary)'};">🛠️ Constructor Personalizado</button>
      </div>
    </div>

    <!-- Contenedor del Reporte Activo -->
    <div id="report-view-content">
      <!-- Se inyecta dinámicamente -->
    </div>
  `;

  // Bind Cambio de Período Global
  const periodSelect = document.getElementById('report-global-period');
  const customWrapper = document.getElementById('report-custom-dates-wrapper');
  if (periodSelect) {
    periodSelect.addEventListener('change', (e) => {
      selectedPeriod = e.target.value;
      if (selectedPeriod === 'personalizado') {
        if (customWrapper) customWrapper.style.display = 'flex';
      } else {
        if (customWrapper) customWrapper.style.display = 'none';
        renderActiveReportContent(state);
      }
    });
  }

  const btnApplyDates = document.getElementById('btn-apply-custom-dates');
  if (btnApplyDates) {
    btnApplyDates.addEventListener('click', () => {
      customStartDate = document.getElementById('report-custom-start').value;
      customEndDate = document.getElementById('report-custom-end').value;
      if (!customStartDate || !customEndDate) {
        alert("Por favor seleccione ambas fechas (inicio y fin).");
        return;
      }
      renderActiveReportContent(state);
    });
  }

  // Bind Sub-Pestañas
  const tabMap = {
    'rep-tab-dashboard': 'dashboard',
    'rep-tab-clinica': 'clinica',
    'rep-tab-farmacia': 'farmacia',
    'rep-tab-laboratorio': 'laboratorio',
    'rep-tab-hospitalizacion': 'hospitalizacion',
    'rep-tab-rrhh': 'rrhh',
    'rep-tab-personalizado': 'personalizado'
  };

  Object.entries(tabMap).forEach(([btnId, tabKey]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        activeReportTab = tabKey;
        renderReportesTab(container, state);
      });
    }
  });

  renderActiveReportContent(state);
}

function renderActiveReportContent(state) {
  const contentArea = document.getElementById('report-view-content');
  if (!contentArea) return;

  const dateRange = getDateRangeBounds(selectedPeriod, customStartDate, customEndDate);

  if (activeReportTab === 'dashboard') {
    renderExecutiveDashboard(contentArea, state, dateRange);
  } else if (activeReportTab === 'clinica') {
    renderClinicalReport(contentArea, state, dateRange);
  } else if (activeReportTab === 'farmacia') {
    renderPharmacyReport(contentArea, state, dateRange);
  } else if (activeReportTab === 'laboratorio') {
    renderDiagnosticReport(contentArea, state, dateRange);
  } else if (activeReportTab === 'hospitalizacion') {
    renderHospitalizationReport(contentArea, state, dateRange);
  } else if (activeReportTab === 'rrhh') {
    renderRrhhReport(contentArea, state, dateRange);
  } else if (activeReportTab === 'personalizado') {
    renderCustomReportBuilder(contentArea, state, dateRange);
  }
}

// ==========================================
// 1. 📊 RESUMEN EJECUTIVO Y FINANCIERO
// ==========================================
function renderExecutiveDashboard(container, state, dateRange) {
  const patients = state.patients || [];
  const pharmacySales = state.pharmacySales || [];
  const purchases = state.administracion_compras || [];
  const nominas = state.administracion_nominas || [];
  const surgeries = state.surgeries || [];
  const encamamientos = state.encamamiento || [];

  let totalBillingPaid = 0;
  let totalBillingPending = 0;
  let consultationsCount = 0;
  let proceduresTotal = 0;

  // 1. Calcular Facturación y Consultas de Pacientes
  patients.forEach(p => {
    (p.billingHistory || []).forEach(b => {
      if (isDateInRange(b.date, dateRange)) {
        const amt = parseFloat(b.total) || 0;
        if (b.status === 'Pagado') {
          totalBillingPaid += amt;
        } else {
          totalBillingPending += amt;
        }
      }
    });

    (p.consultations || []).forEach(c => {
      if (isDateInRange(c.date, dateRange)) {
        consultationsCount++;
        (c.procedures || []).forEach(proc => {
          proceduresTotal += parseFloat(proc.cost) || 0;
        });
      }
    });
  });

  // 2. Calcular Ventas de Farmacia
  let totalPharmacySales = 0;
  pharmacySales.forEach(s => {
    if (isDateInRange(s.date, dateRange)) {
      totalPharmacySales += parseFloat(s.total) || 0;
    }
  });

  // 3. Calcular Compras y Gastos a Proveedores
  let totalPurchases = 0;
  purchases.forEach(pur => {
    if (isDateInRange(pur.date, dateRange)) {
      totalPurchases += parseFloat(pur.total) || 0;
    }
  });

  // 4. Calcular Nóminas Pagadas
  let totalPayroll = 0;
  nominas.forEach(n => {
    if (isDateInRange(n.date || n.generationDate, dateRange) || (n.month && n.status === 'Pagada')) {
      totalPayroll += parseFloat(n.totalNetPay || n.totalPayroll) || 0;
    }
  });

  // 5. Total Ingresos y Egresos Globales
  const totalIncome = totalBillingPaid + totalPharmacySales;
  const totalExpenses = totalPurchases + totalPayroll;
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;

  // 6. Ocupación de Camas
  const totalBeds = 20; // Capacidad estándar
  const activeBeds = encamamientos.filter(e => e.status === 'Activo').length;
  const occupancyRate = ((activeBeds / totalBeds) * 100).toFixed(0);

  const rangeLabel = `${formatDateDisplay(dateRange.start)} al ${formatDateDisplay(dateRange.end)}`;

  container.innerHTML = `
    <!-- Tarjetas de Indicadores Clave (KPIs) -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 1.5rem;">
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-success); background: rgba(16, 185, 129, 0.04);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold;">Ingresos Totales (Caja)</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-success); margin-top: 4px; font-family: var(--font-mono);">
          Q${totalIncome.toFixed(2)}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Cobros Pacientes + Farmacia</div>
      </div>

      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-danger); background: rgba(239, 68, 68, 0.04);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold;">Egresos Totales</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-danger); margin-top: 4px; font-family: var(--font-mono);">
          Q${totalExpenses.toFixed(2)}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Compras + Nóminas Pagadas</div>
      </div>

      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-primary); background: rgba(0, 242, 254, 0.04);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold;">Utilidad Neta Operativa</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: ${netProfit >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'}; margin-top: 4px; font-family: var(--font-mono);">
          Q${netProfit.toFixed(2)}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Margen Operativo: <strong>${profitMargin}%</strong></div>
      </div>

      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-warning); background: rgba(245, 158, 11, 0.04);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold;">Cuentas por Cobrar</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-warning); margin-top: 4px; font-family: var(--font-mono);">
          Q${totalBillingPending.toFixed(2)}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Facturas pendientes de pacientes</div>
      </div>
    </div>

    <!-- Bloque de Gráficos y Distribución de Centros de Costos -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 1.5rem;">
      
      <!-- Distribución de Ingresos por Área -->
      <div class="glass-card" style="padding: 18px;">
        <h4 style="margin: 0 0 12px 0; color: var(--accent-primary); font-family: var(--font-heading); font-size: 1rem;">
          📊 Distribución de Ingresos por Centro de Costos
        </h4>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${(() => {
            const farmPct = totalIncome > 0 ? ((totalPharmacySales / totalIncome) * 100).toFixed(1) : 0;
            const clinPct = totalIncome > 0 ? ((totalBillingPaid / totalIncome) * 100).toFixed(1) : 0;
            return `
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                  <span>🩺 Consultas, Procedimientos y Hospitalización:</span>
                  <strong>Q${totalBillingPaid.toFixed(2)} (${clinPct}%)</strong>
                </div>
                <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                  <div style="width: ${clinPct}%; height: 100%; background: var(--accent-primary);"></div>
                </div>
              </div>

              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                  <span>💊 Farmacia y Medicamentos:</span>
                  <strong>Q${totalPharmacySales.toFixed(2)} (${farmPct}%)</strong>
                </div>
                <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                  <div style="width: ${farmPct}%; height: 100%; background: var(--accent-success);"></div>
                </div>
              </div>
            `;
          })()}
        </div>
      </div>

      <!-- Métricas Operativas Hospitalarias -->
      <div class="glass-card" style="padding: 18px;">
        <h4 style="margin: 0 0 12px 0; color: var(--accent-secondary); font-family: var(--font-heading); font-size: 1rem;">
          🏥 Resumen Operativo y Capacidad
        </h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; text-align: center;">
          <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Consultas Atendidas</div>
            <div style="font-size: 1.4rem; font-weight: bold; color: var(--accent-primary); margin-top: 4px;">${consultationsCount}</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Ocupación Hospitalaria</div>
            <div style="font-size: 1.4rem; font-weight: bold; color: var(--accent-secondary); margin-top: 4px;">${occupancyRate}% <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">(${activeBeds}/${totalBeds} camas)</span></div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Cirugías Registradas</div>
            <div style="font-size: 1.4rem; font-weight: bold; color: var(--accent-success); margin-top: 4px;">${surgeries.length}</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Procedimientos Menores</div>
            <div style="font-size: 1.4rem; font-weight: bold; color: var(--accent-warning); margin-top: 4px;">Q${proceduresTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla Detallada y Botones de Exportación -->
    <div class="glass-card" style="padding: 18px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <h4 style="margin: 0; color: var(--text-primary); font-family: var(--font-heading); font-size: 1rem;">
          📑 Consolidado Financiero y Operativo (${rangeLabel})
        </h4>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-small" id="btn-export-exec-excel">📥 Exportar Excel</button>
          <button class="btn btn-secondary btn-small" id="btn-export-exec-csv">📄 Exportar CSV</button>
          <button class="btn btn-primary btn-small" id="btn-print-exec-report">🖨️ Imprimir Reporte</button>
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
              <th style="padding: 8px 10px;">Concepto Financiero / Operativo</th>
              <th style="padding: 8px 10px; text-align: center;">Categoría</th>
              <th style="padding: 8px 10px; text-align: right;">Monto (Q)</th>
              <th style="padding: 8px 10px; text-align: center;">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 10px; font-weight: 600;">Ingresos por Cobros de Pacientes (Consultas / Procedimientos / Hospitalización)</td>
              <td style="padding: 8px 10px; text-align: center; color: var(--accent-primary);">Clínica / Caja</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: var(--accent-success); font-family: var(--font-mono);">Q${totalBillingPaid.toFixed(2)}</td>
              <td style="padding: 8px 10px; text-align: center;"><span class="badge badge-success">Percibido</span></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 10px; font-weight: 600;">Ingresos por Ventas de Farmacia y Medicamentos</td>
              <td style="padding: 8px 10px; text-align: center; color: var(--accent-success);">Farmacia</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: var(--accent-success); font-family: var(--font-mono);">Q${totalPharmacySales.toFixed(2)}</td>
              <td style="padding: 8px 10px; text-align: center;"><span class="badge badge-success">Percibido</span></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 10px; font-weight: 600;">Egresos por Compras y Adquisiciones a Proveedores</td>
              <td style="padding: 8px 10px; text-align: center; color: var(--accent-danger);">Compras</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: var(--accent-danger); font-family: var(--font-mono);">Q${totalPurchases.toFixed(2)}</td>
              <td style="padding: 8px 10px; text-align: center;"><span class="badge badge-danger">Gasto</span></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 10px; font-weight: 600;">Egresos por Planilla de Sueldos y Nómina Hospitalaria</td>
              <td style="padding: 8px 10px; text-align: center; color: var(--accent-danger);">RRHH</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: var(--accent-danger); font-family: var(--font-mono);">Q${totalPayroll.toFixed(2)}</td>
              <td style="padding: 8px 10px; text-align: center;"><span class="badge badge-danger">Planilla</span></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 10px; font-weight: 600;">Cuentas por Cobrar Pendientes de Pacientes</td>
              <td style="padding: 8px 10px; text-align: center; color: var(--accent-warning);">Cartera</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: var(--accent-warning); font-family: var(--font-mono);">Q${totalBillingPending.toFixed(2)}</td>
              <td style="padding: 8px 10px; text-align: center;"><span class="badge badge-warning">Por Cobrar</span></td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="border-top: 2px solid var(--border-color); font-weight: bold; font-size: 0.95rem;">
              <td colspan="2" style="padding: 10px; text-align: right;">SUPERÁVIT / UTILIDAD NETA DEL PERÍODO:</td>
              <td style="padding: 10px; text-align: right; color: ${netProfit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-family: var(--font-mono);">Q${netProfit.toFixed(2)}</td>
              <td style="padding: 10px; text-align: center;">${netProfit >= 0 ? '🟢 Positivo' : '🔴 Déficit'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  // Bind Exportadores
  const headers = ['Concepto', 'Categoría', 'Monto (Q)', 'Estado'];
  const rows = [
    ['Ingresos por Cobros de Pacientes', 'Clínica/Caja', totalBillingPaid.toFixed(2), 'Percibido'],
    ['Ingresos por Ventas de Farmacia', 'Farmacia', totalPharmacySales.toFixed(2), 'Percibido'],
    ['Egresos por Compras a Proveedores', 'Compras', totalPurchases.toFixed(2), 'Gasto'],
    ['Egresos por Planilla y Sueldos', 'RRHH', totalPayroll.toFixed(2), 'Planilla'],
    ['Cuentas por Cobrar Pendientes', 'Cartera', totalBillingPending.toFixed(2), 'Pendiente'],
    ['UTILIDAD NETA TOTAL', 'Balance', netProfit.toFixed(2), netProfit >= 0 ? 'Positivo' : 'Déficit']
  ];

  document.getElementById('btn-export-exec-excel').addEventListener('click', () => {
    exportReportToExcel(headers, rows, 'Resumen_Ejecutivo', `Reporte_Ejecutivo_${selectedPeriod}`);
  });

  document.getElementById('btn-export-exec-csv').addEventListener('click', () => {
    exportReportToCsv(headers, rows, `Reporte_Ejecutivo_${selectedPeriod}`);
  });

  document.getElementById('btn-print-exec-report').addEventListener('click', () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Concepto</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">Categoría</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">Monto (Q)</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: ${r[0].includes('UTILIDAD') ? 'bold' : 'normal'};">${r[0]}</td>
              <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${r[1]}</td>
              <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-weight: bold;">Q${r[2]}</td>
              <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${r[3]}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const summaryHtml = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; font-size: 11px; text-align: center;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px; border-radius: 4px;">
          <strong>Ingresos Totales:</strong><br><span style="color: #166534; font-size: 13px; font-weight: bold;">Q${totalIncome.toFixed(2)}</span>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 6px; border-radius: 4px;">
          <strong>Egresos Totales:</strong><br><span style="color: #991b1b; font-size: 13px; font-weight: bold;">Q${totalExpenses.toFixed(2)}</span>
        </div>
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 6px; border-radius: 4px;">
          <strong>Utilidad Neta:</strong><br><span style="color: #0369a1; font-size: 13px; font-weight: bold;">Q${netProfit.toFixed(2)} (${profitMargin}%)</span>
        </div>
      </div>
    `;

    openOfficialReportPrintModal('Informe de Rendimiento Ejecutivo y Financiero', `Período: ${rangeLabel}`, tableHtml, summaryHtml, state);
  });
}

// ==========================================
// 2. 🩺 CONSULTAS, ESPECIALIDADES Y PACIENTES
// ==========================================
function renderClinicalReport(container, state, dateRange) {
  const patients = state.patients || [];
  const doctorStatsMap = new Map();
  const specialtyMap = new Map();
  const diagnosisMap = new Map();
  const proceduresList = [];
  let totalConsultations = 0;
  let totalFees = 0;

  patients.forEach(p => {
    (p.consultations || []).forEach(c => {
      if (isDateInRange(c.date, dateRange)) {
        totalConsultations++;
        const docName = c.doctor || p.assignedDoctorName || 'Médico Tratante';
        const specName = c.specialty || 'Medicina General';
        const fee = parseFloat(c.fee) || 200.00;
        totalFees += fee;

        // Estadísticas por Médico
        if (!doctorStatsMap.has(docName)) {
          doctorStatsMap.set(docName, { doctor: docName, specialty: specName, count: 0, fees: 0, proceduresCost: 0, procCount: 0 });
        }
        const dStat = doctorStatsMap.get(docName);
        dStat.count++;
        dStat.fees += fee;

        // Procedimientos
        (c.procedures || []).forEach(proc => {
          const pCost = parseFloat(proc.cost) || 0;
          dStat.proceduresCost += pCost;
          dStat.procCount++;
          proceduresList.push({
            date: c.date,
            patientName: p.name,
            doctor: docName,
            name: proc.name,
            cost: pCost,
            notes: proc.notes || ''
          });
        });

        // Estadísticas por Especialidad
        specialtyMap.set(specName, (specialtyMap.get(specName) || 0) + 1);

        // Diagnósticos CIE-10
        const diagCodes = c.diagnosisCodes || [];
        const diagNames = c.diagnosisNames || [];
        if (diagCodes.length > 0) {
          diagCodes.forEach((code, idx) => {
            const name = diagNames[idx] || c.clinicalDiagnosis || 'Diagnóstico Clínico';
            const key = `${code} - ${name}`;
            diagnosisMap.set(key, (diagnosisMap.get(key) || 0) + 1);
          });
        } else if (c.clinicalDiagnosis || c.diagnosis) {
          const key = c.clinicalDiagnosis || c.diagnosis;
          diagnosisMap.set(key, (diagnosisMap.get(key) || 0) + 1);
        }
      }
    });
  });

  const doctorsArray = Array.from(doctorStatsMap.values()).sort((a, b) => b.count - a.count);
  const topDiagnoses = Array.from(diagnosisMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const rangeLabel = `${formatDateDisplay(dateRange.start)} al ${formatDateDisplay(dateRange.end)}`;

  container.innerHTML = `
    <!-- KPIs Clínicos -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 1.5rem;">
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-primary);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Total Consultas Médicas</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-primary); margin-top: 4px;">${totalConsultations}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Atendidas en el período</div>
      </div>
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-success);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Honorarios de Consulta</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-success); margin-top: 4px; font-family: var(--font-mono);">Q${totalFees.toFixed(2)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Generados por el staff médico</div>
      </div>
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-secondary);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Procedimientos Realizados</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-secondary); margin-top: 4px;">${proceduresList.length}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Curaciones, suturas, etc.</div>
      </div>
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-warning);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Promedio Consulta</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-warning); margin-top: 4px; font-family: var(--font-mono);">
          Q${totalConsultations > 0 ? (totalFees / totalConsultations).toFixed(2) : '0.00'}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Ticket promedio por paciente</div>
      </div>
    </div>

    <!-- Productividad Médica y Diagnósticos -->
    <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; margin-bottom: 1.5rem;">
      
      <!-- Tabla de Productividad por Médico -->
      <div class="glass-card" style="padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; color: var(--accent-primary); font-family: var(--font-heading); font-size: 1rem;">
            👨‍⚕️ Productividad por Médico Tratante
          </h4>
          <button class="btn btn-secondary btn-small" id="btn-export-doc-excel">📥 Excel</button>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                <th style="padding: 6px 8px;">Médico</th>
                <th style="padding: 6px 8px;">Especialidad</th>
                <th style="padding: 6px 8px; text-align: center;">Consultas</th>
                <th style="padding: 6px 8px; text-align: center;">Procedimientos</th>
                <th style="padding: 6px 8px; text-align: right;">Total Honorarios</th>
              </tr>
            </thead>
            <tbody>
              ${doctorsArray.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--text-muted);">Sin consultas registradas en este período</td></tr>' : ''}
              ${doctorsArray.map(d => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 6px 8px; font-weight: bold; color: var(--accent-primary);">${d.doctor}</td>
                  <td style="padding: 6px 8px; color: var(--text-muted);">${d.specialty}</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${d.count}</td>
                  <td style="padding: 6px 8px; text-align: center;">${d.procCount} (Q${d.proceduresCost.toFixed(2)})</td>
                  <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: var(--accent-success); font-family: var(--font-mono);">Q${(d.fees + d.proceduresCost).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top 10 Diagnósticos CIE-10 -->
      <div class="glass-card" style="padding: 18px;">
        <h4 style="margin: 0 0 12px 0; color: var(--accent-secondary); font-family: var(--font-heading); font-size: 1rem;">
          📋 Top 10 Diagnósticos Frecuentes (CIE-10)
        </h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${topDiagnoses.length === 0 ? '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:10px;">Sin diagnósticos en este rango</div>' : ''}
          ${topDiagnoses.map(([diag, count], idx) => {
            const pct = totalConsultations > 0 ? ((count / totalConsultations) * 100).toFixed(1) : 0;
            return `
              <div style="background: rgba(255,255,255,0.02); padding: 8px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 3px;">
                  <span style="font-weight: 600; color: var(--text-primary);"><strong style="color: var(--accent-primary);">#${idx + 1}</strong> ${diag}</span>
                  <strong style="color: var(--accent-secondary);">${count} casos (${pct}%)</strong>
                </div>
                <div style="height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                  <div style="width: ${pct}%; height: 100%; background: var(--accent-secondary);"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Procedimientos Realizados en Consulta -->
    <div class="glass-card" style="padding: 18px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 style="margin: 0; color: var(--text-primary); font-family: var(--font-heading); font-size: 1rem;">
          🩹 Bitácora de Procedimientos Clínicos Menores (${proceduresList.length} registros)
        </h4>
        <button class="btn btn-primary btn-small" id="btn-print-clinical-report">🖨️ Imprimir Reporte Clínico</button>
      </div>
      <div style="overflow-x: auto; max-height: 260px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
              <th style="padding: 6px 8px;">Fecha</th>
              <th style="padding: 6px 8px;">Paciente</th>
              <th style="padding: 6px 8px;">Médico</th>
              <th style="padding: 6px 8px;">Procedimiento</th>
              <th style="padding: 6px 8px;">Observaciones</th>
              <th style="padding: 6px 8px; text-align: right;">Costo (Q)</th>
            </tr>
          </thead>
          <tbody>
            ${proceduresList.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:15px; color:var(--text-muted);">Sin procedimientos clínicos en este período</td></tr>' : ''}
            ${proceduresList.map(pr => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                <td style="padding: 6px 8px;">${formatDateDisplay(pr.date)}</td>
                <td style="padding: 6px 8px; font-weight: bold;">${pr.patientName}</td>
                <td style="padding: 6px 8px; color: var(--accent-primary);">${pr.doctor}</td>
                <td style="padding: 6px 8px; font-weight: 600;">🩹 ${pr.name}</td>
                <td style="padding: 6px 8px; color: var(--text-muted); font-size: 0.8rem;">${pr.notes || '-'}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: var(--accent-success); font-family: var(--font-mono);">Q${pr.cost.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind Exportación
  const docHeaders = ['Médico Tratante', 'Especialidad', 'No. Consultas', 'Procedimientos', 'Total Honorarios (Q)'];
  const docRows = doctorsArray.map(d => [d.doctor, d.specialty, d.count, `${d.procCount} (Q${d.proceduresCost.toFixed(2)})`, (d.fees + d.proceduresCost).toFixed(2)]);

  document.getElementById('btn-export-doc-excel').addEventListener('click', () => {
    exportReportToExcel(docHeaders, docRows, 'Productividad_Medica', `Productividad_Medica_${selectedPeriod}`);
  });

  document.getElementById('btn-print-clinical-report').addEventListener('click', () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Médico</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Especialidad</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">Consultas</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">Honorarios (Q)</th>
          </tr>
        </thead>
        <tbody>
          ${docRows.map(r => `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">${r[0]}</td>
              <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${r[1]}</td>
              <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${r[2]}</td>
              <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-weight: bold;">Q${r[4]}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    openOfficialReportPrintModal('Informe de Actividad y Productividad Médica', `Período: ${rangeLabel} | Total Consultas: ${totalConsultations}`, tableHtml, '', state);
  });
}

// ==========================================
// 3. 💊 FARMACIA Y CONTROL DE INVENTARIOS
// ==========================================
function renderPharmacyReport(container, state, dateRange) {
  const pharmacySales = state.pharmacySales || [];
  const medications = state.medications || [];

  let totalSalesAmt = 0;
  let totalUnitsSold = 0;
  const medSalesMap = new Map();

  pharmacySales.forEach(sale => {
    if (isDateInRange(sale.date, dateRange)) {
      totalSalesAmt += parseFloat(sale.total) || 0;
      (sale.items || []).forEach(it => {
        const qty = parseInt(it.quantity) || 1;
        const sub = parseFloat(it.subtotal) || (parseFloat(it.price) * qty) || 0;
        totalUnitsSold += qty;

        const itName = it.name || it.description || 'Medicamento';
        if (!medSalesMap.has(itName)) {
          medSalesMap.set(itName, { name: itName, quantity: 0, total: 0 });
        }
        const mObj = medSalesMap.get(itName);
        mObj.quantity += qty;
        mObj.total += sub;
      });
    }
  });

  const topMeds = Array.from(medSalesMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 15);

  // Inventario en Riesgo / Alertas
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalInventoryValue = 0;
  let criticalStockCount = 0;
  const expiredMeds = [];
  const expiringSoonMeds = [];

  medications.forEach(m => {
    const stock = parseInt(m.stock) || 0;
    const price = parseFloat(m.price) || 0;
    const minStock = parseInt(m.minStock) || 5;
    totalInventoryValue += stock * price;

    if (stock <= minStock) {
      criticalStockCount++;
    }

    if (m.vencimiento) {
      const vDate = new Date(m.vencimiento);
      if (!isNaN(vDate.getTime())) {
        const diffDays = Math.ceil((vDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          expiredMeds.push({ ...m, diffDays, vFormatted: vDate.toLocaleDateString('es-GT') });
        } else if (diffDays <= 45) {
          expiringSoonMeds.push({ ...m, diffDays, vFormatted: vDate.toLocaleDateString('es-GT') });
        }
      }
    }
  });

  container.innerHTML = `
    <!-- KPIs Farmacia -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 1.5rem;">
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-success);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Total Ventas Farmacia</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-success); margin-top: 4px; font-family: var(--font-mono);">Q${totalSalesAmt.toFixed(2)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${totalUnitsSold} unidades despachadas</div>
      </div>

      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-primary);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Valor del Inventario</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-primary); margin-top: 4px; font-family: var(--font-mono);">Q${totalInventoryValue.toFixed(2)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${medications.length} productos en catálogo</div>
      </div>

      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-warning);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Stock Crítico (Bajo Mínimo)</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-warning); margin-top: 4px;">${criticalStockCount} ítems</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Requieren orden de compra</div>
      </div>

      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-danger);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Lotes Vencidos / Por Vencer</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-danger); margin-top: 4px;">${expiredMeds.length + expiringSoonMeds.length} lotes</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${expiredMeds.length} caducados / ${expiringSoonMeds.length} en riesgo</div>
      </div>
    </div>

    <!-- Top Medicamentos y Alertas de Vencimiento -->
    <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; margin-bottom: 1.5rem;">
      
      <!-- Top Medicamentos Vendidos -->
      <div class="glass-card" style="padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; color: var(--accent-success); font-family: var(--font-heading); font-size: 1rem;">
            🏆 Top 15 Medicamentos más Despachados
          </h4>
          <button class="btn btn-secondary btn-small" id="btn-export-pharma-top">📥 Excel</button>
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                <th style="padding: 6px 8px;">Medicamento</th>
                <th style="padding: 6px 8px; text-align: center;">Unidades</th>
                <th style="padding: 6px 8px; text-align: right;">Total Vendido (Q)</th>
              </tr>
            </thead>
            <tbody>
              ${topMeds.length === 0 ? '<tr><td colspan="3" style="text-align:center; padding:15px; color:var(--text-muted);">Sin ventas de farmacia en este período</td></tr>' : ''}
              ${topMeds.map((m, idx) => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 6px 8px; font-weight: bold;">
                    <span style="color: var(--accent-primary); margin-right: 4px;">#${idx + 1}</span> ${m.name}
                  </td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: var(--accent-secondary);">${m.quantity}</td>
                  <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: var(--accent-success); font-family: var(--font-mono);">Q${m.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Alertas de Caducidad y Stock Crítico -->
      <div class="glass-card" style="padding: 18px;">
        <h4 style="margin: 0 0 12px 0; color: var(--accent-danger); font-family: var(--font-heading); font-size: 1rem;">
          🚨 Alertas de Vencimiento y Caducidad
        </h4>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;">
          ${expiredMeds.length === 0 && expiringSoonMeds.length === 0 ? '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:10px;">No hay alertas de caducidad inmediatas.</div>' : ''}
          ${expiredMeds.map(m => `
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px 10px; border-radius: 4px; font-size: 0.82rem;">
              <strong style="color: #ef4444;">🚨 CADUCADO:</strong> ${m.name} (Lote: ${m.lote || 'S/L'})
              <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">Venció el ${m.vFormatted} | Stock en riesgo: <strong>${m.stock} unidades</strong></div>
            </div>
          `).join('')}
          ${expiringSoonMeds.map(m => `
            <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); padding: 8px 10px; border-radius: 4px; font-size: 0.82rem;">
              <strong style="color: #f59e0b;">⚠️ POR VENCER:</strong> ${m.name} (Lote: ${m.lote || 'S/L'})
              <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">Vence el ${m.vFormatted} (en ${m.diffDays} días) | Stock: <strong>${m.stock} unidades</strong></div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Bind Exportación
  const pharmaHeaders = ['Medicamento', 'Unidades Vendidas', 'Total Recaudado (Q)'];
  const pharmaRows = topMeds.map(m => [m.name, m.quantity, m.total.toFixed(2)]);

  document.getElementById('btn-export-pharma-top').addEventListener('click', () => {
    exportReportToExcel(pharmaHeaders, pharmaRows, 'Ventas_Farmacia', `Top_Farmacia_${selectedPeriod}`);
  });
}

// ==========================================
// 4. 🔬 LABORATORIO CLÍNICO E IMAGENOLOGÍA
// ==========================================
function renderDiagnosticReport(container, state, dateRange) {
  const patients = state.patients || [];
  const labTestsMap = new Map();
  const imagingMap = new Map();
  let totalLabTests = 0;
  let totalImagingStudies = 0;

  patients.forEach(p => {
    // 1. Laboratorios locales y cargados
    (p.localLabs || []).forEach(lab => {
      if (isDateInRange(lab.date, dateRange)) {
        totalLabTests++;
        const lName = lab.name || 'Estudio de Laboratorio';
        labTestsMap.set(lName, (labTestsMap.get(lName) || 0) + 1);
      }
    });

    // 2. Órdenes de Estudios
    (p.studyOrders || []).forEach(ord => {
      if (isDateInRange(ord.date, dateRange)) {
        (ord.studies || []).forEach(st => {
          if (st.type === 'imaging') {
            totalImagingStudies++;
            imagingMap.set(st.name, (imagingMap.get(st.name) || 0) + 1);
          } else {
            totalLabTests++;
            labTestsMap.set(st.name, (labTestsMap.get(st.name) || 0) + 1);
          }
        });
      }
    });
  });

  const labArray = Array.from(labTestsMap.entries()).sort((a, b) => b[1] - a[1]);
  const imgArray = Array.from(imagingMap.entries()).sort((a, b) => b[1] - a[1]);

  container.innerHTML = `
    <!-- KPIs Diagnóstico -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 1.5rem;">
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-primary);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Pruebas de Laboratorio</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-primary); margin-top: 4px;">${totalLabTests}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Procesadas en el período</div>
      </div>

      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-secondary);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Estudios de Imagenología</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-secondary); margin-top: 4px;">${totalImagingStudies}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Rayos X, Ultrasonidos, etc.</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <!-- Exámenes de Laboratorio más Frecuentes -->
      <div class="glass-card" style="padding: 18px;">
        <h4 style="margin: 0 0 12px 0; color: var(--accent-primary); font-family: var(--font-heading); font-size: 1rem;">
          🔬 Exámenes de Laboratorio más Solicitados
        </h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                <th style="padding: 6px 8px;">Estudio / Análisis</th>
                <th style="padding: 6px 8px; text-align: center;">Total Realizados</th>
              </tr>
            </thead>
            <tbody>
              ${labArray.length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:15px; color:var(--text-muted);">Sin registros de laboratorio en este rango</td></tr>' : ''}
              ${labArray.map(([name, count], idx) => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 6px 8px; font-weight: 600;"><span style="color:var(--accent-primary);">#${idx + 1}</span> ${name}</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: var(--accent-primary);">${count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Estudios de Imagenología más Frecuentes -->
      <div class="glass-card" style="padding: 18px;">
        <h4 style="margin: 0 0 12px 0; color: var(--accent-secondary); font-family: var(--font-heading); font-size: 1rem;">
          🖼️ Estudios de Imagenología más Frecuentes
        </h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                <th style="padding: 6px 8px;">Modalidad / Estudio</th>
                <th style="padding: 6px 8px; text-align: center;">Total Solicitados</th>
              </tr>
            </thead>
            <tbody>
              ${imgArray.length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:15px; color:var(--text-muted);">Sin estudios de imagen en este rango</td></tr>' : ''}
              ${imgArray.map(([name, count], idx) => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 6px 8px; font-weight: 600;"><span style="color:var(--accent-secondary);">#${idx + 1}</span> ${name}</td>
                  <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: var(--accent-secondary);">${count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 5. 🏥 HOSPITALIZACIÓN, EMERGENCIAS Y QUIRÓFANO
// ==========================================
function renderHospitalizationReport(container, state, dateRange) {
  const encamamiento = state.encamamiento || [];
  const emergencias = state.emergencias || [];
  const surgeries = state.surgeries || [];

  const inRangeEnc = encamamiento.filter(e => isDateInRange(e.admissionDate, dateRange) || isDateInRange(e.dischargeDate, dateRange));
  const inRangeEmerg = emergencias.filter(em => isDateInRange(em.admissionDate, dateRange));
  const inRangeSurg = surgeries.filter(s => isDateInRange(s.createdAt || s.completedAt, dateRange));

  // Triage stats
  const triageStats = { 'Rojo': 0, 'Naranja': 0, 'Amarillo': 0, 'Verde': 0, 'Azul': 0 };
  inRangeEmerg.forEach(em => {
    const t = em.triageColor || 'Verde';
    if (triageStats[t] !== undefined) triageStats[t]++;
  });

  container.innerHTML = `
    <!-- KPIs -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 1.5rem;">
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-primary);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Hospitalizaciones (Encamamiento)</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-primary); margin-top: 4px;">${inRangeEnc.length} pacientes</div>
      </div>
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-danger);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Atenciones de Emergencia</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-danger); margin-top: 4px;">${inRangeEmerg.length} ingresos</div>
      </div>
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-success);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Cirugías en Quirófano</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-success); margin-top: 4px;">${inRangeSurg.length} intervenciones</div>
      </div>
    </div>

    <!-- Triage de Emergencias y Lista de Cirugías -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 1.5rem;">
      
      <!-- Distribución de Triage -->
      <div class="glass-card" style="padding: 18px;">
        <h4 style="margin: 0 0 12px 0; color: var(--accent-danger); font-family: var(--font-heading); font-size: 1rem;">
          🚨 Clasificación de Triage en Emergencias
        </h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; border-left: 3px solid #ef4444;">
            <span>🔴 Rojo (Reanimación / Paro / Inminente):</span>
            <strong>${triageStats['Rojo']}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: rgba(249, 115, 22, 0.1); border-radius: 4px; border-left: 3px solid #f97316;">
            <span>🟠 Naranja (Emergencia Severa):</span>
            <strong>${triageStats['Naranja']}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: rgba(234, 179, 8, 0.1); border-radius: 4px; border-left: 3px solid #eab308;">
            <span>🟡 Amarillo (Urgente Estable):</span>
            <strong>${triageStats['Amarillo']}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: rgba(34, 197, 94, 0.1); border-radius: 4px; border-left: 3px solid #22c55e;">
            <span>🟢 Verde (Urgencia Menor):</span>
            <strong>${triageStats['Verde']}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 10px; background: rgba(59, 130, 246, 0.1); border-radius: 4px; border-left: 3px solid #3b82f6;">
            <span>🔵 Azul (Consulta No Urgente):</span>
            <strong>${triageStats['Azul']}</strong>
          </div>
        </div>
      </div>

      <!-- Cirugías del Período -->
      <div class="glass-card" style="padding: 18px;">
        <h4 style="margin: 0 0 12px 0; color: var(--accent-success); font-family: var(--font-heading); font-size: 1rem;">
          🔪 Procedimientos Quirúrgicos Realizados
        </h4>
        <div style="overflow-x: auto; max-height: 240px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                <th style="padding: 4px 6px;">Fecha</th>
                <th style="padding: 4px 6px;">Paciente</th>
                <th style="padding: 4px 6px;">Cirugía</th>
                <th style="padding: 4px 6px;">Cirujano</th>
              </tr>
            </thead>
            <tbody>
              ${inRangeSurg.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:10px; color:var(--text-muted);">Sin cirugías en este rango</td></tr>' : ''}
              ${inRangeSurg.map(s => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 4px 6px;">${formatDateDisplay(s.createdAt || s.completedAt)}</td>
                  <td style="padding: 4px 6px; font-weight: bold;">${s.patientName || 'Paciente'}</td>
                  <td style="padding: 4px 6px; color: var(--accent-success);">${s.procedureName}</td>
                  <td style="padding: 4px 6px;">${s.surgeon ? s.surgeon.name : 'Cirujano'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 6. 👥 PERSONAL, ASISTENCIAS Y NÓMINAS
// ==========================================
function renderRrhhReport(container, state, dateRange) {
  const employees = state.administracion_employees || [];
  const asistencias = state.administracion_asistencias || [];
  const nominas = state.administracion_nominas || [];

  const activeEmployees = employees.filter(e => e.status === 'Activo' || !e.status);
  const deptMap = new Map();
  activeEmployees.forEach(emp => {
    const d = emp.department || 'General';
    deptMap.set(d, (deptMap.get(d) || 0) + 1);
  });

  let totalPayrollPaid = 0;
  nominas.forEach(n => {
    if (isDateInRange(n.date || n.generationDate, dateRange) || (n.month && n.status === 'Pagada')) {
      totalPayrollPaid += parseFloat(n.totalNetPay || n.totalPayroll) || 0;
    }
  });

  const inRangeAttendance = asistencias.filter(a => isDateInRange(a.date, dateRange));
  let punctualCount = 0;
  let lateCount = 0;
  inRangeAttendance.forEach(a => {
    if (a.status === 'Puntual' || a.status === 'Presente') punctualCount++;
    else if (a.status === 'Tardanza') lateCount++;
  });
  const punctualityRate = inRangeAttendance.length > 0 ? ((punctualCount / inRangeAttendance.length) * 100).toFixed(1) : 100;

  container.innerHTML = `
    <!-- KPIs RRHH -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 1.5rem;">
      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-primary);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Colaboradores Activos</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-primary); margin-top: 4px;">${activeEmployees.length} empleados</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">En nómina hospitalaria</div>
      </div>

      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-success);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Monto de Planilla Pagada</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-success); margin-top: 4px; font-family: var(--font-mono);">Q${totalPayrollPaid.toFixed(2)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Sueldos netos liquidados</div>
      </div>

      <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--accent-secondary);">
        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Índice de Puntualidad</div>
        <div style="font-size: 1.6rem; font-weight: bold; color: var(--accent-secondary); margin-top: 4px;">${punctualityRate}%</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${inRangeAttendance.length} marcajes evaluados</div>
      </div>
    </div>

    <!-- Personal por Departamento -->
    <div class="glass-card" style="padding: 18px;">
      <h4 style="margin: 0 0 12px 0; color: var(--accent-primary); font-family: var(--font-heading); font-size: 1rem;">
        👥 Distribución de Personal por Departamento
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
        ${Array.from(deptMap.entries()).map(([dept, count]) => `
          <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">${dept}</div>
            <div style="font-size: 1.4rem; font-weight: bold; color: var(--accent-primary); margin-top: 4px;">${count}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ==========================================
// 7. 🛠️ CONSTRUCTOR DE REPORTES PERSONALIZADOS
// ==========================================
const DATA_SOURCES_CONFIG = {
  billing: {
    label: '💳 Facturación y Cobros de Pacientes',
    columns: [
      { key: 'date', label: 'Fecha' },
      { key: 'patientName', label: 'Paciente' },
      { key: 'concept', label: 'Concepto' },
      { key: 'diagnosis', label: 'Diagnóstico' },
      { key: 'total', label: 'Total (Q)', isNumeric: true },
      { key: 'status', label: 'Estado' }
    ]
  },
  consultations: {
    label: '🩺 Consultas Médicas',
    columns: [
      { key: 'date', label: 'Fecha / Hora' },
      { key: 'patientName', label: 'Paciente' },
      { key: 'doctor', label: 'Médico' },
      { key: 'specialty', label: 'Especialidad' },
      { key: 'reason', label: 'Motivo' },
      { key: 'clinicalDiagnosis', label: 'Diagnóstico' },
      { key: 'fee', label: 'Honorario (Q)', isNumeric: true }
    ]
  },
  pharmacy_sales: {
    label: '💊 Ventas de Farmacia',
    columns: [
      { key: 'date', label: 'Fecha' },
      { key: 'patientName', label: 'Paciente / Cliente' },
      { key: 'itemsCount', label: 'Ítems' },
      { key: 'total', label: 'Total (Q)', isNumeric: true },
      { key: 'paymentMethod', label: 'Método Pago' },
      { key: 'sellerName', label: 'Vendedor' }
    ]
  },
  inventory: {
    label: '📦 Catálogo e Inventario de Farmacia',
    columns: [
      { key: 'name', label: 'Medicamento' },
      { key: 'generic', label: 'Genérico' },
      { key: 'category', label: 'Categoría' },
      { key: 'stock', label: 'Stock Actual', isNumeric: true },
      { key: 'minStock', label: 'Stock Mín.' },
      { key: 'price', label: 'Precio Venta (Q)', isNumeric: true },
      { key: 'vencimiento', label: 'Vencimiento' }
    ]
  },
  purchases: {
    label: '🛒 Compras y Adquisiciones',
    columns: [
      { key: 'date', label: 'Fecha' },
      { key: 'supplier', label: 'Proveedor' },
      { key: 'invoiceNumber', label: 'No. Factura' },
      { key: 'total', label: 'Monto Total (Q)', isNumeric: true },
      { key: 'paymentStatus', label: 'Estado Pago' }
    ]
  },
  employees: {
    label: '👥 Personal y Empleados',
    columns: [
      { key: 'employee_code', label: 'Código' },
      { key: 'name', label: 'Nombre Colaborador' },
      { key: 'department', label: 'Departamento' },
      { key: 'position', label: 'Puesto' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'salary', label: 'Salario Base (Q)', isNumeric: true },
      { key: 'status', label: 'Estado' }
    ]
  },
  attendance: {
    label: '⏰ Asistencias y Marcajes',
    columns: [
      { key: 'date', label: 'Fecha' },
      { key: 'employeeName', label: 'Colaborador' },
      { key: 'checkIn', label: 'Hora Entrada' },
      { key: 'checkOut', label: 'Hora Salida' },
      { key: 'method', label: 'Método' },
      { key: 'status', label: 'Estado' }
    ]
  },
  surgeries: {
    label: '🔪 Cirugías de Quirófano',
    columns: [
      { key: 'date', label: 'Fecha' },
      { key: 'patientName', label: 'Paciente' },
      { key: 'procedureName', label: 'Cirugía' },
      { key: 'surgeonName', label: 'Cirujano' },
      { key: 'operatingRoom', label: 'Sala' },
      { key: 'totalCost', label: 'Costo (Q)', isNumeric: true }
    ]
  }
};

function renderCustomReportBuilder(container, state, dateRange) {
  const currentSource = customReportConfig.dataSource || 'billing';
  const sourceDef = DATA_SOURCES_CONFIG[currentSource] || DATA_SOURCES_CONFIG.billing;

  // Si no hay columnas seleccionadas, seleccionar todas por defecto
  if (!customReportConfig.selectedColumns || customReportConfig.selectedColumns.length === 0) {
    customReportConfig.selectedColumns = sourceDef.columns.map(c => c.key);
  }

  // Extraer datos según la fuente
  const rawData = extractRawDataForSource(state, currentSource, dateRange);

  // Filtrar datos según búsqueda y estado
  const filteredData = rawData.filter(item => {
    // Filtro de búsqueda textual
    if (customReportConfig.searchQuery) {
      const q = customReportConfig.searchQuery.toLowerCase();
      const match = Object.values(item).some(v => String(v || '').toLowerCase().includes(q));
      if (!match) return false;
    }
    // Filtro de estado
    if (customReportConfig.statusFilter !== 'todos' && item.status) {
      if (String(item.status).toLowerCase() !== customReportConfig.statusFilter.toLowerCase()) {
        return false;
      }
    }
    return true;
  });

  // Calcular totales de columnas numéricas
  const totals = {};
  sourceDef.columns.forEach(col => {
    if (col.isNumeric) {
      totals[col.key] = filteredData.reduce((acc, row) => acc + (parseFloat(row[col.key]) || 0), 0);
    }
  });

  const rangeLabel = `${formatDateDisplay(dateRange.start)} al ${formatDateDisplay(dateRange.end)}`;

  container.innerHTML = `
    <div class="glass-card" style="padding: 18px; margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 14px 0; color: var(--accent-primary); font-family: var(--font-heading); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
        <span>🛠️</span> Constructor de Reportes a la Medida
      </h4>

      <!-- Controles de Configuración -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; align-items: flex-end;">
        
        <!-- Fuente de Datos -->
        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">1. Fuente de Datos:</label>
          <select id="builder-datasource" style="width: 100%; padding: 8px; font-size: 0.85rem; border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);">
            ${Object.entries(DATA_SOURCES_CONFIG).map(([k, v]) => `
              <option value="${k}" ${currentSource === k ? 'selected' : ''}>${v.label}</option>
            `).join('')}
          </select>
        </div>

        <!-- Filtro de Búsqueda -->
        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">2. Búsqueda Rápida:</label>
          <input type="text" id="builder-search" value="${customReportConfig.searchQuery || ''}" placeholder="🔍 Filtrar por nombre, concepto, etc..." style="width: 100%; padding: 7px 10px; font-size: 0.85rem; border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);">
        </div>

        <!-- Filtro de Estado -->
        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">3. Filtro de Estado:</label>
          <select id="builder-status" style="width: 100%; padding: 8px; font-size: 0.85rem; border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);">
            <option value="todos" ${customReportConfig.statusFilter === 'todos' ? 'selected' : ''}>Todos los Estados</option>
            <option value="pagado" ${customReportConfig.statusFilter === 'pagado' ? 'selected' : ''}>Pagado</option>
            <option value="pendiente" ${customReportConfig.statusFilter === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="activo" ${customReportConfig.statusFilter === 'activo' ? 'selected' : ''}>Activo</option>
          </select>
        </div>
      </div>

      <!-- Selector de Columnas Dinámicas -->
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--border-color);">
        <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 6px; font-weight: bold;">
          4. Columnas a Incluir en el Informe:
        </label>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;" id="builder-columns-checkboxes">
          ${sourceDef.columns.map(col => `
            <label style="font-size: 0.82rem; color: var(--text-primary); display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="checkbox" value="${col.key}" class="builder-col-chk" ${customReportConfig.selectedColumns.includes(col.key) ? 'checked' : ''}>
              ${col.label}
            </label>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Resultados y Tabla Generada -->
    <div class="glass-card" style="padding: 18px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h4 style="margin: 0; color: var(--text-primary); font-family: var(--font-heading); font-size: 1rem;">
            📋 Resultados: ${sourceDef.label} (${filteredData.length} registros encontrados)
          </h4>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${rangeLabel}</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-small" id="btn-custom-export-excel">📥 Exportar Excel (XLSX)</button>
          <button class="btn btn-secondary btn-small" id="btn-custom-export-csv">📄 Exportar CSV</button>
          <button class="btn btn-primary btn-small" id="btn-custom-print">🖨️ Imprimir Reporte Oficial</button>
        </div>
      </div>

      <div style="overflow-x: auto; max-height: 380px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left; position: sticky; top: 0; background: var(--bg-card);">
              ${sourceDef.columns.filter(c => customReportConfig.selectedColumns.includes(c.key)).map(c => `
                <th style="padding: 8px 10px; ${c.isNumeric ? 'text-align: right;' : ''}">${c.label}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${filteredData.length === 0 ? `<tr><td colspan="${customReportConfig.selectedColumns.length}" style="text-align:center; padding:20px; color:var(--text-muted);">No se encontraron datos con los filtros seleccionados.</td></tr>` : ''}
            ${filteredData.map(row => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                ${sourceDef.columns.filter(c => customReportConfig.selectedColumns.includes(c.key)).map(c => {
                  const val = row[c.key];
                  if (c.isNumeric) {
                    return `<td style="padding: 6px 10px; text-align: right; font-weight: bold; color: var(--accent-success); font-family: var(--font-mono);">${typeof val === 'number' ? (c.key === 'stock' ? val : 'Q' + val.toFixed(2)) : val}</td>`;
                  }
                  if (c.key === 'status') {
                    const st = String(val).toLowerCase();
                    const bClass = st === 'pagado' || st === 'activo' || st === 'puntual' ? 'badge-success' : st === 'pendiente' || st === 'tardanza' ? 'badge-warning' : 'badge-danger';
                    return `<td style="padding: 6px 10px;"><span class="badge ${bClass}">${val || 'N/A'}</span></td>`;
                  }
                  return `<td style="padding: 6px 10px;">${val !== undefined && val !== null ? val : '-'}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
          ${Object.keys(totals).length > 0 ? `
            <tfoot>
              <tr style="border-top: 2px solid var(--border-color); font-weight: bold; font-size: 0.9rem;">
                ${sourceDef.columns.filter(c => customReportConfig.selectedColumns.includes(c.key)).map((c, idx) => {
                  if (idx === 0) return `<td style="padding: 8px 10px;">TOTALES:</td>`;
                  if (c.isNumeric && totals[c.key] !== undefined) {
                    return `<td style="padding: 8px 10px; text-align: right; color: var(--accent-success); font-family: var(--font-mono);">${c.key === 'stock' ? totals[c.key] : 'Q' + totals[c.key].toFixed(2)}</td>`;
                  }
                  return `<td></td>`;
                }).join('')}
              </tr>
            </tfoot>
          ` : ''}
        </table>
      </div>
    </div>
  `;

  // Bind Cambio de Fuente de Datos
  document.getElementById('builder-datasource').addEventListener('change', (e) => {
    customReportConfig.dataSource = e.target.value;
    const newDef = DATA_SOURCES_CONFIG[customReportConfig.dataSource];
    customReportConfig.selectedColumns = newDef.columns.map(c => c.key);
    renderCustomReportBuilder(container, state, dateRange);
  });

  // Bind Búsqueda
  document.getElementById('builder-search').addEventListener('input', (e) => {
    customReportConfig.searchQuery = e.target.value;
    renderCustomReportBuilder(container, state, dateRange);
  });

  // Bind Estado
  document.getElementById('builder-status').addEventListener('change', (e) => {
    customReportConfig.statusFilter = e.target.value;
    renderCustomReportBuilder(container, state, dateRange);
  });

  // Bind Checkboxes de Columnas
  container.querySelectorAll('.builder-col-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      const selected = Array.from(container.querySelectorAll('.builder-col-chk:checked')).map(el => el.value);
      customReportConfig.selectedColumns = selected;
      renderCustomReportBuilder(container, state, dateRange);
    });
  });

  // Bind Exportación
  const activeCols = sourceDef.columns.filter(c => customReportConfig.selectedColumns.includes(c.key));
  const exportHeaders = activeCols.map(c => c.label);
  const exportRows = filteredData.map(row => activeCols.map(c => row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : ''));

  document.getElementById('btn-custom-export-excel').addEventListener('click', () => {
    exportReportToExcel(exportHeaders, exportRows, 'Reporte_Personalizado', `Reporte_${currentSource}_${selectedPeriod}`);
  });

  document.getElementById('btn-custom-export-csv').addEventListener('click', () => {
    exportReportToCsv(exportHeaders, exportRows, `Reporte_${currentSource}_${selectedPeriod}`);
  });

  document.getElementById('btn-custom-print').addEventListener('click', () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background: #f1f5f9;">
            ${exportHeaders.map(h => `<th style="border: 1px solid #cbd5e1; padding: 5px 6px;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${exportRows.map(r => `
            <tr>
              ${r.map(cell => `<td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    openOfficialReportPrintModal(sourceDef.label, `Período: ${rangeLabel} | Total Registros: ${filteredData.length}`, tableHtml, '', state);
  });
}

// Extractor unificado de datos para el constructor de reportes personalizados
function extractRawDataForSource(state, source, dateRange) {
  const result = [];
  const patients = state.patients || [];

  if (source === 'billing') {
    patients.forEach(p => {
      (p.billingHistory || []).forEach(b => {
        if (isDateInRange(b.date, dateRange)) {
          result.push({
            date: formatDateDisplay(b.date),
            patientName: p.name,
            concept: b.concept || 'Consulta / Servicio',
            diagnosis: b.diagnosis || 'N/A',
            total: parseFloat(b.total) || 0,
            status: b.status || 'Pendiente'
          });
        }
      });
    });
  } else if (source === 'consultations') {
    patients.forEach(p => {
      (p.consultations || []).forEach(c => {
        if (isDateInRange(c.date, dateRange)) {
          result.push({
            date: formatDateTimeDisplay(c.date),
            patientName: p.name,
            doctor: c.doctor || p.assignedDoctorName || 'Médico Tratante',
            specialty: c.specialty || 'Medicina General',
            reason: c.reason || 'Consulta Médica',
            clinicalDiagnosis: c.clinicalDiagnosis || (c.diagnosisCodes ? c.diagnosisCodes.join(', ') : 'Z00.0'),
            fee: parseFloat(c.fee) || 200.00
          });
        }
      });
    });
  } else if (source === 'pharmacy_sales') {
    (state.pharmacySales || []).forEach(s => {
      if (isDateInRange(s.date, dateRange)) {
        result.push({
          date: formatDateTimeDisplay(s.date),
          patientName: s.patientName || 'Cliente Mostrador',
          itemsCount: (s.items || []).length,
          total: parseFloat(s.total) || 0,
          paymentMethod: s.paymentMethod || 'Efectivo',
          sellerName: s.sellerName || 'Farmacia'
        });
      }
    });
  } else if (source === 'inventory') {
    (state.medications || []).forEach(m => {
      result.push({
        name: m.name,
        generic: m.generic || '-',
        category: m.category || 'General',
        stock: parseInt(m.stock) || 0,
        minStock: parseInt(m.minStock) || 5,
        price: parseFloat(m.price) || 0,
        vencimiento: m.vencimiento || 'N/D'
      });
    });
  } else if (source === 'purchases') {
    (state.administracion_compras || []).forEach(pur => {
      if (isDateInRange(pur.date, dateRange)) {
        result.push({
          date: formatDateDisplay(pur.date),
          supplier: pur.supplier || pur.supplierName || 'Proveedor',
          invoiceNumber: pur.invoiceNumber || pur.docNumber || 'S/N',
          total: parseFloat(pur.total) || 0,
          paymentStatus: pur.paymentStatus || pur.status || 'Pagado',
          status: pur.status || 'Completado'
        });
      }
    });
  } else if (source === 'employees') {
    (state.administracion_employees || []).forEach(emp => {
      result.push({
        employee_code: emp.employee_code || 'EMP-S/C',
        name: emp.name,
        department: emp.department || 'General',
        position: emp.position || 'Colaborador',
        phone: emp.phone || 'N/D',
        salary: parseFloat(emp.base_salary || emp.salary) || 0,
        status: emp.status || 'Activo'
      });
    });
  } else if (source === 'attendance') {
    (state.administracion_asistencias || []).forEach(a => {
      if (isDateInRange(a.date, dateRange)) {
        result.push({
          date: formatDateDisplay(a.date),
          employeeName: a.employee_name || a.name || 'Colaborador',
          checkIn: a.check_in || a.time_in || 'N/D',
          checkOut: a.check_out || a.time_out || 'En turno',
          method: a.method || 'Manual',
          status: a.status || 'Presente'
        });
      }
    });
  } else if (source === 'surgeries') {
    (state.surgeries || []).forEach(s => {
      if (isDateInRange(s.createdAt || s.completedAt, dateRange)) {
        result.push({
          date: formatDateDisplay(s.createdAt || s.completedAt),
          patientName: s.patientName || 'Paciente',
          procedureName: s.procedureName || 'Procedimiento Quirúrgico',
          surgeonName: s.surgeon ? s.surgeon.name : 'Cirujano',
          operatingRoom: s.operatingRoom || 'Quirófano 1',
          totalCost: parseFloat(s.totalCost) || 0
        });
      }
    });
  }

  return result;
}
