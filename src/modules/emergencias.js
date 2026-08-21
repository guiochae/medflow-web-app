// src/modules/emergencias.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId, router } from '../main.js';
import { renderAdmissionForm } from './encamamiento.js';

function enrichMedication(m) {
  if (!m) return null;
  const precio = parseFloat(m.price || m.precio_presentacion || 50.0);
  const unidades = parseInt(m.unidades_por_presentacion || 10);
  
  const presNorm = String(m.presentation || '').toLowerCase();
  const nameNorm = String(m.name || '').toLowerCase();
  
  const esFrac = m.es_fraccionable !== undefined 
    ? !!m.es_fraccionable 
    : (m.permite_dosis !== undefined 
        ? !!m.permite_dosis 
        : (presNorm.includes('jarabe') || presNorm.includes('gotas') || presNorm.includes('ampolla') || presNorm.includes('solucion') || presNorm.includes('suspension') || presNorm.includes('crema') || presNorm.includes('frasco') || presNorm.includes('gotero') ||
           nameNorm.includes('jarabe') || nameNorm.includes('gotas') || nameNorm.includes('ampolla') || nameNorm.includes('solucion') || nameNorm.includes('suspension') || nameNorm.includes('crema')));
           
  const unidadMedida = m.unidad_medida_dosis || (presNorm.includes('jarabe') || presNorm.includes('solucion') || presNorm.includes('suspension') || presNorm.includes('frasco') || presNorm.includes('gotero') ? 'ml' : 'mg');
  const dosisTotal = parseFloat(m.dosis_total_presentacion || (unidadMedida === 'ml' ? 100 : 500));

  return {
    ...m,
    price: precio,
    precio_presentacion: precio,
    unidades_por_presentacion: unidades,
    es_fraccionable: esFrac,
    permite_dosis: esFrac,
    dosis_total_presentacion: dosisTotal,
    unidad_medida_dosis: unidadMedida
  };
}

// Variables temporales para prescripciones de evolución en curso
let tempMeds = [];
let tempLabs = [];
let tempImgs = [];

// Insumos temporales seleccionados en la nota de enfermería actual
let tempNurseSupplies = [];

// Pestaña activa en la consola ('evolucion', 'enfermeria', 'cuenta', 'egreso')
let activeTab = 'evolucion';

