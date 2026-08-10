// src/modules/consulta.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId } from '../main.js';
import { searchDiagnosticSuggestions } from '../data/cie10.js';

function isCurrentUserAdmin() {
  const loggedUser = sessionStorage.getItem('medflow_logged_user');
  if (!loggedUser) {
    console.warn("[isCurrentUserAdmin] No user logged in sessionStorage.");
    return false;
  }
  try {
    const userObj = JSON.parse(loggedUser);
    const roleLower = String(userObj.role || '').toLowerCase();
    const nameLower = String(userObj.name || '').toLowerCase();
    
    // Es admin si su rol contiene 'admin' o 'administrador' y NO contiene 'medico'/'médico', 
    // o si el nombre del usuario contiene 'admin' o 'administrador'
    const isAdmin = ((roleLower.includes('administrador') || roleLower.includes('admin')) && 
                     !roleLower.includes('medico') && 
                     !roleLower.includes('médico')) ||
                    nameLower.includes('administrador') || 
                    nameLower.includes('admin');
    
    console.log("[isCurrentUserAdmin] Debug details:", { role: userObj.role, name: userObj.name, isAdmin });
    return isAdmin;
  } catch (e) {
    console.error("[isCurrentUserAdmin] Error parsing logged user:", e);
    return false;
  }
}

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

// Estado temporal de la consulta activa (diagnósticos, estudios y tratamientos aceptados)
let activeConsultationState = {
  diagnoses: [],  // { code, description }
  labs: [],       // string names
  imaging: [],    // string names
  treatments: []  // string names
};

// Bandera para redirección diferida a recetario tras grabar consulta
let shouldRedirectToPrescriptionOnSave = false;

export function renderConsulta(container) {
  // HTML Layout del módulo Consulta
  container.innerHTML = `
    <div class="module-header">
      <div class="module-title">
        <h1>Consulta Médica</h1>
        <p>Registro de evaluaciones, diagnósticos y asistente de decisiones clínicas en tiempo real.</p>
      </div>
    </div>

    <!-- Contenedor de Notificaciones de Interconsultas / Referencias Recibidas -->
    <div id="consult-referral-notifications-container"></div>

    <div class="grid-sidebar">
      <!-- Barra lateral: Selector de todos los pacientes e historial de consultas registradas -->
      <div class="glass-card search-sidebar">
        <h3>Seleccionar Paciente</h3>
        <div class="form-group" style="margin-top: 5px; margin-bottom: 10px;">
          <input type="text" id="consult-patient-search" placeholder="🔍 Buscar paciente...">
        </div>
        <ul class="patient-list" id="consult-patient-list" style="max-height: 220px; overflow-y: auto;">
          <!-- Todos los pacientes se cargan aquí -->
        </ul>

        <!-- Sección de consultas registradas (historial del paciente seleccionado) -->
        <div id="selected-patient-history-section" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
          <h3>Consultas Registradas</h3>
          <ul class="history-sidebar-list" id="consultation-history-list" style="margin-top: 10px; max-height: 250px; overflow-y: auto;">
            <!-- Cargar historial del paciente seleccionado -->
          </ul>
        </div>
      </div>

      <!-- Área principal: Formulario de registro de consulta -->
      <div id="consultation-form-area">
        <!-- Formulario o aviso de selección de paciente -->
      </div>
    </div>
  `;

  // Renderizar Notificaciones de Interconsultas
  renderReferralNotifications();

  // Bind búsqueda de pacientes
  const searchInput = document.getElementById('consult-patient-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderPatientList(e.target.value);
    });
  }

  // Inicializar lista de pacientes y cargar paciente seleccionado si existe
  renderPatientList();
  
  const activeId = getActivePatientId();
  if (activeId) {
    selectPatient(activeId);
  } else {
    showPlaceholder();
  }
}

