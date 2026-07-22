// src/modules/recetario.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId } from '../main.js';
import { medicationsDatabase } from '../data/medicamentos.js';

function searchMedications(query) {
  if (!query || query.trim().length < 2) return [];
  const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const terms = cleanQuery.split(/\s+/).filter(t => t.length > 0);

  const state = getAppState();
  const dbMeds = state.medications || [];

  const allMedsMap = new Map();

  medicationsDatabase.forEach(m => {
    if (m && m.name) {
      allMedsMap.set(m.name.toLowerCase(), m);
    }
  });

  dbMeds.forEach(m => {
    if (m && m.name) {
      allMedsMap.set(m.name.toLowerCase(), m);
    }
  });

  const allMeds = Array.from(allMedsMap.values());

  return allMeds.filter(m => {
    const nameStr = (m.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const genericStr = (m.generic || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const catStr = (m.category || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const fullSearchStr = `${nameStr} ${genericStr} ${catStr}`;
    return terms.every(term => fullSearchStr.includes(term));
  });
}

// Lista temporal de medicamentos agregados a la receta en curso
let currentPrescriptionMedicines = [];

export function renderRecetario(container) {
  const state = getAppState();
  const activePatientId = getActivePatientId();
  const patient = state.patients.find(p => p.id === activePatientId);
  const doctors = state.users.filter(u => u.role === 'medico');

  // HTML Layout
  container.innerHTML = `
    <div class="module-header">
      <div class="module-title">
        <h1>Recetario Médico</h1>
        <p>Prescripción de medicamentos, impresión de recetas y registro histórico.</p>
      </div>
    </div>

    <div class="grid-prescription">
      <!-- Módulo Principal: Generación de Receta -->
      <div id="recipe-builder-area">
        <!-- Formulario o aviso de selección de paciente -->
      </div>

      <!-- Barra lateral de Pacientes y Consultas -->
      <div class="glass-card search-sidebar">
        <h3>Seleccionar Paciente</h3>
        <div class="form-group" style="margin-top: 5px; margin-bottom: 10px;">
          <input type="text" id="recipe-patient-search" placeholder="🔍 Buscar paciente...">
        </div>
        <ul class="patient-list" id="recipe-patient-list" style="max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem;">
          <!-- Todos los pacientes se cargan aquí -->
        </ul>

        <div id="recipe-patient-history-section" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
          <h3>Consultas Registradas</h3>
          <ul class="history-sidebar-list" id="recipe-consultation-history-list" style="margin-top: 10px; max-height: 180px; overflow-y: auto; margin-bottom: 1.5rem;">
            <!-- Cargar historial del paciente seleccionado -->
          </ul>
        </div>

        <div id="recipe-history-section" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
          <h3>Recetas Emitidas</h3>
          <ul class="history-sidebar-list" id="recipe-history-list" style="margin-top: 10px; max-height: 180px; overflow-y: auto;">
            <!-- Listado de recetas previas -->
          </ul>
        </div>
      </div>
    </div>
  `;

  // Bind búsqueda de pacientes
  const searchInput = document.getElementById('recipe-patient-search');
  searchInput.addEventListener('input', (e) => {
    renderPatientList(e.target.value);
  });

  // Inicializar lista
  renderPatientList();

  const activeId = getActivePatientId();
  if (activeId && state.patients.some(p => p.id === activeId)) {
    selectPatient(activeId);
  } else if (state.patients && state.patients.length > 0) {
    selectPatient(state.patients[0].id);
  } else {
    showPlaceholder();
  }
}

// Renderizar todos los pacientes en la barra lateral del recetario
function renderPatientList(query = '') {
  const state = getAppState();
  const listContainer = document.getElementById('recipe-patient-list');
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

// Seleccionar paciente, actualizar barra lateral y cargar generador
function selectPatient(patientId) {
  const state = getAppState();
  const patient = state.patients.find(p => p.id === patientId);
  const doctors = state.users.filter(u => u.role === 'medico');

  setActivePatientId(patientId);
  renderPatientList(document.getElementById('recipe-patient-search').value);

  if (!patient) {
    showPlaceholder();
    return;
  }

  // Mostrar secciones laterales de historial y recetas
  const historySection = document.getElementById('recipe-patient-history-section');
  const recipeSection = document.getElementById('recipe-history-section');
  if (historySection) historySection.style.display = 'block';
  if (recipeSection) recipeSection.style.display = 'block';

  // Renderizar historial de consultas y recetas
  renderConsultationHistory(patient);
  renderRecipeHistory(patient);

  // Renderizar generador de recetas
  renderRecipeBuilder(patient, doctors);
}

// Mostrar aviso cuando no hay paciente seleccionado
function showPlaceholder() {
  const container = document.getElementById('recipe-builder-area');
  if (!container) return;

  container.innerHTML = `
    <div class="glass-card" style="text-align: center; padding: 4rem 2rem;">
      <span style="font-size: 3rem;">💊</span>
      <h2 style="margin-top: 1rem;">Selecciona un paciente</h2>
      <p style="color: var(--text-muted); margin-top: 0.5rem;">Utiliza la barra lateral para buscar y seleccionar al paciente para el cual emitirá la receta.</p>
    </div>
  `;

  const historySection = document.getElementById('recipe-patient-history-section');
  const recipeSection = document.getElementById('recipe-history-section');
  if (historySection) historySection.style.display = 'none';
  if (recipeSection) recipeSection.style.display = 'none';
}

// Renderizar historial de consultas registradas en la barra lateral
function renderConsultationHistory(patient) {
  const container = document.getElementById('recipe-consultation-history-list');
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
      <div class="history-card-title">${c.doctor || 'Dr. Carlos Mendoza'}</div>
      <div class="history-card-body" title="${c.reason || ''}">
        <strong>Motivo:</strong> ${c.reason || 'Consulta Médica'}
      </div>
      <div style="font-size: 0.75rem; margin-top: 6px; color: var(--accent-primary);">
        DX: ${dxText}
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

  let dateFormatted = consultation.date || 'Reciente';
  try {
    if (consultation.date && !isNaN(new Date(consultation.date).getTime())) {
      dateFormatted = new Date(consultation.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
    }
  } catch(e){}

  const feeText = (consultation.fee !== undefined && consultation.fee !== null) ? `Q${parseFloat(consultation.fee).toFixed(2)}` : 'Q150.00';
  const doctorText = consultation.doctor || 'Médico Tratante';
  const specialtyText = consultation.specialty || 'Medicina General';
  const reasonText = consultation.reason || 'Sin motivo especificado';
  const symptomsText = consultation.symptoms || 'Evaluación médica de rutina y control general.';

  let diagListHtml = '';
  if (consultation.diagnosisCodes && Array.isArray(consultation.diagnosisCodes) && consultation.diagnosisCodes.length > 0) {
    diagListHtml = consultation.diagnosisCodes.map((code, idx) => {
      const name = (consultation.diagnosisNames && consultation.diagnosisNames[idx]) ? consultation.diagnosisNames[idx] : 'Diagnóstico Clínico';
      return `<li style="margin-bottom: 4px;"><span class="suggestion-code" style="background: rgba(0, 242, 254, 0.15); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px; font-weight: bold; font-family: monospace;">${code}</span> - ${name}</li>`;
    }).join('');
  } else if (consultation.diagnosis) {
    diagListHtml = `<li style="margin-bottom: 4px;"><span class="suggestion-code" style="background: rgba(0, 242, 254, 0.15); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px; font-weight: bold; font-family: monospace;">Z00.0</span> - ${consultation.diagnosis}</li>`;
  } else {
    diagListHtml = `<li style="margin-bottom: 4px;"><span class="suggestion-code" style="background: rgba(0, 242, 254, 0.15); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px; font-weight: bold; font-family: monospace;">Z00.0</span> - Examen médico de rutina</li>`;
  }

  const labsList = (consultation.acceptedStudies && consultation.acceptedStudies.labs) ? consultation.acceptedStudies.labs : [];
  const imgList = (consultation.acceptedStudies && consultation.acceptedStudies.imaging) ? consultation.acceptedStudies.imaging : [];
  const medList = consultation.acceptedMedications || [];
  const indList = consultation.acceptedIndications || [];

  const hasAux = labsList.length > 0 || imgList.length > 0 || medList.length > 0 || indList.length > 0;

  title.textContent = `📋 Detalle de Consulta Registrada - ${dateFormatted}`;
  
  body.innerHTML = `
    <div class="report-section" style="margin-bottom: 1rem;">
      <div class="report-section-title" style="font-weight: bold; color: var(--accent-primary); margin-bottom: 0.5rem; font-size: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Información General de la Consulta</div>
      <div class="report-grid-patient" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
        <div class="report-item"><span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Fecha / Hora</span><strong>${dateFormatted}</strong></div>
        <div class="report-item"><span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Especialidad</span><strong>${specialtyText}</strong></div>
        <div class="report-item"><span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Médico Evaluador</span><strong>${doctorText}</strong></div>
        <div class="report-item"><span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Honorario / Cobro</span><strong style="color: var(--accent-success);">${feeText}</strong></div>
      </div>
    </div>

    <div class="report-section" style="margin-bottom: 1rem;">
      <div class="report-section-title" style="font-weight: bold; color: var(--accent-primary); margin-bottom: 0.5rem; font-size: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Evaluación Clínica</div>
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; font-size: 0.9rem; line-height: 1.5;">
        <p style="margin-bottom: 8px;"><strong>Motivo de Consulta:</strong><br><span style="color: var(--text-primary);">${reasonText}</span></p>
        <p><strong>Síntomas / Examen Físico:</strong><br><span style="color: var(--text-muted);">${symptomsText}</span></p>
      </div>
    </div>

    <div class="report-section" style="margin-bottom: 1rem;">
      <div class="report-section-title" style="font-weight: bold; color: var(--accent-primary); margin-bottom: 0.5rem; font-size: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Diagnóstico y Auxiliares (CIE-10)</div>
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; font-size: 0.9rem;">
        <p style="margin-bottom: 6px;"><strong>Diagnóstico(s) Registrado(s):</strong></p>
        <ul style="margin-left: 10px; margin-bottom: 10px; list-style: none; padding: 0;">
          ${diagListHtml}
        </ul>

        ${hasAux ? `
          <p style="margin-top: 10px; font-weight: bold; border-top: 1px dashed var(--border-color); padding-top: 8px;">Estudios e Indicaciones Registrados:</p>
          <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem;">
            ${labsList.map(lab => `<div style="color: var(--accent-primary);">🔬 Lab: ${lab}</div>`).join('')}
            ${imgList.map(img => `<div style="color: var(--accent-secondary);">🖼️ Imagen: ${img}</div>`).join('')}
            ${medList.map(med => `<div style="color: var(--accent-success);">💊 Medicina: ${med.name || med} ${med.dosage ? `(${med.dosage})` : ''}</div>`).join('')}
            ${indList.map(ind => `<div>📌 Indicación: ${ind}</div>`).join('')}
          </div>
        ` : '<p style="margin-top: 8px; color: var(--text-muted); font-style: italic; font-size: 0.85rem;">No se emitieron exámenes de apoyo ni tratamientos adicionales.</p>'}
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

// Historial de recetas en la barra lateral
function renderRecipeHistory(patient) {
  const container = document.getElementById('recipe-history-list');
  if (!container) return;

  container.innerHTML = '';

  if (!patient || !patient.prescriptions || patient.prescriptions.length === 0) {
    container.innerHTML = '<li style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: center;">Sin recetas emitidas</li>';
    return;
  }

  patient.prescriptions.forEach(r => {
    const li = document.createElement('li');
    li.className = 'history-card';
    let dateFormatted = r.date || 'Reciente';
    try {
      if (r.date && !isNaN(new Date(r.date).getTime())) {
        dateFormatted = new Date(r.date).toLocaleDateString('es-GT');
      }
    } catch(e){}

    const medsList = (r.medicines && Array.isArray(r.medicines)) ? r.medicines.map(m => m.name || m).join(', ') : (r.indications || 'Medicamentos prescriptos');
    const medsCount = (r.medicines && Array.isArray(r.medicines)) ? r.medicines.length : 1;

    li.innerHTML = `
      <div class="history-card-header">
        <span>${dateFormatted}</span>
        <span>${medsCount} med(s)</span>
      </div>
      <div class="history-card-title">${r.doctorName || 'Médico Tratante'}</div>
      <div class="history-card-body" title="${medsList}">
        <strong>Medicamentos:</strong> ${medsList}
      </div>
    `;

    // Clic para previsualizar/reimprimir
    li.addEventListener('click', () => {
      showPrescriptionPreviewModal(patient, r);
    });

    container.appendChild(li);
  });
}

// Generador de recetas
function renderRecipeBuilder(patient, doctors) {
  const container = document.getElementById('recipe-builder-area');
  if (!container) return;

  if (!patient) {
    container.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 4rem 2rem;">
        <span style="font-size: 3rem;">💊</span>
        <h2 style="margin-top: 1rem;">Selecciona un paciente</h2>
        <p style="color: var(--text-muted); margin-top: 0.5rem;">Por favor, ve al módulo de Preconsulta y selecciona a un paciente antes de emitir recetas.</p>
      </div>
    `;
    return;
  }

  // Limpiar lista temporal
  currentPrescriptionMedicines = [];

  // Verificar si hay medicamentos y médico precargados desde el asistente de consulta
  const draftMeds = sessionStorage.getItem('medflow_prescription_draft');
  const draftDoctor = sessionStorage.getItem('medflow_doctor_draft');
  const draftInds = sessionStorage.getItem('medflow_prescription_indications_draft') || "";
  
  if (draftMeds) {
    try {
      currentPrescriptionMedicines = JSON.parse(draftMeds);
      sessionStorage.removeItem('medflow_prescription_draft');
    } catch (e) {
      console.error("Error parsing draft medicines:", e);
    }
  }

  if (draftDoctor) {
    sessionStorage.removeItem('medflow_doctor_draft');
  }

  if (sessionStorage.getItem('medflow_prescription_indications_draft')) {
    sessionStorage.removeItem('medflow_prescription_indications_draft');
  }

  container.innerHTML = `
    <div class="glass-card">
      <h2 style="font-family: var(--font-heading); margin-bottom: 1.5rem; color: var(--accent-primary);">Emitir Nueva Receta</h2>
      
      <!-- Doctor que receta (automático del paciente) -->
      <div class="form-group" style="max-width: 400px; margin-bottom: 1.5rem;">
        <label>Médico que Prescribe (Tratante)</label>
        <input type="text" value="${patient.assignedDoctorName || 'Dr. Carlos Mendoza'}" readonly style="background: rgba(255,255,255,0.05); cursor: not-allowed; font-weight: bold; color: var(--accent-primary);">
        <input type="hidden" id="r-doctor" value="${patient.assignedDoctorId || 'u-1'}">
      </div>

      <!-- Formulario para agregar medicina a la receta -->
      <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; color: var(--accent-secondary);">Agregar Medicamento</h4>
        <form id="add-medicine-form">
          <div class="form-row">
            <div class="form-group" style="flex: 2; position: relative;">
              <label for="m-name">Nombre del Medicamento</label>
              <input type="text" id="m-name" required placeholder="Buscar en Vademécum de Guatemala..." autocomplete="off">
              <!-- Caja de Autocompletado -->
              <div id="med-autocomplete-list" style="
                position: absolute; 
                top: 100%; 
                left: 0; 
                right: 0; 
                background: #13151f; 
                border: 1px solid rgba(255,255,255,0.15); 
                border-radius: var(--radius-sm); 
                max-height: 200px; 
                overflow-y: auto; 
                z-index: 99; 
                display: none;
                box-shadow: var(--shadow-lg);
              "></div>
            </div>
            <div class="form-group">
              <label for="m-presentation">Presentación</label>
              <select id="m-presentation" required>
                <option value="Tabletas">Tabletas</option>
                <option value="Cápsulas">Cápsulas</option>
                <option value="Jarabe">Jarabe</option>
                <option value="Suspensión">Suspensión</option>
                <option value="Ampollas">Ampollas</option>
                <option value="Crema/Pomada">Crema/Pomada</option>
                <option value="Gotas">Gotas</option>
                <option value="Inhalador">Inhalador</option>
              </select>
            </div>
            <div class="form-group">
              <label for="m-quantity">Cantidad</label>
              <input type="text" id="m-quantity" required placeholder="Ej. 20 tabletas, 1 frasco">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex: 2;">
              <label for="m-dosage">Dosis y Frecuencia</label>
              <input type="text" id="m-dosage" required placeholder="Ej. 1 tableta cada 8 horas">
            </div>
            <div class="form-group" style="flex: 2;">
              <label for="m-duration">Indicaciones / Duración</label>
              <input type="text" id="m-duration" required placeholder="Ej. Tomar después de comida por 7 días">
            </div>
          <div style="display: flex; align-items: center; gap: 1.25rem; margin-top: 1.25rem; flex-wrap: wrap;">
            <button type="submit" class="btn btn-secondary btn-small">
              <span>+</span> Agregar a la Receta
            </button>
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.88rem; color: var(--accent-primary); font-weight: 500; user-select: none; margin: 0;">
              <input type="checkbox" id="m-breakdown-schedule" style="width: 17px; height: 17px; accent-color: var(--accent-primary); cursor: pointer;">
              Desglosar horarios de administración
            </label>
          </div>
        </form>
      </div>

      <!-- Medicamentos Recetados (Lista Actual) -->
      <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Medicamentos en la Receta</h3>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Medicamento</th>
              <th>Cantidad</th>
              <th>Dosis y Frecuencia</th>
              <th>Duración / Indicaciones</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody id="recipe-medicines-table-body">
            <tr>
              <td colspan="5" style="text-align: center; color: var(--text-muted); font-style: italic;">
                No se han agregado medicamentos a esta receta todavía.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Indicaciones Generales / Recomendaciones -->
      <div class="form-group" style="margin-top: 1.5rem;">
        <label for="r-indications">Indicaciones y Recomendaciones Generales</label>
        <textarea id="r-indications" rows="3" placeholder="Ej. Reposo absoluto, tomar abundante agua, evitar ejercicio..." style="width: 100%; min-height: 80px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); padding: 10px; font-family: inherit; font-size: 0.9rem;">${draftInds}</textarea>
      </div>

      <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" id="btn-clear-recipe">Limpiar Receta</button>
        <button type="button" class="btn btn-success" id="btn-approve-recipe">
          <span>✓</span> Aprobar y Previsualizar Receta
        </button>
      </div>
    </div>
  `;

  // Autocompletado e integración del buscador de Vademécum
  const medNameInput = document.getElementById('m-name');
  const autocompleteList = document.getElementById('med-autocomplete-list');
  const presentationSelect = document.getElementById('m-presentation');

  medNameInput.addEventListener('input', (e) => {
    const val = e.target.value;
    autocompleteList.innerHTML = '';
    
    if (val.trim().length < 2) {
      autocompleteList.style.display = 'none';
      return;
    }

    const matches = searchMedications(val);

    if (matches.length === 0) {
      // Permitir ingresar de todas formas (medicamentos raros)
      autocompleteList.innerHTML = `
        <div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; font-style: italic;">
          Medicamento no encontrado en base de datos básica. Presione Enter para conservar lo escrito.
        </div>
      `;
      autocompleteList.style.display = 'block';
      return;
    }

    matches.slice(0, 10).forEach(match => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 10px 14px;
        cursor: pointer;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        font-size: 0.9rem;
        transition: background-color 0.2s;
      `;

      const genericLabel = match.generic ? match.generic : (match.name || 'Genérico');
      const catLabel = match.category ? `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;"> • ${match.category}</span>` : '';

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <strong style="color: var(--accent-primary); font-size: 0.92rem;">${match.name}</strong>
          <span style="font-size: 0.72rem; background: rgba(0, 242, 254, 0.12); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px; font-weight: 600;">${match.presentation || 'Tabletas'}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
          <span>💊 <strong>Genérico:</strong> ${genericLabel}</span>
          ${catLabel}
        </div>
      `;

      item.addEventListener('mouseover', () => {
        item.style.backgroundColor = 'rgba(0, 242, 254, 0.08)';
      });
      item.addEventListener('mouseout', () => {
        item.style.backgroundColor = 'transparent';
      });

      // Seleccionar medicamento del autocompletado
      item.addEventListener('click', () => {
        medNameInput.value = match.name;
        if (presentationSelect && match.presentation) {
          presentationSelect.value = match.presentation;
        }
        autocompleteList.style.display = 'none';
      });

      autocompleteList.appendChild(item);
    });

    autocompleteList.style.display = 'block';
  });

  // Cerrar el autocompletado al hacer clic en otra parte
  document.addEventListener('click', (e) => {
    if (e.target !== medNameInput && e.target !== autocompleteList) {
      autocompleteList.style.display = 'none';
    }
  });

  function formatDosageSchedule(rawDosage, shouldBreakdown = false) {
    if (!rawDosage) return '';
    if (!shouldBreakdown) return rawDosage;

    const text = rawDosage.toLowerCase();
    let schedule = '';
    
    if (text.includes('8 horas') || text.includes('8 hrs') || text.includes('c/8h')) {
      schedule = 'Tomar/aplicar a las 06:00, 14:00 y 22:00 hrs';
    } else if (text.includes('12 horas') || text.includes('12 hrs') || text.includes('c/12h')) {
      schedule = 'Tomar/aplicar a las 08:00 y 20:00 hrs';
    } else if (text.includes('6 horas') || text.includes('6 hrs') || text.includes('c/6h')) {
      schedule = 'Tomar/aplicar a las 06:00, 12:00, 18:00 y 24:00 hrs';
    } else if (text.includes('4 horas') || text.includes('4 hrs') || text.includes('c/4h')) {
      schedule = 'Tomar/aplicar a las 04:00, 08:00, 12:00, 16:00, 20:00 y 24:00 hrs';
    } else if (text.includes('24 horas') || text.includes('24 hrs') || text.includes('diario') || text.includes('1 vez al día') || text.includes('una vez al día')) {
      schedule = 'Tomar/aplicar a las 08:00 hrs';
    } else {
      schedule = 'Tomar/aplicar a las 08:00, 16:00 y 24:00 hrs';
    }

    if (schedule && !rawDosage.toLowerCase().includes('hrs')) {
      return `${rawDosage} (${schedule})`;
    }
    return rawDosage;
  }

  // Bind Agregar Medicamento Form
  document.getElementById('add-medicine-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = medNameInput.value;
    const presentation = presentationSelect.value;
    const quantity = document.getElementById('m-quantity').value;
    const rawDosage = document.getElementById('m-dosage').value;
    const duration = document.getElementById('m-duration').value;
    const breakdownCheck = document.getElementById('m-breakdown-schedule');
    const shouldBreakdown = breakdownCheck ? breakdownCheck.checked : false;

    const dosage = formatDosageSchedule(rawDosage, shouldBreakdown);

    const newMed = { name, presentation, quantity, dosage, duration, breakdownSchedule: shouldBreakdown };
    currentPrescriptionMedicines.push(newMed);

    // Reset fields
    medNameInput.value = '';
    document.getElementById('m-quantity').value = '';
    document.getElementById('m-dosage').value = '';
    document.getElementById('m-duration').value = '';
    if (breakdownCheck) breakdownCheck.checked = false;
    autocompleteList.style.display = 'none';

    renderCurrentMedicinesTable();
  });

  // Bind Limpiar Receta
  document.getElementById('btn-clear-recipe').addEventListener('click', () => {
    currentPrescriptionMedicines = [];
    renderCurrentMedicinesTable();
  });

  // Bind Aprobar Receta
  document.getElementById('btn-approve-recipe').addEventListener('click', () => {
    const docSelect = document.getElementById('r-doctor');
    const doctorId = docSelect.value;
    
    if (!doctorId) {
      alert("Debe seleccionar un médico que prescriba la receta.");
      return;
    }

    if (currentPrescriptionMedicines.length === 0) {
      alert("Debe agregar al menos un medicamento a la receta.");
      return;
    }

    const stateObj = getAppState();
    const doctorObj = stateObj.users.find(u => u.id === doctorId) || 
                      stateObj.users.find(u => u.name === doctorId || (u.name && u.name.toLowerCase().includes(String(doctorId).toLowerCase())));
    
    const doctorName = doctorObj ? doctorObj.name : 'Dr. Randy Rosado';
    const doctorLicense = doctorObj ? (doctorObj.license || 'N/A') : 'N/A';
    const doctorPhone = doctorObj ? (doctorObj.phone || 'N/A') : 'N/A';
    
    const indicationsVal = document.getElementById('r-indications') ? document.getElementById('r-indications').value : "";

    const todayStr = new Date().toISOString().substring(0, 10);
    const patientObj = stateObj.patients.find(p => p.id === patient.id);
    patientObj.billingHistory = patientObj.billingHistory || [];
    
    // Buscar si ya existe una factura pendiente de hoy para consolidar
    let bill = patientObj.billingHistory.find(b => 
      b.status === 'Pendiente' && 
      b.date.substring(0, 10) === todayStr
    );

    const details = [];
    let total = 0;
    
    currentPrescriptionMedicines.forEach(m => {
      const catalogItem = stateObj.medications && stateObj.medications.find(med => med.name === m.name);
      // PRECIO REAL: No multiplicar por número de pastillas prescritas (ej. 30), sino cobrar el precio unitario del catálogo
      const price = catalogItem ? parseFloat(catalogItem.price) : 50.00;
      
      // Validar si el medicamento ya fue cobrado en el cobro del día para evitar duplicidad
      const alreadyBilled = bill && bill.details.some(d => d.description.includes(m.name));
      
      if (!alreadyBilled) {
        details.push({
          description: `Medicamento Recetado: ${m.name} (Presentación: ${m.presentation || 'N/A'})`,
          amount: price
        });
        total += price;
      }
    });

    let billId = '';

    if (bill) {
      // Consolidar en la factura de hoy
      bill.details = [...bill.details, ...details];
      bill.total = parseFloat(bill.total) + total;
      billId = bill.id;
    } else {
      // Crear nueva factura pendiente de hoy
      billId = 'FAC-REC-' + Date.now();
      const newBill = {
        id: billId,
        date: new Date().toISOString(),
        concept: `Receta Médica - Dr. ${doctorName}`,
        details,
        diagnosis: 'Pre-consulta / Recetario',
        total,
        status: 'Pendiente'
      };
      patientObj.billingHistory.unshift(newBill);
    }

    const newRecipe = {
      id: 'r-' + Date.now(),
      date: new Date().toISOString(),
      doctorName: doctorName,
      doctorLicense: doctorLicense,
      doctorPhone: doctorPhone,
      medicines: [...currentPrescriptionMedicines],
      indications: indicationsVal,
      billId: billId,
      dispenseStatus: 'Pendiente'
    };

    patientObj.prescriptions = patientObj.prescriptions || [];
    patientObj.prescriptions.unshift(newRecipe);

    saveAppState(stateObj);

    // Abrir Modal de Vista Preliminar e Impresión
    showPrescriptionPreviewModal(patientObj, newRecipe);

    // Limpiar generador
    currentPrescriptionMedicines = [];
    docSelect.value = '';
    if (document.getElementById('r-indications')) {
      document.getElementById('r-indications').value = '';
    }
    renderCurrentMedicinesTable();
    renderRecipeHistory(patientObj);
  });

  // Inicializar la tabla de medicamentos con lo que esté cargado (por ejemplo, borradores)
  renderCurrentMedicinesTable();
}

// Renderizar tabla de medicamentos en curso
function renderCurrentMedicinesTable() {
  const tbody = document.getElementById('recipe-medicines-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (currentPrescriptionMedicines.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); font-style: italic;">
          No se han agregado medicamentos a esta receta todavía.
        </td>
      </tr>
    `;
    return;
  }

  currentPrescriptionMedicines.forEach((med, idx) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${med.name}</strong> (${med.presentation})</td>
      <td>${med.quantity}</td>
      <td>${med.dosage}</td>
      <td>${med.duration}</td>
      <td>
        <button class="btn btn-danger btn-small btn-remove-med" data-idx="${idx}">&times;</button>
      </td>
    `;

    row.querySelector('.btn-remove-med').addEventListener('click', () => {
      currentPrescriptionMedicines.splice(idx, 1);
      renderCurrentMedicinesTable();
    });

    tbody.appendChild(row);
  });
}

// Mostrar el modal de vista preliminar de la receta
function showPrescriptionPreviewModal(patient, recipe) {
  const modal = document.getElementById('prescription-print-modal');
  const previewContainer = document.getElementById('prescription-preview-content');
  const printActionBtn = document.getElementById('btn-print-action');
  
  if (!modal || !previewContainer || !printActionBtn) return;

  const state = getAppState();
  const clinic = state.clinicInfo;

  // Formatear fecha
  const dateFormatted = new Date(recipe.date).toLocaleDateString('es-GT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Calcular edad
  const dob = new Date(patient.birthdate);
  const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);

  // Renders the prescription in print-optimized markup
  previewContainer.innerHTML = `
    <div class="prescription-preview-box">
      <!-- Encabezado de la clínica -->
      <div class="prescription-preview-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${clinic.logoData 
            ? `<img src="${clinic.logoData}" style="max-height: 48px; max-width: 120px; object-fit: contain; border-radius: 4px;">` 
            : `<span style="font-size: 1.5rem;">🏥</span>`}
          <div>
            <div class="prescription-preview-logo" style="margin-top: 0; font-size: 1.25rem;">${clinic.name}</div>
            <div style="font-size: 0.85rem; font-weight: 600; color: #555; margin-top: 4px;">Atención Médica Profesional</div>
          </div>
        </div>
        <div class="prescription-preview-clinic-details">
          📍 ${clinic.address}<br>
          📞 Teléfono: ${clinic.phone}<br>
          ✉️ Email: ${clinic.email}
        </div>
      </div>

      <!-- Información básica del paciente y receta -->
      <div class="prescription-preview-patient-info">
        <div>
          <strong>Paciente:</strong> ${patient.name}<br>
          <strong>Edad:</strong> ${age} años | <strong>Género:</strong> ${patient.gender}
        </div>
        <div style="text-align: right;">
          <strong>Fecha:</strong> ${dateFormatted}<br>
          <strong>No. Receta:</strong> ${recipe.id.replace('r-', '')}
        </div>
      </div>

      <!-- Icono Rp -->
      <div class="prescription-preview-rx-icon">Rp.</div>

      <!-- Listado de medicamentos -->
      <table class="prescription-preview-table">
        <thead>
          <tr>
            <th style="width: 60%; text-align: left;">Medicamento y Dosis</th>
            <th style="width: 40%; text-align: right;">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          ${recipe.medicines.map(m => `
            <tr>
              <td style="text-align: left; padding: 12px 8px;">
                <strong style="color: #000; font-size: 0.95rem;">${m.name} (${m.presentation})</strong>
                <div class="prescription-preview-indications">${m.dosage} — ${m.duration}</div>
              </td>
              <td style="text-align: right; font-weight: 700; padding: 12px 8px; font-size: 0.95rem; color: #333;">
                ${m.quantity}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Indicaciones Generales -->
      ${recipe.indications ? `
        <div style="margin-top: 1.5rem; border-top: 1px dashed #ccc; padding-top: 10px; text-align: left;">
          <strong style="color: #000; font-size: 0.9rem;">Indicaciones y Recomendaciones Generales:</strong>
          <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #333; white-space: pre-wrap; line-height: 1.4;">${recipe.indications}</p>
        </div>
      ` : ''}

      <!-- Firma del Médico -->
      <div class="prescription-preview-footer">
        <div class="prescription-preview-signature-line"></div>
        <div class="prescription-preview-doctor-sign">${recipe.doctorName}</div>
        <div class="prescription-preview-license">Colegiado Activo No. ${recipe.doctorLicense}</div>
        <div class="prescription-preview-license" style="margin-top: 2px;">Teléfono: ${recipe.doctorPhone || 'N/A'}</div>
      </div>
    </div>
  `;

  // Bind de impresión real
  printActionBtn.onclick = () => {
    window.print();
  };

  modal.style.display = 'flex';
}