export function renderEmergencias(container) {
  const state = getAppState();
  const currentUser = state.currentUser;

  // 1. Validar Control de Acceso (RBAC)
  const roleLower = String(currentUser && currentUser.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nameLower = String(currentUser && currentUser.name || '').toLowerCase();
  
  const isDoctor = roleLower.includes('medico') || roleLower.includes('medica') || roleLower.includes('doctor') || nameLower.startsWith('dr.') || nameLower.startsWith('dra.');
  const isNurse = roleLower.includes('enfermero') || roleLower.includes('enfermera') || roleLower.includes('enfermeria') || roleLower.startsWith('enf') || nameLower.startsWith('enf.');
  const isAuthorized = roleLower.includes('administrador') ||
                       roleLower.includes('admin') ||
                       isDoctor ||
                       isNurse;

  if (!isAuthorized) {
    container.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 4rem 2rem; max-width: 600px; margin: 3rem auto; border-top: 4px solid var(--accent-danger);">
        <span style="font-size: 3rem;">⚠️</span>
        <h2 style="color: var(--accent-danger); margin-top: 1rem; font-family: var(--font-heading);">Acceso Denegado</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem; line-height: 1.5;">
          No tiene los permisos requeridos para ingresar al módulo de Emergencias / Observación.
          Este módulo está restringido para Administradores, Médicos y Personal de Enfermería.
        </p>
      </div>
    `;
    return;
  }

  // 2. Renderizar Estructura del Módulo
  container.innerHTML = `
    <div class="module-header">
      <div class="module-title">
        <h1>🚨 Emergencias y Observación</h1>
        <p>Atención inmediata, control de triage, estancia corta, evolución médica, notas de enfermería y traslado a encamamiento.</p>
      </div>
    </div>

    <div class="grid-prescription">
      <!-- Columna Principal (Dashboard de Emergencia/Obs) -->
      <div id="emerg-dashboard-area">
        <!-- Se inyecta con renderEmergDashboard() -->
      </div>
      
      <!-- Barra lateral de Pacientes en Emergencia -->
      <div class="glass-card search-sidebar">
        <h3>Pacientes en Emergencia/Obs</h3>
        <div class="form-group" style="margin-top: 5px; margin-bottom: 10px;">
          <select id="emerg-sidebar-filter" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); outline: none; font-size: 0.85rem;">
            <option value="activos">Mostrar: Activos en Emergencia</option>
            <option value="todos">Mostrar: Todos los Pacientes</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <input type="text" id="emerg-patient-search" placeholder="🔍 Buscar paciente...">
        </div>
        <ul class="patient-list" id="emerg-patient-list" style="max-height: 250px; overflow-y: auto; margin-bottom: 1rem;">
          <!-- Pacientes cargados aquí -->
        </ul>

        <button class="btn btn-primary" id="btn-trigger-new-emerg" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.85rem; padding: 10px; background: var(--accent-danger); border: none;">
          <span>➕</span> Iniciar Ingreso Emergencia
        </button>
      </div>
    </div>
  `;

  // Bind Sidebar Events
  const searchInput = document.getElementById('emerg-patient-search');
  const filterSelect = document.getElementById('emerg-sidebar-filter');
  
  if (searchInput) searchInput.addEventListener('input', () => renderEmergPatientList());
  if (filterSelect) filterSelect.addEventListener('change', () => renderEmergPatientList());

  document.getElementById('btn-trigger-new-emerg').addEventListener('click', () => {
    renderEmergAdmissionForm();
  });

  renderEmergPatientList();
  renderEmergDashboard();
}

// 3. Renderizar listado de pacientes en la barra lateral
function renderEmergPatientList() {
  const state = getAppState();
  const listContainer = document.getElementById('emerg-patient-list');
  const filterVal = document.getElementById('emerg-sidebar-filter')?.value || 'activos';
  const query = document.getElementById('emerg-patient-search')?.value.toLowerCase() || '';

  if (!listContainer) return;
  listContainer.innerHTML = '';

  let basePatients = state.patients || [];

  // Si se elige mostrar solo Activos en Emergencias
  if (filterVal === 'activos') {
    const activeEmergIds = (state.emergencias || [])
      .filter(e => e.status === 'Activo')
      .map(e => e.patientId);
    
    basePatients = basePatients.filter(p => activeEmergIds.includes(p.id));
  }

  // Filtrar por término de búsqueda
  const filtered = basePatients.filter(p => {
    const nameVal = p.name ? String(p.name).toLowerCase() : '';
    const telVal = p.telephone ? String(p.telephone) : '';
    return nameVal.includes(query) || telVal.includes(query);
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = '<li style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No se encontraron pacientes</li>';
    return;
  }

  const activeId = getActivePatientId();

  filtered.forEach(p => {
    const li = document.createElement('li');
    li.className = `patient-item ${p.id === activeId ? 'selected' : ''}`;
    
    const activeE = (state.emergencias || []).find(e => e.patientId === p.id && e.status === 'Activo');
    
    // Triage dot
    let dotColor = 'rgba(255,255,255,0.15)';
    if (activeE) {
      const triage = String(activeE.triageColor || '').toLowerCase();
      if (triage === 'rojo') dotColor = '#ef4444';
      else if (triage === 'naranja') dotColor = '#f97316';
      else if (triage === 'amarillo') dotColor = '#eab308';
      else if (triage === 'verde') dotColor = '#22c55e';
      else if (triage === 'azul') dotColor = '#3b82f6';
      else dotColor = '#10b981';
    }

    const statusDot = `<span style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; display: inline-block; margin-right: 8px;" title="${activeE ? 'En Emergencia / Obs (' + activeE.bedName + ')' : 'No registrado'}"></span>`;

    li.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <div class="patient-item-name" style="display: flex; align-items: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;">
          ${statusDot} ${p.name}
        </div>
        <span style="font-size: 0.72rem; opacity: 0.7;">${activeE ? activeE.bedName : ''}</span>
      </div>
    `;

    li.addEventListener('click', () => {
      setActivePatientId(p.id);
      renderEmergPatientList();
      renderEmergDashboard();
    });

    listContainer.appendChild(li);
  });
}

// 4. Renderizar panel principal del dashboard
function renderEmergDashboard() {
  const state = getAppState();
  const dashboardArea = document.getElementById('emerg-dashboard-area');
  if (!dashboardArea) return;

  const activeId = getActivePatientId();
  const patient = state.patients.find(p => p.id === activeId);

  if (!patient) {
    dashboardArea.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 5rem 2rem;">
        <span style="font-size: 3.5rem;">🚨</span>
        <h2 style="margin-top: 1rem; font-family: var(--font-heading);">Consola de Emergencia y Observación</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem; max-width: 450px; margin-left: auto; margin-right: auto; line-height: 1.5;">
          Selecciona un paciente de la barra lateral para ver su estado clínico de urgencia o presiona "Iniciar Ingreso Emergencia".
        </p>
      </div>
    `;
    return;
  }

  // Buscar expediente de emergencia activo
  const activeEmerg = (state.emergencias || []).find(e => e.patientId === patient.id && e.status === 'Activo');

  if (!activeEmerg) {
    dashboardArea.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 4rem 2rem; border-top: 3px solid var(--accent-danger);">
        <span style="font-size: 3rem;">🩺</span>
        <h2 style="margin-top: 1rem; font-family: var(--font-heading); color: var(--text-primary);">${patient.name}</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem; max-width: 450px; margin-left: auto; margin-right: auto; line-height: 1.4; margin-bottom: 1.5rem;">
          Este paciente no tiene una ficha de urgencia u observación activa.
        </p>
        <button class="btn btn-danger" id="btn-start-emerg-direct" style="background: var(--accent-danger); border: none;">
          🚨 Iniciar Ingreso a Emergencia
        </button>
      </div>
    `;

    document.getElementById('btn-start-emerg-direct').addEventListener('click', () => {
      renderEmergAdmissionForm(patient.id);
    });
    return;
  }

  // Si está activo, renderizar cockpit de seguimiento
  const dob = new Date(patient.birthdate);
  const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  const hoursIn = Math.max(1, Math.ceil((Date.now() - new Date(activeEmerg.admissionDate).getTime()) / (1000 * 60 * 60)));

  // Color de Triage badge
  let triageLabel = 'Prioridad';
  let triageClass = 'background: #64748b; color: white;';
  const triage = String(activeEmerg.triageColor || '').toLowerCase();
  if (triage === 'rojo') { triageLabel = 'ROJO - Emergencia'; triageClass = 'background: #ef4444; color: white;'; }
  else if (triage === 'naranja') { triageLabel = 'NARANJA - Muy Urgente'; triageClass = 'background: #f97316; color: white;'; }
  else if (triage === 'amarillo') { triageLabel = 'AMARILLO - Urgente'; triageClass = 'background: #eab308; color: black;'; }
  else if (triage === 'verde') { triageLabel = 'VERDE - Menor'; triageClass = 'background: #22c55e; color: white;'; }
  else if (triage === 'azul') { triageLabel = 'AZUL - No urgente'; triageClass = 'background: #3b82f6; color: white;'; }

  dashboardArea.innerHTML = `
    <!-- Ficha del Paciente -->
    <div class="patient-top-banner glass-card" style="margin-bottom: 1.5rem; padding: 1.25rem; border-left: 4px solid #ef4444;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; width: 100%;">
        <div>
          <span class="status-badge" style="${triageClass} font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; font-weight: bold; margin-bottom: 5px; display: inline-block;">🚨 ${triageLabel} | ESTANCIA: ${hoursIn} HORAS</span>
          <h2 style="margin: 0; color: var(--text-primary); font-family: var(--font-heading); font-size: 1.4rem;">${patient.name}</h2>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px; display: flex; gap: 15px; flex-wrap: wrap;">
            <span><strong>DPI:</strong> ${patient.dpi || 'N/A'}</span>
            <span><strong>Edad:</strong> ${age} años</span>
            <span><strong>Cama:</strong> <strong style="color: var(--accent-primary);">${activeEmerg.bedName || 'N/A'}</strong></span>
            <span><strong>Ingreso:</strong> ${new Date(activeEmerg.admissionDate).toLocaleString('es-GT')}</span>
            <span><strong>Costo Estancia:</strong> Q${parseFloat(activeEmerg.stayCost || 0).toFixed(2)}</span>
          </div>
        </div>
        <button class="btn btn-danger btn-small" id="btn-trigger-discharge" style="background: var(--accent-danger); border: none;">🏥 Cierre / Alta / Traslado</button>
      </div>
    </div>

    <!-- Pestañas de la Consola -->
    <div class="tab-container" style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); display: flex; gap: 10px;">
      <button class="tab-btn ${activeTab === 'evolucion' ? 'active' : ''}" data-tab="evolucion" style="padding: 10px 15px; background: none; border: none; border-bottom: 2px solid ${activeTab === 'evolucion' ? 'var(--accent-primary)' : 'transparent'}; color: ${activeTab === 'evolucion' ? 'var(--text-primary)' : 'var(--text-muted)'}; font-weight: bold; cursor: pointer;">🩺 Evolución Médica</button>
      <button class="tab-btn ${activeTab === 'enfermeria' ? 'active' : ''}" data-tab="enfermeria" style="padding: 10px 15px; background: none; border: none; border-bottom: 2px solid ${activeTab === 'enfermeria' ? 'var(--accent-primary)' : 'transparent'}; color: ${activeTab === 'enfermeria' ? 'var(--text-primary)' : 'var(--text-muted)'}; font-weight: bold; cursor: pointer;">🩹 Enfermería e Insumos</button>
      <button class="tab-btn ${activeTab === 'cuenta' ? 'active' : ''}" data-tab="cuenta" style="padding: 10px 15px; background: none; border: none; border-bottom: 2px solid ${activeTab === 'cuenta' ? 'var(--accent-primary)' : 'transparent'}; color: ${activeTab === 'cuenta' ? 'var(--text-primary)' : 'var(--text-muted)'}; font-weight: bold; cursor: pointer;">💰 Detalle de Cuenta</button>
    </div>

    <!-- Contenido de las pestañas -->
    <div id="emerg-tab-content">
      <!-- Inyectado dinámicamente -->
    </div>
  `;

  // Bind Tab Click Events
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab');
      renderEmergDashboard();
    });
  });

  // Bind Discharge Button
  document.getElementById('btn-trigger-discharge').addEventListener('click', () => {
    renderDischargeForm(activeEmerg, patient);
  });

  // Render tab content
  if (activeTab === 'evolucion') renderEvolucionTab(activeEmerg, patient);
  else if (activeTab === 'enfermeria') renderEnfermeriaTab(activeEmerg, patient);
  else if (activeTab === 'cuenta') renderCuentaTab(activeEmerg, patient);
}

// 5. Formulario de Ingreso a Emergencias
function renderEmergAdmissionForm(targetPatientId = null) {
  const state = getAppState();
  const dashboardArea = document.getElementById('emerg-dashboard-area');
  if (!dashboardArea) return;

  // Camas fijas (1, 2, 3)
  const beds = ['Cama 1', 'Cama 2', 'Cama 3'];
  const activeEmergs = state.emergencias || [];
  
  // Analizar disponibilidad de camas
  const occupiedBeds = activeEmergs.filter(e => e.status === 'Activo').map(e => e.bedName);

  dashboardArea.innerHTML = `
    <div class="glass-card" style="padding: 1.5rem; border-top: 3px solid var(--accent-danger);">
      <h3 style="margin-bottom: 1.25rem; color: var(--accent-danger); display: flex; align-items: center; gap: 8px;">
        <span>🚨</span> Registrar Ingreso a Emergencias / Observación
      </h3>
      <form id="emerg-admission-form" style="display: flex; flex-direction: column; gap: 15px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; flex-wrap: wrap;">
          <div class="form-group">
            <label>Paciente</label>
            <select id="adm-patient" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              <!-- Se inyectan pacientes -->
            </select>
          </div>
          <div class="form-group">
            <label>Cama de Emergencia</label>
            <select id="adm-bed" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              ${beds.map(bed => {
                const isOccupied = occupiedBeds.includes(bed);
                return `<option value="${bed}" ${isOccupied ? 'disabled style="color:var(--text-muted); font-style:italic;"' : ''}>${bed} ${isOccupied ? '(Ocupada ❌)' : '(Disponible  )'}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Médico de Emergencia de Turno</label>
            <select id="adm-doctor" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              <!-- Se inyectan médicos -->
            </select>
          </div>
          <div class="form-group">
            <label>Nivel de Triage (Gravedad)</label>
            <select id="adm-triage" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              <option value="Rojo" style="background:#ef4444; color:white;">Rojo - Emergencia (Riesgo vital inminente)</option>
              <option value="Naranja" style="background:#f97316; color:white;">Naranja - Muy Urgente (Riesgo potencial)</option>
              <option value="Amarillo" style="background:#eab308; color:black;" selected>Amarillo - Urgente (Estable, requiere evaluación)</option>
              <option value="Verde" style="background:#22c55e; color:white;">Verde - Menor (Poco urgente)</option>
              <option value="Azul" style="background:#3b82f6; color:white;">Azul - No urgente (Atención general)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Costo de Estancia/Atención Inicial (Q)</label>
            <input type="number" id="adm-stay-cost" required min="0" step="0.01" value="150.00" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
          </div>
          <div class="form-group">
            <label>Motivo de Consulta (Triage Inicial)</label>
            <input type="text" id="adm-reason-summary" required placeholder="Ej. Dolor abdominal agudo, traumatismo, fiebre alta..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
          </div>
        </div>

        <div class="form-group">
          <label>Nota de Evaluación Física Inicial</label>
          <textarea id="adm-reason" required rows="2" placeholder="Detalle los síntomas, examen físico inicial e indicaciones médicas de urgencia..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical;"></textarea>
        </div>

        <!-- Signos Vitales de Ingreso -->
        <div style="border-top: 1px dashed var(--border-color); padding-top: 10px; margin-top: 5px;">
          <h4 style="color: var(--accent-danger); margin-bottom: 10px; font-size: 0.95rem;">Signos Vitales de Ingreso</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
            <div class="form-group">
              <label>Temperatura (°C)</label>
              <input type="number" step="0.1" id="adm-vit-temp" required placeholder="36.5" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>P.A. Sistólica</label>
              <input type="number" id="adm-vit-bpsys" required placeholder="120" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>P.A. Diastólica</label>
              <input type="number" id="adm-vit-bpdia" required placeholder="80" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>F.C. (LPM)</label>
              <input type="number" id="adm-vit-hr" required placeholder="75" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>F.R. (RPM)</label>
              <input type="number" id="adm-vit-rr" required placeholder="16" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>SPO2 (%)</label>
              <input type="number" id="adm-vit-ox" required placeholder="98" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>Glucosa (mg/dL)</label>
              <input type="number" id="adm-vit-glu" placeholder="95" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-emerg-adm">Cancelar</button>
          <button type="submit" class="btn btn-success" style="background: var(--accent-success); border: none;">🚨 Iniciar Ingreso</button>
        </div>
      </form>
    </div>
  `;

  // Poblar pacientes dropdown
  const patientSelect = document.getElementById('adm-patient');
  if (patientSelect) {
    const activeEmergIds = (state.emergencias || []).filter(e => e.status === 'Activo').map(e => e.patientId);
    const activeHospIds = (state.encamamiento || []).filter(h => h.status === 'Activo').map(h => h.patientId);
    const occupiedIds = [...activeEmergIds, ...activeHospIds];

    // Filtrar los pacientes que ya tienen ingreso activo
    const freePatients = state.patients.filter(p => !occupiedIds.includes(p.id));
    
    patientSelect.innerHTML = freePatients.map(p => `<option value="${p.id}" ${p.id === targetPatientId ? 'selected' : ''}>${p.name}</option>`).join('');
    if (freePatients.length === 0 && !targetPatientId) {
      patientSelect.innerHTML = '<option value="">-- No hay pacientes disponibles --</option>';
    }
  }

  // Poblar médicos dropdown
  const doctorSelect = document.getElementById('adm-doctor');
  const doctors = state.users.filter(u => {
    const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return r.includes('medico') || r.includes('admin') || r.includes('administrador');
  });
  if (doctorSelect) {
    doctorSelect.innerHTML = doctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }

  // Bind Form Cancel
  document.getElementById('btn-cancel-emerg-adm').addEventListener('click', () => {
    renderEmergDashboard();
  });

  // Bind Form Submit
  document.getElementById('emerg-admission-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pId = document.getElementById('adm-patient').value;
    if (!pId) {
      alert("Seleccione un paciente para el ingreso.");
      return;
    }

    const patientObj = state.patients.find(p => p.id === pId);
    const bedName = document.getElementById('adm-bed').value;
    const docId = document.getElementById('adm-doctor').value;
    const docObj = state.users.find(u => u.id === docId);
    const triageVal = document.getElementById('adm-triage').value;
    const stayCostVal = parseFloat(document.getElementById('adm-stay-cost').value) || 0;
    const reasonSummary = document.getElementById('adm-reason-summary').value;
    const reasonDetail = document.getElementById('adm-reason').value;

    // Tomar signos vitales
    const t = parseFloat(document.getElementById('adm-vit-temp').value);
    const sys = parseInt(document.getElementById('adm-vit-bpsys').value);
    const dia = parseInt(document.getElementById('adm-vit-bpdia').value);
    const hr = parseInt(document.getElementById('adm-vit-hr').value);
    const rr = parseInt(document.getElementById('adm-vit-rr').value);
    const ox = parseInt(document.getElementById('adm-vit-ox').value);
    const glu = document.getElementById('adm-vit-glu').value ? parseInt(document.getElementById('adm-vit-glu').value) : null;

    const vitalsObj = {
      date: new Date().toISOString(),
      temp: t,
      bp_systolic: sys,
      bp_diastolic: dia,
      heart_rate: hr,
      resp_rate: rr,
      oxygen: ox,
      glucose: glu,
      weight: patientObj.weight || 70.0,
      height: patientObj.height || 1.70,
      bmi: patientObj.bmi || 24.2
    };

    // Actualizar signos del paciente
    patientObj.vitalSigns = patientObj.vitalSigns || [];
    patientObj.vitalSigns.unshift(vitalsObj);

    // Crear expediente de emergencia
    const emergId = 'emerg-' + Date.now();
    const emergRecord = {
      id: emergId,
      patientId: pId,
      patientName: patientObj.name,
      bedName: bedName,
      doctorName: docObj.name,
      doctorId: docObj.id,
      triageColor: triageVal,
      stayCost: stayCostVal,
      admissionReason: reasonSummary,
      admissionDetail: reasonDetail,
      admissionDate: new Date().toISOString(),
      dischargeDate: null,
      status: 'Activo',
      initialVitals: vitalsObj,
      evolutions: [],
      nursingNotes: [],
      consumedMedicines: [],
      consumedSupplies: [],
      consumedLabs: [],
      consumedImaging: []
    };

    state.emergencias = state.emergencias || [];
    state.emergencias.unshift(emergRecord);

    setActivePatientId(pId);
    saveAppState(state);

    alert(`Ingreso a Emergencia completado para el paciente ${patientObj.name} en la ${bedName}`);
    renderEmergencias(document.getElementById('module-container'));
  });
}

// 6. Renderizar pestaña de Evolución Médica
function renderEvolucionTab(activeEmerg, patient) {
  const container = document.getElementById('emerg-tab-content');
  if (!container) return;

  const state = getAppState();

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; flex-wrap: wrap;">
      
      <!-- Columna Izquierda: Historial de Notas y Nueva Nota -->
      <div class="glass-card" style="padding: 1.25rem; display: flex; flex-direction: column;">
        <h3 style="color: var(--accent-primary); margin-bottom: 1rem; font-size: 1.1rem;">Evoluciones Médicas</h3>
        
        <form id="emerg-evolution-form" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1.25rem;">
          <div class="form-group">
            <label>Médico que realiza la evolución</label>
            <select id="emerg-evo-doctor" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              <!-- Se inyectan médicos -->
            </select>
          </div>
          <div class="form-group">
            <label>Nota Clínico / Evolución Médica</label>
            <textarea id="emerg-evo-note" required rows="3" placeholder="Nota S.O.A.P., estado actual del paciente, cambios hemodinámicos, plan..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical; font-size: 0.88rem;"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; font-size: 0.85rem; padding: 10px;">💾 Guardar Nota de Evolución</button>
        </form>

        <div style="max-height: 350px; overflow-y: auto;">
          <h4 style="margin-bottom: 8px; font-size: 0.9rem; color: var(--text-muted);">Historial de Notas de Evolución</h4>
          ${activeEmerg.evolutions && activeEmerg.evolutions.length > 0 
            ? activeEmerg.evolutions.map(e => `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 10px; border-radius: 4px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="font-size: 0.72rem; color: var(--accent-primary); font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span>📅 ${new Date(e.date).toLocaleString('es-GT')} | Dr. ${e.doctorName}</span>
                    <button class="btn btn-secondary btn-small btn-print-evo" data-id="${e.id}" style="padding: 3px 6px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px;">🖨️ Imprimir</button>
                  </div>
                  <p style="margin: 0; font-size: 0.85rem; color: var(--text-primary); white-space: pre-wrap; line-height: 1.3;">${e.note}</p>
                </div>
              `).join('')
            : `<p style="font-style: italic; color: var(--text-muted); font-size: 0.85rem;">No hay notas de evolución registradas aún.</p>`
          }
        </div>
      </div>

      <!-- Columna Derecha: Órdenes y Tratamiento de esta nota (Ingreso Manual) -->
      <div class="glass-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 12px;">
        <h3 style="color: var(--accent-secondary); margin-bottom: 1rem; font-size: 1.1rem;">Prescripciones / Órdenes Médicas</h3>
        
        <form id="emerg-prescription-form" style="display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 1.25rem;">
          <div class="form-group">
            <label>Médico que indica la orden</label>
            <select id="emerg-presc-doctor" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              <!-- Se inyectan médicos -->
            </select>
          </div>
          <div class="form-group">
            <label>Indicaciones de la Prescripción / Órden:</label>
            <textarea id="emerg-evo-orders-manual" rows="6" placeholder="Escriba aquí los medicamentos, dosis, laboratorios o estudios de imagenología que el paciente requiera..." style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical; font-size: 0.88rem; line-height: 1.4;" required></textarea>
          </div>
          <button type="submit" class="btn btn-secondary" style="width: 100%; font-size: 0.85rem; padding: 10px;">💾 Guardar Prescripción / Órdenes</button>
        </form>

        <div style="max-height: 350px; overflow-y: auto;">
          <h4 style="margin-bottom: 8px; font-size: 0.9rem; color: var(--text-muted);">Historial de Prescripciones</h4>
          ${activeEmerg.prescriptions && activeEmerg.prescriptions.length > 0 
            ? activeEmerg.prescriptions.map(p => `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 10px; border-radius: 4px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="font-size: 0.72rem; color: var(--accent-secondary); font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span>📅 ${new Date(p.date).toLocaleString('es-GT')} | Dr. ${p.doctorName}</span>
                    <button class="btn btn-secondary btn-small btn-print-presc" data-id="${p.id}" style="padding: 3px 6px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px;">🖨️ Imprimir</button>
                  </div>
                  <p style="margin: 0; font-size: 0.85rem; color: var(--text-primary); white-space: pre-wrap; line-height: 1.3;">${p.orders}</p>
                </div>
              `).join('')
            : `<p style="font-style: italic; color: var(--text-muted); font-size: 0.85rem;">No hay prescripciones registradas aún.</p>`
          }
        </div>
      </div>
    </div>
  `;

  // Poblar médicos
  const doctorSelect = document.getElementById('emerg-evo-doctor');
  const prescDoctorSelect = document.getElementById('emerg-presc-doctor');
  const doctors = state.users.filter(u => {
    const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return r.includes('medico') || r.includes('admin') || r.includes('administrador');
  });

  if (doctorSelect) {
    doctorSelect.innerHTML = doctors.map(d => `<option value="${d.id}" ${d.name === activeEmerg.doctorName ? 'selected' : ''}>${d.name}</option>`).join('');
  }
  if (prescDoctorSelect) {
    prescDoctorSelect.innerHTML = doctors.map(d => `<option value="${d.id}" ${d.name === activeEmerg.doctorName ? 'selected' : ''}>${d.name}</option>`).join('');
  }

  // Bind Evolutions Form Submit
  document.getElementById('emerg-evolution-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const noteVal = document.getElementById('emerg-evo-note').value;
    const docId = document.getElementById('emerg-evo-doctor').value;
    const docObj = state.users.find(u => u.id === docId);

    const newEvo = {
      id: 'evo-' + Date.now(),
      date: new Date().toISOString(),
      doctorName: docObj.name,
      doctorId: docObj.id,
      note: noteVal,
      meds: [],
      labs: [],
      images: []
    };

    activeEmerg.evolutions = activeEmerg.evolutions || [];
    activeEmerg.evolutions.push(newEvo);

    saveAppState(state);
    alert("Nota de evolución guardada correctamente.");
    renderEvolucionTab(activeEmerg, patient);
  });

  // Bind Prescriptions Form Submit
  document.getElementById('emerg-prescription-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const ordersVal = document.getElementById('emerg-evo-orders-manual').value;
    const docId = document.getElementById('emerg-presc-doctor').value;
    const docObj = state.users.find(u => u.id === docId);

    const newPresc = {
      id: 'presc-' + Date.now(),
      date: new Date().toISOString(),
      doctorName: docObj.name,
      doctorId: docObj.id,
      orders: ordersVal
    };

    activeEmerg.prescriptions = activeEmerg.prescriptions || [];
    activeEmerg.prescriptions.push(newPresc);

    saveAppState(state);
    alert("Prescripción guardada correctamente.");
    renderEvolucionTab(activeEmerg, patient);
  });

  // Bind Print Evolutions
  container.querySelectorAll('.btn-print-evo').forEach(btn => {
    btn.addEventListener('click', () => {
      const evoId = btn.getAttribute('data-id');
      const evo = activeEmerg.evolutions.find(e => e.id === evoId);
      printEvoOrPrescDocument(patient, evo, 'evolution', state);
    });
  });

  // Bind Print Prescriptions
  container.querySelectorAll('.btn-print-presc').forEach(btn => {
    btn.addEventListener('click', () => {
      const prescId = btn.getAttribute('data-id');
      const presc = activeEmerg.prescriptions.find(p => p.id === prescId);
      printEvoOrPrescDocument(patient, presc, 'prescription', state);
    });
  });
}

// Función para imprimir nota de evolución o prescripción
function printEvoOrPrescDocument(patient, record, type, state) {
  const modal = document.getElementById('prescription-print-modal');
  const modalTitle = modal ? modal.querySelector('.modal-header h2') : null;
  const previewContainer = document.getElementById('prescription-preview-content');
  const printActionBtn = document.getElementById('btn-print-action');

  if (!modal || !previewContainer || !printActionBtn) return;

  const isEvo = type === 'evolution';
  if (modalTitle) {
    modalTitle.textContent = isEvo 
      ? "Vista Preliminar: Nota de Evolución Médica" 
      : "Vista Preliminar: Prescripción / Orden Médica";
  }
  printActionBtn.innerHTML = `<span>🖨️</span> Imprimir ${isEvo ? 'Evolución' : 'Prescripción'}`;

  const clinic = state.clinicInfo || {};
  const dateFormatted = new Date(record.date).toLocaleDateString('es-GT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const logoUrl = 'assets/logo-Db6-vjaU.jpg';

  previewContainer.innerHTML = `
    <div class="prescription-preview-box" style="color: #000; font-family: sans-serif; padding: 20px;">
      <!-- Encabezado de la clínica -->
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px;">
        <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
          ${clinic.logoData 
            ? `<img src="${clinic.logoData}" style="max-height: 80px; max-width: 200px; object-fit: contain;">` 
            : `<img src="${logoUrl}" style="max-height: 80px; max-width: 200px; object-fit: contain;">`}
          <div>
            <div style="font-weight: bold; font-size: 1.2rem;">${clinic.name || 'HOSPITAL MULTIMEDICA'}</div>
            <div style="font-size: 0.8rem; color: #555; margin-top: 2px;">Atención Médica y Hospitalaria</div>
          </div>
        </div>
        <div style="text-align: right; font-size: 0.8rem; color: #333; line-height: 1.3;">
          📍 ${clinic.address || ''}<br>
          📞 Teléfono: ${clinic.phone || ''}<br>
          ✉️ Email: ${clinic.email || ''}
        </div>
      </div>

      <!-- Título de Documento -->
      <div style="text-align: center; margin: 15px 0; padding: 6px; background-color: #f4f6f8; border: 1px solid #ddd; border-radius: 4px;">
        <strong style="font-size: 1.1rem; text-transform: uppercase;">
          ${isEvo ? 'Nota de Evolución Médica' : 'Prescripción / Orden Médica'}
        </strong>
      </div>

      <!-- Información de Paciente y Médico -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.85rem; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <tr>
          <td style="padding: 4px 0; width: 55%;"><strong>Paciente:</strong> ${patient.name}</td>
          <td style="padding: 4px 0; text-align: right;"><strong>Expediente:</strong> ${patient.id}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Médico:</strong> Dr. ${record.doctorName}</td>
          <td style="padding: 4px 0; text-align: right;"><strong>Fecha/Hora:</strong> ${dateFormatted}</td>
        </tr>
      </table>

      <!-- Contenido de la Nota u Órdenes -->
      <div style="min-height: 250px; font-size: 0.92rem; line-height: 1.6; border: 1px solid #eee; padding: 15px; border-radius: 6px; background: #fff; white-space: pre-wrap; word-wrap: break-word;">
        ${isEvo ? record.note : record.orders}
      </div>

      <!-- Pie de página y Firma -->
      <div style="margin-top: 80px; display: flex; flex-direction: column; align-items: center; width: 100%;">
        <div style="border-top: 1px solid #333; width: 250px; margin-bottom: 5px;"></div>
        <strong style="font-size: 0.85rem; color: #111;">Firma y Sello del Médico</strong>
        <span style="font-size: 0.75rem; color: #666;">Dr. ${record.doctorName}</span>
      </div>
    </div>
  `;

  printActionBtn.onclick = () => {
    window.print();
  };

  modal.style.display = "flex";
}

// 7. Renderizar listado de órdenes en borrador
function renderTempOrders() {
  const container = document.getElementById('emerg-temp-orders-list');
  if (!container) return;

  container.innerHTML = '';

  if (tempMeds.length === 0 && tempLabs.length === 0 && tempImgs.length === 0) {
    container.innerHTML = '<p style="font-style: italic; color: var(--text-muted); margin: 5px 0;">No se han agregado medicamentos o estudios a esta evolución aún.</p>';
    return;
  }

  // Medicamentos
  if (tempMeds.length > 0) {
    const medHeader = document.createElement('div');
    medHeader.style.fontWeight = 'bold';
    medHeader.style.marginTop = '5px';
    medHeader.style.color = 'var(--accent-primary)';
    medHeader.textContent = "Medicamentos:";
    container.appendChild(medHeader);

    tempMeds.forEach((m, idx) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.paddingLeft = '10px';
      
      const details = m.tipoPrescripcion === 'dosis' 
        ? `Dosis: ${m.cantidad_o_dosis} ${m.unidad_medida_dosis} (Costo: Q${parseFloat(m.costo_calculado).toFixed(2)})`
        : (m.tipoPrescripcion === 'unidad' ? `${m.cantidad_o_dosis} uds (Costo: Q${parseFloat(m.costo_calculado).toFixed(2)})` : `${m.qty} cajas (Costo: Q${parseFloat(m.costo_calculado).toFixed(2)})`);

      item.innerHTML = `
        <span>💊 <strong>${m.name}</strong> - ${details}</span>
        <span class="btn-remove-temp" data-type="med" data-idx="${idx}" style="color:var(--accent-danger); cursor:pointer; font-weight:bold; margin-left:8px;">&times;</span>
      `;
      container.appendChild(item);
    });
  }

  // Laboratorios
  if (tempLabs.length > 0) {
    const labHeader = document.createElement('div');
    labHeader.style.fontWeight = 'bold';
    labHeader.style.marginTop = '5px';
    labHeader.style.color = 'var(--accent-secondary)';
    labHeader.textContent = "Exámenes de Laboratorio:";
    container.appendChild(labHeader);

    tempLabs.forEach((l, idx) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.paddingLeft = '10px';
      item.innerHTML = `
        <span>🔬 ${l.name} (Q${parseFloat(l.price).toFixed(2)})</span>
        <span class="btn-remove-temp" data-type="lab" data-idx="${idx}" style="color:var(--accent-danger); cursor:pointer; font-weight:bold; margin-left:8px;">&times;</span>
      `;
      container.appendChild(item);
    });
  }

  // Imagenología
  if (tempImgs.length > 0) {
    const imgHeader = document.createElement('div');
    imgHeader.style.fontWeight = 'bold';
    imgHeader.style.marginTop = '5px';
    imgHeader.style.color = 'var(--accent-success)';
    imgHeader.textContent = "Estudios de Imagen:";
    container.appendChild(imgHeader);

    tempImgs.forEach((i, idx) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.paddingLeft = '10px';
      item.innerHTML = `
        <span>🖼️ ${i.name} (Q${parseFloat(i.price).toFixed(2)})</span>
        <span class="btn-remove-temp" data-type="img" data-idx="${idx}" style="color:var(--accent-danger); cursor:pointer; font-weight:bold; margin-left:8px;">&times;</span>
      `;
      container.appendChild(item);
    });
  }

  // Bind Remove Buttons
  document.querySelectorAll('.btn-remove-temp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = btn.getAttribute('data-type');
      const idx = parseInt(btn.getAttribute('data-idx'));
      if (type === 'med') tempMeds.splice(idx, 1);
      else if (type === 'lab') tempLabs.splice(idx, 1);
      else if (type === 'img') tempImgs.splice(idx, 1);
      renderTempOrders();
    });
  });
}

// 8. Modales de Selección de Órdenes (Medicamentos y Insumos)
function showMedsOrderModal(patient) {
  const state = getAppState();
  const modal = document.getElementById('checklist-modal');
  if (!modal) return;

  const modalBody = document.getElementById('checklist-modal-body') || modal.querySelector('.modal-body');
  const modalHeader = modal.querySelector('.modal-header h2') || modal.querySelector('h2');
  if (!modalBody) return;

  if (modalHeader) modalHeader.textContent = "Recetar Medicamento - Emergencias";

  hideChecklistDefaultElements(modal);

  const modalContentEl = modal.querySelector('.modal-content');
  if (modalContentEl) {
    modalContentEl.style.maxWidth = '850px';
    modalContentEl.style.width = '95%';
  }

  modalBody.innerHTML = `
    <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; min-height: 380px; align-items: start;">
      <!-- Columna Izquierda: Buscar y Listar -->
      <div style="border-right: 1px solid var(--border-color); padding-right: 15px;">
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px; font-size: 0.85rem;">Buscar Medicamento</label>
          <input type="text" id="hosp-med-search" placeholder="Escriba nombre o principio activo..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
        </div>
        <div style="max-height: 290px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(0,0,0,0.1);">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); text-align: left; background: rgba(255,255,255,0.02);">
                <th style="padding: 8px;">Medicamento</th>
                <th style="padding: 8px; text-align: right;">Precio</th>
                <th style="padding: 8px; text-align: right;">Stock</th>
              </tr>
            </thead>
            <tbody id="hosp-med-results-body">
              <!-- Se llena con searchMedications() -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Columna Derecha: Configurar dosis y agregar -->
      <div id="hosp-prescribe-form-area" style="display: flex; flex-direction: column; gap: 12px;">
        <div style="text-align: center; color: var(--text-muted); padding-top: 50px;">
          <span style="font-size: 2.5rem;">💊</span>
          <p style="margin-top: 8px; font-size: 0.9rem;">Seleccione un medicamento de la lista para especificar la dosificación y tipo de despacho.</p>
        </div>
      </div>
    </div>
  `;

  // Bind Search Input
  const medSearch = document.getElementById('hosp-med-search');
  if (medSearch) {
    medSearch.addEventListener('input', () => {
      searchMedications(medSearch.value.trim());
    });
  }

  // Initial Search
  searchMedications('');
  modal.style.display = 'flex';
}

function searchMedications(query) {
  const state = getAppState();
  const tbody = document.getElementById('hosp-med-results-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  const queryLower = query.toLowerCase();

  // Filtrar solo medicamentos que tengan stock y que pertenezcan a la categoría Farmacia o tengan precio
  const filtered = (state.medications || []).filter(m => {
    const nameNorm = String(m.name || '').toLowerCase();
    const genericNorm = String(m.generic || '').toLowerCase();
    return (nameNorm.includes(queryLower) || genericNorm.includes(queryLower));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--text-muted);">No se encontraron medicamentos</td></tr>`;
    return;
  }

  filtered.forEach(m => {
    const med = enrichMedication(m);
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    tr.innerHTML = `
      <td style="padding: 8px;">
        <strong>${med.name}</strong><br>
        <span style="font-size: 0.72rem; color: var(--text-muted);">${med.presentation} | Lote: ${med.lote}</span>
      </td>
      <td style="padding: 8px; text-align: right;">Q${parseFloat(med.price).toFixed(2)}</td>
      <td style="padding: 8px; text-align: right; color: ${med.stock > 5 ? '#22c55e' : '#ef4444'}; font-weight: bold;">${med.stock}</td>
    `;

    tr.addEventListener('click', () => {
      document.querySelectorAll('#hosp-med-results-body tr').forEach(r => r.style.background = 'none');
      tr.style.background = 'rgba(37,99,235,0.15)';
      loadPrescriptionForm(med);
    });

    tbody.appendChild(tr);
  });
}