// Renderizar todos los pacientes en la barra lateral
function renderPatientList(query = '') {
  const state = getAppState();
  const listContainer = document.getElementById('consult-patient-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';
  
  const currentUser = state.currentUser;
  let basePatients = state.patients || [];

  // Si el usuario es médico (incluyendo Medico 1, Medico 2, Medico 3, etc.), ve únicamente los pacientes que le fueron asignados
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

// Renderizar notificaciones de interconsultas/referencias recibidas para el médico en sesión
function renderReferralNotifications() {
  const container = document.getElementById('consult-referral-notifications-container');
  if (!container) return;

  const state = getAppState();
  const currentUser = state.currentUser;
  if (!currentUser) {
    container.innerHTML = '';
    return;
  }

  const notifications = [];

  (state.patients || []).forEach(patient => {
    (patient.consultations || []).forEach(c => {
      if (c.referral && (c.referral.doctorName || c.referral.doctorId)) {
        const isTargetDoctor = 
          c.referral.doctorId === currentUser.id ||
          (c.referral.doctorName && c.referral.doctorName.toLowerCase().includes(currentUser.name.toLowerCase())) ||
          (currentUser.name && currentUser.name.toLowerCase().includes((c.referral.doctorName || '').toLowerCase()));

        if (isTargetDoctor) {
          let dateFormatted = c.date || 'Reciente';
          try {
            if (c.date && !isNaN(new Date(c.date).getTime())) {
              dateFormatted = new Date(c.date).toLocaleDateString('es-GT');
            }
          } catch (e) {}

          notifications.push({
            patientId: patient.id,
            patientName: patient.name,
            referringDoctor: c.doctor || 'Médico Tratante',
            specialty: c.referral.specialty || c.specialty || 'General',
            notes: c.referral.notes || c.reason || 'Interconsulta solicitada para evaluación médica',
            dateFormatted
          });
        }
      }
    });
  });

  if (notifications.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="glass-card" style="background: rgba(157, 78, 221, 0.08); border: 1px solid rgba(157, 78, 221, 0.35); padding: 1.25rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.75rem;">
        <span style="font-size: 1.5rem; color: var(--accent-secondary);">🔔</span>
        <h3 style="color: var(--accent-secondary); margin: 0; font-family: var(--font-heading); font-size: 1.1rem;">
          Interconsultas y Referencias Médicas Recibidas (${notifications.length})
        </h3>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${notifications.map(n => `
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); padding: 10px 14px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <strong style="color: var(--accent-primary); font-size: 0.95rem;">👤 ${n.patientName}</strong>
              <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;">Referido por: <strong>${n.referringDoctor}</strong> (${n.dateFormatted})</span>
              <div style="font-size: 0.85rem; color: var(--text-primary); margin-top: 4px;">
                💬 <strong>Motivo/Nota:</strong> ${n.notes}
              </div>
            </div>
            <button class="btn btn-secondary btn-small btn-attend-referred-patient" data-id="${n.patientId}" style="padding: 6px 12px; font-size: 0.82rem; border-color: var(--accent-secondary); color: var(--accent-secondary);">
              <span>👁️</span> Atender Paciente
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Bind click on "Atender Paciente"
  container.querySelectorAll('.btn-attend-referred-patient').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-id');
      selectPatient(pId);
    });
  });
}

// Seleccionar paciente, actualizar barra lateral y cargar formulario
function selectPatient(patientId) {
  setActivePatientId(patientId);
  
  // Actualizar clases seleccionadas en la barra lateral
  const items = document.querySelectorAll('#consult-patient-list .patient-item');
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

  // Re-renderizar lista para marcar el seleccionado
  const searchEl = document.getElementById('consult-patient-search');
  renderPatientList(searchEl ? searchEl.value : '');

  if (!patient) {
    showPlaceholder();
    return;
  }

  // Mostrar la sección de historial clínico de consultas en el lateral
  const historySection = document.getElementById('selected-patient-history-section');
  if (historySection) {
    historySection.style.display = 'block';
  }

  // Renderizar historial de consultas registradas del paciente
  renderConsultationHistory(patient);

  // Renderizar el formulario con todos los médicos registrados
  const doctors = (state.users || []).filter(u => {
    const role = String(u.role || '').toLowerCase();
    const name = String(u.name || '').toLowerCase();
    const id = String(u.id || '').toLowerCase();
    return role.includes('medico') || role.includes('médico') || name.includes('dr.') || name.includes('dra.') || name.includes('lic.') || id.startsWith('u-med');
  });

  renderConsultationForm(patient, doctors);
}

// Mostrar aviso cuando no hay paciente seleccionado
function showPlaceholder() {
  const container = document.getElementById('consultation-form-area');
  if (!container) return;

  container.innerHTML = `
    <div class="glass-card" style="text-align: center; padding: 4rem 2rem;">
      <span style="font-size: 3rem;">🩺</span>
      <h2 style="margin-top: 1rem;">Selecciona un paciente</h2>
      <p style="color: var(--text-muted); margin-top: 0.5rem;">Utiliza la barra lateral para buscar y seleccionar al paciente que evaluará en esta consulta.</p>
    </div>
  `;

  const historySection = document.getElementById('selected-patient-history-section');
  if (historySection) {
    historySection.style.display = 'none';
  }
}

// Renderizar historial de consultas registradas en la barra lateral
function renderConsultationHistory(patient) {
  const container = document.getElementById('consultation-history-list');
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

    const dxCodesText = (c.diagnosisCodes && Array.isArray(c.diagnosisCodes) && c.diagnosisCodes.length > 0) ? c.diagnosisCodes.join(', ') : (c.diagnosis || 'Z00.0');

    li.innerHTML = `
      <div class="history-card-header" style="position: relative; display: flex; justify-content: space-between; align-items: center;">
        <span>${dateFormatted}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${c.specialty || 'General'}</span>
          ${isCurrentUserAdmin() ? `
            <button class="btn-delete-consultation" data-id="${c.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px; font-size: 0.95rem; line-height: 1;" title="Eliminar Consulta">🗑️</button>
          ` : ''}
        </div>
      </div>
      <div class="history-card-title">${c.doctor || 'Médico Tratante'}</div>
      <div class="history-card-body" title="${c.reason || ''}">
        <strong>Motivo:</strong> ${c.reason || 'Consulta Médica'}
      </div>
      ${c.clinicalDiagnosis ? `<div style="font-size: 0.8rem; margin-top: 4px; color: var(--accent-success);"><strong>Dx Clínico:</strong> ${c.clinicalDiagnosis}</div>` : ''}
      ${c.referral ? `<div style="font-size: 0.75rem; margin-top: 4px; color: var(--accent-secondary);">🤝 <strong>Interconsulta:</strong> ${c.referral.doctorName}</div>` : ''}
      <div style="font-size: 0.75rem; margin-top: 6px; color: var(--accent-primary);">
        CIE-10: ${dxCodesText}
      </div>
    `;

    const delBtn = li.querySelector('.btn-delete-consultation');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Evitar abrir el detalle de la consulta al hacer clic en borrar
        const confirmDel = confirm(`⚠️ ATENCIÓN:\n\n¿Está completamente seguro de que desea eliminar permanentemente este registro de consulta médica de la fecha ${dateFormatted}?\n\nEsta acción es irreversible.`);
        if (confirmDel) {
          const stateObj = getAppState();
          const pObj = stateObj.patients.find(p => p.id === patient.id);
          if (pObj) {
            pObj.consultations = (pObj.consultations || []).filter(item => item.id !== c.id);
            await saveAppState(stateObj);
            alert("🗑️ Consulta eliminada correctamente.");
            patient.consultations = pObj.consultations;
            renderConsultationHistory(patient);
          }
        }
      });
    }

    li.addEventListener('click', () => {
      showPastConsultationDetail(c, patient);
    });

    container.appendChild(li);
  });
}

// Mostrar detalle de una consulta previa en un modal emergente
export function showPastConsultationDetail(consultation, patient, onSaveCallback) {
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
  const reasonText = consultation.reason || '';
  const symptomsText = consultation.symptoms || '';

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

  let gyoHtml = '';
  if (consultation.gyoData) {
    const gd = consultation.gyoData;
    const tv = gd.tactoVaginal || { dilatacion: 0, borramiento: 0, altitud: '0' };
    gyoHtml = `
    <div class="report-section" style="margin-bottom: 1rem;">
      <div class="report-section-title" style="font-weight: bold; color: var(--accent-primary); margin-bottom: 0.5rem; font-size: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Información de Ginecología y Obstetricia (Editable)</div>
      <div style="background: rgba(0, 242, 254, 0.02); border: 1px solid rgba(0, 242, 254, 0.15); padding: 12px; border-radius: 6px; font-size: 0.9rem; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Fecha Última Regla (FUR)</label>
            <input type="date" id="edit-past-gyo-fur" value="${gd.fur || ''}" style="width:100%;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Edad Gestacional (EG)</label>
            <input type="text" id="edit-past-gyo-eg" value="${gd.eg || ''}" readonly style="background: rgba(255,255,255,0.05); color: var(--accent-primary); font-weight: bold; cursor: not-allowed; width: 100%;">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Gestas</label>
            <input type="number" id="edit-past-gyo-gestas" value="${gd.gestas || 0}" style="width:100%;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Partos</label>
            <input type="number" id="edit-past-gyo-partos" value="${gd.partos || 0}" style="width:100%;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Abortos</label>
            <input type="number" id="edit-past-gyo-abortos" value="${gd.abortos || 0}" style="width:100%;">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Altura Uterina (cm)</label>
            <input type="number" id="edit-past-gyo-altura" value="${gd.alturaUterina || 0}" style="width:100%;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Frecuencia Cardiaca Fetal (FCF)</label>
            <input type="number" id="edit-past-gyo-fcf" value="${gd.fcf || 0}" style="width:100%;">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Actividad Uterina</label>
            <select id="edit-past-gyo-act-ut" style="width:100%; padding:8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
              <option value="No" ${gd.actividadUterina === 'No' ? 'selected' : ''}>No</option>
              <option value="Si" ${gd.actividadUterina === 'Si' ? 'selected' : ''}>Si</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Movimientos Fetales</label>
            <select id="edit-past-gyo-mov-fet" style="width:100%; padding:8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
              <option value="Si" ${gd.movimientosFetales === 'Si' ? 'selected' : ''}>Si</option>
              <option value="No" ${gd.movimientosFetales === 'No' ? 'selected' : ''}>No</option>
            </select>
          </div>
        </div>
        <div style="border-top: 1px dashed rgba(0, 242, 254, 0.15); padding-top: 6px;">
          <span style="font-weight: bold; font-size: 0.8rem; color: var(--accent-secondary); display: block; margin-bottom: 4px;">Tacto Vaginal</span>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Dilatación (cm)</label>
              <input type="number" id="edit-past-gyo-dilatacion" value="${tv.dilatacion || 0}" style="width:100%;">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Borramiento (%)</label>
              <input type="number" id="edit-past-gyo-borramiento" value="${tv.borramiento || 0}" style="width:100%;">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Altitud</label>
              <select id="edit-past-gyo-altitud" style="width:100%; padding:8px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                <option value="-3" ${tv.altitud === '-3' ? 'selected' : ''}>-3</option>
                <option value="-2" ${tv.altitud === '-2' ? 'selected' : ''}>-2</option>
                <option value="-1" ${tv.altitud === '-1' ? 'selected' : ''}>-1</option>
                <option value="0" ${tv.altitud === '0' ? 'selected' : ''}>0</option>
                <option value="+1" ${tv.altitud === '+1' ? 'selected' : ''}>+1</option>
                <option value="+2" ${tv.altitud === '+2' ? 'selected' : ''}>+2</option>
                <option value="+3" ${tv.altitud === '+3' ? 'selected' : ''}>+3</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
    `;
  }

  title.textContent = `📋 Detalle y Edición de Consulta - ${dateFormatted}`;
  
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
      <div class="report-section-title" style="font-weight: bold; color: var(--accent-primary); margin-bottom: 0.5rem; font-size: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Evaluación Clínica (Editable)</div>
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; font-size: 0.9rem; display: flex; flex-direction: column; gap: 10px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Motivo de Consulta</label>
          <textarea id="edit-past-reason" rows="2" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical;">${reasonText}</textarea>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Síntomas / Examen Físico</label>
          <textarea id="edit-past-symptoms" rows="3" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); resize: vertical;">${symptomsText}</textarea>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Diagnóstico Clínico</label>
          <input type="text" id="edit-past-clinical-diagnosis" value="${consultation.clinicalDiagnosis || ''}" placeholder="Ej. Faringoamigdalitis aguda" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
        </div>
      </div>
    </div>

    ${gyoHtml}

    <div class="report-section" style="margin-bottom: 1.5rem;">
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

    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
      <button class="btn btn-secondary" id="btn-close-past-modal" style="padding: 8px 16px;">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-past-consultation" style="padding: 8px 16px;">💾 Guardar Cambios</button>
    </div>
  `;

  // Registrar listener de FUR para edición obstétrica
  const pastFur = body.querySelector('#edit-past-gyo-fur');
  const pastEg = body.querySelector('#edit-past-gyo-eg');
  if (pastFur && pastEg) {
    pastFur.addEventListener('change', () => {
      const val = pastFur.value;
      if (!val) {
        pastEg.value = '';
        return;
      }
      const furDate = new Date(val);
      const today = new Date();
      furDate.setHours(0,0,0,0);
      today.setHours(0,0,0,0);

      const diffMs = today.getTime() - furDate.getTime();
      if (diffMs < 0) {
        pastEg.value = 'Fecha inválida';
        return;
      }

      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const weeks = Math.floor(diffDays / 7);
      const days = diffDays % 7;

      pastEg.value = `${weeks} semanas y ${days} días`;
    });
  }

  // Registrar listeners para guardar y cerrar
  const saveBtn = body.querySelector('#btn-save-past-consultation');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const reasonVal = body.querySelector('#edit-past-reason').value.trim();
      const symptomsVal = body.querySelector('#edit-past-symptoms').value.trim();
      const clinicalDiagnosisVal = body.querySelector('#edit-past-clinical-diagnosis').value.trim();

      if (!reasonVal) {
        alert("Por favor, ingrese el motivo de consulta.");
        return;
      }

      const stateObj = getAppState();
      const pObj = stateObj.patients.find(p => p.id === patient.id);
      if (pObj) {
        const cObj = pObj.consultations.find(c => c.id === consultation.id);
        if (cObj) {
          cObj.reason = reasonVal;
          cObj.symptoms = symptomsVal;
          cObj.clinicalDiagnosis = clinicalDiagnosisVal;
          
          if (cObj.gyoData) {
            cObj.gyoData.fur = body.querySelector('#edit-past-gyo-fur').value;
            cObj.gyoData.eg = body.querySelector('#edit-past-gyo-eg').value;
            cObj.gyoData.gestas = parseInt(body.querySelector('#edit-past-gyo-gestas').value) || 0;
            cObj.gyoData.partos = parseInt(body.querySelector('#edit-past-gyo-partos').value) || 0;
            cObj.gyoData.abortos = parseInt(body.querySelector('#edit-past-gyo-abortos').value) || 0;
            cObj.gyoData.alturaUterina = parseFloat(body.querySelector('#edit-past-gyo-altura').value) || 0;
            cObj.gyoData.fcf = parseInt(body.querySelector('#edit-past-gyo-fcf').value) || 0;
            cObj.gyoData.actividadUterina = body.querySelector('#edit-past-gyo-act-ut').value;
            cObj.gyoData.movimientosFetales = body.querySelector('#edit-past-gyo-mov-fet').value;
            cObj.gyoData.tactoVaginal = {
              dilatacion: parseInt(body.querySelector('#edit-past-gyo-dilatacion').value) || 0,
              borramiento: parseInt(body.querySelector('#edit-past-gyo-borramiento').value) || 0,
              altitud: body.querySelector('#edit-past-gyo-altitud').value
            };
          }

          await saveAppState(stateObj);
          alert("💾 Cambios grabados correctamente en la consulta.");
          modal.style.display = 'none';

          patient.consultations = pObj.consultations;
          if (typeof onSaveCallback === 'function') {
            onSaveCallback(pObj);
          } else {
            renderConsultationHistory(patient);
          }
        }
      }
    });
  }

  const closePastBtn = body.querySelector('#btn-close-past-modal');
  if (closePastBtn) {
    closePastBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  modal.style.display = 'flex';
}

// Renderizar el formulario principal de consulta para el paciente seleccionado
function renderConsultationForm(patient, doctors) {
  const container = document.getElementById('consultation-form-area');
  if (!container) return;

  // Reset del estado temporal
  activeConsultationState = {
    diagnoses: [],
    labs: [],
    imaging: [],
    treatments: []
  };

  shouldRedirectToPrescriptionOnSave = false;

  const currentDate = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

  // Obtener signos vitales recientes si existen
  const latestVitals = patient.vitalSigns && patient.vitalSigns.length > 0 ? patient.vitalSigns[0] : null;
  let vitalsAlertHtml = '';
  
  if (latestVitals) {
    vitalsAlertHtml = `
      <div style="background: rgba(0, 242, 254, 0.04); border: 1px solid rgba(0, 242, 254, 0.15); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 1.5rem; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
        <div>
          📌 <strong>Signos vitales de preconsulta disponibles:</strong> 
          T: ${latestVitals.temp}°C | P.A: ${latestVitals.bp_systolic}/${latestVitals.bp_diastolic} mmHg | F.C: ${latestVitals.heart_rate} lpm | SPO2: ${latestVitals.oxygen}% | Peso: ${latestVitals.weight}kg${latestVitals.glucose !== undefined && latestVitals.glucose !== null ? ` | GLT: ${latestVitals.glucose} mg/dL` : ''}
        </div>
        <div style="font-weight: bold; color: var(--accent-primary);">IMC: ${latestVitals.bmi}</div>
      </div>
    `;
  }

  const vitalsHeaderHtml = getPatientVitalsHeaderHtml(patient);

  container.innerHTML = `
    ${vitalsHeaderHtml}
    <div class="glass-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h2 style="font-family: var(--font-heading); color: var(--accent-primary); margin: 0;">Nueva Consulta Clínica</h2>
        <span style="font-size: 0.85rem; padding: 4px 10px; background: rgba(255,255,255,0.05); border-radius: 12px; color: var(--text-muted);">Exp: ${patient.id}</span>
      </div>

      <form id="consult-record-form">
        <div class="form-row">
          <div class="form-group">
            <label for="c-doctor">Médico Evaluador Tratante</label>
            <input type="text" id="c-doctor" value="${patient.assignedDoctorName || 'Dr. Carlos Mendoza'}" readonly style="background: rgba(255,255,255,0.05); cursor: not-allowed; font-weight: bold; color: var(--accent-primary);">
          </div>
          <div class="form-group">
            <label for="c-specialty">Especialidad de Consulta</label>
            <select id="c-specialty" required>
              <option value="Medicina General">Medicina General</option>
              <option value="Cardiología">Cardiología</option>
              <option value="Pediatría">Pediatría</option>
              <option value="Ginecología y Obstetricia">Ginecología y Obstetricia</option>
              <option value="Traumatología">Traumatología</option>
              <option value="Medicina Interna">Medicina Interna</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="c-date">Fecha</label>
            <input type="date" id="c-date" value="${currentDate}" required>
          </div>
          <div class="form-group">
            <label for="c-time">Hora</label>
            <input type="time" id="c-time" value="${currentTime}" required>
          </div>
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label for="c-reason" style="margin-bottom: 0;">Motivo de la Consulta</label>
            <button type="button" class="btn-dictate" data-target="c-reason" title="Dictado por voz" style="background: none; border: none; font-size: 0.95rem; cursor: pointer; padding: 2px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; color: var(--text-muted); transition: all 0.2s;">
              <span class="mic-icon">🎙️</span> <span class="dictate-status" style="font-size: 0.75rem; font-weight: bold;">Dictar</span>
            </button>
          </div>
          <textarea id="c-reason" required placeholder="Ej. Paciente refiere dolor de garganta y fiebre de 2 días de evolución..." style="min-height: 80px;"></textarea>
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label for="c-symptoms" style="margin-bottom: 0;">Síntomas / Examen Físico</label>
            <button type="button" class="btn-dictate" data-target="c-symptoms" title="Dictado por voz" style="background: none; border: none; font-size: 0.95rem; cursor: pointer; padding: 2px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; color: var(--text-muted); transition: all 0.2s;">
              <span class="mic-icon">🎙️</span> <span class="dictate-status" style="font-size: 0.75rem; font-weight: bold;">Dictar</span>
            </button>
          </div>
          <textarea id="c-symptoms" required placeholder="Ej. Faringe congestiva con placas purulentas, ganglios submandibulares inflamados..." style="min-height: 100px;"></textarea>
        </div>

        <!-- SECCIÓN ESPECIAL: GINECOLOGÍA Y OBSTETRICIA -->
        <div id="gyo-special-section" style="display: none; background: rgba(0, 242, 254, 0.02); border: 1px solid rgba(0, 242, 254, 0.15); padding: 15px; border-radius: var(--radius-md); margin-top: 1rem; margin-bottom: 1.25rem;">
          <h4 style="color: var(--accent-primary); font-family: var(--font-heading); margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid rgba(0, 242, 254, 0.15); padding-bottom: 4px; font-size: 0.95rem;">🔬 Información de Ginecología y Obstetricia</h4>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label>Fecha Última Regla (FUR)</label>
              <input type="date" id="gyo-fur" style="width:100%;">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Edad Gestacional (EG)</label>
              <input type="text" id="gyo-eg" readonly placeholder="Semanas y Días (se calcula desde FUR)" style="background: rgba(255,255,255,0.05); color: var(--accent-primary); font-weight: bold; cursor: not-allowed;">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label>Número de Gestas</label>
              <input type="number" id="gyo-gestas" min="0" placeholder="Ej. 1" style="width:100%;">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Número de Partos</label>
              <input type="number" id="gyo-partos" min="0" placeholder="Ej. 0" style="width:100%;">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Abortos Previos</label>
              <input type="number" id="gyo-abortos" min="0" placeholder="Ej. 0" style="width:100%;">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label>Altura Uterina (cm)</label>
              <input type="number" id="gyo-altura-uterina" min="0" step="0.1" placeholder="Ej. 28" style="width:100%;">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Frecuencia Cardiaca Fetal (FCF - lpm)</label>
              <input type="number" id="gyo-fcf" min="0" placeholder="Ej. 140" style="width:100%;">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label>Actividad Uterina</label>
              <select id="gyo-actividad-uterina" style="width:100%; padding:8px; border-radius: var(--radius-sm); border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
                <option value="No">No</option>
                <option value="Si">Si</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Movimientos Fetales</label>
              <select id="gyo-movimientos-fetales" style="width:100%; padding:8px; border-radius: var(--radius-sm); border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
                <option value="Si">Si</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>

          <div style="border-top: 1px dashed rgba(0, 242, 254, 0.15); padding-top: 8px; margin-top: 10px;">
            <span style="font-weight: bold; font-size: 0.82rem; color: var(--accent-secondary); display: block; margin-bottom: 6px;">Tacto Vaginal</span>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label>Dilatación (cm)</label>
                <input type="number" id="gyo-tacto-dilatacion" min="0" max="10" placeholder="Ej. 4" style="width:100%;">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label>Borramiento (%)</label>
                <input type="number" id="gyo-tacto-borramiento" min="0" max="100" placeholder="Ej. 80" style="width:100%;">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label>Altitud de Presentación</label>
                <select id="gyo-tacto-altitud" style="width:100%; padding:8px; border-radius: var(--radius-sm); border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
                  <option value="-3">-3</option>
                  <option value="-2">-2</option>
                  <option value="-1">-1</option>
                  <option value="0">0</option>
                  <option value="+1">+1</option>
                  <option value="+2">+2</option>
                  <option value="+3">+3</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="form-group" style="margin-top: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label for="c-clinical-diagnosis" style="margin-bottom: 0; font-weight: 700; color: var(--accent-primary);">Diagnóstico Clínico del Médico</label>
            <button type="button" class="btn-dictate" data-target="c-clinical-diagnosis" title="Dictado por voz" style="background: none; border: none; font-size: 0.95rem; cursor: pointer; padding: 2px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; color: var(--text-muted); transition: all 0.2s;">
              <span class="mic-icon">🎙️</span> <span class="dictate-status" style="font-size: 0.75rem; font-weight: bold; color: var(--accent-primary);">Dictar</span>
            </button>
          </div>
          <textarea id="c-clinical-diagnosis" required placeholder="Escriba el Diagnóstico Clínico del médico (Ej. Amigdalitis Aguda Bacteriana, Síndrome Febril, HTA no controlada...)" style="min-height: 90px; border: 1px solid var(--accent-primary); border-radius: var(--radius-sm);"></textarea>
        </div>

        <!-- Interconsulta / Referencia Médica -->
        <div style="background: rgba(157, 78, 221, 0.04); border: 1px solid rgba(157, 78, 221, 0.25); padding: 1.25rem; border-radius: var(--radius-sm); margin-top: 1.5rem; margin-bottom: 1.5rem;">
          <h4 style="margin-bottom: 0.5rem; color: var(--accent-secondary); display: flex; align-items: center; gap: 8px;">
            <span>🤝</span> Interconsulta / Referencia Médica (Opcional)
          </h4>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
            Si refiere este paciente a otro médico o especialista de la clínica, el médico seleccionado obtendrá acceso de visualización al expediente completo del paciente.
          </p>
          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label for="c-referral-doctor">Médico Receptor (Referido)</label>
              <select id="c-referral-doctor">
                <option value="">Sin Interconsulta (Ninguno)</option>
                ${doctors.filter(d => d.id !== patient.assignedDoctorId).map(d => `<option value="${d.id}">${d.name} (${d.specialty || 'Especialista'}) - Col. ${d.license || 'N/A'}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label for="c-referral-notes">Motivo o Notas de la Interconsulta</label>
            <textarea id="c-referral-notes" placeholder="Ej. Se solicita evaluación cardiológica por soplo sistólico detectado..." style="min-height: 60px;"></textarea>
          </div>
        </div>

        <!-- Asistente Clínico Inteligente -->
        <div class="smart-assistant">
          <div class="smart-assistant-header">
            <span class="assistant-logo">⚡</span>
            <span class="smart-assistant-title">Asistente Clínico Inteligente (CIE-10)</span>
          </div>
          <div class="smart-assistant-body">
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">
              El asistente busca automáticamente diagnósticos del CIE-10 y recomienda laboratorios o imágenes según el motivo y examen físico.
            </p>
            <div id="assistant-suggestions-container">
              <span style="font-size: 0.85rem; font-style: italic; color: var(--text-muted);">Empiece a escribir en el motivo o síntomas para ver sugerencias...</span>
            </div>
          </div>
        </div>

        <div class="form-row" style="margin-top: 1.5rem; align-items: flex-end;">
          <div class="form-group" style="max-width: 250px; margin-bottom: 0;">
            <label for="c-fee">Cobro de la Consulta (Q)</label>
            <input type="number" id="c-fee" value="250.00" step="1" min="0" required>
          </div>
          <div id="assistant-action-buttons-container" style="display: flex; gap: 10px; align-items: center; margin-bottom: 0; padding-bottom: 0;">
            <!-- Botones de acciones del asistente se renderizan aquí -->
          </div>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: flex-end; align-items: center; margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" id="btn-reset-consult">Cancelar</button>
          <button type="submit" class="btn btn-primary">Grabar Consulta</button>
        </div>
      </form>
    </div>
  `;

  // Bind en tiempo real para activar el Asistente Clínico Inteligente
  const reasonInput = document.getElementById('c-reason');
  const symptomsInput = document.getElementById('c-symptoms');

  const handleInputTrigger = () => {
    const combinedText = `${reasonInput.value} ${symptomsInput.value}`;
    const dob = new Date(patient.birthdate);
    const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
    triggerClinicalAssistant(combinedText, patient.gender, age);
  };

  reasonInput.addEventListener('input', handleInputTrigger);
  symptomsInput.addEventListener('input', handleInputTrigger);

  // Manejadores especiales para Ginecología y Obstetricia
  const specialtySelect = document.getElementById('c-specialty');
  const gyoSection = document.getElementById('gyo-special-section');
  if (specialtySelect && gyoSection) {
    specialtySelect.addEventListener('change', (e) => {
      if (e.target.value === 'Ginecología y Obstetricia') {
        gyoSection.style.display = 'block';
      } else {
        gyoSection.style.display = 'none';
      }
    });
  }

  const furInput = document.getElementById('gyo-fur');
  const egInput = document.getElementById('gyo-eg');
  if (furInput && egInput) {
    furInput.addEventListener('change', () => {
      const val = furInput.value;
      if (!val) {
        egInput.value = '';
        return;
      }
      const furDate = new Date(val);
      const today = new Date();
      furDate.setHours(0,0,0,0);
      today.setHours(0,0,0,0);

      const diffMs = today.getTime() - furDate.getTime();
      if (diffMs < 0) {
        egInput.value = 'Fecha inválida (es a futuro)';
        return;
      }

      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const weeks = Math.floor(diffDays / 7);
      const days = diffDays % 7;

      egInput.value = `${weeks} semanas y ${days} días`;
    });
  }

  // Inicializar dictado por micrófono
  initializeVoiceDictation();

  // Botón Cancelar
  document.getElementById('btn-reset-consult').addEventListener('click', () => {
    showPlaceholder();
    // Deseleccionar paciente visualmente
    setActivePatientId("");
    renderPatientList();
  });

  // Guardar Consulta
  document.getElementById('consult-record-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const doctor = document.getElementById('c-doctor').value;
    const specialty = document.getElementById('c-specialty').value;
    const date = document.getElementById('c-date').value;
    const time = document.getElementById('c-time').value;
    const reason = document.getElementById('c-reason').value;
    const symptoms = document.getElementById('c-symptoms').value;
    const clinicalDiagnosis = document.getElementById('c-clinical-diagnosis') ? document.getElementById('c-clinical-diagnosis').value : '';
    const referralDoctorId = document.getElementById('c-referral-doctor') ? document.getElementById('c-referral-doctor').value : '';
    const referralNotes = document.getElementById('c-referral-notes') ? document.getElementById('c-referral-notes').value : '';
    const fee = parseFloat(document.getElementById('c-fee').value);

    const stateObj = getAppState();
    const patientObj = stateObj.patients.find(p => p.id === patient.id);

    let referralObj = null;
    if (referralDoctorId) {
      const refDoctor = (stateObj.users || []).find(u => u.id === referralDoctorId);
      const refDoctorName = refDoctor ? refDoctor.name : '';
      
      referralObj = {
        doctorId: referralDoctorId,
        doctorName: refDoctorName,
        notes: referralNotes
      };

      patientObj.referredDoctorIds = patientObj.referredDoctorIds || [];
      patientObj.referredDoctorNames = patientObj.referredDoctorNames || [];

      if (!patientObj.referredDoctorIds.includes(referralDoctorId)) {
        patientObj.referredDoctorIds.push(referralDoctorId);
      }
      if (refDoctorName && !patientObj.referredDoctorNames.includes(refDoctorName)) {
        patientObj.referredDoctorNames.push(refDoctorName);
      }
    }

    const newConsultation = {
      id: 'c-' + Date.now(),
      date: `${date}T${time}:00Z`,
      specialty,
      doctor,
      reason,
      symptoms,
      clinicalDiagnosis,
      referral: referralObj,
      diagnoses: [...activeConsultationState.diagnoses],
      diagnosisCodes: activeConsultationState.diagnoses.map(d => d.code),
      diagnosisNames: activeConsultationState.diagnoses.map(d => d.description),
      acceptedStudies: {
        labs: [...activeConsultationState.labs],
        imaging: [...activeConsultationState.imaging]
      },
      acceptedTreatments: [...activeConsultationState.treatments],
      fee,
      gyoData: specialty === 'Ginecología y Obstetricia' ? {
        fur: document.getElementById('gyo-fur').value,
        eg: document.getElementById('gyo-eg').value,
        gestas: parseInt(document.getElementById('gyo-gestas').value) || 0,
        partos: parseInt(document.getElementById('gyo-partos').value) || 0,
        abortos: parseInt(document.getElementById('gyo-abortos').value) || 0,
        alturaUterina: parseFloat(document.getElementById('gyo-altura-uterina').value) || 0,
        fcf: parseInt(document.getElementById('gyo-fcf').value) || 0,
        actividadUterina: document.getElementById('gyo-actividad-uterina').value,
        movimientosFetales: document.getElementById('gyo-movimientos-fetales').value,
        tactoVaginal: {
          dilatacion: parseInt(document.getElementById('gyo-tacto-dilatacion').value) || 0,
          borramiento: parseInt(document.getElementById('gyo-tacto-borramiento').value) || 0,
          altitud: document.getElementById('gyo-tacto-altitud').value
        }
      } : null
    };

    // Guardar en el historial clínico del paciente
    patientObj.consultations.unshift(newConsultation);

    // Guardar en el historial de facturación del paciente (detalle de cobro consolidado)
    const todayStr = new Date().toISOString().substring(0, 10);
    patientObj.billingHistory = patientObj.billingHistory || [];
    
    let bill = patientObj.billingHistory.find(b => 
      b.status === 'Pendiente' && 
      b.date.substring(0, 10) === todayStr
    );

    const details = [{ description: 'Honorarios de consulta médica', amount: fee }];
    let total = fee;

    // Agregar laboratorios aceptados al cobro
    if (newConsultation.acceptedStudies && newConsultation.acceptedStudies.labs) {
      newConsultation.acceptedStudies.labs.forEach(labName => {
        const found = stateObj.laboratoryTests && stateObj.laboratoryTests.find(l => l.name === labName);
        const price = found ? parseFloat(found.price) : 125.00;
        details.push({ description: `Examen de Laboratorio: ${labName}`, amount: price });
        total += price;
      });
    }

    // Agregar imagenología aceptada al cobro
    if (newConsultation.acceptedStudies && newConsultation.acceptedStudies.imaging) {
      newConsultation.acceptedStudies.imaging.forEach(imgName => {
        const found = stateObj.imagingStudies && stateObj.imagingStudies.find(i => i.name === imgName);
        const price = found ? parseFloat(found.price) : 300.00;
        details.push({ description: `Estudio de Imagenología: ${imgName}`, amount: price });
        total += price;
      });
    }

    // Agregar tratamientos aceptados al cobro
    if (newConsultation.acceptedTreatments) {
      newConsultation.acceptedTreatments.forEach(med => {
        const found = stateObj.medications && stateObj.medications.find(m => m.name === med.name);
        const price = found ? parseFloat(found.price) : 50.00;
        details.push({ description: `Medicamento Prescrito: ${med.name}`, amount: price });
        total += price;
      });
    }

      const finalDiag = clinicalDiagnosis || (activeConsultationState.diagnoses.map(d => `${d.code} - ${d.description}`).join(', ') || 'Consulta General');
      if (bill) {
        // Consolidar en la factura pendiente del día
        bill.details = [...bill.details, ...details];
        bill.total = parseFloat(bill.total) + total;
        bill.diagnosis = bill.diagnosis && bill.diagnosis !== 'Ninguno' ? `${bill.diagnosis}, ${finalDiag}` : finalDiag;
      } else {
        // Crear nueva factura pendiente
        const newBill = {
          id: 'FAC-' + Date.now(),
          date: new Date().toISOString(),
          concept: `Consulta Médica - ${specialty} (${doctor})`,
          details,
          diagnosis: finalDiag,
          total,
          status: 'Pendiente'
        };
        patientObj.billingHistory.unshift(newBill);
      }

    // Crear receta automática si hay tratamientos prescritos en la consulta
    if (activeConsultationState.treatments && activeConsultationState.treatments.length > 0) {
      const doctorObj = stateObj.users.find(u => u.name === doctor || u.id === doctor || (String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").startsWith('medico') && u.name.includes(doctor)));
      const finalBill = bill || (patientObj.billingHistory && patientObj.billingHistory[0]);
      const billId = finalBill ? finalBill.id : ('FAC-' + Date.now());

      const newRecipe = {
        id: 'r-' + Date.now(),
        date: new Date().toISOString(),
        doctorName: doctorObj ? doctorObj.name : doctor,
        doctorLicense: doctorObj ? (doctorObj.license || 'N/A') : 'N/A',
        doctorPhone: doctorObj ? (doctorObj.phone || 'N/A') : 'N/A',
        medicines: activeConsultationState.treatments.map(t => ({
          name: t.name,
          presentation: t.presentation || 'Tabletas',
          quantity: t.quantity || '1',
          dosage: t.dosage || 'Tomar según indicaciones',
          duration: t.duration || 'N/A'
        })),
        indications: `Tratamiento recetado en la consulta médica.`,
        billId: billId,
        dispenseStatus: 'Pendiente'
      };
      patientObj.prescriptions = patientObj.prescriptions || [];
      patientObj.prescriptions.unshift(newRecipe);
    }

    saveAppState(stateObj);

    alert("Consulta registrada exitosamente. Se ha generado el comprobante de cobro en la sección Facturación de Preconsulta.");

    // Redirección diferida a recetario si fue solicitada mediante el botón "Emitir Receta"
    if (shouldRedirectToPrescriptionOnSave) {
      const doctorObj = stateObj.users.find(u => u.name === doctor);
      const parsedMeds = activeConsultationState.treatments.map(tx => parseTreatmentToMedicine(tx));
      
      sessionStorage.setItem('medflow_prescription_draft', JSON.stringify(parsedMeds));
      if (doctorObj) {
        sessionStorage.setItem('medflow_doctor_draft', doctorObj.id);
      }
      
      shouldRedirectToPrescriptionOnSave = false;

      // Navegar programáticamente a Recetario
      const navItem = document.querySelector('.nav-item[data-target="recetario"]');
      if (navItem) {
        navItem.click();
      }
    } else {
      // Recargar panel lateral y formulario de forma normal
      renderConsultationHistory(patientObj);
      renderConsultationForm(patientObj, doctors);
    }
  });

  // Inicializar botones de acción del asistente (se renderizan vacíos)
  updateAssistantActionButtons();
}

// Ejecutar búsqueda del Asistente Clínico Inteligente
function triggerClinicalAssistant(text, gender, age) {
  const container = document.getElementById('assistant-suggestions-container');
  if (!container) return;

  const suggestions = searchDiagnosticSuggestions(text, gender, age);

  if (suggestions.length === 0) {
    container.innerHTML = `
      <span style="font-size: 0.85rem; font-style: italic; color: var(--text-muted);">
        Escriba síntomas (ej. "fiebre", "lumbalgia", "orina", "cabeza") para obtener diagnósticos recomendados.
      </span>
    `;
    return;
  }

  container.innerHTML = '<div class="suggestion-box"></div>';
  const box = container.querySelector('.suggestion-box');

  suggestions.slice(0, 4).forEach(s => {
    const isDxAccepted = activeConsultationState.diagnoses.some(d => d.code === s.code);
    const div = document.createElement('div');
    div.className = `suggestion-item ${isDxAccepted ? 'accepted' : ''}`;
    
    let studiesHtml = '';
    const hasLabs = s.labs && s.labs.length > 0;
    const hasImaging = s.imaging && s.imaging.length > 0;
    
    if (hasLabs || hasImaging) {
      studiesHtml = `
        <div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);">
          <strong>Estudios recomendados para este diagnóstico:</strong>
          <div class="study-chips">
            ${s.labs.map(lab => {
              const isAccepted = activeConsultationState.labs.includes(lab);
              return `<span class="study-chip ${isAccepted ? 'accepted' : ''}" data-type="lab" data-name="${lab}">${isAccepted ? '✓' : '+'} Lab: ${lab}</span>`;
            }).join('')}
            ${s.imaging.map(img => {
              const isAccepted = activeConsultationState.imaging.includes(img);
              return `<span class="study-chip ${isAccepted ? 'accepted' : ''}" data-type="img" data-name="${img}">${isAccepted ? '✓' : '+'} Imagen: ${img}</span>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    let treatmentsHtml = '';
    const hasTreatments = s.treatments && s.treatments.length > 0;
    if (hasTreatments) {
      treatmentsHtml = `
        <div style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);">
          <strong>Tratamiento/Medicina recomendado:</strong>
          <div class="study-chips">
            ${s.treatments.map(tx => {
              const isAccepted = activeConsultationState.treatments.includes(tx);
              return `<span class="study-chip ${isAccepted ? 'accepted' : ''}" data-type="treatment" data-name="${tx}">${isAccepted ? '✓' : '+'} Tx: ${tx}</span>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    div.innerHTML = `
      <div class="suggestion-info">
        <div>
          <span class="suggestion-code">${s.code}</span>
          <span class="suggestion-desc">${s.description}</span>
        </div>
        ${studiesHtml}
        ${treatmentsHtml}
      </div>
      <div>
        <button type="button" class="btn ${isDxAccepted ? 'btn-danger' : 'btn-success'} btn-small btn-toggle-dx" data-code="${s.code}">
          ${isDxAccepted ? 'Quitar DX' : 'Aceptar DX'}
        </button>
      </div>
    `;

    // Bind Diagnóstico Toggle
    div.querySelector('.btn-toggle-dx').addEventListener('click', () => {
      toggleDiagnosis(s.code, s.description, s);
      triggerClinicalAssistant(text, gender, age);
    });

    // Bind Studies & Treatments Toggles
    div.querySelectorAll('.study-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const type = chip.getAttribute('data-type');
        const name = chip.getAttribute('data-name');
        toggleStudyOrTreatment(type, name);
        triggerClinicalAssistant(text, gender, age);
      });
    });

    box.appendChild(div);
  });

  // Actualizar los botones en la barra de acciones inferior
  updateAssistantActionButtons();
}

// Aceptar/Quitar diagnósticos sugeridos y auto-seleccionar sus recomendaciones asociadas
function toggleDiagnosis(code, description, suggestionObj) {
  const index = activeConsultationState.diagnoses.findIndex(d => d.code === code);
  if (index >= 0) {
    // Quitar diagnóstico
    activeConsultationState.diagnoses.splice(index, 1);
    
    // Deseleccionar recomendaciones asociadas a este diagnóstico (si el médico las tiene en su estado activo)
    if (suggestionObj) {
      if (suggestionObj.labs) {
        suggestionObj.labs.forEach(lab => {
          const idx = activeConsultationState.labs.indexOf(lab);
          if (idx >= 0) activeConsultationState.labs.splice(idx, 1);
        });
      }
      if (suggestionObj.imaging) {
        suggestionObj.imaging.forEach(img => {
          const idx = activeConsultationState.imaging.indexOf(img);
          if (idx >= 0) activeConsultationState.imaging.splice(idx, 1);
        });
      }
      if (suggestionObj.treatments) {
        suggestionObj.treatments.forEach(tx => {
          const idx = activeConsultationState.treatments.indexOf(tx);
          if (idx >= 0) activeConsultationState.treatments.splice(idx, 1);
        });
      }
    }
  } else {
    // Aceptar diagnóstico
    activeConsultationState.diagnoses.push({ code, description });
    
    // Auto-seleccionar por defecto todos los estudios de laboratorio, de imagenología y tratamientos recomendados
    if (suggestionObj) {
      if (suggestionObj.labs) {
        suggestionObj.labs.forEach(lab => {
          if (!activeConsultationState.labs.includes(lab)) {
            activeConsultationState.labs.push(lab);
          }
        });
      }
      if (suggestionObj.imaging) {
        suggestionObj.imaging.forEach(img => {
          if (!activeConsultationState.imaging.includes(img)) {
            activeConsultationState.imaging.push(img);
          }
        });
      }
      if (suggestionObj.treatments) {
        suggestionObj.treatments.forEach(tx => {
          if (!activeConsultationState.treatments.includes(tx)) {
            activeConsultationState.treatments.push(tx);
          }
        });
      }
    }
  }
}

// Aceptar/Quitar estudios o tratamientos de apoyo
function toggleStudyOrTreatment(type, name) {
  if (type === 'lab') {
    const index = activeConsultationState.labs.indexOf(name);
    if (index >= 0) {
      activeConsultationState.labs.splice(index, 1);
    } else {
      activeConsultationState.labs.push(name);
    }
  } else if (type === 'img') {
    const index = activeConsultationState.imaging.indexOf(name);
    if (index >= 0) {
      activeConsultationState.imaging.splice(index, 1);
    } else {
      activeConsultationState.imaging.push(name);
    }
  } else if (type === 'treatment') {
    const index = activeConsultationState.treatments.indexOf(name);
    if (index >= 0) {
      activeConsultationState.treatments.splice(index, 1);
    } else {
      activeConsultationState.treatments.push(name);
    }
  }
}

// Generar orden médica imprimible (Laboratorio o Imagenología)
function generateMedicalOrder(type) {
  const doctorName = document.getElementById('c-doctor').value;
  if (!doctorName) {
    alert("Por favor, seleccione un Médico Evaluador en el formulario para emitir la firma de la orden.");
    return;
  }

  const state = getAppState();
  const doctorObj = state.users.find(u => u.name === doctorName);
  const activePatientId = getActivePatientId();
  const patient = state.patients.find(p => p.id === activePatientId);
  const clinic = state.clinicInfo;

  if (!patient) return;

  const dob = new Date(patient.birthdate);
  const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  const dateFormatted = new Date().toLocaleDateString('es-GT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const modal = document.getElementById('prescription-print-modal');
  const previewContainer = document.getElementById('prescription-preview-content');
  const modalTitle = modal.querySelector('.modal-header h2');
  const printActionBtn = document.getElementById('btn-print-action');

  if (!modal || !previewContainer || !printActionBtn) return;

  let titleText = '';
  let subTitleText = '';
  let itemsHtml = '';
  let footerInstructions = '';

  if (type === 'labs') {
    titleText = 'ORDEN DE LABORATORIO CLÍNICO';
    subTitleText = 'Vista Preliminar de Orden de Laboratorio';
    itemsHtml = activeConsultationState.labs.map(lab => `
      <tr>
        <td style="text-align: left; padding: 12px 8px;">
          <strong style="color: #000; font-size: 1rem;">🔬 ${lab}</strong>
        </td>
      </tr>
    `).join('');
    footerInstructions = '📌 <em>Nota: Presentarse en ayunas (8 a 12 horas) para la toma de muestras de sangre. Examen de orina recolectar primera muestra de la mañana.</em>';
  } else {
    titleText = 'ORDEN DE IMAGENOLOGÍA / RADIOLOGÍA';
    subTitleText = 'Vista Preliminar de Orden de Imagenología';
    itemsHtml = activeConsultationState.imaging.map(img => `
      <tr>
        <td style="text-align: left; padding: 12px 8px;">
          <strong style="color: #000; font-size: 1rem;">🖼️ ${img}</strong>
        </td>
      </tr>
    `).join('');
    footerInstructions = '📌 <em>Nota: Presentar esta orden el día del estudio. Favor llevar placas o estudios radiológicos anteriores si dispone de ellos.</em>';
  }

  modalTitle.textContent = subTitleText;
  printActionBtn.innerHTML = '<span>🖨️</span> Imprimir Orden';

  previewContainer.innerHTML = `
    <div class="prescription-preview-box">
      <!-- Encabezado de la clínica -->
      <div class="prescription-preview-header">
        <div>
          <div class="prescription-preview-logo">${clinic.logoText} ${clinic.name}</div>
          <div style="font-size: 0.85rem; font-weight: 600; color: #555; margin-top: 4px;">Servicios Médicos de Diagnóstico</div>
        </div>
        <div class="prescription-preview-clinic-details">
          📍 ${clinic.address}<br>
          📞 Teléfono: ${clinic.phone}<br>
          ✉️ Email: ${clinic.email}
        </div>
      </div>

      <div style="text-align: center; margin: 1rem 0; padding: 6px; background-color: #f4f6f8; border-radius: 6px;">
        <h3 style="font-family: var(--font-heading); margin: 0; color: #000; font-size: 1.15rem; letter-spacing: 0.5px;">${titleText}</h3>
      </div>

      <!-- Información del paciente -->
      <div class="prescription-preview-patient-info">
        <div>
          <strong>Paciente:</strong> ${patient.name}<br>
          <strong>Edad:</strong> ${age} años | <strong>Género:</strong> ${patient.gender}
        </div>
        <div style="text-align: right;">
          <strong>Fecha:</strong> ${dateFormatted}<br>
          <strong>ID Paciente:</strong> ${patient.id}
        </div>
      </div>

      <div style="margin-top: 1.5rem; font-size: 0.95rem; font-weight: 600; color: #111; margin-bottom: 8px;">
        Estudios e Indicaciones Solicitadas:
      </div>

      <table class="prescription-preview-table">
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="margin-top: 1.5rem; font-size: 0.8rem; color: #555; border-top: 1px dashed #ccc; padding-top: 10px;">
        ${footerInstructions}
      </div>

      <!-- Firma del Médico -->
      <div class="prescription-preview-footer" style="margin-top: 3.5rem;">
        <div class="prescription-preview-signature-line"></div>
        <div class="prescription-preview-doctor-sign">${doctorObj.name}</div>
        <div class="prescription-preview-license">Colegiado Activo No. ${doctorObj.license || 'N/A'}</div>
      </div>
    </div>
  `;

  printActionBtn.onclick = () => {
    window.print();
  };

  modal.style.display = 'flex';
}

// Programar la transferencia de tratamientos recomendados al módulo de Recetario tras grabar consulta
function transferToRecetario() {
  const doctorName = document.getElementById('c-doctor').value;
  if (!doctorName) {
    alert("Por favor, seleccione un Médico Evaluador en el formulario antes de generar la receta.");
    return;
  }

  shouldRedirectToPrescriptionOnSave = true;

  // Cambiar visualización del botón para dar feedback
  const btn = document.getElementById('btn-transfer-recetario');
  if (btn) {
    btn.innerHTML = '✓ Receta Programada';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-info');
    btn.style.backgroundColor = 'var(--accent-secondary)';
    btn.style.borderColor = 'var(--accent-secondary)';
  }

  alert("Los medicamentos sugeridos han sido programados. Al hacer clic en 'Grabar Consulta', se guardará el expediente y se le redirigirá automáticamente al Recetario.");
}

// Analizador sintáctico sencillo de tratamientos a formato de medicamentos
function parseTreatmentToMedicine(txString) {
  let name = txString;
  let dosage = "Ver indicaciones de consulta";
  let presentation = "Tabletas";
  let duration = "Según indicación";

  if (txString.includes('(')) {
    const parts = txString.split('(');
    name = parts[0].trim();
    dosage = parts[1].replace(')', '').trim();
  }

  // Adivinar presentación
  const lower = txString.toLowerCase();
  if (lower.includes('cápsula') || lower.includes('capsula')) presentation = 'Cápsulas';
  else if (lower.includes('jarabe')) presentation = 'Jarabe';
  else if (lower.includes('suspensión') || lower.includes('suspension')) presentation = 'Suspensión';
  else if (lower.includes('ampolla')) presentation = 'Ampollas';
  else if (lower.includes('crema') || lower.includes('pomada')) presentation = 'Crema/Pomada';
  else if (lower.includes('gota')) presentation = 'Gotas';
  else if (lower.includes('inhalador') || lower.includes('salbutamol')) presentation = 'Inhalador';

  // Intentar deducir duración
  const durationMatch = lower.match(/por (\d+(-\d+)? días|semana|mes)/);
  if (durationMatch) {
    duration = durationMatch[0].replace('por ', '');
  }

  // Deducir cantidad sugerida razonable
  let quantity = "1 caja";
  if (lower.includes('tabletas') || lower.includes('cápsulas') || lower.includes('capsulas')) {
    quantity = "30 tabletas";
  } else if (lower.includes('frasco') || lower.includes('jarabe') || lower.includes('suspensión') || lower.includes('suspension')) {
    quantity = "1 frasco";
  } else if (lower.includes('tubo') || lower.includes('crema')) {
    quantity = "1 tubo";
  } else if (lower.includes('inhalador')) {
    quantity = "1 dispositivo";
  } else if (lower.includes('ampollas')) {
    quantity = "3 ampollas";
  }

  return {
    name,
    presentation,
    quantity,
    dosage,
    duration
  };
}

// Actualizar dinámicamente los botones de acción rápida en la barra inferior
function updateAssistantActionButtons() {
  const container = document.getElementById('assistant-action-buttons-container');
  if (!container) return;

  container.innerHTML = '';

  const hasAcceptedLabs = activeConsultationState.labs.length > 0;
  const hasAcceptedImaging = activeConsultationState.imaging.length > 0;
  const hasAcceptedTreatments = activeConsultationState.treatments.length > 0;

  if (hasAcceptedLabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-small';
    btn.id = 'btn-print-labs-order';
    btn.innerHTML = '🔬 Enviar Orden Lab';
    btn.addEventListener('click', () => generateMedicalOrder('labs'));
    container.appendChild(btn);
  }

  if (hasAcceptedImaging) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary btn-small';
    btn.id = 'btn-print-imaging-order';
    btn.innerHTML = '🖼️ Enviar Orden Imagen';
    btn.addEventListener('click', () => generateMedicalOrder('imaging'));
    container.appendChild(btn);
  }

  if (hasAcceptedTreatments) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-success btn-small';
    btn.id = 'btn-transfer-recetario';
    btn.innerHTML = '💊 Emitir Receta';
    btn.addEventListener('click', () => transferToRecetario());
    container.appendChild(btn);
  }
}

function initializeVoiceDictation() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Speech Recognition API not supported in this browser.");
    document.querySelectorAll('.btn-dictate').forEach(btn => {
      btn.style.opacity = '0.5';
      btn.title = "Dictado no soportado en este navegador (use Chrome/Edge)";
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        alert("El dictado por voz no está soportado en este navegador. Le recomendamos utilizar Google Chrome o Microsoft Edge.");
      });
    });
    return;
  }

  if (!document.getElementById('dictate-styles')) {
    const style = document.createElement('style');
    style.id = 'dictate-styles';
    style.textContent = `
      @keyframes pulse-mic {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.6; }
        100% { transform: scale(1); opacity: 1; }
      }
      .btn-dictate:hover {
        background: rgba(255, 255, 255, 0.08) !important;
        color: var(--accent-primary) !important;
      }
    `;
    document.head.appendChild(style);
  }

  document.querySelectorAll('.btn-dictate').forEach(btn => {
    const targetId = btn.getAttribute('data-target');
    const textarea = document.getElementById(targetId);
    if (!textarea) return;

    let recognition = null;
    let isListening = false;

    btn.addEventListener('click', (e) => {
      e.preventDefault();

      if (isListening) {
        if (recognition) recognition.stop();
        return;
      }

      // Inicializar reconocimiento
      recognition = new SpeechRecognition();
      recognition.lang = 'es-GT';
      recognition.continuous = false; // Parar al terminar la frase
      recognition.interimResults = false;

      recognition.onstart = () => {
        isListening = true;
        btn.style.color = '#ef4444';
        const mic = btn.querySelector('.mic-icon');
        if (mic) mic.style.animation = 'pulse-mic 1.2s infinite';
        const status = btn.querySelector('.dictate-status');
        if (status) status.textContent = 'Escuchando...';
        btn.style.background = 'rgba(239, 68, 68, 0.1)';
      };

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        const currentVal = textarea.value.trim();
        textarea.value = currentVal ? `${currentVal} ${transcript}` : transcript;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      };

      recognition.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        stopListening();
        if (event.error === 'not-allowed') {
          alert("Acceso denegado al micrófono. Permita el uso del micrófono en la configuración del navegador para usar el dictado.");
        }
      };

      recognition.onend = () => {
        stopListening();
      };

      function stopListening() {
        isListening = false;
        btn.style.color = 'var(--text-muted)';
        const mic = btn.querySelector('.mic-icon');
        if (mic) mic.style.animation = 'none';
        const status = btn.querySelector('.dictate-status');
        if (status) {
          status.textContent = 'Dictar';
          if (targetId === 'c-clinical-diagnosis') {
            status.style.color = 'var(--accent-primary)';
          }
        }
        btn.style.background = 'none';
      }

      recognition.start();
    });
  });
}
