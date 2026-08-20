import { getAppState, saveAppState } from '../main.js';
import { simulateOnPurchaseCreated, simulateOnPayrollGenerated } from '../utils/cloud_functions.js';
import logoUrl from '../assets/logo.jpg';

let activeAdminTab = 'caja'; // 'caja', 'contabilidad', 'compras', 'rrhh'
let activeCajaSubTab = 'cobros'; // 'cobros', 'cxp', 'nominas'
let activeContabilidadSubTab = 'diario'; // 'diario', 'impuestos'
let activeRrhhSubTab = 'empleados'; // 'empleados', 'nomina'
let editingEmployeeId = null;
let selectedPayrollMonth = 'Agosto 2026';

// Variables temporales para el creador de compras
let tempPurchaseItems = [];

// Pre-selección de paciente para caja (útil al redireccionar)
let preSelectedPatientId = null;

export function setPreSelectedPatient(patientId) {
  preSelectedPatientId = patientId;
  activeAdminTab = 'caja';
  activeCajaSubTab = 'cobros';
}

export function renderAdministracion(container) {
  const state = getAppState();
  const currentUser = state.currentUser;

  // 1. Validar Control de Acceso (RBAC Granular)
  const roleLower = String(currentUser && currentUser.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nameLower = String(currentUser && currentUser.name || '').toLowerCase();

  const isFullAdmin = roleLower.includes('administrador') || 
                      roleLower.includes('admin') || 
                      roleLower === 'medico_1' || 
                      roleLower === 'medico 1' || 
                      nameLower.includes('administrador');

  const isRecepcionista = roleLower.includes('recepcionista');

  // Si no es admin y tampoco recepcionista, acceso denegado
  if (!isFullAdmin && !isRecepcionista) {
    container.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 4rem 2rem; max-width: 600px; margin: 3rem auto; border-top: 4px solid var(--accent-danger);">
        <span style="font-size: 3rem;">⚠️</span>
        <h2 style="color: var(--accent-danger); margin-top: 1rem; font-family: var(--font-heading);">Acceso Denegado</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem; line-height: 1.5;">
          No tiene los permisos requeridos para ingresar al módulo de Administración.
          Este módulo está restringido.
        </p>
      </div>
    `;
    return;
  }

  // Si es recepcionista, forzar a estar ÚNICAMENTE en la pestaña de Caja y deshabilitar las demás
  if (isRecepcionista) {
    activeAdminTab = 'caja';
  }

  // Inicializar colecciones de administración si no existen en el estado
  state.administracion_compras = state.administracion_compras || [];
  state.administracion_contabilidad = state.administracion_contabilidad || [];
  state.administracion_rrhh = state.administracion_rrhh || [];
  state.administracion_caja = state.administracion_caja || [];
  state.administracion_bancos = state.administracion_bancos || [];

  // Filtrar de forma retroactiva partidas mock previas de Q250,000.00
  if (state.administracion_contabilidad && Array.isArray(state.administracion_contabilidad)) {
    const prevLength = state.administracion_contabilidad.length;
    state.administracion_contabilidad = state.administracion_contabilidad.filter(entry => 
      !(entry.concept && entry.concept.includes('Capital Social S.A.') && entry.totalDebits === 250000.00)
    );
    if (state.administracion_contabilidad.length !== prevLength) {
      saveAppState(state);
    }
  }

  // 2. Renderizar Estructura del Módulo
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <div>
        <h1 style="font-family: var(--font-heading); color: var(--accent-primary); margin: 0;">🏢 Panel de Administración</h1>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">Gestión financiera, contable, compras y recursos humanos (NIIF Guatemala).</p>
      </div>
      <div style="background: rgba(255,255,255,0.03); padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-color); font-size: 0.85rem; font-family: var(--font-mono);">
        Cuenta Principal: <strong style="color: var(--accent-success);">Q${parseFloat(calculateAccountBalance(state, 'Caja y Bancos')).toFixed(2)}</strong>
      </div>
    </div>

    <!-- Pestañas Principales del Módulo -->
    <div class="tabs-container" style="display: flex; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 1px; margin-bottom: 1.5rem;">
      <button class="tab-btn ${activeAdminTab === 'caja' ? 'active' : ''}" id="admin-tab-caja">💳 Facturación y Caja</button>
      <button class="tab-btn ${activeAdminTab === 'contabilidad' ? 'active' : ''}" id="admin-tab-contabilidad" ${isRecepcionista ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>📊 Contabilidad</button>
      <button class="tab-btn ${activeAdminTab === 'compras' ? 'active' : ''}" id="admin-tab-compras" ${isRecepcionista ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>🛒 Compras</button>
      <button class="tab-btn ${activeAdminTab === 'rrhh' ? 'active' : ''}" id="admin-tab-rrhh" ${isRecepcionista ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>👥 Recursos Humanos</button>
      <button class="tab-btn ${activeAdminTab === 'medicos' ? 'active' : ''}" id="admin-tab-medicos" ${isRecepcionista ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>🩺 Médicos Externos</button>
    </div>

    <div id="admin-module-content">
      <!-- Se inyecta según pestaña activa -->
    </div>
  `;

  // Bind Pestañas Principales
  document.getElementById('admin-tab-caja').addEventListener('click', () => { activeAdminTab = 'caja'; renderAdminContent(state); });
  if (!isRecepcionista) {
    document.getElementById('admin-tab-contabilidad').addEventListener('click', () => { activeAdminTab = 'contabilidad'; renderAdminContent(state); });
    document.getElementById('admin-tab-compras').addEventListener('click', () => { activeAdminTab = 'compras'; renderAdminContent(state); });
    document.getElementById('admin-tab-rrhh').addEventListener('click', () => { activeAdminTab = 'rrhh'; renderAdminContent(state); });
    document.getElementById('admin-tab-medicos').addEventListener('click', () => { activeAdminTab = 'medicos'; renderAdminContent(state); });
  }

  // Cargar contenido
  renderAdminContent(state);
}

function renderAdminContent(state) {
  const contentArea = document.getElementById('admin-module-content');
  if (!contentArea) return;

  // Actualizar clases de botones
  document.querySelectorAll('.tabs-container .tab-btn').forEach(btn => {
    if (btn.id === `admin-tab-${activeAdminTab}`) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (activeAdminTab === 'caja') {
    renderCajaTab(contentArea, state);
  } else if (activeAdminTab === 'contabilidad') {
    renderContabilidadTab(contentArea, state);
  } else if (activeAdminTab === 'compras') {
    renderComprasTab(contentArea, state);
  } else if (activeAdminTab === 'rrhh') {
    renderRrhhTab(contentArea, state);
  } else if (activeAdminTab === 'medicos') {
    renderExternalDoctorsTab(contentArea, state);
  }
}

// ==========================================
// 💳 SUBMÓDULO: FACTURACIÓN Y CAJA
// ==========================================
function renderCajaTab(container, state) {
  container.innerHTML = `
    <!-- Sub-Pestañas de Caja -->
    <div style="display: flex; gap: 10px; margin-bottom: 1.25rem; font-size: 0.85rem;">
      <button class="btn ${activeCajaSubTab === 'cobros' ? 'btn-primary' : 'btn-secondary'}" id="caja-subtab-cobros" style="padding: 6px 12px;">💸 Cobros a Pacientes</button>
      <button class="btn ${activeCajaSubTab === 'cxp' ? 'btn-primary' : 'btn-secondary'}" id="caja-subtab-cxp" style="padding: 6px 12px;">📊 Cuentas por Pagar (Proveedores)</button>
      <button class="btn ${activeCajaSubTab === 'nominas' ? 'btn-primary' : 'btn-secondary'}" id="caja-subtab-nominas" style="padding: 6px 12px;">🏦 Nóminas por Pagar</button>
    </div>

    <div id="caja-subtab-content">
      <!-- Se inyecta según sub-pestaña activa -->
    </div>
  `;

  document.getElementById('caja-subtab-cobros').addEventListener('click', () => { activeCajaSubTab = 'cobros'; renderCajaTab(container, state); });
  document.getElementById('caja-subtab-cxp').addEventListener('click', () => { activeCajaSubTab = 'cxp'; renderCajaTab(container, state); });
  document.getElementById('caja-subtab-nominas').addEventListener('click', () => { activeCajaSubTab = 'nominas'; renderCajaTab(container, state); });

  const subArea = document.getElementById('caja-subtab-content');

  if (activeCajaSubTab === 'cobros') {
    renderCajaCobros(subArea, state);
  } else if (activeCajaSubTab === 'cxp') {
    renderCajaCxp(subArea, state);
  } else if (activeCajaSubTab === 'nominas') {
    renderCajaNominas(subArea, state);
  }
}

// 1. Cobros a Pacientes
function renderCajaCobros(container, state) {
  // Obtener listado de todos los pacientes con cargos pendientes o historial
  const patientsList = state.patients || [];
  
  // Buscar si algún paciente tiene cobros pendientes
  const patientsWithPending = patientsList.filter(p => 
    p.billingHistory && p.billingHistory.some(b => b.status === 'Pendiente')
  );

  let selectedPatient = null;
  if (preSelectedPatientId) {
    selectedPatient = patientsList.find(p => p.id === preSelectedPatientId);
    preSelectedPatientId = null; // Limpiar después de usar
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 20px; align-items: start;">
      
      <!-- Columna Izquierda: Listado de Pacientes con Cargos -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 0.75rem;">Cuentas Pendientes</h3>
        
        <!-- Barra de Búsqueda de Pacientes -->
        <div style="margin-bottom: 12px;">
          <input type="text" id="caja-patient-search" placeholder="🔍 Buscar paciente..." style="
            width: 100%;
            padding: 8px 12px;
            font-size: 0.82rem;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background: var(--bg-card);
            color: var(--text-primary);
          ">
        </div>

        <div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          ${patientsWithPending.length === 0 
            ? `<div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px 0; font-size: 0.85rem;">No hay cuentas pendientes en este momento.</div>`
            : patientsWithPending.map(p => {
                const pendingCount = p.billingHistory.filter(b => b.status === 'Pendiente').length;
                return `
                  <div class="patient-caja-card" data-id="${p.id}" style="
                    padding: 10px 12px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    background: rgba(255,255,255,0.02);
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.85rem;
                    transition: all 0.2s;
                  ">
                    <div>
                      <strong>${p.name}</strong><br>
                      <span style="font-size: 0.72rem; color: var(--text-muted);">Exp: ${p.id}</span>
                    </div>
                    <span style="background: var(--accent-danger); color: white; font-size: 0.72rem; padding: 2px 8px; border-radius: 10px; font-weight: bold;">
                      ${pendingCount} pendiente(s)
                    </span>
                  </div>
                `;
              }).join('')
          }
        </div>
      </div>

      <!-- Columna Derecha: Detalle de Cuenta y Factura -->
      <div id="caja-billing-detail-area">
        <div class="glass-card" style="text-align: center; padding: 4rem 1rem; color: var(--text-muted); font-style: italic; font-size: 0.85rem;">
          👈 Selecciona un paciente de la lista para gestionar sus cobros y emitir la factura.
        </div>
      </div>

    </div>
  `;

  // Bind Búsqueda de Pacientes
  const searchInput = container.querySelector('#caja-patient-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      container.querySelectorAll('.patient-caja-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        if (text.includes(q)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  const bindPatientClicks = () => {
    container.querySelectorAll('.patient-caja-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const pObj = patientsList.find(p => p.id === id);
        
        container.querySelectorAll('.patient-caja-card').forEach(c => {
          c.style.background = 'rgba(255,255,255,0.02)';
          c.style.borderColor = 'var(--border-color)';
        });
        e.currentTarget.style.background = 'rgba(0, 242, 254, 0.05)';
        e.currentTarget.style.borderColor = 'var(--accent-primary)';

        loadPatientBillingDetails(pObj, state);
      });
    });
  };

  bindPatientClicks();

  if (selectedPatient) {
    const cardEl = container.querySelector(`.patient-caja-card[data-id="${selectedPatient.id}"]`);
    if (cardEl) {
      cardEl.click();
    } else {
      loadPatientBillingDetails(selectedPatient, state);
    }
  }
}

function loadPatientBillingDetails(patient, state) {
  const detailArea = document.getElementById('caja-billing-detail-area');
  if (!detailArea) return;

  const pendingBills = (patient.billingHistory || []).filter(b => b.status === 'Pendiente');

  if (pendingBills.length === 0) {
    detailArea.innerHTML = `
      <div class="glass-card" style="padding: 1.25rem; text-align: center;">
        <span style="font-size: 2rem;">✅</span>
        <h3 style="color: var(--accent-success); margin-top: 8px;">Cuenta Solvente</h3>
        <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 4px;">El paciente ${patient.name} no registra saldos pendientes.</p>
      </div>
    `;
    return;
  }

  state.external_doctors = state.external_doctors || [];
  
  // Inicializar médicos externos de prueba si está vacío para que el selector siempre tenga opciones
  if (state.external_doctors.length === 0) {
    state.external_doctors = [
      { id: 'ext-doc-1', name: 'Dr. Fernando Morales', specialty: 'Cardiología', colegiado: '12450', phone: '50244556677', nit: '8451240-3', billingName: 'Fernando Morales S.A.', rateType: 'fixed', rateValue: 450 },
      { id: 'ext-doc-2', name: 'Dra. Laura Méndez', specialty: 'Traumatología', colegiado: '15890', phone: '50255667788', nit: '9562310-K', billingName: 'Laura Méndez Servicios Médicos', rateType: 'percentage', rateValue: 300 }
    ];
    saveAppState(state);
  }

  // Consolidar todos los cargos de TODAS las facturas pendientes
  let tempBillItems = [];
  pendingBills.forEach(bill => {
    (bill.details || []).forEach((item, idx) => {
      tempBillItems.push({
        id: bill.id + '-' + idx,
        billId: bill.id,
        description: item.description,
        amount: parseFloat(item.amount) || 0,
        type: item.scenario ? (item.scenario === 1 ? 'interconsulta' : 'cuenta_ajena') : 'hospital',
        doctorId: item.externalDoctorId || ''
      });
    });
  });

  // Si no hay cargos preexistentes en las facturas, agregar una fila vacía
  if (tempBillItems.length === 0) {
    tempBillItems.push({
      id: 'default-' + Date.now(),
      billId: pendingBills[0].id,
      description: 'Consulta General',
      amount: 100.00,
      type: 'hospital',
      doctorId: ''
    });
  }

  detailArea.innerHTML = `
    <div class="glass-card" style="padding: 1.25rem; max-width: 100%;">
      <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 12px;">
        <span style="font-size: 0.72rem; color: var(--accent-primary); font-weight: bold; text-transform: uppercase;">PROCESAR COBRO MULTI-ESCENARIO (SPLIT BILLING)</span>
        <h3 style="margin: 4px 0 0 0; font-family: var(--font-heading); color: var(--text-primary); font-size: 1.15rem;">${patient.name}</h3>
        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: bold;">Cuentas unificadas: ${pendingBills.length} cobro(s) pendiente(s)</span>
      </div>

      <!-- Asistente de edición de cargos -->
      <div style="background: rgba(0,0,0,0.15); border-radius: 6px; padding: 12px; border: 1px dashed var(--border-color); margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 0.82rem; color: var(--accent-primary);">Edición Manual de Cargos y Honorarios:</h4>
          <button type="button" class="btn btn-secondary btn-small" id="caja-btn-add-line" style="font-size: 0.72rem; padding: 3px 8px;">➕ Agregar Cargo</button>
        </div>
        
        <div style="max-height: 250px; overflow-y: auto; margin-bottom: 10px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                <th style="padding: 4px 0;">Concepto / Descripción</th>
                <th style="padding: 4px 0; width: 130px;">Tipo Cargo</th>
                <th style="padding: 4px 0; width: 140px;">Médico Ext.</th>
                <th style="padding: 4px 0; width: 80px; text-align: right;">Importe (Q)</th>
                <th style="padding: 4px 0; text-align: center; width: 30px;"></th>
              </tr>
            </thead>
            <tbody id="caja-edit-bill-body">
              <!-- Inyectado dinámicamente -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Subtotales y Totales de Cuenta -->
      <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 0.8rem; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; color: var(--text-muted);">
          <span>Facturación Hospital (FEL):</span>
          <strong style="color: var(--text-primary);" id="caja-subtotal-hospital">Q0.00</strong>
        </div>
        <div style="display: flex; justify-content: space-between; color: var(--text-muted);">
          <span>Honorarios por Cuenta Ajena (Pasivo):</span>
          <strong style="color: var(--text-primary);" id="caja-subtotal-cuenta-ajena">Q0.00</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.95rem; border-top: 1px dashed var(--border-color); padding-top: 6px; margin-top: 4px;">
          <span>TOTAL A COBRAR EN VENTANILLA:</span>
          <strong style="color: var(--accent-secondary);" id="caja-grand-total">Q0.00</strong>
        </div>
      </div>

      <form id="caja-pay-patient-form">
        <div class="form-group" style="margin-bottom: 12px;">
          <label style="font-size: 0.8rem;">Método de Pago Recibido</label>
          <select id="caja-payment-method" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
            <option value="Efectivo">💵 Efectivo</option>
            <option value="Tarjeta">💳 Tarjeta de Crédito/Débito</option>
            <option value="Cheque">🏦 Cheque Bancario</option>
          </select>
        </div>

        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
          <div class="form-group">
            <label style="font-size: 0.8rem;">NIT de Facturación</label>
            <input type="text" id="caja-nit" value="CF" placeholder="C/F o NIT" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.8rem;">
          </div>
          <div class="form-group">
            <label style="font-size: 0.8rem;">Nombre de Facturación</label>
            <input type="text" id="caja-factura-nombre" value="${patient.name}" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.8rem;">
          </div>
        </div>

        <button type="submit" class="btn btn-success" style="width: 100%; padding: 10px; font-weight: 600; font-size: 0.9rem;">
          🛒 Procesar Split Billing y Emitir Documentos
        </button>
      </form>
    </div>
  `;

  // Helper para repoblar la tabla
  const repopulateEditTable = () => {
    const tbody = document.getElementById('caja-edit-bill-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    let subtotalHospital = 0;
    let subtotalCuentaAjena = 0;

    tempBillItems.forEach((item, idx) => {
      // Sumar a subtotales
      if (item.type === 'cuenta_ajena') {
        subtotalCuentaAjena += item.amount;
      } else {
        subtotalHospital += item.amount;
      }

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
      tr.innerHTML = `
        <td style="padding: 4px 0;">
          <input type="text" class="row-desc" value="${item.description}" style="width: 95%; padding: 4px; font-size: 0.75rem; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-card); color: var(--text-primary);">
        </td>
        <td style="padding: 4px 0;">
          <select class="row-type" style="width: 95%; padding: 4px; font-size: 0.72rem; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-card); color: var(--text-primary);">
            <option value="hospital" ${item.type === 'hospital' ? 'selected' : ''}>Gasto Hospitalario</option>
            <option value="interconsulta" ${item.type === 'interconsulta' ? 'selected' : ''}>Interconsulta (Esc. 1)</option>
            <option value="cuenta_ajena" ${item.type === 'cuenta_ajena' ? 'selected' : ''}>Cuenta Ajena (Esc. 2)</option>
          </select>
        </td>
        <td style="padding: 4px 0;">
          <select class="row-doctor" style="width: 95%; padding: 4px; font-size: 0.72rem; border: 1px solid var(--border-color); border-radius: 3px; background: #1f2937; color: #ffffff;">
            <option value="" style="background: #1f2937; color: #ffffff;">No aplica (Hospitalario)</option>
            ${state.external_doctors.map(d => `<option value="${d.id}" ${item.doctorId === d.id ? 'selected' : ''} style="background: #1f2937; color: #ffffff;">${d.name}</option>`).join('')}
          </select>
        </td>
        <td style="padding: 4px 0;">
          <input type="number" class="row-amount" value="${item.amount.toFixed(2)}" min="0.00" step="10.00" style="width: 80px; text-align: right; padding: 4px; font-size: 0.75rem; border: 1px solid var(--border-color); border-radius: 3px; background: var(--bg-card); color: var(--text-primary);">
        </td>
        <td style="padding: 4px 0; text-align: center;">
          <button type="button" class="btn-remove-row" data-idx="${idx}" style="background: none; border: none; color: var(--accent-danger); cursor: pointer;">❌</button>
        </td>
      `;

      // Eventos de cambios en tiempo real en la fila
      tr.querySelector('.row-desc').addEventListener('input', (e) => {
        item.description = e.target.value;
      });

      tr.querySelector('.row-type').addEventListener('change', (e) => {
        item.type = e.target.value;
        const docSelect = tr.querySelector('.row-doctor');
        if (item.type === 'hospital') {
          docSelect.value = '';
          item.doctorId = '';
        }
        recalculateAndRepopulate();
      });

      tr.querySelector('.row-doctor').addEventListener('change', (e) => {
        item.doctorId = e.target.value;
        const typeSelect = tr.querySelector('.row-type');
        if (item.doctorId) {
          // Si seleccionan un médico externo y el tipo de cargo era hospitalario, cambiar a interconsulta por defecto
          if (item.type === 'hospital') {
            item.type = 'interconsulta';
            typeSelect.value = 'interconsulta';
          }
        } else {
          // Si quitan el médico, cambiar a hospitalario
          item.type = 'hospital';
          typeSelect.value = 'hospital';
        }
        recalculateAndRepopulate();
      });

      tr.querySelector('.row-amount').addEventListener('change', (e) => {
        item.amount = parseFloat(e.target.value) || 0;
        recalculateAndRepopulate();
      });

      tr.querySelector('.btn-remove-row').addEventListener('click', () => {
        tempBillItems.splice(idx, 1);
        repopulateEditTable();
      });

      tbody.appendChild(tr);
    });

    // Actualizar subtotales y totales en la UI
    document.getElementById('caja-subtotal-hospital').textContent = `Q${subtotalHospital.toFixed(2)}`;
    document.getElementById('caja-subtotal-cuenta-ajena').textContent = `Q${subtotalCuentaAjena.toFixed(2)}`;
    document.getElementById('caja-grand-total').textContent = `Q${(subtotalHospital + subtotalCuentaAjena).toFixed(2)}`;
  };

  const recalculateAndRepopulate = () => {
    let subtotalHospital = 0;
    let subtotalCuentaAjena = 0;
    tempBillItems.forEach(item => {
      if (item.type === 'cuenta_ajena') subtotalCuentaAjena += item.amount;
      else subtotalHospital += item.amount;
    });
    document.getElementById('caja-subtotal-hospital').textContent = `Q${subtotalHospital.toFixed(2)}`;
    document.getElementById('caja-subtotal-cuenta-ajena').textContent = `Q${subtotalCuentaAjena.toFixed(2)}`;
    document.getElementById('caja-grand-total').textContent = `Q${(subtotalHospital + subtotalCuentaAjena).toFixed(2)}`;
  };

  // Bind botón agregar cargo
  document.getElementById('caja-btn-add-line').addEventListener('click', () => {
    tempBillItems.push({
      id: 'new-' + Date.now(),
      billId: pendingBills[0].id,
      description: 'Nuevo Servicio Médico',
      amount: 150.00,
      type: 'hospital',
      doctorId: ''
    });
    repopulateEditTable();
  });

  // Carga inicial
  repopulateEditTable();

  // Bind Submit Procesar Cobro
  document.getElementById('caja-pay-patient-form').addEventListener('submit', (e) => {
    e.preventDefault();

    if (tempBillItems.length === 0) {
      alert("La factura no tiene cargos registrados.");
      return;
    }

    // Validar selección de médicos para cargos externos
    const missingDoctor = tempBillItems.some(i => i.type !== 'hospital' && !i.doctorId);
    if (missingDoctor) {
      alert("⚠️ Debe seleccionar el médico externo responsable para todas las interconsultas y cuentas ajenas.");
      return;
    }

    const method = document.getElementById('caja-payment-method').value;
    const nit = document.getElementById('caja-nit').value;
    const billName = document.getElementById('caja-factura-nombre').value;

    const patientObj = state.patients.find(p => p.id === patient.id);
    const primaryBill = patientObj.billingHistory.find(b => b.id === pendingBills[0].id);

    // 1. Guardar cambios consolidados en la primera factura del paciente
    primaryBill.details = tempBillItems.map(i => ({
      description: i.description,
      amount: i.amount,
      externalDoctorId: i.doctorId || null,
      scenario: i.type === 'hospital' ? null : (i.type === 'interconsulta' ? 1 : 2)
    }));

    let hospitalTotal = 0;
    let doctorsTotal = 0;
    tempBillItems.forEach(i => {
      if (i.type === 'cuenta_ajena') doctorsTotal += i.amount;
      else hospitalTotal += i.amount;
    });

    const grandTotal = hospitalTotal + doctorsTotal;
    primaryBill.total = grandTotal;
    primaryBill.status = 'Pagado';
    primaryBill.paymentMethod = method;
    primaryBill.nit = nit;
    primaryBill.invoiceName = billName;
    primaryBill.invoiceNumber = 'FACT-' + Math.floor(100000 + Math.random() * 900000);

    // 2. Marcar las otras facturas pendientes como 'Pagado' vacías para liquidarlas por completo
    pendingBills.forEach(b => {
      if (b.id !== primaryBill.id) {
        const otherBill = patientObj.billingHistory.find(x => x.id === b.id);
        if (otherBill) {
          otherBill.status = 'Pagado';
          otherBill.details = [];
          otherBill.total = 0;
          otherBill.paymentMethod = method;
          otherBill.nit = nit;
          otherBill.invoiceName = billName;
          otherBill.invoiceNumber = primaryBill.invoiceNumber;
        }
      }
    });

    // 3. Generar Deudas en Cuentas por Pagar (AP) para Médicos Externos de forma automática
    state.accounts_payable = state.accounts_payable || [];
    tempBillItems.forEach(item => {
      if (item.type !== 'hospital') {
        const docObj = state.external_doctors.find(d => d.id === item.doctorId);
        const apEntry = {
          id: 'AP-EXT-' + Date.now() + '-' + Math.floor(Math.random() * 100),
          doctorId: item.doctorId,
          doctorName: docObj.name,
          nit: docObj.nit,
          dateCreated: new Date().toISOString(),
          concept: item.type === 'interconsulta' 
            ? `Interconsulta - Paciente: ${patient.name} (${item.description})`
            : `Cobro por Cuenta Ajena - Paciente: ${patient.name} (${item.description})`,
          patientId: patient.id,
          patientName: patient.name,
          amount: item.amount,
          status: 'Pendiente',
          scenario: item.type === 'interconsulta' ? 1 : 2,
          paymentRef: ''
        };
        state.accounts_payable.unshift(apEntry);
      }
    });

    // 4. Generar Partida Contable en Libro Diario (NIIF Guatemala) - Sin descuentos ni retenciones
    const hospitalBeforeTax = hospitalTotal / 1.12;
    const ivaDebit = hospitalTotal - hospitalBeforeTax;

    const journalEntry = {
      id: 'PART-COBRO-SPLIT-' + Date.now(),
      date: new Date().toISOString(),
      concept: `Cobro Hospitalario y Honorarios Cuenta Ajena - Fac Hospital: ${primaryBill.invoiceNumber} (Paciente: ${patient.name})`,
      totalDebits: grandTotal,
      totalCredits: grandTotal,
      details: [
        { account: 'Caja y Bancos', type: 'Debe', amount: grandTotal }
      ]
    };

    if (hospitalBeforeTax > 0) {
      journalEntry.details.push({ account: 'Ingresos Hospitalarios', type: 'Haber', amount: hospitalBeforeTax });
      journalEntry.details.push({ account: 'IVA por Pagar (Débito Fiscal)', type: 'Haber', amount: ivaDebit });
    }

    if (doctorsTotal > 0) {
      journalEntry.details.push({ account: 'Acreedores Varios', type: 'Haber', amount: doctorsTotal });
    }

    state.administracion_contabilidad = state.administracion_contabilidad || [];
    state.administracion_contabilidad.unshift(journalEntry);

    saveAppState(state);

    alert(`✅ Cobro unificado de ${pendingBills.length} cuentas procesado con éxito.
- Factura FEL Hospitalaria emitida: ${primaryBill.invoiceNumber} por Q${hospitalTotal.toFixed(2)}.
- Recibos por Honorarios por Cuenta Ajena: Q${doctorsTotal.toFixed(2)}.
- Registradas las deudas correspondientes en Cuentas por Pagar (AP) a los médicos.`);
    
    // Recargar vista
    renderAdministracion(document.getElementById('module-container'));
  });
}

// 2. Cuentas por Pagar (Proveedores)
function renderCajaCxp(container, state) {
  const pendingCxp = (state.administracion_caja || []).filter(c => c.type === 'cuentas_por_pagar' && c.status === 'Pendiente');

  container.innerHTML = `
    <div class="glass-card" style="padding: 1.25rem;">
      <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem;">Cuentas por Pagar a Proveedores (Compras al Crédito)</h3>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
              <th style="padding: 8px;">Fecha</th>
              <th style="padding: 8px;">Detalle / Concepto</th>
              <th style="padding: 8px; text-align: right;">Total</th>
              <th style="padding: 8px; text-align: center;">Estado</th>
              <th style="padding: 8px; text-align: center;">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${pendingCxp.length === 0 
              ? `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted); font-style: italic;">No hay cuentas por pagar pendientes.</td></tr>`
              : pendingCxp.map(c => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 8px;">${new Date(c.date).toLocaleDateString('es-GT')}</td>
                    <td style="padding: 8px;"><strong>${c.concept}</strong></td>
                    <td style="padding: 8px; text-align: right; font-weight: bold; color: var(--accent-danger);">Q${parseFloat(c.amount).toFixed(2)}</td>
                    <td style="padding: 8px; text-align: center;"><span style="background: rgba(239,68,68,0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: bold;">Pendiente</span></td>
                    <td style="padding: 8px; text-align: center;">
                      <button class="btn btn-success btn-small btn-pay-cxp" data-id="${c.id}" style="font-size: 0.75rem; padding: 4px 8px; background: var(--accent-success); border: none;">Pagar Factura</button>
                    </td>
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind Pay Button clicks
  container.querySelectorAll('.btn-pay-cxp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = state.administracion_caja.find(c => c.id === id);

      if (confirm(`¿Confirma el pago de la cuenta de proveedores por valor de Q${parseFloat(item.amount).toFixed(2)}?`)) {
        // 1. Cambiar estado a Pagado
        item.status = 'Pagado';
        item.paymentDate = new Date().toISOString();

        // 2. Registrar Partida de Pago (Debe: Cuentas por Pagar / Haber: Caja y Bancos)
        const journalEntry = {
          id: 'PART-PAGO-CXP-' + Date.now(),
          date: new Date().toISOString(),
          concept: `Pago de Cuenta por Pagar - ${item.concept}`,
          totalDebits: item.amount,
          totalCredits: item.amount,
          details: [
            { account: 'Cuentas por Pagar (Proveedores)', type: 'Debe', amount: item.amount },
            { account: 'Caja y Bancos', type: 'Haber', amount: item.amount }
          ]
        };

        state.administracion_contabilidad.unshift(journalEntry);
        saveAppState(state);

        alert("✅ Pago registrado con éxito y partida contable de egreso generada.");
        renderCajaTab(document.getElementById('caja-subtab-content').parentNode, state);
      }
    });
  });
}

// 3. Nóminas por Pagar
function renderCajaNominas(container, state) {
  const pendingPayroll = (state.administracion_caja || []).filter(c => c.type === 'nomina' && c.status === 'Pendiente');

  container.innerHTML = `
    <div class="glass-card" style="padding: 1.25rem;">
      <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem;">Nóminas Mensuales por Liquidar (Sueldo Neto de Empleados)</h3>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
              <th style="padding: 8px;">Fecha Provisión</th>
              <th style="padding: 8px;">Concepto / Empleado</th>
              <th style="padding: 8px; text-align: right;">Sueldo Neto</th>
              <th style="padding: 8px; text-align: center;">Estado</th>
              <th style="padding: 8px; text-align: center;">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${pendingPayroll.length === 0 
              ? `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted); font-style: italic;">No hay nóminas pendientes de pago.</td></tr>`
              : pendingPayroll.map(p => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 8px;">${new Date(p.date).toLocaleDateString('es-GT')}</td>
                    <td style="padding: 8px;"><strong>${p.concept}</strong></td>
                    <td style="padding: 8px; text-align: right; font-weight: bold; color: var(--accent-primary);">Q${parseFloat(p.amount).toFixed(2)}</td>
                    <td style="padding: 8px; text-align: center;"><span style="background: rgba(239,68,68,0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: bold;">Pendiente</span></td>
                    <td style="padding: 8px; text-align: center;">
                      <button class="btn btn-primary btn-small btn-pay-nomina" data-id="${p.id}" style="font-size: 0.75rem; padding: 4px 8px; background: var(--accent-primary); border: none;">Emitir Cheque</button>
                    </td>
                  </tr>
                `).join('')
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind Pay Nomina clicks
  container.querySelectorAll('.btn-pay-nomina').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = state.administracion_caja.find(c => c.id === id);

      if (confirm(`¿Autoriza la emisión de cheque y transferencia para liquidar el sueldo neto por valor de Q${parseFloat(item.amount).toFixed(2)}?`)) {
        // 1. Cambiar estado a Pagado
        item.status = 'Pagado';
        item.paymentDate = new Date().toISOString();

        // 2. Registrar Partida de Pago de Sueldo (Debe: Cuentas por Pagar Nómina / Haber: Caja y Bancos)
        const journalEntry = {
          id: 'PART-PAGO-NOMINA-' + Date.now(),
          date: new Date().toISOString(),
          concept: `Emisión de Cheque y Transferencia Sueldo - ${item.concept}`,
          totalDebits: item.amount,
          totalCredits: item.amount,
          details: [
            { account: 'Cuentas por Pagar (Nómina Neta)', type: 'Debe', amount: item.amount },
            { account: 'Caja y Bancos', type: 'Haber', amount: item.amount }
          ]
        };

        state.administracion_contabilidad.unshift(journalEntry);
        saveAppState(state);

        alert("✅ Sueldo pagado exitosamente. Partida de egreso agregada al Libro Diario.");
        renderCajaTab(document.getElementById('caja-subtab-content').parentNode, state);
      }
    });
  });
}

// ==========================================
// 📊 SUBMÓDULO: CONTABILIDAD (NIIF GUATEMALA)
// ==========================================
function renderContabilidadTab(container, state) {
  // Calcular saldos de cuentas principales
  const balanceCaja = calculateAccountBalance(state, 'Caja y Bancos');
  const balanceInventario = calculateAccountBalance(state, 'Inventario de Mercaderías');
  const balanceCxp = calculateAccountBalance(state, 'Cuentas por Pagar (Proveedores)');
  const balanceCxpNomina = calculateAccountBalance(state, 'Cuentas por Pagar (Nómina Neta)');
  const balanceCapital = calculateAccountBalance(state, 'Capital Autorizado');
  const balanceIgssLaboral = calculateAccountBalance(state, 'Retenciones por Pagar (IGSS Laboral)');
  const balanceIgssPatronal = calculateAccountBalance(state, 'Retenciones por Pagar (IGSS Patronal)');
  const balanceIngresosServicios = calculateAccountBalance(state, 'Ingresos por Servicios Médicos');
  const balanceIngresosMeds = calculateAccountBalance(state, 'Ingresos por Venta de Medicamentos');
  const balanceGastoSalarios = calculateAccountBalance(state, 'Gastos de Administración (Sueldos)');
  const balanceGastoBono = calculateAccountBalance(state, 'Gastos de Administración (Bonificación Incentivo)');
  const balanceGastoIgss = calculateAccountBalance(state, 'Gastos de Administración (Cuota Patronal IGSS)');
  const balanceIvaPagar = calculateAccountBalance(state, 'IVA por Pagar (Débito Fiscal)');
  const balanceIvaCobrar = calculateAccountBalance(state, 'IVA por Cobrar (Crédito Fiscal)');

  container.innerHTML = `
    <!-- Tarjetas de Balance General Rápido -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 1.5rem;">
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid var(--accent-primary);">
        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase;">Activos (Caja/Inventario)</span>
        <h3 style="margin: 4px 0 0 0; color: var(--accent-primary); font-size: 1.3rem;">Q${parseFloat(balanceCaja + balanceInventario + balanceIvaCobrar).toFixed(2)}</h3>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid var(--accent-danger);">
        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase;">Pasivos (Deudas/Retenciones)</span>
        <h3 style="margin: 4px 0 0 0; color: #ef4444; font-size: 1.3rem;">Q${parseFloat(balanceCxp + balanceCxpNomina + balanceIgssLaboral + balanceIgssPatronal + balanceIvaPagar).toFixed(2)}</h3>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid var(--accent-secondary);">
        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase;">Ingresos Totales</span>
        <h3 style="margin: 4px 0 0 0; color: var(--accent-secondary); font-size: 1.3rem;">Q${parseFloat(balanceIngresosServicios + balanceIngresosMeds).toFixed(2)}</h3>
      </div>
      <div class="glass-card" style="padding: 1rem; border-left: 4px solid #f59e0b;">
        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: bold; text-transform: uppercase;">Gastos Acumulados</span>
        <h3 style="margin: 4px 0 0 0; color: #f59e0b; font-size: 1.3rem;">Q${parseFloat(balanceGastoSalarios + balanceGastoBono + balanceGastoIgss).toFixed(2)}</h3>
      </div>
    </div>

    <!-- Sub-Tabs de Contabilidad -->
    <div style="display: flex; gap: 10px; margin-bottom: 1.25rem; font-size: 0.85rem;">
      <button class="btn ${activeContabilidadSubTab === 'diario' ? 'btn-primary' : 'btn-secondary'}" id="contabilidad-subtab-diario" style="padding: 6px 12px;">📖 Libro Diario</button>
      <button class="btn ${activeContabilidadSubTab === 'bancos' ? 'btn-primary' : 'btn-secondary'}" id="contabilidad-subtab-bancos" style="padding: 6px 12px;">🏦 Bancos y Cuentas</button>
      <button class="btn ${activeContabilidadSubTab === 'impuestos' ? 'btn-primary' : 'btn-secondary'}" id="contabilidad-subtab-impuestos" style="padding: 6px 12px;">🇬🇹 Impuestos e IGSS (SAT)</button>
    </div>

    <div id="contabilidad-subtab-content">
      <!-- Se inyecta -->
    </div>
  `;

  document.getElementById('contabilidad-subtab-diario').addEventListener('click', () => { activeContabilidadSubTab = 'diario'; renderContabilidadTab(container, state); });
  document.getElementById('contabilidad-subtab-bancos').addEventListener('click', () => { activeContabilidadSubTab = 'bancos'; renderContabilidadTab(container, state); });
  document.getElementById('contabilidad-subtab-impuestos').addEventListener('click', () => { activeContabilidadSubTab = 'impuestos'; renderContabilidadTab(container, state); });

  const subArea = document.getElementById('contabilidad-subtab-content');

  if (activeContabilidadSubTab === 'diario') {
    renderLibroDiario(subArea, state);
  } else if (activeContabilidadSubTab === 'bancos') {
    renderBancosConciliacion(subArea, state);
  } else if (activeContabilidadSubTab === 'impuestos') {
    renderImpuestosSAT(subArea, state);
  }
}

// Libro Diario
function renderLibroDiario(container, state) {
  const entries = state.administracion_contabilidad || [];

  container.innerHTML = `
    <div class="glass-card" style="padding: 1.25rem;">
      <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem;">Libro Diario de Partidas Dobles (NIIF)</h3>

      <div style="max-height: 450px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
        ${entries.length === 0 
          ? `<div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px 0;">No hay partidas contables registradas aún.</div>`
          : entries.map(e => `
              <div style="border: 1px solid var(--border-color); border-radius: 6px; background: rgba(255,255,255,0.01); padding: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 6px; margin-bottom: 8px;">
                  <span style="color: var(--accent-primary); font-weight: bold;">📝 Partida Ref: ${e.id}</span>
                  <span style="color: var(--text-muted); font-family: var(--font-mono);">${new Date(e.date).toLocaleString('es-GT')}</span>
                </div>
                
                <p style="margin: 0 0 10px 0; font-size: 0.85rem; font-weight: bold; color: var(--text-primary);">${e.concept}</p>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 8px;">
                  <thead>
                    <tr style="color: var(--text-muted); border-bottom: 1px dashed var(--border-color); text-align: left;">
                      <th style="padding: 4px 0;">Cuenta Contable</th>
                      <th style="padding: 4px 0; text-align: right; width: 100px;">Debe</th>
                      <th style="padding: 4px 0; text-align: right; width: 100px;">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${e.details.map(d => `
                      <tr>
                        <td style="padding: 4px 0; ${d.type === 'Haber' ? 'padding-left: 20px; color: var(--text-muted);' : 'color: var(--text-primary);'}">
                          ${d.type === 'Haber' ? '➡️ ' : ''}${d.account}
                        </td>
                        <td style="padding: 4px 0; text-align: right; font-family: var(--font-mono);">
                          ${d.type === 'Debe' ? `Q${parseFloat(d.amount).toFixed(2)}` : ''}
                        </td>
                        <td style="padding: 4px 0; text-align: right; font-family: var(--font-mono);">
                          ${d.type === 'Haber' ? `Q${parseFloat(d.amount).toFixed(2)}` : ''}
                        </td>
                      </tr>
                    `).join('')}
                    <tr style="border-top: 1px double var(--border-color); font-weight: bold;">
                      <td style="padding: 6px 0; text-align: right;">Totales de Partida:</td>
                      <td style="padding: 6px 0; text-align: right; font-family: var(--font-mono); color: var(--accent-secondary);">Q${parseFloat(e.totalDebits).toFixed(2)}</td>
                      <td style="padding: 6px 0; text-align: right; font-family: var(--font-mono); color: var(--accent-secondary);">Q${parseFloat(e.totalCredits).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `).join('')
        }
      </div>
    </div>
  `;
}

// Impuestos SAT e IGSS
function renderImpuestosSAT(container, state) {
  // Cuentas de IVA
  const ivaPagar = calculateAccountBalance(state, 'IVA por Pagar (Débito Fiscal)');
  const ivaCobrar = calculateAccountBalance(state, 'IVA por Cobrar (Crédito Fiscal)');
  const ivaNeto = ivaPagar - ivaCobrar;

  // Cuentas de Ingresos y Gastos para Proyección ISR/ISO
  const ingresosTotales = calculateAccountBalance(state, 'Ingresos por Servicios Médicos') + calculateAccountBalance(state, 'Ingresos por Venta de Medicamentos');
  
  // Proyección de ISR (Régimen Opcional Simplificado de Guatemala)
  // 5% sobre ingresos gravados menores a Q30,000 mensuales, y 7% sobre el excedente (con importe fijo de Q1,500)
  let isrProyectado = 0;
  if (ingresosTotales > 0) {
    if (ingresosTotales <= 30000) {
      isrProyectado = ingresosTotales * 0.05;
    } else {
      isrProyectado = 1500 + (ingresosTotales - 30000) * 0.07;
    }
  }

  // Impuesto de Solidaridad (ISO - 1% sobre ingresos brutos)
  const isoProyectado = ingresosTotales * 0.01;

  // IGSS Retenciones
  const igssLaboral = calculateAccountBalance(state, 'Retenciones por Pagar (IGSS Laboral)');
  const igssPatronal = calculateAccountBalance(state, 'Retenciones por Pagar (IGSS Patronal)');

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      
      <!-- Impuestos SAT (IVA, ISR, ISO) -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem; border-bottom: 2px solid var(--accent-primary); padding-bottom: 6px;">Proyección de Impuestos SAT (Guatemala)</h3>
        
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <!-- IVA -->
          <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong>Impuesto al Valor Agregado (IVA)</strong>
              <span style="font-size: 0.72rem; font-weight: bold; background: rgba(0,242,254,0.1); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px;">Mensual (12%)</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 4px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px; margin-bottom: 6px;">
              <span>IVA Débito Fiscal (Cobrado a Pacientes):</span>
              <span style="text-align: right; color: var(--text-primary);">Q${ivaPagar.toFixed(2)}</span>
              <span>IVA Crédito Fiscal (Pagado en Compras):</span>
              <span style="text-align: right; color: var(--text-primary);">-Q${ivaCobrar.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.85rem;">
              <span>IVA Neto a Pagar a SAT:</span>
              <span style="color: ${ivaNeto >= 0 ? 'var(--accent-secondary)' : 'var(--accent-success)'};">
                ${ivaNeto >= 0 ? `Q${ivaNeto.toFixed(2)}` : `Q${Math.abs(ivaNeto).toFixed(2)} (Crédito a Favor)`}
              </span>
            </div>
          </div>

          <!-- ISR -->
          <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong>Impuesto Sobre la Renta (ISR)</strong>
              <span style="font-size: 0.72rem; font-weight: bold; background: rgba(245,158,11,0.1); color: #f59e0b; padding: 2px 6px; border-radius: 4px;">Régimen Simplificado</span>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 8px 0;">Cálculo estimado en base a ingresos de servicios y venta de medicamentos (5% sobre los primeros Q30k, 7% sobre el excedente).</p>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.85rem; border-top: 1px dashed var(--border-color); padding-top: 6px;">
              <span>ISR Estimado a Pagar SAT:</span>
              <span style="color: #f59e0b;">Q${isrProyectado.toFixed(2)}</span>
            </div>
          </div>

          <!-- ISO -->
          <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong>Impuesto de Solidaridad (ISO)</strong>
              <span style="font-size: 0.72rem; font-weight: bold; background: rgba(239,68,68,0.1); color: #ef4444; padding: 2px 6px; border-radius: 4px;">Mensual (1%)</span>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 8px 0;">Estimación correspondiente al 1% de los ingresos acumulados del periodo fiscal actual.</p>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.85rem; border-top: 1px dashed var(--border-color); padding-top: 6px;">
              <span>ISO Estimado a Pagar SAT:</span>
              <span style="color: #ef4444;">Q${isoProyectado.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Seguridad Social (IGSS) -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem; border-bottom: 2px solid var(--accent-primary); padding-bottom: 6px;">Cuota de Seguridad Social (IGSS)</h3>
        
        <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; height: calc(100% - 40px); box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <strong>Planilla de Previsión Social IGSS</strong>
              <span style="font-size: 0.72rem; font-weight: bold; background: rgba(34,197,94,0.1); color: #22c55e; padding: 2px 6px; border-radius: 4px;">Cuota Mensual</span>
            </div>
            
            <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
                <span>IGSS Retención Laboral (4.83%):</span>
                <strong style="color: var(--text-primary);">Q${igssLaboral.toFixed(2)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
                <span>IGSS Provisión Patronal (10.67%):</span>
                <strong style="color: var(--text-primary);">Q${igssPatronal.toFixed(2)}</strong>
              </div>
            </div>
            
            <p style="font-size: 0.72rem; color: var(--text-muted); line-height: 1.4; margin-top: 15px; font-style: italic;">
              * La retención laboral del 4.83% es descontada automáticamente del sueldo neto del empleado. La cuota patronal del 10.67% corre a cuenta de la clínica hospitalaria.
            </p>
          </div>

          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.95rem; background: rgba(0,0,0,0.15); padding: 12px; border-radius: 4px; border: 1px solid var(--border-color); margin-top: 20px;">
            <span>Total a Liquidar IGSS:</span>
            <span style="color: #22c55e;">Q${(igssLaboral + igssPatronal).toFixed(2)}</span>
          </div>
        </div>
      </div>

    </div>
  `;
}

function calculateAccountBalance(state, accountName) {
  let balance = 0;
  const entries = state.administracion_contabilidad || [];

  entries.forEach(e => {
    (e.details || []).forEach(d => {
      if (d.account === accountName) {
        if (d.type === 'Debe') {
          balance += parseFloat(d.amount) || 0;
        } else if (d.type === 'Haber') {
          balance -= parseFloat(d.amount) || 0;
        }
      }
    });
  });

  // Las cuentas de pasivos, patrimonio e ingresos tienen naturaleza acreedora (Haber aumenta, Debe disminuye)
  // Multiplicamos por -1 para mostrarlas con saldo positivo
  const creditNatureAccounts = [
    'Capital Autorizado',
    'Cuentas por Pagar (Proveedores)',
    'Cuentas por Pagar (Nómina Neta)',
    'Retenciones por Pagar (IGSS Laboral)',
    'Retenciones por Pagar (IGSS Patronal)',
    'IVA por Pagar (Débito Fiscal)',
    'Ingresos por Servicios Médicos',
    'Ingresos por Venta de Medicamentos'
  ];

  if (creditNatureAccounts.includes(accountName)) {
    balance = balance * -1;
  }

  return Math.max(0, balance);
}

// ==========================================
// 🛒 SUBMÓDULO: COMPRAS
// ==========================================
function renderComprasTab(container, state) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; align-items: start;">
      
      <!-- Columna Izquierda: Formulario de Registro de Compras -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem;">Registrar Factura de Compra</h3>
        
        <form id="admin-purchase-form" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="form-row" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 10px;">
            <div class="form-group">
              <label>Proveedor</label>
              <input type="text" id="p-provider" required placeholder="Nombre de la distribuidora o farmacéutica">
            </div>
            <div class="form-group">
              <label>No. Factura</label>
              <input type="text" id="p-invoice-num" required placeholder="E-XXXXXXX">
            </div>
          </div>

          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label>Fecha de Compra</label>
              <input type="date" id="p-date" required value="${new Date().toISOString().substring(0, 10)}">
            </div>
            <div class="form-group">
              <label>Tipo de Compra</label>
              <select id="p-type" required>
                <option value="contado">💵 Contado (Pago inmediato)</option>
                <option value="credito">💳 Crédito (Cuenta por pagar)</option>
              </select>
            </div>
          </div>

          <!-- Asistente para agregar artículos a la factura -->
          <div style="border: 1px dashed var(--border-color); border-radius: 6px; padding: 12px; background: rgba(0,0,0,0.15);">
            <h4 style="margin: 0 0 8px 0; font-size: 0.82rem; color: var(--accent-primary);">Detalle de Artículos / Insumos:</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; gap: 8px;">
                <input type="text" id="p-item-name" placeholder="Nombre del medicamento o material" style="flex: 2; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.8rem;">
                <select id="p-item-category" style="flex: 1.2; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.8rem;">
                  <option value="Medicamentos">💊 Medicamentos</option>
                  <option value="Material Médico Quirúrgico">🩹 Material Médico</option>
                  <option value="Otros">📦 Otros Gastos</option>
                </select>
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="number" id="p-item-qty" placeholder="Cant" min="1" step="1" value="10" style="width: 70px; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.8rem;">
                <input type="number" id="p-item-price" placeholder="P. Unit" min="0.01" step="0.01" value="15.00" style="flex: 1; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.8rem;">
                <button type="button" class="btn btn-secondary btn-small" id="btn-add-purchase-item" style="font-size: 0.75rem; padding: 6px 12px;">➕ Añadir</button>
              </div>
            </div>

            <!-- Listado temporal de artículos añadidos -->
            <div id="p-temp-items-list" style="margin-top: 10px; max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem;">
              <!-- Se inyectan -->
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; border: 1px solid var(--border-color);">
            <span>TOTAL FACTURADO:</span>
            <strong id="purchase-grand-total" style="color: var(--accent-secondary); font-size: 1.15rem;">Q0.00</strong>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; padding: 10px; font-weight: 600; font-size: 0.9rem;">
            📥 Registrar Compra
          </button>
        </form>
      </div>

      <!-- Columna Derecha: Listado Histórico de Compras -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem;">Historial de Compras</h3>
        <div style="max-height: 440px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          ${(state.administracion_compras || []).length === 0 
            ? `<div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px 0; font-size: 0.85rem;">No hay registros de compras.</div>`
            : state.administracion_compras.map(p => `
                <div style="border: 1px solid var(--border-color); border-radius: 6px; background: rgba(255,255,255,0.01); padding: 10px; font-size: 0.82rem;">
                  <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 4px; margin-bottom: 4px; font-size: 0.72rem; color: var(--text-muted);">
                    <span>Fac: ${p.invoiceNumber} | ${p.type.toUpperCase()}</span>
                    <span>📅 ${new Date(p.date).toLocaleDateString('es-GT')}</span>
                  </div>
                  <strong>${p.provider}</strong><br>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">${p.items.map(i => `${i.name} (x${i.qty})`).join(', ')}</span>
                  <div style="text-align: right; font-weight: bold; color: var(--accent-secondary); margin-top: 4px; font-size: 0.85rem;">Q${parseFloat(p.total).toFixed(2)}</div>
                </div>
              `).join('')
          }
        </div>
      </div>

    </div>
  `;

  // Bind Item Adding Action
  const btnAddItem = document.getElementById('btn-add-purchase-item');
  const itemNameInput = document.getElementById('p-item-name');
  const itemCatInput = document.getElementById('p-item-category');
  const itemQtyInput = document.getElementById('p-item-qty');
  const itemPriceInput = document.getElementById('p-item-price');
  const tempContainer = document.getElementById('p-temp-items-list');
  const grandTotalText = document.getElementById('purchase-grand-total');

  const updatePurchaseItemsUi = () => {
    tempContainer.innerHTML = '';
    let total = 0;
    
    tempPurchaseItems.forEach((item, idx) => {
      const subtotal = item.qty * item.price;
      total += subtotal;

      const itemDiv = document.createElement('div');
      itemDiv.style.display = 'flex';
      itemDiv.style.justify = 'space-between';
      itemDiv.style.alignItems = 'center';
      itemDiv.style.background = 'rgba(255,255,255,0.02)';
      itemDiv.style.padding = '4px 8px';
      itemDiv.style.borderRadius = '4px';
      itemDiv.style.border = '1px solid var(--border-color)';
      itemDiv.innerHTML = `
        <span><strong>${item.name}</strong> (${item.category}) | ${item.qty} uds x Q${item.price.toFixed(2)}</span>
        <div>
          <span style="font-weight: bold; margin-right: 8px;">Q${subtotal.toFixed(2)}</span>
          <button type="button" class="btn-remove-p-item" data-idx="${idx}" style="background: none; border: none; color: var(--accent-danger); cursor: pointer; font-weight: bold; font-size: 0.85rem;">❌</button>
        </div>
      `;

      itemDiv.querySelector('.btn-remove-p-item').addEventListener('click', () => {
        tempPurchaseItems.splice(idx, 1);
        updatePurchaseItemsUi();
      });

      tempContainer.appendChild(itemDiv);
    });

    grandTotalText.textContent = `Q${total.toFixed(2)}`;
  };

  btnAddItem.addEventListener('click', () => {
    const name = itemNameInput.value.trim();
    const cat = itemCatInput.value;
    const qty = parseInt(itemQtyInput.value) || 0;
    const price = parseFloat(itemPriceInput.value) || 0;

    if (!name) {
      alert("Ingrese el nombre del artículo.");
      return;
    }
    if (qty <= 0 || price <= 0) {
      alert("Cantidad y precio unitario deben ser mayores a cero.");
      return;
    }

    tempPurchaseItems.push({
      id: 'it-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: name,
      category: cat,
      qty: qty,
      price: price
    });

    itemNameInput.value = '';
    itemQtyInput.value = '10';
    itemPriceInput.value = '15.00';
    itemNameInput.focus();

    updatePurchaseItemsUi();
  });

  // Bind Submit Purchase Form
  document.getElementById('admin-purchase-form').addEventListener('submit', (e) => {
    e.preventDefault();

    if (tempPurchaseItems.length === 0) {
      alert("Debe agregar al menos un artículo a la factura de compra.");
      return;
    }

    const provider = document.getElementById('p-provider').value;
    const invoiceNum = document.getElementById('p-invoice-num').value;
    const date = document.getElementById('p-date').value;
    const type = document.getElementById('p-type').value;

    let total = 0;
    tempPurchaseItems.forEach(i => total += (i.qty * i.price));

    const newPurchase = {
      id: 'PUR-' + Date.now(),
      provider: provider,
      invoiceNumber: invoiceNum,
      date: date,
      type: type,
      items: tempPurchaseItems,
      total: total
    };

    state.administracion_compras.unshift(newPurchase);

    // Ejecutar Cloud Function local para integración en segundo plano
    const stockUpdated = simulateOnPurchaseCreated(newPurchase, state);

    saveAppState(state);

    alert(`✅ Factura de compra registrada con éxito. Se actualizó el Libro Diario y ${stockUpdated ? 'el stock en Farmacia.' : 'el inventario local.'}`);
    
    // Limpiar variables temporales y recargar pestaña
    tempPurchaseItems = [];
    renderComprasTab(container, state);
  });
}

// ==========================================
// 👥 SUBMÓDULO: RECURSOS HUMANOS (RRHH)
// ==========================================
function renderRrhhTab(container, state) {
  container.innerHTML = `
    <!-- Sub-Pestañas de RRHH -->
    <div style="display: flex; gap: 10px; margin-bottom: 1.25rem; font-size: 0.85rem;">
      <button class="btn ${activeRrhhSubTab === 'empleados' ? 'btn-primary' : 'btn-secondary'}" id="rrhh-subtab-empleados" style="padding: 6px 12px;">👔 Gestión de Empleados</button>
      <button class="btn ${activeRrhhSubTab === 'nomina' ? 'btn-primary' : 'btn-secondary'}" id="rrhh-subtab-nomina" style="padding: 6px 12px;">🏦 Nómina Mensual</button>
    </div>

    <div id="rrhh-subtab-content">
      <!-- Se inyecta -->
    </div>
  `;

  document.getElementById('rrhh-subtab-empleados').addEventListener('click', () => { activeRrhhSubTab = 'empleados'; renderRrhhTab(container, state); });
  document.getElementById('rrhh-subtab-nomina').addEventListener('click', () => { activeRrhhSubTab = 'nomina'; renderRrhhTab(container, state); });

  const subArea = document.getElementById('rrhh-subtab-content');

  if (activeRrhhSubTab === 'empleados') {
    renderRrhhEmpleados(subArea, state);
  } else if (activeRrhhSubTab === 'nomina') {
    renderRrhhNomina(subArea, state);
  }
}

// Empleados y Recomendador de Contrataciones
function renderRrhhEmpleados(container, state) {
  // Calcular balance actual en Caja y Bancos para alimentar el algoritmo recomendador
  const cashBalance = calculateAccountBalance(state, 'Caja y Bancos');
  
  // Calcular promedios de utilidad neta para validación financiera extra (ingresos vs gastos contables)
  const totalIncome = calculateAccountBalance(state, 'Ingresos por Servicios Médicos') + calculateAccountBalance(state, 'Ingresos por Venta de Medicamentos');
  const totalExpense = calculateAccountBalance(state, 'Gastos de Administración (Sueldos)') + calculateAccountBalance(state, 'Gastos de Administración (Bonificación Incentivo)') + calculateAccountBalance(state, 'Gastos de Administración (Cuota Patronal IGSS)');
  const utilityBalance = totalIncome - totalExpense;

  const isEditing = editingEmployeeId !== null;
  const editingEmp = isEditing ? (state.administracion_employees || []).find(e => e.id === editingEmployeeId) : null;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
      
      <!-- Registrar Empleado -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem;">${isEditing ? 'Modificar Empleado' : 'Registrar Nuevo Empleado'}</h3>
        
        <form id="admin-employee-form" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="form-group">
            <label>Nombre Completo</label>
            <input type="text" id="e-name" required placeholder="Nombre del empleado" value="${editingEmp ? editingEmp.name : ''}">
          </div>

          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label>Puesto</label>
              <input type="text" id="e-position" required placeholder="Enfermero, Analista, Recepcionista" value="${editingEmp ? editingEmp.position : ''}">
            </div>
            <div class="form-group">
              <label>Especialidad</label>
              <input type="text" id="e-specialty" placeholder="Pediatría, General, Contabilidad" value="${editingEmp ? editingEmp.specialty || '' : ''}">
            </div>
          </div>

          <div class="form-row" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 10px;">
            <div class="form-group">
              <label>Salario Propuesto Mensual</label>
              <input type="number" id="e-salary" required min="0.01" step="any" value="${editingEmp ? editingEmp.salary : '4500.00'}">
            </div>
            <div class="form-group">
              <label>Fecha de Contratación</label>
              <input type="date" id="e-date" required value="${editingEmp && editingEmp.hireDate ? editingEmp.hireDate.substring(0, 10) : new Date().toISOString().substring(0, 10)}">
            </div>
          </div>

          <!-- Widget Algoritmo Recomendador de Contratación -->
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px;">
            <h4 style="margin: 0 0 8px 0; font-size: 0.82rem; color: var(--text-muted);">Recomendador Financiero de Viabilidad</h4>
            
            <div style="font-size: 0.78rem; color: var(--text-muted); display: grid; grid-template-columns: 1.4fr 0.6fr; gap: 6px; margin-bottom: 8px;">
              <span>Salario Base Propuesto:</span>
              <span style="text-align: right;" id="rec-base-salary">Q0.00</span>
              <span style="font-weight: bold; color: var(--text-primary);">Costo Total de Contratación:</span>
              <span style="text-align: right; font-weight: bold; color: var(--text-primary);" id="rec-total-cost">Q0.00</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 8px;">
              <span style="font-size: 0.82rem; font-weight: 500;">Estado de Viabilidad:</span>
              <span id="rec-verdict-badge" style="padding: 4px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: bold; color: white;">Calculando...</span>
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button type="submit" class="btn btn-primary" style="flex: 1; padding: 10px; font-weight: 600; font-size: 0.9rem;">
              ${isEditing ? '💾 Guardar Cambios' : '📝 Contratar Empleado'}
            </button>
            ${isEditing ? `
              <button type="button" id="btn-cancel-employee-edit" class="btn btn-secondary" style="padding: 10px; font-weight: 600; font-size: 0.9rem;">
                Cancelar
              </button>
            ` : ''}
          </div>
        </form>
      </div>

      <!-- Listado de Empleados con Incidencias -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem;">Colaboradores y Gestión de Incidencias</h3>
        
        <div style="max-height: 460px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          ${(state.administracion_employees || []).length === 0 
            ? `<div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px 0; font-size: 0.85rem;">No se registran colaboradores activos.</div>`
            : state.administracion_employees.map(e => `
                <div style="border: 1px solid var(--border-color); border-radius: 6px; background: rgba(255,255,255,0.01); padding: 10px; font-size: 0.82rem; display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <strong style="font-size: 0.88rem; color: var(--text-primary);">${e.name}</strong><br>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${e.position} | Sueldo: Q${parseFloat(e.salary).toFixed(2)}</span>
                    <div style="display: flex; gap: 6px; margin-top: 6px; font-size: 0.72rem;">
                      <span style="background: rgba(239,68,68,0.1); color: #ef4444; padding: 1px 6px; border-radius: 4px;">Faltas: ${e.absences || 0}</span>
                      <span style="background: rgba(245,158,11,0.1); color: #f59e0b; padding: 1px 6px; border-radius: 4px;">Llamadas de atención: ${e.warnings || 0}</span>
                    </div>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 4px; width: 100px;">
                    <button class="btn btn-secondary btn-small btn-edit-emp" data-id="${e.id}" style="font-size: 0.7rem; padding: 2px 4px;">✏️ Editar</button>
                    <button class="btn btn-secondary btn-small btn-add-absence" data-id="${e.id}" style="font-size: 0.7rem; padding: 2px 4px;">➕ Registrar Falta</button>
                    <button class="btn btn-secondary btn-small btn-add-warning" data-id="${e.id}" style="font-size: 0.7rem; padding: 2px 4px;">⚠️ Amonestar</button>
                    <button class="btn btn-small btn-fire-emp" data-id="${e.id}" style="font-size: 0.7rem; padding: 2px 4px; background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);">Dar de Baja</button>
                  </div>
                </div>
              `).join('')
          }
        </div>
      </div>

    </div>
  `;

  // Inicializar listado si es nulo
  state.administracion_employees = state.administracion_employees || [];

  // Implementación del Algoritmo Recomendador Dinámico (SAT / IGSS)
  const salaryInput = document.getElementById('e-salary');
  const baseSalaryText = document.getElementById('rec-base-salary');
  const totalCostText = document.getElementById('rec-total-cost');
  const badge = document.getElementById('rec-verdict-badge');

  const executeRecommendationAlgorithm = () => {
    const salary = parseFloat(salaryInput.value) || 0;
    const totalCost = salary;

    baseSalaryText.textContent = `Q${salary.toFixed(2)}`;
    totalCostText.textContent = `Q${totalCost.toFixed(2)}`;

    // Ponderación: 60% Caja (saldo actual) y 40% Utilidad neta
    const availableFunds = (cashBalance * 0.6) + (utilityBalance * 0.4);

    if (availableFunds > (totalCost * 3.5)) {
      badge.textContent = 'VIABLE';
      badge.style.background = '#22c55e'; // Green
    } else if (availableFunds >= (totalCost * 1.5)) {
      badge.textContent = 'AJUSTADO';
      badge.style.background = '#f59e0b'; // Orange
    } else {
      badge.textContent = 'RIESGO DE SOBREGUIRO';
      badge.style.background = '#ef4444'; // Red
    }
  };

  salaryInput.addEventListener('input', executeRecommendationAlgorithm);
  executeRecommendationAlgorithm(); // Calcular al iniciar

  // Bind Submit Employee (New or Edit)
  document.getElementById('admin-employee-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('e-name').value;
    const pos = document.getElementById('e-position').value;
    const specialty = document.getElementById('e-specialty').value || 'General';
    const salary = parseFloat(salaryInput.value) || 0;
    const hireDate = document.getElementById('e-date').value;

    if (isEditing) {
      const emp = state.administracion_employees.find(x => x.id === editingEmployeeId);
      if (emp) {
        emp.name = name;
        emp.position = pos;
        emp.specialty = specialty;
        emp.salary = salary;
        emp.hireDate = hireDate;
        saveAppState(state);
        alert(`✅ Empleado ${name} actualizado exitosamente.`);
      }
      editingEmployeeId = null;
    } else {
      const newEmp = {
        id: 'emp-' + Date.now(),
        name: name,
        position: pos,
        specialty: specialty,
        salary: salary,
        hireDate: hireDate,
        absences: 0,
        warnings: 0,
        status: 'Activo'
      };

      state.administracion_employees.push(newEmp);
      saveAppState(state);
      alert(`✅ Empleado ${name} registrado y contratado exitosamente.`);
    }

    renderRrhhEmpleados(container, state);
  });

  // Bind Cancel Edit Button
  const btnCancel = document.getElementById('btn-cancel-employee-edit');
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      editingEmployeeId = null;
      renderRrhhEmpleados(container, state);
    });
  }

  // Bind Edit Employee Button
  container.querySelectorAll('.btn-edit-emp').forEach(btn => {
    btn.addEventListener('click', () => {
      editingEmployeeId = btn.getAttribute('data-id');
      renderRrhhEmpleados(container, state);
    });
  });

  // Bind Incidencias (Faltas, Amonestaciones y Despido)
  container.querySelectorAll('.btn-add-absence').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const emp = state.administracion_employees.find(e => e.id === id);
      emp.absences = (emp.absences || 0) + 1;
      saveAppState(state);
      alert(`Falta registrada para ${emp.name}.`);
      renderRrhhEmpleados(container, state);
    });
  });

  container.querySelectorAll('.btn-add-warning').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const emp = state.administracion_employees.find(e => e.id === id);
      emp.warnings = (emp.warnings || 0) + 1;
      saveAppState(state);
      alert(`Llamada de atención registrada para ${emp.name}.`);
      renderRrhhEmpleados(container, state);
    });
  });

  container.querySelectorAll('.btn-fire-emp').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const emp = state.administracion_employees.find(e => e.id === id);
      if (confirm(`¿Confirma dar de baja al empleado ${emp.name}?`)) {
        state.administracion_employees = state.administracion_employees.filter(e => e.id !== id);
        saveAppState(state);
        alert(`Empleado ${emp.name} ha sido dado de baja.`);
        renderRrhhEmpleados(container, state);
      }
    });
  });
}

// Vista Preliminar e Impresión de Nómina
function showPayrollPrintPreview(payroll, state) {
  const modal = document.getElementById('prescription-print-modal');
  const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;
  const previewContainer = document.getElementById('prescription-preview-content');
  const printActionBtn = document.getElementById('btn-print-action');

  if (!modal || !previewContainer || !printActionBtn) return;

  if (modalTitle) {
    modalTitle.textContent = "Vista Preliminar de Impresión: Nómina de Empleados";
  }
  printActionBtn.innerHTML = '<span>🖨️</span> Imprimir Nómina';

  const clinic = state.clinicInfo || {};
  const dateFormatted = new Date(payroll.date).toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Calcular totales
  const totalGross = payroll.totalGross || 0;
  const totalDiscounts = payroll.totalDiscounts || 0;
  const totalNet = payroll.totalNet || 0;

  // Generar filas de la tabla general
  const rowsHtml = (payroll.employees || []).map(emp => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px; border: 1px solid #ddd; text-align: left;"><strong>${emp.name}</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: left; color: #555;">${emp.position}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-family: monospace;">Q${parseFloat(emp.salary).toFixed(2)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-family: monospace; color: #c00;">Q${parseFloat(emp.discount || 0).toFixed(2)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-family: monospace; font-weight: bold;">Q${parseFloat(emp.netSalary).toFixed(2)}</td>
    </tr>
  `).join('');

  // Agrupar empleados de 4 en 4 para los recibos individuales
  const payslipsHtmlChunks = [];
  const chunkSize = 4;
  for (let i = 0; i < (payroll.employees || []).length; i += chunkSize) {
    const chunk = payroll.employees.slice(i, i + chunkSize);
    const chunkHtml = chunk.map(emp => `
      <div style="width: 49%; height: 120mm; border: 1px dashed #000; padding: 15px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; font-size: 0.75rem; background: #fff; page-break-inside: avoid; margin-bottom: 8mm; border-radius: 4px; color: #000;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px;">
            <span style="font-weight: bold; font-size: 0.8rem; text-transform: uppercase;">${clinic.name}</span>
            <span style="font-size: 0.7rem; font-weight: bold; color: #333; letter-spacing: 0.5px;">RECIBO DE PAGO</span>
          </div>
          <div style="line-height: 1.4; margin-bottom: 10px;">
            <strong>Colaborador:</strong> ${emp.name}<br>
            <strong>Puesto:</strong> ${emp.position}<br>
            <strong>Período:</strong> ${payroll.month}<br>
            <strong>Fecha Emisión:</strong> ${dateFormatted.split(',')[0]}<br>
            <strong>ID Recibo:</strong> REC-${payroll.id.substring(8, 14)}-${emp.id.substring(4, 8)}
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem; margin-top: 10px; color: #000;">
            <thead>
              <tr style="border-bottom: 1px solid #000; font-weight: bold;">
                <td style="padding: 3px 0;">Concepto</td>
                <td style="text-align: right; padding: 3px 0;">Monto</td>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px dashed #eee;">
                <td style="padding: 4px 0;">Sueldo Devengado</td>
                <td style="text-align: right; font-family: monospace; padding: 4px 0;">Q${parseFloat(emp.salary).toFixed(2)}</td>
              </tr>
              <tr style="border-bottom: 1px dashed #eee; color: #a00;">
                <td style="padding: 4px 0;">Deducciones / Descuentos</td>
                <td style="text-align: right; font-family: monospace; padding: 4px 0;">Q${parseFloat(emp.discount || 0).toFixed(2)}</td>
              </tr>
              <tr style="font-weight: bold; border-top: 1.5px solid #000;">
                <td style="padding: 6px 0;">Neto Liquidado</td>
                <td style="text-align: right; font-family: monospace; padding: 6px 0; color: #000;">Q${parseFloat(emp.netSalary).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="text-align: center; margin-top: 25px; margin-bottom: 5px;">
          <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 4px auto;"></div>
          <span style="font-size: 0.65rem; color: #333; text-transform: uppercase;">Firma de Conforme (Empleado)</span>
        </div>
      </div>
    `).join('');

    payslipsHtmlChunks.push(`
      <div class="payroll-payslips-page" style="page-break-before: always; display: flex; flex-wrap: wrap; justify-content: space-between; align-content: flex-start; height: 260mm; box-sizing: border-box; padding: 10px 0;">
        ${chunkHtml}
      </div>
    `);
  }

  previewContainer.innerHTML = `
    <div class="prescription-preview-box">
      
      <!-- Tabla principal de impresión y pantalla -->
      <table style="width: 100%; border-collapse: collapse; background: transparent;">
        <thead>
          <tr>
            <td style="border: none; padding: 0 0 15px 0;">
              <!-- Encabezado de la clínica (se repite automáticamente al inicio de cada página física) -->
              <div class="prescription-preview-header" style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
                  ${clinic.logoData 
                    ? `<img src="${clinic.logoData}" style="max-height: 96px; max-width: 240px; object-fit: contain; border-radius: 4px;">` 
                    : `<img src="${logoUrl}" style="max-height: 96px; max-width: 240px; object-fit: contain; border-radius: 4px;">`}
                  <div>
                    <div class="prescription-preview-logo" style="margin: 0; font-size: 1.25rem;">${clinic.name}</div>
                    <div style="font-size: 0.85rem; font-weight: 600; color: #555; margin-top: 4px;">Atención Médica y Hospitalaria</div>
                  </div>
                </div>
                <div class="prescription-preview-clinic-details">
                  📍 ${clinic.address}<br>
                  📞 Teléfono: ${clinic.phone}<br>
                  ✉️ Email: ${clinic.email}
                </div>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: none; padding: 0;">
              <div class="prescription-print-content">
                <div style="text-align: center; margin: 1rem 0; padding: 6px; background-color: #f4f6f8; border-radius: 6px; border: 1px solid #ddd;">
                  <h3 style="font-family: var(--font-heading); margin: 0; color: #000; font-size: 1.15rem; letter-spacing: 0.5px; text-transform: uppercase;">Nómina de Empleados</h3>
                </div>

                <!-- Detalles del período y emisión -->
                <div class="prescription-preview-patient-info" style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; font-size: 0.9rem; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                  <div>
                    <strong>Mes / Período:</strong> ${payroll.month}<br>
                    <strong>Fecha de Emisión:</strong> ${dateFormatted}
                  </div>
                  <div style="text-align: right;">
                    <strong>ID Planilla:</strong> ${payroll.id}<br>
                    <strong>Estado:</strong> Cerrada y Liquidada
                  </div>
                </div>

                <!-- Tabla de Empleados y montos -->
                <table style="width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem;">
                  <thead>
                    <tr style="background-color: #f4f6f8; border-top: 1px solid #ddd; border-bottom: 2px solid #ddd;">
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Nombre Colaborador</th>
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Puesto</th>
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Sueldo Base</th>
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Descuentos</th>
                      <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Neto Recibido</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml}
                    <!-- Fila de Totales -->
                    <tr style="background-color: #fafafa; font-weight: bold; border-top: 2px solid #333; border-bottom: 2px solid #333;">
                      <td colspan="2" style="padding: 10px; border: 1px solid #ddd; text-align: left; text-transform: uppercase;">Total General</td>
                      <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-family: monospace;">Q${totalGross.toFixed(2)}</td>
                      <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-family: monospace; color: #c00;">Q${totalDiscounts.toFixed(2)}</td>
                      <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-family: monospace; color: var(--accent-success);">Q${totalNet.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="border: none; padding: 50px 0 10px 0;">
              <!-- Firmas de Autorización -->
              <div style="display: flex; justify-content: space-around; width: 100%; margin-top: 2rem;">
                <div style="text-align: center; width: 40%;">
                  <div style="border-top: 1px solid #333; width: 80%; margin: 0 auto 5px auto;"></div>
                  <div style="font-size: 0.8rem; font-weight: 600; color: #111;">Firma de Elaborado por</div>
                  <div style="font-size: 0.7rem; color: #666;">Dpto. Recursos Humanos</div>
                </div>
                <div style="text-align: center; width: 40%;">
                  <div style="border-top: 1px solid #333; width: 80%; margin: 0 auto 5px auto;"></div>
                  <div style="font-size: 0.8rem; font-weight: 600; color: #111;">Firma de Autorizado por</div>
                  <div style="font-size: 0.7rem; color: #666;">Dirección General / Administración</div>
                </div>
              </div>
              <div class="prescription-page-counter-print" style="margin-top: 20px; text-align: center;"></div>
            </td>
          </tr>
        </tfoot>
      </table>

    </div>

    <!-- Hojas de Recibos Individuales de Pago (4 por página física) -->
    ${payslipsHtmlChunks.join('')}
  `;

  printActionBtn.onclick = () => {
    window.print();
  };

  modal.style.display = "flex";
}

