// src/modules/encamamiento.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId } from '../main.js';

// Lista temporal de órdenes para la evolución médica en curso
let tempMeds = [];
let tempLabs = [];
let tempImgs = [];

// Vista activa dentro de la pestaña del paciente encamado ('evolucion', 'enfermeria', 'signos', 'cuenta')
let activeTab = 'evolucion';

export function renderEncamamiento(container) {
  const state = getAppState();
  const currentUser = state.currentUser;

  // 1. Validar Control de Acceso (RBAC)
  const roleLower = String(currentUser && currentUser.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isAuthorized = roleLower.includes('administrador') ||
                       roleLower.includes('admin') ||
                       roleLower.startsWith('medico') ||
                       roleLower.includes('enfermera') ||
                       roleLower.includes('enfermero');

  if (!isAuthorized) {
    container.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 4rem 2rem; max-width: 600px; margin: 3rem auto; border-top: 4px solid var(--accent-danger);">
        <span style="font-size: 3rem;">⚠️</span>
        <h2 style="color: var(--accent-danger); margin-top: 1rem; font-family: var(--font-heading);">Acceso Denegado</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem; line-height: 1.5;">
          No tiene los permisos requeridos para ingresar al módulo de Encamamiento.
          Este módulo está restringido para Administradores, Personal Médico y de Enfermería.
        </p>
      </div>
    `;
    return;
  }

  // 2. Renderizar Estructura del Módulo (Doble columna: lateral y panel principal)
  container.innerHTML = `
    <div class="module-header">
      <div class="module-title">
        <h1>🛌 Encamamiento y Hospitalización</h1>
        <p>Control de ingresos, evoluciones médicas, notas de enfermería y liquidación de pacientes hospitalizados.</p>
      </div>
    </div>

    <div class="grid-prescription">
      <!-- Columna Principal (Dashboard de Encamamiento) -->
      <div id="hosp-dashboard-area">
        <!-- Se llena con renderHospitalizationDashboard() -->
      </div>
      
      <!-- Barra lateral de Pacientes Encamados -->
      <div class="glass-card search-sidebar">
        <h3>Pacientes Hospitalizados</h3>
        <div class="form-group" style="margin-top: 5px; margin-bottom: 10px;">
          <select id="hosp-sidebar-filter" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); outline: none; font-size: 0.85rem;">
            <option value="activos">Mostrar: Hospitalizados Activos</option>
            <option value="todos">Mostrar: Todos los Pacientes</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
          <input type="text" id="hosp-patient-search" placeholder="🔍 Buscar paciente...">
        </div>
        <ul class="patient-list" id="hosp-patient-list" style="max-height: 250px; overflow-y: auto; margin-bottom: 1rem;">
          <!-- Pacientes cargados aquí -->
        </ul>

        <button class="btn btn-primary" id="btn-trigger-new-admission" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.85rem; padding: 10px;">
          <span>➕</span> Registrar Ingreso Hospitalario
        </button>
      </div>
    </div>
  `;

  // Bind Sidebar Events
  const searchInput = document.getElementById('hosp-patient-search');
  const filterSelect = document.getElementById('hosp-sidebar-filter');
  
  if (searchInput) searchInput.addEventListener('input', () => renderHospPatientList());
  if (filterSelect) filterSelect.addEventListener('change', () => renderHospPatientList());

  document.getElementById('btn-trigger-new-admission').addEventListener('click', () => {
    renderAdmissionForm();
  });

  renderHospPatientList();
  renderHospitalizationDashboard();
}

// 3. Renderizar listado de pacientes en la barra lateral
function renderHospPatientList() {
  const state = getAppState();
  const listContainer = document.getElementById('hosp-patient-list');
  const filterVal = document.getElementById('hosp-sidebar-filter')?.value || 'activos';
  const query = document.getElementById('hosp-patient-search')?.value.toLowerCase() || '';

  if (!listContainer) return;
  listContainer.innerHTML = '';

  let basePatients = state.patients || [];

  // Filtrar médicos según asignaciones si no son administradores
  const currentUser = state.currentUser;
  const roleNorm = String(currentUser && currentUser.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isDoctor = roleNorm.startsWith('medico');
  const isOnlyDoctorRestricted = isDoctor && !roleNorm.includes('administrador') && roleNorm !== 'medico 1';

  // Si se elije mostrar solo Hospitalizados Activos
  if (filterVal === 'activos') {
    const activeHospIds = (state.encamamiento || [])
      .filter(h => h.status === 'Activo')
      .map(h => h.patientId);
    
    basePatients = basePatients.filter(p => activeHospIds.includes(p.id));
  }

  // Filtrar si el médico solo tiene acceso a sus pacientes asignados
  if (isOnlyDoctorRestricted) {
    basePatients = basePatients.filter(p => 
      p.assignedDoctorId === currentUser.id || 
      p.assignedDoctorName === currentUser.name
    );
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
    
    const isActiveHosp = (state.encamamiento || []).some(h => h.patientId === p.id && h.status === 'Activo');
    const statusDot = isActiveHosp 
      ? '<span style="width: 8px; height: 8px; border-radius: 50%; background: #4caf50; display: inline-block; margin-right: 5px;" title="Hospitalizado"></span>' 
      : '<span style="width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.15); display: inline-block; margin-right: 5px;" title="No hospitalizado"></span>';

    li.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <div class="patient-item-name" style="display: flex; align-items: center;">${statusDot} ${p.name}</div>
        <span style="font-size: 0.72rem; opacity: 0.7;">${p.telephone ? p.telephone : ''}</span>
      </div>
    `;

    li.addEventListener('click', () => {
      setActivePatientId(p.id);
      renderHospPatientList();
      renderHospitalizationDashboard();
    });

    listContainer.appendChild(li);
  });
}

// 4. Renderizar panel principal del dashboard
function renderHospitalizationDashboard() {
  const state = getAppState();
  const dashboardArea = document.getElementById('hosp-dashboard-area');
  if (!dashboardArea) return;

  const activeId = getActivePatientId();
  const patient = state.patients.find(p => p.id === activeId);

  if (!patient) {
    dashboardArea.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 5rem 2rem;">
        <span style="font-size: 3.5rem;">🛌</span>
        <h2 style="margin-top: 1rem; font-family: var(--font-heading);">Consola de Encamamiento</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem; max-width: 450px; margin-left: auto; margin-right: auto; line-height: 1.5;">
          Selecciona un paciente de la barra lateral para ver su historial hospitalario o presiona "Registrar Ingreso Hospitalario".
        </p>
      </div>
    `;
    return;
  }

  // Buscar si tiene hospitalización activa
  const activeHosp = (state.encamamiento || []).find(h => h.patientId === patient.id && h.status === 'Activo');

  if (!activeHosp) {
    // Si no está hospitalizado, mostrar pantalla de ingreso
    dashboardArea.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 4rem 2rem; border-top: 3px solid var(--accent-secondary);">
        <span style="font-size: 3rem;">🏥</span>
        <h2 style="margin-top: 1rem; font-family: var(--font-heading); color: var(--text-primary);">${patient.name}</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem; max-width: 450px; margin-left: auto; margin-right: auto; line-height: 1.4; margin-bottom: 1.5rem;">
          Este paciente no tiene un expediente de hospitalización activo en este momento.
        </p>
        <button class="btn btn-success" id="btn-start-admission-direct">
          🛌 Iniciar Ingreso Hospitalario
        </button>
      </div>
    `;

    document.getElementById('btn-start-admission-direct').addEventListener('click', () => {
      renderAdmissionForm(patient.id);
    });
    return;
  }

  // Si está hospitalizado, renderizar panel de seguimiento
  const dob = new Date(patient.birthdate);
  const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  const daysIn = Math.max(1, Math.ceil((Date.now() - new Date(activeHosp.admissionDate).getTime()) / (1000 * 60 * 60 * 24)));

  dashboardArea.innerHTML = `
    <!-- Ficha del Paciente Encamado -->
    <div class="patient-top-banner glass-card" style="margin-bottom: 1.5rem; padding: 1.25rem; border-left: 4px solid var(--accent-secondary);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; width: 100%;">
        <div>
          <span class="status-badge" style="background: rgba(37,99,235,0.15); color: var(--accent-primary); font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; font-weight: bold; margin-bottom: 5px; display: inline-block;">🛌 HOSPITALIZADO - DÍA ${daysIn}</span>
          <h2 style="margin: 0; color: var(--text-primary); font-family: var(--font-heading); font-size: 1.4rem;">${patient.name}</h2>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px; display: flex; gap: 15px; flex-wrap: wrap;">
            <span><strong>DPI:</strong> ${patient.dpi || 'N/A'}</span>
            <span><strong>Edad:</strong> ${age} años</span>
            <span><strong>Habitación:</strong> ${activeHosp.roomName || 'General'}</span>
            <span><strong>Ingreso:</strong> ${new Date(activeHosp.admissionDate).toLocaleString('es-GT')}</span>
            <span><strong>🥦 Dieta:</strong> <strong style="color: var(--accent-primary);">${activeHosp.dietType || 'No especificada'}</strong></span>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-small" id="btn-print-hosp-file">🖨️ Impresión</button>
          <button class="btn btn-danger btn-small" id="btn-trigger-discharge" style="background: var(--accent-danger); border: none;">🏥 Alta Médica</button>
        </div>
      </div>
    </div>

    <!-- Menú de Pestañas del Paciente Encamado -->
    <div class="tab-menu" style="margin-bottom: 1.5rem; display: flex; gap: 5px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">
      <button class="tab-btn ${activeTab === 'evolucion' ? 'active' : ''}" data-hoptab="evolucion">📋 Evolución Médica</button>
      <button class="tab-btn ${activeTab === 'enfermeria' ? 'active' : ''}" data-hoptab="enfermeria">🫁 Notas de Enfermería</button>
      <button class="tab-btn ${activeTab === 'signos' ? 'active' : ''}" data-hoptab="signos">📊 Signos Vitales</button>
      <button class="tab-btn ${activeTab === 'cuenta' ? 'active' : ''}" data-hoptab="cuenta">💳 Desglose y Cargos</button>
    </div>

    <!-- Contenido de la pestaña activa -->
    <div id="hosp-tab-content-area"></div>
  `;

  // Bind Header actions
  document.getElementById('btn-print-hosp-file').addEventListener('click', () => printHospitalizationRecord(activeHosp, patient));
  document.getElementById('btn-trigger-discharge').addEventListener('click', () => renderDischargeForm(activeHosp, patient));

  // Bind Tabs Navigation
  document.querySelectorAll('[data-hoptab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeTab = e.target.getAttribute('data-hoptab');
      renderHospitalizationDashboard();
    });
  });

  renderActiveTabContent(activeHosp, patient);
}

