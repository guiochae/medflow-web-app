// src/modules/estudios.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId } from '../main.js';
import { searchLabs, searchImaging } from '../data/estudios.js';

// Listas temporales de estudios agregados en la orden activa
let currentOrderLabs = [];
let currentOrderImaging = [];

export function renderEstudios(container) {
  const state = getAppState();
  const activePatientId = getActivePatientId();
  const patient = state.patients.find(p => p.id === activePatientId);
  const doctors = state.users.filter(u => u.role === 'medico');

  // Layout con Banner del Paciente en la parte superior y Doble Columna
  container.innerHTML = `
    <!-- Banner de Paciente en la Parte Superior (se actualiza dinámicamente) -->
    <div id="estudios-patient-banner-area"></div>

    <!-- Layout de doble columna -->
    <div class="grid-prescription">
      <!-- Columna Principal (Formularios y Creador de Orden) -->
      <div id="order-builder-area">
        <!-- Se llena con renderOrderBuilder -->
      </div>
      
      <!-- Barra lateral de Pacientes y Consultas -->
      <div class="glass-card search-sidebar">
        <h3>Seleccionar Paciente</h3>
        <div class="form-group" style="margin-top: 5px; margin-bottom: 10px;">
          <input type="text" id="estudios-patient-search" placeholder="🔍 Buscar paciente...">
        </div>
        <ul class="patient-list" id="estudios-patient-list" style="max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem;">
          <!-- Todos los pacientes se cargan aquí -->
        </ul>

        <div id="estudios-patient-history-section" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
          <h3>Consultas Registradas</h3>
          <ul class="history-sidebar-list" id="estudios-consultation-history-list" style="margin-top: 10px; max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem;">
            <!-- Cargar historial del paciente seleccionado -->
          </ul>
        </div>

        <div id="order-history-area" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
          <!-- Secciones de Órdenes Emitidas y Estudios Realizados se renderizan aquí -->
        </div>
      </div>
    </div>
  `;

  // Bind búsqueda de pacientes
  const searchInput = document.getElementById('estudios-patient-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderPatientList(e.target.value);
    });
  }

  // Inicializar lista
  renderPatientList();

  const activeId = getActivePatientId();
  if (activeId) {
    selectPatient(activeId);
  } else {
    showPlaceholder();
  }
}

