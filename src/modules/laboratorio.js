// src/modules/laboratorio.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId } from '../main.js';

// Listas temporales de estudios de laboratorio agregados en la orden externa activa
let currentOrderLabs = [];

// Catálogo de Estudios y Parámetros para Laboratorio
const LAB_STUDIES_CATALOG = [
  {
    name: "Hemograma Completo",
    category: "Hematología y Coagulación",
    parameters: [
      { name: "Eritrocitos", unit: "millones/µL", normal: "4.5 - 5.9" },
      { name: "Hemoglobina", unit: "g/dL", normal: "13.5 - 17.5" },
      { name: "Hematocrito", unit: "%", normal: "41% - 50%" },
      { name: "Leucocitos", unit: "/µL", normal: "4,500 - 11,000" },
      { name: "Plaquetas", unit: "/µL", normal: "150,000 - 400,000" }
    ]
  },
  {
    name: "Tiempos de Coagulación (TP, TPT)",
    category: "Hematología y Coagulación",
    parameters: [
      { name: "Tiempo de Protrombina (TP)", unit: "segundos", normal: "11.0 - 13.5" },
      { name: "Tiempo Parcial de Tromboplastina (TPT)", unit: "segundos", normal: "25.0 - 35.0" }
    ]
  },
  {
    name: "Grupo Sanguíneo y Factor Rh",
    category: "Hematología y Coagulación",
    parameters: [
      { name: "Grupo Sanguíneo", unit: "", normal: "A / B / AB / O" },
      { name: "Factor Rh", unit: "", normal: "Positivo / Negativo" }
    ]
  },
  {
    name: "Glucosa en Ayunas",
    category: "Química Clínica y Metabólica",
    parameters: [
      { name: "Glucosa", unit: "mg/dL", normal: "70 - 100" }
    ]
  },
  {
    name: "Creatinina en Suero",
    category: "Química Clínica y Metabólica",
    parameters: [
      { name: "Creatinina", unit: "mg/dL", normal: "0.7 - 1.3" }
    ]
  },
  {
    name: "Nitrógeno de Urea (BUN)",
    category: "Química Clínica y Metabólica",
    parameters: [
      { name: "BUN", unit: "mg/dL", normal: "7 - 20" }
    ]
  },
  {
    name: "Perfil Lipídico",
    category: "Química Clínica y Metabólica",
    parameters: [
      { name: "Colesterol Total", unit: "mg/dL", normal: "< 200" },
      { name: "Triglicéridos", unit: "mg/dL", normal: "< 150" },
      { name: "Colesterol HDL", unit: "mg/dL", normal: "> 40" },
      { name: "Colesterol LDL", unit: "mg/dL", normal: "< 100" }
    ]
  },
  {
    name: "Perfil Hepático",
    category: "Química Clínica y Metabólica",
    parameters: [
      { name: "Transaminasa Glutámico Oxalacética (AST/GOT)", unit: "U/L", normal: "5 - 40" },
      { name: "Transaminasa Glutámico Pirúvica (ALT/GPT)", unit: "U/L", normal: "7 - 56" },
      { name: "Fosfatasa Alcalina", unit: "U/L", normal: "44 - 147" },
      { name: "Bilirrubina Total", unit: "mg/dL", normal: "0.1 - 1.2" }
    ]
  },
  {
    name: "Perfil Tiroideo",
    category: "Química Clínica y Metabólica",
    parameters: [
      { name: "Hormona Estimulante de la Tiroides (TSH)", unit: "µIU/mL", normal: "0.4 - 4.0" },
      { name: "T4 Libre", unit: "ng/dL", normal: "0.8 - 1.8" },
      { name: "T3 Total", unit: "ng/dL", normal: "80 - 200" }
    ]
  },
  {
    name: "Hemoglobina Glicosilada (HbA1c)",
    category: "Química Clínica y Metabólica",
    parameters: [
      { name: "HbA1c", unit: "%", normal: "< 5.7%" }
    ]
  },
  {
    name: "Ácido Úrico",
    category: "Química Clínica y Metabólica",
    parameters: [
      { name: "Ácido Úrico", unit: "mg/dL", normal: "3.5 - 7.2" }
    ]
  },
  {
    name: "Proteína C Reactiva (PCR)",
    category: "Inmunología y Pruebas Especiales",
    parameters: [
      { name: "PCR", unit: "mg/L", normal: "< 5.0" }
    ]
  },
  {
    name: "Factor Reumatoideo (FR)",
    category: "Inmunología y Pruebas Especiales",
    parameters: [
      { name: "Factor Reumatoideo", unit: "IU/mL", normal: "< 14" }
    ]
  },
  {
    name: "VDRL / RPR",
    category: "Inmunología y Pruebas Especiales",
    parameters: [
      { name: "VDRL/RPR", unit: "", normal: "No Reactivo" }
    ]
  },
  {
    name: "Prueba de Embarazo en Sangre (Beta-hCG)",
    category: "Inmunología y Pruebas Especiales",
    parameters: [
      { name: "Beta-hCG Cuantitativa", unit: "mIU/mL", normal: "Negativo (< 5)" }
    ]
  },
  {
    name: "Examen General de Orina (EGO)",
    category: "Coproanálisis y Uroanálisis",
    parameters: [
      { name: "Aspecto", unit: "", normal: "Transparente" },
      { name: "Color", unit: "", normal: "Amarillo Claro" },
      { name: "Densidad", unit: "", normal: "1.005 - 1.030" },
      { name: "pH", unit: "", normal: "4.6 - 8.0" },
      { name: "Leucocitos", unit: "/campo", normal: "0 - 5" },
      { name: "Proteínas", unit: "", normal: "Negativo" },
      { name: "Glucosa", unit: "", normal: "Negativo" }
    ]
  },
  {
    name: "Coprológico General",
    category: "Coproanálisis y Uroanálisis",
    parameters: [
      { name: "Color", unit: "", normal: "Marrón" },
      { name: "Consistencia", unit: "", normal: "Formada" },
      { name: "Parásitos", unit: "", normal: "No se observan" },
      { name: "Flora bacteriana", unit: "", normal: "Normal" }
    ]
  },
  {
    name: "Sangre Oculta en Heces",
    category: "Coproanálisis y Uroanálisis",
    parameters: [
      { name: "Sangre Oculta en Heces", unit: "", normal: "Negativo" }
    ]
  },
  {
    name: "Helicobacter pylori en heces",
    category: "Coproanálisis y Uroanálisis",
    parameters: [
      { name: "H. Pylori en Heces", unit: "", normal: "Negativo" }
    ]
  },
  {
    name: "Urocultivo",
    category: "Microbiología",
    parameters: [
      { name: "Cultivo", unit: "", normal: "Sin crecimiento bacteriano" },
      { name: "Recuento de Colonias", unit: "UFC/mL", normal: "N/A" },
      { name: "Antibiograma", unit: "", normal: "N/A" }
    ]
  },
  {
    name: "Coprocultivo",
    category: "Microbiología",
    parameters: [
      { name: "Cultivo en Heces", unit: "", normal: "Negativo para enteropatógenos" }
    ]
  },
  {
    name: "Frotis Faríngeo con Cultivo",
    category: "Microbiología",
    parameters: [
      { name: "Frotis Directo", unit: "", normal: "Negativo" },
      { name: "Cultivo Faríngeo", unit: "", normal: "Normal Flora" }
    ]
  }
];

