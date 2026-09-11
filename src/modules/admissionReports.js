// src/modules/admissionReports.js
import { getAppState } from '../main.js';
import logoUrl from '../assets/logo.jpg';

/**
 * Muestra el modal de selección múltiple de reportes de ingreso hospitalario o emergencia.
 * @param {Object} episodeData Datos del episodio de encamamiento o emergencia
 * @param {Object} patient Datos del paciente
 * @param {string} moduleType 'encamamiento' | 'emergencias'
 */
export function showAdmissionReportsModal(episodeData, patient, moduleType = 'encamamiento') {
  if (!episodeData || !patient) {
    alert("No se encontraron los datos del ingreso o paciente para generar el reporte.");
    return;
  }

  // Asegurar que el modal exista en el DOM
  let modal = document.getElementById('admission-reports-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admission-reports-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.style.zIndex = '1200';
    document.body.appendChild(modal);
  }

  const isHosp = moduleType === 'encamamiento';
  const serviceTitle = isHosp ? 'Encamamiento / Hospitalización' : 'Emergencias / Observación';
  const locationLabel = isHosp 
    ? (episodeData.roomName || 'Habitación General') 
    : (episodeData.bedName || 'Área de Emergencia');
  
  const evosCount = (episodeData.evolutions || []).length;
  const nurseCount = (episodeData.nursingNotes || []).length;

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 580px; width: 95%;">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <h2 style="margin: 0; font-size: 1.2rem; color: var(--accent-primary); display: flex; align-items: center; gap: 8px;">
          <span>🖨️</span> Selección de Reportes de Ingreso
        </h2>
        <button class="modal-close" id="btn-close-rep-modal-x" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
      </div>

      <div class="modal-body" style="padding: 1.25rem 0; display: flex; flex-direction: column; gap: 14px;">
        <!-- Ficha Resumida del Paciente -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-left: 4px solid var(--accent-primary); border-radius: 6px; padding: 10px 14px;">
          <div style="font-weight: bold; font-size: 0.98rem; color: var(--text-primary);">${patient.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px; display: flex; flex-wrap: wrap; gap: 12px;">
            <span><strong>Expediente:</strong> ${patient.id}</span>
            <span><strong>Servicio:</strong> ${serviceTitle} (${locationLabel})</span>
            <span><strong>Ingreso:</strong> ${new Date(episodeData.admissionDate).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
        </div>

        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">
          Seleccione los reportes específicos que requiere generar e imprimir del expediente de ingreso:
        </p>

        <!-- Barra de Selección Múltiple -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          
          <!-- Reporte 1: Información del Paciente -->
          <label style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: border-color 0.2s;">
            <input type="checkbox" id="rep-chk-patient-info" class="rep-select-checkbox" value="patient_info" checked style="width: 18px; height: 18px; margin-top: 2px; accent-color: var(--accent-primary); cursor: pointer;">
            <div style="flex: 1;">
              <div style="font-weight: bold; color: var(--text-primary); font-size: 0.92rem; display: flex; justify-content: space-between; align-items: center;">
                <span>1. Información del Paciente (Ingreso)</span>
                <span style="font-size: 0.7rem; background: rgba(37,99,235,0.15); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Dossier Completo</span>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px; line-height: 1.35;">
                Incluye datos generales, signos vitales de ingreso, motivo de consulta, examen físico al ingreso, diagnóstico presuntivo y órdenes médicas iniciales.
              </div>
            </div>
          </label>

          <!-- Reporte 2: Evoluciones Médicas -->
          <label style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: border-color 0.2s;">
            <input type="checkbox" id="rep-chk-evolutions" class="rep-select-checkbox" value="evolutions" checked style="width: 18px; height: 18px; margin-top: 2px; accent-color: var(--accent-primary); cursor: pointer;">
            <div style="flex: 1;">
              <div style="font-weight: bold; color: var(--text-primary); font-size: 0.92rem; display: flex; justify-content: space-between; align-items: center;">
                <span>2. Evoluciones Médicas</span>
                <span style="font-size: 0.7rem; background: rgba(59,130,246,0.15); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${evosCount} notas</span>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px; line-height: 1.35;">
                Cronología completa de evoluciones clínicas, cambios de dieta, recetas asociadas y órdenes de laboratorio e imagenología.
              </div>
            </div>
          </label>

          <!-- Reporte 3: Notas de Enfermería -->
          <label style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: border-color 0.2s;">
            <input type="checkbox" id="rep-chk-nursing" class="rep-select-checkbox" value="nursing" checked style="width: 18px; height: 18px; margin-top: 2px; accent-color: var(--accent-primary); cursor: pointer;">
            <div style="flex: 1;">
              <div style="font-weight: bold; color: var(--text-primary); font-size: 0.92rem; display: flex; justify-content: space-between; align-items: center;">
                <span>3. Notas de Enfermería</span>
                <span style="font-size: 0.7rem; background: rgba(16,185,129,0.15); color: #34d399; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${nurseCount} notas</span>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px; line-height: 1.35;">
                Cronología completa de notas y turnos de enfermería, cuidados administrados, insumos aplicados y monitoreo de signos vitales.
              </div>
            </div>
          </label>

        </div>

        <!-- Controles de Selección Rápida -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px dashed var(--border-color); font-size: 0.8rem;">
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-small" id="btn-rep-select-all" style="padding: 3px 8px; font-size: 0.75rem;">Seleccionar Todos</button>
            <button type="button" class="btn btn-secondary btn-small" id="btn-rep-select-none" style="padding: 3px 8px; font-size: 0.75rem;">Limpiar</button>
          </div>
          <span id="rep-selected-count-badge" style="color: var(--text-muted); font-size: 0.78rem; font-weight: 600;">3 de 3 seleccionados</span>
        </div>
      </div>

      <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px;">
        <button type="button" class="btn btn-secondary" id="btn-close-rep-modal">Cerrar</button>
        <button type="button" class="btn btn-primary" id="btn-submit-generate-print" style="display: flex; align-items: center; gap: 8px; font-weight: bold; padding: 8px 18px;">
          <span>🖨️</span> Generar e Imprimir Reportes
        </button>
      </div>
    </div>
  `;

  // Bind Event Listeners
  const chkBoxes = modal.querySelectorAll('.rep-select-checkbox');
  const countBadge = modal.querySelector('#rep-selected-count-badge');

  function updateCount() {
    const selected = Array.from(chkBoxes).filter(c => c.checked).length;
    if (countBadge) {
      countBadge.textContent = `${selected} de 3 seleccionados`;
    }
  }

  chkBoxes.forEach(chk => {
    chk.addEventListener('change', updateCount);
  });

  const btnSelectAll = modal.querySelector('#btn-rep-select-all');
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      chkBoxes.forEach(c => { c.checked = true; });
      updateCount();
    });
  }

  const btnSelectNone = modal.querySelector('#btn-rep-select-none');
  if (btnSelectNone) {
    btnSelectNone.addEventListener('click', () => {
      chkBoxes.forEach(c => { c.checked = false; });
      updateCount();
    });
  }

  const closeModal = () => {
    modal.style.display = 'none';
  };

  const btnCloseX = modal.querySelector('#btn-close-rep-modal-x');
  const btnClose = modal.querySelector('#btn-close-rep-modal');
  if (btnCloseX) btnCloseX.addEventListener('click', closeModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);

  const btnSubmit = modal.querySelector('#btn-submit-generate-print');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', () => {
      const selectedReports = Array.from(chkBoxes)
        .filter(c => c.checked)
        .map(c => c.value);

      if (selectedReports.length === 0) {
        alert("Por favor seleccione al menos un reporte para generar.");
        return;
      }

      closeModal();
      generateAndPrintAdmissionReports(episodeData, patient, selectedReports, moduleType);
    });
  }

  modal.style.display = 'flex';
}

/**
 * Genera el documento HTML completo e interactúa con el diálogo de impresión del navegador.
 * @param {Object} episodeData Datos del episodio
 * @param {Object} patient Datos del paciente
 * @param {Array<string>} selectedReports Lista con 'patient_info', 'evolutions', 'nursing'
 * @param {string} moduleType 'encamamiento' | 'emergencias'
 */
export function generateAndPrintAdmissionReports(episodeData, patient, selectedReports = ['patient_info', 'evolutions', 'nursing'], moduleType = 'encamamiento') {
  const state = getAppState();
  const clinic = state.clinicInfo || {
    name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ',
    phone: '2200-0000',
    address: 'Sayaxché, Petén, Guatemala',
    email: 'contacto@multimedicasayaxche.com'
  };

  const dob = patient.birthdate ? new Date(patient.birthdate) : null;
  const age = dob && !isNaN(dob.getTime()) 
    ? Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970) 
    : (patient.age || 'N/A');

  const admissionDateStr = episodeData.admissionDate 
    ? new Date(episodeData.admissionDate).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
    : 'No registrada';

  const isHosp = moduleType === 'encamamiento';
  const serviceLabel = isHosp 
    ? `Encamamiento (${episodeData.roomName || 'Habitación General'})` 
    : `Emergencias / Observación (${episodeData.bedName || 'Área de Urgencias'})`;

  const vitals = episodeData.initialVitals || {};

  // Función interna para renderizar el encabezado institucional oficial
  function renderClinicHeader(docTitle, docCode) {
    const logoHtml = clinic.logoData 
      ? `<img src="${clinic.logoData}" style="max-height: 60px; max-width: 160px; object-fit: contain;">`
      : `<img src="${logoUrl}" style="max-height: 60px; max-width: 160px; object-fit: contain;">`;

    return `
      <div class="clinic-header">
        <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
          ${logoHtml}
          <div>
            <h1 style="margin: 0; font-size: 1.15rem; color: #1e3a8a; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 800; text-transform: uppercase;">${clinic.name || 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ'}</h1>
            <div style="font-size: 0.76rem; color: #475569; margin-top: 1px; font-weight: 600;">Atención Médica, Quirúrgica y Hospitalaria 24 Horas</div>
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 1px;">
              📍 ${clinic.address || 'Sayaxché, Petén, Guatemala'} | 📞 PBX: ${clinic.phone || '2200-0000'} | ✉️ ${clinic.email || 'contacto@multimedicasayaxche.com'}
            </div>
          </div>
        </div>
        <div style="text-align: right; min-width: 200px;">
          <div style="background: #1e3a8a; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.78rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
            ${docTitle}
          </div>
          <div style="font-size: 0.7rem; color: #64748b; margin-top: 3px; font-weight: 600;">
            CÓDIGO: <span style="color: #1e3a8a;">${docCode}</span> | FOLIO: <span style="color: #111;">${episodeData.id}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Función interna para renderizar el encabezado de información básica del paciente (requerido para reportes 2 y 3)
  function renderBasicPatientBanner(sectionTitle = '') {
    return `
      <div class="patient-basic-banner">
        ${sectionTitle ? `<div style="font-weight: bold; color: #1e3a8a; font-size: 0.82rem; margin-bottom: 5px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 3px; text-transform: uppercase;">${sectionTitle}</div>` : ''}
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 6px; margin-bottom: 5px;">
          <div><strong>Paciente:</strong> <span style="font-size: 0.9rem; font-weight: 700; color: #0f172a;">${patient.name}</span></div>
          <div><strong>No. Expediente:</strong> ${patient.id || 'N/A'}</div>
          <div><strong>DPI:</strong> ${patient.dpi || 'N/A'}</div>
          <div><strong>Edad / Sexo:</strong> ${age} años / ${patient.gender || 'N/A'}</div>
        </div>
        <div style="display: grid; grid-template-columns: 2fr 1.5fr 1.5fr; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 5px;">
          <div><strong>Servicio / Cama:</strong> <span style="color: #1e3a8a; font-weight: 600;">${serviceLabel}</span></div>
          <div><strong>Fecha de Ingreso:</strong> ${admissionDateStr}</div>
          <div><strong>Médico Tratante:</strong> Dr. ${episodeData.doctorName || 'No asignado'}</div>
        </div>
        <div style="margin-top: 5px; border-top: 1px solid #e2e8f0; padding-top: 5px;">
          <strong>Diagnóstico al Ingreso:</strong> <span style="color: #334155; font-weight: 500;">${episodeData.admissionReason || 'No especificado'}</span>
        </div>
      </div>
    `;
  }

  // Construir secciones del documento
  let htmlSections = [];
  let sectionIndex = 0;

  // 1. REPORTE #1: INFORMACIÓN DEL PACIENTE (INGRESO)
  if (selectedReports.includes('patient_info')) {
    sectionIndex++;
    const docCode = isHosp ? 'HMM-HOSP-ING-01' : 'HMM-EMERG-ING-01';
    const chiefComplaintText = episodeData.chiefComplaint || episodeData.admissionDetail || episodeData.admissionReason || 'No especificado';
    const physicalExamText = episodeData.physicalExam || 'No registrado detalladamente al ingreso.';

    htmlSections.push(`
      <div class="report-section section-patient-info" style="${sectionIndex > 1 ? 'page-break-before: always; margin-top: 20px;' : ''}">
        ${renderClinicHeader('HOJA DE INGRESO Y EXPEDIENTE CLÍNICO', docCode)}

        <div class="section-title">I. Datos Generales del Paciente y Admisión</div>
        <table class="data-table">
          <tr>
            <th style="width: 18%;">Nombre Completo:</th>
            <td style="width: 42%; font-weight: bold; color: #0f172a;">${patient.name}</td>
            <th style="width: 18%;">No. Expediente:</th>
            <td style="width: 22%; font-weight: bold; color: #1e3a8a;">${patient.id}</td>
          </tr>
          <tr>
            <th>DPI / CUI:</th>
            <td>${patient.dpi || 'N/A'}</td>
            <th>Edad / Sexo:</th>
            <td>${age} años / ${patient.gender || 'N/A'}</td>
          </tr>
          <tr>
            <th>Teléfono:</th>
            <td>${patient.telephone || 'N/A'}</td>
            <th>Dirección:</th>
            <td>${patient.address || 'N/A'}</td>
          </tr>
          <tr>
            <th>Servicio / Ubicación:</th>
            <td style="font-weight: bold; color: #1e3a8a;">${serviceLabel}</td>
            <th>Fecha y Hora Ingreso:</th>
            <td>${admissionDateStr}</td>
          </tr>
          <tr>
            <th>Médico Tratante:</th>
            <td>Dr. ${episodeData.doctorName || 'No asignado'}</td>
            <th>Familiar Responsable:</th>
            <td>${episodeData.responsibleFamilyName || 'N/A'} ${episodeData.responsibleFamilyPhone ? '(' + episodeData.responsibleFamilyPhone + ')' : ''}</td>
          </tr>
          ${episodeData.triageColor ? `
            <tr>
              <th>Clasificación Triage:</th>
              <td colspan="3"><span style="font-weight: bold; padding: 1px 6px; border-radius: 3px; background: #e0f2fe; color: #0369a1; font-size: 0.78rem;">Prioridad: ${episodeData.triageColor}</span></td>
            </tr>
          ` : ''}
        </table>

        <div class="section-title">II. Signos Vitales al Ingreso</div>
        <table class="data-table vitals-table">
          <thead>
            <tr>
              <th>Temperatura</th>
              <th>Presión Arterial</th>
              <th>Frecuencia Cardíaca</th>
              <th>Frecuencia Respiratoria</th>
              <th>Saturación O₂</th>
              <th>Glucosa Capilar</th>
              <th>Peso / Talla</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${vitals.temp ? vitals.temp + ' °C' : '-'}</td>
              <td>${vitals.bp_systolic && vitals.bp_diastolic ? vitals.bp_systolic + '/' + vitals.bp_diastolic + ' mmHg' : (vitals.bp || '-')}</td>
              <td>${vitals.heart_rate ? vitals.heart_rate + ' LPM' : '-'}</td>
              <td>${vitals.resp_rate ? vitals.resp_rate + ' RPM' : '-'}</td>
              <td>${vitals.oxygen ? vitals.oxygen + ' %' : '-'}</td>
              <td>${vitals.glucose ? vitals.glucose + ' mg/dL' : '-'}</td>
              <td>${vitals.weight ? vitals.weight + ' kg' : '-'} / ${vitals.height ? vitals.height + ' cm' : '-'}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">III. Motivo de Consulta e Historia de la Enfermedad Actual</div>
        <div class="info-box">
          <p style="white-space: pre-wrap; margin: 0; color: #1e293b; line-height: 1.4;">${chiefComplaintText}</p>
        </div>

        <div class="section-title">IV. Diagnóstico al Ingreso y Tipo de Dieta</div>
        <div class="info-box" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px; flex-wrap: wrap;">
          <div style="flex: 1.5;">
            <strong>🩺 Diagnóstico Presuntivo / Motivo de Hospitalización:</strong>
            <div style="color: #0f172a; font-weight: 600; margin-top: 2px;">${episodeData.admissionReason || 'No especificado'}</div>
          </div>
          <div style="flex: 1; border-left: 1px dashed #cbd5e1; padding-left: 15px;">
            <strong>🥦 Dieta Inicial Prescrita:</strong>
            <div style="color: #1e3a8a; font-weight: bold; margin-top: 2px;">${episodeData.dietType || 'Dieta Libre / Normal'}</div>
          </div>
        </div>

        <div class="section-title">V. Examen Físico al Ingreso</div>
        <div class="info-box">
          <p style="white-space: pre-wrap; margin: 0; color: #334155; line-height: 1.4; font-family: inherit;">${physicalExamText}</p>
        </div>

        <div class="section-title">VI. Órdenes Médicas e Indicaciones de Ingreso</div>
        <div class="info-box" style="background: #ffffff;">
          <strong style="color: #1e3a8a;">📋 Plan de Manejo y Órdenes Iniciales:</strong>
          <p style="white-space: pre-wrap; font-family: monospace; font-size: 0.8rem; color: #334155; margin: 4px 0 0 0; line-height: 1.35;">${episodeData.admissionOrders || episodeData.initialOrders || 'Sin órdenes iniciales registradas'}</p>
          ${episodeData.specialIndications && episodeData.specialIndications.length > 0 ? `
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 8px;">
              <strong style="color: #1e3a8a;">📢 Indicaciones Especiales:</strong>
              <ul style="margin: 3px 0 0 0; padding-left: 18px; font-size: 0.78rem; color: #1e3a8a;">
                ${episodeData.specialIndications.map(ind => `<li>${ind}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <div class="signatures-box">
          <div style="border-top: 1px solid #111; width: 220px; text-align: center; padding-top: 4px;">
            <strong>Firma y Sello del Médico</strong><br>
            <span style="font-size: 0.74rem; color: #64748b;">Dr. ${episodeData.doctorName || 'Médico Tratante'}</span>
          </div>
          <div style="border-top: 1px solid #111; width: 220px; text-align: center; padding-top: 4px;">
            <strong>Firma Paciente / Familiar</strong><br>
            <span style="font-size: 0.74rem; color: #64748b;">${episodeData.responsibleFamilyName || patient.name}</span>
          </div>
        </div>
      </div>
    `);
  }

  // 2. REPORTE #2: EVOLUCIONES MÉDICAS (Con Encabezado Institucional + Información Básica del Paciente)
  if (selectedReports.includes('evolutions')) {
    sectionIndex++;
    const docCode = isHosp ? 'HMM-HOSP-EVO-02' : 'HMM-EMERG-EVO-02';
    const evos = episodeData.evolutions || [];
    const prescs = episodeData.prescriptions || [];

    htmlSections.push(`
      <div class="report-section section-evolutions" style="${sectionIndex > 1 ? 'page-break-before: always; margin-top: 20px;' : ''}">
        <!-- Encabezado Institucional Requerido -->
        ${renderClinicHeader('CRONOLOGÍA DE NOTAS DE EVOLUCIÓN MÉDICA', docCode)}

        <!-- Información Básica del Paciente Requerida -->
        ${renderBasicPatientBanner('INFORMACIÓN BÁSICA DEL PACIENTE')}

        <div class="section-title">Registro Cronológico de Notas de Evolución Médica y Prescripciones</div>

        ${evos.length > 0 ? evos.map((e, idx) => `
          <div class="evo-item-card">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 5px;">
              <div>
                <span style="font-weight: bold; color: #1e3a8a; font-size: 0.84rem;">Evolución #${idx + 1} - 📅 ${new Date(e.date).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span style="font-size: 0.78rem; color: #475569; margin-left: 8px;">| Médico: <strong>Dr. ${e.doctorName || episodeData.doctorName}</strong></span>
              </div>
              <div>
                <span style="font-size: 0.72rem; background: #e0f2fe; color: #0369a1; padding: 1px 6px; border-radius: 3px; font-weight: 600;">🥦 Dieta: ${e.diet || episodeData.dietType || 'Libre / Normal'}</span>
              </div>
            </div>

            <div style="font-size: 0.82rem; color: #1e293b; line-height: 1.4; white-space: pre-wrap; margin-bottom: 5px;">${e.note}</div>

            ${(e.medications && e.medications.length > 0) ? `
              <div style="margin-top: 5px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 8px; border-radius: 3px; font-size: 0.76rem;">
                <strong style="color: #1e3a8a;">💊 Medicamentos Prescritos / Modificados:</strong>
                <ul style="margin: 2px 0 0 0; padding-left: 16px; color: #334155;">
                  ${e.medications.map(m => `<li><strong>${m.name}</strong> - Cant/Dosis: ${m.qty || m.cantidad_o_dosis || '1'} ${m.unidad_dispensable || m.unidad_medida_dosis || ''} ${m.instructions ? `(${m.instructions})` : ''}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${(e.laboratoryTests && e.laboratoryTests.length > 0) ? `
              <div style="margin-top: 4px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 8px; border-radius: 3px; font-size: 0.76rem;">
                <strong style="color: #0d9488;">🔬 Exámenes de Laboratorio Solicitados:</strong>
                <span style="color: #334155; margin-left: 5px;">${e.laboratoryTests.map(l => l.name).join(', ')}</span>
              </div>
            ` : ''}

            ${(e.imagingStudies && e.imagingStudies.length > 0) ? `
              <div style="margin-top: 4px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 8px; border-radius: 3px; font-size: 0.76rem;">
                <strong style="color: #7c3aed;">🖼️ Estudios de Imagen Solicitados:</strong>
                <span style="color: #334155; margin-left: 5px;">${e.imagingStudies.map(i => i.name).join(', ')}</span>
              </div>
            ` : ''}
          </div>
        `).join('') : `
          <div style="padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; text-align: center; color: #64748b; font-style: italic; font-size: 0.8rem; margin-bottom: 12px;">
            No se registran notas de evolución médica durante esta estancia.
          </div>
        `}

        ${(!isHosp && prescs.length > 0) ? `
          <div class="section-title" style="margin-top: 15px;">Prescripciones y Órdenes Médicas Adicionales</div>
          ${prescs.map((pr, pidx) => `
            <div style="border: 1px solid #cbd5e1; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 8px 10px; margin-bottom: 8px; background: #ffffff;">
              <div style="font-weight: bold; font-size: 0.8rem; color: #b45309; margin-bottom: 3px;">
                Prescripción #${pidx + 1} - 📅 ${new Date(pr.date).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })} | Dr. ${pr.doctorName}
              </div>
              <p style="margin: 0; white-space: pre-wrap; font-size: 0.78rem; color: #1e293b; line-height: 1.35;">${pr.orders}</p>
            </div>
          `).join('')}
        ` : ''}

        <div class="signatures-box">
          <div style="border-top: 1px solid #111; width: 220px; text-align: center; padding-top: 4px;">
            <strong>Firma y Sello del Médico Tratante</strong><br>
            <span style="font-size: 0.74rem; color: #64748b;">Dr. ${episodeData.doctorName || 'Médico de Turno'}</span>
          </div>
          <div style="border-top: 1px solid #111; width: 220px; text-align: center; padding-top: 4px;">
            <strong>Jefatura de Servicio Médico</strong><br>
            <span style="font-size: 0.74rem; color: #64748b;">Hospital Privado Multimédica Sayaxché</span>
          </div>
        </div>
      </div>
    `);
  }

  // 3. REPORTE #3: NOTAS DE ENFERMERÍA (Con Encabezado Institucional + Información Básica del Paciente)
  if (selectedReports.includes('nursing')) {
    sectionIndex++;
    const docCode = isHosp ? 'HMM-HOSP-ENF-03' : 'HMM-EMERG-ENF-03';
    const notes = episodeData.nursingNotes || [];
    const vitalsHistory = episodeData.vitalsHistory || [];

    htmlSections.push(`
      <div class="report-section section-nursing" style="${sectionIndex > 1 ? 'page-break-before: always; margin-top: 20px;' : ''}">
        <!-- Encabezado Institucional Requerido -->
        ${renderClinicHeader('CRONOLOGÍA DE NOTAS DE ENFERMERÍA Y CUIDADOS', docCode)}

        <!-- Información Básica del Paciente Requerida -->
        ${renderBasicPatientBanner('INFORMACIÓN BÁSICA DEL PACIENTE')}

        <div class="section-title">Registro Cronológico de Notas de Enfermería y Cuidados Administrados</div>

        ${notes.length > 0 ? notes.map((n, idx) => `
          <div class="nurse-item-card">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 5px;">
              <div>
                <span style="font-weight: bold; color: #047857; font-size: 0.84rem;">Nota #${idx + 1} - 📅 ${new Date(n.date).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span style="font-size: 0.78rem; color: #475569; margin-left: 8px;">| Personal: <strong>Enf. ${n.nurseName || 'Turno'}</strong></span>
              </div>
            </div>

            <div style="font-size: 0.82rem; color: #1e293b; line-height: 1.4; white-space: pre-wrap; margin-bottom: 5px;">${n.note}</div>

            ${(n.administeredCare && n.administeredCare.length > 0) ? `
              <div style="margin-top: 4px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 6px; border-radius: 3px; font-size: 0.76rem; color: #065f46;">
                <strong>🩺 Cuidados Clínicos Administrados:</strong> ${n.administeredCare.join(', ')}
              </div>
            ` : ''}

            ${(n.supplies && n.supplies.length > 0) ? `
              <div style="margin-top: 4px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 6px; border-radius: 3px; font-size: 0.76rem; color: #334155;">
                <strong>🩹 Insumos y Material Quirúrgico Aplicado:</strong> ${n.supplies.map(s => `${s.name} (x${s.qty})`).join(', ')}
              </div>
            ` : ''}
          </div>
        `).join('') : `
          <div style="padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; text-align: center; color: #64748b; font-style: italic; font-size: 0.8rem; margin-bottom: 12px;">
            No se registran notas de enfermería durante esta estancia.
          </div>
        `}

        ${vitalsHistory.length > 0 ? `
          <div class="section-title" style="margin-top: 15px;">Monitoreo de Signos Vitales por Personal de Enfermería</div>
          <table class="data-table vitals-table" style="font-size: 0.76rem;">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Temp (°C)</th>
                <th>P/A (mmHg)</th>
                <th>F.C. (LPM)</th>
                <th>F.R. (RPM)</th>
                <th>Sat O₂ (%)</th>
                <th>Glucosa (mg/dL)</th>
                <th>Personal Responsable</th>
              </tr>
            </thead>
            <tbody>
              ${vitalsHistory.map(v => `
                <tr>
                  <td>${new Date(v.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>${v.temp || '-'}</td>
                  <td>${v.bp_systolic && v.bp_diastolic ? v.bp_systolic + '/' + v.bp_diastolic : (v.bp || '-')}</td>
                  <td>${v.heart_rate || '-'}</td>
                  <td>${v.resp_rate || '-'}</td>
                  <td>${v.oxygen ? v.oxygen + '%' : '-'}</td>
                  <td>${v.glucose || '-'}</td>
                  <td>${v.registeredBy || 'Enfermería'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="signatures-box">
          <div style="border-top: 1px solid #111; width: 220px; text-align: center; padding-top: 4px;">
            <strong>Firma de Enfermera(o)</strong><br>
            <span style="font-size: 0.74rem; color: #64748b;">Personal Responsable de Turno</span>
          </div>
          <div style="border-top: 1px solid #111; width: 220px; text-align: center; padding-top: 4px;">
            <strong>Supervisión de Enfermería</strong><br>
            <span style="font-size: 0.74rem; color: #64748b;">Hospital Privado Multimédica Sayaxché</span>
          </div>
        </div>
      </div>
    `);
  }

  // Abrir ventana de impresión
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Por favor permita las ventanas emergentes en su navegador para imprimir los reportes.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Reportes de Ingreso - ${patient.name}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 10mm 12mm 10mm 12mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.35;
            padding: 15px;
            margin: 0 auto;
            max-width: 820px;
            background: #ffffff;
            font-size: 11.5px;
          }
          .clinic-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .patient-basic-banner {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-left: 4px solid #1e3a8a;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 12px;
            font-size: 0.8rem;
          }
          .section-title {
            color: #1e3a8a;
            border-bottom: 1.5px solid #cbd5e1;
            font-size: 0.86rem;
            font-weight: 700;
            margin-top: 12px;
            margin-bottom: 6px;
            padding-bottom: 2px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          table.data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.8rem;
            margin-bottom: 10px;
          }
          table.data-table th, table.data-table td {
            border: 1px solid #cbd5e1;
            padding: 4px 6px;
            text-align: left;
            vertical-align: middle;
          }
          table.data-table th {
            background-color: #f1f5f9;
            font-weight: 600;
            color: #334155;
          }
          table.vitals-table th {
            text-align: center;
            font-size: 0.76rem;
          }
          table.vitals-table td {
            text-align: center;
            font-size: 0.78rem;
          }
          .info-box {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 8px 10px;
            margin-bottom: 10px;
            font-size: 0.8rem;
          }
          .evo-item-card {
            border: 1px solid #cbd5e1;
            border-left: 4px solid #1e3a8a;
            border-radius: 4px;
            padding: 8px 10px;
            margin-bottom: 10px;
            background: #ffffff;
          }
          .nurse-item-card {
            border: 1px solid #cbd5e1;
            border-left: 4px solid #10b981;
            border-radius: 4px;
            padding: 8px 10px;
            margin-bottom: 10px;
            background: #ffffff;
          }
          .signatures-box {
            margin-top: 25px;
            display: flex;
            justify-content: space-between;
            font-size: 0.8rem;
          }
          .no-print {
            margin-bottom: 18px;
            padding: 10px 15px;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .btn-print {
            padding: 7px 16px;
            background: #1e3a8a;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.85rem;
          }
          .btn-close {
            padding: 7px 14px;
            background: #ffffff;
            color: #334155;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.82rem;
          }
          @media print {
            .no-print { display: none !important; }
            body {
              padding: 0 !important;
              margin: 0 !important;
              max-width: 100% !important;
              font-size: 11px !important;
            }
            .page-break { page-break-before: always !important; }
            .report-section { page-break-inside: auto; }
            .signatures-box { page-break-inside: avoid !important; }
            .evo-item-card, .nurse-item-card, .info-box, table.data-table, .patient-basic-banner {
              page-break-inside: avoid !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <div>
            <strong style="color: #1e3a8a; font-size: 0.95rem;">Expediente de Ingreso Hospitalario</strong>
            <span style="color: #64748b; font-size: 0.82rem; margin-left: 10px;">Paciente: ${patient.name}</span>
          </div>
          <div>
            <button class="btn-print" onclick="window.print();">🖨️ Imprimir / Guardar PDF</button>
            <button class="btn-close" onclick="window.close();" style="margin-left: 8px;">Cerrar</button>
          </div>
        </div>

        ${htmlSections.join('\n')}
      </body>
    </html>
  `);
  printWindow.document.close();
}
