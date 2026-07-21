// src/modules/preconsulta.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId } from '../main.js';
import logoUrl from '../assets/logo.jpg';

export function renderPreconsulta(container) {
  const state = getAppState();
  
  // HTML layout for Preconsulta
  container.innerHTML = `
    <div class="module-header">
      <div class="module-title">
        <h1>Preconsulta</h1>
        <p>Toma de signos vitales, datos demográficos, citas y gestión de estudios.</p>
      </div>
      <div>
        <button class="btn btn-primary" id="btn-new-patient">
          <span>+</span> Nuevo Paciente
        </button>
      </div>
    </div>

    <div class="grid-sidebar">
      <!-- Barra lateral de pacientes -->
      <div class="glass-card search-sidebar">
        <h3>Pacientes</h3>
        <div class="form-group" style="margin-top: 10px;">
          <input type="text" id="patient-search" placeholder="🔍 Buscar paciente...">
        </div>
        <ul class="patient-list" id="patient-list-container">
          <!-- Cargar dinámicamente -->
        </ul>
      </div>

      <!-- Área principal de detalles -->
      <div id="patient-detail-area">
        <!-- Renders patient info or empty state -->
      </div>
    </div>
  `;

  // Bind new patient button
  document.getElementById('btn-new-patient').addEventListener('click', showNewPatientForm);

  // Bind search input
  document.getElementById('patient-search').addEventListener('input', (e) => {
    renderPatientList(e.target.value);
  });

  // Initial render of patient list and detail area
  renderPatientList();
  renderPatientDetails();
}

// Renderizar la lista de pacientes en la barra lateral
function renderPatientList(query = '') {
  const state = getAppState();
  const listContainer = document.getElementById('patient-list-container');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  const currentUser = state.currentUser;
  let basePatients = state.patients || [];

  // Si el usuario es médico, ve los pacientes asignados o referidos por interconsulta
  if (currentUser && currentUser.role === 'medico') {
    basePatients = basePatients.filter(p => 
      p.assignedDoctorId === currentUser.id || 
      p.assignedDoctorName === currentUser.name ||
      (p.referredDoctorIds && p.referredDoctorIds.includes(currentUser.id)) ||
      (p.referredDoctorNames && p.referredDoctorNames.includes(currentUser.name))
    );
  }

  const filtered = basePatients.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.telephone.includes(query)
  );

  if (filtered.length === 0) {
    listContainer.innerHTML = '<li style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No se encontraron pacientes</li>';
    return;
  }

  const activeId = getActivePatientId();

  filtered.forEach(p => {
    const li = document.createElement('li');
    li.className = `patient-item ${p.id === activeId ? 'selected' : ''}`;
    
    // Obtener últimos signos vitales
    const lastVitals = p.vitalSigns && p.vitalSigns.length > 0 ? p.vitalSigns[0] : null;
    const bpText = lastVitals ? `${lastVitals.bp_systolic}/${lastVitals.bp_diastolic} mmHg` : 'Sin registros';
    
    li.innerHTML = `
      <div class="patient-item-name">${p.name}</div>
      <div class="patient-item-meta">Tel: ${p.telephone} | P.A: ${bpText}</div>
    `;
    
    li.addEventListener('click', () => {
      setActivePatientId(p.id);
      renderPatientList(query);
      renderPatientDetails();
    });
    
    listContainer.appendChild(li);
  });
}