function loadPrescriptionForm(med) {
  const formArea = document.getElementById('hosp-prescribe-form-area');
  if (!formArea) return;

  formArea.innerHTML = `
    <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
      <h4 style="margin: 0 0 5px 0; color: var(--accent-primary); font-size: 0.95rem;">${med.name}</h4>
      <div style="font-size: 0.75rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
        <span>📦 Presentación: <strong>${med.presentation}</strong></span>
        <span>⚖️ Unidades/Caja: <strong>${med.unidades_por_presentacion} uds</strong></span>
        <span>💧 Dosis/Frasco: <strong>${med.dosis_total_presentacion} ${med.unidad_medida_dosis}</strong></span>
        <span>🏷️ Lote: <strong>${med.lote}</strong></span>
      </div>
    </div>

    <form id="hosp-add-med-submit-form" style="display: flex; flex-direction: column; gap: 10px;">
      <div class="form-group">
        <label style="font-size: 0.8rem;">Tipo de Despacho / Cobro</label>
        <select id="h-pres-type" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          <option value="caja">Presentación Completa (Caja/Frasco entero)</option>
          <option value="unidad">Unidad Individual (Tabletas sueltas/Ampolla)</option>
          <option value="dosis" ${med.es_fraccionable ? '' : 'disabled'}>Dosis Específica (Jarabe en ml / Dosis inyectable en mg) ${med.es_fraccionable ? '' : '[No Fraccionable]'}</option>
        </select>
      </div>

      <div class="form-group" id="h-qty-container">
        <label id="h-qty-label" style="font-size: 0.8rem;">Cantidad de Presentaciones</label>
        <input type="number" id="h-med-qty" required min="1" step="1" value="1" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
      </div>

      <div style="background: rgba(0,0,0,0.15); padding: 10px; border-radius: 4px; border: 1px dashed var(--border-color); text-align: center;">
        <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">Costo Estimado a Facturar:</span>
        <strong id="h-cost-preview" style="font-size: 1.25rem; color: var(--accent-success);">Q${parseFloat(med.price).toFixed(2)}</strong>
      </div>

      <button type="submit" class="btn btn-success" style="width: 100%; font-size: 0.85rem; padding: 10px; background: var(--accent-success); border: none;">Agregar a la Receta</button>
    </form>
  `;

  const presSelect = document.getElementById('h-pres-type');
  const qtyInput = document.getElementById('h-med-qty');
  const qtyLabel = document.getElementById('h-qty-label');
  const costPreview = document.getElementById('h-cost-preview');

  const updateCost = () => {
    const type = presSelect.value;
    const qtyVal = parseFloat(qtyInput.value) || 0;
    let cost = 0;

    if (type === 'caja') {
      cost = qtyVal * med.price;
    } else if (type === 'unidad') {
      cost = qtyVal * (med.price / med.unidades_por_presentacion);
    } else if (type === 'dosis') {
      cost = qtyVal * (med.price / med.dosis_total_presentacion);
    }

    costPreview.textContent = `Q${cost.toFixed(2)}`;
  };

  presSelect.addEventListener('change', () => {
    const type = presSelect.value;
    if (type === 'caja') {
      qtyLabel.textContent = "Cantidad de Presentaciones (Cajas/Frascos)";
      qtyInput.step = "1";
      qtyInput.value = "1";
    } else if (type === 'unidad') {
      qtyLabel.textContent = "Cantidad de Unidades Individuales (Tabletas/Ampollas)";
      qtyInput.step = "1";
      qtyInput.value = "1";
    } else if (type === 'dosis') {
      qtyLabel.textContent = `Dosis Específica a Administrar (${med.unidad_medida_dosis})`;
      qtyInput.step = "0.5";
      qtyInput.value = "5";
    }
    updateCost();
  });

  qtyInput.addEventListener('input', updateCost);

  // Submit Prescribe Form
  document.getElementById('hosp-add-med-submit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = presSelect.value;
    const qtyVal = parseFloat(qtyInput.value) || 0;

    // Validar stock físico
    if (type === 'caja' && qtyVal > med.stock) {
      alert(`Stock insuficiente. Solo quedan ${med.stock} cajas.`);
      return;
    }
    if (type === 'unidad') {
      const neededUnits = qtyVal;
      const totalUnits = med.stock * med.unidades_por_presentacion;
      if (neededUnits > totalUnits) {
        alert(`Stock insuficiente. Quedan ${totalUnits} unidades sueltas equivalentes.`);
        return;
      }
    }
    if (type === 'dosis') {
      if (qtyVal > med.dosis_total_presentacion) {
        alert(`La dosis prescrita (${qtyVal} ${med.unidad_medida_dosis}) excede la dosis total de una presentación (${med.dosis_total_presentacion} ${med.unidad_medida_dosis}). Deberá prescribir múltiples presentaciones completas si es necesario.`);
        return;
      }
    }

    let cost = 0;
    if (type === 'caja') cost = qtyVal * med.price;
    else if (type === 'unidad') cost = qtyVal * (med.price / med.unidades_por_presentacion);
    else if (type === 'dosis') cost = qtyVal * (med.price / med.dosis_total_presentacion);

    const medOrderRecord = {
      id: med.id,
      name: med.name,
      lote: med.lote,
      qty: type === 'caja' ? qtyVal : 1,
      price: med.price,
      tipoPrescripcion: type,
      cantidad_o_dosis: qtyVal,
      costo_calculado: cost,
      unidad_medida_dosis: med.unidad_medida_dosis,
      date: new Date().toISOString()
    };

    tempMeds.push(medOrderRecord);
    
    // Close modal
    const modal = document.getElementById('checklist-modal');
    if (modal) {
      modal.style.display = 'none';
      restoreChecklistModal();
    }

    renderTempOrders();
  });
}