// 5. Renderizar contenido de la pestaña seleccionada
function renderActiveTabContent(activeHosp, patient) {
  const contentArea = document.getElementById('hosp-tab-content-area');
  if (!contentArea) return;

  const state = getAppState();
  const currentUser = state.currentUser;

  if (activeTab === 'evolucion') {
    // Pestaña Evolución Médica
    contentArea.innerHTML = `
      <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 1.5rem; flex-wrap: wrap;">
        <!-- Columna Izquierda: Órdenes de Ingreso y Formulario de Evolución -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Card de Órdenes e Indicaciones de Ingreso -->
          <div class="glass-card" style="padding: 1.25rem; border-left: 4px solid var(--accent-secondary);">
            <h3 style="margin-bottom: 8px; color: var(--accent-secondary); font-family: var(--font-heading); font-size: 1.1rem;">📋 Órdenes Médicas y Dieta al Ingreso</h3>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; color: var(--text-primary);">
              <div><strong>🥦 Dieta Actual:</strong> <span style="color: var(--accent-primary); font-weight: bold; font-size: 0.9rem;">${activeHosp.dietType || 'No especificada'}</span></div>
              <div><strong>🩺 Diagnóstico de Ingreso:</strong> <span style="color: var(--text-muted);">${activeHosp.admissionReason}</span></div>
              <div style="margin-top: 6px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px; border-radius: var(--radius-sm);">
                <strong>📋 Órdenes Iniciales:</strong>
                <p style="white-space: pre-wrap; font-family: monospace; font-size: 0.82rem; margin: 4px 0 0 0; color: var(--text-muted); line-height: 1.4;">${activeHosp.admissionOrders || 'Ninguna registrada'}</p>
              </div>
            </div>
          </div>

          <!-- Formulario para agregar evolución -->
          <div class="glass-card" style="padding: 1.25rem;">
            <h3 style="margin-bottom: 10px; color: var(--accent-primary);">Añadir Evolución Médica</h3>
            <form id="hosp-evolution-form" style="display: flex; flex-direction: column; gap: 12px;">
              <div class="form-group">
                <label>Médico que registra</label>
                <select id="hosp-evo-doctor" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                  <!-- Se llena con médicos -->
                </select>
              </div>
              <div class="form-group">
                <label>Nota de Evolución Médica</label>
                <textarea id="hosp-evo-note" required rows="4" placeholder="Escriba el seguimiento clínico, evolución y estado general del paciente..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical;"></textarea>
              </div>
              <div class="form-group">
                <label>Actualizar Tipo de Dieta (Opcional)</label>
                <input type="text" id="hosp-evo-diet" value="${activeHosp.dietType || ''}" placeholder="Ej. Dieta líquida, blanda, NPO..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              </div>
              
              <div style="border-top: 1px dashed var(--border-color); padding-top: 10px; margin-top: 5px;">
                <h4 style="color: var(--accent-secondary); margin-bottom: 8px; font-size: 0.95rem;">Órdenes Médicas Integradas</h4>
                
                <!-- Tabs internas para órdenes -->
                <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                  <button type="button" class="btn btn-secondary btn-small" id="btn-ord-meds" style="padding: 4px 8px; font-size: 0.75rem;">💊 Recetar Medicamentos</button>
                  <button type="button" class="btn btn-secondary btn-small" id="btn-ord-labs" style="padding: 4px 8px; font-size: 0.75rem;">🔬 Exámenes de Laboratorio</button>
                  <button type="button" class="btn btn-secondary btn-small" id="btn-ord-imgs" style="padding: 4px 8px; font-size: 0.75rem;">🖼️ Estudios de Imagen</button>
                </div>

                <!-- Lista de órdenes cargadas a esta evolución -->
                <div id="hosp-temp-orders-list" style="margin-bottom: 10px; font-size: 0.85rem; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 4px; border: 1px dashed var(--border-color);">
                  Ninguna orden integrada agregada para esta evolución.
                </div>
              </div>

              <button type="submit" class="btn btn-success" style="width: 100%; padding: 10px;">💾 Guardar Nota de Evolución</button>
            </form>
          </div>
        </div>

        <!-- Historial de evoluciones -->
        <div class="glass-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 10px; max-height: 450px; overflow-y: auto;">
          <h3 style="margin-bottom: 5px; color: var(--text-primary);">Historial Clínico de Estancia</h3>
          <div id="hosp-evolutions-history-list" style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Renderizado dinámico -->
          </div>
        </div>
      </div>
    `;

    // Cargar médicos del sistema en el dropdown
    const doctorSelect = document.getElementById('hosp-evo-doctor');
    const doctors = state.users.filter(u => {
      const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return r === 'medico' || r === 'medico 1' || r === 'medico 2' || r === 'medico 3';
    });
    if (doctorSelect) {
      doctorSelect.innerHTML = doctors.map(d => `<option value="${d.id}" ${d.name === activeHosp.doctorName ? 'selected' : ''}>${d.name}</option>`).join('');
    }

    // Bind sub-order triggers
    document.getElementById('btn-ord-meds').addEventListener('click', () => showMedsOrderModal(patient));
    document.getElementById('btn-ord-labs').addEventListener('click', () => showLabsOrderModal());
    document.getElementById('btn-ord-imgs').addEventListener('click', () => showImgsOrderModal());

    // Bind evolution form submit
    document.getElementById('hosp-evolution-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const docId = document.getElementById('hosp-evo-doctor').value;
      const docObj = state.users.find(u => u.id === docId);
      const noteVal = document.getElementById('hosp-evo-note').value;
      const dietVal = document.getElementById('hosp-evo-diet').value.trim();

      if (dietVal) {
        activeHosp.dietType = dietVal;
      }

      const evolutionRecord = {
        id: 'evo-' + Date.now(),
        date: new Date().toISOString(),
        doctorName: docObj.name,
        doctorId: docObj.id,
        note: noteVal,
        dietType: dietVal || activeHosp.dietType || '',
        medications: [...tempMeds],
        laboratoryTests: [...tempLabs],
        imagingStudies: [...tempImgs]
      };

      // 1. Guardar la evolución en el expediente de Encamamiento
      activeHosp.evolutions = activeHosp.evolutions || [];
      activeHosp.evolutions.push(evolutionRecord);

      // 2. Migrar medicamentos a Recetario y Farmacia
      if (tempMeds.length > 0) {
        const recipeId = 'r-' + Date.now();
        const hospRecipe = {
          id: recipeId,
          date: new Date().toISOString(),
          doctorName: docObj.name,
          doctorLicense: docObj.license || '12345',
          doctorPhone: docObj.telephone || '2200-0000',
          medicines: tempMeds.map(m => ({
            name: m.name,
            presentation: m.presentation || 'N/A',
            price: parseFloat(m.price),
            quantity: parseInt(m.qty),
            dosage: m.dosage
          })),
          indications: `Medicación Hospitalización: ${noteVal}`,
          billId: 'HOSP-BILL-' + activeHosp.id,
          dispenseStatus: 'Pendiente',
          isHospitalization: true
        };
        patient.prescriptions = patient.prescriptions || [];
        patient.prescriptions.unshift(hospRecipe);
        
        // Agregar a los consumos acumulados
        activeHosp.consumedMedicines = activeHosp.consumedMedicines || [];
        activeHosp.consumedMedicines.push(...tempMeds);
      }

      // 3. Migrar laboratorio a órdenes locales
      if (tempLabs.length > 0) {
        tempLabs.forEach(lab => {
          const labId = 'lab-order-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
          const labOrder = {
            id: labId,
            date: new Date().toISOString(),
            name: lab.name,
            price: parseFloat(lab.price),
            doctorName: docObj.name,
            billId: 'HOSP-BILL-' + activeHosp.id,
            stage: 'procesar',
            isHospitalization: true
          };
          patient.localLabs = patient.localLabs || [];
          patient.localLabs.unshift(labOrder);
          
          activeHosp.consumedLabs = activeHosp.consumedLabs || [];
          activeHosp.consumedLabs.push(lab);
        });
      }

      // 4. Migrar imagenología a órdenes de estudio
      if (tempImgs.length > 0) {
        const imgId = 'o-' + Date.now();
        const imgOrder = {
          id: imgId,
          date: new Date().toISOString(),
          doctorName: docObj.name,
          doctorLicense: docObj.license || 'N/A',
          studies: tempImgs.map(i => ({ name: i.name, type: 'imaging', notes: noteVal })),
          generalNotes: `Estudio Hospitalización: ${noteVal}`,
          isHospitalization: true
        };
        patient.studyOrders = patient.studyOrders || [];
        patient.studyOrders.unshift(imgOrder);

        activeHosp.consumedImaging = activeHosp.consumedImaging || [];
        activeHosp.consumedImaging.push(...tempImgs);
      }

      // Guardar todo el estado
      saveAppState(state);

      // Limpiar temporales
      tempMeds = [];
      tempLabs = [];
      tempImgs = [];

      alert("Evolución médica y órdenes integradas creadas exitosamente.");
      renderHospitalizationDashboard();
    });

    renderTempOrdersList();
    renderEvolutionsHistory(activeHosp);

  } else if (activeTab === 'enfermeria') {
    // Pestaña Enfermería
    const nurses = state.users.filter(u => {
      const r = String(u.role || '').toLowerCase();
      return r.includes('enfermera') || r.includes('enfermero');
    });
    const defaultNurseName = nurses.length > 0 ? nurses[0].name : (currentUser ? currentUser.name : 'Enfermero de Turno');

    contentArea.innerHTML = `
      <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 1.5rem; flex-wrap: wrap;">
        <!-- Formulario para agregar nota de enfermería -->
        <div class="glass-card" style="padding: 1.25rem;">
          <h3 style="margin-bottom: 10px; color: var(--accent-success);">Registrar Nota de Enfermería</h3>
          <form id="hosp-nursing-form" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
              <label>Personal de Enfermería</label>
              <input type="text" id="hosp-nurse-name" required value="${defaultNurseName}" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>Nota de Enfermería (Seguimiento, cuidados, medicamentos administrados...)</label>
              <textarea id="hosp-nurse-note" required rows="6" placeholder="Escriba las observaciones de enfermería..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical;"></textarea>
            </div>
            <button type="submit" class="btn btn-success" style="width: 100%; padding: 10px;">💾 Guardar Nota de Enfermería</button>
          </form>
        </div>

        <!-- Historial de notas de enfermería -->
        <div class="glass-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 10px; max-height: 450px; overflow-y: auto;">
          <h3 style="margin-bottom: 5px; color: var(--text-primary);">Historial de Notas de Enfermería</h3>
          <div id="hosp-nursing-history-list" style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Renderizado dinámico -->
          </div>
        </div>
      </div>
    `;

    // Bind nursing form submit
    document.getElementById('hosp-nursing-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const nurseName = document.getElementById('hosp-nurse-name').value;
      const noteVal = document.getElementById('hosp-nurse-note').value;

      const nursingRecord = {
        id: 'nurse-' + Date.now(),
        date: new Date().toISOString(),
        nurseName: nurseName,
        note: noteVal
      };

      activeHosp.nursingNotes = activeHosp.nursingNotes || [];
      activeHosp.nursingNotes.push(nursingRecord);

      saveAppState(state);
      alert("Nota de enfermería registrada exitosamente.");
      renderHospitalizationDashboard();
    });

    renderNursingHistory(activeHosp);

  } else if (activeTab === 'signos') {
    // Pestaña Signos Vitales
    contentArea.innerHTML = `
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; flex-wrap: wrap;">
        <!-- Formulario Signos Vitales -->
        <div class="glass-card" style="padding: 1.25rem;">
          <h3 style="margin-bottom: 10px; color: var(--accent-primary);">Tomar Nuevas Lecturas</h3>
          <form id="hosp-vitals-form" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label>Temperatura (°C)</label>
              <input type="number" step="0.1" id="h-temp" required placeholder="Ej. 36.5" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group" style="display: flex; gap: 5px; flex-direction: row; align-items: flex-end;">
              <div style="flex: 1;">
                <label>P.A. Sistólica</label>
                <input type="number" id="h-bp-sys" required placeholder="120" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              </div>
              <div style="flex: 1;">
                <label>P.A. Diastólica</label>
                <input type="number" id="h-bp-dia" required placeholder="80" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              </div>
            </div>
            <div class="form-group">
              <label>Frec. Cardíaca (LPM)</label>
              <input type="number" id="h-hr" required placeholder="75" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>Frec. Respiratoria (RPM)</label>
              <input type="number" id="h-rr" required placeholder="16" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>Saturación Oxígeno (%)</label>
              <input type="number" id="h-ox" required placeholder="98" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>Glucosa Capilar (mg/dL)</label>
              <input type="number" id="h-glu" placeholder="95" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>Peso (kg)</label>
              <input type="number" step="0.1" id="h-weight" placeholder="70.5" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <div class="form-group">
              <label>Talla / Estatura (m)</label>
              <input type="number" step="0.01" id="h-height" placeholder="1.70" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            </div>
            <button type="submit" class="btn btn-success" style="grid-column: 1/-1; padding: 10px; margin-top: 5px;">💾 Registrar Signos Vitales</button>
          </form>
        </div>

        <!-- Historial de signos vitales -->
        <div class="glass-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 10px; max-height: 450px; overflow-y: auto;">
          <h3 style="margin-bottom: 5px; color: var(--text-primary);">Mediciones de Signos Vitales</h3>
          <div id="hosp-vitals-history-table">
            <!-- Renderizado dinámico -->
          </div>
        </div>
      </div>
    `;

    // Cargar últimas lecturas si existen en el paciente
    const lastV = patient.vitalSigns && patient.vitalSigns.length > 0 ? patient.vitalSigns[0] : null;
    if (lastV) {
      document.getElementById('h-temp').value = lastV.temp || '';
      document.getElementById('h-bp-sys').value = lastV.bp_systolic || '';
      document.getElementById('h-bp-dia').value = lastV.bp_diastolic || '';
      document.getElementById('h-hr').value = lastV.heart_rate || '';
      document.getElementById('h-rr').value = lastV.resp_rate || '';
      document.getElementById('h-ox').value = lastV.oxygen || '';
      document.getElementById('h-glu').value = lastV.glucose || '';
      document.getElementById('h-weight').value = lastV.weight || '';
      document.getElementById('h-height').value = lastV.height || '';
    }

    // Bind vitals form submit
    document.getElementById('hosp-vitals-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = parseFloat(document.getElementById('h-temp').value);
      const sys = parseInt(document.getElementById('h-bp-sys').value);
      const dia = parseInt(document.getElementById('h-bp-dia').value);
      const hr = parseInt(document.getElementById('h-hr').value);
      const rr = parseInt(document.getElementById('h-rr').value);
      const ox = parseInt(document.getElementById('h-ox').value);
      const glu = document.getElementById('h-glu').value ? parseInt(document.getElementById('h-glu').value) : null;
      const w = document.getElementById('h-weight').value ? parseFloat(document.getElementById('h-weight').value) : null;
      const ht = document.getElementById('h-height').value ? parseFloat(document.getElementById('h-height').value) : null;

      let bmi = null;
      if (w && ht && ht > 0) {
        bmi = parseFloat((w / (ht * ht)).toFixed(2));
      }

      const vitalsObj = {
        date: new Date().toISOString(),
        temp: t,
        bp_systolic: sys,
        bp_diastolic: dia,
        heart_rate: hr,
        resp_rate: rr,
        oxygen: ox,
        glucose: glu,
        weight: w,
        height: ht,
        bmi: bmi
      };

      patient.vitalSigns = patient.vitalSigns || [];
      patient.vitalSigns.unshift(vitalsObj);

      saveAppState(state);
      alert("Signos vitales registrados exitosamente.");
      renderHospitalizationDashboard();
    });

    renderVitalsHistoryTable(patient);

  } else if (activeTab === 'cuenta') {
    // Pestaña Desglose de Gastos
    const daysIn = Math.max(1, Math.ceil((Date.now() - new Date(activeHosp.admissionDate).getTime()) / (1000 * 60 * 60 * 24)));
    const roomRate = getRoomRatePrice(activeHosp.roomRateId, state);
    const roomTotal = daysIn * roomRate;

    const medsTotal = (activeHosp.consumedMedicines || []).reduce((acc, m) => acc + (parseFloat(m.price) * parseInt(m.qty)), 0);
    const labsTotal = (activeHosp.consumedLabs || []).reduce((acc, l) => acc + parseFloat(l.price), 0);
    const imgsTotal = (activeHosp.consumedImaging || []).reduce((acc, i) => acc + parseFloat(i.price), 0);

    const grandTotal = roomTotal + medsTotal + labsTotal + imgsTotal;

    contentArea.innerHTML = `
      <div class="glass-card" style="padding: 1.5rem; border-top: 3px solid var(--accent-success);">
        <h3 style="margin-bottom: 1.25rem; color: var(--accent-success);">Pre-factura / Cuenta Acumulada</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-size: 0.85rem; text-align: left;">
              <th style="padding: 8px;">Concepto</th>
              <th style="padding: 8px; text-align: center;">Cantidad</th>
              <th style="padding: 8px; text-align: right;">Precio Unitario</th>
              <th style="padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            <!-- Cargo de habitación -->
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 10px 8px;">Hospitalización - Habitación / Cama (${activeHosp.roomName || 'General'})</td>
              <td style="padding: 10px 8px; text-align: center;">${daysIn} días</td>
              <td style="padding: 10px 8px; text-align: right;">Q${roomRate.toFixed(2)}</td>
              <td style="padding: 10px 8px; text-align: right; font-weight: bold;">Q${roomTotal.toFixed(2)}</td>
            </tr>

            <!-- Medicamentos despachados -->
            ${(activeHosp.consumedMedicines || []).map(m => `
              <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted);">
                <td style="padding: 8px 8px 8px 20px;">💊 ${m.name} (${m.presentation || 'N/A'})</td>
                <td style="padding: 8px; text-align: center;">${m.qty}</td>
                <td style="padding: 8px; text-align: right;">Q${parseFloat(m.price).toFixed(2)}</td>
                <td style="padding: 8px; text-align: right;">Q${(parseFloat(m.price) * parseInt(m.qty)).toFixed(2)}</td>
              </tr>
            `).join('')}
            ${medsTotal > 0 ? `
              <tr style="border-bottom: 1px solid var(--border-color); font-weight: 500;">
                <td colspan="3" style="padding: 10px 8px; text-align: right; color: var(--accent-primary);">Subtotal Medicación:</td>
                <td style="padding: 10px 8px; text-align: right; color: var(--accent-primary);">Q${medsTotal.toFixed(2)}</td>
              </tr>
            ` : ''}

            <!-- Laboratorios procesados -->
            ${(activeHosp.consumedLabs || []).map(l => `
              <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted);">
                <td style="padding: 8px 8px 8px 20px;">🔬 Examen: ${l.name}</td>
                <td style="padding: 8px; text-align: center;">1</td>
                <td style="padding: 8px; text-align: right;">Q${parseFloat(l.price).toFixed(2)}</td>
                <td style="padding: 8px; text-align: right;">Q${parseFloat(l.price).toFixed(2)}</td>
              </tr>
            `).join('')}
            ${labsTotal > 0 ? `
              <tr style="border-bottom: 1px solid var(--border-color); font-weight: 500;">
                <td colspan="3" style="padding: 10px 8px; text-align: right; color: var(--accent-secondary);">Subtotal Laboratorios:</td>
                <td style="padding: 10px 8px; text-align: right; color: var(--accent-secondary);">Q${labsTotal.toFixed(2)}</td>
              </tr>
            ` : ''}

            <!-- Imagenología procesada -->
            ${(activeHosp.consumedImaging || []).map(i => `
              <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted);">
                <td style="padding: 8px 8px 8px 20px;">🖼️ Estudio: ${i.name}</td>
                <td style="padding: 8px; text-align: center;">1</td>
                <td style="padding: 8px; text-align: right;">Q${parseFloat(i.price).toFixed(2)}</td>
                <td style="padding: 8px; text-align: right;">Q${parseFloat(i.price).toFixed(2)}</td>
              </tr>
            `).join('')}
            ${imgsTotal > 0 ? `
              <tr style="border-bottom: 1px solid var(--border-color); font-weight: 500;">
                <td colspan="3" style="padding: 10px 8px; text-align: right; color: var(--accent-success);">Subtotal Imagenología:</td>
                <td style="padding: 10px 8px; text-align: right; color: var(--accent-success);">Q${imgsTotal.toFixed(2)}</td>
              </tr>
            ` : ''}

            <!-- Fila del Total General -->
            <tr style="font-size: 1.15rem; font-weight: 800; border-top: 2px solid var(--border-color);">
              <td colspan="3" style="padding: 15px 8px; text-align: right; color: var(--text-primary);">Total Acumulado a la Fecha:</td>
              <td style="padding: 15px 8px; text-align: right; color: var(--accent-success);">Q${grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
}

// Renderizar formulario de ingreso hospitalario
function renderAdmissionForm(targetPatientId = null) {
  const state = getAppState();
  const dashboardArea = document.getElementById('hosp-dashboard-area');
  if (!dashboardArea) return;

  dashboardArea.innerHTML = `
    <div class="glass-card" style="padding: 1.5rem; border-top: 3px solid var(--accent-primary);">
      <h3 style="margin-bottom: 1.25rem; color: var(--accent-primary);">Registrar Ingreso Hospitalario</h3>
      <form id="hosp-admission-form" style="display: flex; flex-direction: column; gap: 15px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; flex-wrap: wrap;">
          <div class="form-group">
            <label>Paciente</label>
            <select id="adm-patient" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              <!-- Se inyectan pacientes -->
            </select>
          </div>
          <div class="form-group">
            <label>Origen de Ingreso</label>
            <select id="adm-origin" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              <option value="Emergencia">Emergencia</option>
              <option value="Consulta">Consulta Externa</option>
              <option value="Quirófano">Quirófano / Cirugía</option>
            </select>
          </div>
          <div class="form-group">
            <label>Médico Tratante / que ingresa</label>
            <select id="adm-doctor" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              <!-- Se inyectan médicos -->
            </select>
          </div>
          <div class="form-group">
            <label>Tipo de Habitación / Tarifa Hospitalaria</label>
            <select id="adm-room" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              <!-- Se inyectan tarifas -->
            </select>
          </div>
          <div class="form-group">
            <label>Familiar Responsable (Nombre Completo)</label>
            <input type="text" id="adm-fam-name" required placeholder="Ej. Lidia Xol" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
          </div>
          <div class="form-group">
            <label>Teléfono de Familiar Responsable</label>
            <input type="tel" id="adm-fam-phone" required placeholder="Ej. 5555-1234" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
          </div>
          <div class="form-group">
            <label>Tipo de Dieta</label>
            <input type="text" id="adm-diet-type" required placeholder="Ej. Dieta blanda, Dieta líquida, NPO..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
          </div>
        </div>

        <div class="form-group">
          <label>Diagnóstico o razón de ingreso</label>
          <textarea id="adm-reason" required rows="2" placeholder="Detalle los síntomas, examen físico inicial y sospecha de diagnóstico..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical;"></textarea>
        </div>

        <div class="form-group">
          <label>Órdenes Médicas al Ingreso (Infusiones, Medicamentos, Laboratorios, Indicaciones Especiales)</label>
          <textarea id="adm-orders" required rows="4" placeholder="Indique:\n1. Infusiones / Soluciones\n2. Medicamentos y dosis\n3. Laboratorios y estudios\n4. Indicaciones especiales (Curva de temperatura y P.A. cada 4 horas, canalización vía periférica, plan educacional, cuidados del paciente...)" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical; font-family: monospace; font-size: 0.85rem;"></textarea>
        </div>

        <!-- Sección de Signos Vitales -->
        <div style="border-top: 1px dashed var(--border-color); padding-top: 10px; margin-top: 5px;">
          <h4 style="color: var(--accent-secondary); margin-bottom: 10px;">Signos Vitales al Ingreso (Actualización Obligatoria)</h4>
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
          <button type="button" class="btn btn-secondary" id="btn-cancel-admission">Cancelar</button>
          <button type="submit" class="btn btn-success">🛌 Completar Ingreso</button>
        </div>
      </form>
    </div>
  `;

  // Poblar pacientes dropdown
  const patientSelect = document.getElementById('adm-patient');
  if (patientSelect) {
    const activeHospIds = (state.encamamiento || []).filter(h => h.status === 'Activo').map(h => h.patientId);
    // Filtrar los pacientes que ya están hospitalizados
    const freePatients = state.patients.filter(p => !activeHospIds.includes(p.id));
    
    patientSelect.innerHTML = freePatients.map(p => `<option value="${p.id}" ${p.id === targetPatientId ? 'selected' : ''}>${p.name}</option>`).join('');
    if (freePatients.length === 0 && !targetPatientId) {
      patientSelect.innerHTML = '<option value="">-- No hay pacientes disponibles (Todos hospitalizados) --</option>';
    }
  }

  // Poblar médicos dropdown
  const doctorSelect = document.getElementById('adm-doctor');
  const doctors = state.users.filter(u => {
    const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return r === 'medico' || r === 'medico 1' || r === 'medico 2' || r === 'medico 3';
  });
  if (doctorSelect) {
    doctorSelect.innerHTML = doctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }

  // Poblar tarifas dropdown
  const roomSelect = document.getElementById('adm-room');
  const rates = state.roomRates || [];
  if (roomSelect) {
    if (rates.length === 0) {
      roomSelect.innerHTML = '<option value="default" data-price="150">Cama Hospitalaria General (Q150.00/día)</option>';
    } else {
      roomSelect.innerHTML = rates.map(r => `<option value="${r.id}" data-price="${r.price}">${r.name} (Q${parseFloat(r.price).toFixed(2)}/día)</option>`).join('');
    }
  }

  // Bind Form Cancel
  document.getElementById('btn-cancel-admission').addEventListener('click', () => {
    renderHospitalizationDashboard();
  });

  // Bind Form Submit
  document.getElementById('hosp-admission-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pId = document.getElementById('adm-patient').value;
    if (!pId) {
      alert("Seleccione un paciente para el ingreso.");
      return;
    }

    const patientObj = state.patients.find(p => p.id === pId);
    const origin = document.getElementById('adm-origin').value;
    const docId = document.getElementById('adm-doctor').value;
    const docObj = state.users.find(u => u.id === docId);
    
    const roomEl = document.getElementById('adm-room');
    const roomRateId = roomEl.value;
    const roomName = roomEl.options[roomEl.selectedIndex].text.split(' (')[0];

    const famName = document.getElementById('adm-fam-name').value;
    const famPhone = document.getElementById('adm-fam-phone').value;
    const reason = document.getElementById('adm-reason').value;
    const dietType = document.getElementById('adm-diet-type').value.trim();
    const admissionOrders = document.getElementById('adm-orders').value.trim();

    // Tomar signos vitales al ingreso
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

    // Crear expediente de Encamamiento
    const hospId = 'hosp-' + Date.now();
    const hospitalizationRecord = {
      id: hospId,
      patientId: pId,
      patientName: patientObj.name,
      origin: origin,
      doctorName: docObj.name,
      doctorId: docObj.id,
      roomRateId: roomRateId,
      roomName: roomName,
      responsibleFamilyName: famName,
      responsibleFamilyPhone: famPhone,
      admissionReason: reason,
      dietType: dietType,
      admissionOrders: admissionOrders,
      admissionDate: new Date().toISOString(),
      dischargeDate: null,
      status: 'Activo',
      initialVitals: vitalsObj,
      evolutions: [],
      nursingNotes: [],
      consumedMedicines: [],
      consumedLabs: [],
      consumedImaging: []
    };

    state.encamamiento = state.encamamiento || [];
    state.encamamiento.unshift(hospitalizationRecord);

    setActivePatientId(pId);
    saveAppState(state);

    alert(`Ingreso hospitalario completado para el paciente ${patientObj.name}`);
    renderEncamamiento(document.getElementById('module-container'));
  });
}

// 6. Renderizar formulario de Alta Médica y checkout
function renderDischargeForm(activeHosp, patient) {
  const state = getAppState();
  const currentUser = state.currentUser;

  // Validar que el usuario que da de alta sea el Médico Tratante asignado
  if (currentUser.name !== activeHosp.doctorName && currentUser.id !== activeHosp.doctorId) {
    alert(`❌ ACCESO DENEGADO:\nEl alta médica solo puede ser autorizada por el médico tratante asignado: ${activeHosp.doctorName}.`);
    return;
  }

  const dashboardArea = document.getElementById('hosp-dashboard-area');
  if (!dashboardArea) return;

  const daysIn = Math.max(1, Math.ceil((Date.now() - new Date(activeHosp.admissionDate).getTime()) / (1000 * 60 * 60 * 24)));
  const roomRate = getRoomRatePrice(activeHosp.roomRateId, state);
  const roomTotal = daysIn * roomRate;

  const medsTotal = (activeHosp.consumedMedicines || []).reduce((acc, m) => acc + (parseFloat(m.price) * parseInt(m.qty)), 0);
  const labsTotal = (activeHosp.consumedLabs || []).reduce((acc, l) => acc + parseFloat(l.price), 0);
  const imgsTotal = (activeHosp.consumedImaging || []).reduce((acc, i) => acc + parseFloat(i.price), 0);

  const grandTotal = roomTotal + medsTotal + labsTotal + imgsTotal;

  dashboardArea.innerHTML = `
    <div class="glass-card" style="padding: 1.5rem; border-top: 3px solid var(--accent-danger);">
      <h3 style="color: var(--accent-danger); margin-bottom: 1.25rem;">Autorizar Alta Médica</h3>
      <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 1.5rem;">
        Al guardar el alta, el estado de la hospitalización pasará a ser "Finalizado", la cama/habitación se liberará y todos los gastos acumulados se migrarán automáticamente a la **Facturación Final** del paciente en la Preconsulta.
      </p>

      <form id="hosp-discharge-form" style="display: flex; flex-direction: column; gap: 15px;">
        <div class="form-group">
          <label>Nota / Epicrisis de Egreso (Resumen de alta)</label>
          <textarea id="dis-epicrisis" required rows="4" placeholder="Escriba las conclusiones clínicas de la hospitalización, recomendaciones de egreso y medicación para el hogar..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical;"></textarea>
        </div>

        <div style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.9rem;">
          <h4 style="margin-bottom: 5px; color: var(--text-primary);">Detalle de Liquidación:</h4>
          <ul style="list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: 4px;">
            <li>🏨 <strong>Hospitalización (${daysIn} días):</strong> Q${roomTotal.toFixed(2)}</li>
            ${medsTotal > 0 ? `<li>💊 <strong>Medicamentos de estancia:</strong> Q${medsTotal.toFixed(2)}</li>` : ''}
            ${labsTotal > 0 ? `<li>🔬 <strong>Exámenes de laboratorio:</strong> Q${labsTotal.toFixed(2)}</li>` : ''}
            ${imgsTotal > 0 ? `<li>🖼️ <strong>Estudios de imagenología:</strong> Q${imgsTotal.toFixed(2)}</li>` : ''}
            <li style="border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 4px; font-size: 1.05rem; font-weight: bold; color: var(--accent-success);">
              💰 Total a Facturar en Caja: Q${grandTotal.toFixed(2)}
            </li>
          </ul>
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-discharge">Volver al Dashboard</button>
          <button type="submit" class="btn btn-danger" style="background: var(--accent-danger); border: none;">💾 Procesar Alta y Liquidación</button>
        </div>
      </form>
    </div>
  `;

  // Cancel discharge
  document.getElementById('btn-cancel-discharge').addEventListener('click', () => {
    renderHospitalizationDashboard();
  });

  // Submit discharge
  document.getElementById('hosp-discharge-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const epicrisisVal = document.getElementById('dis-epicrisis').value;

    // 1. Marcar expediente como finalizado
    activeHosp.status = 'Finalizado';
    activeHosp.dischargeDate = new Date().toISOString();
    activeHosp.epicrisis = epicrisisVal;

    // 2. Compilar listado de desglose de factura
    const details = [
      { description: `Hospitalización - Estancia (${daysIn} días a Q${roomRate}/día) - Hab. ${activeHosp.roomName}`, amount: roomTotal }
    ];

    if (activeHosp.consumedMedicines && activeHosp.consumedMedicines.length > 0) {
      activeHosp.consumedMedicines.forEach(m => {
        details.push({ description: `Hospitalización - Med: ${m.name} (Cant: ${m.qty})`, amount: parseFloat(m.price) * parseInt(m.qty) });
      });
    }

    if (activeHosp.consumedLabs && activeHosp.consumedLabs.length > 0) {
      activeHosp.consumedLabs.forEach(l => {
        details.push({ description: `Hospitalización - Lab: ${l.name}`, amount: parseFloat(l.price) });
      });
    }

    if (activeHosp.consumedImaging && activeHosp.consumedImaging.length > 0) {
      activeHosp.consumedImaging.forEach(i => {
        details.push({ description: `Hospitalización - Imagen: ${i.name}`, amount: parseFloat(i.price) });
      });
    }

    // 3. Crear factura pendiente en el paciente
    const newBill = {
      id: 'FAC-HOSP-' + Date.now(),
      date: new Date().toISOString(),
      concept: `Hospitalización y Encamamiento - Alta Médica (Exp. ${activeHosp.id})`,
      details: details,
      diagnosis: activeHosp.admissionReason,
      total: grandTotal,
      status: 'Pendiente'
    };

    const patientObj = state.patients.find(p => p.id === patient.id);
    patientObj.billingHistory = patientObj.billingHistory || [];
    patientObj.billingHistory.unshift(newBill);

    saveAppState(state);

    alert(`Alta autorizada para ${patient.name}. La pre-factura por valor de Q${grandTotal.toFixed(2)} ha sido enviada al módulo de Facturación.`);
    renderEncamamiento(document.getElementById('module-container'));
  });
}

// 7. Modales de selección de órdenes integradas (Meds, Labs, Imgs)
function showMedsOrderModal(patient) {
  const state = getAppState();
  const modal = document.getElementById('checklist-modal');
  if (!modal) return;

  const modalBody = document.getElementById('checklist-modal-body') || modal.querySelector('.modal-body');
  const modalHeader = modal.querySelector('.modal-header h2') || modal.querySelector('h2');
  if (!modalBody) return;

  if (modalHeader) modalHeader.textContent = "Recetar Medicamentos de Farmacia";

  let listHtml = `
    <div style="margin-bottom: 10px;">
      <input type="text" id="hosp-med-search" placeholder="Buscar medicamento..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
    </div>
    <div id="hosp-meds-list-container" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
      <!-- Se inyecta catálogo -->
    </div>
  `;

  modalBody.innerHTML = listHtml;
  modal.style.display = 'flex';

  const filterContainer = () => {
    const q = document.getElementById('hosp-med-search').value.toLowerCase();
    const medsList = state.medications || [];
    const container = document.getElementById('hosp-meds-list-container');
    if (!container) return;

    container.innerHTML = medsList.filter(m => m.name.toLowerCase().includes(q) || (m.generic && m.generic.toLowerCase().includes(q)))
      .map(m => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.85rem;">
          <div style="flex: 2;">
            <strong>${m.name}</strong> (${m.presentation || 'N/A'})<br>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Stock: ${m.stock} | Precio: Q${parseFloat(m.price).toFixed(2)}</span>
          </div>
          <div style="display: flex; gap: 5px; align-items: center; flex: 1; justify-content: flex-end;">
            <input type="number" id="qty-${m.id}" value="1" min="1" max="${m.stock}" style="width: 45px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            <input type="text" id="dose-${m.id}" placeholder="Dosis..." style="width: 100px; padding: 4px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
            <button class="btn btn-success btn-small btn-add-med-hosp" data-id="${m.id}" style="padding: 4px 8px;">+</button>
          </div>
        </div>
      `).join('');

    // Bind Add buttons
    container.querySelectorAll('.btn-add-med-hosp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const m = medsList.find(x => x.id === id);
        const qty = parseInt(document.getElementById(`qty-${id}`).value) || 1;
        const dose = document.getElementById(`dose-${id}`).value || 'Según indicación';

        tempMeds.push({
          id: m.id,
          name: m.name,
          presentation: m.presentation || 'N/A',
          price: parseFloat(m.price),
          qty: qty,
          dosage: dose
        });

        alert(`Agregado: ${m.name} (Cant: ${qty})`);
        renderTempOrdersList();
      });
    });
  };

  document.getElementById('hosp-med-search').addEventListener('input', filterContainer);
  filterContainer();

  // Cambiar pie del modal para botón Cerrar
  const modalFooter = modal.querySelector('.modal-footer');
  if (modalFooter) {
    modalFooter.innerHTML = `<button class="btn btn-secondary" onclick="document.getElementById('checklist-modal').style.display='none'">Cerrar y Regresar</button>`;
  }
}