// Planilla / Nómina Mensual
function renderRrhhNomina(container, state) {
  const employees = (state.administracion_employees || []).filter(e => e.status === 'Activo' && e.name !== "Empleado de Prueba Antigravity" && !e.name.toLowerCase().includes("antigravity"));
  
  state.administracion_nominas = state.administracion_nominas || [];

  const parts = selectedPayrollMonth.split(' ');
  const monthName = parts[0].toLowerCase();
  const year = parseInt(parts[1]);
  
  const monthMap = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };
  const monthIndex = monthMap[monthName];
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  // Helper para obtener el sueldo prorrateado si ingresó a trabajar a mitad del mes
  const getProratedSalary = (emp) => {
    let baseSalary = emp.salary;
    if (emp.hireDate) {
      const hireDate = new Date(emp.hireDate);
      const hireYear = hireDate.getUTCFullYear();
      const hireMonth = hireDate.getUTCMonth();
      const hireDay = hireDate.getUTCDate();
      
      if (hireYear === year && hireMonth === monthIndex) {
        const daysWorked = totalDays - hireDay + 1;
        return (baseSalary / totalDays) * daysWorked;
      }
    }
    return baseSalary;
  };

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; align-items: start;">
      
      <!-- Creador de Nómina -->
      <div class="glass-card" style="padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1rem; color: var(--accent-primary); margin: 0;">Planilla de Sueldos Mensual</h3>
          <div style="display: flex; gap: 8px;">
            <select id="payroll-month" class="form-control" style="padding: 4px 8px; font-size: 0.85rem;">
              <option value="Enero 2026" ${selectedPayrollMonth === 'Enero 2026' ? 'selected' : ''}>Enero 2026</option>
              <option value="Febrero 2026" ${selectedPayrollMonth === 'Febrero 2026' ? 'selected' : ''}>Febrero 2026</option>
              <option value="Marzo 2026" ${selectedPayrollMonth === 'Marzo 2026' ? 'selected' : ''}>Marzo 2026</option>
              <option value="Abril 2026" ${selectedPayrollMonth === 'Abril 2026' ? 'selected' : ''}>Abril 2026</option>
              <option value="Mayo 2026" ${selectedPayrollMonth === 'Mayo 2026' ? 'selected' : ''}>Mayo 2026</option>
              <option value="Junio 2026" ${selectedPayrollMonth === 'Junio 2026' ? 'selected' : ''}>Junio 2026</option>
              <option value="Julio 2026" ${selectedPayrollMonth === 'Julio 2026' ? 'selected' : ''}>Julio 2026</option>
              <option value="Agosto 2026" ${selectedPayrollMonth === 'Agosto 2026' ? 'selected' : ''}>Agosto 2026</option>
              <option value="Septiembre 2026" ${selectedPayrollMonth === 'Septiembre 2026' ? 'selected' : ''}>Septiembre 2026</option>
              <option value="Octubre 2026" ${selectedPayrollMonth === 'Octubre 2026' ? 'selected' : ''}>Octubre 2026</option>
              <option value="Noviembre 2026" ${selectedPayrollMonth === 'Noviembre 2026' ? 'selected' : ''}>Noviembre 2026</option>
              <option value="Diciembre 2026" ${selectedPayrollMonth === 'Diciembre 2026' ? 'selected' : ''}>Diciembre 2026</option>
            </select>
            <button class="btn btn-primary btn-small" id="btn-generate-payroll"><span>⚙️</span> Procesar Planilla</button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
                <th style="padding: 6px;">Nombre</th>
                <th style="padding: 6px;">Puesto</th>
                <th style="padding: 6px; text-align: right;">Sueldo Base</th>
                <th style="padding: 6px; text-align: right; width: 120px;">Descuentos</th>
                <th style="padding: 6px; text-align: right;">Neto a Pagar</th>
              </tr>
            </thead>
            <tbody>
              ${employees.length === 0 
                ? `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted); font-style: italic;">No hay colaboradores activos para liquidar nómina.</td></tr>`
                : employees.map(emp => {
                    const proratedSalary = getProratedSalary(emp);
                    const discount = 0;
                    const net = proratedSalary - discount;
                    return `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                        <td style="padding: 6px;"><strong>${emp.name}</strong></td>
                        <td style="padding: 6px; color: var(--text-muted);">${emp.position}</td>
                        <td style="padding: 6px; text-align: right; font-family: var(--font-mono);">Q${parseFloat(proratedSalary).toFixed(2)}</td>
                        <td style="padding: 6px; text-align: right;">
                          <input type="number" min="0" value="0.00" step="any" class="payroll-discount-input" data-id="${emp.id}" style="width: 90px; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(0,0,0,0.2); color: var(--text-primary); text-align: right;">
                        </td>
                        <td style="padding: 6px; text-align: right; font-family: var(--font-mono); font-weight: bold; color: var(--accent-secondary);" class="row-net-pay" data-id="${emp.id}">Q${net.toFixed(2)}</td>
                      </tr>
                    `;
                  }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Historial de Planillas Generadas -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1rem; color: var(--accent-primary); margin-bottom: 1rem;">Nóminas Cerradas y Emitidas</h3>
        
        <div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          ${state.administracion_nominas.length === 0 
            ? `<div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px 0; font-size: 0.85rem;">No se registran nóminas archivadas.</div>`
            : state.administracion_nominas.map(n => `
                <div style="border: 1px solid var(--border-color); border-radius: 6px; background: rgba(255,255,255,0.01); padding: 10px; font-size: 0.82rem;">
                  <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--border-color); padding-bottom: 4px; margin-bottom: 4px; font-size: 0.72rem; color: var(--text-muted);">
                    <strong>NÓMINA MÓDULO</strong>
                    <span>📅 Emitida: ${new Date(n.date).toLocaleDateString('es-GT')}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <div>
                      <span style="font-weight: bold; color: var(--text-primary);">${n.month}</span><br>
                      <span style="font-size: 0.75rem; color: var(--text-muted);">${n.employees.length} colaboradores incluidos</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <strong style="color: var(--accent-secondary); font-size: 0.95rem;">Q${parseFloat(n.totalNet).toFixed(2)}</strong>
                      <button class="btn btn-secondary btn-small btn-print-payroll" data-id="${n.id}" style="padding: 4px 8px; font-size: 0.75rem;" title="Imprimir Nómina">🖨️</button>
                    </div>
                  </div>
                </div>
              `).join('')
          }
        </div>
      </div>

    </div>
  `;

  // Listener para cambio de mes seleccionado
  const monthSelect = document.getElementById('payroll-month');
  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      selectedPayrollMonth = monthSelect.value;
      renderRrhhNomina(container, state);
    });
  }

  // Dynamic change calculation for discount inputs
  const discountInputs = container.querySelectorAll('.payroll-discount-input');
  discountInputs.forEach(input => {
    input.addEventListener('input', () => {
      const empId = input.dataset.id;
      const emp = employees.find(e => e.id === empId);
      if (emp) {
        const proratedSalary = getProratedSalary(emp);
        const val = parseFloat(input.value) || 0;
        const net = Math.max(0, proratedSalary - val);
        const netCell = container.querySelector(`.row-net-pay[data-id="${empId}"]`);
        if (netCell) {
          netCell.textContent = `Q${net.toFixed(2)}`;
        }
      }
    });
  });

  // Bind Print Payroll Click
  const printBtns = container.querySelectorAll('.btn-print-payroll');
  printBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const payrollId = btn.dataset.id;
      const payroll = state.administracion_nominas.find(n => n.id === payrollId);
      if (payroll) {
        showPayrollPrintPreview(payroll, state);
      }
    });
  });

  // Bind Generate Payroll Click
  const btnGen = document.getElementById('btn-generate-payroll');
  if (btnGen) {
    btnGen.addEventListener('click', () => {
      if (employees.length === 0) {
        alert("No hay empleados activos en el listado para calcular la nómina.");
        return;
      }

      const month = document.getElementById('payroll-month').value;

      // Verificar que la nómina de este mes no se haya generado ya
      const alreadyExists = state.administracion_nominas.some(n => n.month === month);
      if (alreadyExists) {
        alert(`La nómina de ${month} ya ha sido generada y cerrada previamente.`);
        return;
      }

      let totalGross = 0;
      let totalNet = 0;
      let totalDiscounts = 0;
      const payrollEmployees = employees.map(emp => {
        const proratedSalary = getProratedSalary(emp);
        const inputDisc = container.querySelector(`.payroll-discount-input[data-id="${emp.id}"]`);
        const discount = inputDisc ? (parseFloat(inputDisc.value) || 0) : 0;
        const net = Math.max(0, proratedSalary - discount);
        totalGross += proratedSalary;
        totalDiscounts += discount;
        totalNet += net;

        return {
          id: emp.id,
          name: emp.name,
          position: emp.position,
          salary: proratedSalary,
          bonus: 0,
          igssLaboral: 0,
          discount: discount,
          netSalary: net
        };
      });

      const newPayroll = {
        id: 'PAYROLL-' + Date.now(),
        date: new Date().toISOString(),
        month: month,
        employees: payrollEmployees,
        totalGross: totalGross,
        totalDiscounts: totalDiscounts,
        totalNet: totalNet
      };

      state.administracion_nominas.unshift(newPayroll);

      // Ejecutar Cloud Function local para la provisión en segundo plano
      simulateOnPayrollGenerated(newPayroll, state);

      saveAppState(state);

      renderRrhhNomina(container, state);
    });
  }
}

export function renderBancosConciliacion(container, state) {
  const accounts = state.administracion_bancos || [];

  // Helper para calcular saldo actual de una cuenta bancaria
  const getAccountCalculatedBalance = (acc) => {
    let balance = parseFloat(acc.initialBalance) || 0;
    (acc.transactions || []).forEach(tx => {
      if (tx.type === 'Deposito') {
        balance += parseFloat(tx.amount) || 0;
      } else if (tx.type === 'Transferencia' || tx.type === 'Retiro') {
        balance -= parseFloat(tx.amount) || 0;
      }
    });
    return balance;
  };

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
      
      <!-- Cuentas Bancarias y Apertura -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Formulario Apertura de Cuenta -->
        <div class="glass-card" style="padding: 1.25rem;">
          <h3 style="font-size: 1.05rem; color: var(--accent-primary); margin-bottom: 1rem; font-family: var(--font-heading);">🏦 Apertura de Cuenta Bancaria</h3>
          <form id="bank-account-form" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-row" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 10px;">
              <div class="form-group">
                <label>Nombre del Banco</label>
                <input type="text" id="b-bank-name" required placeholder="Banco Industrial, Banrural, BAC...">
              </div>
              <div class="form-group">
                <label>Tipo de Cuenta</label>
                <select id="b-acc-type" required style="width:100%; padding:8px; background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">
                  <option value="Monetaria">Monetaria</option>
                  <option value="Ahorro">Ahorro</option>
                </select>
              </div>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 10px;">
              <div class="form-group">
                <label>Número de Cuenta</label>
                <input type="text" id="b-acc-num" required placeholder="XXXX-XXXX-XXXX">
              </div>
              <div class="form-group">
                <label>Saldo Inicial (Q)</label>
                <input type="number" id="b-initial-balance" required min="0.00" step="100.00" value="0.00">
              </div>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 8px;">
              ✨ Aperturar Cuenta
            </button>
          </form>
        </div>

        <!-- Formulario Registrar Depósito / Transferencia -->
        <div class="glass-card" style="padding: 1.25rem;">
          <h3 style="font-size: 1.05rem; color: var(--accent-primary); margin-bottom: 1rem; font-family: var(--font-heading);">💸 Transacciones Bancarias (Depósitos / Retiros)</h3>
          <form id="bank-transaction-form" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label>Tipo de Transacción</label>
                <select id="tx-type" required style="width:100%; padding:8px; background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">
                  <option value="Deposito">📥 Depósito / Ingreso</option>
                  <option value="Transferencia">📤 Transferencia / Retiro</option>
                </select>
              </div>
              <div class="form-group">
                <label>Cuenta de Origen/Destino</label>
                <select id="tx-account-id" required style="width:100%; padding:8px; background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">
                  ${accounts.length === 0 
                    ? `<option value="" disabled selected>Debe aperturar una cuenta primero</option>` 
                    : accounts.map(a => `<option value="${a.id}">${a.bankName} - ${a.number}</option>`).join('')
                  }
                </select>
              </div>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 10px;">
              <div class="form-group">
                <label>Monto (Q)</label>
                <input type="number" id="tx-amount" required min="0.01" step="0.01" value="100.00">
              </div>
              <div class="form-group">
                <label>Contrapartida Contable (Contra-cuenta)</label>
                <select id="tx-contra-account" required style="width:100%; padding:8px; background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">
                  <option value="Capital Autorizado">Capital Autorizado / Aporte de Socios</option>
                  <option value="Gastos Financieros (Comisiones)">Gastos Financieros (Comisiones Bancarias)</option>
                  <option value="Servicios de Agua/Luz/Internet">Servicios de Agua/Luz/Internet</option>
                  <option value="Otros Ingresos">Otros Ingresos / Rendimientos</option>
                  <option value="Cuentas por Pagar (Proveedores)">Cuentas por Pagar (Proveedores)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Concepto / Descripción</label>
              <input type="text" id="tx-concept" required placeholder="Ej. Aporte capital inicial, Pago de internet, Comisión mensual...">
            </div>

            <button type="submit" class="btn btn-success" style="width: 100%; padding: 8px;" ${accounts.length === 0 ? 'disabled' : ''}>
              📥 Registrar Transacción Bancaria
            </button>
          </form>
        </div>

      </div>

      <!-- Resumen y Saldos de Cuentas -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1.05rem; color: var(--accent-primary); margin-bottom: 1rem; font-family: var(--font-heading);">📊 Resumen de Saldos Bancarios</h3>
        
        <div style="overflow-x: auto; margin-bottom: 1.5rem;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
                <th style="padding: 6px;">Banco / Cuenta</th>
                <th style="padding: 6px; text-align: right;">Inicial</th>
                <th style="padding: 6px; text-align: right;">Saldos</th>
                <th style="padding: 6px; text-align: right;">Saldo Actual</th>
              </tr>
            </thead>
            <tbody>
              ${accounts.length === 0 
                ? `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted); font-style: italic;">No hay cuentas registradas.</td></tr>`
                : accounts.map(a => {
                    const currentBal = getAccountCalculatedBalance(a);
                    let depositsSum = 0;
                    let withdrawalsSum = 0;
                    (a.transactions || []).forEach(tx => {
                      if (tx.type === 'Deposito') depositsSum += tx.amount;
                      else withdrawalsSum += tx.amount;
                    });
                    return `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                        <td style="padding: 6px;">
                          <strong>${a.bankName}</strong><br>
                          <span style="font-size: 0.72rem; color: var(--text-muted);">${a.type} No. ${a.number}</span>
                        </td>
                        <td style="padding: 6px; text-align: right; font-family: var(--font-mono);">Q${parseFloat(a.initialBalance).toFixed(2)}</td>
                        <td style="padding: 6px; text-align: right; font-size: 0.72rem; color: var(--text-muted); line-height: 1.3;">
                          <span style="color: var(--accent-success);">+Q${depositsSum.toFixed(2)}</span><br>
                          <span style="color: var(--accent-danger);">-Q${withdrawalsSum.toFixed(2)}</span>
                        </td>
                        <td style="padding: 6px; text-align: right; font-family: var(--font-mono); font-weight: bold; color: var(--accent-secondary);">Q${currentBal.toFixed(2)}</td>
                      </tr>
                    `;
                  }).join('')
              }
            </tbody>
          </table>
        </div>

        <h3 style="font-size: 1.05rem; color: var(--accent-primary); margin-bottom: 0.75rem; font-family: var(--font-heading);">📋 Historial Reciente de Operaciones</h3>
        <div style="max-height: 220px; overflow-y: auto; font-size: 0.78rem; display: flex; flex-direction: column; gap: 6px;">
          ${accounts.flatMap(a => (a.transactions || []).map(tx => ({ ...tx, bankName: a.bankName, number: a.number }))).length === 0
            ? `<div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 10px 0;">No hay transacciones registradas.</div>`
            : accounts.flatMap(a => (a.transactions || []).map(tx => ({ ...tx, bankName: a.bankName, number: a.number })))
                .sort((x, y) => new Date(y.date) - new Date(x.date))
                .slice(0, 10)
                .map(tx => `
                  <div style="background: rgba(255,255,255,0.02); padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <strong>${tx.bankName} (${tx.number.slice(-4)})</strong>: ${tx.concept}<br>
                      <span style="font-size: 0.7rem; color: var(--text-muted);">${new Date(tx.date).toLocaleString('es-GT')} | Contrapartida: ${tx.contraAccount}</span>
                    </div>
                    <strong style="color: ${tx.type === 'Deposito' ? 'var(--accent-success)' : 'var(--accent-danger)'};">
                      ${tx.type === 'Deposito' ? '+' : '-'}Q${parseFloat(tx.amount).toFixed(2)}
                    </strong>
                  </div>
                `).join('')
          }
        </div>

      </div>

    </div>
  `;

  // Bind Submit Bank Account Form
  const accountForm = document.getElementById('bank-account-form');
  if (accountForm) {
    accountForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const bankName = document.getElementById('b-bank-name').value;
      const type = document.getElementById('b-acc-type').value;
      const number = document.getElementById('b-acc-num').value;
      const initialBalance = parseFloat(document.getElementById('b-initial-balance').value) || 0;

      // Validar si ya existe el número de cuenta
      if (accounts.some(a => a.number === number)) {
        alert("⚠️ Ya existe una cuenta bancaria registrada con ese número.");
        return;
      }

      const newAccount = {
        id: 'bank-acc-' + Date.now(),
        bankName,
        type,
        number,
        initialBalance,
        transactions: []
      };

      state.administracion_bancos.push(newAccount);

      // Si tiene saldo inicial, generar la partida contable de apertura
      if (initialBalance > 0) {
        const journalEntry = {
          id: 'PART-APERTURA-' + Date.now(),
          date: new Date().toISOString(),
          concept: `Partida de Apertura - Creación de cuenta ${type} en ${bankName} No. ${number}`,
          totalDebits: initialBalance,
          totalCredits: initialBalance,
          details: [
            { account: 'Caja y Bancos', type: 'Debe', amount: initialBalance },
            { account: 'Capital Autorizado', type: 'Haber', amount: initialBalance }
          ]
        };
        state.administracion_contabilidad.unshift(journalEntry);
      }

      saveAppState(state);
      alert(`✅ Cuenta bancaria aperturada con éxito en ${bankName}.`);
      renderBancosConciliacion(container, state);
    });
  }

  // Bind Submit Bank Transaction Form
  const transactionForm = document.getElementById('bank-transaction-form');
  if (transactionForm) {
    transactionForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const type = document.getElementById('tx-type').value;
      const accountId = document.getElementById('tx-account-id').value;
      const amount = parseFloat(document.getElementById('tx-amount').value) || 0;
      const contraAccount = document.getElementById('tx-contra-account').value;
      const concept = document.getElementById('tx-concept').value;

      if (!accountId) {
        alert("Debe seleccionar una cuenta bancaria.");
        return;
      }
      if (amount <= 0) {
        alert("El monto de la transacción debe ser mayor a cero.");
        return;
      }

      const selectedAcc = state.administracion_bancos.find(a => a.id === accountId);
      
      // Si es un retiro/transferencia, verificar que haya fondos suficientes
      if (type === 'Transferencia') {
        const currentBal = getAccountCalculatedBalance(selectedAcc);
        if (amount > currentBal) {
          alert(`⚠️ Saldo insuficiente en la cuenta bancaria. Saldo actual: Q${currentBal.toFixed(2)}.`);
          return;
        }
      }

      const newTx = {
        id: 'tx-bank-' + Date.now(),
        date: new Date().toISOString(),
        type,
        amount,
        contraAccount,
        concept
      };

      selectedAcc.transactions = selectedAcc.transactions || [];
      selectedAcc.transactions.unshift(newTx);

      // Registrar partida contable de partida doble
      const journalEntry = {
        id: 'PART-TX-BANCO-' + Date.now(),
        date: new Date().toISOString(),
        concept: `${type === 'Deposito' ? 'Depósito Bancario' : 'Transferencia Bancaria'} - ${concept} (Cuenta No: ${selectedAcc.number})`,
        totalDebits: amount,
        totalCredits: amount,
        details: []
      };

      if (type === 'Deposito') {
        journalEntry.details.push({ account: 'Caja y Bancos', type: 'Debe', amount });
        journalEntry.details.push({ account: contraAccount, type: 'Haber', amount });
      } else {
        journalEntry.details.push({ account: contraAccount, type: 'Debe', amount });
        journalEntry.details.push({ account: 'Caja y Bancos', type: 'Haber', amount });
      }

      state.administracion_contabilidad.unshift(journalEntry);
      
      saveAppState(state);
      alert("✅ Transacción bancaria registrada exitosamente y partida de diario generada.");
      renderBancosConciliacion(container, state);
    });
  }
}

export function renderExternalDoctorsTab(container, state) {
  state.external_doctors = state.external_doctors || [];
  state.accounts_payable = state.accounts_payable || [];

  const pendingAp = state.accounts_payable.filter(ap => ap.status === 'Pendiente');

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 20px; align-items: start;">
      
      <!-- Panel Izquierdo: Gestión de Médicos Externos -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Formulario CRUD Registrar Médico -->
        <div class="glass-card" style="padding: 1.25rem;">
          <h3 style="font-size: 1.05rem; color: var(--accent-primary); margin-bottom: 1rem; font-family: var(--font-heading);" id="crud-med-title">🩺 Registrar Médico Externo</h3>
          <form id="external-doctor-form" style="display: flex; flex-direction: column; gap: 12px;">
            <input type="hidden" id="d-id" value="">
            
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label>Nombre Completo</label>
                <input type="text" id="d-name" required placeholder="Dr. Nombre Apellido">
              </div>
              <div class="form-group">
                <label>Especialidad</label>
                <input type="text" id="d-specialty" required placeholder="Cardiología, Traumatología...">
              </div>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label>No. Colegiado</label>
                <input type="text" id="d-colegiado" required placeholder="Ej. 12450">
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input type="text" id="d-phone" required placeholder="502XXXX-XXXX">
              </div>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label>NIT Facturación</label>
                <input type="text" id="d-nit" required placeholder="Ej. 8451240-3">
              </div>
              <div class="form-group">
                <label>Nombre Fiscal</label>
                <input type="text" id="d-billing-name" required placeholder="Nombre o Razón Social">
              </div>
            </div>

            <div class="form-row" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 10px;">
              <div class="form-group">
                <label>Esquema de Cobro (Sugerido)</label>
                <select id="d-rate-type" required style="width:100%; padding:8px; background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">
                  <option value="fixed">Tarifa Fija por Interconsulta</option>
                  <option value="percentage">Monto Variable por Procedimiento</option>
                </select>
              </div>
              <div class="form-group">
                <label>Valor Tarifa (Q)</label>
                <input type="number" id="d-rate-value" required min="0.00" step="50.00" value="450.00">
              </div>
            </div>

            <div style="display: flex; gap: 10px;">
              <button type="submit" class="btn btn-primary" style="flex: 2; padding: 8px;">
                💾 Guardar Médico
              </button>
              <button type="button" class="btn btn-secondary" id="btn-cancel-edit" style="flex: 1; padding: 8px; display: none;">
                Cancelar
              </button>
            </div>
          </form>
        </div>

        <!-- Listado de Médicos Externos -->
        <div class="glass-card" style="padding: 1.25rem;">
          <h3 style="font-size: 1.05rem; color: var(--accent-primary); margin-bottom: 1rem; font-family: var(--font-heading);">📋 Médicos Registrados</h3>
          
          <div style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
            ${state.external_doctors.length === 0 
              ? `<div style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px 0; font-size: 0.85rem;">No hay médicos externos registrados.</div>`
              : state.external_doctors.map(d => `
                  <div style="border: 1px solid var(--border-color); border-radius: 6px; background: rgba(255,255,255,0.01); padding: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
                    <div>
                      <strong>${d.name}</strong><br>
                      <span style="font-size: 0.75rem; color: var(--text-muted);">${d.specialty} | Col: ${d.colegiado} | NIT: ${d.nit}</span><br>
                      <span style="font-size: 0.72rem; color: var(--accent-primary);">Tarifa: Q${parseFloat(d.rateValue).toFixed(2)} (${d.rateType === 'fixed' ? 'Fija' : 'Variable'})</span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-secondary btn-small btn-edit-doc" data-id="${d.id}" style="padding: 2px 6px; font-size: 0.72rem;">✏️</button>
                      <button class="btn btn-secondary btn-small btn-delete-doc" data-id="${d.id}" style="padding: 2px 6px; font-size: 0.72rem; color: var(--accent-danger);">❌</button>
                    </div>
                  </div>
                `).join('')
            }
          </div>
        </div>

      </div>

      <!-- Panel Derecho: Cuentas por Pagar (AP) a Médicos Externos -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="font-size: 1.05rem; color: var(--accent-primary); margin-bottom: 1rem; font-family: var(--font-heading);">💳 Cuentas por Pagar (Honorarios Médicos)</h3>
        
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-muted);">
                <th style="padding: 6px;">Médico / Concepto</th>
                <th style="padding: 6px;">Escenario</th>
                <th style="padding: 6px; text-align: right;">Monto</th>
                <th style="padding: 6px; text-align: center;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${pendingAp.length === 0 
                ? `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted); font-style: italic;">No hay honorarios pendientes de liquidación.</td></tr>`
                : pendingAp.map(ap => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                      <td style="padding: 6px;">
                        <strong>${ap.doctorName}</strong><br>
                        <span style="font-size: 0.72rem; color: var(--text-muted);">${ap.concept}</span><br>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">Fec: ${new Date(ap.dateCreated).toLocaleDateString('es-GT')}</span>
                      </td>
                      <td style="padding: 6px; vertical-align: middle;">
                        <span style="padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: bold; 
                          background: ${ap.scenario === 1 ? 'rgba(0, 242, 254, 0.1)' : 'rgba(34, 197, 94, 0.1)'}; 
                          color: ${ap.scenario === 1 ? 'var(--accent-primary)' : 'var(--accent-success)'};">
                          ${ap.scenario === 1 ? 'Interconsulta (Gasto)' : 'Cuenta Ajena (Pasivo)'}
                        </span>
                      </td>
                      <td style="padding: 6px; text-align: right; font-family: var(--font-mono); font-weight: bold; color: var(--text-primary); vertical-align: middle;">
                        Q${parseFloat(ap.amount).toFixed(2)}
                      </td>
                      <td style="padding: 6px; text-align: center; vertical-align: middle;">
                        <button class="btn btn-success btn-small btn-pay-doctor-honorarios" data-id="${ap.id}" style="font-size: 0.72rem; padding: 4px 6px;">Pagar</button>
                      </td>
                    </tr>
                  `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  // Bind Submit CRUD Médico
  const form = document.getElementById('external-doctor-form');
  const dIdInput = document.getElementById('d-id');
  const dNameInput = document.getElementById('d-name');
  const dSpecInput = document.getElementById('d-specialty');
  const dColInput = document.getElementById('d-colegiado');
  const dPhoneInput = document.getElementById('d-phone');
  const dNitInput = document.getElementById('d-nit');
  const dBillNameInput = document.getElementById('d-billing-name');
  const dRateTypeInput = document.getElementById('d-rate-type');
  const dRateValInput = document.getElementById('d-rate-value');
  const cancelEditBtn = document.getElementById('btn-cancel-edit');
  const crudTitle = document.getElementById('crud-med-title');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = dIdInput.value;
    const name = dNameInput.value.trim();
    const specialty = dSpecInput.value.trim();
    const colegiado = dColInput.value.trim();
    const phone = dPhoneInput.value.trim();
    const nit = dNitInput.value.trim();
    const billingName = dBillNameInput.value.trim();
    const rateType = dRateTypeInput.value;
    const rateValue = parseFloat(dRateValInput.value) || 0;

    if (id) {
      // Editar
      const docObj = state.external_doctors.find(d => d.id === id);
      docObj.name = name;
      docObj.specialty = specialty;
      docObj.colegiado = colegiado;
      docObj.phone = phone;
      docObj.nit = nit;
      docObj.billingName = billingName;
      docObj.rateType = rateType;
      docObj.rateValue = rateValue;
      alert(`✅ Médico ${name} actualizado.`);
    } else {
      // Registrar nuevo
      const newDoc = {
        id: 'ext-doc-' + Date.now(),
        name,
        specialty,
        colegiado,
        phone,
        nit,
        billingName,
        rateType,
        rateValue,
        dateCreated: new Date().toISOString()
      };
      state.external_doctors.push(newDoc);
      alert(`✅ Médico ${name} registrado.`);
    }

    saveAppState(state);
    renderExternalDoctorsTab(container, state);
  });

  // Cancelar Edición
  cancelEditBtn.addEventListener('click', () => {
    form.reset();
    dIdInput.value = '';
    cancelEditBtn.style.display = 'none';
    crudTitle.textContent = '🩺 Registrar Médico Externo';
  });

  // Bind Editar Médico
  container.querySelectorAll('.btn-edit-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const d = state.external_doctors.find(x => x.id === id);

      dIdInput.value = d.id;
      dNameInput.value = d.name;
      dSpecInput.value = d.specialty;
      dColInput.value = d.colegiado;
      dPhoneInput.value = d.phone;
      dNitInput.value = d.nit;
      dBillNameInput.value = d.billingName;
      dRateTypeInput.value = d.rateType;
      dRateValInput.value = d.rateValue;

      cancelEditBtn.style.display = 'inline-block';
      crudTitle.textContent = '✏️ Editar Médico Externo';
      dNameInput.focus();
    });
  });

  // Bind Eliminar Médico
  container.querySelectorAll('.btn-delete-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const d = state.external_doctors.find(x => x.id === id);
      if (confirm(`¿Confirma eliminar el perfil del médico externo ${d.name}?`)) {
        state.external_doctors = state.external_doctors.filter(x => x.id !== id);
        saveAppState(state);
        renderExternalDoctorsTab(container, state);
      }
    });
  });

  // Bind Pagar Honorarios (AP) - Sin retenciones ni descuentos contables
  container.querySelectorAll('.btn-pay-doctor-honorarios').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const ap = state.accounts_payable.find(x => x.id === id);

      const checkRef = prompt(`Ingrese número de cheque o transferencia para el pago de Q${parseFloat(ap.amount).toFixed(2)} al médico ${ap.doctorName}:`, 'CH-');
      if (checkRef === null || checkRef.trim() === '') return;

      // 1. Marcar como Pagado
      ap.status = 'Pagado';
      ap.paymentRef = checkRef;
      ap.datePaid = new Date().toISOString();

      // 2. Generar partida contable en Libro Diario
      const journalEntry = {
        id: 'PART-PAGO-HONORARIOS-' + Date.now(),
        date: new Date().toISOString(),
        concept: `Pago de Honorarios Médicos (${ap.scenario === 1 ? 'Gasto Interconsulta' : 'Liquidación Pasivo Cuenta Ajena'}) - Dr. ${ap.doctorName} (Ref: ${checkRef})`,
        totalDebits: ap.amount,
        totalCredits: ap.amount,
        details: []
      };

      if (ap.scenario === 1) {
        // Escenario 1: Gasto de Honorarios Profesionales
        journalEntry.details.push({ account: 'Gastos por Honorarios Profesionales', type: 'Debe', amount: ap.amount });
      } else {
        // Escenario 2: Liquidación de Pasivo (Acreedores Varios)
        journalEntry.details.push({ account: 'Acreedores Varios', type: 'Debe', amount: ap.amount });
      }
      journalEntry.details.push({ account: 'Caja y Bancos', type: 'Haber', amount: ap.amount });

      state.administracion_contabilidad.unshift(journalEntry);
      
      saveAppState(state);
      alert(`✅ Honorarios médicos pagados exitosamente. Registro de cheque ${checkRef} guardado y partida doble creada.`);
      renderExternalDoctorsTab(container, state);
    });
  });
}