function showLabsOrderModal(activeEmerg) {
  const state = getAppState();
  const modal = document.getElementById('checklist-modal');
  if (!modal) return;

  const modalBody = document.getElementById('checklist-modal-body') || modal.querySelector('.modal-body');
  const modalHeader = modal.querySelector('.modal-header h2') || modal.querySelector('h2');
  if (!modalBody) return;

  if (modalHeader) modalHeader.textContent = "Solicitar Laboratorios - Emergencias";

  hideChecklistDefaultElements(modal);

  const modalContentEl = modal.querySelector('.modal-content');
  if (modalContentEl) {
    modalContentEl.style.maxWidth = '600px';
    modalContentEl.style.width = '90%';
  }

  modalBody.innerHTML = `
    <div style="margin-bottom: 12px;">
      <input type="text" id="h-lab-search" placeholder="🔍 Buscar examen de laboratorio..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
    </div>
    <div style="max-height: 280px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color); text-align: left; background: rgba(255,255,255,0.02);">
            <th style="padding: 8px;">Examen</th>
            <th style="padding: 8px; text-align: right;">Precio</th>
            <th style="padding: 8px; text-align: center;">Acción</th>
          </tr>
        </thead>
        <tbody id="h-lab-results-body">
          <!-- Se inyecta -->
        </tbody>
      </table>
    </div>
  `;

  const labSearch = document.getElementById('h-lab-search');
  const renderLabs = (query) => {
    const tbody = document.getElementById('h-lab-results-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const q = query.toLowerCase();

    const filtered = (state.laboratoryTests || []).filter(l => l.name.toLowerCase().includes(q));
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--text-muted);">No se encontraron exámenes</td></tr>`;
      return;
    }

    filtered.forEach(l => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      tr.innerHTML = `
        <td style="padding: 8px;"><strong>${l.name}</strong></td>
        <td style="padding: 8px; text-align: right;">Q${parseFloat(l.price).toFixed(2)}</td>
        <td style="padding: 8px; text-align: center;">
          <button class="btn btn-success btn-small btn-add-lab-item" data-id="${l.id}" style="background: var(--accent-success); border: none;">Agregar</button>
        </td>
      `;

      tr.querySelector('.btn-add-lab-item').addEventListener('click', () => {
        tempLabs.push({ id: l.id, name: l.name, price: l.price });
        modal.style.display = 'none';
        restoreChecklistModal();
        renderTempOrders();
      });

      tbody.appendChild(tr);
    });
  };

  labSearch.addEventListener('input', () => renderLabs(labSearch.value.trim()));
  renderLabs('');
  modal.style.display = 'flex';
}