function showLabsOrderModal() {
  const state = getAppState();
  const modal = document.getElementById('checklist-modal');
  if (!modal) return;

  const modalBody = document.getElementById('checklist-modal-body') || modal.querySelector('.modal-body');
  const modalHeader = modal.querySelector('.modal-header h2') || modal.querySelector('h2');
  if (!modalBody) return;

  if (modalHeader) modalHeader.textContent = "Exámenes de Laboratorio Clínico";

  modalBody.innerHTML = `
    <div style="margin-bottom: 10px;">
      <input type="text" id="hosp-lab-search" placeholder="Buscar examen..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
    </div>
    <div id="hosp-labs-list-container" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
      <!-- Se inyecta laboratorio -->
    </div>
  `;

  modal.style.display = 'flex';

  const filterContainer = () => {
    const q = document.getElementById('hosp-lab-search').value.toLowerCase();
    const labsList = state.laboratoryTests || [];
    const container = document.getElementById('hosp-labs-list-container');
    if (!container) return;

    container.innerHTML = labsList.filter(l => l.name.toLowerCase().includes(q) || (l.category && l.category.toLowerCase().includes(q)))
      .map(l => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.85rem;">
          <div>
            <strong>${l.name}</strong><br>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Categoría: ${l.category || 'General'} | Precio: Q${parseFloat(l.price).toFixed(2)}</span>
          </div>
          <button class="btn btn-success btn-small btn-add-lab-hosp" data-id="${l.id}">Agregar</button>
        </div>
      `).join('');

    container.querySelectorAll('.btn-add-lab-hosp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const l = labsList.find(x => x.id === id);

        tempLabs.push({
          id: l.id,
          name: l.name,
          price: parseFloat(l.price)
        });

        alert(`Agregado: ${l.name}`);
        renderTempOrdersList();
      });
    });
  };

  document.getElementById('hosp-lab-search').addEventListener('input', filterContainer);
  filterContainer();

  const modalFooter = modal.querySelector('.modal-footer');
  if (modalFooter) {
    modalFooter.innerHTML = `<button class="btn btn-secondary" onclick="document.getElementById('checklist-modal').style.display='none'">Cerrar y Regresar</button>`;
  }
}

function showImgsOrderModal() {
  const state = getAppState();
  const modal = document.getElementById('checklist-modal');
  if (!modal) return;

  const modalBody = document.getElementById('checklist-modal-body') || modal.querySelector('.modal-body');
  const modalHeader = modal.querySelector('.modal-header h2') || modal.querySelector('h2');
  if (!modalBody) return;

  if (modalHeader) modalHeader.textContent = "Estudios de Imagenología Diagnóstica";

  modalBody.innerHTML = `
    <div style="margin-bottom: 10px;">
      <input type="text" id="hosp-img-search" placeholder="Buscar estudio..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
    </div>
    <div id="hosp-imgs-list-container" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
      <!-- Se inyecta imagenologia -->
    </div>
  `;

  modal.style.display = 'flex';

  const filterContainer = () => {
    const q = document.getElementById('hosp-img-search').value.toLowerCase();
    const imgsList = state.imagingStudies || [];
    const container = document.getElementById('hosp-imgs-list-container');
    if (!container) return;

    container.innerHTML = imgsList.filter(i => i.name.toLowerCase().includes(q) || (i.category && i.category.toLowerCase().includes(q)))
      .map(i => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.85rem;">
          <div>
            <strong>${i.name}</strong><br>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Categoría: ${i.category || 'General'} | Precio: Q${parseFloat(i.price).toFixed(2)}</span>
          </div>
          <button class="btn btn-success btn-small btn-add-img-hosp" data-id="${i.id}">Agregar</button>
        </div>
      `).join('');

    container.querySelectorAll('.btn-add-img-hosp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const img = imgsList.find(x => x.id === id);

        tempImgs.push({
          id: img.id,
          name: img.name,
          price: parseFloat(img.price)
        });

        alert(`Agregado: ${img.name}`);
        renderTempOrdersList();
      });
    });
  };

  document.getElementById('hosp-img-search').addEventListener('input', filterContainer);
  filterContainer();

  const modalFooter = modal.querySelector('.modal-footer');
  if (modalFooter) {
    modalFooter.innerHTML = `<button class="btn btn-secondary" onclick="document.getElementById('checklist-modal').style.display='none'">Cerrar y Regresar</button>`;
  }
}

