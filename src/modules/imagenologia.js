// src/modules/imagenologia.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId, isAdminUser } from '../main.js';
import { showPastConsultationDetail } from './consulta.js';

// Lista temporal de estudios de imagenología agregados en la orden externa activa
let currentOrderImaging = [];

// Catálogo de Estudios de Imagenología
const IMAGING_STUDIES_CATALOG = [
  // Rayos X (Rx)
  { name: "Rayos X (Rx) de Tórax AP y Lateral", category: "Rayos X (Rx)" },
  { name: "Rayos X (Rx) de Abdomen Simple", category: "Rayos X (Rx)" },
  { name: "Rayos X (Rx) de Columna Cervical AP y Lateral", category: "Rayos X (Rx)" },
  { name: "Rayos X (Rx) de Columna Lumbosacra AP y Lateral", category: "Rayos X (Rx)" },
  { name: "Rayos X (Rx) de Rodilla AP y Lateral", category: "Rodilla" },
  // Ultrasonido (USG)
  { name: "Ultrasonido (USG) Abdominal Completo", category: "Ultrasonido (USG)" },
  { name: "Ultrasonido (USG) Renal y Vesical", category: "Ultrasonido (USG)" },
  { name: "Ultrasonido (USG) Obstétrico (Detalle Anatómico)", category: "Ultrasonido (USG)" },
  { name: "Ultrasonido (USG) Pélvico / Transvaginal", category: "Ultrasonido (USG)" },
  { name: "Ultrasonido (USG) Tiroideo y de Cuello", category: "Ultrasonido (USG)" },
  // Tomografía Computarizada (TC)
  { name: "Tomografía (TC) de Cráneo (Simple)", category: "Tomografía Computarizada (TC)" },
  { name: "Tomografía (TC) de Cráneo (Contrastada)", category: "Tomografía Computarizada (TC)" },
  { name: "Tomografía (TC) de Tórax (Alta Resolución)", category: "Tomografía Computarizada (TC)" },
  { name: "Tomografía (TC) de Abdomen y Pelvis (Urotac)", category: "Tomografía Computarizada (TC)" },
  { name: "Tomografía (TC) de Columna Lumbar", category: "Tomografía Computarizada (TC)" },
  // Resonancia Magnética (RMN)
  { name: "Resonancia (RMN) de Cerebro (Simple)", category: "Resonancia Magnética (RMN)" },
  { name: "Resonancia (RMN) de Cerebro (Contrastada)", category: "Resonancia Magnética (RMN)" },
  { name: "Resonancia (RMN) de Columna Lumbar", category: "Resonancia Magnética (RMN)" },
  { name: "Resonancia (RMN) de Rodilla", category: "Resonancia Magnética (RMN)" },
  { name: "Angioresonancia Magnética Cerebral", category: "Resonancia Magnética (RMN)" }
];

function getBMICategory(bmi) {
  const val = parseFloat(bmi);
  if (isNaN(val)) return '';
  if (val < 18.5) return 'Bajo peso';
  if (val < 25) return 'Peso normal';
  if (val < 30) return 'Sobrepeso';
  return 'Obesidad';
}

function getPatientVitalsHeaderHtml(patient) {
  if (!patient) return '';
  const latestVitals = patient.vitalSigns && patient.vitalSigns.length > 0 ? patient.vitalSigns[0] : null;
  const ageDt = patient.birthdate ? new Date(patient.birthdate) : null;
  let ageText = 'N/D';
  if (ageDt) {
    const ageDiffMs = Date.now() - ageDt.getTime();
    const ageDate = new Date(ageDiffMs);
    ageText = `${Math.abs(ageDate.getUTCFullYear() - 1970)} años`;
  }
  
  let vitalsGridHtml = `
    <div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 0.5rem;">
      ⚠️ No se han registrado signos vitales ni datos antropométricos para este paciente en Preconsulta.
    </div>
  `;
  
  if (latestVitals) {
    vitalsGridHtml = `
      <div style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.15); padding: 8px 12px; border-radius: var(--radius-sm); text-align: center;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Presión Arterial</div>
        <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-primary); margin-top: 2px;">💓 ${latestVitals.bp_systolic}/${latestVitals.bp_diastolic} <span style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">mmHg</span></div>
      </div>
      <div style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.15); padding: 8px 12px; border-radius: var(--radius-sm); text-align: center;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Temperatura</div>
        <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-primary); margin-top: 2px;">🌡️ ${latestVitals.temp} <span style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">°C</span></div>
      </div>
      <div style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.15); padding: 8px 12px; border-radius: var(--radius-sm); text-align: center;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Frec. Cardíaca</div>
        <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-primary); margin-top: 2px;">🫀 ${latestVitals.heart_rate} <span style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">lpm</span></div>
      </div>
      <div style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.15); padding: 8px 12px; border-radius: var(--radius-sm); text-align: center;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Saturación O₂</div>
        <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-primary); margin-top: 2px;">💨 ${latestVitals.oxygen} <span style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">%</span></div>
      </div>
      <div style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.15); padding: 8px 12px; border-radius: var(--radius-sm); text-align: center; font-size: 0.85rem;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Antropometría</div>
        <div style="margin-top: 2px; line-height: 1.2;">
          ⚖️ Peso: <strong>${latestVitals.weight} kg</strong><br>
          📏 Talla: <strong>${latestVitals.height} m</strong>
        </div>
      </div>
      <div style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.15); padding: 8px 12px; border-radius: var(--radius-sm); text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">IMC</div>
        <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-primary); margin-top: 2px;">📊 ${latestVitals.bmi}</div>
        <div style="font-size: 0.7rem; color: var(--accent-secondary); font-weight: 600;">${getBMICategory(latestVitals.bmi)}</div>
      </div>
      ${latestVitals.glucose !== undefined && latestVitals.glucose !== null && latestVitals.glucose !== '' ? `
        <div style="background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.15); padding: 8px 12px; border-radius: var(--radius-sm); text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; grid-column: span 2;">
          <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Glucosa Capilar:</span>
          <span style="font-size: 1.1rem; font-weight: bold; color: #a855f7;">🩸 ${latestVitals.glucose} <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">mg/dL</span></span>
        </div>
      ` : ''}
    `;
  }

  return `
    <div class="glass-card" style="margin-bottom: 1.5rem; padding: 12px 16px; border-left: 4px solid var(--accent-primary);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.3rem; line-height: 1;">👤</span>
          <span style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${patient.name}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">| Edad: ${ageText} | Sexo: ${String(patient.gender || '').toUpperCase().startsWith('F') ? 'FEMENINO' : 'MASCULINO'}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          ID Exp: <strong style="color: var(--accent-secondary); font-family: monospace;">${patient.id}</strong>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 10px;">
        ${vitalsGridHtml}
      </div>
    </div>
  `;
}

export function renderImagenologia(container) {
  const state = getAppState();
  const activePatientId = getActivePatientId();
  
  container.innerHTML = `
    <!-- Cabecera del Módulo -->
    <div class="module-header" style="margin-bottom: 1.5rem;">
      <div class="module-title">
        <h1>Módulo de Imagenología</h1>
        <p>Emisión de órdenes de estudios externas y redacción de informes técnicos de ultrasonido.</p>
      </div>
    </div>

    <!-- Pestañas internas -->
    <div class="tabs-container" style="display: flex; gap: 10px; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
      <button class="tab-btn active" id="tab-imaging-orders">📋 Solicitud de Estudios (Órdenes)</button>
      <button class="tab-btn" id="tab-imaging-reports">🔬 Informes de Ultrasonidos (Resultados)</button>
    </div>

    <!-- Banner de Paciente en la Parte Superior -->
    <div id="img-patient-banner-area"></div>

    <!-- Layout de doble columna -->
    <div class="grid-prescription">
      
      <!-- Columna Principal de Contenidos -->
      <div style="flex: 1;">
        <!-- Pestaña 1: Órdenes -->
        <div id="pane-img-orders" class="tab-pane active" style="display: block;">
          <div id="img-builder-area"></div>
        </div>

        <!-- Pestaña 2: Informes -->
        <div id="pane-img-reports" class="tab-pane" style="display: none;">
          <div id="img-report-form-area"></div>
        </div>
      </div>
      
      <!-- Barra lateral de Pacientes e Historial -->
      <div class="glass-card search-sidebar" style="flex: 0 0 320px;">
        <h3>Seleccionar Paciente</h3>
        <div class="form-group" style="margin-top: 5px; margin-bottom: 10px;">
          <input type="text" id="img-patient-search" placeholder="🔍 Buscar paciente...">
        </div>
        <ul class="patient-list" id="img-patient-list" style="max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem;">
          <!-- Todos los pacientes se cargan aquí -->
        </ul>

        <div id="img-patient-history-section" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
          <h3>Consultas Registradas</h3>
          <ul class="history-sidebar-list" id="img-consultation-history-list" style="margin-top: 10px; max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem;">
            <!-- Cargar historial del paciente seleccionado -->
          </ul>
        </div>

        <div id="img-order-history-area" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
          <!-- Órdenes Solicitadas -->
        </div>

        <div id="img-report-history-area" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
          <!-- Informes de Ultrasonido Guardados -->
        </div>
      </div>
    </div>
  `;

  // Bind de pestañas
  const tabOrders = document.getElementById('tab-imaging-orders');
  const tabReports = document.getElementById('tab-imaging-reports');
  const paneOrders = document.getElementById('pane-img-orders');
  const paneReports = document.getElementById('pane-img-reports');

  const switchTab = (tab) => {
    if (tab === 'orders') {
      tabOrders.classList.add('active');
      tabReports.classList.remove('active');
      paneOrders.style.display = 'block';
      paneReports.style.display = 'none';
    } else {
      tabOrders.classList.remove('active');
      tabReports.classList.add('active');
      paneOrders.style.display = 'none';
      paneReports.style.display = 'block';
    }
  };

  tabOrders.addEventListener('click', () => switchTab('orders'));
  tabReports.addEventListener('click', () => switchTab('reports'));

  // Bind búsqueda de pacientes
  const searchInput = document.getElementById('img-patient-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderPatientList(e.target.value);
    });
  }

  renderPatientList();

  if (activePatientId) {
    selectPatient(activePatientId);
  } else {
    showPlaceholder();
  }
}