function showImgsOrderModal(activeEmerg) {
  const state = getAppState();
  const modal = document.getElementById('checklist-modal');
  if (!modal) return;

  const modalBody = document.getElementById('checklist-modal-body') || modal.querySelector('.modal-body');
  const modalHeader = modal.querySelector('.modal-header h2') || modal.querySelector('h2');
  if (!modalBody) return;

  if (modalHeader) modalHeader.textContent = "Solicitar Imagenología - Emergencias";

  hideChecklistDefaultElements(modal);

  const modalContentEl = modal.querySelector('.modal-content');
  if (modalContentEl) {
    modalContentEl.style.maxWidth = '600px';
    modalContentEl.style.width = '90%';
  }

  modalBody.innerHTML = `
    <div style="margin-bottom: 12px;">
      <input type="text" id="h-img-search" placeholder="🔍 Buscar estudio de imagen (Rayos X, Ultrasonido)..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
    </div>
    <div style="max-height: 280px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color); text-align: left; background: rgba(255,255,255,0.02);">
            <th style="padding: 8px;">Estudio</th>
            <th style="padding: 8px; text-align: right;">Precio</th>
            <th style="padding: 8px; text-align: center;">Acción</th>
          </tr>
        </thead>
        <tbody id="h-img-results-body">
          <!-- Se inyecta -->
        </tbody>
      </table>
    </div>
  `;

  const imgSearch = document.getElementById('h-img-search');
  const renderImgs = (query) => {
    const tbody = document.getElementById('h-img-results-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const q = query.toLowerCase();

    const filtered = (state.imagingStudies || []).filter(i => i.name.toLowerCase().includes(q));
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--text-muted);">No se encontraron estudios</td></tr>`;
      return;
    }

    filtered.forEach(i => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      tr.innerHTML = `
        <td style="padding: 8px;"><strong>${i.name}</strong></td>
        <td style="padding: 8px; text-align: right;">Q${parseFloat(i.price).toFixed(2)}</td>
        <td style="padding: 8px; text-align: center;">
          <button class="btn btn-success btn-small btn-add-img-item" data-id="${i.id}" style="background: var(--accent-success); border: none;">Agregar</button>
        </td>
      `;

      tr.querySelector('.btn-add-img-item').addEventListener('click', () => {
        tempImgs.push({ id: i.id, name: i.name, price: i.price });
        modal.style.display = 'none';
        restoreChecklistModal();
        renderTempOrders();
      });

      tbody.appendChild(tr);
    });
  };

  imgSearch.addEventListener('input', () => renderImgs(imgSearch.value.trim()));
  renderImgs('');
  modal.style.display = 'flex';
}

