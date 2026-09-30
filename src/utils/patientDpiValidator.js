/**
 * src/utils/patientDpiValidator.js
 * Sistema de Validación y Prevención de Duplicados de Pacientes por DPI / CUI en LUGAMED
 */

// Normaliza el DPI eliminando espacios, guiones, puntos y mayúsculas
export function normalizeDpi(rawDpi) {
  if (!rawDpi) return '';
  return String(rawDpi).replace(/[\s\-\.]/g, '').trim().toUpperCase();
}

// Verifica si un texto de DPI es un marcador genérico o un documento no válido
export function isGenericDpi(rawDpi) {
  if (!rawDpi) return true;
  const cleaned = normalizeDpi(rawDpi);
  if (!cleaned || cleaned.length < 4) return true;

  const upper = String(rawDpi).trim().toUpperCase();
  const genericPlaceholders = [
    'MENOR DE EDAD',
    'MENOR',
    'NO PRESENTA DOCUMENTO',
    'NO PRESENTA',
    'SIN DOCUMENTO',
    'NO POSEE',
    'NO POSEE DOCUMENTO',
    'NO PROVISTO',
    'NO TIENE',
    'N/A',
    'NA',
    'PENDIENTE',
    'DESCONOCIDO',
    'EXTRANJERO SIN DPI'
  ];

  if (genericPlaceholders.some(p => upper === p || upper.includes(p))) {
    return true;
  }

  // Si no contiene ningún número o letra
  if (!/[0-9A-Z]/.test(cleaned)) {
    return true;
  }

  return false;
}

// Busca si ya existe un paciente con el mismo DPI
export function findExistingPatientByDpi(rawDpi, patients = [], excludePatientId = null) {
  if (isGenericDpi(rawDpi)) return null;
  const targetNorm = normalizeDpi(rawDpi);
  if (!targetNorm) return null;

  return (patients || []).find(p => {
    if (!p) return false;
    if (excludePatientId && p.id === excludePatientId) return false;
    if (isGenericDpi(p.dpi)) return false;

    const pNorm = normalizeDpi(p.dpi);
    return pNorm === targetNorm;
  }) || null;
}

// Calcula la edad legible
function calculateAge(birthdate) {
  if (!birthdate) return 'Edad no disponible';
  const dob = new Date(birthdate);
  if (isNaN(dob.getTime())) return 'Edad no disponible';
  const diffMs = Date.now() - dob.getTime();
  const ageYears = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  return `${ageYears} año${ageYears === 1 ? '' : 's'}`;
}

/**
 * Despliega la ventana modal interactiva indicando que el paciente ya se encuentra registrado con ese DPI
 * @param {Object} existingPatient - Objeto del paciente ya registrado
 * @param {Function} onSelectExisting - Callback opcional para abrir su expediente
 * @param {Function} onCancel - Callback opcional al cancelar/cerrar
 */
