// src/modules/recetario.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId, isAdminUser } from '../main.js';
import { medicationsDatabase } from '../data/medicamentos.js';
import { showPastConsultationDetail } from './consulta.js';

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

function renderInventoryAlerts(query = '') {
  const container = document.getElementById('recipe-inventory-alerts');
  if (!container) return;

  const state = getAppState();
  const medications = state.medications || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const queryLower = query.toLowerCase().trim();
  const filteredMeds = medications.filter(m => {
    if (!m.name) return false;
    return m.name.toLowerCase().includes(queryLower);
  });

  const alerts = [];

  filteredMeds.forEach(m => {
    // 1. Check expiration date
    if (m.vencimiento) {
      let vencDate = new Date(m.vencimiento);
      if (isNaN(vencDate.getTime())) {
        const parts = m.vencimiento.split('/');
        if (parts.length === 3) {
          vencDate = new Date(parts[2], parts[1] - 1, parts[0]);
        }
      }

      if (!isNaN(vencDate.getTime())) {
        vencDate.setHours(0, 0, 0, 0);
        const diffTime = vencDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const dateFormatted = `${vencDate.getDate()}/${vencDate.getMonth() + 1}/${vencDate.getFullYear()}`;

        if (diffDays < 0) {
          alerts.push({
            type: 'expired',
            message: `🚨 <strong>CADUCADO:</strong> El medicamento "${m.name}" (Lote: ${m.lote || 'N/A'}) venció el ${dateFormatted}.`
          });
        } else if (diffDays <= 30) {
          alerts.push({
            type: 'expiring',
            message: `⚠️ <strong>PRÓXIMO A VENCER:</strong> "${m.name}" (Lote: ${m.lote || 'N/A'}) vence el ${dateFormatted} (en ${diffDays} días).`
          });
        }
      }
    }

    // 2. Check stock level
    if (m.stock !== undefined && m.minStock !== undefined && m.stock <= m.minStock) {
      alerts.push({
        type: 'lowStock',
        message: `📉 <strong>BAJO STOCK:</strong> "${m.name}" tiene un stock de ${m.stock} unidades (Mínimo: ${m.minStock}).`
      });
    }
  });

  if (alerts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.82rem; padding: 2rem 0; font-style: italic;">
        No hay alertas vigentes ${query ? 'que coincidan' : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = alerts.map(alt => {
    let cardStyle = '';
    let textColor = '';

    if (alt.type === 'expired') {
      cardStyle = 'background: rgba(225, 29, 72, 0.06); border: 1px solid rgba(225, 29, 72, 0.25); border-left: 4px solid #f43f5e !important;';
      textColor = '#f43f5e';
    } else if (alt.type === 'expiring') {
      cardStyle = 'background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.25); border-left: 4px solid #fbbf24 !important;';
      textColor = '#fbbf24';
    } else { // lowStock
      cardStyle = 'background: rgba(14, 165, 233, 0.06); border: 1px solid rgba(14, 165, 233, 0.25); border-left: 4px solid #38bdf8 !important;';
      textColor = '#38bdf8';
    }

    return `
      <div class="inventory-alert-item" style="
        padding: 10px 12px; 
        border-radius: var(--radius-sm); 
        font-size: 0.8rem; 
        line-height: 1.45;
        color: var(--text-primary);
        ${cardStyle}
      ">
        ${alt.message}
      </div>
    `;
  }).join('');
}

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

// Lista temporal de medicamentos agregados a la receta en curso
let currentPrescriptionMedicines = [];

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
        <div style="grid-column: span 2; background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.15); padding: 8px 12px; border-radius: var(--radius-sm); text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
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

export function renderRecetario(container) {
  const state = getAppState();
  const activePatientId = getActivePatientId();
  const patient = state.patients.find(p => p.id === activePatientId);
  const doctors = state.users.filter(u => {
    const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return r === 'medico' || r === 'medico 1' || r === 'medico 2' || r === 'medico 3';
  });

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

// Seleccionar paciente, actualizar barra lateral y cargar generador
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
      showPastConsultationDetail(c, patient, (updatedPatient) => {
        renderConsultationHistory(updatedPatient);
      });
    });

    container.appendChild(li);
  });
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
      <div class="history-card-header" style="position: relative; display: flex; justify-content: space-between; align-items: center;">
        <span>${dateFormatted}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${medsCount} med(s)</span>
          ${isAdminUser() ? `
            <button class="btn-delete-recipe" data-id="${r.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px; font-size: 0.95rem; line-height: 1;" title="Eliminar Receta">🗑️</button>
          ` : ''}
        </div>
      </div>
      <div class="history-card-title">${r.doctorName || 'Médico Tratante'}</div>
      <div class="history-card-body" title="${medsList}">
        <strong>Medicamentos:</strong> ${medsList}
      </div>
    `;

    const delBtn = li.querySelector('.btn-delete-recipe');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Evitar abrir la vista previa de la receta al hacer clic en borrar
        const confirmDel = confirm(`⚠️ ATENCIÓN:\n\n¿Está completamente seguro de que desea eliminar permanentemente este registro de receta y su cobro asociado del día ${dateFormatted}?\n\nEsta acción es irreversible.`);
        if (confirmDel) {
          const stateObj = getAppState();
          const pObj = stateObj.patients.find(p => p.id === patient.id);
          if (pObj) {
            // Eliminar la receta
            pObj.prescriptions = (pObj.prescriptions || []).filter(item => item.id !== r.id);
            // Eliminar cobro asociado de farmacia (si existe en el historial de facturación)
            pObj.billingHistory = (pObj.billingHistory || []).filter(item => item.recipeId !== r.id);
            
            await saveAppState(stateObj);
            alert("🗑️ Receta y cobro asociados eliminados correctamente.");
            patient.prescriptions = pObj.prescriptions;
            patient.billingHistory = pObj.billingHistory;
            renderRecipeHistory(patient);
          }
        }
      });
    }

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
  let activeSelectedRecipeMed = null;

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

  const vitalsHeaderHtml = getPatientVitalsHeaderHtml(patient);

  container.innerHTML = `
    ${vitalsHeaderHtml}
    <div class="glass-card" style="padding: 1.5rem;">
      <h2 style="font-family: var(--font-heading); margin-bottom: 1.5rem; color: var(--accent-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">Emitir Nueva Receta</h2>
      
      <div class="recipe-layout-grid" style="display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 20px; align-items: start;">
        <!-- Columna Izquierda: Formulario e Historial Recetas -->
        <div>
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
              <!-- Medicamento e Info de Empaque -->
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
                <div class="form-group" style="flex: 1;">
                  <label for="m-presc-type">Tipo de Despacho</label>
                  <select id="m-presc-type" required>
                    <option value="presentacion">Presentación Completa</option>
                    <option value="unidad">Unidad Individual</option>
                    <option value="dosis" disabled>Dosis Específica (Inactivo)</option>
                  </select>
                </div>
              </div>

              <!-- Fila con información física del empaque seleccionada -->
              <div id="m-pack-info" style="display: none; margin-bottom: 1rem; padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.8rem; grid-template-columns: 1fr 1fr; gap: 8px;">
                <!-- Se llena por JS -->
              </div>

              <div class="form-row">
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
                    <option value="Sobre">Sobre</option>
                    <option value="Frasco">Frasco</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="m-quantity" id="lbl-m-quantity">Cantidad (Cajas)</label>
                  <input type="number" id="m-quantity" required placeholder="Ej. 1" min="1">
                </div>
                <div class="form-group" style="display: flex; flex-direction: column; justify-content: flex-end;">
                  <div style="font-size: 0.75rem; color: var(--accent-primary); margin-bottom: 4px;">Costo Estimado:</div>
                  <strong id="lbl-m-cost-preview" style="font-size: 1.1rem; color: var(--accent-primary); padding-bottom: 8px;">Q0.00</strong>
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

        <!-- Columna Derecha: Alertas de Inventario y Caducidad -->
        <div style="background: rgba(0, 0, 0, 0.15); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1.25rem; display: flex; flex-direction: column; max-height: 700px; position: sticky; top: 10px;">
          <h3 style="font-size: 0.95rem; margin-top: 0; margin-bottom: 12px; color: var(--accent-primary); border-bottom: 2px solid var(--accent-primary); padding-bottom: 6px; display: flex; align-items: center; gap: 8px; font-family: var(--font-heading);">
            📢 Alertas de Inventario y Caducidad
          </h3>
          <div id="recipe-inventory-alerts" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 5px; max-height: 600px;">
            <!-- Carga dinámicamente -->
          </div>
        </div>
      </div>
    </div>
  `;

  // Autocompletado e integración del buscador de Vademécum
  const medNameInput = document.getElementById('m-name');
  const autocompleteList = document.getElementById('med-autocomplete-list');
  const presentationSelect = document.getElementById('m-presentation');

  medNameInput.addEventListener('input', (e) => {
    const val = e.target.value;
    renderInventoryAlerts(val);
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
        
        activeSelectedRecipeMed = match;
        updateRecipePackagingInfo();
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

  // Funciones de actualización reactiva del empaque y costo
  const updateRecipePackagingInfo = () => {
    const packInfoEl = document.getElementById('m-pack-info');
    const prescTypeSelect = document.getElementById('m-presc-type');
    const lblQty = document.getElementById('lbl-m-quantity');
    const costPreview = document.getElementById('lbl-m-cost-preview');
    if (!packInfoEl || !prescTypeSelect) return;

    if (!activeSelectedRecipeMed) {
      packInfoEl.style.display = 'none';
      prescTypeSelect.innerHTML = `
        <option value="presentacion">Presentación Completa</option>
        <option value="unidad">Unidad Individual</option>
        <option value="dosis" disabled>Dosis Específica (Inactivo)</option>
      `;
      lblQty.textContent = "Cantidad";
      costPreview.textContent = "Q0.00";
      return;
    }

    const m = enrichMedication(activeSelectedRecipeMed);
    packInfoEl.style.display = 'grid';
    packInfoEl.innerHTML = `
      <div>📦 Lote: <strong>${m.lote || 'N/A'}</strong></div>
      <div>🩺 Stock: <strong>${m.stock} cajas</strong></div>
      <div>📑 Unidades/Caja: <strong>${m.unidades_por_presentacion} uds</strong></div>
      <div>📏 Dosis/Caja: <strong>${m.dosis_total_presentacion} ${m.unidad_medida_dosis}</strong></div>
    `;

    // Rebuild options based on fractionability
    let typeOptions = `
      <option value="presentacion">Presentación Completa (Q${m.precio_presentacion.toFixed(2)})</option>
      <option value="unidad">Unidad Individual (Q${(m.precio_presentacion / m.unidades_por_presentacion).toFixed(2)} c/u)</option>
    `;
    if (m.es_fraccionable) {
      typeOptions += `<option value="dosis">Dosis Específica (${m.unidad_medida_dosis})</option>`;
    } else {
      typeOptions += `<option value="dosis" disabled>Dosis Específica (No fraccionable)</option>`;
    }
    prescTypeSelect.innerHTML = typeOptions;
    
    // Trigger price/label update
    updateRecipeQuantityLabelAndPrice();
  };

  const updateRecipeQuantityLabelAndPrice = () => {
    const typeSelect = document.getElementById('m-presc-type');
    const qtyInput = document.getElementById('m-quantity');
    const lblQty = document.getElementById('lbl-m-quantity');
    const costPreview = document.getElementById('lbl-m-cost-preview');
    if (!typeSelect || !qtyInput || !lblQty || !costPreview) return;

    const type = typeSelect.value;
    if (type === 'presentacion') {
      lblQty.textContent = "Cantidad (Cajas)";
    } else if (type === 'unidad') {
      lblQty.textContent = "Cantidad (Unidades)";
    } else if (type === 'dosis') {
      lblQty.textContent = `Dosis Específica (${activeSelectedRecipeMed ? enrichMedication(activeSelectedRecipeMed).unidad_medida_dosis : 'mg'})`;
    }

    if (!activeSelectedRecipeMed) {
      costPreview.textContent = "Q0.00";
      return;
    }

    const m = enrichMedication(activeSelectedRecipeMed);
    const val = parseFloat(qtyInput.value) || 0;
    let cost = 0;

    if (type === 'presentacion') {
      cost = val * m.precio_presentacion;
    } else if (type === 'unidad') {
      cost = val * (m.precio_presentacion / m.unidades_por_presentacion);
    } else if (type === 'dosis') {
      cost = val * (m.precio_presentacion / m.dosis_total_presentacion);
    }

    costPreview.textContent = `Q${cost.toFixed(2)}`;
  };

  const typeSelect = document.getElementById('m-presc-type');
  const qtyInput = document.getElementById('m-quantity');
  if (typeSelect) typeSelect.addEventListener('change', updateRecipeQuantityLabelAndPrice);
  if (qtyInput) qtyInput.addEventListener('input', updateRecipeQuantityLabelAndPrice);

  // Si vacía el buscador manualmente, limpiar selección
  medNameInput.addEventListener('input', (e) => {
    if (e.target.value.trim() === '') {
      activeSelectedRecipeMed = null;
      updateRecipePackagingInfo();
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
    const quantity = parseFloat(document.getElementById('m-quantity').value) || 1;
    const rawDosage = document.getElementById('m-dosage').value;
    const duration = document.getElementById('m-duration').value;
    const breakdownCheck = document.getElementById('m-breakdown-schedule');
    const shouldBreakdown = breakdownCheck ? breakdownCheck.checked : false;

    const dosage = formatDosageSchedule(rawDosage, shouldBreakdown);

    let finalCost = 50.00;
    let qtyToRecord = quantity;
    let displayPres = presentation;
    let type = 'presentacion';

    if (activeSelectedRecipeMed) {
      const m = enrichMedication(activeSelectedRecipeMed);
      const typeSelectEl = document.getElementById('m-presc-type');
      type = typeSelectEl ? typeSelectEl.value : 'presentacion';

      if (type === 'presentacion') {
        finalCost = quantity * m.precio_presentacion;
        qtyToRecord = quantity;
      } else if (type === 'unidad') {
        finalCost = quantity * (m.precio_presentacion / m.unidades_por_presentacion);
        qtyToRecord = quantity;
        displayPres = `Unidad (${presentation})`;
      } else if (type === 'dosis') {
        finalCost = quantity * (m.precio_presentacion / m.dosis_total_presentacion);
        qtyToRecord = 1;
        displayPres = `Dosis fracc. (${presentation})`;
      }
    } else {
      finalCost = quantity * 50.00;
    }

    const newMed = {
      name,
      presentation: displayPres,
      quantity: type === 'presentacion' ? `${quantity} cajas` : (type === 'unidad' ? `${quantity} unidades` : `${quantity} ${activeSelectedRecipeMed ? enrichMedication(activeSelectedRecipeMed).unidad_medida_dosis : 'mg'}`),
      dosage,
      duration,
      breakdownSchedule: shouldBreakdown,
      tipoPrescripcion: type,
      cantidad_o_dosis: quantity,
      costo_calculado: finalCost,
      qty: qtyToRecord,
      price: finalCost / qtyToRecord
    };

    currentPrescriptionMedicines.push(newMed);

    // Reset fields
    medNameInput.value = '';
    document.getElementById('m-quantity').value = '';
    document.getElementById('m-dosage').value = '';
    document.getElementById('m-duration').value = '';
    if (breakdownCheck) breakdownCheck.checked = false;
    autocompleteList.style.display = 'none';

    activeSelectedRecipeMed = null;
    updateRecipePackagingInfo();

    renderCurrentMedicinesTable();
    renderInventoryAlerts('');
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
      
      const price = m.costo_calculado !== undefined 
        ? parseFloat(m.costo_calculado)
        : (catalogItem ? parseFloat(catalogItem.price) : 50.00);
      
      // Validar si el medicamento ya fue cobrado en el cobro del día para evitar duplicidad
      const alreadyBilled = bill && bill.details.some(d => d.description.includes(m.name));
      
      if (!alreadyBilled) {
        const descSuffix = m.tipoPrescripcion === 'unidad' 
          ? `(${m.cantidad_o_dosis} uds)`
          : (m.tipoPrescripcion === 'dosis' ? `(${m.cantidad_o_dosis} dosis)` : `(${m.qty || 1} cajas)`);
        
        details.push({
          description: `Medicamento Recetado: ${m.name} ${descSuffix}`,
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

    // Registrar en Demanda Real medicamentos que no estén en el catálogo de farmacia
    stateObj.demandaReal = stateObj.demandaReal || [];
    currentPrescriptionMedicines.forEach(m => {
      const inCatalog = stateObj.medications && stateObj.medications.some(med => med.name.toLowerCase().trim() === m.name.toLowerCase().trim());
      if (!inCatalog) {
        stateObj.demandaReal.push({
          id: 'dr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          date: new Date().toISOString(),
          patientName: patientObj.name,
          patientId: patientObj.id,
          doctorName: doctorName,
          medicineName: m.name,
          quantity: parseInt(m.quantity) || 1
        });
      }
    });

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

  // Inicializar alertas de inventario y caducidad
  renderInventoryAlerts('');
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

  // Renders the prescription in print-optimized markup with multi-page table structure
  previewContainer.innerHTML = `
    <div class="prescription-preview-box">
      
      <!-- Tabla que envuelve el contenido en el flujo de impresión -->
      <table style="width: 100%; border-collapse: collapse; background: transparent;">
        <thead>
          <tr>
            <td>
              <div class="prescription-header-spacer"></div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="prescription-print-content" style="padding-top: 10px;">
                <!-- Información básica del paciente y receta -->
                <div class="prescription-preview-patient-info" style="margin-top: 15px;">
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
                <div class="prescription-preview-rx-icon" style="margin-top: 10px;">Rp.</div>

                <!-- Listado de medicamentos -->
                <table class="prescription-preview-table" style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
                  <thead>
                    <tr>
                      <th style="width: 70%; text-align: left; border-bottom: 2px solid #333; padding: 8px;">Medicamento y Dosis</th>
                      <th style="width: 30%; text-align: right; border-bottom: 2px solid #333; padding: 8px;">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recipe.medicines.map(m => `
                      <tr>
                        <td style="text-align: left; padding: 12px 8px; border-bottom: 1px solid #eee;">
                          <strong style="color: #000; font-size: 1.15rem;">${m.name} (${m.presentation})</strong>
                          <div style="font-size: 0.9rem; color: #555; margin-top: 4px;">${m.dosage} — ${m.duration}</div>
                        </td>
                        <td style="text-align: right; font-weight: 700; padding: 12px 8px; font-size: 1.15rem; color: #333; border-bottom: 1px solid #eee;">
                          ${m.quantity}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>

                <!-- Indicaciones Generales -->
                ${recipe.indications ? `
                  <div style="margin-top: 1.5rem; border-top: 1px dashed #ccc; padding-top: 10px; text-align: left;">
                    <strong style="color: #000; font-size: 0.95rem;">Indicaciones y Recomendaciones Generales:</strong>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #333; white-space: pre-wrap; line-height: 1.45;">${recipe.indications}</p>
                  </div>
                ` : ''}
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              <div class="prescription-footer-spacer"></div>
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- ENCABEZADO NORMAL (Pantalla) -->
      <div class="prescription-preview-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${clinic.logoData 
            ? `<img src="${clinic.logoData}" style="max-height: 96px; max-width: 240px; object-fit: contain; border-radius: 4px;">` 
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

      <!-- FIRMA NORMAL (Pantalla) -->
      <div class="prescription-preview-footer">
        <div class="prescription-preview-signature-line"></div>
        <div class="prescription-preview-doctor-sign">${recipe.doctorName}</div>
        <div class="prescription-preview-license">Colegiado Activo No. ${recipe.doctorLicense}</div>
        <div class="prescription-preview-license" style="margin-top: 2px;">Teléfono: ${recipe.doctorPhone || 'N/A'}</div>
      </div>

      <!-- ENCABEZADO FIJO (Impresión - se repite en cada página) -->
      <div class="prescription-fixed-header">
        <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
          ${clinic.logoData 
            ? `<img src="${clinic.logoData}" style="max-height: 80px; max-width: 200px; object-fit: contain; border-radius: 4px;">` 
            : `<span style="font-size: 1.5rem;">🏥</span>`}
          <div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #111; text-transform: uppercase;">${clinic.name}</div>
            <div style="font-size: 0.75rem; font-weight: 600; color: #555; margin-top: 2px;">Atención Médica Profesional</div>
          </div>
        </div>
        <div style="text-align: right; font-size: 0.75rem; color: #555;">
          📍 ${clinic.address}<br>
          📞 Teléfono: ${clinic.phone}<br>
          ✉️ Email: ${clinic.email}
        </div>
      </div>

      <!-- FIRMA FIJA (Impresión - se repite en cada página al final) -->
      <div class="prescription-fixed-footer">
        <div style="width: 200px; border-top: 1px solid #333; margin-bottom: 6px; margin-left: auto; margin-right: auto;"></div>
        <div style="font-size: 0.85rem; font-weight: 600; color: #111;">Dr. ${recipe.doctorName}</div>
        <div style="font-size: 0.75rem; color: #666;">Colegiado Activo No. ${recipe.doctorLicense}</div>
        <div style="font-size: 0.75rem; color: #666; margin-top: 1px;">Teléfono: ${recipe.doctorPhone || 'N/A'}</div>
        <div class="prescription-page-counter-print"></div>
      </div>

    </div>
  `;

  // Bind de impresión real
  printActionBtn.onclick = () => {
    window.print();
  };

  modal.style.display = 'flex';
}