// Mostrar el formulario de nuevo paciente en el área de detalles
function showNewPatientForm() {
  const detailArea = document.getElementById('patient-detail-area');
  if (!detailArea) return;

  const state = getAppState();
  const doctors = (state.users || []).filter(u => u.role === 'medico');
  const currentUser = state.currentUser;

  detailArea.innerHTML = `
    <div class="glass-card">
      <h2 style="font-family: var(--font-heading); margin-bottom: 1.5rem; color: var(--accent-primary);">Registrar Nuevo Paciente</h2>
      <form id="new-patient-form">
        <div class="form-group">
          <label for="p-name">Nombre Completo</label>
          <input type="text" id="p-name" required placeholder="Ej. Juan Francisco Pérez">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="p-birthdate">Fecha de Nacimiento</label>
            <input type="date" id="p-birthdate" required>
          </div>
          <div class="form-group">
            <label for="p-gender">Género</label>
            <select id="p-gender" required>
              <option value="">Seleccione...</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="p-dpi">DPI / Documento de Identificación</label>
            <input type="text" id="p-dpi" placeholder="Ej. 2500 12345 0101">
          </div>
          <div class="form-group">
            <label for="p-assigned-doctor">Médico Tratante (Asignado)</label>
            <select id="p-assigned-doctor" required>
              <option value="">Seleccione Médico Tratante...</option>
              ${doctors.map(d => `<option value="${d.id}" ${currentUser && currentUser.id === d.id ? 'selected' : ''}>${d.name} (Col. ${d.license || 'N/A'})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="p-telephone">Teléfono</label>
            <input type="tel" id="p-telephone" required placeholder="Ej. 5555-1234">
          </div>
          <div class="form-group">
            <label for="p-email">Correo Electrónico <small style="opacity: 0.7; font-weight: normal;">(Opcional)</small></label>
            <input type="text" id="p-email" placeholder="Ej. paciente@correo.com (Opcional)">
          </div>
        </div>
        <div class="form-group">
          <label for="p-address">Dirección de Domicilio</label>
          <input type="text" id="p-address" required placeholder="Ej. Calle Principal 1-23 Zona 1">
        </div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-new-patient">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar Paciente</button>
        </div>
      </form>
    </div>
  `;

  const birthdateInput = document.getElementById('p-birthdate');
  const dpiInput = document.getElementById('p-dpi');

  function updateDpiBasedOnAge() {
    const bdate = birthdateInput.value;
    if (!bdate) return;
    const dob = new Date(bdate);
    if (isNaN(dob.getTime())) return;
    const ageMs = Date.now() - dob.getTime();
    const ageYears = Math.abs(new Date(ageMs).getUTCFullYear() - 1970);

    if (ageYears < 18) {
      dpiInput.value = 'Menor de Edad';
    } else if (dpiInput.value === 'Menor de Edad') {
      dpiInput.value = '';
    }
  }

  birthdateInput.addEventListener('change', updateDpiBasedOnAge);

  dpiInput.addEventListener('blur', () => {
    const bdate = birthdateInput.value;
    if (!bdate) return;
    const dob = new Date(bdate);
    if (isNaN(dob.getTime())) return;
    const ageMs = Date.now() - dob.getTime();
    const ageYears = Math.abs(new Date(ageMs).getUTCFullYear() - 1970);

    if (ageYears >= 18 && !dpiInput.value.trim()) {
      dpiInput.value = 'No Presenta Documento';
    }
  });

  document.getElementById('btn-cancel-new-patient').addEventListener('click', renderPatientDetails);

  document.getElementById('new-patient-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const stateObj = getAppState();

    const bdate = birthdateInput.value;
    const dob = new Date(bdate);
    const ageMs = Date.now() - dob.getTime();
    const ageYears = Math.abs(new Date(ageMs).getUTCFullYear() - 1970);

    let finalDpi = dpiInput.value.trim();
    if (ageYears < 18) {
      finalDpi = 'Menor de Edad';
    } else if (!finalDpi || finalDpi === '') {
      finalDpi = 'No Presenta Documento';
    }

    const docSelect = document.getElementById('p-assigned-doctor');
    const assignedDoctorId = docSelect.value;
    const docObj = (stateObj.users || []).find(u => u.id === assignedDoctorId);
    const assignedDoctorName = docObj ? docObj.name : 'Dr. Carlos Mendoza';
    
    const newId = 'p-' + (stateObj.patients.length + 1) + '-' + Math.random().toString(36).substr(2, 4);
    const newPatient = {
      id: newId,
      name: document.getElementById('p-name').value,
      birthdate: bdate,
      gender: document.getElementById('p-gender').value,
      dpi: finalDpi,
      assignedDoctorId: assignedDoctorId,
      assignedDoctorName: assignedDoctorName,
      telephone: document.getElementById('p-telephone').value,
      address: document.getElementById('p-address').value,
      email: document.getElementById('p-email').value || 'No provisto',
      vitalSigns: [],
      consultations: [],
      labHistory: [],
      imagingHistory: [],
      prescriptions: [],
      appointments: []
    };

    stateObj.patients.push(newPatient);
    saveAppState(stateObj);
    
    setActivePatientId(newId);
    renderPatientList();
    renderPatientDetails();
  });
}

// Mostrar el formulario de edición de paciente
function showEditPatientForm(patient) {
  const detailArea = document.getElementById('patient-detail-area');
  if (!detailArea) return;

  const state = getAppState();
  const doctors = (state.users || []).filter(u => u.role === 'medico');

  detailArea.innerHTML = `
    <div class="glass-card">
      <h2 style="font-family: var(--font-heading); margin-bottom: 1.5rem; color: var(--accent-primary);">Editar Datos del Paciente</h2>
      <form id="edit-patient-form">
        <div class="form-group">
          <label for="ep-name">Nombre Completo</label>
          <input type="text" id="ep-name" required value="${patient.name}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="ep-birthdate">Fecha de Nacimiento</label>
            <input type="date" id="ep-birthdate" required value="${patient.birthdate}">
          </div>
          <div class="form-group">
            <label for="ep-gender">Género</label>
            <select id="ep-gender" required>
              <option value="Masculino" ${patient.gender === 'Masculino' ? 'selected' : ''}>Masculino</option>
              <option value="Femenino" ${patient.gender === 'Femenino' ? 'selected' : ''}>Femenino</option>
              <option value="Otro" ${patient.gender === 'Otro' ? 'selected' : ''}>Otro</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="ep-dpi">DPI / Documento de Identificación</label>
            <input type="text" id="ep-dpi" value="${patient.dpi || ''}">
          </div>
          <div class="form-group">
            <label for="ep-assigned-doctor">Médico Tratante (Asignado)</label>
            <select id="ep-assigned-doctor" required>
              ${doctors.map(d => `<option value="${d.id}" ${patient.assignedDoctorId === d.id ? 'selected' : ''}>${d.name} (Col. ${d.license || 'N/A'})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="ep-telephone">Teléfono</label>
            <input type="tel" id="ep-telephone" required value="${patient.telephone}">
          </div>
          <div class="form-group">
            <label for="ep-email">Correo Electrónico <small style="opacity: 0.7; font-weight: normal;">(Opcional)</small></label>
            <input type="text" id="ep-email" value="${patient.email && patient.email !== 'No provisto' ? patient.email : ''}" placeholder="Ej. paciente@correo.com (Opcional)">
          </div>
        </div>
        <div class="form-group">
          <label for="ep-address">Dirección de Domicilio</label>
          <input type="text" id="ep-address" required value="${patient.address}">
        </div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-edit-patient">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Cambios</button>
        </div>
      </form>
    </div>
  `;

  const birthdateInput = document.getElementById('ep-birthdate');
  const dpiInput = document.getElementById('ep-dpi');

  function updateDpiBasedOnAge() {
    const bdate = birthdateInput.value;
    if (!bdate) return;
    const dob = new Date(bdate);
    if (isNaN(dob.getTime())) return;
    const ageMs = Date.now() - dob.getTime();
    const ageYears = Math.abs(new Date(ageMs).getUTCFullYear() - 1970);

    if (ageYears < 18) {
      dpiInput.value = 'Menor de Edad';
    } else if (dpiInput.value === 'Menor de Edad') {
      dpiInput.value = '';
    }
  }

  birthdateInput.addEventListener('change', updateDpiBasedOnAge);

  dpiInput.addEventListener('blur', () => {
    const bdate = birthdateInput.value;
    if (!bdate) return;
    const dob = new Date(bdate);
    if (isNaN(dob.getTime())) return;
    const ageMs = Date.now() - dob.getTime();
    const ageYears = Math.abs(new Date(ageMs).getUTCFullYear() - 1970);

    if (ageYears >= 18 && !dpiInput.value.trim()) {
      dpiInput.value = 'No Presenta Documento';
    }
  });

  document.getElementById('btn-cancel-edit-patient').addEventListener('click', renderPatientDetails);

  document.getElementById('edit-patient-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const stateObj = getAppState();
    const pObj = stateObj.patients.find(p => p.id === patient.id);
    if (!pObj) return;

    const bdate = birthdateInput.value;
    const dob = new Date(bdate);
    const ageMs = Date.now() - dob.getTime();
    const ageYears = Math.abs(new Date(ageMs).getUTCFullYear() - 1970);

    let finalDpi = dpiInput.value.trim();
    if (ageYears < 18) {
      finalDpi = 'Menor de Edad';
    } else if (!finalDpi || finalDpi === '') {
      finalDpi = 'No Presenta Documento';
    }

    const docSelect = document.getElementById('ep-assigned-doctor');
    const assignedDoctorId = docSelect.value;
    const docObj = (stateObj.users || []).find(u => u.id === assignedDoctorId);
    const assignedDoctorName = docObj ? docObj.name : 'Dr. Carlos Mendoza';

    pObj.name = document.getElementById('ep-name').value;
    pObj.birthdate = bdate;
    pObj.gender = document.getElementById('ep-gender').value;
    pObj.dpi = finalDpi;
    pObj.assignedDoctorId = assignedDoctorId;
    pObj.assignedDoctorName = assignedDoctorName;
    pObj.telephone = document.getElementById('ep-telephone').value;
    pObj.email = document.getElementById('ep-email').value || 'No provisto';
    pObj.address = document.getElementById('ep-address').value;

    saveAppState(stateObj);
    renderPatientList();
    renderPatientDetails();
  });
}

// Renderizar la información detallada del paciente seleccionado
function renderPatientDetails() {
  const state = getAppState();
  const detailArea = document.getElementById('patient-detail-area');
  if (!detailArea) return;

  const activeId = getActivePatientId();
  const patient = state.patients.find(p => p.id === activeId);

  if (!patient) {
    detailArea.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 4rem 2rem;">
        <span style="font-size: 3rem;">👥</span>
        <h2 style="margin-top: 1rem;">Selecciona o crea un paciente</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem;">Utiliza la barra lateral para buscar y seleccionar a un paciente, o registra uno nuevo.</p>
      </div>
    `;
    return;
  }

  // Calcular edad
  const dob = new Date(patient.birthdate);
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  const age = Math.abs(ageDt.getUTCFullYear() - 1970);

  detailArea.innerHTML = `
    <!-- Ficha de Encabezado -->
    <div class="glass-card" style="margin-bottom: 2rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-family: var(--font-heading); color: var(--accent-primary); font-size: 1.8rem; margin-bottom: 0.3rem;">${patient.name}</h2>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            <span>🆔 DPI: <strong>${patient.dpi || (age < 18 ? 'Menor de Edad' : 'No Presenta Documento')}</strong></span> | 
            <span>🎂 Edad: ${age} años (${patient.birthdate})</span> | 
            <span>🧬 Género: ${patient.gender}</span>
          </p>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">
            <span>🩺 Médico Tratante: <strong>${patient.assignedDoctorName || 'Dr. Carlos Mendoza'}</strong></span> | 
            <span>📞 Tel: ${patient.telephone}</span> | 
            <span>📍 Dirección: ${patient.address}</span>
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" id="btn-edit-patient">
            <span>✏️</span> Editar Paciente
          </button>
          <button class="btn btn-primary" id="btn-show-history-modal" onclick="window.openClinicalHistoryModal()">
            <span>📋</span> Historial Clínico Completo
          </button>
        </div>
      </div>
    </div>

    <!-- Pestañas del Módulo -->
    <div class="tabs-container">
      <button class="tab-btn active" id="tab-vitals">Signos Vitales</button>
      <button class="tab-btn" id="tab-appointments">Agendar Citas</button>
      <button class="tab-btn" id="tab-studies">Laboratorios e Imagenología</button>
      <button class="tab-btn" id="tab-billing">Facturación</button>
    </div>

    <!-- Contenido de las Pestañas -->
    <div class="glass-card">
      <!-- Pestaña Signos Vitales -->
      <div id="pane-vitals" class="tab-pane active">
        <h3 style="margin-bottom: 1.25rem;">Registro de Signos Vitales</h3>
        <div class="vitals-grid" id="vitals-summary-cards">
          <!-- Se llena dinámicamente con los últimos signos -->
        </div>

        <form id="vitals-form" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
          <h4 style="margin-bottom: 1rem; color: var(--accent-secondary);">Tomar Nuevas Medidas</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="v-temp">Temperatura (°C)</label>
              <input type="number" step="0.1" id="v-temp" required placeholder="Ej. 37.0">
            </div>
            <div class="form-group">
              <label for="v-bp-sys">Presión Sistólica (mmHg)</label>
              <input type="number" id="v-bp-sys" required placeholder="Ej. 120">
            </div>
            <div class="form-group">
              <label for="v-bp-dia">Presión Diastólica (mmHg)</label>
              <input type="number" id="v-bp-dia" required placeholder="Ej. 80">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="v-hr">Frec. Cardíaca (lpm)</label>
              <input type="number" id="v-hr" required placeholder="Ej. 75">
            </div>
            <div class="form-group">
              <label for="v-rr">Frec. Respiratoria (rpm)</label>
              <input type="number" id="v-rr" required placeholder="Ej. 18">
            </div>
            <div class="form-group">
              <label for="v-oxygen">Saturación Oxígeno (%)</label>
              <input type="number" id="v-oxygen" required placeholder="Ej. 98">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="v-weight">Peso (kg)</label>
              <input type="number" step="0.01" id="v-weight" required placeholder="Ej. 70.5">
            </div>
            <div class="form-group">
              <label for="v-height">Talla / Estatura (m)</label>
              <input type="number" step="0.01" id="v-height" required placeholder="Ej. 1.70">
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
            <button type="submit" class="btn btn-primary">Grabar Signos Vitales</button>
          </div>
        </form>

        <h4 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--accent-primary);">Historial de Mediciones</h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Temp</th>
                <th>Presión Art.</th>
                <th>Frec. Card.</th>
                <th>Frec. Resp.</th>
                <th>Oxígeno</th>
                <th>Peso</th>
                <th>Estatura</th>
                <th>IMC</th>
              </tr>
            </thead>
            <tbody id="table-vitals-body">
              <!-- Cargar historial -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pestaña Agendar Citas -->
      <div id="pane-appointments" class="tab-pane">
        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
          <div style="flex: 2; min-width: 300px;">
            <h3 style="margin-bottom: 1.25rem;">Agendar Nueva Cita</h3>
            <form id="appointment-form">
              <div class="form-row">
                <div class="form-group" style="flex: 1;">
                  <label for="app-date">Fecha</label>
                  <input type="date" id="app-date" required>
                </div>
                <div class="form-group" style="display: none;">
                  <label for="app-time">Hora</label>
                  <input type="hidden" id="app-time" required>
                </div>
              </div>

              <!-- Selector de Horarios Personalizado -->
              <div id="slot-picker-area" style="margin-top: 1rem; margin-bottom: 1.5rem; display: none;">
                <label style="font-weight: 700; color: var(--accent-primary); margin-bottom: 8px;">Horarios Disponibles (Intervalos de 30 mins)</label>
                <div id="slot-picker-grid" style="
                  display: grid; 
                  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); 
                  gap: 10px; 
                  margin-top: 8px;
                "></div>
              </div>

              <!-- Aviso de Día Inhábil o Fin de Semana -->
              <div id="slot-picker-warning" style="
                margin-top: 1rem; 
                margin-bottom: 1.5rem; 
                padding: 15px; 
                background: rgba(255, 23, 68, 0.1); 
                border: 1px solid var(--danger-color); 
                border-radius: var(--radius-sm); 
                color: #ff5252; 
                font-size: 0.9rem; 
                display: none;
              "></div>

              <div class="form-group">
                <label for="app-notes">Notas / Motivo de la Cita</label>
                <textarea id="app-notes" required placeholder="Ej. Control de diabetes, revisión de exámenes..."></textarea>
              </div>
              <div style="display: flex; justify-content: flex-end;">
                <button type="submit" class="btn btn-primary" id="btn-schedule-appt" disabled>Agendar Cita</button>
              </div>
            </form>
          </div>

          <!-- Bloqueo de Calendario (Días de No Atención) -->
          <div style="flex: 1; min-width: 250px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: var(--radius-sm);">
            <h4 style="color: var(--accent-secondary); margin-bottom: 1rem; font-family: var(--font-heading);">Bloqueo de Calendario</h4>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">Configure los días específicos en los que el consultorio estará cerrado por feriados, vacaciones o congresos.</p>
            
            <form id="block-calendar-form" style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1.5rem;">
              <div class="form-group">
                <label for="block-date">Bloquear Fecha</label>
                <input type="date" id="block-date" required>
              </div>
              <div class="form-group">
                <label for="block-reason">Motivo / Razón</label>
                <input type="text" id="block-reason" placeholder="Ej. Congreso Médico, Feriado..." required>
              </div>
              <button type="submit" class="btn btn-secondary btn-small" style="width: 100%;">
                <span>🚫</span> Bloquear Día
              </button>
            </form>

            <h5 style="margin-bottom: 0.75rem; color: var(--text-primary);">Días Bloqueados Registrados</h5>
            <ul id="blocked-days-list" style="
              list-style: none; 
              padding: 0; 
              margin: 0; 
              max-height: 180px; 
              overflow-y: auto; 
              font-size: 0.8rem;
              display: flex;
              flex-direction: column;
              gap: 8px;
            "></ul>
          </div>
        </div>

        <h4 style="margin-top: 2.5rem; margin-bottom: 1rem; color: var(--accent-primary);">Citas Programadas</h4>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Detalles / Motivo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="table-appointments-body">
              <!-- Cargar citas -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pestaña laboratorios/imagenología -->
      <div id="pane-studies" class="tab-pane">
        <div class="grid-2">
          <!-- Carga de Laboratorios -->
          <div>
            <h3 style="margin-bottom: 1.25rem; color: var(--accent-primary);">📁 Ingreso de Laboratorios</h3>
            <form id="form-lab-upload">
              <div class="form-group">
                <label for="lab-name">Nombre del Estudio</label>
                <input type="text" id="lab-name" required placeholder="Ej. Hemograma Completo, Examen General de Orina">
              </div>
              <div class="form-group">
                <label>Resultado (Imagen o PDF)</label>
                <div class="file-upload-wrapper">
                  <span class="file-upload-icon">📤</span>
                  <span class="file-upload-text">Haz clic o arrastra un archivo (PNG/JPG/PDF)</span>
                  <input type="file" id="lab-file" accept="image/*,application/pdf" required>
                </div>
                <div id="lab-file-status" style="font-size: 0.8rem; color: var(--accent-success); margin-top: 4px;"></div>
              </div>
              <div class="form-group">
                <label for="lab-notes">Notas / Interpretación rápida</label>
                <textarea id="lab-notes" placeholder="Ej. Niveles elevados de glucosa..."></textarea>
              </div>
              <button type="submit" class="btn btn-primary btn-small">Cargar Laboratorio</button>
            </form>

            <h4 style="margin-top: 2rem; margin-bottom: 0.75rem;">Historial de Laboratorios</h4>
            <ul class="uploaded-files" id="lab-history-list">
              <!-- Cargar dinámicamente -->
            </ul>
          </div>

          <!-- Carga de Imagenología -->
          <div>
            <h3 style="margin-bottom: 1.25rem; color: var(--accent-secondary);">🖼️ Ingreso de Imagenología</h3>
            <form id="form-img-upload">
              <div class="form-group">
                <label for="img-name">Nombre del Estudio</label>
                <input type="text" id="img-name" required placeholder="Ej. Radiografía de Tórax, Ecografía Abdominal">
              </div>
              <div class="form-group">
                <label>Estudio / Informe (Imagen o PDF)</label>
                <div class="file-upload-wrapper">
                  <span class="file-upload-icon">📷</span>
                  <span class="file-upload-text">Selecciona la placa o informe en PDF</span>
                  <input type="file" id="img-file" accept="image/*,application/pdf" required>
                </div>
                <div id="img-file-status" style="font-size: 0.8rem; color: var(--accent-success); margin-top: 4px;"></div>
              </div>
              <div class="form-group">
                <label for="img-notes">Notas del Informe Radiológico</label>
                <textarea id="img-notes" placeholder="Ej. Pulmones hiperinsuflados sin consolidaciones..."></textarea>
              </div>
              <button type="submit" class="btn btn-secondary btn-small">Cargar Imagenología</button>
            </form>

            <h4 style="margin-top: 2rem; margin-bottom: 0.75rem;">Historial de Imagenología</h4>
            <ul class="uploaded-files" id="img-history-list">
              <!-- Cargar dinámicamente -->
            </ul>
          </div>

          <!-- Resultados de Laboratorio Locales (Propios) -->
          <div style="grid-column: 1 / -1; margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 2rem;">
            <h3 style="color: var(--accent-primary); margin-bottom: 1rem;">🔬 Resultados de Laboratorios Locales (MedFlow Labs)</h3>
            <div id="local-lab-results-list-preconsulta" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px;">
              <!-- Cargar dinámicamente -->
            </div>
          </div>
        </div>
      </div>

      <!-- Pestaña Facturación -->
      <div id="pane-billing" class="tab-pane">
        <h3 style="margin-bottom: 1.25rem; color: var(--accent-primary);">Historial de Facturación y Comprobantes</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">
          Comprobantes de cobro generados automáticamente al registrar las consultas médicas.
        </p>

        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Diagnóstico Principal</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="table-billing-body">
              <!-- Se cargan las facturas dinámicamente -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Bind Tabs
  const currentUser = state.currentUser;
  const canBilling = isUserBillingAuthorized(currentUser);

  const tabBillingBtn = document.getElementById('tab-billing');
  if (tabBillingBtn) {
    if (!canBilling) {
      tabBillingBtn.style.display = 'none';
    } else {
      tabBillingBtn.style.display = 'inline-block';
    }
  }

  const tabs = {
    'tab-vitals': 'pane-vitals',
    'tab-appointments': 'pane-appointments',
    'tab-studies': 'pane-studies',
    'tab-billing': 'pane-billing'
  };

  Object.keys(tabs).forEach(tabId => {
    const btnEl = document.getElementById(tabId);
    if (!btnEl) return;

    btnEl.addEventListener('click', (e) => {
      // Remover clase activo de botones y paneles
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

      // Activar clickeado
      e.target.classList.add('active');
      const paneEl = document.getElementById(tabs[tabId]);
      if (paneEl) paneEl.classList.add('active');
    });
  });

  // Bind Edit Patient Button
  const btnEditPatient = document.getElementById('btn-edit-patient');
  if (btnEditPatient) {
    btnEditPatient.addEventListener('click', () => {
      showEditPatientForm(patient);
    });
  }

  // Bind History Modal Button
  const btnShowHistory = document.getElementById('btn-show-history-modal');
  if (btnShowHistory) {
    btnShowHistory.addEventListener('click', (e) => {
      e.preventDefault();
      showClinicalHistoryModal(patient);
    });
  }

  // Bind Vitals Form Submit
  document.getElementById('vitals-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const temp = parseFloat(document.getElementById('v-temp').value);
    const sys = parseInt(document.getElementById('v-bp-sys').value);
    const dia = parseInt(document.getElementById('v-bp-dia').value);
    const hr = parseInt(document.getElementById('v-hr').value);
    const rr = parseInt(document.getElementById('v-rr').value);
    const oxygen = parseInt(document.getElementById('v-oxygen').value);
    const weight = parseFloat(document.getElementById('v-weight').value);
    const height = parseFloat(document.getElementById('v-height').value);
    
    // Calcular IMC
    const bmi = parseFloat((weight / (height * height)).toFixed(1));

    const newVitals = {
      date: new Date().toISOString(),
      temp,
      bp_systolic: sys,
      bp_diastolic: dia,
      heart_rate: hr,
      resp_rate: rr,
      weight,
      height,
      bmi,
      oxygen
    };

    const stateObj = getAppState();
    const patientObj = stateObj.patients.find(p => p.id === patient.id);
    patientObj.vitalSigns.unshift(newVitals); // Agregar al inicio
    saveAppState(stateObj);
    
    renderPatientDetails(); // Recargar datos
  });

  // Bind Appointment Form Submit
  document.getElementById('appointment-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('app-date').value;
    const time = document.getElementById('app-time').value;
    const notes = document.getElementById('app-notes').value;

    const newApp = { date, time, notes };

    const stateObj = getAppState();
    const patientObj = stateObj.patients.find(p => p.id === patient.id);
    patientObj.appointments.push(newApp);
    // Ordenar citas por fecha
    patientObj.appointments.sort((a,b) => new Date(a.date+'T'+a.time) - new Date(b.date+'T'+b.time));
    saveAppState(stateObj);
    
    document.getElementById('appointment-form').reset();
    document.getElementById('app-time').value = '';
    document.getElementById('slot-picker-area').style.display = 'none';
    document.getElementById('slot-picker-warning').style.display = 'none';
    document.getElementById('btn-schedule-appt').disabled = true;

    renderAppointments(patientObj);
  });

  // File Upload Handlers (conversion to Base64)
  let loadedLabFileBase64 = '';
  let loadedLabFileName = '';
  let loadedLabFileType = 'image';
  
  const labFileInput = document.getElementById('lab-file');
  const labStatus = document.getElementById('lab-file-status');
  labFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadedLabFileName = file.name;
    loadedLabFileType = file.type.includes('pdf') ? 'pdf' : 'image';
    
    const reader = new FileReader();
    reader.onload = function(evt) {
      loadedLabFileBase64 = evt.target.result;
      labStatus.textContent = `Archivo listo: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('form-lab-upload').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!loadedLabFileBase64) return;
    
    const newLab = {
      date: new Date().toISOString(),
      name: document.getElementById('lab-name').value,
      fileName: loadedLabFileName,
      fileData: loadedLabFileBase64,
      fileType: loadedLabFileType,
      notes: document.getElementById('lab-notes').value
    };

    const stateObj = getAppState();
    const patientObj = stateObj.patients.find(p => p.id === patient.id);
    patientObj.labHistory.unshift(newLab);
    saveAppState(stateObj);
    
    // Limpiar formulario y recargar
    document.getElementById('form-lab-upload').reset();
    labStatus.textContent = '';
    loadedLabFileBase64 = '';
    renderStudies(patientObj);
  });

  let loadedImgFileBase64 = '';
  let loadedImgFileName = '';
  let loadedImgFileType = 'image';

  const imgFileInput = document.getElementById('img-file');
  const imgStatus = document.getElementById('img-file-status');
  imgFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadedImgFileName = file.name;
    loadedImgFileType = file.type.includes('pdf') ? 'pdf' : 'image';

    const reader = new FileReader();
    reader.onload = function(evt) {
      loadedImgFileBase64 = evt.target.result;
      imgStatus.textContent = `Archivo listo: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('form-img-upload').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!loadedImgFileBase64) return;

    const newImg = {
      date: new Date().toISOString(),
      study: document.getElementById('img-name').value,
      fileName: loadedImgFileName,
      fileData: loadedImgFileBase64,
      fileType: loadedImgFileType,
      notes: document.getElementById('img-notes').value
    };

    const stateObj = getAppState();
    const patientObj = stateObj.patients.find(p => p.id === patient.id);
    patientObj.imagingHistory.unshift(newImg);
    saveAppState(stateObj);

    document.getElementById('form-img-upload').reset();
    imgStatus.textContent = '';
    loadedImgFileBase64 = '';
    renderStudies(patientObj);
  });

  // Render initial components of patient details
  renderVitals(patient);
  renderAppointments(patient);
  renderStudies(patient);
  initScheduleManager(patient);
  renderBilling(patient);
}