export function showDuplicatePatientModal(existingPatient, onSelectExisting = null, onCancel = null) {
  if (!existingPatient) return;

  // Remover cualquier modal duplicado previo si existiera
  const existingModal = document.getElementById('duplicate-patient-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'duplicate-patient-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(3, 7, 18, 0.88);
    backdrop-filter: blur(10px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    box-sizing: border-box;
    font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
  `;

  const totalConsultations = (existingPatient.consultations || []).length;
  const totalPrescriptions = (existingPatient.prescriptions || []).length;
  const totalLabs = (existingPatient.labHistory || []).length;
  const totalImaging = (existingPatient.imagingHistory || []).length;
  const ageDisplay = calculateAge(existingPatient.birthdate);

  modal.innerHTML = `
    <div style="
      background: linear-gradient(145deg, #1e293b, #0f172a);
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-top: 5px solid #ef4444;
      border-radius: 16px;
      width: 100%;
      max-width: 580px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(239, 68, 68, 0.2);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      color: #f8fafc;
    ">
      
      <!-- Encabezado del Modal -->
      <div style="
        padding: 1.25rem 1.5rem;
        background: rgba(239, 68, 68, 0.12);
        border-bottom: 1px solid rgba(239, 68, 68, 0.25);
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: rgba(239, 68, 68, 0.25);
            color: #ef4444;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.6rem;
            border: 1px solid rgba(239, 68, 68, 0.4);
          ">⚠️</div>
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #f87171; letter-spacing: -0.3px;">
              ¡PACIENTE YA REGISTRADO!
            </h3>
            <span style="font-size: 0.8rem; color: #cbd5e1; display: block; margin-top: 2px;">
              El DPI / CUI ingresado ya pertenece a un expediente existente
            </span>
          </div>
        </div>
        <button id="btn-close-dup-modal-x" style="
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1.4rem;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.15s;
        " title="Cerrar">&times;</button>
      </div>

      <!-- Cuerpo del Modal con Información del Paciente -->
      <div style="padding: 1.5rem; overflow-y: auto; max-height: 70vh;">
        
        <div style="
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 1.25rem;
          font-size: 0.875rem;
          color: #fca5a5;
          line-height: 1.45;
        ">
          <strong>Atención:</strong> Para evitar duplicidad de historiales clínicos, tratamientos y recetas, el sistema no permite duplicar este paciente. Verifica la información del expediente encontrado:
        </div>

        <!-- Ficha Resumen del Paciente Existente -->
        <div style="
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.25rem;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 0.75rem;">
            <div>
              <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 700;">Nombre Completo</span>
              <div style="font-size: 1.2rem; font-weight: 800; color: #38bdf8; margin-top: 2px;">${existingPatient.name}</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 700;">No. Expediente</span>
              <div style="font-size: 0.95rem; font-weight: 700; color: #a7f3d0; font-family: monospace; margin-top: 2px;">${existingPatient.id}</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; font-size: 0.85rem;">
            <div>
              <span style="color: #94a3b8; font-size: 0.75rem; display: block;">DPI / CUI Registrado:</span>
              <strong style="color: #f8fafc; font-family: monospace; font-size: 0.95rem;">${existingPatient.dpi || 'N/A'}</strong>
            </div>

            <div>
              <span style="color: #94a3b8; font-size: 0.75rem; display: block;">Fecha Nacimiento / Edad:</span>
              <strong style="color: #f8fafc;">${existingPatient.birthdate || 'N/D'} (${ageDisplay})</strong>
            </div>

            <div>
              <span style="color: #94a3b8; font-size: 0.75rem; display: block;">Género:</span>
              <strong style="color: #f8fafc;">${existingPatient.gender || 'N/A'}</strong>
            </div>

            <div>
              <span style="color: #94a3b8; font-size: 0.75rem; display: block;">Teléfono de Contacto:</span>
              <strong style="color: #f8fafc;">${existingPatient.telephone || 'No registrado'}</strong>
            </div>

            <div style="grid-column: span 2;">
              <span style="color: #94a3b8; font-size: 0.75rem; display: block;">Dirección de Domicilio:</span>
              <strong style="color: #f8fafc;">${existingPatient.address || 'No registrada'}</strong>
            </div>

            <div style="grid-column: span 2;">
              <span style="color: #94a3b8; font-size: 0.75rem; display: block;">Médico Tratante Habitual:</span>
              <strong style="color: #38bdf8;">${existingPatient.assignedDoctorName || 'No asignado'}</strong>
            </div>
          </div>

          <!-- Mini Resumen de Historial Clínico -->
          <div style="
            margin-top: 1rem;
            padding-top: 0.75rem;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            gap: 10px;
            justify-content: space-around;
            text-align: center;
          ">
            <div style="background: rgba(255,255,255,0.04); padding: 6px 12px; border-radius: 8px; flex: 1;">
              <div style="font-size: 1.1rem; font-weight: 800; color: #38bdf8;">${totalConsultations}</div>
              <div style="font-size: 0.68rem; color: #94a3b8; text-transform: uppercase;">Consultas</div>
            </div>
            <div style="background: rgba(255,255,255,0.04); padding: 6px 12px; border-radius: 8px; flex: 1;">
              <div style="font-size: 1.1rem; font-weight: 800; color: #4ade80;">${totalPrescriptions}</div>
              <div style="font-size: 0.68rem; color: #94a3b8; text-transform: uppercase;">Recetas</div>
            </div>
            <div style="background: rgba(255,255,255,0.04); padding: 6px 12px; border-radius: 8px; flex: 1;">
              <div style="font-size: 1.1rem; font-weight: 800; color: #facc15;">${totalLabs}</div>
              <div style="font-size: 0.68rem; color: #94a3b8; text-transform: uppercase;">Laboratorios</div>
            </div>
            <div style="background: rgba(255,255,255,0.04); padding: 6px 12px; border-radius: 8px; flex: 1;">
              <div style="font-size: 1.1rem; font-weight: 800; color: #c084fc;">${totalImaging}</div>
              <div style="font-size: 0.68rem; color: #94a3b8; text-transform: uppercase;">Imágenes</div>
            </div>
          </div>

        </div>

      </div>

      <!-- Acciones del Modal -->
      <div style="
        padding: 1.25rem 1.5rem;
        background: rgba(15, 23, 42, 0.95);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: flex-end;
      ">
        <button id="btn-cancel-dup-modal" type="button" style="
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        ">
          ✏️ Modificar DPI
        </button>

        <button id="btn-open-existing-expediente" type="button" style="
          background: linear-gradient(135deg, #0284c7, #00f2fe);
          color: #0b1120;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(0, 242, 254, 0.35);
          transition: transform 0.1s, opacity 0.2s;
        ">
          <span>📂 Abrir Expediente de este Paciente</span>
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.remove();
    if (typeof onCancel === 'function') onCancel();
  };

  document.getElementById('btn-close-dup-modal-x')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-dup-modal')?.addEventListener('click', closeModal);

  document.getElementById('btn-open-existing-expediente')?.addEventListener('click', () => {
    modal.remove();
    if (typeof onSelectExisting === 'function') {
      onSelectExisting(existingPatient);
    }
  });
}