function renderPatientList(query = '') {
  const state = getAppState();
  const listContainer = document.getElementById('img-patient-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';
  
  const currentUser = state.currentUser;
  let basePatients = state.patients || [];

  const roleNorm = String(currentUser && currentUser.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isDoctor = roleNorm.startsWith('medico');
  if (currentUser && isDoctor) {
    basePatients = basePatients.filter(p => 
      p.assignedDoctorId === currentUser.id || 
      p.assignedDoctorName === currentUser.name
    );
  }

  const filtered = basePatients.filter(p => {
    const nameVal = p.name ? String(p.name).toLowerCase() : '';
    const telVal = p.telephone ? String(p.telephone) : '';
    return nameVal.includes(query.toLowerCase()) || telVal.includes(query);
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = '<li style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No se encontraron pacientes</li>';
    return;
  }

  const activeId = getActivePatientId();

  filtered.forEach(p => {
    const li = document.createElement('li');
    li.className = `patient-item ${p.id === activeId ? 'selected' : ''}`;
    
    const lastVitals = p.vitalSigns && p.vitalSigns.length > 0 ? p.vitalSigns[0] : null;
    const bpText = lastVitals ? `${lastVitals.bp_systolic}/${lastVitals.bp_diastolic} mmHg` : 'Sin signos';

    li.innerHTML = `
      <div class="patient-item-name">${p.name}</div>
      <div class="patient-item-meta">Tel: ${p.telephone} | P.A: ${bpText}</div>
    `;

    li.addEventListener('click', () => {
      selectPatient(p.id);
    });

    listContainer.appendChild(li);
  });
}

function selectPatient(patientId) {
  const state = getAppState();
  const currentUser = state.currentUser;
  let patient = state.patients.find(p => p.id === patientId);

  // Validar acceso si el usuario es médico (incluyendo Medico 1, Medico 2, Medico 3, etc.)
  const roleNormSel = String(currentUser && currentUser.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isDoctorSel = roleNormSel.startsWith('medico');
  if (currentUser && isDoctorSel) {
    if (patient && patient.assignedDoctorId !== currentUser.id && patient.assignedDoctorName !== currentUser.name) {
      patient = null;
    }
  }

  const doctors = state.users.filter(u => {
    const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return r === 'medico' || r === 'medico 1' || r === 'medico 2' || r === 'medico 3';
  });

  setActivePatientId(patientId);
  
  const searchInput = document.getElementById('img-patient-search');
  renderPatientList(searchInput ? searchInput.value : '');

  if (!patient) {
    showPlaceholder();
    return;
  }

  const dob = new Date(patient.birthdate);
  const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  const banner = document.getElementById('img-patient-banner-area');
  if (banner) {
    banner.innerHTML = `
      <div class="patient-top-banner glass-card" style="
        margin-bottom: 1.5rem; 
        display: flex; 
        align-items: center; 
        gap: 1.5rem; 
        padding: 1.25rem; 
        border-left: 4px solid var(--accent-secondary);
      ">
        <div style="
          background: rgba(160, 0, 255, 0.1); 
          width: 50px; 
          height: 50px; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 1.5rem; 
          color: var(--accent-secondary);
        ">
          👤
        </div>
        <div style="flex: 1;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Paciente Seleccionado</div>
          <h2 style="font-family: var(--font-heading); font-size: 1.35rem; color: var(--text-primary); margin: 2px 0 0 0;">${patient.name}</h2>
        </div>
        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
          <div>
            <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">Edad</span>
            <strong style="color: var(--text-primary); font-size: 1rem;">${age} años</strong>
          </div>
          <div>
            <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">Género</span>
            <strong style="color: var(--text-primary); font-size: 1rem;">${patient.gender}</strong>
          </div>
          <div>
            <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">Teléfono</span>
            <strong style="color: var(--text-primary); font-size: 1rem;">${patient.telephone}</strong>
          </div>
        </div>
      </div>
    `;
  }

  const historySection = document.getElementById('img-patient-history-section');
  const orderSection = document.getElementById('img-order-history-area');
  const reportSection = document.getElementById('img-report-history-area');
  if (historySection) historySection.style.display = 'block';
  if (orderSection) orderSection.style.display = 'block';
  if (reportSection) reportSection.style.display = 'block';

  renderConsultationHistory(patient);
  renderOrderHistory(patient);
  renderReportHistory(patient);
  renderImgBuilder(patient, doctors);
  renderReportBuilder(patient, doctors);
}

function showPlaceholder() {
  const container = document.getElementById('img-builder-area');
  if (container) {
    container.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 4rem 2rem;">
        <span style="font-size: 3rem;">🖼️</span>
        <h2 style="margin-top: 1rem;">Selecciona un paciente</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem;">Utiliza la barra lateral para buscar y seleccionar al paciente para el cual emitirá la orden de estudios de imagenología.</p>
      </div>
    `;
  }

  const reportContainer = document.getElementById('img-report-form-area');
  if (reportContainer) {
    reportContainer.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 4rem 2rem;">
        <span style="font-size: 3rem;">🔬</span>
        <h2 style="margin-top: 1rem;">Selecciona un paciente</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem;">Utiliza la barra lateral para buscar y seleccionar al paciente para el cual redactará o imprimirá informes de ultrasonidos.</p>
      </div>
    `;
  }

  const banner = document.getElementById('img-patient-banner-area');
  if (banner) banner.innerHTML = '';

  const historySection = document.getElementById('img-patient-history-section');
  const orderSection = document.getElementById('img-order-history-area');
  const reportSection = document.getElementById('img-report-history-area');
  if (historySection) historySection.style.display = 'none';
  if (orderSection) orderSection.style.display = 'none';
  if (reportSection) reportSection.style.display = 'none';
}

function renderConsultationHistory(patient) {
  const container = document.getElementById('img-consultation-history-list');
  if (!container) return;

  container.innerHTML = '';
  
  if (!patient.consultations || patient.consultations.length === 0) {
    container.innerHTML = '<li style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No hay consultas previas</li>';
    return;
  }

  patient.consultations.forEach(c => {
    const li = document.createElement('li');
    li.className = 'history-card';
    const dateFormatted = new Date(c.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
    
    const dxText = (c.diagnosisCodes && Array.isArray(c.diagnosisCodes)) ? c.diagnosisCodes.join(', ') : (c.diagnosis || 'Z00.0');

    li.innerHTML = `
      <div class="history-card-header">
        <span>${dateFormatted}</span>
        <span>${c.specialty || 'General'}</span>
      </div>
      <div class="history-card-title">${c.doctor || 'Médico Tratante'}</div>
      <div class="history-card-body" title="${c.reason || ''}">
        <strong>Motivo:</strong> ${c.reason || 'Consulta Médica'}
      </div>
      <div style="font-size: 0.75rem; margin-top: 6px; color: var(--accent-primary);">
        DX: ${dxText}
      </div>
    `;

    li.addEventListener('click', () => {
      showPastConsultationDetail(c, patient, (updatedPatient) => {
        renderConsultationHistory(updatedPatient);
      });
    });

    container.appendChild(li);
  });
}

function renderOrderHistory(patient) {
  const container = document.getElementById('img-order-history-area');
  if (!container) return;

  const orders = patient.studyOrders || [];
  const imgOrders = orders.filter(o => o.studies.some(s => s.type === 'imaging'));

  let ordersListHtml = '';
  if (imgOrders.length === 0) {
    ordersListHtml = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 15px 0;">No hay órdenes externas previas</div>`;
  } else {
    ordersListHtml = `
      <ul style="display: flex; flex-direction: column; gap: 8px; list-style: none;">
        ${imgOrders.map(o => `
          <li class="history-card order-history-card" data-id="${o.id}" style="cursor: pointer;">
            <div class="history-card-header" style="position: relative; display: flex; justify-content: space-between; align-items: center;">
              <span>${new Date(o.date).toLocaleDateString()}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.75rem; color: var(--accent-secondary); font-weight: 600;">🖼️ Imagen</span>
                ${isAdminUser() ? `
                  <button class="btn-delete-img-order" data-id="${o.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px; font-size: 0.95rem; line-height: 1;" title="Eliminar Orden">🗑️</button>
                ` : ''}
              </div>
            </div>
            <div class="history-card-title">${o.doctorName}</div>
            <div class="history-card-body" style="font-size: 0.75rem; color: var(--text-muted);">
              ${o.studies.filter(s => s.type === 'imaging').map(s => s.name).join(', ')}
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  container.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <h3 style="font-family: var(--font-heading); margin-bottom: 0.5rem; color: var(--accent-secondary); font-size: 1.05rem; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
        Órdenes Realizadas
      </h3>
      ${ordersListHtml}
    </div>
  `;

  container.querySelectorAll('.order-history-card').forEach(card => {
    const orderId = card.getAttribute('data-id');
    const orderSelected = orders.find(o => o.id === orderId);

    if (isAdminUser()) {
      const delBtn = card.querySelector('.btn-delete-img-order');
      if (delBtn) {
        delBtn.onclick = async (e) => {
          e.stopPropagation();
          const confirmDel = confirm(`⚠️ ATENCIÓN:\n\n¿Está completamente seguro de que desea eliminar permanentemente esta orden de imagenología del día ${new Date(orderSelected.date).toLocaleDateString()}?\n\nEsta acción es irreversible.`);
          if (confirmDel) {
            const stateObj = getAppState();
            const pObj = stateObj.patients.find(p => p.id === patient.id);
            if (pObj) {
              pObj.studyOrders = (pObj.studyOrders || []).filter(item => item.id !== orderId);
              await saveAppState(stateObj);
              alert("🗑️ Orden de imagenología eliminada correctamente.");
              patient.studyOrders = pObj.studyOrders;
              renderOrderHistory(patient);
            }
          }
        };
      }
    }

    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-img-order')) return;
      if (orderSelected) {
        showOrderPreviewModal(patient, orderSelected);
      }
    });
  });
}

function renderReportHistory(patient) {
  const container = document.getElementById('img-report-history-area');
  if (!container) return;

  const reports = patient.imagingReports || [];

  let reportsListHtml = '';
  if (reports.length === 0) {
    reportsListHtml = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 15px 0;">No hay informes guardados</div>`;
  } else {
    reportsListHtml = `
      <ul style="display: flex; flex-direction: column; gap: 8px; list-style: none;">
        ${reports.map(r => `
          <li class="history-card report-history-card" data-id="${r.id}" style="cursor: pointer;">
            <div class="history-card-header" style="position: relative; display: flex; justify-content: space-between; align-items: center;">
              <span>${new Date(r.date).toLocaleDateString()}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 600;">🔬 USG</span>
                ${isAdminUser() ? `
                  <button class="btn-delete-img-report" data-id="${r.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px; font-size: 0.95rem; line-height: 1;" title="Eliminar Informe">🗑️</button>
                ` : ''}
              </div>
            </div>
            <div class="history-card-title" style="font-size: 0.8rem; font-weight: 700; color: var(--accent-secondary); margin-top: 4px;">${r.typeName}</div>
            <div class="history-card-body" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              Dr(a). ${r.doctorName}
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  container.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <h3 style="font-family: var(--font-heading); margin-bottom: 0.5rem; color: var(--accent-secondary); font-size: 1.05rem; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
        Informes Guardados
      </h3>
      ${reportsListHtml}
    </div>
  `;

  container.querySelectorAll('.report-history-card').forEach(card => {
    const reportId = card.getAttribute('data-id');
    const reportSelected = reports.find(x => x.id === reportId);

    if (isAdminUser()) {
      const delBtn = card.querySelector('.btn-delete-img-report');
      if (delBtn) {
        delBtn.onclick = async (e) => {
          e.stopPropagation();
          const confirmDel = confirm(`⚠️ ATENCIÓN:\n\n¿Desea eliminar permanentemente este informe de ultrasonido del día ${new Date(reportSelected.date).toLocaleDateString()}?\n\nEsta acción es irreversible.`);
          if (confirmDel) {
            const stateObj = getAppState();
            const pObj = stateObj.patients.find(p => p.id === patient.id);
            if (pObj) {
              pObj.imagingReports = (pObj.imagingReports || []).filter(item => item.id !== reportId);
              await saveAppState(stateObj);
              alert("🗑️ Informe de ultrasonido eliminado correctamente.");
              patient.imagingReports = pObj.imagingReports;
              renderReportHistory(patient);
            }
          }
        };
      }
    }

    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-img-report')) return;
      if (reportSelected) {
        showUltrasoundPrintWindow(patient, reportSelected);
      }
    });
  });
}

function renderImgBuilder(patient, doctors) {
  const container = document.getElementById('img-builder-area');
  if (!container) return;

  currentOrderImaging = [];

  const vitalsHeaderHtml = getPatientVitalsHeaderHtml(patient);

  container.innerHTML = `
    ${vitalsHeaderHtml}
    <!-- Card del Médico Solicitante -->
    <div class="glass-card" style="margin-bottom: 1.5rem;">
      <div class="form-group" style="max-width: 420px; margin-bottom: 0;">
        <label style="font-weight: 700; color: var(--accent-secondary);">Médico Solicitante (Tratante)</label>
        <input type="text" value="${patient.assignedDoctorName || 'Dr. Carlos Mendoza'}" readonly style="background: rgba(255,255,255,0.05); cursor: not-allowed; font-weight: bold; color: var(--accent-primary);">
        <input type="hidden" id="o-doctor" value="${patient.assignedDoctorId || 'u-1'}">
      </div>
    </div>

    <!-- CREADOR DE ORDEN EXTERNA -->
    <div class="glass-card" style="margin-bottom: 1.5rem; border-top: 3px solid var(--accent-secondary);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--accent-secondary); font-family: var(--font-heading); margin: 0; font-size: 1.25rem;">🖼️ Solicitud de Estudios de Imagenología (Externos)</h3>
        <button class="btn btn-secondary btn-small" id="btn-new-external-img-order"><span>+</span> Seleccionar Estudios</button>
      </div>

      <h4 style="margin-bottom: 0.5rem; color: var(--text-primary); font-size: 0.95rem;">Estudios de Imagen en la Orden</h4>
      <div style="overflow-x: auto; margin-bottom: 1.5rem;">
        <table class="studies-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
              <th style="padding: 8px; color: var(--text-muted); font-size: 0.85rem;">Estudio Clínico</th>
              <th style="padding: 8px; color: var(--text-muted); font-size: 0.85rem;">Indicaciones / Preparación</th>
              <th style="padding: 8px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Acciones</th>
            </tr>
          </thead>
          <tbody id="external-studies-table-body">
            <!-- Cargar dinámicamente -->
          </tbody>
        </table>
      </div>

      <div class="form-group">
        <label for="o-general-notes">Observaciones Generales de la Orden</label>
        <textarea id="o-general-notes" placeholder="Ej. Paciente con marcapasos, favor evaluar sospecha de hernia lumbar..."></textarea>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" id="btn-preview-external-order" style="flex: 1;">
          <span>🖨️</span> Vista Previa e Imprimir Orden
        </button>
        <button type="button" class="btn btn-success" id="btn-save-external-order" style="flex: 1;">
          <span>💾</span> Grabar Orden Externa
        </button>
      </div>
    </div>
  `;

  // --- MODAL DE CHECKLIST ---
  const checklistModal = document.getElementById('checklist-modal');
  const checklistTitle = document.getElementById('checklist-modal-title');
  const checklistBody = document.getElementById('checklist-modal-body');
  const btnCloseChecklist = document.getElementById('btn-close-checklist');
  const btnCancelChecklist = document.getElementById('btn-cancel-checklist');
  const btnSubmitChecklist = document.getElementById('btn-submit-checklist');

  function openChecklist() {
    if (!checklistModal || !checklistBody) return;
    
    checklistModal.style.display = 'flex';
    
    // Categorías de Imagenología dinámicas desde el estado configurable
    const catalog = getAppState().imagingStudies || IMAGING_STUDIES_CATALOG;
    const categories = [...new Set(catalog.map(s => s.category))];
    
    checklistTitle.textContent = "Nueva Orden de Imagenología (Rayos X, Ultrasonidos, TC, RMN)";

    // Generar checklist con estructura de tarjetas agrupadas por categoría
    let listHtml = `<div class="checklist-container">`;
    categories.forEach(cat => {
      const groupStudies = catalog.filter(s => s.category === cat);
      if (groupStudies.length === 0) return;

      listHtml += `
        <div class="checklist-group" data-category="${cat}">
          <div class="checklist-group-title">${cat}</div>
          <div class="checklist-items-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px;">
            ${groupStudies.map(s => {
              const isChecked = currentOrderImaging.some(x => x.name === s.name);
              return `
                <label class="checklist-item-card ${isChecked ? 'selected' : ''}" style="
                  display: flex; 
                  align-items: center; 
                  gap: 10px; 
                  padding: 10px; 
                  background: rgba(255,255,255,0.02); 
                  border: 1px solid var(--border-color); 
                  border-radius: var(--radius-sm);
                  cursor: pointer;
                  user-select: none;
                ">
                  <input type="checkbox" value="${s.name}" ${isChecked ? 'checked' : ''} style="cursor: pointer;">
                  <span style="font-size: 0.88rem; font-weight: 500;">${s.name}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });
    listHtml += `</div>`;

    checklistBody.innerHTML = listHtml;

    // Toggle visual select en click de tarjetas
    checklistBody.querySelectorAll('.checklist-item-card').forEach(card => {
      const chk = card.querySelector('input[type="checkbox"]');
      card.addEventListener('click', (e) => {
        if (e.target !== chk) {
          chk.checked = !chk.checked;
        }
        if (chk.checked) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      });
    });

    btnSubmitChecklist.onclick = () => {
      const checkedBoxes = checklistBody.querySelectorAll('input[type="checkbox"]:checked');
      if (checkedBoxes.length === 0) {
        alert("Debe seleccionar al menos un estudio.");
        return;
      }

      checkedBoxes.forEach(cb => {
        if (!currentOrderImaging.some(i => i.name === cb.value)) {
          currentOrderImaging.push({ name: cb.value, type: 'imaging', notes: '' });
        }
      });

      renderExternalStudiesTable();
      checklistModal.style.display = 'none';
    };
  }

  const hideChecklist = () => { checklistModal.style.display = 'none'; };
  if (btnCloseChecklist) btnCloseChecklist.onclick = hideChecklist;
  if (btnCancelChecklist) btnCancelChecklist.onclick = hideChecklist;

  document.getElementById('btn-new-external-img-order').addEventListener('click', () => {
    openChecklist();
  });

  // --- TABLA DE ESTUDIOS EN LA ORDEN ---
  const externalTableBody = document.getElementById('external-studies-table-body');
  
  function renderExternalStudiesTable() {
    if (!externalTableBody) return;
    externalTableBody.innerHTML = '';

    if (currentOrderImaging.length === 0) {
      externalTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem;">
            Ningún estudio seleccionado. Presione "Seleccionar Estudios".
          </td>
        </tr>
      `;
      return;
    }

    currentOrderImaging.forEach((study, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; padding: 10px 8px;">${study.name}</td>
        <td style="padding: 10px 8px;">
          <input type="text" class="inline-notes-input" data-name="${study.name}" placeholder="Ej. Traer estudios previos, ayuno de sólidos..." value="${study.notes || ''}" style="
            width: 100%; 
            padding: 6px 10px; 
            background: rgba(255,255,255,0.02); 
            border: 1px solid var(--border-color); 
            color: white; 
            border-radius: var(--radius-sm);
          ">
        </td>
        <td style="text-align: center; padding: 10px 8px;">
          <button class="btn-remove-study" data-name="${study.name}" style="
            background: transparent; 
            border: none; 
            color: #ff5252; 
            cursor: pointer; 
            font-size: 1.1rem;
          ">&times;</button>
        </td>
      `;

      externalTableBody.appendChild(tr);
    });

    externalTableBody.querySelectorAll('.inline-notes-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const name = e.target.getAttribute('data-name');
        const item = currentOrderImaging.find(x => x.name === name);
        if (item) item.notes = e.target.value;
      });
    });

    externalTableBody.querySelectorAll('.btn-remove-study').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.getAttribute('data-name');
        currentOrderImaging = currentOrderImaging.filter(x => x.name !== name);
        renderExternalStudiesTable();
      });
    });
  }

  // --- BOTONES ACCIONES ---
  const docSelect = document.getElementById('o-doctor');
  const btnPreviewExternal = document.getElementById('btn-preview-external-order');
  const btnSaveExternal = document.getElementById('btn-save-external-order');

  btnPreviewExternal.addEventListener('click', () => {
    const doctorId = docSelect.value;
    if (!doctorId) {
      alert("Debe seleccionar el médico solicitante de la orden.");
      return;
    }

    if (currentOrderImaging.length === 0) {
      alert("Debe agregar al menos un estudio de imagenología.");
      return;
    }

    const stateObj = getAppState();
    const doctorObj = stateObj.users.find(u => u.id === doctorId);

    const tempOrder = {
      id: 'o-temp',
      date: new Date().toISOString(),
      doctorName: doctorObj.name,
      doctorLicense: doctorObj.license || 'N/A',
      studies: [...currentOrderImaging],
      generalNotes: document.getElementById('o-general-notes').value
    };

    showOrderPreviewModal(patient, tempOrder);
  });

  btnSaveExternal.addEventListener('click', async () => {
    const doctorId = docSelect.value;
    if (!doctorId) {
      alert("Debe seleccionar el médico solicitante.");
      return;
    }

    if (currentOrderImaging.length === 0) {
      alert("Debe agregar al menos un estudio.");
      return;
    }

    const stateObj = getAppState();
    const pObj = stateObj.patients.find(p => p.id === patient.id);
    const doctorObj = stateObj.users.find(u => u.id === doctorId);

    if (pObj) {
      pObj.studyOrders = pObj.studyOrders || [];
      const newOrder = {
        id: 'o-img-' + Date.now(),
        date: new Date().toISOString(),
        doctorName: doctorObj.name,
        doctorLicense: doctorObj.license || 'N/A',
        studies: [...currentOrderImaging],
        generalNotes: document.getElementById('o-general-notes').value
      };

      pObj.studyOrders.unshift(newOrder);
      await saveAppState(stateObj);
      alert("💾 Orden de estudios de imagenología grabada con éxito.");
      
      patient.studyOrders = pObj.studyOrders;
      renderOrderHistory(patient);
      
      // Reset del creador
      currentOrderImaging = [];
      renderExternalStudiesTable();
      document.getElementById('o-general-notes').value = '';
    }
  });

  renderExternalStudiesTable();
}

function renderReportBuilder(patient, doctors) {
  const container = document.getElementById('img-report-form-area');
  if (!container) return;

  const activeDoctorName = patient.assignedDoctorName || 'Dr. Carlos Mendoza';

  container.innerHTML = `
    <div class="glass-card" style="margin-bottom: 1.5rem;">
      <h3 style="color: var(--accent-primary); font-family: var(--font-heading); margin-top: 0; margin-bottom: 1rem; font-size: 1.2rem;">🔬 Redactar Informe de Ultrasonido</h3>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.5rem;">
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-weight: 700; color: var(--accent-secondary);">Médico Informante</label>
          <input type="text" id="rep-doctor-name" value="${activeDoctorName}" style="font-weight: bold; color: var(--accent-primary);">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-weight: 700; color: var(--accent-secondary);">Colegiado Profesional</label>
          <input type="text" id="rep-doctor-license" value="9876" placeholder="Ej. 9876" style="font-weight: bold;">
        </div>
      </div>

      <div class="form-group" style="margin-top:1.25rem;">
        <label for="rep-ultrasound-type" style="font-weight: 700;">Seleccionar Tipo de Ultrasonido</label>
        <select id="rep-ultrasound-type" style="width: 100%; padding: 10px; background: var(--bg-card); color: var(--text-primary); font-size: 1rem; font-weight: bold; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
          <option value="">-- Selecciona el tipo de ultrasonido --</option>
          <option value="pelvico">Ultrasonido Pélvico</option>
          <option value="obstetrico_1t">Ultrasonido Obstétrico I Trimestre</option>
          <option value="obstetrico_2t_3t">Ultrasonido Obstétrico II y III Trimestre</option>
        </select>
      </div>
    </div>

    <div id="gyo-report-fields-container">
      <!-- Los campos específicos se inyectan aquí al cambiar el selector -->
    </div>
  `;

  const typeSelect = document.getElementById('rep-ultrasound-type');
  const fieldsContainer = document.getElementById('gyo-report-fields-container');

  if (typeSelect && fieldsContainer) {
    typeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      if (!type) {
        fieldsContainer.innerHTML = '';
        return;
      }
      renderReportTypeFields(type, patient);
    });
  }
}

function renderReportTypeFields(type, patient) {
  const fieldsContainer = document.getElementById('gyo-report-fields-container');
  if (!fieldsContainer) return;

  const currentDate = new Date().toISOString().split('T')[0];

  if (type === 'pelvico') {
    fieldsContainer.innerHTML = `
      <form id="ultrasound-report-form" class="glass-card" style="border-top: 3px solid var(--accent-primary); padding: 1.5rem;">
        <h4 style="color: var(--accent-primary); margin-top: 0; margin-bottom: 1.25rem;">Parámetros de Ultrasonido Pélvico</h4>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Fecha de Estudio</label>
            <input type="date" id="rep-date" value="${currentDate}" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Frecuencia del Transductor (MHz)</label>
            <input type="text" id="rep-param-transducer" value="3.5" placeholder="Ej. 3.5 o 5.0" required>
          </div>
        </div>

        <div class="form-group">
          <label>Útero (Bordes, Ecogenicidad, Posición)</label>
          <input type="text" id="rep-param-utero-desc" value="En anteversoflexión, de bordes regulares, contorno liso, ecogenicidad homogénea." placeholder="Descripción del útero..." required style="width: 100%;">
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Útero Longitud (cm)</label>
            <input type="number" step="0.1" id="rep-param-utero-long" placeholder="Ej. 7.5" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Útero Transversal (cm)</label>
            <input type="number" step="0.1" id="rep-param-utero-trans" placeholder="Ej. 4.5" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Útero Ancho (cm)</label>
            <input type="number" step="0.1" id="rep-param-utero-ancho" placeholder="Ej. 3.8" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Endometrio (Aspecto)</label>
            <input type="text" id="rep-param-endometrio-desc" value="Lineal, homogéneo, fase proliferativa." placeholder="Aspecto del endometrio..." required style="width: 100%;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Espesor (mm)</label>
            <input type="number" step="0.1" id="rep-param-endometrio-espesor" placeholder="Ej. 6.2" required>
          </div>
        </div>

        <div style="border-top: 1px dashed var(--border-color); padding-top: 12px; margin-top: 12px; margin-bottom: 1.25rem;">
          <span style="font-weight: bold; color: var(--accent-secondary); font-size: 0.9rem; display: block; margin-bottom: 6px;">Ovario Derecho</span>
          <div class="form-group" style="margin-bottom: 8px;">
            <input type="text" id="rep-param-od-desc" value="Forma y situación normal, con folículos en desarrollo." required style="width: 100%;">
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div class="form-group" style="margin-bottom: 0;"><label style="font-size:0.75rem;">Longitud (cm)</label><input type="number" step="0.1" id="rep-param-od-long" placeholder="Ej. 3.2" required></div>
            <div class="form-group" style="margin-bottom: 0;"><label style="font-size:0.75rem;">Transversal (cm)</label><input type="number" step="0.1" id="rep-param-od-trans" placeholder="Ej. 2.1" required></div>
            <div class="form-group" style="margin-bottom: 0;"><label style="font-size:0.75rem;">Ancho (cm)</label><input type="number" step="0.1" id="rep-param-od-ancho" placeholder="Ej. 1.8" required></div>
          </div>
        </div>

        <div style="border-top: 1px dashed var(--border-color); padding-top: 12px; margin-top: 12px; margin-bottom: 1.5rem;">
          <span style="font-weight: bold; color: var(--accent-secondary); font-size: 0.9rem; display: block; margin-bottom: 6px;">Ovario Izquierdo</span>
          <div class="form-group" style="margin-bottom: 8px;">
            <input type="text" id="rep-param-oi-desc" value="Forma y situación normal, sónico, sin masas anexiales." required style="width: 100%;">
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div class="form-group" style="margin-bottom: 0;"><label style="font-size:0.75rem;">Longitud (cm)</label><input type="number" step="0.1" id="rep-param-oi-long" placeholder="Ej. 3.0" required></div>
            <div class="form-group" style="margin-bottom: 0;"><label style="font-size:0.75rem;">Transversal (cm)</label><input type="number" step="0.1" id="rep-param-oi-trans" placeholder="Ej. 2.0" required></div>
            <div class="form-group" style="margin-bottom: 0;"><label style="font-size:0.75rem;">Ancho (cm)</label><input type="number" step="0.1" id="rep-param-oi-ancho" placeholder="Ej. 1.7" required></div>
          </div>
        </div>

        <div class="form-group">
          <label>Impresión Diagnóstica</label>
          <textarea id="rep-param-diagnostico" rows="3" placeholder="Ej. Útero y anexos dentro de límites normales de ecogenicidad." required style="width: 100%;">Útero y anexos ecográficamente normales.</textarea>
        </div>

        <div class="form-group">
          <label>Recomendaciones</label>
          <textarea id="rep-param-recomendaciones" rows="2" placeholder="Ej. Correlacionar con clínica de la paciente y control periódico." style="width: 100%;"></textarea>
        </div>

        <div style="display: flex; gap: 15px; margin-top: 1.5rem;">
          <button type="submit" class="btn btn-primary" style="flex: 1;">💾 Grabar y Generar Reporte de Resultados</button>
        </div>
      </form>
    `;
  } else if (type === 'obstetrico_1t') {
    fieldsContainer.innerHTML = `
      <form id="ultrasound-report-form" class="glass-card" style="border-top: 3px solid var(--accent-primary); padding: 1.5rem;">
        <h4 style="color: var(--accent-primary); margin-top: 0; margin-bottom: 1.25rem;">Parámetros de Ultrasonido Obstétrico I Trimestre</h4>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Fecha de Estudio</label>
            <input type="date" id="rep-date" value="${currentDate}" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Frecuencia del Transductor (MHz)</label>
            <input type="text" id="rep-param-transducer" value="6.5" placeholder="Ej. 6.5 transvaginal o 3.5 abdominal" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Saco Gestacional (SG - mm)</label>
            <input type="number" step="0.1" id="rep-param-sg" placeholder="Ej. 18.5" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>SG para (semanas)</label>
            <input type="number" id="rep-param-sg-semanas" placeholder="Ej. 6" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Longitud Céfalo-Caudal (LCC/CRL - mm)</label>
            <input type="number" step="0.1" id="rep-param-lcc" placeholder="Ej. 12.0" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>LCC para (semanas)</label>
            <input type="number" id="rep-param-lcc-semanas" placeholder="Ej. 7" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Frecuencia Cardiaca Fetal (FCF - lpm)</label>
            <input type="number" id="rep-param-fcf" placeholder="Ej. 154" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Actividad y Movimiento Fetal</label>
            <select id="rep-param-actividad" style="width:100%; padding:8px; background:var(--bg-card); color:var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
              <option value="Presente">Presente</option>
              <option value="Ausente">Ausente</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Situación del Saco</label>
            <input type="text" id="rep-param-situacion" value="Intrauterino" required style="width: 100%;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Reacción Decidual</label>
            <input type="text" id="rep-param-reaccion" value="Adecuada, con buen halo decidual." required style="width: 100%;">
          </div>
        </div>

        <div class="form-group">
          <label>Ovarios y Anexos</label>
          <input type="text" id="rep-param-ovarios-anexos" value="Sin hallazgos patológicos significativos en anexos." required style="width: 100%;">
        </div>

        <div class="form-group">
          <label>Impresion Diagnóstica</label>
          <textarea id="rep-param-diagnostico" rows="3" placeholder="Ej. Embarazo intrauterino activo de 7 semanas por LCC." required style="width: 100%;">Embarazo intrauterino evolutivo de primer trimestre.</textarea>
        </div>

        <div class="form-group">
          <label>Edad Gestacional Final (Semanas)</label>
          <input type="number" id="rep-param-embarazo-semanas" placeholder="Ej. 7" required>
        </div>

        <div style="display: flex; gap: 15px; margin-top: 1.5rem;">
          <button type="submit" class="btn btn-primary" style="flex: 1;">💾 Grabar y Generar Reporte de Resultados</button>
        </div>
      </form>
    `;
  } else if (type === 'obstetrico_2t_3t') {
    fieldsContainer.innerHTML = `
      <form id="ultrasound-report-form" class="glass-card" style="border-top: 3px solid var(--accent-primary); padding: 1.5rem;">
        <h4 style="color: var(--accent-primary); margin-top: 0; margin-bottom: 1.25rem;">Parámetros de Ultrasonido Obstétrico II y III Trimestre</h4>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Fecha de Estudio</label>
            <input type="date" id="rep-date" value="${currentDate}" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Frecuencia del Transductor (MHz)</label>
            <input type="text" id="rep-param-transducer" value="3.5" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Diámetro Biparietal (DBP - cm)</label>
            <input type="number" step="0.1" id="rep-param-dbp" placeholder="Ej. 7.5" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>DBP para (semanas)</label>
            <input type="number" id="rep-param-dbp-semanas" placeholder="Ej. 30" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Circunferencia Abdominal (CA - cm)</label>
            <input type="number" step="0.1" id="rep-param-ca" placeholder="Ej. 26.1" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>CA para (semanas)</label>
            <input type="number" id="rep-param-ca-semanas" placeholder="Ej. 30" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Longitud Femoral (LF - cm)</label>
            <input type="number" step="0.1" id="rep-param-lf" placeholder="Ej. 5.8" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>LF para (semanas)</label>
            <input type="number" id="rep-param-lf-semanas" placeholder="Ej. 30" required>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Placenta Corpórea</label>
            <input type="text" id="rep-param-placenta-corporea" value="Corpórea posterior" required style="width: 100%;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Grado de Placenta</label>
            <select id="rep-param-placenta-grado" style="width:100%; padding:8px; background:var(--bg-card); color:var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
              <option value="I">GRADO I</option>
              <option value="II">GRADO II</option>
              <option value="III">GRADO III</option>
              <option value="0">GRADO 0</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 1.25rem;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Líquido Amniótico en bolsa única mayor a (cc)</label>
            <input type="number" id="rep-param-liquido" placeholder="Ej. 140" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Peso Fetal Aproximado (ONZAS)</label>
            <input type="number" id="rep-param-peso" placeholder="Ej. 52" required>
          </div>
        </div>

        <div class="form-group">
          <label>Fecha Probable de Parto (FPP)</label>
          <input type="text" id="rep-param-fpp" placeholder="Ej. 20 de Octubre de 2026" required style="width:100%;">
        </div>

        <div class="form-group">
          <label>Impresion Diagnóstica</label>
          <textarea id="rep-param-diagnostico" rows="3" placeholder="Ej. Embarazo activo de 30 semanas de gestación." required style="width: 100%;">Embarazo activo de II/III trimestre evolutivo.</textarea>
        </div>

        <div class="form-group">
          <label>Edad Gestacional Final (Semanas)</label>
          <input type="number" id="rep-param-embarazo-semanas" placeholder="Ej. 30" required>
        </div>

        <div style="display: flex; gap: 15px; margin-top: 1.5rem;">
          <button type="submit" class="btn btn-primary" style="flex: 1;">💾 Grabar y Generar Reporte de Resultados</button>
        </div>
      </form>
    `;
  }

  // Bind del envío del formulario
  const form = document.getElementById('ultrasound-report-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const docName = document.getElementById('rep-doctor-name').value.trim();
      const docLicense = document.getElementById('rep-doctor-license').value.trim();
      const reportDate = document.getElementById('rep-date').value;

      if (!docName || !docLicense) {
        alert("Debe ingresar el nombre del médico informante y su colegiado.");
        return;
      }

      const reportData = {};
      if (type === 'pelvico') {
        reportData.transducer = document.getElementById('rep-param-transducer').value;
        reportData.uteroDesc = document.getElementById('rep-param-utero-desc').value;
        reportData.uteroLong = parseFloat(document.getElementById('rep-param-utero-long').value) || 0;
        reportData.uteroTrans = parseFloat(document.getElementById('rep-param-utero-trans').value) || 0;
        reportData.uteroAncho = parseFloat(document.getElementById('rep-param-utero-ancho').value) || 0;
        reportData.endometrioDesc = document.getElementById('rep-param-endometrio-desc').value;
        reportData.endometrioEspesor = parseFloat(document.getElementById('rep-param-endometrio-espesor').value) || 0;
        reportData.odDesc = document.getElementById('rep-param-od-desc').value;
        reportData.odLong = parseFloat(document.getElementById('rep-param-od-long').value) || 0;
        reportData.odTrans = parseFloat(document.getElementById('rep-param-od-trans').value) || 0;
        reportData.odAncho = parseFloat(document.getElementById('rep-param-od-ancho').value) || 0;
        reportData.oiDesc = document.getElementById('rep-param-oi-desc').value;
        reportData.oiLong = parseFloat(document.getElementById('rep-param-oi-long').value) || 0;
        reportData.oiTrans = parseFloat(document.getElementById('rep-param-oi-trans').value) || 0;
        reportData.oiAncho = parseFloat(document.getElementById('rep-param-oi-ancho').value) || 0;
        reportData.diagnostico = document.getElementById('rep-param-diagnostico').value;
        reportData.recomendaciones = document.getElementById('rep-param-recomendaciones').value;
      } else if (type === 'obstetrico_1t') {
        reportData.transducer = document.getElementById('rep-param-transducer').value;
        reportData.sg = parseFloat(document.getElementById('rep-param-sg').value) || 0;
        reportData.sgSemanas = parseInt(document.getElementById('rep-param-sg-semanas').value) || 0;
        reportData.lcc = parseFloat(document.getElementById('rep-param-lcc').value) || 0;
        reportData.lccSemanas = parseInt(document.getElementById('rep-param-lcc-semanas').value) || 0;
        reportData.fcf = parseInt(document.getElementById('rep-param-fcf').value) || 0;
        reportData.actividad = document.getElementById('rep-param-actividad').value;
        reportData.situacion = document.getElementById('rep-param-situacion').value;
        reportData.reaccion = document.getElementById('rep-param-reaccion').value;
        reportData.ovariosAnexos = document.getElementById('rep-param-ovarios-anexos').value;
        reportData.diagnostico = document.getElementById('rep-param-diagnostico').value;
        reportData.embarazoSemanas = parseInt(document.getElementById('rep-param-embarazo-semanas').value) || 0;
      } else if (type === 'obstetrico_2t_3t') {
        reportData.transducer = document.getElementById('rep-param-transducer').value;
        reportData.dbp = parseFloat(document.getElementById('rep-param-dbp').value) || 0;
        reportData.dbpSemanas = parseInt(document.getElementById('rep-param-dbp-semanas').value) || 0;
        reportData.ca = parseFloat(document.getElementById('rep-param-ca').value) || 0;
        reportData.caSemanas = parseInt(document.getElementById('rep-param-ca-semanas').value) || 0;
        reportData.lf = parseFloat(document.getElementById('rep-param-lf').value) || 0;
        reportData.lfSemanas = parseInt(document.getElementById('rep-param-lf-semanas').value) || 0;
        reportData.placentaCorporea = document.getElementById('rep-param-placenta-corporea').value;
        reportData.placentaGrado = document.getElementById('rep-param-placenta-grado').value;
        reportData.liquido = parseInt(document.getElementById('rep-param-liquido').value) || 0;
        reportData.peso = parseInt(document.getElementById('rep-param-peso').value) || 0;
        reportData.fpp = document.getElementById('rep-param-fpp').value;
        reportData.diagnostico = document.getElementById('rep-param-diagnostico').value;
        reportData.embarazoSemanas = parseInt(document.getElementById('rep-param-embarazo-semanas').value) || 0;
      }

      const stateObj = getAppState();
      const pObj = stateObj.patients.find(p => p.id === patient.id);
      if (pObj) {
        pObj.imagingReports = pObj.imagingReports || [];
        const newReport = {
          id: 'rep-' + Date.now(),
          date: reportDate + 'T12:00:00Z',
          type,
          typeName: type === 'pelvico' ? 'Ultrasonido Pélvico' : (type === 'obstetrico_1t' ? 'Ultrasonido Obstétrico I Trimestre' : 'Ultrasonido Obstétrico II y III Trimestre'),
          doctorName: docName,
          doctorLicense: docLicense,
          data: reportData
        };

        pObj.imagingReports.unshift(newReport);
        await saveAppState(stateObj);
        alert("💾 Informe de ultrasonido grabado exitosamente.");
        
        patient.imagingReports = pObj.imagingReports;
        renderReportHistory(patient);
        
        // Reset del selector
        document.getElementById('rep-ultrasound-type').value = '';
        fieldsContainer.innerHTML = '';

        // Auto imprimir inmediatamente
        showUltrasoundPrintWindow(patient, newReport);
      }
    });
  }
}

export function showUltrasoundPrintWindow(patient, report) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Por favor, permite las ventanas emergentes (popups) para poder imprimir el informe.");
    return;
  }

  const dob = new Date(patient.birthdate);
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  const age = Math.abs(ageDt.getUTCFullYear() - 1970);

  const d = report.data;
  let reportBodyHtml = '';

  if (report.type === 'pelvico') {
    reportBodyHtml = `
      <div style="position: relative; min-height: 520px; margin-top: 20px;">
        <!-- Ilustración de fondo (marca de agua) -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 440px; z-index: -1; opacity: 0.08;">
          <img src="/usg_uterus.jpg" style="width: 100%; object-fit: contain;">
        </div>

        <p style="font-size: 1.05rem; margin-bottom: 25px;">
          Con Ultrasonido en escala de grises con transductor <strong>${d.transducer || '5.0'} MHz</strong> se visualiza:
        </p>

        <div style="font-size: 1.15rem; line-height: 2.2; text-align: justify; font-family: 'Times New Roman', Times, serif;">
          <p><strong>Útero:</strong> ${d.uteroDesc || 'N/A'}</p>
          <p>
            <strong>Midiendo Longitud:</strong> <span class="val-underline">${d.uteroLong || '___'}</span> cm, 
            <strong>transversalmente:</strong> <span class="val-underline">${d.uteroTrans || '___'}</span> cm, 
            <strong>ancho:</strong> <span class="val-underline">${d.uteroAncho || '___'}</span> cm.
          </p>
          <p><strong>Con endometrio:</strong> ${d.endometrioDesc || 'N/A'} <strong>mide:</strong> <span class="val-underline">${d.endometrioEspesor || '___'}</span> mm.</p>
          
          <p style="margin-top: 15px;">
            <strong>Ovario derecho:</strong> ${d.odDesc || 'N/A'} 
            <strong>midiendo:</strong> <span class="val-underline">${d.odLong || '___'}</span> cm X 
            <span class="val-underline">${d.odTrans || '___'}</span> cm X 
            <span class="val-underline">${d.odAncho || '___'}</span> cm.
          </p>
          
          <p>
            <strong>Ovario izquierdo:</strong> ${d.oiDesc || 'N/A'} 
            <strong>midiendo:</strong> <span class="val-underline">${d.oiLong || '___'}</span> cm X 
            <span class="val-underline">${d.oiTrans || '___'}</span> cm X 
            <span class="val-underline">${d.oiAncho || '___'}</span> cm.
          </p>
          
          <div style="margin-top: 35px; border-top: 1px solid #ccc; padding-top: 15px;">
            <p style="margin: 0 0 5px 0;"><strong>IMPRESIÓN DIAGNÓSTICA:</strong></p>
            <p style="font-weight: bold; font-size: 1.2rem; white-space: pre-wrap; padding-left: 10px; border-left: 3px solid #1e3a8a; margin: 5px 0;">${d.diagnostico || 'Sin particularidades.'}</p>
          </div>

          ${d.recomendaciones ? `
            <div style="margin-top: 20px;">
              <p style="margin: 0 0 5px 0;"><strong>Recomendaciones:</strong></p>
              <p style="font-style: italic; white-space: pre-wrap; padding-left: 10px; margin: 5px 0;">${d.recomendaciones}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (report.type === 'obstetrico_1t') {
    reportBodyHtml = `
      <div style="position: relative; min-height: 520px; margin-top: 20px; display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 20px;">
        <div style="font-size: 1.15rem; line-height: 2.3; text-align: justify; font-family: 'Times New Roman', Times, serif;">
          <p style="font-size: 1.05rem; margin-bottom: 25px; font-family: Arial, sans-serif;">
            Ultrasonido en escala de grises con transductor <strong>${d.transducer || '6.5'} MHz</strong> se visualiza:
          </p>
          
          <p><strong>Saco Gestacional en:</strong> <span class="val-underline">${d.sg || '___'}</span> mm para <span class="val-underline">${d.sgSemanas || '___'}</span> semanas.</p>
          <p><strong>Longitud Céfalo-Caudal de:</strong> <span class="val-underline">${d.lcc || '___'}</span> mm para <span class="val-underline">${d.lccSemanas || '___'}</span> semanas.</p>
          <p><strong>Frecuencia Cardíaca Fetal:</strong> <span class="val-underline">${d.fcf || '___'}</span> lpm.</p>
          <p><strong>Actividad y Movimiento Fetal:</strong> <span class="val-underline">${d.actividad || 'Presente'}</span>.</p>
          <p><strong>Situación del Saco:</strong> ${d.situacion || 'Intrauterino'}</p>
          <p><strong>Reacción Decidual:</strong> ${d.reaccion || 'Adecuada'}</p>
          <p><strong>Ovarios y Anexos:</strong> ${d.ovariosAnexos || 'Sin masas o anomalías visibles.'}</p>
          
          <div style="margin-top: 35px; border-top: 1px solid #ccc; padding-top: 15px;">
            <p style="margin: 0 0 5px 0;"><strong>IMPRESIÓN DIAGNÓSTICA:</strong></p>
            <p style="font-weight: bold; font-size: 1.2rem; white-space: pre-wrap; padding-left: 10px; border-left: 3px solid #1e3a8a; margin: 5px 0;">${d.diagnostico || ''}</p>
          </div>
          
          <p style="margin-top: 25px; font-weight: bold; font-size: 1.25rem; color: #1e3a8a; text-transform: uppercase; font-family: Arial, sans-serif;">
            EMBARAZO DE: <span class="val-underline">${d.embarazoSemanas || '___'}</span> SEMANAS
          </p>
        </div>
        
        <div style="display: flex; align-items: flex-end; justify-content: center; padding-bottom: 50px;">
          <img src="/usg_pregnant.jpg" style="width: 100%; max-width: 250px; opacity: 0.9; object-fit: contain;">
        </div>
      </div>
    `;
  } else if (report.type === 'obstetrico_2t_3t') {
    reportBodyHtml = `
      <div style="position: relative; min-height: 520px; margin-top: 20px; display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 20px;">
        <div style="font-size: 1.15rem; line-height: 2.3; text-align: justify; font-family: 'Times New Roman', Times, serif;">
          <p style="font-size: 1.05rem; margin-bottom: 25px; font-family: Arial, sans-serif;">
            Ultrasonido en escala de grises con transductor <strong>${d.transducer || '3.5'} MHz</strong> se visualiza:
          </p>
          
          <p><strong>Diámetro Biparietal en:</strong> <span class="val-underline">${d.dbp || '___'}</span> cm para <span class="val-underline">${d.dbpSemanas || '___'}</span> semanas.</p>
          <p><strong>C. abdominal en:</strong> <span class="val-underline">${d.ca || '___'}</span> cm para <span class="val-underline">${d.caSemanas || '___'}</span> semanas.</p>
          <p><strong>L. femoral de:</strong> <span class="val-underline">${d.lf || '___'}</span> cm para <span class="val-underline">${d.lfSemanas || '___'}</span> semanas.</p>
          <p><strong>Placenta corpórea:</strong> <span class="val-underline">${d.placentaCorporea || 'posterior'}</span> <strong>GRADO:</strong> <span class="val-underline">${d.placentaGrado || 'I'}</span>.</p>
          <p><strong>Líquido amniótico en bolsa única mayor a:</strong> <span class="val-underline">${d.liquido || '___'}</span> cc.</p>
          <p><strong>Peso fetal aproximado:</strong> <span class="val-underline">${d.peso || '___'}</span> ONZAS.</p>
          <p><strong>Fecha probable de parto:</strong> <span class="val-underline">${d.fpp || '___'}</span></p>
          
          <div style="margin-top: 35px; border-top: 1px solid #ccc; padding-top: 15px;">
            <p style="margin: 0 0 5px 0;"><strong>IMPRESIÓN DIAGNÓSTICA:</strong></p>
            <p style="font-weight: bold; font-size: 1.2rem; white-space: pre-wrap; padding-left: 10px; border-left: 3px solid #1e3a8a; margin: 5px 0;">${d.diagnostico || ''}</p>
          </div>
          
          <p style="margin-top: 25px; font-weight: bold; font-size: 1.25rem; color: #1e3a8a; text-transform: uppercase; font-family: Arial, sans-serif;">
            EMBARAZO DE: <span class="val-underline">${d.embarazoSemanas || '___'}</span> SEMANAS
          </p>
        </div>
        
        <div style="display: flex; align-items: flex-end; justify-content: center; padding-bottom: 50px;">
          <img src="/usg_pregnant.jpg" style="width: 100%; max-width: 250px; opacity: 0.9; object-fit: contain;">
        </div>
      </div>
    `;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Ultrasonido - ${report.typeName}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #111;
          margin: 0;
          padding: 40px;
          line-height: 1.5;
        }
        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #1e3a8a;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .clinic-name {
          font-size: 1.6rem;
          font-weight: 800;
          color: #1e3a8a;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .clinic-sub {
          font-size: 0.9rem;
          font-weight: bold;
          color: #0284c7;
          margin: 2px 0 0 0;
        }
        .clinic-details {
          text-align: right;
          font-size: 0.85rem;
          color: #475569;
          line-height: 1.4;
        }
        .title-box {
          text-align: center;
          margin-top: 15px;
          margin-bottom: 20px;
        }
        .title {
          font-size: 1.35rem;
          font-weight: bold;
          text-transform: uppercase;
          color: #1e3a8a;
          letter-spacing: 1px;
          margin: 0;
        }
        .patient-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px 15px;
          margin-bottom: 20px;
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 15px;
          font-size: 0.9rem;
        }
        .patient-col p {
          margin: 3px 0;
        }
        .val-underline {
          border-bottom: 1px solid #111;
          padding-left: 10px;
          padding-right: 10px;
          font-weight: bold;
        }
        .footer-sig {
          margin-top: 60px;
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
        .footer-advertisement {
          margin-top: 40px;
          padding: 12px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          font-size: 0.78rem;
          color: #475569;
          text-align: center;
          line-height: 1.4;
          background-color: #f8fafc;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
          .patient-card { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .footer-advertisement { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; text-align: right;">
        <button onclick="window.print();" style="padding: 10px 20px; background-color: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.95rem;">
          🖨️ Imprimir Reporte
        </button>
      </div>

      <div class="header-container">
        <div>
          <h1 class="clinic-name">Hospital Privado Multimédica</h1>
          <p class="clinic-sub">Barrio Lomas del Norte | Emergencias las 24 horas</p>
        </div>
        <div class="clinic-details">
          📞 CEL: 3164-0152<br>
          Atención Médica Profesional
        </div>
      </div>

      <div class="title-box">
        <h2 class="title">${report.typeName}</h2>
      </div>

      <div class="patient-card">
        <div class="patient-col">
          <p><strong>NOMBRE DE LA PACIENTE:</strong> ${patient.name}</p>
          <p><strong>EDAD:</strong> ${age} AÑOS</p>
        </div>
        <div class="patient-col" style="text-align: right;">
          <p><strong>FECHA:</strong> ${new Date(report.date).toLocaleDateString('es-GT')}</p>
          <p><strong>Expediente:</strong> ${patient.id}</p>
        </div>
      </div>

      ${reportBodyHtml}

      <div class="footer-sig">
        <div class="line"></div>
        <div style="font-weight: bold; font-size: 0.95rem;">Dr(a). ${report.doctorName}</div>
        <div style="font-size: 0.8rem; color: #555;">Colegiado Activo No. ${report.doctorLicense}</div>
      </div>

      ${report.type === 'pelvico' ? `
        <div class="footer-advertisement">
          <strong>DR. ALONSO ELIAS PA.</strong> les ofrecemos servicios de control prenatal, ultrasonido pélvico y obstétrico, a nivel abdominal y/o Endo vaginal, Papanicolaou, cirugías obstétricas y ginecológicas, consulta general, infertilidad, enfermedades pre cancerígenas de la mujer, enfermedad de transmisión sexual.
        </div>
      ` : ''}

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

export function showOrderPreviewModal(patient, order) {
  window.showOrderPreviewModal = showOrderPreviewModal;
  const modal = document.getElementById('prescription-print-modal');
  const previewContainer = document.getElementById('prescription-preview-content');
  const printActionBtn = document.getElementById('btn-print-action');
  
  if (!modal || !previewContainer || !printActionBtn) return;

  const db = JSON.parse(localStorage.getItem('medflow_db')) || {};
  const clinicInfo = db.clinicInfo || {};
  let logoImgHtml = '🏥';
  if (clinicInfo.logoData) {
    logoImgHtml = `<img src="${clinicInfo.logoData}" class="prescription-preview-logo-img" style="max-height: 50px; object-fit: contain;">`;
  }

  const dob = new Date(patient.birthdate);
  const diffMs = Date.now() - dob.getTime();
  const ageDt = new Date(diffMs);
  const age = Math.abs(ageDt.getUTCFullYear() - 1970);

  previewContainer.innerHTML = `
    <div class="prescription-preview-box" style="background: white; color: black; padding: 2rem; border-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); font-family: sans-serif;">
      <!-- Encabezado Oficial Institucional (LUGAMED 2.0) -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; font-family: Arial, Helvetica, sans-serif;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${logoImgHtml}
          <div>
            <h2 style="margin: 0; font-size: 1.35rem; font-weight: 800; color: #1e3a8a; font-family: Arial, sans-serif;">${clinicInfo.name || 'Centro Médico Altamira'}</h2>
            <div style="font-size: 0.85rem; font-weight: 700; color: #0284c7; margin-top: 3px;">Atención Médica Profesional — LUGAMED 2.0</div>
          </div>
        </div>
        <div style="text-align: right; font-size: 0.82rem; color: #475569; line-height: 1.4; font-family: Arial, sans-serif;">
          📍 ${clinicInfo.address || 'Guatemala'}<br>
          📞 Teléfono: ${clinicInfo.phone || 'N/A'}<br>
          ✉️ Email: ${clinicInfo.email || 'N/A'}
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 1.5rem;">
        <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Informe de Resultados de Imagenología</h2>
        <span style="font-size: 0.82rem; color: #0284c7; font-weight: 600;">Fecha Solicitud: ${new Date(order.date).toLocaleString()}</span>
      </div>

      <div class="prescription-preview-patient-info" style="background: #f4f6f8; padding: 12px; border-radius: 6px; margin-bottom: 1.5rem; display: grid; grid-template-columns: 2fr 1fr; gap: 10px; font-size: 0.85rem; text-align: left;">
        <div>
          <p style="margin: 2px 0;"><strong>Paciente:</strong> ${patient.name}</p>
          <p style="margin: 2px 0;"><strong>Género:</strong> ${patient.gender} | <strong>Edad:</strong> ${age} años</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 2px 0;"><strong>ID Orden:</strong> ${order.id}</p>
          <p style="margin: 2px 0;"><strong>Teléfono:</strong> ${patient.telephone}</p>
        </div>
      </div>

      <table class="prescription-preview-table" style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
        <thead>
          <tr style="border-bottom: 2px solid #333;">
            <th style="text-align: left; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #111;">Estudio Solicitado</th>
            <th style="text-align: left; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #111;">Indicación / Preparación Especial</th>
          </tr>
        </thead>
        <tbody>
          ${order.studies.map(s => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 12px; font-size: 0.85rem; color: #111; text-align: left; font-weight: 600;">${s.name}</td>
              <td style="padding: 10px 12px; font-size: 0.85rem; color: #555; text-align: left; font-style: italic;">${s.notes || 'Ninguna'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${order.generalNotes ? `
        <div style="margin-top: 1.5rem; border-top: 1px dashed #ccc; padding-top: 10px; text-align: left;">
          <strong style="color: #000; font-size: 0.9rem;">Observaciones Médicas Generales:</strong>
          <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #333; white-space: pre-wrap; line-height: 1.4;">${order.generalNotes}</p>
        </div>
      ` : ''}

      <div class="prescription-preview-footer" style="margin-top: 3.5rem;">
        <div class="prescription-preview-signature-line"></div>
        <div class="prescription-preview-doctor-sign">${order.doctorName}</div>
        <div class="prescription-preview-license">Colegiado Activo No. ${order.doctorLicense}</div>
      </div>
    </div>
  `;

  printActionBtn.onclick = () => {
    window.print();
  };

  modal.style.display = 'flex';
}

window.showOrderPreviewModal = showOrderPreviewModal;