// Renderizar tarjetas de signos vitales recientes y tabla de histórico
function renderVitals(patient) {
  const cardsContainer = document.getElementById('vitals-summary-cards');
  const tableBody = document.getElementById('table-vitals-body');
  if (!cardsContainer || !tableBody) return;

  cardsContainer.innerHTML = '';
  tableBody.innerHTML = '';

  const vitals = patient.vitalSigns || [];
  
  if (vitals.length === 0) {
    cardsContainer.innerHTML = `
      <div style="grid-column: 1/-1; padding: 1.5rem; text-align: center; color: var(--text-muted);">
        No se han tomado signos vitales para este paciente todavía.
      </div>
    `;
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">Sin registros históricos</td></tr>';
    return;
  }

  // Mostrar el más reciente en tarjetas
  const latest = vitals[0];
  
  // Condicionales para alertas visuales
  const tempClass = latest.temp > 37.8 ? 'danger' : (latest.temp > 37.2 ? 'warning' : '');
  const sysClass = latest.bp_systolic >= 140 ? 'danger' : (latest.bp_systolic >= 130 ? 'warning' : '');
  const hrClass = (latest.heart_rate > 100 || latest.heart_rate < 60) ? 'warning' : '';
  const oxClass = latest.oxygen < 95 ? 'danger' : (latest.oxygen < 97 ? 'warning' : '');
  
  // Categoría de IMC
  let bmiClass = '';
  let bmiDesc = 'Normal';
  if (latest.bmi >= 30) { bmiClass = 'danger'; bmiDesc = 'Obesidad'; }
  else if (latest.bmi >= 25) { bmiClass = 'warning'; bmiDesc = 'Sobrepeso'; }
  else if (latest.bmi < 18.5) { bmiClass = 'warning'; bmiDesc = 'Bajo peso'; }

  cardsContainer.innerHTML = `
    <div class="vital-card">
      <div class="vital-title">🌡️ Temperatura</div>
      <div class="vital-value ${tempClass}">${latest.temp}<span class="vital-unit"> °C</span></div>
    </div>
    <div class="vital-card">
      <div class="vital-title">💓 Presión Art.</div>
      <div class="vital-value ${sysClass}">${latest.bp_systolic}/${latest.bp_diastolic}<span class="vital-unit"> mmHg</span></div>
    </div>
    <div class="vital-card">
      <div class="vital-title">❤️ Frec. Cardíaca</div>
      <div class="vital-value ${hrClass}">${latest.heart_rate}<span class="vital-unit"> lpm</span></div>
    </div>
    <div class="vital-card">
      <div class="vital-title">🫁 Frec. Resp.</div>
      <div class="vital-value">${latest.resp_rate}<span class="vital-unit"> rpm</span></div>
    </div>
    <div class="vital-card">
      <div class="vital-title">🩸 Oxígeno</div>
      <div class="vital-value ${oxClass}">${latest.oxygen}<span class="vital-unit"> %</span></div>
    </div>
    <div class="vital-card">
      <div class="vital-title">⚖️ Peso / Talla</div>
      <div class="vital-value" style="font-size: 1.1rem; padding: 4px 0;">${latest.weight} kg <br> ${latest.height} m</div>
    </div>
    <div class="vital-card">
      <div class="vital-title">📊 IMC (${bmiDesc})</div>
      <div class="vital-value ${bmiClass}">${latest.bmi}<span class="vital-unit"></span></div>
    </div>
  `;

  // Pre-llenar el formulario con los últimos datos por comodidad
  document.getElementById('v-temp').value = latest.temp;
  document.getElementById('v-bp-sys').value = latest.bp_systolic;
  document.getElementById('v-bp-dia').value = latest.bp_diastolic;
  document.getElementById('v-hr').value = latest.heart_rate;
  document.getElementById('v-rr').value = latest.resp_rate;
  document.getElementById('v-oxygen').value = latest.oxygen;
  document.getElementById('v-weight').value = latest.weight;
  document.getElementById('v-height').value = latest.height;

  // Llenar tabla
  vitals.forEach(v => {
    const row = document.createElement('tr');
    const dateFormatted = new Date(v.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
    row.innerHTML = `
      <td>${dateFormatted}</td>
      <td>${v.temp} °C</td>
      <td>${v.bp_systolic}/${v.bp_diastolic}</td>
      <td>${v.heart_rate} lpm</td>
      <td>${v.resp_rate} rpm</td>
      <td>${v.oxygen}%</td>
      <td>${v.weight} kg</td>
      <td>${v.height} m</td>
      <td><strong>${v.bmi}</strong></td>
    `;
    tableBody.appendChild(row);
  });
}

// Renderizar citas en la pestaña de citas
function renderAppointments(patient) {
  const tableBody = document.getElementById('table-appointments-body');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  const appointments = patient.appointments || [];

  if (appointments.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay citas agendadas</td></tr>';
    return;
  }

  appointments.forEach((app, idx) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${app.date}</td>
      <td>${app.time}</td>
      <td>${app.notes}</td>
      <td>
        <button class="btn btn-danger btn-small" data-idx="${idx}">Cancelar</button>
      </td>
    `;
    
    // Bind Cancel Button
    row.querySelector('.btn-danger').addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-idx'));
      const stateObj = getAppState();
      const patientObj = stateObj.patients.find(p => p.id === patient.id);
      patientObj.appointments.splice(index, 1);
      saveAppState(stateObj);
      renderAppointments(patientObj);
    });

    tableBody.appendChild(row);
  });
}

// Renderizar listas de archivos de laboratorios y estudios cargados
function renderStudies(patient) {
  const labList = document.getElementById('lab-history-list');
  const imgList = document.getElementById('img-history-list');
  if (!labList || !imgList) return;

  labList.innerHTML = '';
  imgList.innerHTML = '';

  const labs = patient.labHistory || [];
  const imgs = patient.imagingHistory || [];

  // Render Labs
  if (labs.length === 0) {
    labList.innerHTML = '<li style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Ningún laboratorio cargado</li>';
  } else {
    labs.forEach((l, idx) => {
      const li = document.createElement('li');
      li.className = 'uploaded-file-item';
      
      const fileIcon = l.fileType === 'pdf' ? '📄 PDF' : '🖼️ IMG';
      const previewHtml = l.fileType === 'pdf' 
        ? `<div class="uploaded-file-preview">${fileIcon}</div>`
        : `<img src="${l.fileData}" class="uploaded-file-preview" alt="Lab Preview">`;

      li.innerHTML = `
        <button class="btn-remove-file" data-idx="${idx}" data-type="lab">&times;</button>
        ${previewHtml}
        <div class="uploaded-file-name" title="${l.name}">${l.name}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${new Date(l.date).toLocaleDateString()}</div>
      `;

      // Visualización rápida al hacer clic en la tarjeta
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-file')) return;
        viewFileWindow(l.name, l.fileData, l.fileType, l.notes);
      });

      // Eliminar laboratorio
      li.querySelector('.btn-remove-file').addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-idx'));
        const stateObj = getAppState();
        const patientObj = stateObj.patients.find(p => p.id === patient.id);
        patientObj.labHistory.splice(index, 1);
        saveAppState(stateObj);
        renderStudies(patientObj);
      });

      labList.appendChild(li);
    });
  }

  // Render Imaging
  if (imgs.length === 0) {
    imgList.innerHTML = '<li style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Ningún estudio de imagen cargado</li>';
  } else {
    imgs.forEach((img, idx) => {
      const li = document.createElement('li');
      li.className = 'uploaded-file-item';

      const fileIcon = img.fileType === 'pdf' ? '📄 PDF' : '🖼️ IMG';
      const previewHtml = img.fileType === 'pdf' 
        ? `<div class="uploaded-file-preview">${fileIcon}</div>`
        : `<img src="${img.fileData}" class="uploaded-file-preview" alt="Imaging Preview">`;

      li.innerHTML = `
        <button class="btn-remove-file" data-idx="${idx}" data-type="img">&times;</button>
        ${previewHtml}
        <div class="uploaded-file-name" title="${img.study}">${img.study}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${new Date(img.date).toLocaleDateString()}</div>
      `;

      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-file')) return;
        viewFileWindow(img.study, img.fileData, img.fileType, img.notes);
      });

      li.querySelector('.btn-remove-file').addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-idx'));
        const stateObj = getAppState();
        const patientObj = stateObj.patients.find(p => p.id === patient.id);
        patientObj.imagingHistory.splice(index, 1);
        saveAppState(stateObj);
        renderStudies(patientObj);
      });

      imgList.appendChild(li);
    });
  }

  // Renderizar Resultados de Laboratorios Locales (Propios)
  const localList = document.getElementById('local-lab-results-list-preconsulta');
  if (localList) {
    localList.innerHTML = '';
    const localLabs = patient.localLabs || [];
    const completedLocal = localLabs.filter(l => l.stage === 'completado');

    if (completedLocal.length === 0) {
      localList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem; background: rgba(255,255,255,0.01); border-radius: 4px; border: 1px dashed var(--border-color);">Ningún estudio local procesado y completado para este paciente.</div>';
    } else {
      completedLocal.forEach(l => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.style.padding = '15px';
        card.style.border = '1px solid var(--border-color)';
        card.style.borderRadius = 'var(--radius-sm)';

        let paramsHtml = l.parameters.slice(0, 3).map(p => `
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 4px;">
            <span style="color: var(--text-muted);">${p.name}:</span>
            <span style="font-weight: 600; color: var(--accent-success);">${p.value} ${p.unit}</span>
          </div>
        `).join('');

        if (l.parameters.length > 3) {
          paramsHtml += `<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin-top: 6px; font-style: italic;">+ ${l.parameters.length - 3} parámetros más</div>`;
        }

        card.innerHTML = `
          <h4 style="color: var(--accent-primary); font-size: 0.95rem; margin-bottom: 5px; font-family: var(--font-heading);">${l.name}</h4>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px;">Fecha: ${new Date(l.date).toLocaleDateString()}</div>
          <div style="background: rgba(255,255,255,0.02); padding: 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.05);">
            ${paramsHtml}
          </div>
          <button class="btn btn-secondary btn-small" id="btn-view-local-${l.id}" style="width: 100%;">📄 Ver Reporte Completo</button>
        `;

        localList.appendChild(card);

        card.querySelector(`#btn-view-local-${l.id}`).addEventListener('click', () => {
          showLocalLabReportPrintWindow(l, patient);
        });
      });
    }
  }
}