// 8. Helpers para renderizado interno de listas en el dashboard
function renderTempOrdersList() {
  const container = document.getElementById('hosp-temp-orders-list');
  if (!container) return;

  if (tempMeds.length === 0 && tempLabs.length === 0 && tempImgs.length === 0) {
    container.innerHTML = 'Ninguna orden integrada agregada para esta evolución.';
    return;
  }

  container.innerHTML = `
    <ul style="list-style: square; padding-left: 15px; margin: 0; display: flex; flex-direction: column; gap: 4px;">
      ${tempMeds.map(m => `<li>💊 <strong>Med:</strong> ${m.name} (Cant: ${m.qty}, Dosis: ${m.dosage}) <span style="color: #f43f5e; cursor:pointer;" onclick="window.removeTempHospOrder('med', '${m.id}')">❌</span></li>`).join('')}
      ${tempLabs.map(l => `<li>🔬 <strong>Lab:</strong> ${l.name} (Q${parseFloat(l.price).toFixed(2)}) <span style="color: #f43f5e; cursor:pointer;" onclick="window.removeTempHospOrder('lab', '${l.id}')">❌</span></li>`).join('')}
      ${tempImgs.map(i => `<li>🖼️ <strong>Imagen:</strong> ${i.name} (Q${parseFloat(i.price).toFixed(2)}) <span style="color: #f43f5e; cursor:pointer;" onclick="window.removeTempHospOrder('img', '${i.id}')">❌</span></li>`).join('')}
    </ul>
  `;

  // Bind removal global function for easier reference inside inline elements
  window.removeTempHospOrder = (type, id) => {
    if (type === 'med') tempMeds = tempMeds.filter(m => m.id !== id);
    else if (type === 'lab') tempLabs = tempLabs.filter(l => l.id !== id);
    else if (type === 'img') tempImgs = tempImgs.filter(i => i.id !== id);
    renderTempOrdersList();
  };
}

