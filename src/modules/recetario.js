// src/modules/recetario.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId } from '../main.js';

function searchMedications(query) {
  if (!query || query.trim().length < 2) return [];
  const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const state = getAppState();
  const dbMeds = state.medications || [];
  return dbMeds.filter(m => {
    const nameMatch = m.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(cleanQuery);
    const genericMatch = (m.generic || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(cleanQuery);
    const catMatch = (m.category || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(cleanQuery);
    return nameMatch || genericMatch || catMatch;
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
  if (activeId) {
    selectPatient(activeId);
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
    const dateFormatted = new Date(r.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
    const medsCount = r.medicines.length;

    li.innerHTML = `
      <div class="history-card-header">
        <span>${dateFormatted}</span>
        <span>${medsCount} med(s)</span>
      </div>
      <div class="history-card-title">${r.doctorName}</div>
      <div class="history-card-body" title="${r.medicines.map(m => m.name).join(', ')}">
        <strong>Medicamentos:</strong> ${r.medicines.map(m => m.name).join(', ')}
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
          </div>
          <button type="submit" class="btn btn-secondary btn-small">
            <span>+</span> Agregar a la Receta
          </button>
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

    matches.slice(0, 8).forEach(match => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 10px 14px;
        cursor: pointer;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        font-size: 0.9rem;
        transition: background-color 0.2s;
      `;
      item.innerHTML = `
        <strong style="color: var(--accent-primary);">${match.name}</strong> 
        <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 5px;">(${match.generic} - ${match.presentation})</span>
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
        // Auto-seleccionar presentación en base a la base de datos
        presentationSelect.value = match.presentation;
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

  function formatDosageSchedule(rawDosage) {
    if (!rawDosage) return '';
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
    const dosage = formatDosageSchedule(rawDosage);
    const duration = document.getElementById('m-duration').value;

    const newMed = { name, presentation, quantity, dosage, duration };
    currentPrescriptionMedicines.push(newMed);

    // Reset fields
    medNameInput.value = '';
    document.getElementById('m-quantity').value = '';
    document.getElementById('m-dosage').value = '';
    document.getElementById('m-duration').value = '';
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
    const doctorObj = stateObj.users.find(u => u.id === doctorId);
    
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
        concept: `Receta Médica - Dr. ${doctorObj.name}`,
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
      doctorName: doctorObj.name,
      doctorLicense: doctorObj.license || 'N/A',
      doctorPhone: doctorObj.phone || 'N/A',
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
