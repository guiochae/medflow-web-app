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
  { name: "Rayos X (Rx) de Rodilla AP y Lateral", category: "Rayos X (Rx)" },
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
  const ageDt = patient.birthDate ? new Date(patient.birthDate) : null;
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
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
        ${vitalsGridHtml}
      </div>
    </div>
  `;
}

export function renderImagenologia(container) {
  const state = getAppState();
  const activePatientId = getActivePatientId();
  const patient = state.patients.find(p => p.id === activePatientId);
  const doctors = state.users.filter(u => {
    const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return r === 'medico' || r === 'medico 1' || r === 'medico 2' || r === 'medico 3';
  });

  container.innerHTML = `
    <!-- Banner de Paciente en la Parte Superior -->
    <div id="img-patient-banner-area"></div>

    <!-- Layout de doble columna -->
    <div class="grid-prescription">
      <!-- Columna Principal (Creador de Orden) -->
      <div id="img-builder-area">
        <!-- Se llena con renderImgBuilder -->
      </div>
      
      <!-- Barra lateral de Pacientes e Historial -->
      <div class="glass-card search-sidebar">
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
      </div>
    </div>
  `;

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
  if (historySection) historySection.style.display = 'block';
  if (orderSection) orderSection.style.display = 'block';

  renderConsultationHistory(patient);
  renderOrderHistory(patient);
  renderImgBuilder(patient, doctors);
}

function showPlaceholder() {
  const container = document.getElementById('img-builder-area');
  if (!container) return;

  container.innerHTML = `
    <div class="glass-card" style="text-align: center; padding: 4rem 2rem;">
      <span style="font-size: 3rem;">🖼️</span>
      <h2 style="margin-top: 1rem;">Selecciona un paciente</h2>
      <p style="color: var(--text-muted); margin-top: 0.5rem;">Utiliza la barra lateral para buscar y seleccionar al paciente para el cual emitirá la orden de estudios de imagenología.</p>
    </div>
  `;

  const banner = document.getElementById('img-patient-banner-area');
  if (banner) banner.innerHTML = '';

  const historySection = document.getElementById('img-patient-history-section');
  const orderSection = document.getElementById('img-order-history-area');
  if (historySection) historySection.style.display = 'none';
  if (orderSection) orderSection.style.display = 'none';
}

function renderConsultationHistory(patient) {
  const container = document.getElementById('img-consultation-history-list');
  if (!container) return;

  container.innerHTML = '';

  if (!patient.consultations || patient.consultations.length === 0) {
    container.innerHTML = '<li style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">Sin consultas registradas</li>';
    return;
  }

  patient.consultations.forEach(c => {
    const li = document.createElement('li');
    li.className = 'history-card';
    let dateFormatted = c.date || 'Reciente';
    try {
      if (c.date && !isNaN(new Date(c.date).getTime())) {
        dateFormatted = new Date(c.date).toLocaleDateString('es-GT');
      }
    } catch(e){}

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
    const catalog = getAppState().imagingStudies || [];
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
          <div class="checklist-grid">
            ${groupStudies.map(study => `
              <div class="checklist-item-card" data-name="${study.name}">
                <input type="checkbox" id="chk-img-${study.name}" value="${study.name}">
                <span class="checklist-item-label">${study.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });
    listHtml += `</div>`;
    
    checklistBody.innerHTML = listHtml;

    // Configurar la barra de búsqueda del checklist
    const searchInput = document.getElementById('checklist-search-input');
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = function() {
        const query = String(this.value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const groups = checklistBody.querySelectorAll('.checklist-group');
        groups.forEach(group => {
          let visibleInGroup = 0;
          const cards = group.querySelectorAll('.checklist-item-card');
          cards.forEach(card => {
            const studyName = String(card.getAttribute('data-name')).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (studyName.includes(query)) {
              card.style.display = 'flex';
              visibleInGroup++;
            } else {
              card.style.display = 'none';
            }
          });
          
          if (visibleInGroup > 0) {
            group.style.display = 'block';
          } else {
            group.style.display = 'none';
          }
        });
      };
    }

    // Vincular clic en la tarjeta entera para seleccionar
    const cards = checklistBody.querySelectorAll('.checklist-item-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        if (checkbox.checked) {
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

  btnSaveExternal.addEventListener('click', () => {
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
    const doctorObj = stateObj.users.find(u => u.id === doctorId);
    const generalNotes = document.getElementById('o-general-notes').value;

    const newOrder = {
      id: 'o-' + Date.now(),
      date: new Date().toISOString(),
      doctorName: doctorObj.name,
      doctorLicense: doctorObj.license || 'N/A',
      studies: [...currentOrderImaging],
      generalNotes: generalNotes
    };

    const patientObj = stateObj.patients.find(p => p.id === patient.id);
    if (!patientObj.studyOrders) patientObj.studyOrders = [];
    patientObj.studyOrders.unshift(newOrder);
    saveAppState(stateObj);

    showOrderPreviewModal(patientObj, newOrder);

    currentOrderImaging = [];
    docSelect.value = '';
    document.getElementById('o-general-notes').value = '';
    renderExternalStudiesTable();
    renderOrderHistory(patientObj);
  });

  renderExternalStudiesTable();
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