// Ventana de Impresión de Resultados Locales de Laboratorio
export function showLocalLabReportPrintWindow(study, patient) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Por favor, permite las ventanas emergentes (popups) para poder imprimir los resultados.");
    return;
  }

  const db = JSON.parse(localStorage.getItem('medflow_db')) || {};
  const clinicInfo = db.clinicInfo || {};
  let logoImgHtml = '🏥';
  if (clinicInfo.logoData) {
    logoImgHtml = `<img src="${clinicInfo.logoData}" style="max-height: 60px; object-fit: contain;">`;
  } else {
    logoImgHtml = `<span style="font-size: 2.5rem;">🏥</span>`;
  }

  const dob = new Date(patient.birthdate);
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  const age = Math.abs(ageDt.getUTCFullYear() - 1970);

  const parametersRows = study.parameters.map(p => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px; font-weight: 600; text-align: left; font-size: 0.9rem; font-family: sans-serif;">${p.name}</td>
      <td style="padding: 10px; text-align: center; font-weight: bold; color: #1e3a8a; font-size: 0.9rem; font-family: sans-serif;">${p.value || 'N/A'}</td>
      <td style="padding: 10px; text-align: center; color: #555; font-size: 0.9rem; font-family: sans-serif;">${p.unit || '-'}</td>
      <td style="padding: 10px; text-align: center; color: #555; font-size: 0.9rem; font-style: italic; font-family: sans-serif;">${p.normal || '-'}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Resultados - ${study.name}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #333;
          margin: 0;
          padding: 30px;
          line-height: 1.5;
        }
        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #1e3a8a;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .logo-box {
          flex: 0 0 80px;
          text-align: left;
        }
        .clinic-details {
          text-align: right;
        }
        .clinic-name {
          font-size: 1.5rem;
          font-weight: bold;
          color: #1e3a8a;
          margin: 0;
        }
        .clinic-sub {
          font-size: 0.85rem;
          color: #555;
          margin: 3px 0 0 0;
        }
        .title-box {
          text-align: center;
          margin-bottom: 25px;
        }
        .title {
          font-size: 1.4rem;
          font-weight: bold;
          text-transform: uppercase;
          color: #1e3a8a;
          letter-spacing: 1px;
          margin: 0;
        }
        .patient-card {
          background-color: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 25px;
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 15px;
          font-size: 0.9rem;
        }
        .patient-col p {
          margin: 4px 0;
        }
        .patient-col strong {
          color: #111;
        }
        .results-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
          margin-bottom: 40px;
        }
        .results-table th {
          background-color: #1e3a8a;
          color: white;
          padding: 10px;
          font-size: 0.85rem;
          font-weight: bold;
          text-transform: uppercase;
        }
        .results-table td {
          border-bottom: 1px solid #ddd;
        }
        .footer-sig {
          margin-top: 70px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .line {
          width: 250px;
          border-top: 1px solid #666;
          margin-bottom: 6px;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; text-align: right;">
        <button onclick="window.print();" style="padding: 10px 20px; background-color: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          🖨️ Imprimir Reporte
        </button>
      </div>

      <div class="header-container">
        <div class="logo-box">
          ${logoImgHtml}
        </div>
        <div class="clinic-details">
          <h1 class="clinic-name">${clinicInfo.name || 'Centro Médico Altamira'}</h1>
          <p class="clinic-sub">${clinicInfo.address || ''}</p>
          <p class="clinic-sub">Tel: ${clinicInfo.phone || ''} | Email: ${clinicInfo.email || ''}</p>
        </div>
      </div>

      <div class="title-box">
        <h2 class="title">Informe de Resultados de Laboratorio Clínico</h2>
        <p style="font-size: 0.85rem; color: #555; margin: 4px 0 0 0;">MedFlow Lab Diagnostics</p>
      </div>

      <div class="patient-card">
        <div class="patient-col">
          <p><strong>Paciente:</strong> ${patient.name}</p>
          <p><strong>Género:</strong> ${patient.gender} | <strong>Edad:</strong> ${age} años</p>
          <p><strong>Dirección:</strong> ${patient.address || 'Guatemala'}</p>
        </div>
        <div class="patient-col" style="text-align: right;">
          <p><strong>ID Estudio:</strong> ${study.id}</p>
          <p><strong>Fecha Procesado:</strong> ${new Date(study.date).toLocaleString()}</p>
          <p><strong>Estudio:</strong> ${study.name}</p>
        </div>
      </div>

      <table class="results-table">
        <thead>
          <tr>
            <th style="text-align: left; padding-left: 10px;">Análisis / Parámetro</th>
            <th>Resultado Obtenido</th>
            <th>Unidades</th>
            <th>Valores de Referencia</th>
          </tr>
        </thead>
        <tbody>
          ${parametersRows}
        </tbody>
      </table>

      <div class="footer-sig">
        <div class="line"></div>
        <p style="margin: 0; font-size: 0.9rem; font-weight: bold; color: #111;">Firma y Sello del Analista</p>
        <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #555;">Laboratorio Clínico MedFlow</p>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Nueva ventana de visualización de archivos en ventana/pestaña nueva o iframe modal
function viewFileWindow(title, dataUrl, type, notes) {
  const win = window.open();
  if (!win) {
    alert("Por favor habilita las ventanas emergentes para visualizar los estudios cargados.");
    return;
  }
  
  win.document.title = title;
  win.document.body.style.margin = "0";
  win.document.body.style.backgroundColor = "#1e1e1e";
  win.document.body.style.color = "#ffffff";
  win.document.body.style.fontFamily = "sans-serif";
  
  let mediaHtml = '';
  if (type === 'pdf') {
    mediaHtml = `<iframe src="${dataUrl}" style="width: 100%; height: 75vh; border: none;"></iframe>`;
  } else {
    mediaHtml = `
      <div style="text-align: center; padding: 20px; max-height: 75vh; overflow: auto;">
        <img src="${dataUrl}" style="max-width: 90%; max-height: 70vh; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      </div>
    `;
  }

  win.document.body.innerHTML = `
    <div style="padding: 20px; border-bottom: 1px solid %23333; background: %23111;">
      <h2 style="margin: 0; font-size: 1.5rem;">${title}</h2>
      <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: %23aaa;">Estudios de Apoyo MedFlow</p>
    </div>
    ${mediaHtml}
    <div style="padding: 20px; background: %23111; border-top: 1px solid %23333; font-size: 1rem;">
      <strong style="color: %2300f2fe;">Observaciones/Reporte:</strong>
      <p style="margin: 10px 0 0 0; white-space: pre-wrap; line-height: 1.5;">${notes || 'Sin observaciones detalladas.'}</p>
    </div>
  `;
}

// Global helper function for opening clinical history modal
window.openClinicalHistoryModal = function(patientId) {
  const state = getAppState();
  let patient = null;
  const targetId = patientId || getActivePatientId();
  if (targetId) {
    patient = (state.patients || []).find(p => p.id === targetId);
  }
  if (!patient && window.currentActivePatient) {
    patient = window.currentActivePatient;
  }
  if (!patient && state.patients && state.patients.length > 0) {
    patient = state.patients[0];
  }
  showClinicalHistoryModal(patient);
};

// Función para abrir y llenar el modal de Historial Clínico Completo
function showClinicalHistoryModal(patient) {
  const state = getAppState();
  const clinicInfo = state.clinicInfo || {};

  if (!patient) {
    const activeId = getActivePatientId();
    patient = (state.patients || []).find(p => p.id === activeId);
  }
  if (!patient && window.currentActivePatient) {
    patient = window.currentActivePatient;
  }
  if (!patient && state.patients && state.patients.length > 0) {
    patient = state.patients[0];
  }
  if (!patient) {
    alert("Seleccione un paciente para ver su historial clínico.");
    return;
  }

  const modal = document.getElementById('clinical-history-modal');
  const title = document.getElementById('history-modal-patient-name');
  const body = document.getElementById('history-modal-body');
  
  if (!modal || !body) return;

  if (title) title.textContent = `Historial Clínico: ${patient.name}`;

  // Calcular edad
  let age = 'N/A';
  if (patient.birthdate) {
    const dob = new Date(patient.birthdate);
    if (!isNaN(dob.getTime())) {
      const diffMs = Date.now() - dob.getTime();
      const ageDt = new Date(diffMs);
      age = Math.abs(ageDt.getUTCFullYear() - 1970);
    }
  }

  // Renders clinical report contents
  try {
    let vitalsHtml = '';
    if (!patient.vitalSigns || patient.vitalSigns.length === 0) {
      vitalsHtml = '<p style="color: var(--text-muted); font-size: 0.9rem;">Sin mediciones de signos vitales registradas.</p>';
    } else {
      vitalsHtml = `
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>T(°C)</th>
              <th>P.A.</th>
              <th>F.C.(lpm)</th>
              <th>F.R.(rpm)</th>
              <th>SPO2(%)</th>
              <th>Peso</th>
              <th>Talla</th>
              <th>IMC</th>
            </tr>
          </thead>
          <tbody>
            ${(patient.vitalSigns || []).map(v => `
              <tr>
                <td>${v.date ? new Date(v.date).toLocaleDateString() : 'N/A'}</td>
                <td>${v.temp || '-'}°C</td>
                <td>${v.bp_systolic || '-'}/${v.bp_diastolic || '-'}</td>
                <td>${v.heart_rate || '-'}</td>
                <td>${v.resp_rate || '-'}</td>
                <td>${v.oxygen || '-'}%</td>
                <td>${v.weight || '-'} kg</td>
                <td>${v.height || '-'} m</td>
                <td>${v.bmi || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    let consultationsHtml = '';
    if (!patient.consultations || patient.consultations.length === 0) {
      consultationsHtml = '<p style="color: var(--text-muted); font-size: 0.9rem;">No se registran consultas médicas previas.</p>';
    } else {
      consultationsHtml = `
        <div class="timeline">
          ${(patient.consultations || []).map(c => {
            const diagCodes = c.diagnosisCodes || [];
            const diagNames = c.diagnosisNames || [];
            let diagStr = 'No especificado';
            if (diagCodes.length > 0) {
              diagStr = diagCodes.map((code, i) => `<span class="suggestion-code">${code}</span> ${diagNames[i] || ''}`).join(', ');
            } else if (c.clinicalDiagnosis || c.diagnosis) {
              diagStr = c.clinicalDiagnosis || c.diagnosis;
            }

            const labs = (c.acceptedStudies && c.acceptedStudies.labs) || [];
            const imaging = (c.acceptedStudies && c.acceptedStudies.imaging) || [];
            const allStudies = [...labs, ...imaging];

            const feeVal = typeof c.fee === 'number' ? c.fee.toFixed(2) : (c.fee || '0.00');

            return `
            <div class="timeline-item">
              <div class="timeline-date">${c.date ? new Date(c.date).toLocaleString() : 'N/A'} - ${c.specialty || 'Medicina General'} (${c.doctor || 'Dr. Médico'})</div>
              <div class="timeline-title">Motivo: ${c.reason || 'Consulta Médica'}</div>
              <div class="timeline-desc">
                <p><strong>Síntomas/Examen físico:</strong> ${c.symptoms || 'Sin registro'}</p>
                <p style="margin-top: 6px;"><strong>Diagnóstico Clínico / CIE-10:</strong> ${diagStr}</p>
                ${allStudies.length > 0 ? `
                  <p style="margin-top: 6px;"><strong>Estudios Indicados:</strong> ${allStudies.join(', ')}</p>
                ` : ''}
                ${c.acceptedTreatments && c.acceptedTreatments.length > 0 ? `
                  <p style="margin-top: 4px;"><strong>Tratamientos/Medicamentos Aceptados:</strong><br>
                    ${c.acceptedTreatments.map(tx => `• ${tx}`).join('<br>')}
                  </p>
                ` : ''}
                <p style="margin-top: 4px; color: var(--accent-success); font-weight: 500;">Costo Consulta: Q${feeVal}</p>
              </div>
            </div>
            `;
          }).join('')}
        </div>
      `;
    }

    let prescriptionsHtml = '';
    if (!patient.prescriptions || patient.prescriptions.length === 0) {
      prescriptionsHtml = '<p style="color: var(--text-muted); font-size: 0.9rem;">No se registran recetas emitidas.</p>';
    } else {
      prescriptionsHtml = `
        <div class="timeline">
          ${(patient.prescriptions || []).map(r => `
            <div class="timeline-item">
              <div class="timeline-date">${r.date ? new Date(r.date).toLocaleString() : 'N/A'} - Recetado por: ${r.doctorName || 'Médico Tratante'}</div>
              <div class="timeline-desc">
                <table style="margin-top: 5px;">
                  <thead>
                    <tr>
                      <th>Medicina</th>
                      <th>Cant.</th>
                      <th>Dosis y Frecuencia</th>
                      <th>Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(r.medicines || []).map(m => `
                      <tr>
                        <td><strong>${m.name || 'Medicamento'}</strong> (${m.presentation || '-'})</td>
                        <td>${m.quantity || 1}</td>
                        <td>${m.dosage || '-'}</td>
                        <td>${m.duration || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                ${r.indications ? `
                  <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.15); font-size: 0.85rem;">
                    <strong style="color: var(--accent-secondary);">Recomendaciones/Indicaciones Generales:</strong>
                    <p style="margin: 4px 0 0 0; white-space: pre-wrap; color: var(--text-muted);">${r.indications}</p>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    let ordersHtml = '';
    const studyOrders = patient.studyOrders || [];
    if (studyOrders.length === 0) {
      ordersHtml = '<p style="color: var(--text-muted); font-size: 0.9rem;">No se registran órdenes de estudios emitidas.</p>';
    } else {
      ordersHtml = `
        <div class="timeline">
          ${studyOrders.map(o => `
            <div class="timeline-item">
              <div class="timeline-date">${o.date ? new Date(o.date).toLocaleString() : 'N/A'} - Solicitado por: ${o.doctorName || 'Médico Tratante'}</div>
              <div class="timeline-desc">
                <ul style="margin-left: 20px; list-style: square; margin-bottom: 6px;">
                  ${(o.studies || []).map(s => `
                    <li>
                      <strong>${s.type === 'lab' ? '🔬 Lab' : '🖼️ Imagen'}:</strong> ${s.name || 'Estudio'} 
                      <span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">(Indicación: ${s.notes || 'Ninguna'})</span>
                    </li>
                  `).join('')}
                </ul>
                ${o.generalNotes ? `
                  <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">
                    Observaciones: ${o.generalNotes}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    let localLabsHtml = '';
    const localLabs = patient.localLabs || [];
    const completedLocalLabs = localLabs.filter(l => l.stage === 'completado');
    if (completedLocalLabs.length === 0) {
      localLabsHtml = '<p style="color: var(--text-muted); font-size: 0.9rem;">No se registran estudios locales de laboratorio completados.</p>';
    } else {
      localLabsHtml = `
        <div class="timeline">
          ${completedLocalLabs.map(l => `
            <div class="timeline-item" style="border-left: 2px solid var(--accent-primary); padding-left: 15px; margin-bottom: 1.5rem;">
              <div class="timeline-date" style="font-weight: 700; color: var(--accent-primary);">${l.date ? new Date(l.date).toLocaleString() : 'N/A'} - ${l.name}</div>
              <div class="timeline-desc" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px; border-radius: 4px; margin-top: 6px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--border-color);">
                      <th style="text-align: left; padding: 6px;">Parámetro</th>
                      <th style="text-align: left; padding: 6px;">Resultado</th>
                      <th style="text-align: left; padding: 6px;">Unidad</th>
                      <th style="text-align: left; padding: 6px;">Rango de Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(l.parameters || []).map(p => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 6px; font-weight: 600;">${p.name}</td>
                        <td style="padding: 6px; color: var(--accent-success); font-weight: bold;">${p.value || 'N/A'}</td>
                        <td style="padding: 6px; color: var(--text-muted);">${p.unit || '-'}</td>
                        <td style="padding: 6px; color: var(--text-muted);">${p.normal || '-'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    let filesHtml = '';
    const totalFiles = [...(patient.labHistory || []), ...(patient.imagingHistory || [])];
    if (totalFiles.length === 0) {
      filesHtml = '<p style="color: var(--text-muted); font-size: 0.9rem;">Sin archivos cargados.</p>';
    } else {
      filesHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
          ${(patient.labHistory || []).map(l => `
            <div style="border: 1px solid var(--border-color); padding: 10px; border-radius: 4px; background: rgba(255,255,255,0.01);">
              <div style="font-weight: 600; font-size: 0.85rem; color: var(--accent-primary);">🔬 Laboratorio</div>
              <div style="font-size: 0.8rem; margin-top: 4px;">${l.name}</div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">${l.date ? new Date(l.date).toLocaleDateString() : 'N/A'}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">Obs: ${l.notes || 'Ninguna'}</div>
            </div>
          `).join('')}
          ${(patient.imagingHistory || []).map(img => `
            <div style="border: 1px solid var(--border-color); padding: 10px; border-radius: 4px; background: rgba(255,255,255,0.01);">
              <div style="font-weight: 600; font-size: 0.85rem; color: var(--accent-secondary);">🖼️ Imagenología</div>
              <div style="font-size: 0.8rem; margin-top: 4px;">${img.study}</div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">${img.date ? new Date(img.date).toLocaleDateString() : 'N/A'}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">Obs: ${img.notes || 'Ninguna'}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    body.innerHTML = `
      <!-- Encabezado Oficial Institucional (LUGAMED 2.0) -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; font-family: Arial, Helvetica, sans-serif;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${clinicInfo.logoData 
            ? `<img src="${clinicInfo.logoData}" style="max-height: 52px; max-width: 130px; object-fit: contain; border-radius: 4px;">` 
            : `<img src="${logoUrl}" style="max-height: 52px; max-width: 130px; object-fit: contain; border-radius: 4px;">`}
          <div>
            <h2 style="margin: 0; font-size: 1.35rem; font-weight: 800; color: #1e3a8a;">${clinicInfo.name || 'Centro Médico Altamira'}</h2>
            <div style="font-size: 0.85rem; font-weight: 700; color: #0284c7; margin-top: 3px;">Atención Médica Profesional — LUGAMED 2.0</div>
          </div>
        </div>
        <div style="text-align: right; font-size: 0.82rem; color: #475569; line-height: 1.4;">
          📍 ${clinicInfo.address || 'Guatemala'}<br>
          📞 Teléfono: ${clinicInfo.phone || 'N/A'}<br>
          ✉️ Email: ${clinicInfo.email || 'N/A'}
        </div>
      </div>

      <!-- Reporte General del Paciente -->
      <div class="report-section">
        <div class="report-section-title">Datos Personales y Demográficos</div>
        <div class="report-grid-patient">
          <div class="report-item"><span>Nombre</span><strong>${patient.name}</strong></div>
          <div class="report-item"><span>Género</span><strong>${patient.gender}</strong></div>
          <div class="report-item"><span>Fecha Nacimiento</span><strong>${patient.birthdate || 'N/A'} (Edad: ${age} años)</strong></div>
          <div class="report-item"><span>Teléfono</span><strong>${patient.telephone || 'N/A'}</strong></div>
          <div class="report-item"><span>Email</span><strong>${patient.email || 'N/A'}</strong></div>
          <div class="report-item"><span>Dirección</span><strong>${patient.address || 'N/A'}</strong></div>
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title">Signos Vitales Recientes e Histórico</div>
        ${vitalsHtml}
      </div>

      <div class="report-section" style="margin-top: 2rem;">
        <div class="report-section-title">Historial de Consultas Médicas</div>
        ${consultationsHtml}
      </div>

      <div class="report-section" style="margin-top: 2rem;">
        <div class="report-section-title">Recetas e Indicaciones Emitidas</div>
        ${prescriptionsHtml}
      </div>

      <div class="report-section" style="margin-top: 2rem;">
        <div class="report-section-title">Resultados de Laboratorio Locales (MedFlow Labs)</div>
        ${localLabsHtml}
      </div>

      <div class="report-section" style="margin-top: 2rem;">
        <div class="report-section-title">Órdenes de Estudios (Laboratorio e Imagen) Emitidas</div>
        ${ordersHtml}
      </div>

      <div class="report-section" style="margin-top: 2rem;">
        <div class="report-section-title">Archivo de Laboratorios e Imagenología Cargados</div>
        ${filesHtml}
      </div>
    `;
  } catch (err) {
    console.error("Error al renderizar historial clínico:", err);
    body.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--accent-danger);">
        <h3>⚠️ Ocurrió un inconveniente al generar el expediente</h3>
        <p style="color: var(--text-muted); margin-top: 8px;">${err.message}</p>
      </div>
    `;
  }

  modal.style.display = 'flex';
}

// Renderizar bloqueador de calendario e inicializar el selector de turnos
function initScheduleManager(patient) {
  const dateInput = document.getElementById('app-date');
  const timeHidden = document.getElementById('app-time');
  const slotGrid = document.getElementById('slot-picker-grid');
  const slotArea = document.getElementById('slot-picker-area');
  const slotWarning = document.getElementById('slot-picker-warning');
  const submitBtn = document.getElementById('btn-schedule-appt');

  if (!dateInput || !slotGrid || !slotArea || !slotWarning || !submitBtn) return;

  // Actualizar lista de días bloqueados
  updateBlockedDaysList();

  // Escuchar cambios de fecha
  dateInput.addEventListener('input', () => {
    const dateVal = dateInput.value;
    
    // Limpiar selección de hora
    timeHidden.value = '';
    submitBtn.disabled = true;

    if (!dateVal) {
      slotArea.style.display = 'none';
      slotWarning.style.display = 'none';
      return;
    }

    const state = getAppState();
    const blockedDates = state.blockedDates || [];

    // 1. Validar si el día está bloqueado
    const blocked = blockedDates.find(d => d.date === dateVal);
    if (blocked) {
      slotWarning.textContent = `🚫 El consultorio estará cerrado este día debido a: "${blocked.reason}". No se pueden agendar citas.`;
      slotWarning.style.display = 'block';
      slotArea.style.display = 'none';
      return;
    }

    // 2. Validar si es fin de semana
    const dayOfWeek = new Date(dateVal + 'T00:00:00').getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      slotWarning.textContent = `🚫 El consultorio atiende únicamente de Lunes a Viernes. Por favor seleccione un día hábil.`;
      slotWarning.style.display = 'block';
      slotArea.style.display = 'none';
      return;
    }

    // 3. Generar franjas horarias
    slotWarning.style.display = 'none';
    slotArea.style.display = 'block';
    slotGrid.innerHTML = '';

    const slots = [
      // Mañana: 8am a 12pm
      "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
      // Tarde: 2pm a 6pm
      "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
    ];

    slots.forEach(time => {
      const isOccupied = isSlotOccupied(dateVal, time);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = `
        padding: 8px;
        border-radius: var(--radius-sm);
        font-size: 0.8rem;
        font-weight: 600;
        text-align: center;
        transition: all 0.2s;
      `;
      
      if (isOccupied) {
        btn.textContent = `${time} (Ocupado)`;
        btn.disabled = true;
        btn.style.backgroundColor = 'rgba(255, 23, 68, 0.08)';
        btn.style.border = '1px solid rgba(255, 23, 68, 0.3)';
        btn.style.color = '#ff5252';
        btn.style.cursor = 'not-allowed';
      } else {
        btn.textContent = time;
        btn.style.backgroundColor = 'rgba(0, 242, 254, 0.03)';
        btn.style.border = '1px solid rgba(0, 242, 254, 0.2)';
        btn.style.color = 'var(--accent-primary)';
        btn.style.cursor = 'pointer';

        btn.addEventListener('mouseover', () => {
          if (!btn.classList.contains('selected')) {
            btn.style.backgroundColor = 'rgba(0, 242, 254, 0.1)';
            btn.style.borderColor = 'var(--accent-primary)';
          }
        });
        btn.addEventListener('mouseout', () => {
          if (!btn.classList.contains('selected')) {
            btn.style.backgroundColor = 'rgba(0, 242, 254, 0.03)';
            btn.style.borderColor = 'rgba(0, 242, 254, 0.2)';
          }
        });

        btn.addEventListener('click', () => {
          slotGrid.querySelectorAll('button').forEach(b => {
            if (!b.disabled) {
              b.classList.remove('selected');
              b.style.backgroundColor = 'rgba(0, 242, 254, 0.03)';
              b.style.borderColor = 'rgba(0, 242, 254, 0.2)';
              b.style.color = 'var(--accent-primary)';
            }
          });

          btn.classList.add('selected');
          btn.style.backgroundColor = 'var(--accent-primary)';
          btn.style.borderColor = 'var(--accent-primary)';
          btn.style.color = '#000';

          timeHidden.value = time;
          submitBtn.disabled = false;
        });
      }
      slotGrid.appendChild(btn);
    });
  });

  // Manejar bloqueo de días de no atención
  const blockForm = document.getElementById('block-calendar-form');
  if (blockForm) {
    // Evitar duplicación de listeners
    const newForm = blockForm.cloneNode(true);
    blockForm.parentNode.replaceChild(newForm, blockForm);

    newForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const bDate = document.getElementById('block-date').value;
      const bReason = document.getElementById('block-reason').value;

      if (!bDate || !bReason) return;

      const stateObj = getAppState();
      if (!stateObj.blockedDates) stateObj.blockedDates = [];

      // Validar si ya está bloqueado
      if (stateObj.blockedDates.some(d => d.date === bDate)) {
        alert("Esta fecha ya se encuentra bloqueada.");
        return;
      }

      stateObj.blockedDates.push({ date: bDate, reason: bReason });
      saveAppState(stateObj);

      newForm.reset();
      updateBlockedDaysList();

      // Refrescar el selector de turnos por si el día cargado es el bloqueado
      if (dateInput.value === bDate) {
        dateInput.dispatchEvent(new Event('input'));
      }
    });
  }
}

// Actualizar el listado visual de días de no atención bloqueados
function updateBlockedDaysList() {
  const list = document.getElementById('blocked-days-list');
  if (!list) return;

  const state = getAppState();
  const blockedDates = state.blockedDates || [];

  list.innerHTML = '';

  if (blockedDates.length === 0) {
    list.innerHTML = '<li style="color: var(--text-muted); font-style: italic; text-align: center; padding: 10px 0;">No hay días bloqueados</li>';
    return;
  }

  // Ordenar cronológicamente
  blockedDates.sort((a,b) => new Date(a.date) - new Date(b.date));

  blockedDates.forEach((d, index) => {
    const li = document.createElement('li');
    li.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
    `;
    li.innerHTML = `
      <div>
        <strong>${d.date}</strong><br>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${d.reason}</span>
      </div>
      <button class="btn btn-danger btn-small btn-unblock" data-idx="${index}" style="padding: 2px 6px; font-size: 0.7rem;">&times;</button>
    `;

    // Desbloquear día
    li.querySelector('.btn-unblock').addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      const stateObj = getAppState();
      const removedDate = stateObj.blockedDates[idx].date;
      stateObj.blockedDates.splice(idx, 1);
      saveAppState(stateObj);
      updateBlockedDaysList();

      // Refrescar selector de turnos
      const dateInput = document.getElementById('app-date');
      if (dateInput && dateInput.value === removedDate) {
        dateInput.dispatchEvent(new Event('input'));
      }
    });

    list.appendChild(li);
  });
}

// Función auxiliar para verificar si una hora ya está ocupada para esa fecha
function isSlotOccupied(dateStr, timeStr) {
  const state = getAppState();
  for (const patient of state.patients) {
    if (patient.appointments) {
      for (const app of patient.appointments) {
        if (app.date === dateStr && app.time === timeStr) {
          return true;
        }
      }
    }
  }
  return false;
}

// Función auxiliar para sincronizar cobros pendientes de recetas, laboratorios e imagenología
function syncPatientBilling(patientObj, stateObj) {
  if (!patientObj) return;
  patientObj.billingHistory = patientObj.billingHistory || [];
  const todayStr = new Date().toISOString().substring(0, 10);
  let stateModified = false;

  // 1. Sincronizar Recetas Emitidas
  const prescriptions = patientObj.prescriptions || [];
  prescriptions.forEach(recipe => {
    if (!recipe.medicines || recipe.medicines.length === 0) return;

    let bill = patientObj.billingHistory.find(b => b.id === recipe.billId) ||
               patientObj.billingHistory.find(b => b.status === 'Pendiente' && b.date.substring(0, 10) === todayStr);

    if (!bill) {
      const details = recipe.medicines.map(m => {
        const found = stateObj.medications && stateObj.medications.find(med => med.name === m.name);
        const price = found ? parseFloat(found.price) : 50.00;
        return {
          description: `Medicamento Recetado: ${m.name} (${m.presentation || 'Tabletas'})`,
          amount: price
        };
      });
      const total = details.reduce((sum, d) => sum + d.amount, 0);

      bill = {
        id: 'FAC-REC-' + Date.now(),
        date: recipe.date || new Date().toISOString(),
        concept: `Receta Médica - Dr. ${recipe.doctorName || 'Médico Tratante'}`,
        details,
        diagnosis: 'Recetario Médico',
        total,
        status: 'Pendiente'
      };
      patientObj.billingHistory.unshift(bill);
      recipe.billId = bill.id;
      stateModified = true;
    } else {
      recipe.billId = bill.id;
      recipe.medicines.forEach(m => {
        const alreadyInBill = (bill.details || []).some(d => d.description.includes(m.name));
        if (!alreadyInBill) {
          const found = stateObj.medications && stateObj.medications.find(med => med.name === m.name);
          const price = found ? parseFloat(found.price) : 50.00;
          bill.details = bill.details || [];
          bill.details.push({
            description: `Medicamento Recetado: ${m.name} (${m.presentation || 'Tabletas'})`,
            amount: price
          });
          bill.total = parseFloat(bill.total) + price;
          stateModified = true;
        }
      });
    }
  });

  // 2. Sincronizar Órdenes de Estudios (Laboratorio e Imagenología)
  const studyOrders = patientObj.studyOrders || [];
  studyOrders.forEach(order => {
    if (!order.studies || order.studies.length === 0) return;

    let bill = patientObj.billingHistory.find(b => b.id === order.billId) ||
               patientObj.billingHistory.find(b => b.status === 'Pendiente' && b.date.substring(0, 10) === todayStr);

    if (!bill) {
      const details = order.studies.map(s => {
        const price = s.type === 'lab' ? 125.00 : 300.00;
        return {
          description: `${s.type === 'lab' ? 'Examen de Laboratorio' : 'Estudio de Imagenología'}: ${s.name}`,
          amount: price
        };
      });
      const total = details.reduce((sum, d) => sum + d.amount, 0);

      bill = {
        id: 'FAC-EST-' + Date.now(),
        date: order.date || new Date().toISOString(),
        concept: `Órdenes de Estudios - Dr. ${order.doctorName || 'Médico Tratante'}`,
        details,
        diagnosis: 'Estudios de Apoyo',
        total,
        status: 'Pendiente'
      };
      patientObj.billingHistory.unshift(bill);
      order.billId = bill.id;
      stateModified = true;
    } else {
      order.billId = bill.id;
      order.studies.forEach(s => {
        const alreadyInBill = (bill.details || []).some(d => d.description.includes(s.name));
        if (!alreadyInBill) {
          const price = s.type === 'lab' ? 125.00 : 300.00;
          bill.details = bill.details || [];
          bill.details.push({
            description: `${s.type === 'lab' ? 'Examen de Laboratorio' : 'Estudio de Imagenología'}: ${s.name}`,
            amount: price
          });
          bill.total = parseFloat(bill.total) + price;
          stateModified = true;
        }
      });
    }
  });

  // 3. Sincronizar Estudios Locales de Laboratorio
  const localLabs = patientObj.localLabs || [];
  localLabs.forEach(lab => {
    let bill = patientObj.billingHistory.find(b => b.id === lab.billId) ||
               patientObj.billingHistory.find(b => b.status === 'Pendiente' && b.date.substring(0, 10) === todayStr);

    if (!bill) {
      const price = 125.00;
      bill = {
        id: 'FAC-LAB-' + Date.now(),
        date: lab.date || new Date().toISOString(),
        concept: `Estudio Local de Laboratorio - ${lab.name}`,
        details: [{ description: `Análisis de Laboratorio: ${lab.name}`, amount: price }],
        diagnosis: 'Laboratorio Clínico',
        total: price,
        status: 'Pendiente'
      };
      patientObj.billingHistory.unshift(bill);
      lab.billId = bill.id;
      stateModified = true;
    } else {
      lab.billId = bill.id;
      const alreadyInBill = (bill.details || []).some(d => d.description.includes(lab.name));
      if (!alreadyInBill) {
        const price = 125.00;
        bill.details = bill.details || [];
        bill.details.push({ description: `Análisis de Laboratorio: ${lab.name}`, amount: price });
        bill.total = parseFloat(bill.total) + price;
        stateModified = true;
      }
    }
  });

  if (stateModified) {
    saveAppState(stateObj);
  }
}

export function isUserBillingAuthorized(user) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const name = String(user.name || '').toLowerCase();
  const id = String(user.id || '').toLowerCase();

  // Roles autorizados: Administrador, Medico 1, y Recepcionista
  const isAdmin = role.includes('admin') || name.includes('admin') || id.includes('admin') || role === 'administrador';
  const isRecepcionista = role.includes('recep') || role.includes('secretaria') || role === 'recepcionista';
  const isMedico1 = id === 'u-med-1' || name.includes('carlos montenegro') || role === 'medico_1' || role === 'medico1' || role === 'medico';

  return isAdmin || isRecepcionista || isMedico1;
}

// Renderizar listado de cobros y facturación del paciente
function renderBilling(patient) {
  const tableBody = document.getElementById('table-billing-body');
  const paneBilling = document.getElementById('pane-billing');
  if (!tableBody || !paneBilling) return;

  const stateObj = getAppState();
  const currentUser = stateObj.currentUser;

  if (!isUserBillingAuthorized(currentUser)) {
    paneBilling.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem; background: rgba(255, 0, 0, 0.04); border: 1px dashed var(--accent-danger); border-radius: 8px; margin: 1rem 0;">
        <span style="font-size: 3rem;">🔒</span>
        <h3 style="color: var(--accent-danger); margin-top: 1rem; font-family: var(--font-heading);">Acceso Restringido a Facturación</h3>
        <p style="color: var(--text-muted); margin-top: 0.5rem; font-size: 0.95rem; max-width: 500px; margin-left: auto; margin-right: auto;">
          La sección de <strong>Facturación y Comprobantes</strong> únicamente está accesible para los usuarios con rol de <strong>Administrador</strong>, <strong>Medico 1</strong> y <strong>Recepcionista</strong>.
        </p>
      </div>
    `;
    return;
  }

  const currentPatient = stateObj.patients.find(p => p.id === patient.id) || patient;

  // Sincronizar automáticamente cualquier receta u orden de estudios pendiente de cobro
  syncPatientBilling(currentPatient, stateObj);

  tableBody.innerHTML = '';
  const billingHistory = currentPatient.billingHistory || [];

  if (billingHistory.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px 0;">No hay cobros registrados para este paciente</td></tr>';
    return;
  }

  billingHistory.forEach(bill => {
    const row = document.createElement('tr');
    let dateFormatted = bill.date || 'Reciente';
    try {
      if (bill.date && !isNaN(new Date(bill.date).getTime())) {
        dateFormatted = new Date(bill.date).toLocaleDateString('es-GT');
      }
    } catch(e){}
    
    // Si no tiene status, asumimos Pagado por compatibilidad
    if (!bill.status) bill.status = 'Pagado';

    let statusBadge = '';
    let actionButtons = '';

    if (bill.status === 'Pendiente') {
      statusBadge = `<span class="badge" style="background: rgba(255, 152, 0, 0.15); color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pendiente</span>`;
      actionButtons = `
        <button class="btn btn-success btn-small btn-pay-bill" data-id="${bill.id}" style="padding: 4px 8px; font-size: 0.8rem; margin-right: 5px;">
          <span>💸</span> Cobrar
        </button>
      `;
    } else {
      statusBadge = `<span class="badge" style="background: rgba(76, 175, 80, 0.15); color: #4caf50; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pagado</span>`;
      actionButtons = `
        <button class="btn btn-secondary btn-small btn-print-bill" data-id="${bill.id}">
          <span>🖨️</span> Imprimir
        </button>
      `;
    }

    const detailsList = (bill.details && Array.isArray(bill.details) && bill.details.length > 0)
      ? `<ul style="margin: 6px 0 0 0; padding-left: 14px; font-size: 0.82rem; color: var(--text-muted); list-style: disc;">
          ${bill.details.map(d => {
            const desc = typeof d === 'string' ? d : (d.description || d.name || 'Servicio / Honorario');
            const amt = (d && d.amount !== undefined && !isNaN(d.amount)) ? parseFloat(d.amount).toFixed(2) : ((bill.total !== undefined && !isNaN(bill.total)) ? parseFloat(bill.total).toFixed(2) : '50.00');
            return `<li>${desc} — <strong style="color: var(--accent-secondary);">Q${amt}</strong></li>`;
          }).join('')}
         </ul>`
      : '';

    const billTotal = (bill.total !== undefined && !isNaN(bill.total)) ? bill.total : 50.00;

    row.innerHTML = `
      <td><strong>${bill.id}</strong></td>
      <td>${dateFormatted}</td>
      <td>
        <strong style="color: var(--text-primary); font-size: 0.95rem;">${bill.concept || 'Servicio Médico'}</strong>
        ${detailsList}
      </td>
      <td><span style="font-size: 0.8rem; color: var(--text-muted);">${bill.diagnosis || 'Ninguno'}</span></td>
      <td>${statusBadge}</td>
      <td><strong style="color: var(--accent-success); font-size: 1.05rem;">Q ${parseFloat(billTotal).toFixed(2)}</strong></td>
      <td>${actionButtons}</td>
    `;

    // Bind events
    const printBtn = row.querySelector('.btn-print-bill');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        printBillingVoucher(currentPatient, bill);
      });
    }

    const payBtn = row.querySelector('.btn-pay-bill');
    if (payBtn) {
      payBtn.addEventListener('click', () => {
        const stateToSave = getAppState();
        const pObj = stateToSave.patients.find(p => p.id === currentPatient.id);
        const billObj = pObj.billingHistory.find(b => b.id === bill.id);
        
        billObj.status = 'Pagado';
        saveAppState(stateToSave);

        alert(`🎉 Cobro de Q${parseFloat(bill.total).toFixed(2)} procesado exitosamente para el comprobante ${bill.id}.\n\nSe ha desbloqueado el despacho de medicamentos en Farmacia y la ejecución de estudios.`);
        printBillingVoucher(pObj, billObj);
        
        // Refrescar vista
        renderBilling(pObj);
      });
    }

    tableBody.appendChild(row);
  });
}