function renderEvolutionsHistory(activeHosp) {
  const container = document.getElementById('hosp-evolutions-history-list');
  if (!container) return;

  const evos = activeHosp.evolutions || [];
  if (evos.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No se registran evoluciones médicas todavía.</div>';
    return;
  }

  container.innerHTML = evos.slice().reverse().map(e => {
    const formattedDate = new Date(e.date).toLocaleString('es-GT');
    return `
      <div style="background: rgba(255,255,255,0.02); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); border-left: 3px solid var(--accent-primary);">
        <div style="font-size: 0.72rem; color: var(--accent-primary); font-weight: bold; margin-bottom: 4px;">📅 ${formattedDate} | Dr. ${e.doctorName}</div>
        <p style="font-size: 0.85rem; color: var(--text-muted); white-space: pre-wrap; line-height: 1.4; margin: 0 0 8px 0;">${e.note}</p>
        
        ${e.dietType ? `
          <div style="font-size: 0.75rem; background: rgba(0, 242, 254, 0.04); border: 1px solid rgba(0, 242, 254, 0.15); padding: 5px 8px; border-radius: 4px; margin-bottom: 6px; color: var(--accent-primary); display: inline-block;">
            🥦 Dieta indicada: <strong>${e.dietType}</strong>
          </div>
        ` : ''}

        <!-- Detalles de recetas/laboratorio ordenados -->
        ${e.medications && e.medications.length > 0 ? `
          <div style="font-size: 0.75rem; background: rgba(0,0,0,0.1); padding: 6px; border-radius: 4px; margin-top: 4px;">
            <strong>💊 Medicamentos:</strong>
            ${e.medications.map(m => `<br>• ${m.name} - Cant: ${m.qty} - Dosis: ${m.dosage}`).join('')}
          </div>
        ` : ''}

        ${e.laboratoryTests && e.laboratoryTests.length > 0 ? `
          <div style="font-size: 0.75rem; background: rgba(0,0,0,0.1); padding: 6px; border-radius: 4px; margin-top: 4px;">
            <strong>🔬 Laboratorios indicados:</strong> ${e.laboratoryTests.map(l => l.name).join(', ')}
          </div>
        ` : ''}

        ${e.imagingStudies && e.imagingStudies.length > 0 ? `
          <div style="font-size: 0.75rem; background: rgba(0,0,0,0.1); padding: 6px; border-radius: 4px; margin-top: 4px;">
            <strong>🖼️ Estudios de imagenología:</strong> ${e.imagingStudies.map(i => i.name).join(', ')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderNursingHistory(activeHosp) {
  const container = document.getElementById('hosp-nursing-history-list');
  if (!container) return;

  const notes = activeHosp.nursingNotes || [];
  if (notes.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No se registran notas de enfermería todavía.</div>';
    return;
  }

  container.innerHTML = notes.slice().reverse().map(n => {
    const formattedDate = new Date(n.date).toLocaleString('es-GT');
    return `
      <div style="background: rgba(255,255,255,0.02); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); border-left: 3px solid var(--accent-success);">
        <div style="font-size: 0.72rem; color: var(--accent-success); font-weight: bold; margin-bottom: 4px;">📅 ${formattedDate} | Enf. ${n.nurseName}</div>
        <p style="font-size: 0.85rem; color: var(--text-muted); white-space: pre-wrap; line-height: 1.4; margin: 0;">${n.note}</p>
      </div>
    `;
  }).join('');
}

function renderVitalsHistoryTable(patient) {
  const container = document.getElementById('hosp-vitals-history-table');
  if (!container) return;

  const vitals = patient.vitalSigns || [];
  if (vitals.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No se registran signos vitales.</div>';
    return;
  }

  container.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-weight: bold; text-align: left;">
          <th style="padding: 6px;">Fecha</th>
          <th style="padding: 6px;">T(°C)</th>
          <th style="padding: 6px;">P.A.</th>
          <th style="padding: 6px;">F.C.</th>
          <th style="padding: 6px;">SPO2</th>
          <th style="padding: 6px;">Glucosa</th>
        </tr>
      </thead>
      <tbody>
        ${vitals.slice(0, 10).map(v => `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 8px 6px;">${new Date(v.date).toLocaleDateString()} ${new Date(v.date).toLocaleTimeString('es-GT', {hour: '2-digit', minute:'2-digit'})}</td>
            <td style="padding: 8px 6px; font-weight:500;">${v.temp}°C</td>
            <td style="padding: 8px 6px;">${v.bp_systolic || '-'}/${v.bp_diastolic || '-'}</td>
            <td style="padding: 8px 6px;">${v.heart_rate || '-'} bpm</td>
            <td style="padding: 8px 6px; color:var(--accent-primary); font-weight:500;">${v.oxygen || '-'}%</td>
            <td style="padding: 8px 6px;">${v.glucose || '-'} mg/dL</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// 9. Funciones de ayuda matemática y búsquedas
function getRoomRatePrice(rateId, state) {
  if (rateId === 'default') return 150.00;
  const rate = (state.roomRates || []).find(r => r.id === rateId);
  return rate ? parseFloat(rate.price) : 150.00;
}

// 10. Función para impresión de la Hoja de Hospitalización (Expediente Clínico de Encamamiento)
function printHospitalizationRecord(hosp, patient) {
  const state = getAppState();
  const clinicInfo = state.clinicInfo || { name: 'LUGAMED 2.0', phone: '2200-0000', address: 'Guatemala' };
  const dob = new Date(patient.birthdate);
  const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  const daysIn = Math.max(1, Math.ceil((Date.now() - new Date(hosp.admissionDate).getTime()) / (1000 * 60 * 60 * 24)));

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Expediente de Hospitalización - ${patient.name}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            color: #333;
            line-height: 1.5;
            padding: 20px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #1e3a8a;
            margin: 0;
            font-size: 1.8rem;
          }
          .grid-info {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            background: #f3f4f6;
            padding: 15px;
            border-radius: 6px;
            font-size: 0.9rem;
            margin-bottom: 20px;
          }
          .grid-info div {
            margin-bottom: 5px;
          }
          .section-title {
            color: #1e3a8a;
            border-bottom: 1px solid #ddd;
            font-size: 1.1rem;
            font-weight: bold;
            margin-top: 25px;
            margin-bottom: 10px;
            padding-bottom: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
            margin-bottom: 15px;
          }
          table th, table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          table th {
            background-color: #f9fafb;
          }
          .evo-item, .nurse-item {
            border-left: 3px solid #1e3a8a;
            padding-left: 10px;
            margin-bottom: 15px;
            font-size: 0.88rem;
          }
          .nurse-item {
            border-left-color: #10b981;
          }
          .evo-date, .nurse-date {
            font-weight: bold;
            color: #1e3a8a;
            font-size: 0.8rem;
          }
          .nurse-date {
            color: #10b981;
          }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px;">
          <button onclick="window.print();" style="padding: 10px 20px; background: #1e3a8a; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🖨️ Imprimir Expediente</button>
          <button onclick="window.close();" style="padding: 10px 20px; background: #f3f4f6; color: #333; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; margin-left: 10px;">Cerrar</button>
        </div>

        <div class="header">
          <div>
            <h1>${clinicInfo.name}</h1>
            <span style="font-size: 0.8rem; color: #666;">Dirección: ${clinicInfo.address} | Tel: ${clinicInfo.phone}</span>
          </div>
          <div style="text-align: right;">
            <h2>EXPEDIENTE DE ENCAMAMIENTO</h2>
            <strong>No. ID:</strong> ${hosp.id}
          </div>
        </div>

        <div class="grid-info">
          <div><strong>Paciente:</strong> ${patient.name}</div>
          <div><strong>DPI:</strong> ${patient.dpi || 'N/A'}</div>
          <div><strong>Edad:</strong> ${age} años</div>
          <div><strong>Género:</strong> ${patient.gender}</div>
          <div><strong>Habitación / Cama:</strong> ${hosp.roomName || 'General'}</div>
          <div><strong>Días de Estancia:</strong> ${daysIn} día(s)</div>
          <div><strong>Médico Tratante:</strong> ${hosp.doctorName}</div>
          <div><strong>Familiar Responsable:</strong> ${hosp.responsibleFamilyName} (${hosp.responsibleFamilyPhone})</div>
          <div style="grid-column: 1/-1;"><strong>Diagnóstico de Ingreso:</strong> ${hosp.admissionReason}</div>
          <div style="grid-column: 1/-1;"><strong>Tipo de Dieta al Ingreso / Actual:</strong> <span style="font-weight: bold; color: #1e3a8a;">${hosp.dietType || 'No especificada'}</span></div>
          <div style="grid-column: 1/-1; background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 4px; margin-top: 5px;">
            <strong>📋 Órdenes Médicas al Ingreso:</strong>
            <p style="white-space: pre-wrap; font-family: monospace; font-size: 0.8rem; margin: 4px 0 0 0; color: #4b5563; line-height: 1.4;">${hosp.admissionOrders || 'Ninguna registrada'}</p>
          </div>
        </div>

        <div class="section-title">Signos Vitales al Ingreso</div>
        <table>
          <thead>
            <tr>
              <th>Temperatura</th>
              <th>Presión Arterial</th>
              <th>Frecuencia Cardíaca</th>
              <th>Frecuencia Respiratoria</th>
              <th>Saturación O2</th>
              <th>Glucosa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${hosp.initialVitals.temp}°C</td>
              <td>${hosp.initialVitals.bp_systolic || '-'}/${hosp.initialVitals.bp_diastolic || '-'} mmHg</td>
              <td>${hosp.initialVitals.heart_rate || '-'} LPM</td>
              <td>${hosp.initialVitals.resp_rate || '-'} RPM</td>
              <td>${hosp.initialVitals.oxygen || '-'}%</td>
              <td>${hosp.initialVitals.glucose || '-'} mg/dL</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">Cronología de Evoluciones Médicas</div>
        ${(hosp.evolutions || []).length === 0 ? '<p>No se registran notas de evolución.</p>' : hosp.evolutions.map(e => `
          <div class="evo-item">
            <div class="evo-date">📅 ${new Date(e.date).toLocaleString('es-GT')} | Dr. ${e.doctorName}</div>
            <p style="margin: 4px 0;">${e.note}</p>
            ${e.medications && e.medications.length > 0 ? `
              <div style="font-size: 0.78rem; color:#666;">
                <strong>Receta asociada:</strong> ${e.medications.map(m => `${m.name} (${m.qty})`).join(', ')}
              </div>
            ` : ''}
            ${e.laboratoryTests && e.laboratoryTests.length > 0 ? `
              <div style="font-size: 0.78rem; color:#666;">
                <strong>Laboratorio asociado:</strong> ${e.laboratoryTests.map(l => l.name).join(', ')}
              </div>
            ` : ''}
          </div>
        `).join('')}

        <div class="section-title">Cronología de Notas de Enfermería</div>
        ${(hosp.nursingNotes || []).length === 0 ? '<p>No se registran notas de enfermería.</p>' : hosp.nursingNotes.map(n => `
          <div class="nurse-item">
            <div class="nurse-date">📅 ${new Date(n.date).toLocaleString('es-GT')} | Personal: ${n.nurseName}</div>
            <p style="margin: 4px 0;">${n.note}</p>
          </div>
        `).join('')}

        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 0.85rem;">
          <div style="border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 5px; margin-top: 20px;">
            Firma del Médico Tratante
          </div>
          <div style="border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 5px; margin-top: 20px;">
            Firma Supervisor Enfermería
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
}