export function renderLaboratorio(container) {
  const state = getAppState();
  const activePatientId = getActivePatientId();
  const patient = state.patients.find(p => p.id === activePatientId);
  const doctors = state.users.filter(u => u.role === 'medico');

  container.innerHTML = `
    <!-- Banner de Paciente en la Parte Superior -->
    <div id="lab-patient-banner-area"></div>

    <!-- Layout de doble columna -->
    <div class="grid-prescription">
      <!-- Columna Principal (Creador de Orden) -->
      <div id="lab-builder-area">
        <!-- Se llena con renderLabBuilder -->
      </div>
      
      <!-- Barra lateral de Pacientes e Historial -->
      <div class="glass-card search-sidebar">
        <h3>Seleccionar Paciente</h3>
        <div class="form-group" style="margin-top: 5px; margin-bottom: 10px;">
          <input type="text" id="lab-patient-search" placeholder="🔍 Buscar paciente...">
        </div>
        <ul class="patient-list" id="lab-patient-list" style="max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem;">
          <!-- Todos los pacientes se cargan aquí -->
        </ul>

        <div id="lab-patient-history-section" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
          <h3>Consultas Registradas</h3>
          <ul class="history-sidebar-list" id="lab-consultation-history-list" style="margin-top: 10px; max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem;">
            <!-- Cargar historial del paciente seleccionado -->
          </ul>
        </div>

        <div id="lab-order-history-area" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
          <!-- Órdenes e Informes Solicitados -->
        </div>
      </div>
    </div>
  `;

  // Bind búsqueda de pacientes
  const searchInput = document.getElementById('lab-patient-search');
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
  const listContainer = document.getElementById('lab-patient-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';
  
  const currentUser = state.currentUser;
  let basePatients = state.patients || [];

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
  const patient = state.patients.find(p => p.id === patientId);
  const doctors = state.users.filter(u => u.role === 'medico');

  setActivePatientId(patientId);
  
  const searchInput = document.getElementById('lab-patient-search');
  renderPatientList(searchInput ? searchInput.value : '');

  if (!patient) {
    showPlaceholder();
    return;
  }

  const dob = new Date(patient.birthdate);
  const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  const banner = document.getElementById('lab-patient-banner-area');
  if (banner) {
    banner.innerHTML = `
      <div class="patient-top-banner glass-card" style="
        margin-bottom: 1.5rem; 
        display: flex; 
        align-items: center; 
        gap: 1.5rem; 
        padding: 1.25rem; 
        border-left: 4px solid var(--accent-primary);
      ">
        <div style="
          background: rgba(0, 242, 254, 0.1); 
          width: 50px; 
          height: 50px; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 1.5rem; 
          color: var(--accent-primary);
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

  const historySection = document.getElementById('lab-patient-history-section');
  const orderSection = document.getElementById('lab-order-history-area');
  if (historySection) historySection.style.display = 'block';
  if (orderSection) orderSection.style.display = 'block';

  renderConsultationHistory(patient);
  renderOrderHistory(patient);
  renderLabBuilder(patient, doctors);
}

function showPlaceholder() {
  const container = document.getElementById('lab-builder-area');
  if (!container) return;

  container.innerHTML = `
    <div class="glass-card" style="text-align: center; padding: 4rem 2rem;">
      <span style="font-size: 3rem;">🔬</span>
      <h2 style="margin-top: 1rem;">Selecciona un paciente</h2>
      <p style="color: var(--text-muted); margin-top: 0.5rem;">Utiliza la barra lateral para buscar y seleccionar al paciente para el cual emitirá la orden o reporte de laboratorio.</p>
    </div>
  `;

  const banner = document.getElementById('lab-patient-banner-area');
  if (banner) banner.innerHTML = '';

  const historySection = document.getElementById('lab-patient-history-section');
  const orderSection = document.getElementById('lab-order-history-area');
  if (historySection) historySection.style.display = 'none';
  if (orderSection) orderSection.style.display = 'none';
}

function renderConsultationHistory(patient) {
  const container = document.getElementById('lab-consultation-history-list');
  if (!container) return;

  container.innerHTML = '';

  if (!patient.consultations || patient.consultations.length === 0) {
    container.innerHTML = '<li style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">Sin consultas registradas</li>';
    return;
  }

  patient.consultations.forEach(c => {
    const li = document.createElement('li');
    li.className = 'history-card';
    const dateFormatted = new Date(c.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
    
    li.innerHTML = `
      <div class="history-card-header">
        <span>${dateFormatted}</span>
        <span>${c.specialty}</span>
      </div>
      <div class="history-card-title">${c.doctor}</div>
      <div class="history-card-body" title="${c.reason}">
        <strong>Motivo:</strong> ${c.reason}
      </div>
    `;
    container.appendChild(li);
  });
}

function renderOrderHistory(patient) {
  const container = document.getElementById('lab-order-history-area');
  if (!container) return;

  const orders = patient.studyOrders || [];
  const labsOrders = orders.filter(o => o.studies.some(s => s.type === 'lab'));

  let ordersListHtml = '';
  if (labsOrders.length === 0) {
    ordersListHtml = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 15px 0;">No hay órdenes externas previas</div>`;
  } else {
    ordersListHtml = `
      <ul style="display: flex; flex-direction: column; gap: 8px; list-style: none;">
        ${labsOrders.map(o => `
          <li class="history-card order-history-card" data-id="${o.id}" style="cursor: pointer;">
            <div class="history-card-header">
              <span>${new Date(o.date).toLocaleDateString()}</span>
              <span style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 600;">🔬 Lab</span>
            </div>
            <div class="history-card-title">${o.doctorName}</div>
            <div class="history-card-body" style="font-size: 0.75rem; color: var(--text-muted);">
              ${o.studies.filter(s => s.type === 'lab').map(s => s.name).join(', ')}
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  container.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <h3 style="font-family: var(--font-heading); margin-bottom: 0.5rem; color: var(--accent-primary); font-size: 1.05rem; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
        Órdenes Externas
      </h3>
      ${ordersListHtml}
    </div>
  `;

  // Bind Clic para reimprimir orden externa
  container.querySelectorAll('.order-history-card').forEach(card => {
    card.addEventListener('click', () => {
      const orderId = card.getAttribute('data-id');
      const orderSelected = orders.find(o => o.id === orderId);
      if (orderSelected) {
        showOrderPreviewModal(patient, orderSelected);
      }
    });
  });
}

function renderLabBuilder(patient, doctors) {
  const container = document.getElementById('lab-builder-area');
  if (!container) return;

  currentOrderLabs = [];

  container.innerHTML = `
    <div class="tabs-container" style="display: flex; gap: 10px; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
      <button class="tab-btn active" id="btn-lab-tab-local" style="
        padding: 10px 18px; 
        background: rgba(0,242,254,0.08); 
        border: 1px solid var(--accent-primary); 
        border-radius: var(--radius-sm); 
        color: var(--text-primary); 
        cursor: pointer; 
        font-weight: 600;
      ">
        🔬 Análisis Propios (Locales)
      </button>
      <button class="tab-btn" id="btn-lab-tab-externos" style="
        padding: 10px 18px; 
        background: transparent; 
        border: 1px solid var(--border-color); 
        border-radius: var(--radius-sm); 
        color: var(--text-muted); 
        cursor: pointer; 
        font-weight: 600;
      ">
        🖼️ Órdenes Externas
      </button>
    </div>

    <!-- PANE LABORATORIO LOCAL -->
    <div id="pane-lab-local" class="tab-pane active" style="display: block;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--accent-primary); font-family: var(--font-heading); margin: 0; font-size: 1.25rem;">🔬 Análisis Clínicos Locales (MedFlow Labs)</h3>
        <button class="btn btn-primary btn-small" id="btn-new-local-lab-order"><span>+</span> Nuevo Estudio Local</button>
      </div>

      <div class="glass-card" style="padding: 1.5rem;">
        <h4 style="margin-bottom: 1rem; color: var(--text-primary); font-family: var(--font-heading);">Estudios Locales en Proceso</h4>
        <div id="local-studies-process-list">
          <!-- Cargar dinámicamente -->
        </div>
      </div>
    </div>

    <!-- PANE ÓRDENES EXTERNAS -->
    <div id="pane-lab-externas" class="tab-pane" style="display: none;">
      <!-- Card del Médico Solicitante -->
      <div class="glass-card" style="margin-bottom: 1.5rem;">
        <div class="form-group" style="max-width: 420px; margin-bottom: 0;">
          <label style="font-weight: 700; color: var(--accent-primary);">Médico Solicitante (Tratante)</label>
          <input type="text" value="${patient.assignedDoctorName || 'Dr. Carlos Mendoza'}" readonly style="background: rgba(255,255,255,0.05); cursor: not-allowed; font-weight: bold; color: var(--accent-primary);">
          <input type="hidden" id="o-doctor" value="${patient.assignedDoctorId || 'u-1'}">
        </div>
      </div>

      <div class="glass-card" style="margin-bottom: 1.5rem; border-top: 3px solid var(--accent-secondary);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h3 style="color: var(--accent-secondary); font-family: var(--font-heading); margin: 0; font-size: 1.2rem;">🔬 Solicitud de Laboratorios Externos</h3>
          <button class="btn btn-secondary btn-small" id="btn-new-external-lab-order"><span>+</span> Seleccionar Laboratorios</button>
        </div>

        <h4 style="margin-bottom: 0.5rem; color: var(--text-primary); font-size: 0.95rem;">Estudios Solicitados en la Orden</h4>
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
          <textarea id="o-general-notes" placeholder="Ej. Favor enviar resultados por correo electrónico..."></textarea>
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
    </div>
  `;

  // --- INTERCAMBIO DE PESTAÑAS ---
  const btnTabLocal = document.getElementById('btn-lab-tab-local');
  const btnTabExternas = document.getElementById('btn-lab-tab-externos');
  const paneLocal = document.getElementById('pane-lab-local');
  const paneExternas = document.getElementById('pane-lab-externas');

  btnTabLocal.addEventListener('click', () => {
    btnTabLocal.style.background = 'rgba(0,242,254,0.08)';
    btnTabLocal.style.borderColor = 'var(--accent-primary)';
    btnTabLocal.style.color = 'var(--text-primary)';

    btnTabExternas.style.background = 'transparent';
    btnTabExternas.style.borderColor = 'var(--border-color)';
    btnTabExternas.style.color = 'var(--text-muted)';

    paneLocal.style.display = 'block';
    paneExternas.style.display = 'none';
  });

  btnTabExternas.addEventListener('click', () => {
    btnTabExternas.style.background = 'rgba(0,242,254,0.08)';
    btnTabExternas.style.borderColor = 'var(--accent-primary)';
    btnTabExternas.style.color = 'var(--text-primary)';

    btnTabLocal.style.background = 'transparent';
    btnTabLocal.style.borderColor = 'var(--border-color)';
    btnTabLocal.style.color = 'var(--text-muted)';

    paneExternas.style.display = 'block';
    paneLocal.style.display = 'none';
  });

  // --- LABORATORIO LOCAL ---
  const processListContainer = document.getElementById('local-studies-process-list');
  
  // Función auxiliar para consolidar análisis solicitados en una misma fecha/lote en una sola orden
  function consolidateLocalLabs(patientObj) {
    if (!patientObj || !patientObj.localLabs || patientObj.localLabs.length <= 1) return;
    
    const grouped = [];
    const processedIds = new Set();

    patientObj.localLabs.forEach((lab, idx) => {
      if (processedIds.has(lab.id)) return;

      if (lab.stage !== 'completado') {
        const timeKey = lab.date ? lab.date.substring(0, 16) : 'now';
        const sameBatch = patientObj.localLabs.filter(l => 
          !processedIds.has(l.id) && 
          l.stage === lab.stage && 
          (l.date ? l.date.substring(0, 16) : 'now') === timeKey
        );

        if (sameBatch.length > 1) {
          const studyNames = sameBatch.map(b => b.name);
          const combinedParams = [];
          sameBatch.forEach(b => {
            (b.parameters || []).forEach(p => {
              combinedParams.push({
                studyName: b.name,
                name: p.name || b.name,
                unit: p.unit || '',
                normal: p.normal || 'Estable',
                value: p.value || ''
              });
            });
          });

          const consolidatedOrder = {
            id: 'ORD-LAB-' + Date.now() + '-' + idx,
            date: lab.date,
            name: studyNames.join(' • '),
            studyNames,
            stage: lab.stage,
            parameters: combinedParams,
            notes: lab.notes || ''
          };

          sameBatch.forEach(b => processedIds.add(b.id));
          grouped.push(consolidatedOrder);
        } else {
          processedIds.add(lab.id);
          grouped.push(lab);
        }
      } else {
        processedIds.add(lab.id);
        grouped.push(lab);
      }
    });

    if (grouped.length < patientObj.localLabs.length) {
      patientObj.localLabs = grouped;
      const stateObj = getAppState();
      const pState = stateObj.patients.find(p => p.id === patientObj.id);
      if (pState) {
        pState.localLabs = grouped;
        saveAppState(stateObj);
      }
    }
  }

  function renderLocalProcessList() {
    if (!processListContainer) return;
    
    // Auto-consolidar estudios individuales creados en el mismo lote
    consolidateLocalLabs(patient);

    processListContainer.innerHTML = '';
    const localLabs = patient.localLabs || [];

    if (localLabs.length === 0) {
      processListContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 2rem 0;">No se registran análisis clínicos locales para este paciente.</div>';
      return;
    }

    localLabs.forEach(study => {
      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      card.style.padding = '14px 18px';
      card.style.marginBottom = '12px';
      card.style.border = '1px solid var(--border-color)';
      card.style.borderRadius = 'var(--radius-sm)';

      let stageBadge = '';
      let actionBtn = '';

      if (study.stage === 'procesar') {
        stageBadge = '<span class="status-badge status-pending" style="background: rgba(255,160,0,0.15); color: #ff9800; border: 1px solid #ff9800; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pendiente de Procesar</span>';
        actionBtn = `<button class="btn btn-primary btn-small" id="btn-proc-${study.id}">🔬 Procesar Orden</button>`;
      } else if (study.stage === 'ingresar_resultados') {
        stageBadge = '<span class="status-badge status-progress" style="background: rgba(0,242,254,0.15); color: var(--accent-primary); border: 1px solid var(--accent-primary); padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Ingresar Resultados</span>';
        actionBtn = `<button class="btn btn-secondary btn-small" id="btn-res-${study.id}">✏️ Ingresar Resultados</button>`;
      } else if (study.stage === 'completado') {
        stageBadge = '<span class="status-badge status-completed" style="background: rgba(0,230,118,0.15); color: var(--accent-success); border: 1px solid var(--accent-success); padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Completado</span>';
        actionBtn = `<button class="btn btn-success btn-small" id="btn-print-local-${study.id}">🖨️ Imprimir Reporte</button>`;
      }

      const studiesBadges = (study.studyNames && study.studyNames.length > 0)
        ? study.studyNames.map(s => `<span style="background: rgba(37, 99, 235, 0.1); color: var(--accent-primary); border: 1px solid rgba(37, 99, 235, 0.3); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; margin-right: 4px; display: inline-block; margin-top: 4px;">🧪 ${s}</span>`).join('')
        : `<span style="font-size: 0.85rem; color: var(--text-muted);">${study.name}</span>`;

      card.innerHTML = `
        <div style="flex: 1; padding-right: 15px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="color: var(--accent-secondary); font-size: 0.8rem;">[ORDEN #${study.id.substring(0, 14)}]</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(study.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
          <h4 style="margin: 4px 0 6px 0; color: var(--text-primary); font-size: 1rem; font-family: var(--font-heading);">${study.name}</h4>
          <div>${studiesBadges}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 15px;">
          ${stageBadge}
          ${actionBtn}
        </div>
      `;

      processListContainer.appendChild(card);

      if (study.stage === 'procesar') {
        card.querySelector(`#btn-proc-${study.id}`).addEventListener('click', () => {
          openResultsModal(study);
        });
      } else if (study.stage === 'ingresar_resultados') {
        card.querySelector(`#btn-res-${study.id}`).addEventListener('click', () => {
          openResultsModal(study);
        });
      } else if (study.stage === 'completado') {
        card.querySelector(`#btn-print-local-${study.id}`).addEventListener('click', () => {
          showLocalLabReportPrintWindow(study, patient);
        });
      }
    });
  }

  // --- MODAL DE CHECKLIST ---
  const checklistModal = document.getElementById('checklist-modal');
  const checklistTitle = document.getElementById('checklist-modal-title');
  const checklistBody = document.getElementById('checklist-modal-body');
  const btnCloseChecklist = document.getElementById('btn-close-checklist');
  const btnCancelChecklist = document.getElementById('btn-cancel-checklist');
  const btnSubmitChecklist = document.getElementById('btn-submit-checklist');

  function openChecklist(type) {
    if (!checklistModal || !checklistBody) return;
    
    checklistModal.style.display = 'flex';
    
    // Categorías de Laboratorio dinámicas desde el estado configurable
    const catalog = getAppState().laboratoryTests || [];
    const categories = [...new Set(catalog.map(s => s.category))];
    
    checklistTitle.textContent = type === 'local' 
      ? "Nueva Solicitud de Laboratorio Local"
      : "Nueva Orden de Laboratorio Externo";

    // Generar checklist con estructura de tarjetas agrupadas por categoría
    let listHtml = `<div class="checklist-container">`;
    categories.forEach(cat => {
      listHtml += `
        <div class="checklist-group-title">${cat}</div>
        <div class="checklist-grid">
          ${catalog.filter(s => s.category === cat).map(study => `
            <div class="checklist-item-card" data-name="${study.name}">
              <input type="checkbox" id="chk-${study.name}" value="${study.name}">
              <span class="checklist-item-label">${study.name}</span>
            </div>
          `).join('')}
        </div>
      `;
    });
    listHtml += `</div>`;
    
    checklistBody.innerHTML = listHtml;

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
        alert("Debe seleccionar al menos un examen.");
        return;
      }

      if (type === 'local') {
        const stateObj = getAppState();
        const pObj = stateObj.patients.find(p => p.id === patient.id);
        if (!pObj.localLabs) pObj.localLabs = [];

        const selectedStudyNames = Array.from(checkedBoxes).map(cb => cb.value);
        const combinedParameters = [];

        selectedStudyNames.forEach(studyName => {
          const catalogItem = catalog.find(c => c.name === studyName);
          if (catalogItem && catalogItem.parameters && catalogItem.parameters.length > 0) {
            catalogItem.parameters.forEach(p => {
              combinedParameters.push({
                studyName,
                name: p.name || studyName,
                unit: p.unit || '',
                normal: p.normal || 'Estable',
                value: ''
              });
            });
          } else {
            combinedParameters.push({
              studyName,
              name: studyName,
              unit: '',
              normal: 'Estable',
              value: ''
            });
          }
        });

        const newLocalLabOrder = {
          id: 'ORD-LAB-' + Date.now(),
          date: new Date().toISOString(),
          name: selectedStudyNames.join(' • '),
          studyNames: selectedStudyNames,
          stage: 'procesar',
          parameters: combinedParameters,
          notes: ''
        };

        pObj.localLabs.unshift(newLocalLabOrder);
        saveAppState(stateObj);
        patient.localLabs = pObj.localLabs;
        
        checklistModal.style.display = 'none';
        renderLocalProcessList();
      } else {
        checkedBoxes.forEach(cb => {
          if (!currentOrderLabs.some(l => l.name === cb.value)) {
            currentOrderLabs.push({ name: cb.value, type: 'lab', notes: '' });
          }
        });

        renderExternalStudiesTable();
        checklistModal.style.display = 'none';
      }
    };
  }

  const hideChecklist = () => { checklistModal.style.display = 'none'; };
  if (btnCloseChecklist) btnCloseChecklist.onclick = hideChecklist;
  if (btnCancelChecklist) btnCancelChecklist.onclick = hideChecklist;

  document.getElementById('btn-new-local-lab-order').addEventListener('click', () => {
    openChecklist('local');
  });

  document.getElementById('btn-new-external-lab-order').addEventListener('click', () => {
    openChecklist('externo');
  });

  // --- INGRESO DE RESULTADOS EN MODAL TIPO TABLA ---
  const resultsModal = document.getElementById('results-entry-modal');
  const resultsTitle = document.getElementById('results-modal-title');
  const resultsBody = document.getElementById('results-modal-body');
  const btnCloseResults = document.getElementById('btn-close-results');
  const btnCancelResults = document.getElementById('btn-cancel-results');
  const resultsForm = document.getElementById('results-entry-form');

  function openResultsModal(study) {
    if (!resultsModal || !resultsBody) return;

    resultsTitle.textContent = `Ingreso de Resultados: ${study.name}`;
    
    const tableRowsHtml = (study.parameters || []).map((param, index) => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 10px 12px;">
          <strong style="color: var(--text-primary); font-size: 0.9rem;">${param.name}</strong>
          ${param.studyName && param.studyName !== param.name ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: 2px;">🧪 ${param.studyName}</div>` : ''}
        </td>
        <td style="padding: 8px 12px;">
          <input type="text" name="param-val-${index}" value="${param.value || ''}" required placeholder="Ej. 110 o Negativo" style="
            width: 100%;
            padding: 8px 12px;
            background: var(--bg-card, rgba(255,255,255,0.05));
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            border-radius: var(--radius-sm);
            font-weight: 700;
          ">
        </td>
        <td style="padding: 8px 12px;">
          <input type="text" name="param-unit-${index}" value="${param.unit || ''}" placeholder="Ej. ml/min" style="
            width: 100%;
            padding: 8px 12px;
            background: var(--bg-card, rgba(255,255,255,0.05));
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            border-radius: var(--radius-sm);
          ">
        </td>
        <td style="padding: 8px 12px;">
          <input type="text" name="param-ref-${index}" value="${param.normal || ''}" placeholder="Ej. 88 - 128 ml/min" style="
            width: 100%;
            padding: 8px 12px;
            background: var(--bg-card, rgba(255,255,255,0.05));
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            border-radius: var(--radius-sm);
          ">
        </td>
      </tr>
    `).join('');

    resultsBody.innerHTML = `
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
        Complete los resultados analíticos para cada uno de los estudios solicitados en esta orden.
      </p>
      <div style="overflow-x: auto; margin-bottom: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
        <table class="results-table-input" style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: rgba(37, 99, 235, 0.12); border-bottom: 2px solid var(--accent-primary);">
              <th style="padding: 10px 12px; color: var(--text-primary); font-size: 0.85rem; font-weight: 700; width: 35%;">Análisis / Parámetro</th>
              <th style="padding: 10px 12px; color: var(--text-primary); font-size: 0.85rem; font-weight: 700; width: 25%;">Resultado Obtenido</th>
              <th style="padding: 10px 12px; color: var(--text-primary); font-size: 0.85rem; font-weight: 700; width: 18%;">Unidades</th>
              <th style="padding: 10px 12px; color: var(--text-primary); font-size: 0.85rem; font-weight: 700; width: 22%;">Valores de Referencia</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    `;

    resultsModal.style.display = 'flex';

    resultsForm.onsubmit = (e) => {
      e.preventDefault();
      
      const stateObj = getAppState();
      const pObj = stateObj.patients.find(p => p.id === patient.id);
      const sObj = pObj.localLabs.find(s => s.id === study.id);

      if (sObj && sObj.parameters) {
        sObj.parameters.forEach((param, index) => {
          const valEl = resultsForm.elements[`param-val-${index}`];
          const unitEl = resultsForm.elements[`param-unit-${index}`];
          const refEl = resultsForm.elements[`param-ref-${index}`];

          if (valEl) param.value = valEl.value;
          if (unitEl) param.unit = unitEl.value;
          if (refEl) param.normal = refEl.value;
        });

        sObj.stage = 'completado';
        saveAppState(stateObj);
        sObj.stage = 'completado';
        saveAppState(stateObj);
        patient.localLabs = pObj.localLabs;
      }

      resultsModal.style.display = 'none';
      renderLocalProcessList();
    };
  }

  const hideResults = () => { resultsModal.style.display = 'none'; };
  if (btnCloseResults) btnCloseResults.onclick = hideResults;
  if (btnCancelResults) btnCancelResults.onclick = hideResults;

  // --- TABLA DE ESTUDIOS EXTERNOS ---
  const externalTableBody = document.getElementById('external-studies-table-body');
  
  function renderExternalStudiesTable() {
    if (!externalTableBody) return;
    externalTableBody.innerHTML = '';

    if (currentOrderLabs.length === 0) {
      externalTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem;">
            Ningún estudio seleccionado. Presione "Seleccionar Laboratorios".
          </td>
        </tr>
      `;
      return;
    }

    currentOrderLabs.forEach((study, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; padding: 10px 8px;">${study.name}</td>
        <td style="padding: 10px 8px;">
          <input type="text" class="inline-notes-input" data-name="${study.name}" placeholder="Ej. Ayuno 12 horas, traer primera orina..." value="${study.notes || ''}" style="
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
        const item = currentOrderLabs.find(x => x.name === name);
        if (item) item.notes = e.target.value;
      });
    });

    externalTableBody.querySelectorAll('.btn-remove-study').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.getAttribute('data-name');
        currentOrderLabs = currentOrderLabs.filter(x => x.name !== name);
        renderExternalStudiesTable();
      });
    });
  }

  // --- ACCIONES EN ORDEN EXTERNA ---
  const docSelect = document.getElementById('o-doctor');
  const btnPreviewExternal = document.getElementById('btn-preview-external-order');
  const btnSaveExternal = document.getElementById('btn-save-external-order');

  btnPreviewExternal.addEventListener('click', () => {
    const doctorId = docSelect.value;
    if (!doctorId) {
      alert("Debe seleccionar el médico solicitante de la orden.");
      return;
    }

    if (currentOrderLabs.length === 0) {
      alert("Debe agregar al menos un examen de laboratorio.");
      return;
    }

    const stateObj = getAppState();
    const doctorObj = stateObj.users.find(u => u.id === doctorId);

    const tempOrder = {
      id: 'o-temp',
      date: new Date().toISOString(),
      doctorName: doctorObj.name,
      doctorLicense: doctorObj.license || 'N/A',
      studies: [...currentOrderLabs],
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

    if (currentOrderLabs.length === 0) {
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
      studies: [...currentOrderLabs],
      generalNotes: generalNotes
    };

    const patientObj = stateObj.patients.find(p => p.id === patient.id);
    if (!patientObj.studyOrders) patientObj.studyOrders = [];
    patientObj.studyOrders.unshift(newOrder);
    saveAppState(stateObj);

    showOrderPreviewModal(patientObj, newOrder);

    currentOrderLabs = [];
    docSelect.value = '';
    document.getElementById('o-general-notes').value = '';
    renderExternalStudiesTable();
    renderOrderHistory(patientObj);
  });

  renderLocalProcessList();
  renderExternalStudiesTable();
}

