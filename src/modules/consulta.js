// src/modules/consulta.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId } from '../main.js';
import { searchDiagnosticSuggestions } from '../data/cie10.js';

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

  // Bind búsqueda de pacientes
  const searchInput = document.getElementById('consult-patient-search');
  searchInput.addEventListener('input', (e) => {
    renderPatientList(e.target.value);
  });

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

// Seleccionar paciente, actualizar barra lateral y cargar formulario
function selectPatient(patientId) {
  setActivePatientId(patientId);
  
  // Actualizar clases seleccionadas en la barra lateral
  const items = document.querySelectorAll('#consult-patient-list .patient-item');
  const state = getAppState();
  const patient = state.patients.find(p => p.id === patientId);
  
  // Re-renderizar lista para marcar el seleccionado
  renderPatientList(document.getElementById('consult-patient-search').value);

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

  // Renderizar el formulario
  const doctors = state.users.filter(u => u.role === 'medico');
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
      ${c.clinicalDiagnosis ? `<div style="font-size: 0.8rem; margin-top: 4px; color: var(--accent-success);"><strong>Dx Clínico:</strong> ${c.clinicalDiagnosis}</div>` : ''}
      ${c.referral ? `<div style="font-size: 0.75rem; margin-top: 4px; color: var(--accent-secondary);">🤝 <strong>Interconsulta:</strong> ${c.referral.doctorName}</div>` : ''}
      <div style="font-size: 0.75rem; margin-top: 6px; color: var(--accent-primary);">
        CIE-10: ${c.diagnosisCodes && c.diagnosisCodes.length ? c.diagnosisCodes.join(', ') : 'N/A'}
      </div>
    `;

    li.addEventListener('click', () => {
      showPastConsultationDetail(c);
    });

    container.appendChild(li);
  });
}

// Mostrar detalle de una consulta previa
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
          T: ${latestVitals.temp}°C | P.A: ${latestVitals.bp_systolic}/${latestVitals.bp_diastolic} mmHg | F.C: ${latestVitals.heart_rate} lpm | SPO2: ${latestVitals.oxygen}% | Peso: ${latestVitals.weight}kg
        </div>
        <div style="font-weight: bold; color: var(--accent-primary);">IMC: ${latestVitals.bmi}</div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="glass-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h2 style="font-family: var(--font-heading); color: var(--accent-primary); margin: 0;">Consulta: ${patient.name}</h2>
        <span style="font-size: 0.85rem; padding: 4px 10px; background: rgba(255,255,255,0.05); border-radius: 12px; color: var(--text-muted);">Exp: ${patient.id}</span>
      </div>

      ${vitalsAlertHtml}
      
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
          <label for="c-reason">Motivo de la Consulta</label>
          <textarea id="c-reason" required placeholder="Ej. Paciente refiere dolor de garganta y fiebre de 2 días de evolución..." style="min-height: 80px;"></textarea>
        </div>

        <div class="form-group">
          <label for="c-symptoms">Síntomas / Examen Físico</label>
          <textarea id="c-symptoms" required placeholder="Ej. Faringe congestiva con placas purulentas, ganglios submandibulares inflamados..." style="min-height: 100px;"></textarea>
        </div>

        <div class="form-group" style="margin-top: 1.25rem;">
          <label for="c-clinical-diagnosis" style="font-weight: 700; color: var(--accent-primary);">Diagnóstico Clínico del Médico</label>
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
      fee
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
      const doctorObj = stateObj.users.find(u => u.name === doctor || u.id === doctor || (u.role === 'medico' && u.name.includes(doctor)));
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