// Renderizar todos los pacientes en la barra lateral del módulo de estudios
function renderPatientList(query = '') {
  const state = getAppState();
  const listContainer = document.getElementById('estudios-patient-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';
  
  const filtered = state.patients.filter(p => 
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

// Seleccionar paciente, actualizar barra lateral, banner y creador
function selectPatient(patientId) {
  const state = getAppState();
  const patient = state.patients.find(p => p.id === patientId);
  const doctors = state.users.filter(u => u.role === 'medico');

  setActivePatientId(patientId);
  
  const searchInput = document.getElementById('estudios-patient-search');
  renderPatientList(searchInput ? searchInput.value : '');

  if (!patient) {
    showPlaceholder();
    return;
  }

  // Actualizar banner superior del paciente
  const dob = new Date(patient.birthdate);
  const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  const banner = document.getElementById('estudios-patient-banner-area');
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

  // Mostrar secciones laterales de historial
  const historySection = document.getElementById('estudios-patient-history-section');
  const orderSection = document.getElementById('order-history-area');
  if (historySection) historySection.style.display = 'block';
  if (orderSection) orderSection.style.display = 'block';

  // Renderizar historial de consultas, órdenes y archivos
  renderConsultationHistory(patient);
  renderOrderHistory(patient);

  // Renderizar creador de órdenes
  renderOrderBuilder(patient, doctors);
}

// Mostrar aviso cuando no hay paciente seleccionado
function showPlaceholder() {
  const container = document.getElementById('order-builder-area');
  if (!container) return;

  container.innerHTML = `
    <div class="glass-card" style="text-align: center; padding: 4rem 2rem;">
      <span style="font-size: 3rem;">🔬</span>
      <h2 style="margin-top: 1rem;">Selecciona un paciente</h2>
      <p style="color: var(--text-muted); margin-top: 0.5rem;">Utiliza la barra lateral para buscar y seleccionar al paciente para el cual emitirá la orden de estudios.</p>
    </div>
  `;

  const banner = document.getElementById('estudios-patient-banner-area');
  if (banner) banner.innerHTML = '';

  const historySection = document.getElementById('estudios-patient-history-section');
  const orderSection = document.getElementById('order-history-area');
  if (historySection) historySection.style.display = 'none';
  if (orderSection) orderSection.style.display = 'none';
}

// Renderizar historial de consultas registradas en la barra lateral
function renderConsultationHistory(patient) {
  const container = document.getElementById('estudios-consultation-history-list');
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
      <div style="font-size: 0.75rem; margin-top: 6px; color: var(--accent-primary);">
        DX: ${c.diagnosisCodes.join(', ')}
      </div>
    `;

    li.addEventListener('click', () => {
      showPastConsultationDetail(c);
    });

    container.appendChild(li);
  });
}

// Mostrar detalle de una consulta previa en un modal
function showPastConsultationDetail(consultation) {
  const modal = document.getElementById('clinical-history-modal');
  const title = document.getElementById('history-modal-patient-name');
  const body = document.getElementById('history-modal-body');
  
  if (!modal || !title || !body) return;

  title.textContent = `Detalle de Consulta`;
  
  body.innerHTML = `
    <div class="report-section">
      <div class="report-section-title">Información de la Consulta</div>
      <div class="report-grid-patient">
        <div class="report-item"><span>Fecha / Hora</span><strong>${new Date(consultation.date).toLocaleString()}</strong></div>
        <div class="report-item"><span>Especialidad</span><strong>${consultation.specialty}</strong></div>
        <div class="report-item"><span>Médico</span><strong>${consultation.doctor}</strong></div>
        <div class="report-item"><span>Costo / Cobro</span><strong>Q${consultation.fee.toFixed(2)}</strong></div>
      </div>
    </div>

    <div class="report-section" style="margin-top: 1.5rem;">
      <div class="report-section-title">Evaluación Clínica</div>
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 15px; border-radius: 4px; font-size: 0.95rem; line-height: 1.5;">
        <p style="margin-bottom: 10px;"><strong>Motivo de Consulta:</strong><br>${consultation.reason}</p>
        <p><strong>Síntomas / Examen Físico:</strong><br>${consultation.symptoms}</p>
      </div>
    </div>

    <div class="report-section" style="margin-top: 1.5rem;">
      <div class="report-section-title">Diagnóstico y Auxiliares (CIE-10)</div>
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 15px; border-radius: 4px; font-size: 0.95rem;">
        <p><strong>Diagnóstico(s) Registrado(s):</strong></p>
        <ul style="margin-left: 20px; margin-top: 5px; list-style: square;">
          ${consultation.diagnosisCodes.map((code, idx) => `
            <li><span class="suggestion-code">${code}</span> - ${consultation.diagnosisNames[idx]}</li>
          `).join('')}
        </ul>

        ${consultation.acceptedStudies.labs.length > 0 || consultation.acceptedStudies.imaging.length > 0 || (consultation.acceptedMedications && consultation.acceptedMedications.length > 0) || (consultation.acceptedIndications && consultation.acceptedIndications.length > 0) ? `
          <p style="margin-top: 15px;"><strong>Estudios e Indicaciones Aceptados:</strong></p>
          <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 6px;">
            ${consultation.acceptedStudies.labs.map(lab => `<div>🔬 Lab: ${lab}</div>`).join('')}
            ${consultation.acceptedStudies.imaging.map(img => `<div>🖼️ Imagen: ${img}</div>`).join('')}
            ${consultation.acceptedMedications ? consultation.acceptedMedications.map(med => `<div>💊 Medicina: ${med.name} (${med.dosage})</div>`).join('') : ''}
            ${consultation.acceptedIndications ? consultation.acceptedIndications.map(ind => `<div>📌 Indicación: ${ind}</div>`).join('') : ''}
          </div>
        ` : '<p style="margin-top: 15px; color: var(--text-muted); font-style: italic;">No se prescribieron exámenes de apoyo ni tratamientos.</p>'}
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

// Renderizar historial lateral de órdenes de estudios y archivos de resultados cargados
function renderOrderHistory(patient) {
  const container = document.getElementById('order-history-area');
  if (!container) return;

  // 1. Órdenes Emitidas
  const orders = patient.studyOrders || [];
  let ordersListHtml = '';

  if (orders.length === 0) {
    ordersListHtml = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No hay órdenes previas emitidas</div>`;
  } else {
    ordersListHtml = `
      <ul style="display: flex; flex-direction: column; gap: 10px; list-style: none;">
        ${orders.map(o => {
          const dateFormatted = new Date(o.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
          const labsCount = o.studies.filter(s => s.type === 'lab').length;
          const imgCount = o.studies.filter(s => s.type === 'imaging').length;
          
          return `
            <li class="history-card order-history-card" data-id="${o.id}" style="cursor: pointer;">
              <div class="history-card-header">
                <span>${dateFormatted}</span>
                <span style="font-size: 0.75rem; color: var(--accent-secondary); font-weight: 600;">
                  ${labsCount > 0 ? `🔬 ${labsCount} Lab ` : ''} ${imgCount > 0 ? `🖼️ ${imgCount} Imagen` : ''}
                </span>
              </div>
              <div class="history-card-title">${o.doctorName}</div>
              <div class="history-card-body" style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                <strong>Estudios:</strong> ${o.studies.map(s => s.name).join(', ')}
              </div>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  // 2. Estudios Realizados (Archivos de resultados cargados)
  const labs = patient.labHistory || [];
  const imgs = patient.imagingHistory || [];
  let filesListHtml = '';

  if (labs.length === 0 && imgs.length === 0) {
    filesListHtml = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No hay resultados de estudios cargados</div>`;
  } else {
    filesListHtml = `
      <ul style="display: flex; flex-direction: column; gap: 8px; list-style: none;">
        ${labs.map((l, idx) => `
          <li class="history-card file-history-card" data-type="lab" data-idx="${idx}" style="cursor: pointer; border-left: 3px solid var(--accent-primary);">
            <div class="history-card-header">
              <span>${new Date(l.date).toLocaleDateString('es-GT')}</span>
              <span style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 600;">🔬 Lab</span>
            </div>
            <div class="history-card-title" style="font-size: 0.85rem;">${l.name}</div>
            ${l.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Obs: ${l.notes}</div>` : ''}
          </li>
        `).join('')}
        ${imgs.map((img, idx) => `
          <li class="history-card file-history-card" data-type="imaging" data-idx="${idx}" style="cursor: pointer; border-left: 3px solid var(--accent-secondary);">
            <div class="history-card-header">
              <span>${new Date(img.date).toLocaleDateString('es-GT')}</span>
              <span style="font-size: 0.75rem; color: var(--accent-secondary); font-weight: 600;">🖼️ Imagen</span>
            </div>
            <div class="history-card-title" style="font-size: 0.85rem;">${img.name}</div>
            ${img.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Obs: ${img.notes}</div>` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  }

  container.innerHTML = `
    <!-- Órdenes clínicas solicitadas -->
    <div style="margin-bottom: 1.5rem;">
      <h3 style="font-family: var(--font-heading); margin-bottom: 1rem; color: var(--accent-secondary); font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
        Historial de Órdenes
      </h3>
      ${ordersListHtml}
    </div>

    <!-- Estudios y Reportes Realizados -->
    <div style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
      <h3 style="font-family: var(--font-heading); margin-bottom: 1rem; color: var(--accent-primary); font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
        Estudios Realizados
      </h3>
      ${filesListHtml}
    </div>
  `;

  // Bind Clic para previsualizar/reimprimir órdenes
  container.querySelectorAll('.order-history-card').forEach(card => {
    card.addEventListener('click', () => {
      const orderId = card.getAttribute('data-id');
      const orderSelected = orders.find(o => o.id === orderId);
      if (orderSelected) {
        showOrderPreviewModal(patient, orderSelected);
      }
    });
  });

  // Bind Clic para visualizar reportes de laboratorio/imagenología cargados
  container.querySelectorAll('.file-history-card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.getAttribute('data-type');
      const idx = parseInt(card.getAttribute('data-idx'));
      const study = type === 'lab' ? labs[idx] : imgs[idx];
      if (study) {
        viewStudyFile(study.name, study.fileData, study.fileType || 'image', study.notes);
      }
    });
  });
}

// Catalogo de Estudios y Parámetros para Laboratorio Local
const LAB_STUDIES_CATALOG = [
  {
    name: "Hemograma Completo",
    parameters: [
      { name: "Eritrocitos", unit: "millones/µL", normal: "4.5 - 5.9" },
      { name: "Hemoglobina", unit: "g/dL", normal: "13.5 - 17.5" },
      { name: "Hematocrito", unit: "%", normal: "41% - 50%" },
      { name: "Leucocitos", unit: "/µL", normal: "4,500 - 11,000" },
      { name: "Plaquetas", unit: "/µL", normal: "150,000 - 400,000" }
    ]
  },
  {
    name: "Perfil Lipídico",
    parameters: [
      { name: "Colesterol Total", unit: "mg/dL", normal: "< 200" },
      { name: "Triglicéridos", unit: "mg/dL", normal: "< 150" },
      { name: "Colesterol HDL", unit: "mg/dL", normal: "> 40" },
      { name: "Colesterol LDL", unit: "mg/dL", normal: "< 100" }
    ]
  },
  {
    name: "Glucosa en Ayunas",
    parameters: [
      { name: "Glucosa", unit: "mg/dL", normal: "70 - 100" }
    ]
  },
  {
    name: "Creatinina en Suero",
    parameters: [
      { name: "Creatinina", unit: "mg/dL", normal: "0.7 - 1.3" }
    ]
  },
  {
    name: "Examen General de Orina (EGO)",
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
    name: "Proteína C Reactiva (PCR)",
    parameters: [
      { name: "PCR", unit: "mg/L", normal: "< 5.0" }
    ]
  },
  {
    name: "Helicobacter pylori en heces",
    parameters: [
      { name: "H. Pylori en Heces", unit: "", normal: "Negativo" }
    ]
  },
  {
    name: "Sangre Oculta en Heces",
    parameters: [
      { name: "Sangre Oculta en Heces", unit: "", normal: "Negativo" }
    ]
  },
  {
    name: "Urocultivo",
    parameters: [
      { name: "Cultivo", unit: "", normal: "Sin crecimiento bacteriano" },
      { name: "Recuento de Colonias", unit: "UFC/mL", normal: "N/A" },
      { name: "Antibiograma", unit: "", normal: "N/A" }
    ]
  }
];

const IMAGING_STUDIES_CATALOG = [
  "Rayos X (Rx) de Tórax AP y Lateral",
  "Rayos X (Rx) de Columna Lumbosacra AP y Lateral",
  "Ultrasonido Renal y Vesical",
  "Ultrasonido Obstétrico",
  "Ultrasonido Pélvico / Transvaginal",
  "Endoscopia de Vías Digestivas Altas (EVDA)",
  "Tomografía Computarizada (TC) de Tórax",
  "Resonancia Magnética (RMN) de Columna Lumbar"
];

// Creador de nueva orden de estudios
function renderOrderBuilder(patient, doctors) {
  const container = document.getElementById('order-builder-area');
  if (!container) return;

  // Limpiar listas temporales al renderizar
  currentOrderLabs = [];
  currentOrderImaging = [];

  container.innerHTML = `
    <div class="tabs-container" style="display: flex; gap: 10px; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
      <button class="tab-btn active" id="btn-tab-local" style="
        padding: 10px 18px; 
        background: rgba(0,242,254,0.08); 
        border: 1px solid var(--accent-primary); 
        border-radius: var(--radius-sm); 
        color: var(--text-primary); 
        cursor: pointer; 
        font-weight: 600;
        transition: all 0.2s;
      ">
        🔬 Laboratorio Local (Propios)
      </button>
      <button class="tab-btn" id="btn-tab-externas" style="
        padding: 10px 18px; 
        background: transparent; 
        border: 1px solid var(--border-color); 
        border-radius: var(--radius-sm); 
        color: var(--text-muted); 
        cursor: pointer; 
        font-weight: 600;
        transition: all 0.2s;
      ">
        🖼️ Órdenes Externas
      </button>
    </div>

    <!-- PANE LABORATORIO LOCAL -->
    <div id="pane-local" class="tab-pane active" style="display: block;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="color: var(--accent-primary); font-family: var(--font-heading); margin: 0; font-size: 1.25rem;">🔬 Análisis Clínicos Locales (MedFlow Labs)</h3>
        <button class="btn btn-primary btn-small" id="btn-new-local-lab-order"><span>+</span> Nuevo Estudio Local</button>
      </div>

      <!-- LISTA DE ESTUDIOS LOCALES Y SUS ETAPAS -->
      <div class="glass-card" style="padding: 1.5rem;">
        <h4 style="margin-bottom: 1rem; color: var(--text-primary); font-family: var(--font-heading);">Estudios Locales en Proceso</h4>
        <div id="local-studies-process-list">
          <!-- Cargar dinámicamente -->
        </div>
      </div>
    </div>

    <!-- PANE ÓRDENES EXTERNAS -->
    <div id="pane-externas" class="tab-pane" style="display: none;">
      <!-- Card del Médico Solicitante -->
      <div class="glass-card" style="margin-bottom: 1.5rem;">
        <div class="form-group" style="max-width: 420px; margin-bottom: 0;">
          <label for="o-doctor" style="font-weight: 700; color: var(--accent-primary);">Médico Solicitante de la Orden</label>
          <select id="o-doctor" required>
            <option value="">Seleccione Médico...</option>
            ${doctors.map(d => `<option value="${d.id}">${d.name} (Col. ${d.license || 'N/A'})</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="glass-card" style="margin-bottom: 1.5rem; border-top: 3px solid var(--accent-secondary);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h3 style="color: var(--accent-secondary); font-family: var(--font-heading); margin: 0; font-size: 1.2rem;">🖼️ Solicitud de Estudios Externos</h3>
          <button class="btn btn-secondary btn-small" id="btn-new-external-order"><span>+</span> Seleccionar Estudios</button>
        </div>

        <!-- TABLA DE ESTUDIOS SOLICITADOS -->
        <h4 style="margin-bottom: 0.5rem; color: var(--text-primary); font-size: 0.95rem;">Estudios Solicitados en la Orden</h4>
        <div style="overflow-x: auto; margin-bottom: 1.5rem;">
          <table class="studies-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                <th style="padding: 8px; color: var(--text-muted); font-size: 0.85rem;">Estudio Clínico / Imagen</th>
                <th style="padding: 8px; color: var(--text-muted); font-size: 0.85rem;">Tipo</th>
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
          <textarea id="o-general-notes" placeholder="Ej. Favor enviar resultados por correo electrónico, paciente con sospecha de nefrolitiasis..."></textarea>
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

  // --- LÓGICA DE INTERCAMBIO DE PESTAÑAS ---
  const btnTabLocal = document.getElementById('btn-tab-local');
  const btnTabExternas = document.getElementById('btn-tab-externas');
  const paneLocal = document.getElementById('pane-local');
  const paneExternas = document.getElementById('pane-externas');

  btnTabLocal.addEventListener('click', () => {
    btnTabLocal.classList.add('active');
    btnTabLocal.style.background = 'rgba(0,242,254,0.08)';
    btnTabLocal.style.borderColor = 'var(--accent-primary)';
    btnTabLocal.style.color = 'var(--text-primary)';

    btnTabExternas.classList.remove('active');
    btnTabExternas.style.background = 'transparent';
    btnTabExternas.style.borderColor = 'var(--border-color)';
    btnTabExternas.style.color = 'var(--text-muted)';

    paneLocal.style.display = 'block';
    paneExternas.style.display = 'none';
  });

  btnTabExternas.addEventListener('click', () => {
    btnTabExternas.classList.add('active');
    btnTabExternas.style.background = 'rgba(0,242,254,0.08)';
    btnTabExternas.style.borderColor = 'var(--accent-primary)';
    btnTabExternas.style.color = 'var(--text-primary)';

    btnTabLocal.classList.remove('active');
    btnTabLocal.style.background = 'transparent';
    btnTabLocal.style.borderColor = 'var(--border-color)';
    btnTabLocal.style.color = 'var(--text-muted)';

    paneExternas.style.display = 'block';
    paneLocal.style.display = 'none';
  });

  // --- LÓGICA DE LABORATORIO LOCAL ---
  const processListContainer = document.getElementById('local-studies-process-list');
  
  function renderLocalProcessList() {
    if (!processListContainer) return;
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
      card.style.padding = '12px 15px';
      card.style.marginBottom = '10px';
      card.style.border = '1px solid var(--border-color)';
      card.style.borderRadius = 'var(--radius-sm)';

      let stageBadge = '';
      let actionBtn = '';

      if (study.stage === 'procesar') {
        stageBadge = '<span class="status-badge status-pending" style="background: rgba(255,160,0,0.1); color: #ffa000; border: 1px solid #ffa000; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">Pendiente de Procesar</span>';
        actionBtn = `<button class="btn btn-primary btn-small" id="btn-proc-${study.id}">🔬 Procesar</button>`;
      } else if (study.stage === 'ingresar_resultados') {
        stageBadge = '<span class="status-badge status-progress" style="background: rgba(0,242,254,0.1); color: var(--accent-primary); border: 1px solid var(--accent-primary); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">Ingresar Resultados</span>';
        actionBtn = `<button class="btn btn-secondary btn-small" id="btn-res-${study.id}">✏️ Ingresar Resultados</button>`;
      } else if (study.stage === 'completado') {
        stageBadge = '<span class="status-badge status-completed" style="background: rgba(0,230,118,0.1); color: var(--accent-success); border: 1px solid var(--accent-success); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">Completado</span>';
        actionBtn = `<button class="btn btn-success btn-small" id="btn-print-local-${study.id}">🖨️ Imprimir Resultados</button>`;
      }

      card.innerHTML = `
        <div style="flex: 1;">
          <h4 style="margin: 0; color: var(--text-primary); font-size: 0.95rem; font-family: var(--font-heading);">${study.name}</h4>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(study.date).toLocaleString()}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 15px;">
          ${stageBadge}
          ${actionBtn}
        </div>
      `;

      processListContainer.appendChild(card);

      // Bind acciones
      if (study.stage === 'procesar') {
        card.querySelector(`#btn-proc-${study.id}`).addEventListener('click', () => {
          const stateObj = getAppState();
          const pObj = stateObj.patients.find(p => p.id === patient.id);
          const sObj = pObj.localLabs.find(s => s.id === study.id);
          sObj.stage = 'ingresar_resultados';
          saveAppState(stateObj);
          
          study.stage = 'ingresar_resultados';
          renderLocalProcessList();
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

  function openChecklistModal(type) {
    if (!checklistModal || !checklistBody) return;
    
    checklistModal.style.display = 'flex';
    
    if (type === 'local') {
      checklistTitle.textContent = "Nueva Solicitud de Laboratorio Local";
      checklistBody.innerHTML = `
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Marque los exámenes de laboratorio que desea realizar en la clínica:</p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${LAB_STUDIES_CATALOG.map(lab => `
            <label class="checkbox-container" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer;">
              <input type="checkbox" name="local-lab-check" value="${lab.name}" style="transform: scale(1.15);">
              <span>${lab.name}</span>
            </label>
          `).join('')}
        </div>
      `;

      // Al dar click en enviar
      btnSubmitChecklist.onclick = () => {
        const checkedBoxes = checklistBody.querySelectorAll('input[name="local-lab-check"]:checked');
        if (checkedBoxes.length === 0) {
          alert("Debe seleccionar al menos un estudio.");
          return;
        }

        const stateObj = getAppState();
        const pObj = stateObj.patients.find(p => p.id === patient.id);
        if (!pObj.localLabs) pObj.localLabs = [];

        checkedBoxes.forEach(cb => {
          const studyName = cb.value;
          const catalogItem = LAB_STUDIES_CATALOG.find(c => c.name === studyName);
          
          const newLocalLab = {
            id: 'LL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            date: new Date().toISOString(),
            name: studyName,
            stage: 'procesar',
            parameters: catalogItem ? catalogItem.parameters.map(p => ({ ...p, value: '' })) : [],
            notes: ''
          };
          pObj.localLabs.unshift(newLocalLab);
        });

        saveAppState(stateObj);
        patient.localLabs = pObj.localLabs;
        
        checklistModal.style.display = 'none';
        renderLocalProcessList();
      };
    } else if (type === 'externo') {
      checklistTitle.textContent = "Solicitar Estudios Externos";
      checklistBody.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 10px;">
          <div>
            <h4 style="color: var(--accent-primary); margin-bottom: 10px; font-family: var(--font-heading); font-size: 0.95rem; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">🔬 Laboratorios</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${LAB_STUDIES_CATALOG.map(lab => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                  <input type="checkbox" name="ext-lab-check" value="${lab.name}">
                  <span>${lab.name}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div>
            <h4 style="color: var(--accent-secondary); margin-bottom: 10px; font-family: var(--font-heading); font-size: 0.95rem; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">🖼️ Imagenología</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${IMAGING_STUDIES_CATALOG.map(img => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                  <input type="checkbox" name="ext-img-check" value="${img}">
                  <span>${img}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      btnSubmitChecklist.onclick = () => {
        const checkedLabs = checklistBody.querySelectorAll('input[name="ext-lab-check"]:checked');
        const checkedImgs = checklistBody.querySelectorAll('input[name="ext-img-check"]:checked');

        if (checkedLabs.length === 0 && checkedImgs.length === 0) {
          alert("Debe seleccionar al menos un estudio clínico o de imagen.");
          return;
        }

        checkedLabs.forEach(cb => {
          if (!currentOrderLabs.some(l => l.name === cb.value)) {
            currentOrderLabs.push({ name: cb.value, type: 'lab', notes: '' });
          }
        });

        checkedImgs.forEach(cb => {
          if (!currentOrderImaging.some(i => i.name === cb.value)) {
            currentOrderImaging.push({ name: cb.value, type: 'imaging', notes: '' });
          }
        });

        renderExternalStudiesTable();
        checklistModal.style.display = 'none';
      };
    }
  }

  // Cerrar checklist modal
  const hideChecklist = () => { checklistModal.style.display = 'none'; };
  if (btnCloseChecklist) btnCloseChecklist.onclick = hideChecklist;
  if (btnCancelChecklist) btnCancelChecklist.onclick = hideChecklist;

  document.getElementById('btn-new-local-lab-order').addEventListener('click', () => {
    openChecklistModal('local');
  });

  document.getElementById('btn-new-external-order').addEventListener('click', () => {
    openChecklistModal('externo');
  });

  // --- MODAL DE INGRESO DE RESULTADOS ---
  const resultsModal = document.getElementById('results-entry-modal');
  const resultsTitle = document.getElementById('results-modal-title');
  const resultsBody = document.getElementById('results-modal-body');
  const btnCloseResults = document.getElementById('btn-close-results');
  const btnCancelResults = document.getElementById('btn-cancel-results');
  const resultsForm = document.getElementById('results-entry-form');

  function openResultsModal(study) {
    if (!resultsModal || !resultsBody) return;

    resultsTitle.textContent = `Resultados: ${study.name}`;
    
    let fieldsHtml = '';
    study.parameters.forEach((param, index) => {
      if (param.normal === 'Negativo' || param.normal === 'Sin crecimiento bacteriano') {
        const isNeg = param.value === 'Negativo' || !param.value;
        const isPos = param.value === 'Positivo';
        const isSin = param.value === 'Sin crecimiento bacteriano';
        const isCustom = !isNeg && !isPos && !isSin && param.value;

        fieldsHtml += `
          <div class="form-group" style="margin-bottom: 15px;">
            <label style="font-weight: 600; display: block; margin-bottom: 5px;">${param.name} (${param.unit || 'n/a'}) - Ref: ${param.normal}</label>
            <select name="param-${index}" class="param-select-field" data-index="${index}" style="
              width: 100%; 
              padding: 10px; 
              background: #121222; 
              border: 1px solid var(--border-color); 
              color: white; 
              border-radius: var(--radius-sm);
              cursor: pointer;
            ">
              <option value="Negativo" ${isNeg ? 'selected' : ''}>Negativo</option>
              <option value="Positivo" ${isPos ? 'selected' : ''}>Positivo</option>
              <option value="Sin crecimiento bacteriano" ${isSin ? 'selected' : ''}>Sin crecimiento bacteriano</option>
              <option value="Otro" ${isCustom ? 'selected' : ''}>Otro...</option>
            </select>
            <input type="text" id="custom-input-${index}" name="param-custom-${index}" placeholder="Especifique el resultado..." value="${param.value || ''}" style="
              width: 100%; 
              margin-top: 6px; 
              padding: 8px 12px; 
              background: rgba(255,255,255,0.02); 
              border: 1px solid var(--border-color); 
              color: white; 
              border-radius: var(--radius-sm);
              display: ${isCustom ? 'block' : 'none'};
            ">
          </div>
        `;
      } else {
        fieldsHtml += `
          <div class="form-group" style="margin-bottom: 15px;">
            <label style="font-weight: 600; display: block; margin-bottom: 5px;">${param.name} (${param.unit || 'n/a'}) - Ref: ${param.normal}</label>
            <input type="text" name="param-${index}" value="${param.value || ''}" required placeholder="Ej. ${param.normal.split(' ')[0]}" style="
              width: 100%; 
              padding: 10px; 
              background: rgba(255,255,255,0.02); 
              border: 1px solid var(--border-color); 
              color: white; 
              border-radius: var(--radius-sm);
            ">
          </div>
        `;
      }
    });

    resultsBody.innerHTML = `
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">Ingrese los valores analizados para cada parámetro. Los valores completados se agregarán al expediente clínico y se podrán imprimir.</p>
      ${fieldsHtml}
    `;

    // Bind cambio de selectores para mostrar inputs personalizados
    resultsBody.querySelectorAll('.param-select-field').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = e.target.getAttribute('data-index');
        const customInput = document.getElementById(`custom-input-${index}`);
        if (e.target.value === 'Otro') {
          customInput.style.display = 'block';
          customInput.required = true;
          customInput.focus();
        } else {
          customInput.style.display = 'none';
          customInput.required = false;
        }
      });
    });

    resultsModal.style.display = 'flex';

    // Manejar grabado de resultados
    resultsForm.onsubmit = (e) => {
      e.preventDefault();
      
      const stateObj = getAppState();
      const pObj = stateObj.patients.find(p => p.id === patient.id);
      const sObj = pObj.localLabs.find(s => s.id === study.id);

      sObj.parameters.forEach((param, index) => {
        if (param.normal === 'Negativo' || param.normal === 'Sin crecimiento bacteriano') {
          const selectVal = resultsForm.elements[`param-${index}`].value;
          if (selectVal === 'Otro') {
            param.value = resultsForm.elements[`param-custom-${index}`].value;
          } else {
            param.value = selectVal;
          }
        } else {
          param.value = resultsForm.elements[`param-${index}`].value;
        }
      });

      sObj.stage = 'completado';
      saveAppState(stateObj);
      
      patient.localLabs = pObj.localLabs;
      resultsModal.style.display = 'none';
      renderLocalProcessList();
    };
  }

  const hideResults = () => { resultsModal.style.display = 'none'; };
  if (btnCloseResults) btnCloseResults.onclick = hideResults;
  if (btnCancelResults) btnCancelResults.onclick = hideResults;

  // --- LÓGICA DE TABLA DE ESTUDIOS EXTERNOS ---
  const externalTableBody = document.getElementById('external-studies-table-body');
  
  function renderExternalStudiesTable() {
    if (!externalTableBody) return;
    externalTableBody.innerHTML = '';
    const totalStudies = [...currentOrderLabs, ...currentOrderImaging];

    if (totalStudies.length === 0) {
      externalTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem;">
            Ningún estudio seleccionado. Presione "Seleccionar Estudios" para agregar.
          </td>
        </tr>
      `;
      return;
    }

    totalStudies.forEach((study, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; padding: 10px 8px;">${study.name}</td>
        <td style="padding: 10px 8px;">
          <span class="status-badge" style="
            background: ${study.type === 'lab' ? 'rgba(0,242,254,0.1)' : 'rgba(160,0,255,0.1)'};
            color: ${study.type === 'lab' ? 'var(--accent-primary)' : 'var(--accent-secondary)'};
            border: 1px solid ${study.type === 'lab' ? 'var(--accent-primary)' : 'var(--accent-secondary)'};
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.75rem;
          ">
            ${study.type === 'lab' ? '🔬 Lab' : '🖼️ Imagen'}
          </span>
        </td>
        <td style="padding: 10px 8px;">
          <input type="text" class="inline-notes-input" data-type="${study.type}" data-name="${study.name}" placeholder="Ej. Ayuno 12 horas, AP y Lateral..." value="${study.notes || ''}" style="
            width: 100%; 
            padding: 6px 10px; 
            background: rgba(255,255,255,0.02); 
            border: 1px solid var(--border-color); 
            color: white; 
            border-radius: var(--radius-sm);
          ">
        </td>
        <td style="text-align: center; padding: 10px 8px;">
          <button class="btn-remove-study" data-type="${study.type}" data-name="${study.name}" style="
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

    // Vincular cambios de notas
    externalTableBody.querySelectorAll('.inline-notes-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const type = e.target.getAttribute('data-type');
        const name = e.target.getAttribute('data-name');
        const arr = type === 'lab' ? currentOrderLabs : currentOrderImaging;
        const item = arr.find(x => x.name === name);
        if (item) {
          item.notes = e.target.value;
        }
      });
    });

    // Vincular eliminaciones
    externalTableBody.querySelectorAll('.btn-remove-study').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.getAttribute('data-type');
        const name = e.target.getAttribute('data-name');
        if (type === 'lab') {
          currentOrderLabs = currentOrderLabs.filter(x => x.name !== name);
        } else {
          currentOrderImaging = currentOrderImaging.filter(x => x.name !== name);
        }
        renderExternalStudiesTable();
      });
    });
  }

  // --- BOTONES DE ACCIONES EN ORDEN EXTERNA ---
  const docSelect = document.getElementById('o-doctor');
  const btnPreviewExternal = document.getElementById('btn-preview-external-order');
  const btnSaveExternal = document.getElementById('btn-save-external-order');

  btnPreviewExternal.addEventListener('click', () => {
    const doctorId = docSelect.value;
    if (!doctorId) {
      alert("Debe seleccionar el médico solicitante de la orden.");
      return;
    }

    if (currentOrderLabs.length === 0 && currentOrderImaging.length === 0) {
      alert("Debe agregar al menos un estudio a la orden.");
      return;
    }

    const stateObj = getAppState();
    const doctorObj = stateObj.users.find(u => u.id === doctorId);

    const tempOrder = {
      id: 'o-temp',
      date: new Date().toISOString(),
      doctorName: doctorObj.name,
      doctorLicense: doctorObj.license || 'N/A',
      studies: [...currentOrderLabs, ...currentOrderImaging],
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

    if (currentOrderLabs.length === 0 && currentOrderImaging.length === 0) {
      alert("Debe agregar al menos un estudio a la orden.");
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
      studies: [...currentOrderLabs, ...currentOrderImaging],
      generalNotes: generalNotes
    };

    const patientObj = stateObj.patients.find(p => p.id === patient.id);
    if (!patientObj.studyOrders) patientObj.studyOrders = [];
    patientObj.studyOrders.unshift(newOrder);
    saveAppState(stateObj);

    // Abrir modal de impresión e iniciar proceso de impresión
    showOrderPreviewModal(patientObj, newOrder);

    // Resetear formulario
    currentOrderLabs = [];
    currentOrderImaging = [];
    docSelect.value = '';
    document.getElementById('o-general-notes').value = '';
    renderExternalStudiesTable();
    renderOrderHistory(patientObj);
  });

  // Inicializar vistas internas
  renderLocalProcessList();
  renderExternalStudiesTable();
}

// --- VISTA PREVIA E IMPRESIÓN DE ORDEN EXTERNA ---
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
      <!-- Cabecera de la clínica -->
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

      <!-- Título de la Orden -->
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <h2 style="margin: 0; font-size: 1.3rem; letter-spacing: 0.5px; font-weight: bold; text-transform: uppercase;">Orden de Exámenes de Apoyo Clínico</h2>
        <span style="font-size: 0.8rem; color: #666;">Fecha Solicitud: ${new Date(order.date).toLocaleString()}</span>
      </div>

      <!-- Datos del Paciente -->
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

      <!-- Tabla de Estudios Solicitados -->
      <table class="prescription-preview-table" style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
        <thead>
          <tr style="border-bottom: 2px solid #333;">
            <th style="text-align: left; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #111;">Estudio Clínico</th>
            <th style="text-align: center; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #111;">Tipo</th>
            <th style="text-align: left; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #111;">Indicación / Preparación Especial</th>
          </tr>
        </thead>
        <tbody>
          ${order.studies.map(s => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 12px; font-size: 0.85rem; color: #111; text-align: left; font-weight: 600;">${s.name}</td>
              <td style="padding: 10px 12px; font-size: 0.85rem; color: #555; text-align: center;">${s.type === 'lab' ? 'Laboratorio' : 'Imagenología'}</td>
              <td style="padding: 10px 12px; font-size: 0.85rem; color: #555; text-align: left; font-style: italic;">${s.notes || 'Ninguna'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Observaciones generales de la orden -->
      ${order.generalNotes ? `
        <div style="margin-top: 1.5rem; border-top: 1px dashed #ccc; padding-top: 10px; text-align: left;">
          <strong style="color: #000; font-size: 0.9rem;">Observaciones Médicas Generales:</strong>
          <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #333; white-space: pre-wrap; line-height: 1.4;">${order.generalNotes}</p>
        </div>
      ` : ''}

      <!-- Firma del Médico Solicitante -->
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

// Función auxiliar para abrir los resultados en una ventana emergente
function viewStudyFile(name, fileData, fileType, notes) {
  const win = window.open();
  if (!win) {
    alert("Por favor habilita las ventanas emergentes para visualizar los estudios cargados.");
    return;
  }
  
  win.document.title = name;
  win.document.body.style.margin = "0";
  win.document.body.style.backgroundColor = "#1e1e1e";
  win.document.body.style.color = "#ffffff";
  win.document.body.style.fontFamily = "sans-serif";
  
  let mediaHtml = '';
  if (fileType === 'pdf') {
    mediaHtml = `<iframe src="${fileData}" style="width: 100%; height: 75vh; border: none;"></iframe>`;
  } else {
    mediaHtml = `
      <div style="text-align: center; padding: 20px; max-height: 75vh; overflow: auto;">
        <img src="${fileData}" style="max-width: 90%; max-height: 70vh; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
      </div>
    `;
  }
  
  win.document.body.innerHTML = `
    <div style="padding: 20px; max-width: 900px; margin: 0 auto;">
      <h2 style="margin-top: 0; color: #00f2fe; border-bottom: 1px solid #444; padding-bottom: 10px;">${name}</h2>
      ${mediaHtml}
      ${notes ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #2b2b2b; border-radius: 6px; border-left: 4px solid #00f2fe;">
          <strong style="display: block; margin-bottom: 5px; color: #ccc;">Notas / Observaciones del Estudio:</strong>
          <span style="font-size: 0.95rem; line-height: 1.5; color: #eee; white-space: pre-wrap;">${notes}</span>
        </div>
      ` : ''}
    </div>
  `;
}