// 9. Renderizar pestaña de Enfermería y Notas
function renderEnfermeriaTab(activeEmerg, patient) {
  const container = document.getElementById('emerg-tab-content');
  if (!container) return;

  const state = getAppState();

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; flex-wrap: wrap;">
      
      <!-- Columna Izquierda: Monitoreo de Signos Vitales -->
      <div class="glass-card" style="padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="color: var(--accent-primary); margin: 0; font-size: 1.1rem;">Signos Vitales</h3>
          <button class="btn btn-success btn-small" id="btn-add-vitals" style="background: var(--accent-success); border: none; font-size: 0.75rem;">➕ Registrar Signos</button>
        </div>

        <div style="max-height: 380px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: center;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); background: rgba(255,255,255,0.02);">
                <th style="padding: 6px; text-align: left;">Hora</th>
                <th style="padding: 6px;">T (°C)</th>
                <th style="padding: 6px;">P.A.</th>
                <th style="padding: 6px;">FC</th>
                <th style="padding: 6px;">SPO2</th>
                <th style="padding: 6px;">Gluc.</th>
              </tr>
            </thead>
            <tbody>
              ${patient.vitalSigns && patient.vitalSigns.length > 0 
                ? patient.vitalSigns.map(v => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                      <td style="padding: 6px; text-align: left; font-size: 0.72rem; color: var(--text-muted);">${new Date(v.date).toLocaleTimeString('es-GT', {hour: '2-digit', minute:'2-digit'})}</td>
                      <td style="padding: 6px; font-weight: bold;">${v.temp || 'N/A'}</td>
                      <td style="padding: 6px;">${v.bp_systolic || 'N/A'}/${v.bp_diastolic || 'N/A'}</td>
                      <td style="padding: 6px;">${v.heart_rate || 'N/A'}</td>
                      <td style="padding: 6px;">${v.oxygen || 'N/A'}%</td>
                      <td style="padding: 6px;">${v.glucose || 'N/A'}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="6" style="padding: 20px; color: var(--text-muted); font-style: italic;">No hay registros de signos vitales.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Columna Derecha: Notas de Enfermería e Insumos -->
      <div class="glass-card" style="padding: 1.25rem;">
        <h3 style="color: var(--accent-secondary); margin-bottom: 1rem; font-size: 1.1rem;">Notas de Enfermería y Administración de Insumos</h3>
        
        <form id="emerg-nursing-form" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1.25rem;">
          <div class="form-group">
            <label>Nota / Evolución de Enfermería</label>
            <textarea id="emerg-nurse-note" required rows="2" placeholder="Describa la evolución del paciente, cuidados brindados, insumos administrados..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical; font-size: 0.85rem;"></textarea>
          </div>

          <!-- Selección de Insumos/Materiales de Bodega General -->
          <div style="border: 1px dashed var(--border-color); padding: 10px; border-radius: 4px; background: rgba(0,0,0,0.1);">
            <h4 style="margin: 0 0 8px 0; font-size: 0.82rem; color: var(--accent-primary);">Insumos Utilizados (Bodega General)</h4>
            <div style="display: flex; gap: 8px;">
              <select id="emerg-nurse-supply-select" style="flex: 2; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.8rem;">
                <!-- Se inyectan materiales de bodega -->
              </select>
              <input type="number" id="emerg-nurse-supply-qty" min="1" step="1" value="1" style="width: 60px; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.8rem;">
              <button type="button" class="btn btn-secondary btn-small" id="btn-add-nurse-supply" style="font-size: 0.75rem; padding: 6px 10px;">➕ Agregar</button>
            </div>

            <div id="emerg-selected-supplies-list" style="margin-top: 8px; font-size: 0.8rem; display: flex; flex-direction: column; gap: 4px;">
              <!-- Lista de insumos cargada dinámicamente -->
            </div>
          </div>

          <button type="submit" class="btn btn-success" style="width: 100%; font-size: 0.85rem; padding: 10px; background: var(--accent-secondary); border: none;">Guardar Nota de Enfermería</button>
        </form>

        <div style="max-height: 200px; overflow-y: auto;">
          <h4 style="margin-bottom: 8px; font-size: 0.9rem; color: var(--text-muted);">Historial de Notas de Enfermería</h4>
          ${activeEmerg.nursingNotes && activeEmerg.nursingNotes.length > 0 
            ? activeEmerg.nursingNotes.map(n => `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 10px; border-radius: 4px; margin-bottom: 8px;">
                  <div style="font-size: 0.72rem; color: var(--accent-secondary); font-weight: bold; margin-bottom: 4px;">📅 ${new Date(n.date).toLocaleString('es-GT')} | Enfermero/a</div>
                  <p style="margin: 0; font-size: 0.85rem; color: var(--text-primary); white-space: pre-wrap; line-height: 1.3;">${n.note}</p>
                  ${n.supplies && n.supplies.length > 0 
                    ? `<div style="font-size: 0.75rem; color: var(--accent-primary); margin-top: 5px;">📦 Insumos: ${n.supplies.map(s => `${s.name} (x${s.qty})`).join(', ')}</div>` 
                    : ''}
                </div>
              `).join('')
            : `<p style="font-style: italic; color: var(--text-muted); font-size: 0.85rem;">No hay notas de enfermería registradas aún.</p>`
          }
        </div>
      </div>
    </div>
  `;

  // Poblar insumos/materiales (Bodega General)
  const supplySelect = document.getElementById('emerg-nurse-supply-select');
  if (supplySelect) {
    const supplyItems = (state.medications || []).filter(m => m.category === 'Bodega General' || m.category === 'Bodega');
    supplySelect.innerHTML = `<option value="">-- Seleccionar material --</option>` + supplyItems.map(m => `<option value="${m.id}">[Stock: ${m.stock}] ${m.name}</option>`).join('');
  }

  // Bind Add Supply Button
  document.getElementById('btn-add-nurse-supply').addEventListener('click', () => {
    const select = document.getElementById('emerg-nurse-supply-select');
    const qtyInput = document.getElementById('emerg-nurse-supply-qty');
    const medId = select.value;
    const qty = parseInt(qtyInput.value) || 1;

    if (!medId) {
      alert("Seleccione un insumo para agregar.");
      return;
    }

    const med = state.medications.find(m => m.id === medId);
    if (med) {
      if (qty > med.stock) {
        alert(`Stock insuficiente de ${med.name}. Solo quedan ${med.stock} unidades.`);
        return;
      }

      // Check if already in list
      const existing = tempNurseSupplies.find(s => s.id === med.id);
      if (existing) {
        existing.qty += qty;
      } else {
        tempNurseSupplies.push({
          id: med.id,
          name: med.name,
          qty: qty,
          price: med.price,
          costo_calculado: qty * med.price
        });
      }

      renderTempNurseSuppliesList();
      select.value = '';
      qtyInput.value = '1';
    }
  });

  // Bind Note Submit
  document.getElementById('emerg-nursing-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const noteVal = document.getElementById('emerg-nurse-note').value;

    const newNursingNote = {
      id: 'nn-' + Date.now(),
      date: new Date().toISOString(),
      note: noteVal,
      supplies: [...tempNurseSupplies]
    };

    activeEmerg.nursingNotes = activeEmerg.nursingNotes || [];
    activeEmerg.nursingNotes.push(newNursingNote);

    // Mudar insumos a los consumos globales de la emergencia
    activeEmerg.consumedSupplies = activeEmerg.consumedSupplies || [];
    activeEmerg.consumedSupplies.push(...tempNurseSupplies);

    // Descontar inventario de insumos
    tempNurseSupplies.forEach(ts => {
      const med = state.medications.find(m => m.id === ts.id);
      if (med) {
        med.stock = Math.max(0, med.stock - ts.qty);
      }
    });

    tempNurseSupplies = [];
    saveAppState(state);

    alert("Nota de enfermería guardada e insumos cargados correctamente.");
    renderEmergDashboard();
  });

  // Bind Vitals Modal button
  document.getElementById('btn-add-vitals').addEventListener('click', () => {
    showVitalsModal(patient);
  });

  renderTempNurseSuppliesList();
}

function renderTempNurseSuppliesList() {
  const container = document.getElementById('emerg-selected-supplies-list');
  if (!container) return;

  container.innerHTML = '';
  if (tempNurseSupplies.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Ningún insumo seleccionado aún.</span>';
    return;
  }

  tempNurseSupplies.forEach((s, idx) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.background = 'rgba(255,255,255,0.02)';
    div.style.padding = '4px 8px';
    div.style.borderRadius = '4px';
    div.innerHTML = `
      <span>📦 ${s.name} (x${s.qty}) - Q${s.costo_calculado.toFixed(2)}</span>
      <span class="btn-remove-supply" data-idx="${idx}" style="color:var(--accent-danger); cursor:pointer; font-weight:bold;">&times;</span>
    `;

    div.querySelector('.btn-remove-supply').addEventListener('click', () => {
      tempNurseSupplies.splice(idx, 1);
      renderTempNurseSuppliesList();
    });

    container.appendChild(div);
  });
}

function showVitalsModal(patient) {
  const state = getAppState();
  const modal = document.getElementById('checklist-modal');
  if (!modal) return;

  const modalBody = document.getElementById('checklist-modal-body') || modal.querySelector('.modal-body');
  const modalHeader = modal.querySelector('.modal-header h2') || modal.querySelector('h2');
  if (!modalBody) return;

  if (modalHeader) modalHeader.textContent = "Registrar Signos Vitales";

  const modalContentEl = modal.querySelector('.modal-content');
  if (modalContentEl) {
    modalContentEl.style.maxWidth = '500px';
    modalContentEl.style.width = '90%';
  }

  modalBody.innerHTML = `
    <form id="emerg-vitals-form" style="display: flex; flex-direction: column; gap: 12px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="form-group">
          <label>Temperatura (°C)</label>
          <input type="number" step="0.1" id="v-temp" required placeholder="36.5" style="width: 100%; padding: 8px; border-radius: 4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
        </div>
        <div class="form-group">
          <label>P.A. Sistólica</label>
          <input type="number" id="v-bpsys" required placeholder="120" style="width: 100%; padding: 8px; border-radius: 4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
        </div>
        <div class="form-group">
          <label>P.A. Diastólica</label>
          <input type="number" id="v-bpdia" required placeholder="80" style="width: 100%; padding: 8px; border-radius: 4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
        </div>
        <div class="form-group">
          <label>Pulso / F.C.</label>
          <input type="number" id="v-hr" required placeholder="75" style="width: 100%; padding: 8px; border-radius: 4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
        </div>
        <div class="form-group">
          <label>F. Resp. (RPM)</label>
          <input type="number" id="v-rr" required placeholder="16" style="width: 100%; padding: 8px; border-radius: 4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
        </div>
        <div class="form-group">
          <label>Saturación O2 (%)</label>
          <input type="number" id="v-ox" required placeholder="98" style="width: 100%; padding: 8px; border-radius: 4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label>Glucosa (mg/dL) [Opcional]</label>
          <input type="number" id="v-glu" placeholder="95" style="width: 100%; padding: 8px; border-radius: 4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
        </div>
      </div>
      <button type="submit" class="btn btn-success" style="width:100%; padding:10px; margin-top:8px;">Guardar Signos Vitales</button>
    </form>
  `;

  document.getElementById('emerg-vitals-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = parseFloat(document.getElementById('v-temp').value);
    const sys = parseInt(document.getElementById('v-bpsys').value);
    const dia = parseInt(document.getElementById('v-bpdia').value);
    const hr = parseInt(document.getElementById('v-hr').value);
    const rr = parseInt(document.getElementById('v-rr').value);
    const ox = parseInt(document.getElementById('v-ox').value);
    const glu = document.getElementById('v-glu').value ? parseInt(document.getElementById('v-glu').value) : null;

    const vitalsObj = {
      date: new Date().toISOString(),
      temp: t,
      bp_systolic: sys,
      bp_diastolic: dia,
      heart_rate: hr,
      resp_rate: rr,
      oxygen: ox,
      glucose: glu,
      weight: patient.weight || 70.0,
      height: patient.height || 1.70,
      bmi: patient.bmi || 24.2
    };

    patient.vitalSigns = patient.vitalSigns || [];
    patient.vitalSigns.unshift(vitalsObj);

    saveAppState(state);
    modal.style.display = 'none';
    alert("Signos vitales guardados correctamente.");
    renderEmergDashboard();
  });

  modal.style.display = 'flex';
}

// 10. Renderizar pestaña de Detalle de Cuenta
function renderCuentaTab(activeEmerg, patient) {
  const container = document.getElementById('emerg-tab-content');
  if (!container) return;

  const stayCost = parseFloat(activeEmerg.stayCost || 0);
  const medsTotal = (activeEmerg.consumedMedicines || []).reduce((acc, m) => acc + parseFloat(m.costo_calculado), 0);
  const suppliesTotal = (activeEmerg.consumedSupplies || []).reduce((acc, s) => acc + parseFloat(s.costo_calculado), 0);
  const labsTotal = (activeEmerg.consumedLabs || []).reduce((acc, l) => acc + parseFloat(l.price), 0);
  const imgsTotal = (activeEmerg.consumedImaging || []).reduce((acc, i) => acc + parseFloat(i.price), 0);
  
  const grandTotal = stayCost + medsTotal + suppliesTotal + labsTotal + imgsTotal;

  container.innerHTML = `
    <div class="glass-card" style="padding: 1.25rem; border-top: 3px solid var(--accent-success);">
      <h3 style="color: var(--accent-success); margin-bottom: 1rem; font-size: 1.15rem;">Desglose del Estado de Cuenta (Emergencia / Observación)</h3>
      
      <div style="max-height: 350px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; margin-bottom: 1.5rem;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); background: rgba(255,255,255,0.03); font-weight: bold;">
              <th style="padding: 10px;">Concepto</th>
              <th style="padding: 10px; text-align: right; width: 150px;">Costo</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 10px;">🚨 Estancia / Atención de Emergencia (Cargado al Ingreso en ${activeEmerg.bedName})</td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">Q${stayCost.toFixed(2)}</td>
            </tr>
            
            ${activeEmerg.consumedMedicines && activeEmerg.consumedMedicines.length > 0 
              ? activeEmerg.consumedMedicines.map(m => {
                  const desc = m.tipoPrescripcion === 'dosis' 
                    ? `Dosis: ${m.cantidad_o_dosis} ${m.unidad_medida_dosis}` 
                    : (m.tipoPrescripcion === 'unidad' ? `${m.cantidad_o_dosis} uds` : `${m.qty} cajas`);
                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                      <td style="padding: 10px; padding-left: 20px; color: var(--text-muted);">💊 Med: ${m.name} (${desc})</td>
                      <td style="padding: 10px; text-align: right;">Q${parseFloat(m.costo_calculado).toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')
              : ''
            }

            ${activeEmerg.consumedSupplies && activeEmerg.consumedSupplies.length > 0 
              ? activeEmerg.consumedSupplies.map(s => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px; padding-left: 20px; color: var(--text-muted);">📦 Insumo: ${s.name} (x${s.qty})</td>
                    <td style="padding: 10px; text-align: right;">Q${parseFloat(s.costo_calculado).toFixed(2)}</td>
                  </tr>
                `).join('')
              : ''
            }

            ${activeEmerg.consumedLabs && activeEmerg.consumedLabs.length > 0 
              ? activeEmerg.consumedLabs.map(l => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px; padding-left: 20px; color: var(--text-muted);">🔬 Lab: ${l.name}</td>
                    <td style="padding: 10px; text-align: right;">Q${parseFloat(l.price).toFixed(2)}</td>
                  </tr>
                `).join('')
              : ''
            }

            ${activeEmerg.consumedImaging && activeEmerg.consumedImaging.length > 0 
              ? activeEmerg.consumedImaging.map(i => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px; padding-left: 20px; color: var(--text-muted);">🖼️ Imagen: ${i.name}</td>
                    <td style="padding: 10px; text-align: right;">Q${parseFloat(i.price).toFixed(2)}</td>
                  </tr>
                `).join('')
              : ''
            }
          </tbody>
        </table>
      </div>

      <div style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 4px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 1.05rem; font-weight: bold; color: var(--text-primary);">Total Acumulado a la fecha:</span>
        <strong style="font-size: 1.35rem; color: var(--accent-success);">Q${grandTotal.toFixed(2)}</strong>
      </div>
    </div>
  `;
}

// 11. Renderizar formulario de Egreso y Alta / Traslado
function renderDischargeForm(activeEmerg, patient) {
  const state = getAppState();
  const currentUser = state.currentUser;

  // Validar que el alta la emita el médico tratante
  if (currentUser.name !== activeEmerg.doctorName && currentUser.id !== activeEmerg.doctorId) {
    alert(`❌ ACCESO DENEGADO:\nEl cierre clínico del ingreso de emergencias solo puede ser realizado por el médico tratante asignado: ${activeEmerg.doctorName}.`);
    return;
  }

  const dashboardArea = document.getElementById('emerg-dashboard-area');
  if (!dashboardArea) return;

  const stayCost = parseFloat(activeEmerg.stayCost || 0);
  const medsTotal = (activeEmerg.consumedMedicines || []).reduce((acc, m) => acc + parseFloat(m.costo_calculado), 0);
  const suppliesTotal = (activeEmerg.consumedSupplies || []).reduce((acc, s) => acc + parseFloat(s.costo_calculado), 0);
  const labsTotal = (activeEmerg.consumedLabs || []).reduce((acc, l) => acc + parseFloat(l.price), 0);
  const imgsTotal = (activeEmerg.consumedImaging || []).reduce((acc, i) => acc + parseFloat(i.price), 0);
  
  const grandTotal = stayCost + medsTotal + suppliesTotal + labsTotal + imgsTotal;

  dashboardArea.innerHTML = `
    <div class="glass-card" style="padding: 1.5rem; border-top: 3px solid var(--accent-danger);">
      <h3 style="color: var(--accent-danger); margin-bottom: 1.25rem;">Autorizar Alta Médica / Traslado a Encamamiento</h3>
      <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 1.5rem;">
        Complete el resumen de egreso. Puede elegir dar de alta al paciente a su hogar o transferirlo directamente para hospitalizarse en el módulo de Encamamiento.
      </p>

      <form id="emerg-discharge-form" style="display: flex; flex-direction: column; gap: 15px;">
        <div class="form-group">
          <label>Nota / Epicrisis de Emergencia (Resumen de egreso)</label>
          <textarea id="dis-epicrisis" required rows="4" placeholder="Detalle las conclusiones clínicas, indicaciones de egreso para el hogar o indicaciones especiales de traslado..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical;"></textarea>
        </div>

        <div style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.9rem; margin-bottom: 10px;">
          <h4 style="margin-bottom: 5px; color: var(--text-primary);">Detalle de Liquidación de Emergencia:</h4>
          <ul style="list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: 4px;">
            <li>🚨 <strong>Estancia (${activeEmerg.bedName}):</strong> Q${stayCost.toFixed(2)}</li>
            ${medsTotal > 0 ? `<li>💊 <strong>Medicamentos de urgencia:</strong> Q${medsTotal.toFixed(2)}</li>` : ''}
            ${suppliesTotal > 0 ? `<li>📦 Insumos utilizados: Q${suppliesTotal.toFixed(2)}</li>` : ''}
            ${labsTotal > 0 ? `<li>🔬 Exámenes de laboratorio: Q${labsTotal.toFixed(2)}</li>` : ''}
            ${imgsTotal > 0 ? `<li>🖼️ Estudios de imagenología: Q${imgsTotal.toFixed(2)}</li>` : ''}
            <li style="border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 4px; font-size: 1.05rem; font-weight: bold; color: var(--accent-success);">
              💰 Subtotal de Emergencias: Q${grandTotal.toFixed(2)}
            </li>
          </ul>
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-discharge">Volver al Dashboard</button>
          <button type="button" class="btn btn-primary" id="btn-transfer-hosp" style="background: #eab308; color: black; border: none; font-weight: bold;">🛌 Transferir a Encamamiento</button>
          <button type="submit" class="btn btn-danger" style="background: var(--accent-danger); border: none;">🏠 Completar Alta y Egreso a Casa</button>
        </div>
      </form>
    </div>
  `;

  // Cancel click
  document.getElementById('btn-cancel-discharge').addEventListener('click', () => {
    renderEmergDashboard();
  });

  // Transfer click
  document.getElementById('btn-transfer-hosp').addEventListener('click', () => {
    const epicrisisVal = document.getElementById('dis-epicrisis').value;
    if (!epicrisisVal) {
      alert("Por favor, ingrese el Resumen de egreso / Epicrisis antes de realizar el traslado.");
      return;
    }

    // 1. Cargar expediente como Transferido
    activeEmerg.status = 'Transferido';
    activeEmerg.dischargeDate = new Date().toISOString();
    activeEmerg.epicrisis = epicrisisVal;

    // 2. Compilar desglose de factura de Emergencia
    const details = [
      { description: `Emergencia - Estancia en ${activeEmerg.bedName} (Cargado al ingreso)`, amount: stayCost }
    ];

    if (activeEmerg.consumedMedicines && activeEmerg.consumedMedicines.length > 0) {
      activeEmerg.consumedMedicines.forEach(m => {
        const amt = parseFloat(m.costo_calculado);
        const displayQty = m.tipoPrescripcion === 'dosis' 
          ? `${m.cantidad_o_dosis} dosis`
          : (m.tipoPrescripcion === 'unidad' ? `${m.cantidad_o_dosis} uds` : `${m.qty} cajas`);
        details.push({ description: `Emergencia - Med: ${m.name} (${displayQty})`, amount: amt });
      });
    }

    if (activeEmerg.consumedSupplies && activeEmerg.consumedSupplies.length > 0) {
      activeEmerg.consumedSupplies.forEach(s => {
        details.push({ description: `Emergencia - Insumo: ${s.name} (x${s.qty})`, amount: parseFloat(s.costo_calculado) });
      });
    }

    if (activeEmerg.consumedLabs && activeEmerg.consumedLabs.length > 0) {
      activeEmerg.consumedLabs.forEach(l => {
        details.push({ description: `Emergencia - Lab: ${l.name}`, amount: parseFloat(l.price) });
      });
    }

    if (activeEmerg.consumedImaging && activeEmerg.consumedImaging.length > 0) {
      activeEmerg.consumedImaging.forEach(i => {
        details.push({ description: `Emergencia - Imagen: ${i.name}`, amount: parseFloat(i.price) });
      });
    }

    // 3. Crear pre-factura del área de emergencias
    const newBill = {
      id: 'FAC-EMERG-' + Date.now(),
      date: new Date().toISOString(),
      concept: `Atención de Emergencias - Traslado a Encamamiento (Exp. ${activeEmerg.id})`,
      details: details,
      diagnosis: activeEmerg.admissionReason,
      total: grandTotal,
      status: 'Pendiente'
    };

    const patientObj = state.patients.find(p => p.id === patient.id);
    patientObj.billingHistory = patientObj.billingHistory || [];
    patientObj.billingHistory.unshift(newBill);

    saveAppState(state);

    alert(`Paciente ${patient.name} trasladado. Se envió la pre-factura de Emergencia por valor de Q${grandTotal.toFixed(2)} a Caja.`);

    // 4. Redirigir directamente al Formulario de Ingreso de Encamamiento
    router('encamamiento');

    // Pre-poblar el ingreso de encamamiento
    setTimeout(() => {
      const container = document.getElementById('module-container');
      
      // Armar las órdenes de medicamentos del traslado
      const prefilledMedsOrders = (activeEmerg.consumedMedicines || []).map(m => {
        const desc = m.tipoPrescripcion === 'dosis' 
          ? `${m.cantidad_o_dosis} ${m.unidad_medida_dosis}` 
          : (m.tipoPrescripcion === 'unidad' ? `${m.cantidad_o_dosis} unidades` : `${m.qty} cajas`);
        return `${m.name} (${desc}) - Administrado en urgencias.`;
      }).join('\n');

      const prefilledData = {
        origin: 'Emergencia',
        reason: `Traslado desde Emergencia (${activeEmerg.bedName}). Motivo de ingreso: ${activeEmerg.admissionReason}.\nNotas clínicas: ${activeEmerg.admissionDetail}\nEpicrisis del traslado: ${epicrisisVal}`,
        vitals: activeEmerg.initialVitals,
        medsOrders: prefilledMedsOrders,
        consumedMedicines: [] // Los medicamentos se cobran en el cierre de Emergencias, Encamamiento inicia fresco.
      };

      renderAdmissionForm(patient.id, prefilledData);
    }, 150);
  });

  // Submit Discharge (Alta a Casa)
  document.getElementById('emerg-discharge-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const epicrisisVal = document.getElementById('dis-epicrisis').value;

    // 1. Marcar expediente como finalizado
    activeEmerg.status = 'Finalizado';
    activeEmerg.dischargeDate = new Date().toISOString();
    activeEmerg.epicrisis = epicrisisVal;

    // 2. Compilar desglose de factura de Emergencia
    const details = [
      { description: `Emergencia - Estancia en ${activeEmerg.bedName} (Cargado al ingreso)`, amount: stayCost }
    ];

    if (activeEmerg.consumedMedicines && activeEmerg.consumedMedicines.length > 0) {
      activeEmerg.consumedMedicines.forEach(m => {
        const amt = parseFloat(m.costo_calculado);
        const displayQty = m.tipoPrescripcion === 'dosis' 
          ? `${m.cantidad_o_dosis} dosis`
          : (m.tipoPrescripcion === 'unidad' ? `${m.cantidad_o_dosis} uds` : `${m.qty} cajas`);
        details.push({ description: `Emergencia - Med: ${m.name} (${displayQty})`, amount: amt });
      });
    }

    if (activeEmerg.consumedSupplies && activeEmerg.consumedSupplies.length > 0) {
      activeEmerg.consumedSupplies.forEach(s => {
        details.push({ description: `Emergencia - Insumo: ${s.name} (x${s.qty})`, amount: parseFloat(s.costo_calculado) });
      });
    }

    if (activeEmerg.consumedLabs && activeEmerg.consumedLabs.length > 0) {
      activeEmerg.consumedLabs.forEach(l => {
        details.push({ description: `Emergencia - Lab: ${l.name}`, amount: parseFloat(l.price) });
      });
    }

    if (activeEmerg.consumedImaging && activeEmerg.consumedImaging.length > 0) {
      activeEmerg.consumedImaging.forEach(i => {
        details.push({ description: `Emergencia - Imagen: ${i.name}`, amount: parseFloat(i.price) });
      });
    }

    // 3. Crear pre-factura pendiente en el paciente
    const newBill = {
      id: 'FAC-EMERG-' + Date.now(),
      date: new Date().toISOString(),
      concept: `Atención de Emergencias y Observación - Alta Médica (Exp. ${activeEmerg.id})`,
      details: details,
      diagnosis: activeEmerg.admissionReason,
      total: grandTotal,
      status: 'Pendiente'
    };

    const patientObj = state.patients.find(p => p.id === patient.id);
    patientObj.billingHistory = patientObj.billingHistory || [];
    patientObj.billingHistory.unshift(newBill);

    saveAppState(state);

    alert(`Alta autorizada para ${patient.name}. La pre-factura por valor de Q${grandTotal.toFixed(2)} ha sido enviada al módulo de Facturación.`);
    renderEmergencias(document.getElementById('module-container'));
  });
}

function hideChecklistDefaultElements(modal) {
  if (!modal) return;

  const defaultSearch = document.getElementById('checklist-search-input');
  if (defaultSearch) defaultSearch.style.display = 'none';

  const rightSide = modal.querySelector('.checklist-right-side');
  if (rightSide) rightSide.style.display = 'none';

  const layout = modal.querySelector('.checklist-modal-layout');
  if (layout) {
    layout.style.gridTemplateColumns = '1fr';
  }

  const leftSide = modal.querySelector('.checklist-left-side');
  if (leftSide) {
    leftSide.style.borderRight = 'none';
    leftSide.style.paddingRight = '0';
  }

  const btnSubmit = document.getElementById('btn-submit-checklist');
  if (btnSubmit) btnSubmit.style.display = 'none';

  const btnCancel = document.getElementById('btn-cancel-checklist');
  if (btnCancel) {
    btnCancel.textContent = 'Cerrar y Regresar';
  }

  // Bind close buttons to restore and close
  const btnClose = document.getElementById('btn-close-checklist');
  if (btnClose) {
    btnClose.onclick = () => {
      restoreChecklistModal();
      modal.style.display = 'none';
    };
  }

  if (btnCancel) {
    btnCancel.onclick = () => {
      restoreChecklistModal();
      modal.style.display = 'none';
    };
  }
}

function restoreChecklistModal() {
  const modal = document.getElementById('checklist-modal');
  if (!modal) return;

  const defaultSearch = document.getElementById('checklist-search-input');
  if (defaultSearch) defaultSearch.style.display = 'block';

  const rightSide = modal.querySelector('.checklist-right-side');
  if (rightSide) rightSide.style.display = 'flex';

  const layout = modal.querySelector('.checklist-modal-layout');
  if (layout) {
    layout.style.gridTemplateColumns = '1.3fr 0.7fr';
  }

  const leftSide = modal.querySelector('.checklist-left-side');
  if (leftSide) {
    leftSide.style.borderRight = '1px solid var(--border-color)';
    leftSide.style.paddingRight = '20px';
  }

  const btnSubmit = document.getElementById('btn-submit-checklist');
  if (btnSubmit) btnSubmit.style.display = 'inline-block';

  const btnCancel = document.getElementById('btn-cancel-checklist');
  if (btnCancel) {
    btnCancel.textContent = 'Cancelar';
  }

  // Restore default close button bindings
  const btnClose = document.getElementById('btn-close-checklist');
  if (btnClose) {
    btnClose.onclick = () => { modal.style.display = 'none'; };
  }
  if (btnCancel) {
    btnCancel.onclick = () => { modal.style.display = 'none'; };
  }
}
