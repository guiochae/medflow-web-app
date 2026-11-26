// src/modules/recetario.js
import { getAppState, saveAppState, getActivePatientId, setActivePatientId, isAdminUser } from '../main.js';
import { savePatientToFirestore, sortPatientsByNewestFirst } from '../firebase.js';
import { medicationsDatabase } from '../data/medicamentos.js';
import { showPastConsultationDetail } from './consulta.js';
import { syncPatientBilling } from './preconsulta.js';
import { getMedicationSalesPresentations, formatHierarchicalStock } from './configuracion.js';
import logoUrl from '../assets/logo.jpg';

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
  const presNorm = String(m.presentation || '').toLowerCase();
  const nameNorm = String(m.name || '').toLowerCase();
  
  const unidades = m.unidades_por_presentacion !== undefined 
    ? parseInt(m.unidades_por_presentacion) 
    : (presNorm.includes('jarabe') || presNorm.includes('solucion') || presNorm.includes('suspension') || presNorm.includes('frasco') || presNorm.includes('gotero') || nameNorm.includes('jarabe')
        ? 100 
        : (presNorm.includes('ampolla') || presNorm.includes('inyeccion') || nameNorm.includes('ampolla') ? 1 : 30));
        
  const unidadDispensable = m.unidad_dispensable || 
    (presNorm.includes('jarabe') || presNorm.includes('solucion') || presNorm.includes('suspension') || presNorm.includes('frasco') || presNorm.includes('gotero') || nameNorm.includes('jarabe')
      ? 'ml' 
      : (presNorm.includes('ampolla') || presNorm.includes('inyeccion') || nameNorm.includes('ampolla') ? 'Ampolla' : 'Tableta'));

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
    unidad_dispensable: unidadDispensable,
    precio_unitario: parseFloat((precio / unidades).toFixed(4)),
    es_fraccionable: esFrac,
    permite_dosis: esFrac,
    dosis_total_presentacion: dosisTotal,
    unidad_medida_dosis: unidadMedida
  };
}

function formatStockFriendly(stock, factor, presentacion = 'Caja', unidadDispensable = 'Tableta') {
  const stockVal = parseInt(stock) || 0;
  const factorVal = Math.max(1, parseInt(factor) || 1);
  const pres = presentacion || 'Caja';
  const unit = unidadDispensable || 'Tableta';

  if (factorVal <= 1) {
    return `${stockVal} ${unit}(s)`;
  }

  const completePacks = Math.floor(stockVal / factorVal);
  const remainingUnits = stockVal % factorVal;

  let text = `${stockVal} ${unit}(s)`;
  if (completePacks > 0 && remainingUnits > 0) {
    text += ` (${completePacks} ${pres}(s) y ${remainingUnits} ${unit}(s))`;
  } else if (completePacks > 0 && remainingUnits === 0) {
    text += ` (${completePacks} ${pres}(s) completa(s))`;
  } else {
    text += ` (0 ${pres}(s) completa(s))`;
  }
  return text;
}