// Generar e imprimir el comprobante de cobro (factura/recibo)
function printBillingVoucher(patient, bill) {
  const state = getAppState();
  const clinic = state.clinicInfo;
  
  // Formatear fecha
  const dateFormatted = new Date(bill.date).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

  // Crear ventana temporal de impresión
  const printWindow = window.open('', '_blank');
  
  const logoHtml = clinic.logoData 
    ? `<img src="${clinic.logoData}" style="max-height: 60px; max-width: 140px; object-fit: contain; margin-bottom: 10px;">` 
    : `<span style="font-size: 2.5rem; display: block; margin-bottom: 5px;">🏥</span>`;

  const detailsRows = bill.details.map(d => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${d.description}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">Q ${parseFloat(d.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Comprobante de Pago - ${bill.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            color: #333;
            margin: 0;
            padding: 30px;
            background: #fff;
          }
          .bill-container {
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #ddd;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #00f2fe;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          .header-left {
            display: flex;
            flex-direction: column;
          }
          .clinic-name {
            font-size: 1.4rem;
            font-weight: 700;
            color: #111;
          }
          .clinic-details {
            font-size: 0.8rem;
            color: #666;
            margin-top: 5px;
            line-height: 1.4;
          }
          .header-right {
            text-align: right;
          }
          .title {
            font-size: 1.2rem;
            font-weight: 700;
            color: #00f2fe;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .invoice-number {
            font-size: 1rem;
            font-weight: bold;
            color: #333;
            margin-top: 4px;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 25px;
            font-size: 0.85rem;
            line-height: 1.6;
          }
          .meta-block {
            flex: 1;
          }
          .table-details {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            font-size: 0.9rem;
          }
          .table-header th {
            background: #f8f9fa;
            padding: 10px;
            text-align: left;
            border-bottom: 2px solid #eee;
            font-weight: 600;
          }
          .total-box {
            display: flex;
            justify-content: flex-end;
            font-size: 1.1rem;
            font-weight: 700;
            border-top: 2px solid #eee;
            padding-top: 15px;
            margin-top: 10px;
          }
          .total-amount {
            color: #2ecc71;
            margin-left: 15px;
          }
          .footer {
            text-align: center;
            font-size: 0.75rem;
            color: #999;
            margin-top: 40px;
            border-top: 1px dashed #eee;
            padding-top: 20px;
          }
          @media print {
            body { padding: 0; }
            .bill-container { border: none; box-shadow: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="bill-container">
          <!-- Encabezado Oficial Institucional (LUGAMED 2.0) -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; font-family: Arial, Helvetica, sans-serif;">
            <div style="display: flex; align-items: center; gap: 14px;">
              ${logoHtml}
              <div>
                <h2 style="margin: 0; font-size: 1.35rem; font-weight: 800; color: #1e3a8a;">${clinic.name || 'Centro Médico Altamira'}</h2>
                <div style="font-size: 0.85rem; font-weight: 700; color: #0284c7; margin-top: 3px;">Atención Médica Profesional — LUGAMED 2.0</div>
              </div>
            </div>
            <div style="text-align: right; font-size: 0.82rem; color: #475569; line-height: 1.4;">
              📍 ${clinic.address || 'Guatemala'}<br>
              📞 Teléfono: ${clinic.phone || 'N/A'}<br>
              ✉️ Email: ${clinic.email || 'N/A'}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-family: Arial, sans-serif;">
            <div>
              <span style="font-size: 1.15rem; font-weight: 800; color: #1e3a8a;">Comprobante / Factura de Pago</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.95rem; font-weight: 700; color: #0284c7;">${bill.id}</span><br>
              <span style="font-size: 0.8rem; color: #64748b;">Fecha: ${dateFormatted}</span>
            </div>
          </div>

          <div class="meta-info">
            <div class="meta-block">
              <strong>DATOS DEL PACIENTE:</strong><br>
              Nombre: ${patient.name}<br>
              Edad: ${Math.abs(new Date(Date.now() - new Date(patient.birthdate).getTime()).getUTCFullYear() - 1970)} años<br>
              Género: ${patient.gender}
            </div>
            <div class="meta-block" style="text-align: right;">
              <strong>DETALLES GENERALES:</strong><br>
              Concepto: ${bill.concept}<br>
              Diagnóstico: ${bill.diagnosis || 'No especificado'}
            </div>
          </div>

          <table class="table-details">
            <thead>
              <tr class="table-header">
                <th style="padding: 10px;">Descripción del Concepto</th>
                <th style="padding: 10px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${detailsRows}
            </tbody>
          </table>

          <div class="total-box">
            <span>TOTAL PAGADO:</span>
            <span class="total-amount">Q ${parseFloat(bill.total).toFixed(2)}</span>
          </div>

          <div class="footer">
            <p>¡Gracias por su confianza en nuestros servicios profesionales!</p>
            <p style="font-size: 0.7rem; color: #ccc;">Documento generado electrónicamente por MedFlow</p>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