function showOrderPreviewModal(patient, order) {
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
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 1.5rem;">
        <div>
          ${logoImgHtml}
        </div>
        <div class="prescription-preview-clinic-details" style="text-align: right; font-size: 0.8rem; color: #555;">
          <h3 style="margin: 0; color: #111; font-size: 1.15rem; font-weight: bold;">${clinicInfo.name || 'Centro Médico Altamira'}</h3>
          <p style="margin: 2px 0 0 0;">${clinicInfo.address || ''}</p>
          <p style="margin: 2px 0 0 0;">Tel: ${clinicInfo.phone || ''}</p>
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 1.5rem;">
        <h2 style="margin: 0; font-size: 1.3rem; letter-spacing: 0.5px; font-weight: bold; text-transform: uppercase;">Orden de Exámenes de Laboratorio Clínico</h2>
        <span style="font-size: 0.8rem; color: #666;">Fecha Solicitud: ${new Date(order.date).toLocaleString()}</span>
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
            <th style="text-align: left; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #111;">Examen de Laboratorio</th>
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

      <div class="title-box">
        <h2 class="title" style="color: #1e3a8a; font-size: 1.25rem; font-weight: 800;">Informe de Resultados de Laboratorio Clínico</h2>
        <p style="font-size: 0.85rem; color: #0284c7; margin: 4px 0 0 0; font-weight: 600;">LUGAMED 2.0 Lab Diagnostics</p>
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
        <p style="margin: 0; font-size: 0.95rem; font-weight: bold; color: #111;">Licda. Elena Gómez</p>
        <p style="margin: 2px 0 0 0; font-size: 0.85rem; color: #333; font-weight: 600;">Regente de Laboratorio (Col. L-4412)</p>
        <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #555;">Laboratorio Clínico LUGAMED 2.0</p>
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