// Lista temporal de medicamentos agregados a la receta en curso
let currentPrescriptionMedicines = [];
let activeEditingRecipeId = null; // ID de la receta que se está editando (null si es nueva receta)
let activeEditingMedIndex = null; // Índice del medicamento dentro de la receta que se está modificando en el formulario

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

  // Escuchar cambios de pacientes en tiempo real de otras estaciones
  if (!window._recetarioPatientsChangedHandler) {
    let _recetarioDebounceTimer = null;
    window._recetarioPatientsChangedHandler = () => {
      if (_recetarioDebounceTimer) clearTimeout(_recetarioDebounceTimer);
      _recetarioDebounceTimer = setTimeout(() => {
        const sInput = document.getElementById('recipe-patient-search');
        renderPatientList(sInput ? sInput.value : '');
      }, 50);
    };
    window.addEventListener('patients-changed', window._recetarioPatientsChangedHandler);
  }

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
  sortPatientsByNewestFirst(basePatients);

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

  // Optimización de rendimiento: Renderizar en bloques para evitar congelamiento de UI
  const displayLimit = query.trim() ? 100 : 50;
  const itemsToRender = filtered.slice(0, displayLimit);

  itemsToRender.forEach(p => {
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

  if (filtered.length > itemsToRender.length) {
    const infoLi = document.createElement('li');
    infoLi.style.cssText = 'padding: 8px 12px; color: var(--text-muted); font-size: 0.78rem; text-align: center; border-top: 1px dashed var(--border-color, #e2e8f0); list-style: none;';
    infoLi.textContent = `Mostrando ${itemsToRender.length} de ${filtered.length} pacientes. Use el buscador para filtrar.`;
    listContainer.appendChild(infoLi);
  }
}

// Seleccionar paciente, actualizar barra lateral y cargar generador
function selectPatient(patientId) {
  const state = getAppState();
  const currentUser = state.currentUser;
  let patient = state.patients.find(p => p.id === patientId);

  // Si cambia de paciente, limpiar modo edición de receta
  const currentActiveId = getActivePatientId();
  if (currentActiveId !== patientId) {
    activeEditingRecipeId = null;
    activeEditingMedIndex = null;
    currentPrescriptionMedicines = [];
  }

  const doctors = (state.users || []).filter(u => {
    const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return r.includes('medico') || r.includes('doctor');
  });

  setActivePatientId(patientId);
  renderPatientList(document.getElementById('recipe-patient-search')?.value || '');

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

// Iniciar edición de una receta previamente emitida
export function startEditingRecipe(patient, recipe) {
  if (!patient || !recipe) return;

  const state = getAppState();
  const activeId = getActivePatientId();
  if (activeId !== patient.id) {
    setActivePatientId(patient.id);
  }

  activeEditingRecipeId = recipe.id;
  activeEditingMedIndex = null;
  currentPrescriptionMedicines = JSON.parse(JSON.stringify(recipe.medicines || []));

  // Ocultar modal de vista preliminar si estaba abierto
  const previewModal = document.getElementById('prescription-print-modal');
  if (previewModal) previewModal.style.display = 'none';

  const doctors = state.users.filter(u => {
    const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return r === 'medico' || r === 'medico 1' || r === 'medico 2' || r === 'medico 3';
  });

  renderPatientList(document.getElementById('recipe-patient-search')?.value || '');
  renderRecipeHistory(patient);
  renderRecipeBuilder(patient, doctors);

  // Desplazar suavemente hacia el generador
  setTimeout(() => {
    const builderArea = document.getElementById('recipe-builder-area');
    if (builderArea) {
      builderArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
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
    const isCurrentlyEditing = activeEditingRecipeId === r.id;
    li.className = `history-card ${isCurrentlyEditing ? 'selected' : ''}`;
    if (isCurrentlyEditing) {
      li.style.borderColor = '#f59e0b';
      li.style.borderLeft = '4px solid #f59e0b';
      li.style.background = 'rgba(245, 158, 11, 0.08)';
    }

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
        <span style="font-weight: 600;">${dateFormatted} ${r.updated_at ? '<small style="color: #f59e0b; font-size: 0.7rem;">(Modificada)</small>' : ''}</span>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">${medsCount} med(s)</span>
          <button type="button" class="btn-print-recipe-card" data-id="${r.id}" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 4px; color: #10b981; cursor: pointer; padding: 2px 7px; font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;" title="Imprimir Receta Médica Oficial">
            <span>🖨️</span> Imprimir
          </button>
          <button type="button" class="btn-edit-recipe-card" data-id="${r.id}" style="background: rgba(0, 242, 254, 0.12); border: 1px solid rgba(0, 242, 254, 0.4); border-radius: 4px; color: #00f2fe; cursor: pointer; padding: 2px 7px; font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;" title="Modificar o editar medicamentos de esta receta">
            <span>✏️</span> Editar
          </button>
          ${isAdminUser() ? `
            <button type="button" class="btn-delete-recipe" data-id="${r.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px; font-size: 0.95rem; line-height: 1;" title="Eliminar Receta">🗑️</button>
          ` : ''}
        </div>
      </div>
      <div class="history-card-title">${r.doctorName || 'Médico Tratante'}</div>
      <div class="history-card-body" title="${medsList}">
        <strong>Medicamentos:</strong> ${medsList}
      </div>
    `;

    const printBtn = li.querySelector('.btn-print-recipe-card');
    if (printBtn) {
      printBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        printPrescriptionDocument(patient, r);
      });
    }

    const editBtn = li.querySelector('.btn-edit-recipe-card');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startEditingRecipe(patient, r);
      });
    }

    const delBtn = li.querySelector('.btn-delete-recipe');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Evitar abrir la vista previa de la receta al hacer clic en borrar
        const confirmDel = confirm(`⚠️ ATENCIÓN:\n\n¿Está completamente seguro de que desea eliminar permanentemente este registro de receta y su cobro asociado del día ${dateFormatted}?\n\nEsta acción es irreversible.`);
        if (confirmDel) {
          const stateObj = getAppState();
          const pObj = stateObj.patients.find(p => p.id === patient.id);
          if (pObj) {
            if (activeEditingRecipeId === r.id) {
              activeEditingRecipeId = null;
              activeEditingMedIndex = null;
              currentPrescriptionMedicines = [];
            }
            // Eliminar la receta
            pObj.prescriptions = (pObj.prescriptions || []).filter(item => item.id !== r.id);
            // Eliminar cobro asociado de farmacia (si existe en el historial de facturación)
            pObj.billingHistory = (pObj.billingHistory || []).filter(item => item.recipeId !== r.id);
            
            patientObj.updatedAt = new Date().toISOString();
          savePatientToFirestore(patientObj).catch(err => console.warn("Error guardando paciente en recetario:", err));
          await saveAppState(stateObj);
            alert("🗑️ Receta y cobro asociados eliminados correctamente.");
            patient.prescriptions = pObj.prescriptions;
            patient.billingHistory = pObj.billingHistory;
            renderRecipeHistory(patient);
            renderRecipeBuilder(patient, stateObj.users.filter(u => String(u.role || '').toLowerCase().startsWith('medico')));
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

  // Verificar si estamos en modo edición de receta existente
  let editingRecipe = null;
  if (activeEditingRecipeId) {
    editingRecipe = (patient.prescriptions || []).find(r => r.id === activeEditingRecipeId);
    if (!editingRecipe) {
      activeEditingRecipeId = null;
      activeEditingMedIndex = null;
      currentPrescriptionMedicines = [];
    }
  }

  // Si no está en edición, verificar borradores desde asistente de consulta
  if (!editingRecipe) {
    const draftMeds = sessionStorage.getItem('medflow_prescription_draft');
    const draftDoctor = sessionStorage.getItem('medflow_doctor_draft');
    
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
  } else {
    // En modo edición, si la lista en memoria está vacía, cargar los medicamentos de la receta
    if (!currentPrescriptionMedicines || currentPrescriptionMedicines.length === 0) {
      currentPrescriptionMedicines = JSON.parse(JSON.stringify(editingRecipe.medicines || []));
    }
  }

  let activeSelectedRecipeMed = null;
  const draftInds = sessionStorage.getItem('medflow_prescription_indications_draft') || "";
  if (sessionStorage.getItem('medflow_prescription_indications_draft')) {
    sessionStorage.removeItem('medflow_prescription_indications_draft');
  }

  const initialIndications = editingRecipe ? (editingRecipe.indications || '') : draftInds;
  const vitalsHeaderHtml = getPatientVitalsHeaderHtml(patient);

  const stateObj = getAppState();
  const doctorList = (Array.isArray(doctors) && doctors.length > 0)
    ? doctors
    : (stateObj.users || []).filter(u => {
        const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return r.includes('medico') || r.includes('doctor');
      });
  const currentUser = stateObj.currentUser;
  const isUserDoctor = currentUser && String(currentUser.role || '').toLowerCase().includes('medico');

  let defaultDoctorId = '';
  let defaultDoctorName = '';

  if (editingRecipe) {
    defaultDoctorName = editingRecipe.doctorName || '';
    const matchDoc = doctorList.find(d => d.name === defaultDoctorName || d.id === editingRecipe.doctorId);
    if (matchDoc) {
      defaultDoctorId = matchDoc.id;
      defaultDoctorName = matchDoc.name;
    } else {
      defaultDoctorId = editingRecipe.doctorId || (doctorList[0] ? doctorList[0].id : 'u-1');
    }
  } else if (isUserDoctor && currentUser.id) {
    defaultDoctorId = currentUser.id;
    defaultDoctorName = currentUser.name;
  } else if (patient.assignedDoctorId || patient.assignedDoctorName) {
    const matchDoc = doctorList.find(d => d.id === patient.assignedDoctorId || d.name === patient.assignedDoctorName);
    if (matchDoc) {
      defaultDoctorId = matchDoc.id;
      defaultDoctorName = matchDoc.name;
    } else {
      defaultDoctorId = patient.assignedDoctorId || (doctorList[0] ? doctorList[0].id : 'u-1');
      defaultDoctorName = patient.assignedDoctorName || (doctorList[0] ? doctorList[0].name : 'Dr. Médico Tratante');
    }
  } else if (doctorList.length > 0) {
    defaultDoctorId = doctorList[0].id;
    defaultDoctorName = doctorList[0].name;
  } else {
    defaultDoctorId = 'u-1';
    defaultDoctorName = 'Dr. Carlos Mendoza';
  }

  container.innerHTML = `
    ${vitalsHeaderHtml}
    
    ${editingRecipe ? `
      <!-- Banner de Alerta de Modo Edición -->
      <div style="
        background: rgba(245, 158, 11, 0.1); 
        border: 1px solid rgba(245, 158, 11, 0.4); 
        border-left: 4px solid #f59e0b; 
        border-radius: var(--radius-sm); 
        padding: 12px 16px; 
        margin-bottom: 1.25rem; 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        flex-wrap: wrap; 
        gap: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 1.8rem; line-height: 1;">✏️</span>
          <div>
            <div style="color: #f59e0b; font-weight: 800; font-size: 1.05rem; display: flex; align-items: center; gap: 6px;">
              <span>MODO EDICIÓN DE RECETA</span>
              <span style="background: #f59e0b; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 800;">No. ${editingRecipe.id.replace('r-', '')}</span>
            </div>
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Emitida originalmente el ${new Date(editingRecipe.date).toLocaleDateString('es-GT')} por <strong>${editingRecipe.doctorName || 'Médico Tratante'}</strong>. Puede quitar, modificar o agregar medicamentos.
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-small" id="btn-cancel-edit-mode" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08); font-weight: 600;">
          ✕ Salir de Edición (Nueva Receta)
        </button>
      </div>
    ` : ''}

    <div class="glass-card" style="padding: 1.5rem; ${editingRecipe ? 'border-top: 3px solid #f59e0b;' : ''}">
      <h2 style="font-family: var(--font-heading); margin-bottom: 1.5rem; color: ${editingRecipe ? '#f59e0b' : 'var(--accent-primary)'}; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <span>${editingRecipe ? `✏️ Modificar Receta Médica No. ${editingRecipe.id.replace('r-', '')}` : 'Emitir Nueva Receta'}</span>
        ${editingRecipe ? `<span style="font-size: 0.8rem; background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 3px 10px; border-radius: 12px; font-weight: 700; border: 1px solid rgba(245, 158, 11, 0.3);">Receta Existente</span>` : ''}
      </h2>
      
      <div class="recipe-layout-grid" style="display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 20px; align-items: start;">
        <!-- Columna Izquierda: Formulario e Historial Recetas -->
        <div>
          <!-- Doctor que receta (automático del paciente o de la receta) -->
          <div class="form-group" style="max-width: 400px; margin-bottom: 1.5rem;">
            <label for="r-doctor">Médico que Prescribe (Tratante)</label>
            <select id="r-doctor" class="form-control" style="font-weight: bold; color: ${editingRecipe ? '#f59e0b' : 'var(--accent-primary)'};">
              ${doctorList.map(doc => `<option value="${doc.id}" ${(doc.id === defaultDoctorId || doc.name === defaultDoctorName) ? 'selected' : ''}>${doc.name}${doc.specialty ? ` (${doc.specialty})` : ''}</option>`).join('')}
              ${!doctorList.some(d => d.id === defaultDoctorId || d.name === defaultDoctorName) && defaultDoctorName ? `<option value="${defaultDoctorId || defaultDoctorName}" selected>${defaultDoctorName}</option>` : ''}
            </select>
          </div>

          <!-- Formulario para agregar/modificar medicina a la receta -->
          <div id="recipe-med-form-card" style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: var(--radius-sm); margin-bottom: 1.5rem; transition: border-color 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h4 id="recipe-med-form-title" style="margin: 0; color: var(--accent-secondary); display: flex; align-items: center; gap: 6px;">
                <span>+</span> Agregar Medicamento
              </h4>
              <span id="recipe-med-form-mode-badge" style="display: none; font-size: 0.75rem; background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 2px 8px; border-radius: 10px; font-weight: 700;">Editando fila</span>
            </div>

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
              </div>

              <!-- Fila con información física del empaque seleccionada y disponibilidad en tiempo real -->
              <div id="m-pack-info" style="display: none; margin-bottom: 1rem; padding: 10px 14px; background: rgba(0,242,254,0.03); border-radius: 6px; border: 1px solid rgba(0,242,254,0.25); font-size: 0.82rem; grid-template-columns: 1fr 1fr; gap: 8px;">
                <!-- Se llena dinámicamente por JS -->
              </div>

              <!-- Alerta de existencia insuficiente en tiempo real -->
              <div id="recipe-stock-warning" style="display: none; margin-bottom: 1rem; padding: 8px 12px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 6px; color: #f87171; font-size: 0.82rem; font-weight: 600;">
              </div>

              <div class="form-row">
                <div class="form-group" style="flex: 1.5;">
                  <label for="m-presentation" id="lbl-m-presentation">Presentación de Venta</label>
                  <select id="m-presentation" required style="width: 100%;">
                    <option value="Tabletas" data-factor="1" data-price="2.00">Tabletas</option>
                    <option value="Cápsulas" data-factor="1" data-price="2.00">Cápsulas</option>
                    <option value="Jarabe" data-factor="1" data-price="35.00">Jarabe</option>
                    <option value="Suspensión" data-factor="1" data-price="40.00">Suspensión</option>
                    <option value="Ampollas" data-factor="1" data-price="25.00">Ampollas</option>
                    <option value="Crema/Pomada" data-factor="1" data-price="30.00">Crema/Pomada</option>
                    <option value="Gotas" data-factor="1" data-price="25.00">Gotas</option>
                    <option value="Inhalador" data-factor="1" data-price="65.00">Inhalador</option>
                    <option value="Sobre" data-factor="1" data-price="5.00">Sobre</option>
                    <option value="Frasco" data-factor="1" data-price="45.00">Frasco</option>
                  </select>
                </div>
                <div class="form-group" style="flex: 1;">
                  <label for="m-quantity" id="lbl-m-quantity">Cantidad a Recetar</label>
                  <input type="number" id="m-quantity" required placeholder="Ej. 5" min="1" step="1">
                </div>
                <div class="form-group" style="display: flex; flex-direction: column; justify-content: flex-end; min-width: 120px;">
                  <div style="font-size: 0.75rem; color: var(--accent-primary); margin-bottom: 4px;">Costo Estimado:</div>
                  <strong id="lbl-m-cost-preview" style="font-size: 1.15rem; color: var(--accent-success); padding-bottom: 8px;">Q0.00</strong>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group" style="flex: 2;">
                  <label for="m-dosage">Dosis y Frecuencia</label>
                  <input type="text" id="m-dosage" required placeholder="Ej. 1 tableta por las noches / Tomar 10ml">
                </div>
                <div class="form-group" style="flex: 2;">
                  <label for="m-duration">Indicaciones / Duración</label>
                  <input type="text" id="m-duration" required placeholder="Ej. Hasta nueva orden médica / Por 15 días">
                </div>
              </div>

              <!-- Horarios de Inicio y Mantenimiento de Dosis -->
              <div class="form-row" style="margin-top: 4px;">
                <div class="form-group" style="flex: 1;">
                  <label for="m-schedule" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>⏰ Horario(s) de Inicio y Mantenimiento de Dosis <small style="color: var(--accent-primary); font-weight: normal;">(Opcional)</small></span>
                    <span style="font-size: 0.72rem; color: var(--text-muted);">Ej. 8:00 am, 8:00 pm, 10:00am - 4:00pm</span>
                  </label>
                  <input type="text" id="m-schedule" placeholder="Ej. 8:00 am, 8:00 pm, 10:00am - 4:00pm ó 2:00 pm" style="font-weight: 700; color: var(--accent-primary);">
                  <!-- Pastillas de Acceso Rápido para Horarios Médicos Frecuentes -->
                  <div id="quick-schedule-pills" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                    <button type="button" class="btn-schedule-pill" data-val="8:00 am" style="font-size: 0.72rem; padding: 3px 9px; border-radius: 12px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); color: #00f2fe; cursor: pointer;">8:00 am</button>
                    <button type="button" class="btn-schedule-pill" data-val="2:00 pm" style="font-size: 0.72rem; padding: 3px 9px; border-radius: 12px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); color: #00f2fe; cursor: pointer;">2:00 pm</button>
                    <button type="button" class="btn-schedule-pill" data-val="8:00 pm" style="font-size: 0.72rem; padding: 3px 9px; border-radius: 12px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); color: #00f2fe; cursor: pointer;">8:00 pm</button>
                    <button type="button" class="btn-schedule-pill" data-val="8:00 am - 8:00 pm" style="font-size: 0.72rem; padding: 3px 9px; border-radius: 12px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); color: #00f2fe; cursor: pointer;">8:00 am - 8:00 pm</button>
                    <button type="button" class="btn-schedule-pill" data-val="10:00 am - 4:00 pm" style="font-size: 0.72rem; padding: 3px 9px; border-radius: 12px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); color: #00f2fe; cursor: pointer;">10:00 am - 4:00 pm</button>
                    <button type="button" class="btn-schedule-pill" data-val="6:00 am - 2:00 pm - 10:00 pm" style="font-size: 0.72rem; padding: 3px 9px; border-radius: 12px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); color: #00f2fe; cursor: pointer;">6:00 am - 2:00 pm - 10:00 pm</button>
                  </div>
                </div>
              </div>

              <div id="med-form-actions-row" style="display: flex; align-items: center; gap: 1rem; margin-top: 1.25rem; flex-wrap: wrap;">
                <button type="submit" id="btn-submit-med" class="btn btn-secondary btn-small">
                  <span>+</span> Agregar a la Receta
                </button>
                <button type="button" id="btn-cancel-med-edit" class="btn btn-secondary btn-small" style="display: none; color: #f87171; border-color: rgba(248, 113, 113, 0.4);">
                  ✕ Cancelar Modificación
                </button>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.88rem; color: var(--accent-primary); font-weight: 500; user-select: none; margin: 0;">
                  <input type="checkbox" id="m-breakdown-schedule" style="width: 17px; height: 17px; accent-color: var(--accent-primary); cursor: pointer;">
                  Desglosar horarios en descripción
                </label>
              </div>
            </form>
          </div>

          <!-- Medicamentos Recetados (Lista Actual) -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="margin: 0; color: var(--text-primary); font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
              <span>📋</span> Medicamentos en la Receta
            </h3>
            <span id="recipe-meds-count-badge" style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 600;">
              ${currentPrescriptionMedicines.length} medicamento(s)
            </span>
          </div>

          <div style="overflow-x: auto; background: rgba(0,0,0,0.15); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color); text-align: left; font-size: 0.82rem; color: var(--text-muted);">
                  <th style="padding: 10px 12px;">Medicamento</th>
                  <th style="padding: 10px 12px;">Cantidad</th>
                  <th style="padding: 10px 12px;">Dosis y Frecuencia</th>
                  <th style="padding: 10px 12px;">Duración / Indicaciones</th>
                  <th style="padding: 10px 12px; text-align: center; width: 140px;">Acciones</th>
                </tr>
              </thead>
              <tbody id="recipe-medicines-table-body">
                <tr>
                  <td colspan="5" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 2rem 0;">
                    No se han agregado medicamentos a esta receta todavía.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Indicaciones Generales / Recomendaciones -->
          <div class="form-group" style="margin-top: 1.5rem;">
            <label for="r-indications">Indicaciones y Recomendaciones Generales</label>
            <textarea id="r-indications" rows="3" placeholder="Ej. Reposo absoluto, tomar abundante agua, evitar ejercicio..." style="width: 100%; min-height: 80px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); padding: 10px; font-family: inherit; font-size: 0.9rem;">${initialIndications}</textarea>
          </div>

          <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem; flex-wrap: wrap;">
            ${editingRecipe ? `
              <button type="button" class="btn btn-secondary" id="btn-cancel-edit-recipe">✕ Cancelar Edición</button>
              <button type="button" class="btn btn-success" id="btn-print-active-recipe" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; background: #10b981; border: none; color: white;">
                <span>🖨️</span> Imprimir Receta
              </button>
              <button type="button" class="btn btn-warning" id="btn-approve-recipe" style="font-weight: 700; background: linear-gradient(135deg, #d97706, #f59e0b); color: #000; border: none; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3); display: inline-flex; align-items: center; gap: 6px;">
                <span>💾</span> Guardar Cambios en Receta
              </button>
            ` : `
              <button type="button" class="btn btn-secondary" id="btn-clear-recipe">Limpiar Receta</button>
              <button type="button" class="btn btn-success" id="btn-approve-recipe">
                <span>✓</span> Aprobar y Previsualizar Receta
              </button>
            `}
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

  document.addEventListener('click', (e) => {
    if (e.target !== medNameInput && e.target !== autocompleteList) {
      autocompleteList.style.display = 'none';
    }
  });

  const updateRecipePackagingInfo = () => {
    const packInfoEl = document.getElementById('m-pack-info');
    const presentationSelect = document.getElementById('m-presentation');
    const warningEl = document.getElementById('recipe-stock-warning');
    const lblQty = document.getElementById('lbl-m-quantity');
    const costPreview = document.getElementById('lbl-m-cost-preview');
    if (!packInfoEl || !presentationSelect) return;

    if (!activeSelectedRecipeMed) {
      packInfoEl.style.display = 'none';
      if (warningEl) warningEl.style.display = 'none';
      lblQty.textContent = "Cantidad a Recetar";
      costPreview.textContent = "Q0.00";
      return;
    }

    const salesPres = getMedicationSalesPresentations(activeSelectedRecipeMed);
    const stockHierarchical = formatHierarchicalStock(activeSelectedRecipeMed.stock, activeSelectedRecipeMed);
    const currentStock = activeSelectedRecipeMed.stock !== undefined ? parseInt(activeSelectedRecipeMed.stock) : 0;

    packInfoEl.style.display = 'grid';
    packInfoEl.innerHTML = `
      <div>📦 Lote: <strong>${activeSelectedRecipeMed.lote || 'N/A'}</strong> | Vence: <strong>${activeSelectedRecipeMed.vencimiento ? new Date(activeSelectedRecipeMed.vencimiento).toLocaleDateString('es-GT') : 'N/D'}</strong></div>
      <div>🩺 Disponibilidad Actual: <strong style="color: ${currentStock > 0 ? '#10b981' : '#ef4444'};">${stockHierarchical}</strong></div>
      <div>📑 Unidad Base: <strong>${activeSelectedRecipeMed.unidad_dispensable || 'Tableta'}</strong></div>
      <div>🏷️ Presentaciones: <strong>${salesPres.map(p => `${p.presentation} (Q${parseFloat(p.price).toFixed(2)})`).join(' | ')}</strong></div>
    `;

    // Cargar únicamente las presentaciones de venta configuradas
    presentationSelect.innerHTML = salesPres.map(p => `
      <option value="${p.presentation}" data-factor="${p.factor}" data-price="${p.price}">
        ${p.presentation} (${p.factor} ${activeSelectedRecipeMed.unidad_dispensable || 'uds'}) - Q${parseFloat(p.price).toFixed(2)}
      </option>
    `).join('');

    updateRecipeQuantityLabelAndPrice();
  };

  const updateRecipeQuantityLabelAndPrice = () => {
    const presentationSelect = document.getElementById('m-presentation');
    const qtyInput = document.getElementById('m-quantity');
    const lblQty = document.getElementById('lbl-m-quantity');
    const costPreview = document.getElementById('lbl-m-cost-preview');
    const warningEl = document.getElementById('recipe-stock-warning');
    if (!presentationSelect || !qtyInput || !lblQty || !costPreview) return;

    const selectedOption = presentationSelect.options[presentationSelect.selectedIndex];
    const presName = selectedOption ? selectedOption.value : 'Unidad';
    const factor = selectedOption ? (Math.max(1, parseInt(selectedOption.getAttribute('data-factor')) || 1)) : 1;
    const price = selectedOption ? (parseFloat(selectedOption.getAttribute('data-price')) || 0) : 0;
    const qty = parseFloat(qtyInput.value) || 0;

    lblQty.textContent = `Cantidad (${presName}(s))`;
    const totalCost = qty * price;
    costPreview.textContent = `Q${totalCost.toFixed(2)}`;

    // Validación de existencia en tiempo real
    if (activeSelectedRecipeMed) {
      const unitsRequired = qty * factor;
      const currentStock = activeSelectedRecipeMed.stock !== undefined ? parseInt(activeSelectedRecipeMed.stock) : 0;
      const baseUnit = activeSelectedRecipeMed.unidad_dispensable || 'uds';

      if (unitsRequired > currentStock && warningEl) {
        warningEl.style.display = 'block';
        warningEl.innerHTML = `⚠️ Existencias insuficientes en farmacia: Requiere <strong>${unitsRequired} ${baseUnit}</strong>, pero solo hay <strong>${currentStock} ${baseUnit}</strong> disponibles en inventario.`;
      } else if (warningEl) {
        warningEl.style.display = 'none';
      }
    } else if (warningEl) {
      warningEl.style.display = 'none';
    }
  };

  const presSelectEl = document.getElementById('m-presentation');
  const qtyInputEl = document.getElementById('m-quantity');
  if (presSelectEl) presSelectEl.addEventListener('change', updateRecipeQuantityLabelAndPrice);
  if (qtyInputEl) qtyInputEl.addEventListener('input', updateRecipeQuantityLabelAndPrice);

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

  const scheduleInput = document.getElementById('m-schedule');
  document.querySelectorAll('.btn-schedule-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      if (scheduleInput) {
        const val = pill.getAttribute('data-val') || '';
        if (!scheduleInput.value.trim()) {
          scheduleInput.value = val;
        } else if (!scheduleInput.value.includes(val)) {
          scheduleInput.value = `${scheduleInput.value.trim()} - ${val}`;
        }
        scheduleInput.focus();
      }
    });
  });

  // Función para resetear el formulario de medicamentos
  const resetMedicineForm = () => {
    medNameInput.value = '';
    document.getElementById('m-quantity').value = '';
    document.getElementById('m-dosage').value = '';
    document.getElementById('m-duration').value = '';
    if (scheduleInput) scheduleInput.value = '';
    const breakdownCheck = document.getElementById('m-breakdown-schedule');
    if (breakdownCheck) breakdownCheck.checked = false;
    autocompleteList.style.display = 'none';
    const warningEl = document.getElementById('recipe-stock-warning');
    if (warningEl) warningEl.style.display = 'none';

    activeSelectedRecipeMed = null;
    activeEditingMedIndex = null;
    updateRecipePackagingInfo();

    const formTitle = document.getElementById('recipe-med-form-title');
    if (formTitle) formTitle.innerHTML = '<span>+</span> Agregar Medicamento';
    const formBadge = document.getElementById('recipe-med-form-mode-badge');
    if (formBadge) formBadge.style.display = 'none';
    const formCard = document.getElementById('recipe-med-form-card');
    if (formCard) formCard.style.borderColor = 'var(--border-color)';
    
    const submitBtn = document.getElementById('btn-submit-med');
    if (submitBtn) {
      submitBtn.className = 'btn btn-secondary btn-small';
      submitBtn.innerHTML = '<span>+</span> Agregar a la Receta';
    }
    const cancelMedBtn = document.getElementById('btn-cancel-med-edit');
    if (cancelMedBtn) cancelMedBtn.style.display = 'none';
  };

  const btnCancelMedEdit = document.getElementById('btn-cancel-med-edit');
  if (btnCancelMedEdit) {
    btnCancelMedEdit.addEventListener('click', resetMedicineForm);
  }

  // Bind Agregar/Modificar Medicamento Form
  document.getElementById('add-medicine-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = medNameInput.value.trim();
    if (!name) return;

    const presentationSelect = document.getElementById('m-presentation');
    const selectedOption = presentationSelect.options[presentationSelect.selectedIndex];
    const presentation = selectedOption ? selectedOption.value : presentationSelect.value;
    const factor = selectedOption ? (Math.max(1, parseInt(selectedOption.getAttribute('data-factor')) || 1)) : 1;
    const itemPrice = selectedOption ? (parseFloat(selectedOption.getAttribute('data-price')) || 0) : 50.00;

    const quantity = parseFloat(document.getElementById('m-quantity').value) || 1;
    const rawDosage = document.getElementById('m-dosage').value;
    const duration = document.getElementById('m-duration').value;
    const schedule = document.getElementById('m-schedule')?.value.trim() || '';
    const breakdownCheck = document.getElementById('m-breakdown-schedule');
    const shouldBreakdown = breakdownCheck ? breakdownCheck.checked : false;

    const dosage = formatDosageSchedule(rawDosage, shouldBreakdown);

    const unitsRequired = quantity * factor;
    const finalCost = quantity * itemPrice;

    // Validación no bloqueante si no hay stock suficiente
    if (activeSelectedRecipeMed) {
      const currentStock = activeSelectedRecipeMed.stock !== undefined ? parseInt(activeSelectedRecipeMed.stock) : 0;
      if (unitsRequired > currentStock) {
        const proceed = confirm(`⚠️ Atención: La cantidad recetada (${unitsRequired} ${activeSelectedRecipeMed.unidad_dispensable || 'uds'}) supera el stock actual disponible (${currentStock} uds).\n\n¿Desea agregar este medicamento a la orden de todos modos?`);
        if (!proceed) return;
      }
    }

    const newMed = {
      medicationId: activeSelectedRecipeMed?.id || null,
      name,
      presentation,
      presentationFactor: factor,
      price: itemPrice,
      quantity: `${quantity} ${presentation}(s)`,
      rawQuantity: quantity,
      unitsRequired: unitsRequired,
      dosage,
      duration,
      schedule,
      breakdownSchedule: shouldBreakdown,
      tipoPrescripcion: 'presentacion_venta',
      cantidad_o_dosis: quantity,
      costo_calculado: finalCost,
      qty: unitsRequired
    };

    if (activeEditingMedIndex !== null && activeEditingMedIndex >= 0 && activeEditingMedIndex < currentPrescriptionMedicines.length) {
      currentPrescriptionMedicines[activeEditingMedIndex] = newMed;
    } else {
      currentPrescriptionMedicines.push(newMed);
    }

    resetMedicineForm();
    renderCurrentMedicinesTable();
    renderInventoryAlerts('');
  });

  // Bind Limpiar Receta
  const btnClear = document.getElementById('btn-clear-recipe');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      currentPrescriptionMedicines = [];
      resetMedicineForm();
      renderCurrentMedicinesTable();
    });
  }

  // Bind Cancelar Edición de Receta
  const handleCancelEditRecipe = () => {
    activeEditingRecipeId = null;
    activeEditingMedIndex = null;
    currentPrescriptionMedicines = [];
    renderRecipeHistory(patient);
    renderRecipeBuilder(patient, doctors);
  };

  const btnCancelEditMode = document.getElementById('btn-cancel-edit-mode');
  if (btnCancelEditMode) btnCancelEditMode.addEventListener('click', handleCancelEditRecipe);

  const btnCancelEditBottom = document.getElementById('btn-cancel-edit-recipe');
  if (btnCancelEditBottom) btnCancelEditBottom.addEventListener('click', handleCancelEditRecipe);

  const btnPrintActive = document.getElementById('btn-print-active-recipe');
  if (btnPrintActive && editingRecipe) {
    btnPrintActive.addEventListener('click', () => {
      printPrescriptionDocument(patient, editingRecipe);
    });
  }

  // Bind Aprobar o Guardar Cambios en Receta
  const btnApprove = document.getElementById('btn-approve-recipe');
  if (btnApprove) {
    btnApprove.addEventListener('click', async () => {
      btnApprove.disabled = true;
      btnApprove.textContent = activeEditingRecipeId ? 'Guardando Cambios...' : 'Emitiendo Receta...';

      try {
        const docSelect = document.getElementById('r-doctor');
        const doctorId = docSelect ? docSelect.value : '';
        const stateObj = getAppState();
        const doctorObj = stateObj.users.find(u => u.id === doctorId) || 
                          stateObj.users.find(u => u.name === doctorId || (u.name && u.name.toLowerCase().includes(String(doctorId).toLowerCase())));
        
        const doctorName = doctorObj ? doctorObj.name : (patient.assignedDoctorName || (stateObj.currentUser ? stateObj.currentUser.name : 'Dr. Médico Tratante'));
        const doctorLicense = doctorObj ? (doctorObj.license || 'N/A') : 'N/A';
        const doctorPhone = doctorObj ? (doctorObj.phone || 'N/A') : 'N/A';
        
        if (!doctorId && !doctorName) {
          alert("Debe seleccionar un médico que prescriba la receta.");
          return;
        }

        if (currentPrescriptionMedicines.length === 0) {
          alert("Debe haber al menos un medicamento en la receta.");
          return;
        }
      
      const indicationsVal = document.getElementById('r-indications') ? document.getElementById('r-indications').value : "";
      const patientObj = stateObj.patients.find(p => p.id === patient.id);
      if (!patientObj) return;

      patientObj.billingHistory = patientObj.billingHistory || [];
      patientObj.prescriptions = patientObj.prescriptions || [];

      // ===================================================================
      // 1. MODO EDICIÓN: ACTUALIZAR RECETA EXISTENTE
      // ===================================================================
      if (activeEditingRecipeId) {
        const recipeToUpdate = patientObj.prescriptions.find(r => r.id === activeEditingRecipeId);
        if (recipeToUpdate) {
          recipeToUpdate.medicines = [...currentPrescriptionMedicines];
          recipeToUpdate.indications = indicationsVal;
          recipeToUpdate.updated_at = new Date().toISOString();
          recipeToUpdate.doctorName = doctorName;
          recipeToUpdate.doctorLicense = doctorLicense;
          recipeToUpdate.doctorPhone = doctorPhone;
          recipeToUpdate.last_modified_by = stateObj.currentUser ? stateObj.currentUser.name : 'Médico';

          // Actualizar cobro de farmacia/caja asociado en el historial de facturación si está pendiente
          if (recipeToUpdate.billId) {
            const bill = patientObj.billingHistory.find(b => b.id === recipeToUpdate.billId);
            if (bill && bill.status === 'Pendiente') {
              const newDetails = [];
              let newTotal = 0;
              currentPrescriptionMedicines.forEach(m => {
                const catalogItem = stateObj.medications && stateObj.medications.find(med => med.name === m.name);
                const price = m.costo_calculado !== undefined 
                  ? parseFloat(m.costo_calculado)
                  : (catalogItem ? parseFloat(catalogItem.price) : 50.00);
                
                const descSuffix = m.tipoPrescripcion === 'unidad' 
                  ? `(${m.cantidad_o_dosis} uds)`
                  : (m.tipoPrescripcion === 'dosis' ? `(${m.cantidad_o_dosis} dosis)` : `(${m.qty || 1} cajas)`);
                
                newDetails.push({
                  description: `Medicamento Recetado: ${m.name} ${descSuffix}`,
                  amount: price
                });
                newTotal += price;
              });

              // Preservar otros cobros en la misma factura (ej. honorarios de consulta o procedimientos)
              const nonMedDetails = (bill.details || []).filter(d => d && d.description && !String(d.description).startsWith('Medicamento Recetado:'));
              bill.details = [...nonMedDetails, ...newDetails];
              bill.total = bill.details.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            }
          }

          // Registrar en Demanda Real medicamentos no catalogados
          stateObj.demandaReal = stateObj.demandaReal || [];
          currentPrescriptionMedicines.forEach(m => {
            const inCatalog = stateObj.medications && stateObj.medications.some(med => med.name && med.name.toLowerCase().trim() === String(m.name || '').toLowerCase().trim());
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

          patientObj.updatedAt = new Date().toISOString();
          savePatientToFirestore(patientObj).catch(err => console.warn("Error guardando paciente en recetario:", err));
          await saveAppState(stateObj);

          // Salir del modo edición
          activeEditingRecipeId = null;
          activeEditingMedIndex = null;
          currentPrescriptionMedicines = [];

          // Actualizar vistas
          renderRecipeHistory(patientObj);
          renderRecipeBuilder(patientObj, doctors);

          // Abrir modal de vista preliminar e impresión con la receta actualizada
          showPrescriptionPreviewModal(patientObj, recipeToUpdate);
          alert("✅ Receta modificada y actualizada exitosamente.");
          return;
        }
      }

      // ===================================================================
      // 2. MODO NORMAL: EMITIR NUEVA RECETA
      // ===================================================================
      const todayStr = new Date().toISOString().substring(0, 10);
      let bill = patientObj.billingHistory.find(b => 
        b && b.status === 'Pendiente' && 
        b.date && String(b.date).substring(0, 10) === todayStr
      );

      const details = [];
      let total = 0;
      
      currentPrescriptionMedicines.forEach(m => {
        const catalogItem = stateObj.medications && stateObj.medications.find(med => med.name === m.name);
        
        const price = m.costo_calculado !== undefined 
          ? parseFloat(m.costo_calculado)
          : (catalogItem ? parseFloat(catalogItem.price) : 50.00);
        
        const alreadyBilled = bill && Array.isArray(bill.details) && bill.details.some(d => d && d.description && String(d.description).includes(m.name));
        
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
        bill.details = [...(bill.details || []), ...details];
        bill.total = parseFloat(bill.total || 0) + total;
        billId = bill.id;
      } else {
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

      patientObj.prescriptions.unshift(newRecipe);
      try { syncPatientBilling(patientObj, stateObj); } catch(e){}

      stateObj.demandaReal = stateObj.demandaReal || [];
      currentPrescriptionMedicines.forEach(m => {
        const inCatalog = stateObj.medications && stateObj.medications.some(med => med.name && med.name.toLowerCase().trim() === String(m.name || '').toLowerCase().trim());
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

      patientObj.updatedAt = new Date().toISOString();
      savePatientToFirestore(patientObj).catch(err => console.warn("Error guardando paciente en recetario:", err));
      await saveAppState(stateObj);

      showPrescriptionPreviewModal(patientObj, newRecipe);

      currentPrescriptionMedicines = [];
      if (document.getElementById('r-indications')) {
        document.getElementById('r-indications').value = '';
      }
      renderCurrentMedicinesTable();
      renderRecipeHistory(patientObj);
      alert("✅ Receta emitida y grabada exitosamente.");
    } catch (err) {
      console.error("Error al emitir/actualizar receta:", err);
      alert("Ocurrió un error al procesar la receta: " + (err.message || err));
    } finally {
      if (btnApprove) {
        btnApprove.disabled = false;
        btnApprove.textContent = activeEditingRecipeId ? 'Guardar Cambios en Receta' : 'Aprobar y Emitir Receta';
      }
    }
  });
}

  // Inicializar la tabla de medicamentos con lo que esté cargado
  renderCurrentMedicinesTable();

  // Inicializar alertas de inventario y caducidad
  renderInventoryAlerts('');
}

// Renderizar tabla de medicamentos en curso con botones de Editar y Quitar
function renderCurrentMedicinesTable() {
  const tbody = document.getElementById('recipe-medicines-table-body');
  const countBadge = document.getElementById('recipe-meds-count-badge');
  if (!tbody) return;

  if (countBadge) {
    countBadge.textContent = `${currentPrescriptionMedicines.length} medicamento(s)`;
  }

  tbody.innerHTML = '';

  if (currentPrescriptionMedicines.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 2rem 0;">
          No hay medicamentos agregados a esta receta. Agregue medicamentos utilizando el formulario superior.
        </td>
      </tr>
    `;
    return;
  }

  currentPrescriptionMedicines.forEach((med, idx) => {
    const isBeingEdited = activeEditingMedIndex === idx;
    const row = document.createElement('tr');
    if (isBeingEdited) {
      row.style.background = 'rgba(245, 158, 11, 0.12)';
      row.style.borderLeft = '3px solid #f59e0b';
    }

    row.innerHTML = `
      <td style="padding: 10px 12px;">
        <strong style="color: var(--text-primary); font-size: 0.95rem;">${med.name}</strong> 
        <span style="font-size: 0.8rem; color: var(--text-muted);">(${med.presentation})</span>
        ${med.schedule ? `
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-primary); margin-top: 3px; display: flex; align-items: center; gap: 4px;">
            <span>⏰ Horario:</span> <strong>${med.schedule}</strong>
          </div>
        ` : ''}
      </td>
      <td style="padding: 10px 12px; font-weight: 600; color: #38bdf8;">${med.quantity}</td>
      <td style="padding: 10px 12px;">${med.dosage}</td>
      <td style="padding: 10px 12px; font-size: 0.85rem; color: var(--text-muted);">${med.duration}</td>
      <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
        <button type="button" class="btn btn-secondary btn-small btn-edit-med-row" data-idx="${idx}" title="Modificar este medicamento" style="padding: 3px 8px; font-size: 0.78rem; margin-right: 4px; color: #00f2fe; border: 1px solid rgba(0, 242, 254, 0.4); background: rgba(0,242,254,0.08); cursor: pointer;">
          <span>✏️</span> Editar
        </button>
        <button type="button" class="btn btn-danger btn-small btn-remove-med-row" data-idx="${idx}" title="Quitar de la receta" style="padding: 3px 8px; font-size: 0.78rem; cursor: pointer;">
          <span>&times;</span> Quitar
        </button>
      </td>
    `;

    // Botón para editar este medicamento específico en el formulario superior
    row.querySelector('.btn-edit-med-row').addEventListener('click', () => {
      activeEditingMedIndex = idx;
      const mToEdit = currentPrescriptionMedicines[idx];

      const medNameInput = document.getElementById('m-name');
      const presentationSelect = document.getElementById('m-presentation');
      const qtyInput = document.getElementById('m-quantity');
      const dosageInput = document.getElementById('m-dosage');
      const durationInput = document.getElementById('m-duration');
      const scheduleInput = document.getElementById('m-schedule');
      const breakdownCheck = document.getElementById('m-breakdown-schedule');
      const prescTypeSelect = document.getElementById('m-presc-type');

      if (medNameInput) medNameInput.value = mToEdit.name;
      if (presentationSelect) {
        const cleanPres = (mToEdit.presentation || 'Tabletas').replace(/Unidad \(|\)|Dosis fracc\. \(|\)/g, '');
        presentationSelect.value = cleanPres;
      }
      if (prescTypeSelect) prescTypeSelect.value = mToEdit.tipoPrescripcion || 'presentacion';
      if (qtyInput) qtyInput.value = mToEdit.cantidad_o_dosis !== undefined ? mToEdit.cantidad_o_dosis : (parseFloat(mToEdit.quantity) || 1);
      if (dosageInput) dosageInput.value = mToEdit.dosage || '';
      if (durationInput) durationInput.value = mToEdit.duration || '';
      if (scheduleInput) scheduleInput.value = mToEdit.schedule || '';
      if (breakdownCheck) breakdownCheck.checked = !!mToEdit.breakdownSchedule;

      // Actualizar formulario UI
      const formTitle = document.getElementById('recipe-med-form-title');
      if (formTitle) formTitle.innerHTML = '<span style="color: #f59e0b;">✏️ Modificar Medicamento:</span> ' + mToEdit.name;
      const formBadge = document.getElementById('recipe-med-form-mode-badge');
      if (formBadge) formBadge.style.display = 'inline-block';
      const formCard = document.getElementById('recipe-med-form-card');
      if (formCard) formCard.style.borderColor = '#f59e0b';

      const submitBtn = document.getElementById('btn-submit-med');
      if (submitBtn) {
        submitBtn.className = 'btn btn-warning btn-small';
        submitBtn.innerHTML = '<span>💾</span> Actualizar Medicamento';
      }
      const cancelMedBtn = document.getElementById('btn-cancel-med-edit');
      if (cancelMedBtn) cancelMedBtn.style.display = 'inline-block';

      renderCurrentMedicinesTable();

      if (medNameInput) {
        medNameInput.focus();
        const formEl = document.getElementById('recipe-med-form-card');
        if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Botón para quitar este medicamento de la receta
    row.querySelector('.btn-remove-med-row').addEventListener('click', () => {
      currentPrescriptionMedicines.splice(idx, 1);
      if (activeEditingMedIndex === idx) {
        activeEditingMedIndex = null;
        const formTitle = document.getElementById('recipe-med-form-title');
        if (formTitle) formTitle.innerHTML = '<span>+</span> Agregar Medicamento';
        const formBadge = document.getElementById('recipe-med-form-mode-badge');
        if (formBadge) formBadge.style.display = 'none';
        const formCard = document.getElementById('recipe-med-form-card');
        if (formCard) formCard.style.borderColor = 'var(--border-color)';
        const submitBtn = document.getElementById('btn-submit-med');
        if (submitBtn) {
          submitBtn.className = 'btn btn-secondary btn-small';
          submitBtn.innerHTML = '<span>+</span> Agregar a la Receta';
        }
        const cancelMedBtn = document.getElementById('btn-cancel-med-edit');
        if (cancelMedBtn) cancelMedBtn.style.display = 'none';
      } else if (activeEditingMedIndex > idx) {
        activeEditingMedIndex--;
      }
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
  const editFromPreviewBtn = document.getElementById('btn-edit-recipe-from-preview');
  
  if (!modal || !previewContainer || !printActionBtn) return;

  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'Hospital Privado Multimédica Sayaxché', address: 'Sayaxché, Petén', phone: '+502 5555-5555', email: 'info@multimedica.gt' };

  // Configurar botón "Modificar Receta" en el pie del modal
  if (editFromPreviewBtn) {
    if (recipe && recipe.id && recipe.id.startsWith('r-')) {
      editFromPreviewBtn.style.display = 'inline-flex';
      editFromPreviewBtn.onclick = () => {
        modal.style.display = 'none';
        startEditingRecipe(patient, recipe);
      };
    } else {
      editFromPreviewBtn.style.display = 'none';
    }
  }

  // Formatear fecha
  let dateFormatted = 'Reciente';
  try {
    if (recipe && recipe.date) {
      dateFormatted = new Date(recipe.date).toLocaleDateString('es-GT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
  } catch(e) {}

  // Calcular edad
  const dob = new Date(patient.birthdate || patient.birthDate);
  const age = isNaN(dob.getTime()) ? 'N/D' : Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);

  // Renders the prescription in print-optimized markup with native multi-page table structure
  previewContainer.innerHTML = `
    <div class="prescription-preview-box">
      
      <!-- Tabla principal de impresión y pantalla -->
      <table style="width: 100%; border-collapse: collapse; background: transparent;">
        <thead>
          <tr>
            <td style="border: none; padding: 0 0 15px 0;">
              <!-- Encabezado de la clínica (se repite automáticamente al inicio de cada página física) -->
              <div class="prescription-preview-header" style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
                  ${clinic.logoData 
                    ? `<img src="${clinic.logoData}" style="max-height: 96px; max-width: 240px; object-fit: contain; border-radius: 4px;">` 
                    : `<img src="${logoUrl}" style="max-height: 96px; max-width: 240px; object-fit: contain; border-radius: 4px;">`}
                  <div>
                    <div class="prescription-preview-logo" style="margin: 0; font-size: 1.25rem;">${clinic.name}</div>
                    <div style="font-size: 0.85rem; font-weight: 600; color: #555; margin-top: 4px;">Atención Médica Profesional</div>
                  </div>
                </div>
                <div class="prescription-preview-clinic-details">
                  📍 ${clinic.address}<br>
                  📞 Teléfono: ${clinic.phone}<br>
                  ✉️ Email: ${clinic.email}
                </div>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: none; padding: 0;">
              <div class="prescription-print-content">
                <!-- Información básica del paciente y receta -->
                <div class="prescription-preview-patient-info">
                  <div>
                    <strong>Paciente:</strong> ${patient.name}<br>
                    <strong>Edad:</strong> ${age} años | <strong>Género:</strong> ${patient.gender || 'No especificado'}
                  </div>
                  <div style="text-align: right;">
                    <strong>Fecha:</strong> ${dateFormatted} ${recipe.updated_at ? '<small style="color: #666;">(Modificada)</small>' : ''}<br>
                    <strong>No. Receta:</strong> ${String(recipe.id || '').replace('r-', '')}
                  </div>
                </div>

                <!-- Icono Rp -->
                <div class="prescription-preview-rx-icon">Rp.</div>

                <!-- Listado de medicamentos -->
                <table class="prescription-preview-table">
                  <thead>
                    <tr>
                      <th style="width: 72%; text-align: left;">MEDICAMENTO Y DOSIS</th>
                      <th style="width: 28%; text-align: right;">CANTIDAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(recipe.medicines || []).map(m => {
                      const medName = typeof m === 'object' ? (m.name || '') : String(m || '');
                      const medPres = (typeof m === 'object' && m.presentation) ? ` (${m.presentation})` : '';
                      const medSched = (typeof m === 'object' && m.schedule) ? m.schedule : '';
                      const medDosage = (typeof m === 'object' && m.dosage) ? m.dosage : '';
                      const medDur = (typeof m === 'object' && m.duration) ? m.duration : '';
                      const medQty = (typeof m === 'object' && m.quantity) ? m.quantity : '1';
                      return `
                        <tr>
                          <td style="text-align: left; padding: 12px 8px; vertical-align: top;">
                            <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 3px; flex-wrap: wrap;">
                              <strong style="color: #000; font-size: 1.15rem; text-transform: uppercase;">${medName}${medPres}</strong>
                              ${medSched ? `
                                <span class="prescription-med-schedule" style="font-size: 1.05rem; font-weight: 700; color: #0284c7; white-space: nowrap; font-family: system-ui, -apple-system, sans-serif;">
                                  ${medSched}
                                </span>
                              ` : ''}
                            </div>
                            <div class="prescription-preview-indications" style="text-transform: uppercase; font-size: 0.92rem; color: #222; line-height: 1.4;">
                              ${medDosage}${medDosage && medDur ? ' — ' : ''}${medDur}
                            </div>
                          </td>
                          <td style="text-align: right; font-weight: 700; padding: 12px 8px; font-size: 1.12rem; color: #111; vertical-align: top; text-transform: uppercase;">
                            ${medQty}
                          </td>
                        </tr>
                      `;
                    }).join('')}
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
            <td style="border: none; padding: 30px 0 10px 0;">
              <!-- Firma del Médico y Control de Hojas (se repite automáticamente al final de cada página física) -->
              <div class="prescription-preview-footer" style="margin-top: 1.5rem; display: flex; flex-direction: column; align-items: center; text-align: center;">
                <div class="prescription-preview-signature-line"></div>
                <div class="prescription-preview-doctor-sign">${recipe.doctorName || 'Médico Tratante'}</div>
                <div class="prescription-preview-license">Colegiado Activo No. ${recipe.doctorLicense || 'N/A'}</div>
                <div class="prescription-preview-license" style="margin-top: 2px;">Teléfono: ${recipe.doctorPhone || 'N/A'}</div>
                <div class="prescription-page-counter-print"></div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>

    </div>
  `;

  // Bind de impresión oficial
  printActionBtn.onclick = () => {
    printPrescriptionDocument(patient, recipe);
  };

  modal.style.display = 'flex';
}

// Función para impresión directa, emergente o fallback de receta médica oficial
export function printPrescriptionDocument(patient, recipe) {
  if (!recipe || !patient) return;

  const state = getAppState();
  const clinic = state.clinicInfo || { 
    name: 'Hospital Privado Multimédica Sayaxché', 
    address: 'Sayaxché, Petén', 
    phone: '+502 5555-5555', 
    email: 'info@multimedica.gt' 
  };

  let dateFormatted = 'Reciente';
  try {
    if (recipe.date) {
      dateFormatted = new Date(recipe.date).toLocaleDateString('es-GT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
  } catch(e) {}

  const dob = new Date(patient.birthdate || patient.birthDate);
  const age = isNaN(dob.getTime()) ? 'N/D' : Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  const recipeNumber = String(recipe.id || '').replace('r-', '');

  const printWindow = window.open('', '_blank');
  
  const contentHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Receta Médica - ${patient.name} - No. ${recipeNumber}</title>
      <style>
        @page {
          size: letter;
          margin: 15mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          margin: 0;
          padding: 20px;
          background: #fff;
          color: #111;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 14px;
          line-height: 1.4;
        }
        .prescription-container {
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #222;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .clinic-name {
          font-size: 1.3rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .clinic-sub {
          font-size: 0.85rem;
          font-weight: 600;
          color: #475569;
          margin-top: 2px;
        }
        .clinic-details {
          text-align: right;
          font-size: 0.8rem;
          color: #334155;
          line-height: 1.4;
        }
        .patient-bar {
          background: #f1f5f9;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          border-left: 4px solid #0284c7;
        }
        .rx-symbol {
          font-family: 'Times New Roman', serif;
          font-size: 2.2rem;
          font-weight: bold;
          font-style: italic;
          color: #0f172a;
          margin: 10px 0;
        }
        table.meds-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        table.meds-table th {
          border-bottom: 2px solid #0f172a;
          padding: 8px 6px;
          text-align: left;
          font-size: 0.85rem;
          font-weight: 800;
          color: #0f172a;
        }
        table.meds-table td {
          border-bottom: 1px solid #e2e8f0;
          padding: 12px 6px;
          vertical-align: top;
        }
        .med-name {
          font-size: 1.1rem;
          font-weight: 800;
          color: #000;
          text-transform: uppercase;
        }
        .med-sched {
          font-size: 1rem;
          font-weight: 700;
          color: #0284c7;
        }
        .med-dosage {
          font-size: 0.95rem;
          color: #334155;
          margin-top: 3px;
          text-transform: uppercase;
        }
        .med-qty {
          text-align: right;
          font-size: 1.1rem;
          font-weight: 800;
          color: #000;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .indications-box {
          margin-top: 15px;
          border-top: 1px dashed #cbd5e1;
          padding-top: 12px;
        }
        .indications-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .indications-text {
          margin: 0;
          font-size: 0.92rem;
          color: #334155;
          white-space: pre-wrap;
          line-height: 1.45;
        }
        .footer-sign {
          margin-top: 50px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          page-break-inside: avoid;
        }
        .sign-line {
          width: 220px;
          border-top: 1.5px solid #334155;
          margin-bottom: 8px;
        }
        .doc-name {
          font-size: 0.95rem;
          font-weight: 800;
          color: #000;
        }
        .doc-lic {
          font-size: 0.85rem;
          color: #475569;
          margin-top: 2px;
        }
        .no-print-bar {
          background: #0f172a;
          color: #fff;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-radius: 6px;
        }
        @media print {
          .no-print-bar {
            display: none !important;
          }
          body {
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <span>📄 Vista de Impresión Oficial de Receta Médica</span>
        <div>
          <button onclick="window.print()" style="padding: 6px 16px; background: #10b981; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.9rem;">
            🖨️ Imprimir Ahora
          </button>
          <button onclick="window.close()" style="margin-left: 8px; padding: 6px 12px; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
            Cerrar
          </button>
        </div>
      </div>

      <div class="prescription-container">
        <div class="header">
          <div class="header-brand">
            ${clinic.logoData 
              ? `<img src="${clinic.logoData}" style="max-height: 80px; max-width: 200px; object-fit: contain;">` 
              : `<img src="${logoUrl}" style="max-height: 80px; max-width: 200px; object-fit: contain;">`}
            <div>
              <div class="clinic-name">${clinic.name}</div>
              <div class="clinic-sub">Atención Médica Profesional</div>
            </div>
          </div>
          <div class="clinic-details">
            📍 ${clinic.address}<br>
            📞 Tel: ${clinic.phone}<br>
            ✉️ ${clinic.email}
          </div>
        </div>

        <div class="patient-bar">
          <div>
            <strong>Paciente:</strong> ${patient.name}<br>
            <strong>Edad:</strong> ${age} años | <strong>Género:</strong> ${patient.gender || 'No especificado'}
          </div>
          <div style="text-align: right;">
            <strong>Fecha:</strong> ${dateFormatted} ${recipe.updated_at ? '<small>(Modificada)</small>' : ''}<br>
            <strong>No. Receta:</strong> ${recipeNumber}
          </div>
        </div>

        <div class="rx-symbol">Rp.</div>

        <table class="meds-table">
          <thead>
            <tr>
              <th style="width: 72%;">MEDICAMENTO Y DOSIS</th>
              <th style="width: 28%; text-align: right;">CANTIDAD</th>
            </tr>
          </thead>
          <tbody>
            ${(recipe.medicines || []).map(m => {
              const medName = typeof m === 'object' ? (m.name || '') : String(m || '');
              const medPres = (typeof m === 'object' && m.presentation) ? ` (${m.presentation})` : '';
              const medSched = (typeof m === 'object' && m.schedule) ? m.schedule : '';
              const medDosage = (typeof m === 'object' && m.dosage) ? m.dosage : '';
              const medDur = (typeof m === 'object' && m.duration) ? m.duration : '';
              const medQty = (typeof m === 'object' && m.quantity) ? m.quantity : '1';
              return `
                <tr>
                  <td>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
                      <span class="med-name">${medName}${medPres}</span>
                      ${medSched ? `<span class="med-sched">${medSched}</span>` : ''}
                    </div>
                    <div class="med-dosage">
                      ${medDosage}${medDosage && medDur ? ' — ' : ''}${medDur}
                    </div>
                  </td>
                  <td class="med-qty">${medQty}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        ${recipe.indications ? `
          <div class="indications-box">
            <div class="indications-title">Indicaciones y Recomendaciones Generales:</div>
            <p class="indications-text">${recipe.indications}</p>
          </div>
        ` : ''}

        <div class="footer-sign">
          <div class="sign-line"></div>
          <div class="doc-name">${recipe.doctorName || 'Médico Tratante'}</div>
          <div class="doc-lic">Colegiado Activo No. ${recipe.doctorLicense || 'N/A'}</div>
          ${recipe.doctorPhone ? `<div class="doc-lic">Tel: ${recipe.doctorPhone}</div>` : ''}
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 350);
        };
      </script>
    </body>
    </html>
  `;

  if (printWindow) {
    printWindow.document.write(contentHtml);
    printWindow.document.close();
  } else {
    // Si el navegador bloqueó la ventana emergente, usamos el modal en pantalla como fallback
    showPrescriptionPreviewModal(patient, recipe);
    setTimeout(() => {
      window.print();
    }, 400);
  }
}

window.printPrescriptionDocument = printPrescriptionDocument;
window.showPrescriptionPreviewModal = showPrescriptionPreviewModal;

