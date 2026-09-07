// src/modules/farmacia.js
// Hospital Privado Multimédica Sayaxché / Sistema LUGAMED
// Norma y Procedimientos de Almacén y Farmacia: HMM-MAN-ALM-05 (Versión 5.0)

import { getAppState, saveAppState, hashPassword, isAdminUser } from '../main.js';
import logoUrl from '../assets/logo.jpg';

// ==========================================
// 1. HELPERS DE MEDICAMENTOS Y ESTRUCTURAS
// ==========================================

export function enrichMedication(m) {
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

  const authLevel = getMedicationAuthorizationLevel(m);
  const esTermo = isThermosensitive(m);

  return {
    ...m,
    price: precio,
    precio_presentacion: precio,
    unidades_por_presentacion: unidades,
    unidad_dispensable: unidadDispensable,
    precio_unitario: parseFloat((precio / Math.max(1, unidades)).toFixed(4)),
    es_fraccionable: esFrac,
    permite_dosis: esFrac,
    dosis_total_presentacion: dosisTotal,
    unidad_medida_dosis: unidadMedida,
    authLevel,
    esTermolabil: esTermo
  };
}

export function formatStockFriendly(stock, factor, presentacion = 'Caja', unidadDispensable = 'Tableta') {
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

export function isThermosensitive(med) {
  if (!med) return false;
  if (med.esTermolabil !== undefined) return !!med.esTermolabil;
  const n = String(med.name || '').toLowerCase();
  const g = String(med.generic || '').toLowerCase();
  return n.includes('insulina') || n.includes('vacuna') || n.includes('oxitocina') ||
         n.includes('ergometrina') || n.includes('albumina') || g.includes('insulina') ||
         g.includes('vacuna') || g.includes('oxytocin') || n.includes('inmunoglobulina');
}

export function getMedicationAuthorizationLevel(med) {
  if (!med) return { nivel: 1, label: 'Nivel 1: General', color: '#10b981', requiresGerencia: false, requiresMedica: false };
  if (med.nivelAutorizacion && typeof med.nivelAutorizacion === 'object') return med.nivelAutorizacion;
  
  const n = String(med.name || '').toLowerCase();
  const g = String(med.generic || '').toLowerCase();

  // Nivel 3: Estupefacientes, Psicotrópicos y Alto Costo
  if (n.includes('morfina') || g.includes('morphine') || n.includes('fentanil') || g.includes('fentanyl') ||
      n.includes('petidina') || g.includes('meperidina') || n.includes('albumina') || g.includes('albumin') ||
      n.includes('diazepam') || n.includes('midazolam') || n.includes('remifentanil')) {
    return {
      nivel: 3,
      label: 'Nivel 3: Estupefaciente / Alto Costo (Dirección Médica + Gerencia)',
      badge: 'Nivel 3 (Retenida + Gerencia)',
      color: '#ef4444',
      requiresGerencia: true,
      requiresMedica: true
    };
  }

  // Nivel 2: Antibióticos de amplio espectro, Anticoagulantes
  if (n.includes('meropenem') || n.includes('vancomicina') || n.includes('imipenem') || n.includes('ceftriaxona') ||
      n.includes('ertapenem') || n.includes('enoxaparina') || n.includes('heparina') || n.includes('piperacilina') ||
      g.includes('meropenem') || g.includes('vancomycin') || g.includes('enoxaparin')) {
    return {
      nivel: 2,
      label: 'Nivel 2: Restringido / Amplio Espectro (Firma Dirección Médica)',
      badge: 'Nivel 2 (Dirección Médica)',
      color: '#f59e0b',
      requiresGerencia: false,
      requiresMedica: true
    };
  }

  return {
    nivel: 1,
    label: 'Nivel 1: Uso General / Prescripción Regular',
    badge: 'Nivel 1 (General)',
    color: '#10b981',
    requiresGerencia: false,
    requiresMedica: false
  };
}

// ==========================================
// 2. MOTOR PEPS (FIFO) DE KARDEX HOSPITALARIO
// ==========================================

export function ensureKardexPEPS(state) {
  state.almacenKardexPEPS = state.almacenKardexPEPS || [];
  const meds = state.medications || [];

  meds.forEach(m => {
    const enriched = enrichMedication(m);
    const existingBatches = state.almacenKardexPEPS.filter(b => b.medicationId === m.id && b.activo !== false);
    
    if (existingBatches.length === 0) {
      const stockUnits = m.stock !== undefined ? parseInt(m.stock) : 120;
      const initialEntryDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const defaultExp = m.vencimiento || new Date(Date.now() + 540 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
      
      const batch = {
        id: `PEPS-${m.id}-LOT01`,
        medicationId: m.id,
        medicationName: m.name,
        generic: m.generic || '',
        presentation: m.presentation || 'Caja',
        unidad_dispensable: enriched.unidad_dispensable,
        unidades_por_presentacion: enriched.unidades_por_presentacion,
        lote: m.lote || 'LOTE-INICIAL-2026',
        factura: 'FAC-APERTURA-001',
        ordenCompra: 'OC-2026-001',
        proveedor: 'Droguería y Distribuidora Multimédica',
        fechaIngreso: initialEntryDate,
        fechaVencimiento: defaultExp,
        vigenciaMeses: 24,
        precioCosto: parseFloat(((enriched.price || 50) * 0.65).toFixed(2)),
        precioVenta: parseFloat((enriched.price || 50).toFixed(2)),
        stockInicial: stockUnits,
        stockActual: stockUnits,
        temperaturaRecepcion: enriched.esTermolabil ? 4.5 : 21.0,
        inspeccionOrganoleptica: 'Conforme',
        nivelAutorizacion: enriched.authLevel,
        esTermolabil: enriched.esTermolabil,
        ubicacion: enriched.esTermolabil ? 'Refrigerador Cadena de Frío (Estante 1)' : 'Almacén Central (Pasillo A-02)',
        activo: true
      };
      state.almacenKardexPEPS.push(batch);
    }
  });

  return state.almacenKardexPEPS;
}

export function getAvailableStockPEPS(state, medicationId) {
  ensureKardexPEPS(state);
  const batches = state.almacenKardexPEPS.filter(b => b.medicationId === medicationId && b.activo !== false && (b.stockActual || 0) > 0);
  return batches.reduce((sum, b) => sum + (parseInt(b.stockActual) || 0), 0);
}

export function consumeStockPEPS(state, medicationId, requestedUnits, purpose = 'Dispensación', referenceId = '') {
  ensureKardexPEPS(state);
  const qtyToDeduct = parseInt(requestedUnits) || 0;
  if (qtyToDeduct <= 0) return { success: true, consumed: [] };

  const batches = state.almacenKardexPEPS
    .filter(b => b.medicationId === medicationId && b.activo !== false && (b.stockActual || 0) > 0)
    .sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));

  const totalAvailable = batches.reduce((sum, b) => sum + (b.stockActual || 0), 0);
  if (totalAvailable < qtyToDeduct) {
    return {
      success: false,
      error: `Existencias PEPS insuficientes. Disponibles: ${totalAvailable}, Solicitadas: ${qtyToDeduct}`,
      totalAvailable,
      qtyToDeduct
    };
  }

  let remaining = qtyToDeduct;
  const consumedDetails = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const canTake = Math.min(batch.stockActual, remaining);
    batch.stockActual -= canTake;
    remaining -= canTake;

    consumedDetails.push({
      batchId: batch.id,
      lote: batch.lote,
      factura: batch.factura,
      fechaVencimiento: batch.fechaVencimiento,
      cantidadConsumida: canTake,
      precioCostoUnitario: (batch.precioCosto / Math.max(1, batch.unidades_por_presentacion || 1)),
      precioVentaUnitario: (batch.precioVenta / Math.max(1, batch.unidades_por_presentacion || 1)),
      purpose,
      referenceId,
      timestamp: new Date().toISOString()
    });
  }

  // Sincronizar stock en catálogo de medicamentos
  const med = (state.medications || []).find(m => m.id === medicationId);
  if (med) {
    med.stock = Math.max(0, (med.stock !== undefined ? med.stock : totalAvailable) - qtyToDeduct);
  }

  return {
    success: true,
    consumed: consumedDetails,
    totalConsumed: qtyToDeduct
  };
}

export function reintegrateStockPEPS(state, medicationId, unitsToReintegrate, batchId = null, reason = 'Devolución Unidosis Conforme') {
  ensureKardexPEPS(state);
  const qty = parseInt(unitsToReintegrate) || 0;
  if (qty <= 0) return { success: true };

  let targetBatch = null;
  if (batchId) {
    targetBatch = state.almacenKardexPEPS.find(b => b.id === batchId);
  }
  if (!targetBatch) {
    targetBatch = state.almacenKardexPEPS
      .filter(b => b.medicationId === medicationId && b.activo !== false)
      .sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso))[0];
  }

  if (targetBatch) {
    targetBatch.stockActual = (targetBatch.stockActual || 0) + qty;
  }

  const med = (state.medications || []).find(m => m.id === medicationId);
  if (med) {
    med.stock = (med.stock || 0) + qty;
  }

  return {
    success: true,
    batchId: targetBatch ? targetBatch.id : null,
    unitsReintegrated: qty,
    reason,
    timestamp: new Date().toISOString()
  };
}

// ==========================================
// 3. PESTAÑA PRINCIPAL Y NAVEGACIÓN
// ==========================================

let activeFarmaciaTab = 'tab-dispense-recipes';
let currentCart = [];
let selectedMedicineForSale = null;

export function renderFarmacia(container) {
  const state = getAppState();
  ensureKardexPEPS(state);

  container.innerHTML = `
    <div class="module-header">
      <div class="module-title">
        <h1 style="display: flex; align-items: center; gap: 10px;">
          <span>🏥</span> Sistema de Gestión de Almacén, Farmacia y Dosis Unitaria
        </h1>
        <p>Hospital Privado Multimédica Sayaxché | Sistema LUGAMED (Norma HMM-MAN-ALM-05 V5.0)</p>
      </div>
    </div>

    <!-- Pestañas Operativas del Manual HMM-MAN-ALM-05 -->
    <div class="tabs-container" style="display: flex; gap: 8px; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; overflow-x: auto;">
      <button class="tab-btn active" id="tab-dispense-recipes">📋 Despacho y Recetas</button>
      <button class="tab-btn" id="tab-unidosis-24h">💊 Unidosis 24H (F06/F07)</button>
      <button class="tab-btn" id="tab-recepcion-kardex">📦 Recepción y Kardex (F01/F02)</button>
      <button class="tab-btn" id="tab-cadena-frio">❄️ Cadena de Frío (F05)</button>
      <button class="tab-btn" id="tab-autorizaciones">🛡️ Autorizaciones Digitales</button>
      <button class="tab-btn" id="tab-dashboard-kpis">📊 Dashboard y Auditoría</button>
      <button class="tab-btn" id="tab-external-sale">🏪 Venta Externa</button>
      <button class="tab-btn" id="tab-bajas-vencidos">🗑️ Bajas y Mermas (F03)</button>
      <button class="tab-btn" id="tab-demanda-real">📈 Demanda Real</button>
      <button class="tab-btn" id="tab-sales-history">📜 Historial General</button>
    </div>

    <!-- Alertas Activas de Caducidad y Quiebre de Stock -->
    <div id="inventory-alerts-container" style="margin-bottom: 1.25rem; display: none;"></div>

    <div class="glass-card" style="padding: 1.5rem; min-height: 500px;">
      <!-- PANE 1: DESPACHO Y RECETAS -->
      <div id="pane-dispense-recipes" class="tab-pane active" style="display: block;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="color: var(--accent-primary); margin: 0;">Recetas y Prescripciones Médicas Hospitalarias</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 4px 0 0 0;">
              Despacho con rotación estricta PEPS (FIFO), validación de nivel de autorización (1, 2 y 3) y control de cobro.
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="recipe-search-filter" placeholder="🔍 Filtrar paciente o médico..." style="padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
          </div>
        </div>
        <div id="pending-recipes-list" style="display: flex; flex-direction: column; gap: 1.25rem;"></div>
      </div>

      <!-- PANE 2: UNIDOSIS 24H (HMM-ALM-F06 y F07) -->
      <div id="pane-unidosis-24h" class="tab-pane" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="color: #00f2fe; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>💊</span> Módulo de Dosis Unitaria 24 Horas (Unidosis)
            </h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 4px 0 0 0;">
              Corte diario 07:00 hrs. Distribución en 4 horarios (08:00, 14:00, 20:00, 02:00 hrs) y rotulación térmica individual.
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" id="btn-generate-unidosis-cassettes" style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem;">
              ⚡ Generar Cassettes Diarios (07:00 Hrs)
            </button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
          <!-- Cassettes Activos 24H -->
          <div class="glass-card" style="padding: 1.25rem; background: rgba(0,0,0,0.2);">
            <h4 style="color: var(--text-primary); margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
              <span>📋 Cassettes en Tránsito / Despachados (HMM-ALM-F06)</span>
              <span id="unidosis-active-badge" style="font-size: 0.75rem; background: rgba(0,242,254,0.15); color: #00f2fe; padding: 2px 8px; border-radius: 10px;">0 Activos</span>
            </h4>
            <div id="unidosis-active-list" style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;"></div>
          </div>

          <!-- Liquidaciones y Retornos 24H -->
          <div class="glass-card" style="padding: 1.25rem; background: rgba(0,0,0,0.2);">
            <h4 style="color: var(--text-primary); margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
              <span>🔄 Conciliación y Liquidación Diaria (HMM-ALM-F07)</span>
              <span id="unidosis-liq-badge" style="font-size: 0.75rem; background: rgba(34,197,94,0.15); color: #22c55e; padding: 2px 8px; border-radius: 10px;">Historial</span>
            </h4>
            <div id="unidosis-liq-list" style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;"></div>
          </div>
        </div>
      </div>

      <!-- PANE 3: RECEPCIÓN TÉCNICA Y KARDEX (HMM-ALM-F01 y F02) -->
      <div id="pane-recepcion-kardex" class="tab-pane" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="color: var(--accent-primary); margin: 0;">Recepción Técnica y Visor Kardex PEPS (FIFO)</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 4px 0 0 0;">
              Ingreso de medicamentos con regla de vigencia ≥ 18 meses (HMM-ALM-F01) y Vales de Requisición (HMM-ALM-F02).
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-success" id="btn-open-modal-recepcion-f01" style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem;">
              📥 Nueva Recepción Técnica (F01)
            </button>
            <button class="btn btn-secondary" id="btn-open-modal-requisicion-f02" style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem;">
              📄 Vale de Requisición Interno (F02)
            </button>
          </div>
        </div>

        <!-- Filtro y Tabla de Lotes Kardex PEPS -->
        <div style="margin-bottom: 1rem; display: flex; gap: 10px; align-items: center;">
          <input type="text" id="kardex-search-input" placeholder="🔍 Buscar lote, factura, medicamento o proveedor..." style="flex: 1; padding: 8px 12px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          <select id="kardex-filter-status" style="padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
            <option value="all">Todos los Lotes</option>
            <option value="with_stock" selected>Lotes con Existencias Activas</option>
            <option value="thermo">Cadena de Frío (Termolábiles)</option>
          </select>
        </div>

        <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.15); margin-bottom: 2rem;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;" id="table-kardex-peps">
            <thead>
              <tr style="background: rgba(255,255,255,0.03); border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                <th style="padding: 10px;">Fecha Ingreso (FIFO)</th>
                <th style="padding: 10px;">Medicamento / Presentación</th>
                <th style="padding: 10px;">Lote / Factura</th>
                <th style="padding: 10px;">Vencimiento / Vigencia</th>
                <th style="padding: 10px;">Temp. Recepción</th>
                <th style="padding: 10px; text-align: right;">Costo (Q)</th>
                <th style="padding: 10px; text-align: right;">Existencia Actual</th>
                <th style="padding: 10px; text-align: center;">Nivel / Estado</th>
              </tr>
            </thead>
            <tbody id="kardex-peps-tbody"></tbody>
          </table>
        </div>

        <!-- Historial de Recepciones F01 y Vales F02 -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div>
            <h4 style="color: var(--text-primary); margin-bottom: 0.75rem;">📋 Actas de Recepción Técnica Registradas (F01)</h4>
            <div id="recepciones-f01-list" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;"></div>
          </div>
          <div>
            <h4 style="color: var(--text-primary); margin-bottom: 0.75rem;">📋 Vales de Requisición y Despacho (F02)</h4>
            <div id="requisiciones-f02-list" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;"></div>
          </div>
        </div>
      </div>

      <!-- PANE 4: CADENA DE FRÍO (HMM-ALM-F05) -->
      <div id="pane-cadena-frio" class="tab-pane" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="color: #38bdf8; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>❄️</span> Bitácora Diaria de Cadena de Frío y Temperatura (HMM-ALM-F05)
            </h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 4px 0 0 0;">
              Monitoreo obligatorio AM (08:00) y PM (18:00). Rangos estándar: Refrigeración (+2°C a +8°C) | Ambiente (15°C a 25°C).
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" id="btn-open-modal-temp-log" style="font-size: 0.85rem;">
              🌡️ Registrar Lectura AM/PM
            </button>
            <button class="btn btn-secondary" id="btn-print-temp-log-month" style="font-size: 0.85rem;">
              🖨️ Imprimir Bitácora Mensual (F05)
            </button>
          </div>
        </div>

        <!-- Indicadores de Termometría -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 1.5rem;">
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid #38bdf8; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Refrigeración (+2°C a +8°C)</span>
            <strong style="font-size: 1.6rem; color: #38bdf8;" id="cf-stat-fridge-temp">4.5 °C</strong>
            <span style="font-size: 0.72rem; color: #10b981;">✅ Rango Conforme</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid #10b981; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Almacén Ambiente (15°C a 25°C)</span>
            <strong style="font-size: 1.6rem; color: #10b981;" id="cf-stat-ambient-temp">21.2 °C</strong>
            <span style="font-size: 0.72rem; color: #10b981;">✅ Rango Conforme</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid #f59e0b; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Humedad Relativa (30% - 65%)</span>
            <strong style="font-size: 1.6rem; color: #f59e0b;" id="cf-stat-humidity">52 %</strong>
            <span style="font-size: 0.72rem; color: #10b981;">✅ Estable</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid #a855f7; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Registros del Mes</span>
            <strong style="font-size: 1.6rem; color: #a855f7;" id="cf-stat-month-count">0</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Tomas AM / PM</span>
          </div>
        </div>

        <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.15);">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;" id="table-temp-log">
            <thead>
              <tr style="background: rgba(255,255,255,0.03); border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                <th style="padding: 10px;">Fecha y Turno</th>
                <th style="padding: 10px;">Hora Lectura</th>
                <th style="padding: 10px; text-align: center;">Temp. Nevera (+2 a +8°C)</th>
                <th style="padding: 10px; text-align: center;">Temp. Ambiente (15 a 25°C)</th>
                <th style="padding: 10px; text-align: center;">Humedad (%)</th>
                <th style="padding: 10px;">Responsable</th>
                <th style="padding: 10px;">Observaciones / Acciones</th>
              </tr>
            </thead>
            <tbody id="temp-log-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- PANE 5: AUTORIZACIONES DIGITALES -->
      <div id="pane-autorizaciones" class="tab-pane" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="color: #eab308; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>🛡️</span> Bandeja de Autorizaciones Especiales (Nivel 2 y 3)
            </h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 4px 0 0 0;">
              Validación y firma digital para antibióticos restringidos, estupefacientes, psicotrópicos y medicamentos de alto costo.
            </p>
          </div>
        </div>

        <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.15);">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;" id="table-auth-tray">
            <thead>
              <tr style="background: rgba(255,255,255,0.03); border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                <th style="padding: 10px;">Fecha y Folio</th>
                <th style="padding: 10px;">Paciente / Servicio</th>
                <th style="padding: 10px;">Medicamento Solicitado</th>
                <th style="padding: 10px;">Clasificación y Nivel</th>
                <th style="padding: 10px;">Médico Prescriptor</th>
                <th style="padding: 10px;">Justificación Clínica</th>
                <th style="padding: 10px; text-align: center;">Estado Autorización</th>
                <th style="padding: 10px; text-align: center;">Acción</th>
              </tr>
            </thead>
            <tbody id="auth-tray-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- PANE 6: DASHBOARD Y KPIS -->
      <div id="pane-dashboard-kpis" class="tab-pane" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="color: var(--accent-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>📊</span> Tablero de Control de Gestión y KPIs Hospitalarios
            </h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 4px 0 0 0;">
              Métricas clave de desempeño de farmacia y almacén según HMM-MAN-ALM-05.
            </p>
          </div>
          <button class="btn btn-primary" id="btn-open-audit-modal" style="font-size: 0.85rem;">
            🔍 Nueva Auditoría Cíclica / Conteo Rotativo
          </button>
        </div>

        <!-- 3 KPIs Principales de la Norma -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 1.5rem;">
          <div class="glass-card" style="padding: 1.25rem; border-top: 4px solid #10b981; background: rgba(30, 41, 59, 0.4);">
            <div style="font-size: 0.82rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">ECL: Eficiencia de Conciliación LUGAMED</div>
            <div style="font-size: 2.2rem; font-weight: bold; color: #10b981; margin: 5px 0;" id="kpi-ecl-value">100.0%</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              Meta: <strong>100.0%</strong> | (Dosis Adm + Dosis Dev Conformes) / Dosis Enviadas
            </div>
          </div>

          <div class="glass-card" style="padding: 1.25rem; border-top: 4px solid #38bdf8; background: rgba(30, 41, 59, 0.4);">
            <div style="font-size: 0.82rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">ERI: Exactitud Registro de Inventario</div>
            <div style="font-size: 2.2rem; font-weight: bold; color: #38bdf8; margin: 5px 0;" id="kpi-eri-value">99.2%</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              Meta: <strong>≥ 98.0%</strong> | Conteo Físico vs Kardex PEPS
            </div>
          </div>

          <div class="glass-card" style="padding: 1.25rem; border-top: 4px solid #ec4899; background: rgba(30, 41, 59, 0.4);">
            <div style="font-size: 0.82rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">TMR: Tasa de Merma en Reempaque</div>
            <div style="font-size: 2.2rem; font-weight: bold; color: #ec4899; margin: 5px 0;" id="kpi-tmr-value">0.18%</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              Meta: <strong>&lt; 0.8%</strong> | Costo Descartado / Costo Total Dispensado
            </div>
          </div>
        </div>

        <!-- Historial de Auditorías de Inventario -->
        <div>
          <h4 style="color: var(--text-primary); margin-bottom: 0.75rem;">📋 Historial de Auditorías Cíclicas de Inventario</h4>
          <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.15);">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
              <thead>
                <tr style="background: rgba(255,255,255,0.03); border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                  <th style="padding: 10px;">Folio Auditoría</th>
                  <th style="padding: 10px;">Fecha</th>
                  <th style="padding: 10px;">Tipo Conteo</th>
                  <th style="padding: 10px; text-align: center;">Ítems Auditados</th>
                  <th style="padding: 10px; text-align: center;">Conformes</th>
                  <th style="padding: 10px; text-align: center;">Discrepancias</th>
                  <th style="padding: 10px; text-align: right;">ERI Resultante</th>
                  <th style="padding: 10px;">Auditor / Responsable</th>
                </tr>
              </thead>
              <tbody id="auditorias-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- PANE 7: VENTA EXTERNA -->
      <div id="pane-external-sale" class="tab-pane" style="display: none;">
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 2rem;">
          <div>
            <h3 style="margin-bottom: 1.25rem; color: var(--accent-secondary);">Buscar y Agregar Medicamentos (Venta Externa)</h3>
            
            <div class="form-group" style="position: relative; margin-bottom: 1.5rem;">
              <label for="pharmacy-med-search">Buscar Medicamento en Catálogo</label>
              <input type="text" id="pharmacy-med-search" placeholder="Ej. Acetaminofén, Amoxicilina, Omeprazol..." autocomplete="off">
              <div id="pharmacy-autocomplete-list" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); z-index: 10; display: none; max-height: 200px; overflow-y: auto; box-shadow: var(--shadow-lg);"></div>
            </div>

            <div id="pharmacy-selection-preview" style="display: none; background: rgba(0, 242, 254, 0.03); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
              <h4 id="prev-med-name" style="color: var(--accent-primary); margin-bottom: 5px;">Medicamento</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">
                Genérico: <span id="prev-med-generic">--</span> | Presentación: <span id="prev-med-presentation">--</span>
              </p>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 15px;">
                🩺 Existencias PEPS: <strong id="prev-med-stock" style="color: var(--accent-success);">--</strong>
              </div>
              
              <div style="display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap;">
                <div class="form-group" style="flex: 1.2; min-width: 150px; margin: 0;">
                  <label for="pharmacy-sale-type">Tipo de Venta</label>
                  <select id="pharmacy-sale-type" style="height: 38px; width: 100%; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                    <option value="presentacion">Presentación Completa</option>
                    <option value="unidad">Unidad Individual</option>
                  </select>
                </div>
                <div class="form-group" style="flex: 1; min-width: 100px; margin: 0;">
                  <label id="lbl-pharmacy-med-qty" for="pharmacy-med-qty">Cantidad</label>
                  <input type="number" id="pharmacy-med-qty" value="1" min="1" step="1" style="height: 38px;">
                </div>
                <div class="form-group" style="flex: 1; min-width: 100px; margin: 0;">
                  <label id="lbl-prev-price-title">Precio</label>
                  <strong style="color: var(--accent-success); font-size: 1.2rem; display: block; margin-top: 5px;" id="prev-med-price">Q0.00</strong>
                </div>
                <button type="button" class="btn btn-success" id="btn-add-to-cart" style="height: 38px; display: flex; align-items: center; gap: 5px;">
                  <span>🛒</span> Agregar
                </button>
              </div>
            </div>

            <div class="glass-card" style="padding: 1.25rem; background: rgba(255, 255, 255, 0.01); border-top: 3px solid var(--accent-primary);">
              <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Datos de Facturación del Comprador</h4>
              <div style="display: flex; gap: 15px;">
                <div class="form-group" style="flex: 1; margin-bottom: 0;">
                  <label for="buyer-nit">NIT / Identificación</label>
                  <input type="text" id="buyer-nit" value="CF" placeholder="Ej. 1234567-8 o CF">
                </div>
                <div class="form-group" style="flex: 2; margin-bottom: 0;">
                  <label for="buyer-name">Nombre Completo</label>
                  <input type="text" id="buyer-name" value="Consumidor Final" placeholder="Ej. Juan Pérez">
                </div>
              </div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; height: 100%;">
            <h3 style="margin-bottom: 1.25rem; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center;">
              <span>🛒 Detalle de Venta</span>
              <button class="btn btn-secondary btn-small" id="btn-clear-cart" style="font-size: 0.8rem; padding: 4px 8px;">Vaciar</button>
            </h3>

            <div style="flex: 1; overflow-y: auto; max-height: 320px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 1rem; background: rgba(0,0,0,0.2);">
              <table style="width: 100%; border-collapse: collapse; text-align: left;" id="cart-table">
                <thead>
                  <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-size: 0.8rem;">
                    <th style="padding: 10px;">Medicamento</th>
                    <th style="padding: 10px; text-align: center;">Cant.</th>
                    <th style="padding: 10px; text-align: right;">Precio</th>
                    <th style="padding: 10px; text-align: right;">Total</th>
                    <th style="padding: 10px; text-align: center; width: 40px;"></th>
                  </tr>
                </thead>
                <tbody id="cart-table-body" style="font-size: 0.85rem;"></tbody>
              </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.15); border-radius: var(--radius-sm); margin-bottom: 1.5rem;">
              <span style="font-weight: 600;">Total a Cobrar:</span>
              <strong style="color: var(--accent-success); font-size: 1.4rem;" id="cart-total-display">Q0.00</strong>
            </div>

            <button class="btn btn-primary" id="btn-finalize-sale" style="width: 100%; padding: 12px; font-size: 1.05rem;">
              <span>⚡</span> Confirmar Venta (Descarga PEPS) e Imprimir Comprobante
            </button>
          </div>
        </div>
      </div>

      <!-- PANE 8: BAJAS Y MERMAS (HMM-ALM-F03) -->
      <div id="pane-bajas-vencidos" class="tab-pane" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="color: var(--accent-danger); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 8px;">
              <span>🗑️</span> Control de Bajas, Mermas y Disposición Final (HMM-ALM-F03)
            </h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">
              Descarte de lotes vencidos, envases dañados y generación de Acta de Baja con clave de Administrador Maestro.
            </p>
          </div>
          <button class="btn btn-secondary" id="btn-print-bajas-report" style="display: flex; align-items: center; gap: 6px;">
            🖨️ Imprimir Reporte de Bajas
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 1.5rem;">
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-danger); background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Lotes Caducados</span>
            <strong style="font-size: 1.6rem; color: var(--accent-danger);" id="baja-stat-expired-count">0</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">En existencias</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-warning); background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Unidades Físicas Vencidas</span>
            <strong style="font-size: 1.6rem; color: var(--accent-warning);" id="baja-stat-expired-units">0</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Pendientes de descarte</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid #ec4899; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Pérdida Económica Estimada</span>
            <strong style="font-size: 1.4rem; color: #f472b6;" id="baja-stat-loss-total">Q0.00</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Valor en libros</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-success); background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Actas HMM-ALM-F03</span>
            <strong style="font-size: 1.6rem; color: var(--accent-success);" id="baja-stat-actas-count">0</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Autorizadas</span>
          </div>
        </div>

        <div style="margin-bottom: 2rem;">
          <h4 style="color: var(--text-primary); margin-bottom: 0.75rem;">⚠️ Lotes Vencidos en Kardex PEPS (Pendientes de Baja)</h4>
          <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(0,0,0,0.15);">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.82rem;" id="table-vencidos-pendientes">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                  <th style="padding: 10px;">Medicamento</th>
                  <th style="padding: 10px;">Lote / Factura</th>
                  <th style="padding: 10px;">Vencimiento</th>
                  <th style="padding: 10px; text-align: right;">Existencias</th>
                  <th style="padding: 10px; text-align: right;">Pérdida Estimada</th>
                  <th style="padding: 10px; text-align: center;">Acción</th>
                </tr>
              </thead>
              <tbody id="vencidos-pendientes-tbody"></tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 style="color: var(--text-primary); margin-bottom: 0.75rem;">📜 Historial de Actas de Baja y Destrucción (F03)</h4>
          <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(0,0,0,0.15);">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.82rem;" id="table-actas-historial">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                  <th style="padding: 10px;">Folio Acta</th>
                  <th style="padding: 10px;">Fecha</th>
                  <th style="padding: 10px;">Medicamento y Lote</th>
                  <th style="padding: 10px; text-align: right;">Cantidad</th>
                  <th style="padding: 10px; text-align: right;">Pérdida (Q)</th>
                  <th style="padding: 10px;">Solicitó</th>
                  <th style="padding: 10px;">Autorizado Por</th>
                  <th style="padding: 10px; text-align: center;">Acta Oficial</th>
                </tr>
              </thead>
              <tbody id="actas-historial-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- PANE 9: DEMANDA REAL -->
      <div id="pane-demanda-real" class="tab-pane" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h3 style="color: var(--accent-primary); margin: 0;">Demanda Real de Medicamentos</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 4px 0 0 0;">
              Medicamentos recetados por médicos que no se encuentran en el Catálogo de Farmacia.
            </p>
          </div>
          <button class="btn btn-secondary" id="btn-print-demanda-real">🖨️ Exportar / Imprimir Reporte</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 1.5rem;">
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-primary); background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Medicamentos Solicitados</span>
            <strong style="font-size: 1.6rem; color: var(--text-primary);" id="dr-stat-unique-meds">0</strong>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-secondary); background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Total Solicitudes</span>
            <strong style="font-size: 1.6rem; color: var(--text-primary);" id="dr-stat-total-records">0</strong>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-success); background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Más Solicitado</span>
            <strong style="font-size: 1.1rem; color: var(--text-primary);" id="dr-stat-top-med">Ninguno</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);" id="dr-stat-top-med-qty">0 unidades</span>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;" id="dr-table">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                <th style="padding: 10px;">Fecha y Hora</th>
                <th style="padding: 10px;">Medicamento Recetado</th>
                <th style="padding: 10px; text-align: center;">Cantidad</th>
                <th style="padding: 10px;">Paciente</th>
                <th style="padding: 10px;">Médico Tratante</th>
              </tr>
            </thead>
            <tbody id="dr-table-body"></tbody>
          </table>
        </div>
      </div>

      <!-- PANE 10: HISTORIAL GENERAL -->
      <div id="pane-sales-history" class="tab-pane" style="display: none;">
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 2rem;">
          <div>
            <h3 style="margin-bottom: 1.25rem; color: var(--accent-primary);">Recetas Médicas Despachadas</h3>
            <div id="dispensed-recipes-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 450px; overflow-y: auto;"></div>
          </div>
          <div>
            <h3 style="margin-bottom: 1.25rem; color: var(--accent-secondary);">Historial de Ventas Externas</h3>
            <div id="external-sales-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 450px; overflow-y: auto;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render inicial de pestaña activa
  refreshActiveTab();

  // Delegación de eventos encapsulada en contenedor
  if (!container.dataset.farmaciaListenersInitialized) {
    container.dataset.farmaciaListenersInitialized = 'true';
    attachFarmaciaEventListeners(container);
  }
}

function refreshActiveTab() {
  renderInventoryAlerts();

  if (activeFarmaciaTab === 'tab-dispense-recipes') {
    renderPendingRecipes();
  } else if (activeFarmaciaTab === 'tab-unidosis-24h') {
    renderUnidosis24hTab();
  } else if (activeFarmaciaTab === 'tab-recepcion-kardex') {
    renderRecepcionKardexTab();
  } else if (activeFarmaciaTab === 'tab-cadena-frio') {
    renderCadenaFrioTab();
  } else if (activeFarmaciaTab === 'tab-autorizaciones') {
    renderAutorizacionesTab();
  } else if (activeFarmaciaTab === 'tab-dashboard-kpis') {
    renderDashboardKPIsTab();
  } else if (activeFarmaciaTab === 'tab-external-sale') {
    renderCartTable();
  } else if (activeFarmaciaTab === 'tab-bajas-vencidos') {
    renderBajasVencidosTab();
  } else if (activeFarmaciaTab === 'tab-demanda-real') {
    renderDemandaReal();
  } else if (activeFarmaciaTab === 'tab-sales-history') {
    renderSalesHistory();
  }
}

function attachFarmaciaEventListeners(container) {
  container.addEventListener('click', (e) => {
    // 1. Cambio de Pestañas
    const tabBtn = e.target.closest('.tab-btn');
    if (tabBtn && tabBtn.id) {
      e.preventDefault();
      container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      container.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
      });

      tabBtn.classList.add('active');
      activeFarmaciaTab = tabBtn.id;
      const targetPane = document.getElementById('pane-' + activeFarmaciaTab.substring(4));
      if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'block';
      }
      refreshActiveTab();
      return;
    }

    // 2. Despachar Receta
    const btnDispense = e.target.closest('.btn-dispense-recipe');
    if (btnDispense) {
      e.preventDefault();
      const recipeId = btnDispense.getAttribute('data-recipe-id');
      const patientId = btnDispense.getAttribute('data-patient-id');
      dispenseRecipe(patientId, recipeId);
      return;
    }

    // 3. Generar Cassettes Unidosis
    const btnGenUnidosis = e.target.closest('#btn-generate-unidosis-cassettes');
    if (btnGenUnidosis) {
      e.preventDefault();
      generateDailyUnidosisCassettes();
      return;
    }

    // 4. Liquidar Cassette Unidosis
    const btnLiqUnidosis = e.target.closest('.btn-liquidate-unidosis');
    if (btnLiqUnidosis) {
      e.preventDefault();
      const unidosisId = btnLiqUnidosis.getAttribute('data-id');
      showLiquidacionUnidosisModal(unidosisId);
      return;
    }

    // 5. Imprimir Hoja Unidosis F06
    const btnPrintF06 = e.target.closest('.btn-print-unidosis-f06');
    if (btnPrintF06) {
      e.preventDefault();
      const uId = btnPrintF06.getAttribute('data-id');
      const state = getAppState();
      const uObj = (state.unidosis24h || []).find(u => u.id === uId);
      if (uObj) printHojaUnidosisF06(uObj);
      return;
    }

    // 6. Imprimir Viñeta Térmica
    const btnPrintLabel = e.target.closest('.btn-print-thermal-label');
    if (btnPrintLabel) {
      e.preventDefault();
      const uId = btnPrintLabel.getAttribute('data-id');
      const doseIndex = parseInt(btnPrintLabel.getAttribute('data-index') || '0');
      const state = getAppState();
      const uObj = (state.unidosis24h || []).find(u => u.id === uId);
      if (uObj && uObj.doses && uObj.doses[doseIndex]) {
        printThermalUnidosisLabel(uObj, uObj.doses[doseIndex]);
      }
      return;
    }

    // 7. Imprimir Acta F07
    const btnPrintF07 = e.target.closest('.btn-print-liq-f07');
    if (btnPrintF07) {
      e.preventDefault();
      const liqId = btnPrintF07.getAttribute('data-id');
      const state = getAppState();
      const liq = (state.liquidacionesUnidosis || []).find(l => l.id === liqId);
      if (liq) printLiquidacionUnidosisF07(liq);
      return;
    }

    // 8. Abrir Modal Recepción F01
    const btnOpenF01 = e.target.closest('#btn-open-modal-recepcion-f01');
    if (btnOpenF01) {
      e.preventDefault();
      showRecepcionF01Modal();
      return;
    }

    // 9. Abrir Modal Requisición F02
    const btnOpenF02 = e.target.closest('#btn-open-modal-requisicion-f02');
    if (btnOpenF02) {
      e.preventDefault();
      showRequisicionF02Modal();
      return;
    }

    // 10. Imprimir F01
    const btnPrintRecF01 = e.target.closest('.btn-print-rec-f01');
    if (btnPrintRecF01) {
      e.preventDefault();
      const rId = btnPrintRecF01.getAttribute('data-id');
      const state = getAppState();
      const rec = (state.recepcionesTecnicas || []).find(r => r.id === rId);
      if (rec) printActaRecepcionF01(rec);
      return;
    }

    // 11. Imprimir F02
    const btnPrintReqF02 = e.target.closest('.btn-print-req-f02');
    if (btnPrintReqF02) {
      e.preventDefault();
      const rId = btnPrintReqF02.getAttribute('data-id');
      const state = getAppState();
      const req = (state.requisicionesHospitalarias || []).find(r => r.id === rId);
      if (req) printValeRequisicionF02(req);
      return;
    }

    // 12. Modal de Temperatura F05
    const btnOpenTemp = e.target.closest('#btn-open-modal-temp-log');
    if (btnOpenTemp) {
      e.preventDefault();
      showTemperaturaF05Modal();
      return;
    }

    // 13. Imprimir Bitácora Mensual F05
    const btnPrintTempMonth = e.target.closest('#btn-print-temp-log-month');
    if (btnPrintTempMonth) {
      e.preventDefault();
      printBitacoraTemperaturaF05();
      return;
    }

    // 14. Autorizar Solicitud Nivel 2/3
    const btnApproveAuth = e.target.closest('.btn-approve-special-auth');
    if (btnApproveAuth) {
      e.preventDefault();
      const authId = btnApproveAuth.getAttribute('data-id');
      approveSpecialAuth(authId);
      return;
    }

    // 15. Modal Auditoría Cíclica
    const btnAudit = e.target.closest('#btn-open-audit-modal');
    if (btnAudit) {
      e.preventDefault();
      showAuditoriaModal();
      return;
    }

    // 16. Carrito Venta Externa
    const btnAddCart = e.target.closest('#btn-add-to-cart');
    if (btnAddCart) {
      e.preventDefault();
      addToCart();
      return;
    }

    const btnClearCart = e.target.closest('#btn-clear-cart');
    if (btnClearCart) {
      e.preventDefault();
      currentCart = [];
      renderCartTable();
      return;
    }

    const btnRemoveCart = e.target.closest('.btn-remove-cart-item');
    if (btnRemoveCart) {
      e.preventDefault();
      const idx = parseInt(btnRemoveCart.getAttribute('data-index'));
      currentCart.splice(idx, 1);
      renderCartTable();
      return;
    }

    const btnFinalizeSale = e.target.closest('#btn-finalize-sale');
    if (btnFinalizeSale) {
      e.preventDefault();
      finalizeExternalSale();
      return;
    }

    // 17. Bajas de Vencidos F03
    const btnBajaDirect = e.target.closest('.btn-trigger-baja-direct');
    if (btnBajaDirect) {
      e.preventDefault();
      const medId = btnBajaDirect.getAttribute('data-med-id');
      const batchId = btnBajaDirect.getAttribute('data-batch-id');
      showBajaVencidoModal(medId, batchId);
      return;
    }

    const btnPrintActaBaja = e.target.closest('.btn-print-baja-acta');
    if (btnPrintActaBaja) {
      e.preventDefault();
      const actaId = btnPrintActaBaja.getAttribute('data-acta-id');
      const state = getAppState();
      const acta = (state.bajasInventario || []).find(b => b.id === actaId) || (state.bajasDisposicion || []).find(b => b.id === actaId);
      if (acta) printActaBajaVencido(acta);
      return;
    }

    const btnPrintReportBajas = e.target.closest('#btn-print-bajas-report');
    if (btnPrintReportBajas) {
      e.preventDefault();
      printBajasSummaryReport();
      return;
    }

    // 18. Demanda Real
    const btnPrintDR = e.target.closest('#btn-print-demanda-real');
    if (btnPrintDR) {
      e.preventDefault();
      printDemandaRealReport();
      return;
    }

    // 19. Reimpresión Comprobante Venta
    const btnReprintSale = e.target.closest('.btn-reprint-sale');
    if (btnReprintSale) {
      e.preventDefault();
      const saleId = btnReprintSale.getAttribute('data-id');
      const state = getAppState();
      const sale = (state.externalSales || []).find(s => s.id === saleId);
      if (sale) printSalesVoucher(sale);
      return;
    }
  });

  // Filtro de Búsqueda de Recetas
  const recipeSearch = container.querySelector('#recipe-search-filter');
  if (recipeSearch) {
    recipeSearch.addEventListener('input', () => renderPendingRecipes());
  }

  // Filtros de Kardex
  const kardexSearch = container.querySelector('#kardex-search-input');
  const kardexFilter = container.querySelector('#kardex-filter-status');
  if (kardexSearch) kardexSearch.addEventListener('input', () => renderRecepcionKardexTab());
  if (kardexFilter) kardexFilter.addEventListener('change', () => renderRecepcionKardexTab());

  // Tipo de venta externa
  container.addEventListener('change', (e) => {
    const saleTypeSelect = e.target.closest('#pharmacy-sale-type');
    if (saleTypeSelect && selectedMedicineForSale) {
      const type = saleTypeSelect.value;
      const priceDisplay = document.getElementById('prev-med-price');
      const qtyLabel = document.getElementById('lbl-pharmacy-med-qty');
      const priceTitle = document.getElementById('lbl-prev-price-title');

      if (priceDisplay) {
        if (type === 'presentacion') {
          priceDisplay.textContent = `Q${parseFloat(selectedMedicineForSale.precio_presentacion).toFixed(2)}`;
          if (qtyLabel) qtyLabel.textContent = `Cantidad (${selectedMedicineForSale.presentation || 'Caja'}(s))`;
          if (priceTitle) priceTitle.textContent = "Precio Presentación";
        } else {
          priceDisplay.textContent = `Q${parseFloat(selectedMedicineForSale.precio_unitario).toFixed(2)}`;
          if (qtyLabel) qtyLabel.textContent = `Cantidad (${selectedMedicineForSale.unidad_dispensable || 'Tableta'}(s))`;
          if (priceTitle) priceTitle.textContent = "Precio Unitario";
        }
      }
    }
  });

  // Autocomplete de Medicamentos
  setupPharmacyAutocomplete(container);
}

function setupPharmacyAutocomplete(container) {
  const medSearchInput = container.querySelector('#pharmacy-med-search');
  if (!medSearchInput) return;

  medSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const autocompleteList = container.querySelector('#pharmacy-autocomplete-list');
    if (!autocompleteList) return;

    autocompleteList.innerHTML = '';
    if (query.trim().length < 2) {
      autocompleteList.style.display = 'none';
      return;
    }

    const appState = getAppState();
    ensureKardexPEPS(appState);
    const medications = appState.medications || [];

    const matches = medications.filter(m => {
      const nameMatch = (m.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query);
      const genericMatch = (m.generic || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query);
      return nameMatch || genericMatch;
    });

    if (matches.length === 0) {
      autocompleteList.innerHTML = `
        <div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; font-style: italic;">
          Medicamento no encontrado en el catálogo.
        </div>
      `;
      autocompleteList.style.display = 'block';
      return;
    }

    matches.slice(0, 8).forEach(match => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        font-size: 0.85rem;
      `;
      const enrichedMatch = enrichMedication(match);
      const availableUnits = getAvailableStockPEPS(appState, match.id);
      const friendlyStock = formatStockFriendly(availableUnits, enrichedMatch.unidades_por_presentacion, enrichedMatch.presentation, enrichedMatch.unidad_dispensable);

      item.innerHTML = `
        <strong style="color: var(--accent-primary);">${match.name}</strong> 
        <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 5px;">(${match.generic || 'Sin genérico'} - ${match.presentation})</span><br>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Stock PEPS: ${friendlyStock}</span>
        <strong style="color: var(--accent-success); float: right; margin-top: -10px;">Q${parseFloat(match.price).toFixed(2)}</strong>
      `;

      item.addEventListener('click', () => {
        selectedMedicineForSale = enrichedMatch;
        document.getElementById('prev-med-name').textContent = match.name;
        document.getElementById('prev-med-generic').textContent = match.generic || 'N/D';
        document.getElementById('prev-med-presentation').textContent = match.presentation || 'N/D';
        document.getElementById('prev-med-stock').textContent = friendlyStock;

        const saleTypeSelect = document.getElementById('pharmacy-sale-type');
        if (saleTypeSelect) saleTypeSelect.value = 'presentacion';
        const qtyLabel = document.getElementById('lbl-pharmacy-med-qty');
        if (qtyLabel) qtyLabel.textContent = `Cantidad (${match.presentation || 'Caja'}(s))`;
        const priceTitle = document.getElementById('lbl-prev-price-title');
        if (priceTitle) priceTitle.textContent = "Precio Presentación";
        
        document.getElementById('prev-med-price').textContent = `Q${parseFloat(match.price).toFixed(2)}`;
        document.getElementById('pharmacy-selection-preview').style.display = 'block';
        medSearchInput.value = '';
        autocompleteList.style.display = 'none';
      });

      autocompleteList.appendChild(item);
    });

    autocompleteList.style.display = 'block';
  });
}

// ==========================================
// 4. DESPACHO DE RECETAS CON MOTOR PEPS
// ==========================================

function renderPendingRecipes() {
  const listContainer = document.getElementById('pending-recipes-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  const state = getAppState();
  ensureKardexPEPS(state);
  const patients = state.patients || [];
  const searchFilter = (document.getElementById('recipe-search-filter')?.value || '').toLowerCase().trim();
  const pending = [];

  patients.forEach(p => {
    if (p.prescriptions) {
      p.prescriptions.forEach(r => {
        if (!r.dispenseStatus) r.dispenseStatus = 'Pendiente';
        if (r.dispenseStatus === 'Pendiente') {
          const matchSearch = !searchFilter || 
            (p.name && p.name.toLowerCase().includes(searchFilter)) ||
            (r.doctorName && r.doctorName.toLowerCase().includes(searchFilter));
          if (matchSearch) {
            pending.push({
              patientId: p.id,
              patientName: p.name,
              patientNit: p.nit || 'CF',
              recipe: r
            });
          }
        }
      });
    }
  });

  if (pending.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
        <span style="font-size: 3rem; display: block; margin-bottom: 10px;">✅</span>
        No hay recetas pendientes de despacho en este momento.
      </div>
    `;
    return;
  }

  pending.sort((a, b) => new Date(b.recipe.date) - new Date(a.recipe.date));

  pending.forEach(item => {
    const patientObj = state.patients.find(p => p.id === item.patientId);
    const billingHistory = patientObj?.billingHistory || [];
    
    const bill = billingHistory.find(b => b.id === item.recipe.billId) ||
                 billingHistory.find(b => (b.details || []).some(d => (item.recipe.medicines || []).some(m => d.description?.includes(m.name)))) ||
                 billingHistory.find(b => b.date?.substring(0, 10) === item.recipe.date?.substring(0, 10));

    const isHospitalization = item.recipe.isHospitalization === true;
    let isPaid = isHospitalization ? true : (bill ? bill.status === 'Pagado' : true);

    // Validar niveles de autorización de los medicamentos
    let maxAuthLevel = 1;
    let requiresAuthNote = [];
    (item.recipe.medicines || []).forEach(m => {
      const catMed = state.medications?.find(med => med.name === m.name);
      const lvl = getMedicationAuthorizationLevel(catMed || m);
      if (lvl.nivel > maxAuthLevel) maxAuthLevel = lvl.nivel;
      if (lvl.nivel >= 2) requiresAuthNote.push(`${m.name} (${lvl.badge})`);
    });

    const hasSpecialAuth = item.recipe.specialAuthApproved === true;
    const needsApproval = maxAuthLevel >= 2 && !hasSpecialAuth;

    let statusBadge = isHospitalization
      ? `<span class="badge" style="background: rgba(33, 150, 243, 0.15); color: #2196f3; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">🏥 Encamamiento / Hospitalización</span>`
      : (isPaid
          ? `<span class="badge" style="background: rgba(76, 175, 80, 0.15); color: #4caf50; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">✅ Pago Confirmado en Caja</span>`
          : `<span class="badge" style="background: rgba(255, 152, 0, 0.15); color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">⚠️ Pendiente de Pago en Caja</span>`);

    let authBadge = '';
    if (maxAuthLevel === 2) {
      authBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 5px;">🛡️ Nivel 2: Requiere Firma Dirección Médica</span>`;
    } else if (maxAuthLevel === 3) {
      authBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 5px;">🚨 Nivel 3: Controlado / Retenida (Dirección + Gerencia)</span>`;
    }

    let actionButton = '';
    if (!isPaid) {
      actionButton = `<button class="btn btn-secondary" disabled style="opacity: 0.5; cursor: not-allowed;">🔒 Bloqueado por Pago</button>`;
    } else if (needsApproval) {
      actionButton = `
        <button class="btn btn-warning btn-dispense-recipe" data-patient-id="${item.patientId}" data-recipe-id="${item.recipe.id}">
          🛡️ Validar Autorización Nivel ${maxAuthLevel}
        </button>
      `;
    } else {
      actionButton = `
        <button class="btn btn-success btn-dispense-recipe" data-patient-id="${item.patientId}" data-recipe-id="${item.recipe.id}">
          📦 Despachar Medicamentos (FIFO)
        </button>
      `;
    }

    const card = document.createElement('div');
    card.className = 'glass-card';
    card.style.cssText = `
      padding: 1.25rem;
      border: 1px solid var(--border-color);
      border-left: 4px solid ${needsApproval ? '#f59e0b' : (isPaid ? 'var(--accent-success)' : 'var(--accent-warning)')};
      background: rgba(255, 255, 255, 0.01);
    `;

    const medsListHtml = (item.recipe.medicines || []).map(m => {
      const catMed = state.medications?.find(med => med.name === m.name);
      const lvl = getMedicationAuthorizationLevel(catMed || m);
      const stockAvailable = catMed ? getAvailableStockPEPS(state, catMed.id) : 0;
      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
          <td style="padding: 6px 0;">
            <strong>${m.name}</strong> 
            <span style="font-size: 0.78rem; color: var(--text-muted);">(${m.presentation || 'Caja'})</span>
            ${lvl.nivel > 1 ? `<span style="font-size: 0.72rem; color: ${lvl.color}; font-weight: bold; margin-left: 6px;">[${lvl.badge}]</span>` : ''}
          </td>
          <td style="padding: 6px 0; text-align: center; font-weight: bold; color: var(--accent-primary);">${m.quantity}</td>
          <td style="padding: 6px 0; text-align: center; font-size: 0.8rem; color: ${stockAvailable > 0 ? '#10b981' : '#ef4444'};">
            ${stockAvailable} unds PEPS
          </td>
          <td style="padding: 6px 0; color: var(--text-muted); font-size: 0.82rem;">Dosis: ${m.dosage || 'Regular'} | Duración: ${m.duration || 'N/A'}</td>
        </tr>
      `;
    }).join('');

    const dateFormatted = new Date(item.recipe.date).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 0.75rem;">
        <div>
          <span style="font-size: 0.8rem; color: var(--accent-primary); text-transform: uppercase; font-weight: 600;">Paciente</span>
          <h4 style="color: var(--text-primary); margin-top: 2px;">${item.patientName} <span style="font-size: 0.85rem; font-weight: normal; color: var(--text-muted);">(NIT: ${item.patientNit})</span></h4>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
            Prescrito por: <strong>Dr. ${item.recipe.doctorName}</strong> (Col. ${item.recipe.doctorLicense || 'Activo'}) | Emitida: <strong>${dateFormatted}</strong>
          </p>
          <div style="margin-top: 6px;">
            ${statusBadge}
            ${authBadge}
          </div>
        </div>
        ${actionButton}
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 8px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="color: var(--text-muted); font-size: 0.75rem; border-bottom: 1px solid var(--border-color);">
              <th style="padding-bottom: 4px;">Medicamento</th>
              <th style="padding-bottom: 4px; text-align: center; width: 80px;">Cantidad</th>
              <th style="padding-bottom: 4px; text-align: center; width: 120px;">Stock Kardex</th>
              <th style="padding-bottom: 4px;">Instrucciones / Dosis</th>
            </tr>
          </thead>
          <tbody>
            ${medsListHtml}
          </tbody>
        </table>
      </div>
    `;

    listContainer.appendChild(card);
  });
}

function dispenseRecipe(patientId, recipeId) {
  const state = getAppState();
  ensureKardexPEPS(state);
  const patientObj = state.patients.find(p => p.id === patientId);
  if (!patientObj) return;

  const recipeObj = (patientObj.prescriptions || []).find(r => r.id === recipeId);
  if (!recipeObj) return;

  // 1. Validar si requiere autorización especial de Nivel 2 o 3
  let maxLevel = 1;
  (recipeObj.medicines || []).forEach(m => {
    const catMed = state.medications?.find(med => med.name === m.name);
    const lvl = getMedicationAuthorizationLevel(catMed || m);
    if (lvl.nivel > maxLevel) maxLevel = lvl.nivel;
  });

  if (maxLevel >= 2 && !recipeObj.specialAuthApproved) {
    promptSpecialAuthorizationModal(patientObj, recipeObj, maxLevel, () => {
      dispenseRecipe(patientId, recipeId);
    });
    return;
  }

  // 2. Validar existencias PEPS
  let insufficient = [];
  const itemsToConsume = [];

  for (const m of recipeObj.medicines || []) {
    const catalogItem = state.medications?.find(med => med.name === m.name);
    if (catalogItem) {
      const enriched = enrichMedication(catalogItem);
      let requestedUnits = parseInt(m.qty);
      if (isNaN(requestedUnits) || requestedUnits <= 0) {
        const qtyParsed = parseInt(m.quantity) || 1;
        requestedUnits = String(m.quantity || '').toLowerCase().includes('caja')
          ? qtyParsed * enriched.unidades_por_presentacion
          : qtyParsed;
      }

      const available = getAvailableStockPEPS(state, catalogItem.id);
      if (available < requestedUnits) {
        insufficient.push(`${m.name} (Disponible: ${available} unds, Solicitado: ${requestedUnits} unds)`);
      } else {
        itemsToConsume.push({
          medicationId: catalogItem.id,
          requestedUnits,
          medicationName: m.name
        });
      }
    }
  }

  if (insufficient.length > 0) {
    alert(`❌ QUIEBRE DE STOCK PEPS:\n\nNo se puede despachar la receta por falta de existencias:\n- ${insufficient.join('\n- ')}`);
    return;
  }

  // 3. Ejecutar descarga estricta PEPS
  const batchRecords = [];
  for (const item of itemsToConsume) {
    const res = consumeStockPEPS(state, item.medicationId, item.requestedUnits, 'Despacho Receta Médica', recipeId);
    if (res.success) {
      batchRecords.push(...res.consumed);
    }
  }

  recipeObj.dispenseStatus = 'Despachado';
  recipeObj.dispenseDate = new Date().toISOString();
  recipeObj.kardexDeductions = batchRecords;

  saveAppState(state);
  alert("🎉 Receta despachada exitosamente con rotación estricta PEPS (FIFO). Existencias del Kardex actualizadas.");
  refreshActiveTab();
}

function promptSpecialAuthorizationModal(patient, recipe, level, onSuccessCallback) {
  let modal = document.getElementById('modal-special-auth');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-special-auth';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px); padding: 15px;';
    document.body.appendChild(modal);
  }

  const levelTitle = level === 3 
    ? '🚨 Autorización Nivel 3: Estupefacientes / Alto Costo' 
    : '🛡️ Autorización Nivel 2: Antibióticos Restringidos';

  const reqGerencia = level === 3;

  modal.innerHTML = `
    <div class="glass-card modal-card" style="max-width: 580px; width: 100%; padding: 1.75rem; border-top: 4px solid ${level === 3 ? '#ef4444' : '#f59e0b'}; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="color: ${level === 3 ? '#ef4444' : '#f59e0b'}; margin: 0;">${levelTitle}</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 4px 0 0 0;">
            Norma HMM-MAN-ALM-05: Validación de Firma Digital y Clave de Seguridad.
          </p>
        </div>
        <button type="button" id="btn-close-auth-modal" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer;">&times;</button>
      </div>

      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; margin-bottom: 1rem; font-size: 0.85rem;">
        <div><strong>Paciente:</strong> ${patient.name} | <strong>Médico:</strong> Dr. ${recipe.doctorName}</div>
        <div style="margin-top: 6px; color: var(--accent-primary);">
          <strong>Medicamentos Sujetos a Control:</strong>
          <ul style="margin: 4px 0 0 15px; padding: 0;">
            ${(recipe.medicines || []).map(m => `<li>${m.name} (${m.quantity})</li>`).join('')}
          </ul>
        </div>
      </div>

      <form id="form-special-auth">
        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-size: 0.82rem; font-weight: bold;">Justificación Clínica Obligatoria:</label>
          <textarea id="auth-clinical-rationale" rows="2" required placeholder="Indique diagnóstico, indicación terapéutica o cultivo..." style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">Tratamiento indicado según protocolo hospitalario y criterio clínico fundamentado.</textarea>
        </div>

        <div class="form-group" style="margin-bottom: 10px;">
          <label style="font-size: 0.82rem; font-weight: bold;">Firma / Nombre de Dirección Médica:</label>
          <input type="text" id="auth-doctor-signer" value="Dr. Dirección Médica Multimédica" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
        </div>

        ${reqGerencia ? `
          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); padding: 10px; border-radius: 6px; margin-bottom: 12px;">
            <label style="font-size: 0.8rem; font-weight: bold; color: #ef4444; display: block; margin-bottom: 4px;">
              🔒 Clave de Aprobación de Gerencia Administrativa (Maestro):
            </label>
            <input type="password" id="auth-gerencia-password" placeholder="Ingrese contraseña..." required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.5); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
        ` : ''}

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 15px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-auth-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="background: ${level === 3 ? '#ef4444' : '#f59e0b'}; border: none;">
            ✅ Aprobar Autorización y Proceder
          </button>
        </div>
      </form>
    </div>
  `;

  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-close-auth-modal').addEventListener('click', close);
  modal.querySelector('#btn-cancel-auth-modal').addEventListener('click', close);

  modal.querySelector('#form-special-auth').addEventListener('submit', (e) => {
    e.preventDefault();
    const state = getAppState();
    
    if (reqGerencia) {
      const pass = modal.querySelector('#auth-gerencia-password').value.trim();
      const adminUser = (state.users || []).find(u => String(u.role || '').toLowerCase().includes('administrador') || u.id === 'Admin');
      const hashed = hashPassword(pass);
      const isAuth = pass === 'Glol5414' || (adminUser && (adminUser.password === pass || adminUser.password === hashed || adminUser.password === 'Glol5414'));
      
      if (!isAuth) {
        alert("❌ Contraseña de Gerencia Administrativa incorrecta.");
        return;
      }
    }

    recipe.specialAuthApproved = true;
    recipe.specialAuthDetails = {
      level,
      date: new Date().toISOString(),
      rationale: modal.querySelector('#auth-clinical-rationale').value.trim(),
      signedBy: modal.querySelector('#auth-doctor-signer').value.trim(),
      gerenciaApproved: reqGerencia
    };

    state.autorizacionesEspeciales = state.autorizacionesEspeciales || [];
    state.autorizacionesEspeciales.unshift({
      id: `AUTH-${Date.now()}`,
      recipeId: recipe.id,
      patientId: patient.id,
      patientName: patient.name,
      doctorName: recipe.doctorName,
      level,
      medicines: recipe.medicines,
      details: recipe.specialAuthDetails,
      status: 'Aprobado'
    });

    saveAppState(state);
    close();
    if (onSuccessCallback) onSuccessCallback();
  });
}

// ==========================================
// 5. UNIDOSIS 24H: GENERACIÓN Y CONCILIACIÓN
// ==========================================

function renderUnidosis24hTab() {
  const state = getAppState();
  ensureKardexPEPS(state);
  const activeList = document.getElementById('unidosis-active-list');
  const liqList = document.getElementById('unidosis-liq-list');
  const activeBadge = document.getElementById('unidosis-active-badge');
  if (!activeList || !liqList) return;

  const activeCassettes = (state.unidosis24h || []).filter(u => u.status === 'Despachado' || u.status === 'En Tránsito');
  const liquidations = state.liquidacionesUnidosis || [];

  if (activeBadge) activeBadge.textContent = `${activeCassettes.length} Cassettes`;

  // 1. Render Cassettes Activos
  if (activeCassettes.length === 0) {
    activeList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 25px 0;">No hay cassettes de 24 horas activos en este momento. Haga clic en "Generar Cassettes Diarios".</div>`;
  } else {
    activeList.innerHTML = activeCassettes.map(u => {
      const dateStr = new Date(u.fechaGeneracion).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
      return `
        <div class="glass-card" style="padding: 10px; border: 1px solid var(--border-color); border-left: 3px solid #00f2fe; background: rgba(255,255,255,0.01);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #00f2fe; font-size: 0.9rem;">${u.id} - Cama ${u.bed || 'S/C'}</strong>
            <span style="font-size: 0.75rem; color: #22c55e; font-weight: bold;">● ${u.status}</span>
          </div>
          <div style="font-size: 0.82rem; color: var(--text-primary); margin-top: 2px;">
            Paciente: <strong>${u.patientName}</strong> (${u.service || 'Encamamiento'})
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
            Generado: ${dateStr} | Total Dosis: <strong>${(u.doses || []).length}</strong>
          </div>
          <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-small btn-print-unidosis-f06" data-id="${u.id}" style="padding: 3px 8px; font-size: 0.75rem;">
              🖨️ Hoja F06
            </button>
            <button class="btn btn-secondary btn-small btn-print-thermal-label" data-id="${u.id}" data-index="0" style="padding: 3px 8px; font-size: 0.75rem;">
              🏷️ Viñeta Térmica
            </button>
            <button class="btn btn-primary btn-small btn-liquidate-unidosis" data-id="${u.id}" style="padding: 3px 8px; font-size: 0.75rem; background: #00f2fe; color: #000; font-weight: bold;">
              🔄 Conciliar y Liquidar (F07)
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Render Historial Liquidaciones
  if (liquidations.length === 0) {
    liqList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 25px 0;">No se han registrado liquidaciones de unidosis aún.</div>`;
  } else {
    liqList.innerHTML = liquidations.map(l => {
      const dateStr = new Date(l.fechaLiquidacion).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
      return `
        <div class="glass-card" style="padding: 10px; border: 1px solid var(--border-color); border-left: 3px solid #22c55e; background: rgba(255,255,255,0.01);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: var(--text-primary); font-size: 0.85rem;">Acta ${l.id}</strong>
            <span style="font-size: 0.75rem; color: #22c55e; font-weight: bold;">ECL: ${l.ecl || '100%'}</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
            Paciente: <strong>${l.patientName}</strong> | Fecha: ${dateStr}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: flex; gap: 10px;">
            <span>Enviadas: <strong>${l.totalEnviadas}</strong></span>
            <span>Adm: <strong style="color: #10b981;">${l.totalAdministradas}</strong></span>
            <span>Dev Conforme: <strong style="color: #38bdf8;">${l.totalDevueltas}</strong></span>
            <span>Merma: <strong style="color: #ef4444;">${l.totalDescartadas}</strong></span>
          </div>
          <div style="margin-top: 6px;">
            <button class="btn btn-secondary btn-small btn-print-liq-f07" data-id="${l.id}" style="padding: 2px 6px; font-size: 0.72rem;">
              🖨️ Acta Liquidación F07
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function generateDailyUnidosisCassettes() {
  const state = getAppState();
  ensureKardexPEPS(state);
  const admittedPatients = (state.patients || []).filter(p => p.status === 'Encamado' || p.status === 'En Observación' || (p.prescriptions || []).some(r => r.isHospitalization && r.dispenseStatus === 'Pendiente'));

  if (admittedPatients.length === 0) {
    alert("No hay pacientes hospitalizados o con prescripciones de encamamiento activas para generar cassettes de 24 horas.");
    return;
  }

  const generatedCount = [];
  const standardHours = ['08:00', '14:00', '20:00', '02:00'];

  admittedPatients.forEach(p => {
    const unliquidated = (p.prescriptions || []).filter(r => r.dispenseStatus === 'Pendiente' || r.isHospitalization);
    if (unliquidated.length === 0) return;

    const doses = [];
    unliquidated.forEach(r => {
      (r.medicines || []).forEach(m => {
        const catMed = (state.medications || []).find(med => med.name === m.name);
        const enriched = enrichMedication(catMed || m);
        const pepsBatch = (state.almacenKardexPEPS || []).find(b => b.medicationId === (catMed ? catMed.id : m.id) && b.stockActual > 0) || { lote: 'LOTE-UNID-2026', id: 'PEPS-DEF' };

        standardHours.forEach(hour => {
          doses.push({
            id: `DOSE-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            medicineName: m.name,
            generic: enriched.generic || '',
            presentation: enriched.presentation,
            unidad_dispensable: enriched.unidad_dispensable,
            dosage: m.dosage || '1 Dosis',
            scheduleHour: hour,
            lotePEPS: pepsBatch.lote,
            batchId: pepsBatch.id,
            costoUnitario: enriched.precio_unitario,
            precioVentaUnitario: enriched.precio_unitario,
            via: m.via || 'Oral / I.V.',
            dilucion: m.dilucion || 'Directa / N/A',
            estadoDosis: 'Enviada' // Enviada, Administrada, DevueltaConforme, Descartada
          });
        });
      });
    });

    if (doses.length > 0) {
      const cassetteId = `UNID-24H-${Date.now().toString().slice(-6)}-${p.id.slice(-4)}`;
      const cassette = {
        id: cassetteId,
        patientId: p.id,
        patientName: p.name,
        bed: p.bed || p.bedNumber || 'Cama-01',
        service: p.service || 'Encamamiento General',
        fechaGeneracion: new Date().toISOString(),
        status: 'Despachado',
        doses
      };

      state.unidosis24h = state.unidosis24h || [];
      state.unidosis24h.unshift(cassette);
      generatedCount.push(p.name);
    }
  });

  saveAppState(state);
  alert(`🎉 Cassettes de 24 Horas (07:00 Hrs) generados con éxito para ${generatedCount.length} paciente(s):\n- ${generatedCount.join('\n- ')}`);
  refreshActiveTab();
}

function showLiquidacionUnidosisModal(unidosisId) {
  const state = getAppState();
  ensureKardexPEPS(state);
  const cassette = (state.unidosis24h || []).find(u => u.id === unidosisId);
  if (!cassette) return;

  let modal = document.getElementById('modal-liquidacion-unidosis');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-liquidacion-unidosis';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px); padding: 15px;';
    document.body.appendChild(modal);
  }

  const dosesRows = (cassette.doses || []).map((d, idx) => `
    <tr style="border-bottom: 1px solid var(--border-color);">
      <td style="padding: 6px;">
        <strong>${d.medicineName}</strong> (${d.scheduleHour})<br>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Lote: ${d.lotePEPS} | ${d.dosage}</span>
      </td>
      <td style="padding: 6px; text-align: center;">
        <select class="dose-status-select" data-index="${idx}" style="padding: 4px; font-size: 0.8rem; border-radius: 4px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color);">
          <option value="Administrada" selected>✅ Administrada (Cobrar)</option>
          <option value="DevueltaConforme">🔄 Devuelta Conforme (Reintegrar Stock)</option>
          <option value="Descartada">🗑️ Descartada / Merma (Dañada)</option>
        </select>
      </td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="glass-card modal-card" style="max-width: 650px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.5rem; border-top: 4px solid #00f2fe; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="color: #00f2fe; margin: 0;">Liquidación y Devolución Diaria Unidosis (HMM-ALM-F07)</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 4px 0 0 0;">
            Cassette: <strong>${cassette.id}</strong> | Paciente: <strong>${cassette.patientName}</strong> (${cassette.bed})
          </p>
        </div>
        <button type="button" id="btn-close-liq-modal" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer;">&times;</button>
      </div>

      <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 10px;">
        ⚠️ <strong>Regla Contable HMM-MAN-ALM-05:</strong> Solo se cargarán a la cuenta del paciente las dosis efectivamente administradas. Las dosis devueltas conformes se reintegran automáticamente al Kardex PEPS sin costo.
      </div>

      <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; margin-bottom: 1rem;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
          <thead>
            <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border-color); color: var(--text-muted);">
              <th style="padding: 6px; text-align: left;">Dosis / Medicamento</th>
              <th style="padding: 6px; text-align: center;">Resultado de Conciliación</th>
            </tr>
          </thead>
          <tbody>
            ${dosesRows}
          </tbody>
        </table>
      </div>

      <div class="form-group" style="margin-bottom: 12px;">
        <label style="font-size: 0.82rem; font-weight: bold;">Enfermera / Responsable de Entrega:</label>
        <input type="text" id="liq-nurse-name" value="Enfermería Turno 24H" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button type="button" class="btn btn-secondary" id="btn-cancel-liq-modal">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btn-submit-liq-modal" style="background: #00f2fe; color: #000; font-weight: bold; border: none;">
          ⚡ Procesar Conciliación F07
        </button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-close-liq-modal').addEventListener('click', close);
  modal.querySelector('#btn-cancel-liq-modal').addEventListener('click', close);

  modal.querySelector('#btn-submit-liq-modal').addEventListener('click', () => {
    const selects = modal.querySelectorAll('.dose-status-select');
    let countAdm = 0;
    let countDev = 0;
    let countDesc = 0;
    let costoFacturado = 0;
    let costoMerma = 0;

    selects.forEach(sel => {
      const idx = parseInt(sel.getAttribute('data-index'));
      const status = sel.value;
      const dose = cassette.doses[idx];
      dose.estadoDosis = status;

      if (status === 'Administrada') {
        countAdm++;
        costoFacturado += (dose.precioVentaUnitario || 0);
        // Consumir del Kardex si no se descontó antes
        consumeStockPEPS(state, dose.batchId, 1, 'Unidosis Administrada', cassette.id);
      } else if (status === 'DevueltaConforme') {
        countDev++;
        // Reintegrar al Kardex
        reintegrateStockPEPS(state, dose.batchId, 1, dose.batchId, 'Devolución Unidosis Conforme');
      } else if (status === 'Descartada') {
        countDesc++;
        costoMerma += (dose.costoUnitario || 0);
      }
    });

    const totalDoses = cassette.doses.length;
    const eclScore = (((countAdm + countDev) / Math.max(1, totalDoses)) * 100).toFixed(1) + '%';
    const liqId = `LIQ-F07-${Date.now().toString().slice(-6)}`;

    const liqRecord = {
      id: liqId,
      cassetteId: cassette.id,
      patientId: cassette.patientId,
      patientName: cassette.patientName,
      bed: cassette.bed,
      fechaLiquidacion: new Date().toISOString(),
      nurseName: modal.querySelector('#liq-nurse-name').value.trim(),
      totalEnviadas: totalDoses,
      totalAdministradas: countAdm,
      totalDevueltas: countDev,
      totalDescartadas: countDesc,
      costoFacturado,
      costoMerma,
      ecl: eclScore,
      dosesDetail: [...cassette.doses]
    };

    cassette.status = 'Liquidado';
    cassette.liquidacionId = liqId;

    state.liquidacionesUnidosis = state.liquidacionesUnidosis || [];
    state.liquidacionesUnidosis.unshift(liqRecord);

    // Cargar a cuenta del paciente solo lo administrado
    const patientObj = (state.patients || []).find(p => p.id === cassette.patientId);
    if (patientObj && costoFacturado > 0) {
      patientObj.billingHistory = patientObj.billingHistory || [];
      patientObj.billingHistory.unshift({
        id: `FAC-UNID-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        concept: `Unidosis 24H (${countAdm} dosis administradas) - ${cassette.id}`,
        amount: costoFacturado,
        status: 'Pendiente',
        details: cassette.doses.filter(d => d.estadoDosis === 'Administrada').map(d => ({
          description: `${d.medicineName} (${d.scheduleHour})`,
          quantity: 1,
          price: d.precioVentaUnitario,
          total: d.precioVentaUnitario
        }))
      });
    }

    saveAppState(state);
    close();
    alert(`✅ Conciliación y Liquidación Diaria F07 completada:\n- Dosis Administradas: ${countAdm} (Cargadas a cuenta: Q${costoFacturado.toFixed(2)})\n- Dosis Devueltas Conformes: ${countDev} (Reintegradas a Kardex)\n- Dosis Descartadas: ${countDesc}\n- Eficiencia ECL: ${eclScore}`);
    refreshActiveTab();
  });
}

// ==========================================
// 6. RECEPCIÓN TÉCNICA (F01) Y REQUISICIONES (F02)
// ==========================================

function renderRecepcionKardexTab() {
  const state = getAppState();
  ensureKardexPEPS(state);
  const tbody = document.getElementById('kardex-peps-tbody');
  const recList = document.getElementById('recepciones-f01-list');
  const reqList = document.getElementById('requisiciones-f02-list');
  if (!tbody) return;

  const searchQuery = (document.getElementById('kardex-search-input')?.value || '').toLowerCase().trim();
  const filterStatus = document.getElementById('kardex-filter-status')?.value || 'with_stock';

  let batches = (state.almacenKardexPEPS || []).filter(b => b.activo !== false);

  if (filterStatus === 'with_stock') {
    batches = batches.filter(b => (b.stockActual || 0) > 0);
  } else if (filterStatus === 'thermo') {
    batches = batches.filter(b => b.esTermolabil === true);
  }

  if (searchQuery) {
    batches = batches.filter(b => 
      (b.medicationName && b.medicationName.toLowerCase().includes(searchQuery)) ||
      (b.lote && b.lote.toLowerCase().includes(searchQuery)) ||
      (b.factura && b.factura.toLowerCase().includes(searchQuery)) ||
      (b.proveedor && b.proveedor.toLowerCase().includes(searchQuery))
    );
  }

  batches.sort((a, b) => new Date(a.fechaIngreso) - new Date(b.fechaIngreso));

  if (batches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding: 20px; text-align: center; color: var(--text-muted);">No se encontraron lotes registrados en el Kardex PEPS.</td></tr>`;
  } else {
    tbody.innerHTML = batches.map(b => {
      const fIngreso = new Date(b.fechaIngreso).toLocaleDateString('es-GT');
      const lvl = b.nivelAutorizacion || { nivel: 1, label: 'Nivel 1', color: '#10b981' };
      const isLowExp = (new Date(b.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24 * 30) < 18;

      return `
        <tr style="border-bottom: 1px solid var(--border-color); ${(b.stockActual || 0) === 0 ? 'opacity: 0.5;' : ''}">
          <td style="padding: 8px; font-weight: bold; color: var(--accent-primary);">${fIngreso}</td>
          <td style="padding: 8px;">
            <strong>${b.medicationName}</strong><br>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${b.presentation} (${b.unidad_dispensable})</span>
          </td>
          <td style="padding: 8px;">
            <span style="font-family: monospace; font-weight: bold; color: var(--text-primary);">${b.lote}</span><br>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Fac: ${b.factura}</span>
          </td>
          <td style="padding: 8px; color: ${isLowExp ? '#f59e0b' : 'inherit'};">
            ${b.fechaVencimiento} ${isLowExp ? '⚠️' : '✅'}
          </td>
          <td style="padding: 8px;">
            ${b.temperaturaRecepcion ? `${b.temperaturaRecepcion} °C` : 'Ambiente'} ${b.esTermolabil ? '❄️' : ''}
          </td>
          <td style="padding: 8px; text-align: right; color: var(--text-muted);">Q${parseFloat(b.precioCosto || 0).toFixed(2)}</td>
          <td style="padding: 8px; text-align: right; font-weight: bold; color: ${(b.stockActual || 0) > 0 ? '#10b981' : '#ef4444'};">
            ${b.stockActual} ${b.unidad_dispensable}(s)
          </td>
          <td style="padding: 8px; text-align: center;">
            <span style="background: rgba(255,255,255,0.05); color: ${lvl.color}; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: bold;">
              Nivel ${lvl.nivel}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Render Historial F01
  if (recList) {
    const recepciones = state.recepcionesTecnicas || [];
    if (recepciones.length === 0) {
      recList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 15px 0;">No hay actas F01 registradas</div>`;
    } else {
      recList.innerHTML = recepciones.map(r => `
        <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 8px; border-radius: 4px; font-size: 0.78rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${r.id}</strong> - ${r.medicationName} (Lote: ${r.lote})<br>
            <span style="color: var(--text-muted);">${new Date(r.fechaRecepcion).toLocaleDateString('es-GT')} | Cant: ${r.cantidadRecibida}</span>
          </div>
          <button class="btn btn-secondary btn-small btn-print-rec-f01" data-id="${r.id}" style="padding: 2px 6px; font-size: 0.72rem;">🖨️ F01</button>
        </div>
      `).join('');
    }
  }

  // Render Historial F02
  if (reqList) {
    const requisiciones = state.requisicionesHospitalarias || [];
    if (requisiciones.length === 0) {
      reqList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 15px 0;">No hay vales F02 registrados</div>`;
    } else {
      reqList.innerHTML = requisiciones.map(r => `
        <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 8px; border-radius: 4px; font-size: 0.78rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${r.id}</strong> - Servicio: <strong>${r.servicioSolicitante}</strong><br>
            <span style="color: var(--text-muted);">${new Date(r.fechaDespacho).toLocaleDateString('es-GT')} | Items: ${(r.items || []).length}</span>
          </div>
          <button class="btn btn-secondary btn-small btn-print-req-f02" data-id="${r.id}" style="padding: 2px 6px; font-size: 0.72rem;">🖨️ F02</button>
        </div>
      `).join('');
    }
  }
}

function showRecepcionF01Modal() {
  const state = getAppState();
  let modal = document.getElementById('modal-recepcion-f01');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-recepcion-f01';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px); padding: 15px;';
    document.body.appendChild(modal);
  }

  const medOptions = (state.medications || []).map(m => `<option value="${m.id}">${m.name} (${m.presentation || 'Caja'})</option>`).join('');

  modal.innerHTML = `
    <div class="glass-card modal-card" style="max-width: 620px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.75rem; border-top: 4px solid var(--accent-success); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="color: var(--accent-success); margin: 0;">Acta de Recepción Técnica de Medicamentos (HMM-ALM-F01)</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 4px 0 0 0;">
            Ingreso y alta de lote en Kardex PEPS con validación sanitaria de 18 meses.
          </p>
        </div>
        <button type="button" id="btn-close-rec-modal" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer;">&times;</button>
      </div>

      <form id="form-recepcion-f01" style="display: flex; flex-direction: column; gap: 10px;">
        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.82rem; font-weight: bold;">Medicamento / Insumo:</label>
          <select id="f01-med-id" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
            ${medOptions}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Número de Lote:</label>
            <input type="text" id="f01-lote" placeholder="LOTE-2026A" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">No. Factura / Guía:</label>
            <input type="text" id="f01-factura" placeholder="FAC-8849" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Proveedor / Droguería:</label>
            <input type="text" id="f01-proveedor" value="Droguería y Distribuidora Multimédica" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Cantidad Recibida (Unidades Mínimas):</label>
            <input type="number" id="f01-cantidad" value="100" min="1" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Fecha de Vencimiento:</label>
            <input type="date" id="f01-vencimiento" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Temperatura Recepción (°C):</label>
            <input type="number" step="0.1" id="f01-temp" value="21.0" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Precio Costo Total (Q):</label>
            <input type="number" step="0.01" id="f01-costo" value="500.00" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Inspección Organoléptica:</label>
            <select id="f01-inspeccion" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
              <option value="Conforme">Conforme (Empaque íntegro, rotulado claro)</option>
              <option value="No Conforme">No Conforme (Dañado / Deteriorado)</option>
            </select>
          </div>
        </div>

        <!-- Alerta de 18 meses condicional -->
        <div id="f01-alert-18m" style="display: none; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 10px; border-radius: 6px; font-size: 0.8rem; color: #ef4444;">
          <strong>🚨 RECHAZO TÉCNICO (Norma HMM-MAN-ALM-05):</strong> La vigencia del lote es inferior a 18 meses. Requiere aprobación y contraseña de Gerencia Administrativa para excepción.
          <input type="password" id="f01-gerencia-pass" placeholder="Contraseña de Gerencia..." style="width: 100%; margin-top: 6px; padding: 6px; border: 1px solid #ef4444; border-radius: 4px; background: var(--bg-card); color: var(--text-primary);">
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-rec-modal">Cancelar</button>
          <button type="submit" class="btn btn-success" style="font-weight: bold;">
            📥 Registrar Ingreso F01
          </button>
        </div>
      </form>
    </div>
  `;

  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-close-rec-modal').addEventListener('click', close);
  modal.querySelector('#btn-cancel-rec-modal').addEventListener('click', close);

  const expInput = modal.querySelector('#f01-vencimiento');
  const alert18 = modal.querySelector('#f01-alert-18m');

  expInput.addEventListener('change', () => {
    if (expInput.value) {
      const expDate = new Date(expInput.value);
      const monthsDiff = (expDate - new Date()) / (1000 * 60 * 60 * 24 * 30.4375);
      if (monthsDiff < 18) {
        alert18.style.display = 'block';
      } else {
        alert18.style.display = 'none';
      }
    }
  });

  modal.querySelector('#form-recepcion-f01').addEventListener('submit', (e) => {
    e.preventDefault();
    const expDate = new Date(expInput.value);
    const monthsDiff = (expDate - new Date()) / (1000 * 60 * 60 * 24 * 30.4375);

    if (monthsDiff < 18) {
      const pass = modal.querySelector('#f01-gerencia-pass').value.trim();
      const adminUser = (state.users || []).find(u => String(u.role || '').toLowerCase().includes('administrador') || u.id === 'Admin');
      const hashed = hashPassword(pass);
      const isAuth = pass === 'Glol5414' || (adminUser && (adminUser.password === pass || adminUser.password === hashed || adminUser.password === 'Glol5414'));
      if (!isAuth) {
        alert("❌ El lote tiene vigencia menor a 18 meses. Debe ingresar la contraseña de Gerencia Administrativa válida para autorizar el ingreso por excepción.");
        return;
      }
    }

    const medId = modal.querySelector('#f01-med-id').value;
    const catMed = (state.medications || []).find(m => m.id === medId);
    const enriched = enrichMedication(catMed);
    const qty = parseInt(modal.querySelector('#f01-cantidad').value) || 0;
    const costo = parseFloat(modal.querySelector('#f01-costo').value) || 0;
    const lote = modal.querySelector('#f01-lote').value.trim();
    const factura = modal.querySelector('#f01-factura').value.trim();
    const proveedor = modal.querySelector('#f01-proveedor').value.trim();
    const temp = parseFloat(modal.querySelector('#f01-temp').value) || 21.0;
    const organo = modal.querySelector('#f01-inspeccion').value;

    const recId = `REC-F01-${Date.now().toString().slice(-6)}`;
    const batchId = `PEPS-${medId}-${lote}`;

    const newBatch = {
      id: batchId,
      medicationId: medId,
      medicationName: catMed.name,
      generic: catMed.generic || '',
      presentation: catMed.presentation || 'Caja',
      unidad_dispensable: enriched.unidad_dispensable,
      unidades_por_presentacion: enriched.unidades_por_presentacion,
      lote,
      factura,
      ordenCompra: 'OC-' + Date.now().toString().slice(-4),
      proveedor,
      fechaIngreso: new Date().toISOString(),
      fechaVencimiento: expInput.value,
      vigenciaMeses: Math.round(monthsDiff),
      precioCosto: costo,
      precioVenta: catMed.price || 50,
      stockInicial: qty,
      stockActual: qty,
      temperaturaRecepcion: temp,
      inspeccionOrganoleptica: organo,
      nivelAutorizacion: enriched.authLevel,
      esTermolabil: enriched.esTermolabil,
      activo: true
    };

    state.almacenKardexPEPS = state.almacenKardexPEPS || [];
    state.almacenKardexPEPS.push(newBatch);

    // Incrementar stock en catálogo
    catMed.stock = (catMed.stock || 0) + qty;
    catMed.lote = lote;
    catMed.vencimiento = expInput.value;

    const recRecord = {
      id: recId,
      batchId,
      medicationId: medId,
      medicationName: catMed.name,
      lote,
      factura,
      proveedor,
      cantidadRecibida: qty,
      costoTotal: costo,
      temperaturaRecepcion: temp,
      inspeccionOrganoleptica: organo,
      fechaVencimiento: expInput.value,
      fechaRecepcion: new Date().toISOString(),
      responsable: state.currentUser?.name || 'Encargado de Farmacia / Almacén'
    };

    state.recepcionesTecnicas = state.recepcionesTecnicas || [];
    state.recepcionesTecnicas.unshift(recRecord);

    saveAppState(state);
    close();
    alert(`🎉 Recepción Técnica F01 registrada con éxito.\nLote ${lote} ingresado al Kardex PEPS con ${qty} ${enriched.unidad_dispensable}(s).`);
    refreshActiveTab();
  });
}

function showRequisicionF02Modal() {
  const state = getAppState();
  ensureKardexPEPS(state);

  let modal = document.getElementById('modal-requisicion-f02');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-requisicion-f02';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px); padding: 15px;';
    document.body.appendChild(modal);
  }

  const medOptions = (state.medications || []).map(m => `<option value="${m.id}">${m.name} (Stock: ${getAvailableStockPEPS(state, m.id)} unds)</option>`).join('');

  modal.innerHTML = `
    <div class="glass-card modal-card" style="max-width: 580px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.75rem; border-top: 4px solid var(--accent-primary); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="color: var(--accent-primary); margin: 0;">Vale de Requisición y Despacho Interno (HMM-ALM-F02)</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 4px 0 0 0;">
            Salida de insumos a servicios hospitalarios con rotación PEPS (FIFO).
          </p>
        </div>
        <button type="button" id="btn-close-req-modal" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer;">&times;</button>
      </div>

      <form id="form-requisicion-f02" style="display: flex; flex-direction: column; gap: 10px;">
        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.82rem; font-weight: bold;">Servicio Hospitalario Solicitante:</label>
          <select id="f02-servicio" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
            <option value="Encamamiento General">Encamamiento General (Piso 2)</option>
            <option value="Emergencias y Observación">Emergencias y Observación</option>
            <option value="Quirófano / Cirugía">Quirófano / Cirugía</option>
            <option value="Unidad de Cuidados Intensivos (UCI)">Unidad de Cuidados Intensivos (UCI)</option>
            <option value="Consulta Externa">Consulta Externa</option>
          </select>
        </div>

        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.82rem; font-weight: bold;">Medicamento / Material a Solicitar:</label>
          <select id="f02-med-id" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
            ${medOptions}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Cantidad Solicitada:</label>
            <input type="number" id="f02-cantidad" value="10" min="1" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Responsable que Recibe:</label>
            <input type="text" id="f02-responsable" value="Enfermera Jefe de Servicio" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
        </div>

        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.82rem; font-weight: bold;">Justificación / Destino del Material:</label>
          <textarea id="f02-justificacion" rows="2" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">Reposición de stock de piso para atención de pacientes hospitalizados.</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-req-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="font-weight: bold;">
            📄 Despachar Vale F02
          </button>
        </div>
      </form>
    </div>
  `;

  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-close-req-modal').addEventListener('click', close);
  modal.querySelector('#btn-cancel-req-modal').addEventListener('click', close);

  modal.querySelector('#form-requisicion-f02').addEventListener('submit', (e) => {
    e.preventDefault();
    const medId = modal.querySelector('#f02-med-id').value;
    const catMed = (state.medications || []).find(m => m.id === medId);
    const qty = parseInt(modal.querySelector('#f02-cantidad').value) || 0;
    const servicio = modal.querySelector('#f02-servicio').value;
    const responsable = modal.querySelector('#f02-responsable').value.trim();
    const justif = modal.querySelector('#f02-justificacion').value.trim();

    const available = getAvailableStockPEPS(state, medId);
    if (available < qty) {
      alert(`❌ Existencias PEPS insuficientes para despachar este vale. Disponibles: ${available}, Solicitadas: ${qty}`);
      return;
    }

    const reqId = `VALE-F02-${Date.now().toString().slice(-6)}`;
    const consumeRes = consumeStockPEPS(state, medId, qty, `Vale Despacho ${servicio}`, reqId);

    const reqRecord = {
      id: reqId,
      servicioSolicitante: servicio,
      responsableRecibe: responsable,
      justificacion: justif,
      fechaDespacho: new Date().toISOString(),
      despachadoPor: state.currentUser?.name || 'Encargado de Farmacia',
      items: [{
        medicationId: medId,
        medicationName: catMed.name,
        cantidadDespachada: qty,
        consumedLots: consumeRes.consumed
      }]
    };

    state.requisicionesHospitalarias = state.requisicionesHospitalarias || [];
    state.requisicionesHospitalarias.unshift(reqRecord);

    saveAppState(state);
    close();
    alert(`🎉 Vale de Requisición y Despacho F02 emitido exitosamente. Consumo PEPS registrado.`);
    refreshActiveTab();
  });
}

// ==========================================
// 7. BITÁCORA DE TEMPERATURA Y CADENA DE FRÍO (F05)
// ==========================================

function renderCadenaFrioTab() {
  const state = getAppState();
  const tbody = document.getElementById('temp-log-tbody');
  const monthBadge = document.getElementById('cf-stat-month-count');
  const fridgeTempDisplay = document.getElementById('cf-stat-fridge-temp');
  const ambientTempDisplay = document.getElementById('cf-stat-ambient-temp');
  const humidityDisplay = document.getElementById('cf-stat-humidity');
  if (!tbody) return;

  const logs = state.bitacoraTemperatura || [];
  if (monthBadge) monthBadge.textContent = logs.length;

  if (logs.length > 0) {
    const last = logs[0];
    if (fridgeTempDisplay) fridgeTempDisplay.textContent = `${last.tempNevera} °C`;
    if (ambientTempDisplay) ambientTempDisplay.textContent = `${last.tempAmbiente} °C`;
    if (humidityDisplay) humidityDisplay.textContent = `${last.humedad} %`;
  }

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted);">No hay registros de temperatura en la bitácora este mes.</td></tr>`;
  } else {
    tbody.innerHTML = logs.map(l => {
      const isFridgeOk = l.tempNevera >= 2.0 && l.tempNevera <= 8.0;
      const isAmbientOk = l.tempAmbiente >= 15.0 && l.tempAmbiente <= 25.0;

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 8px;"><strong>${l.fecha}</strong> (${l.turno})</td>
          <td style="padding: 8px; color: var(--text-muted);">${l.horaLectura}</td>
          <td style="padding: 8px; text-align: center; font-weight: bold; color: ${isFridgeOk ? '#38bdf8' : '#ef4444'};">
            ${l.tempNevera} °C ${isFridgeOk ? '✅' : '🚨'}
          </td>
          <td style="padding: 8px; text-align: center; font-weight: bold; color: ${isAmbientOk ? '#10b981' : '#ef4444'};">
            ${l.tempAmbiente} °C ${isAmbientOk ? '✅' : '🚨'}
          </td>
          <td style="padding: 8px; text-align: center;">${l.humedad} %</td>
          <td style="padding: 8px;">${l.responsable}</td>
          <td style="padding: 8px; font-size: 0.78rem; color: ${!isFridgeOk || !isAmbientOk ? '#ef4444' : 'var(--text-muted)'};">
            ${l.observaciones || 'Conforme'}
          </td>
        </tr>
      `;
    }).join('');
  }
}

function showTemperaturaF05Modal() {
  const state = getAppState();
  let modal = document.getElementById('modal-temp-f05');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-temp-f05';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px); padding: 15px;';
    document.body.appendChild(modal);
  }

  const now = new Date();
  const currentHour = now.getHours();
  const defaultTurno = currentHour < 13 ? 'AM (08:00)' : 'PM (18:00)';
  const dateStr = now.toISOString().substring(0, 10);
  const timeStr = now.toTimeString().substring(0, 5);

  modal.innerHTML = `
    <div class="glass-card modal-card" style="max-width: 520px; width: 100%; padding: 1.75rem; border-top: 4px solid #38bdf8; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="color: #38bdf8; margin: 0;">Registro de Temperatura Diaria (HMM-ALM-F05)</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 4px 0 0 0;">
            Toma de control AM / PM de Cadena de Frío y Almacén.
          </p>
        </div>
        <button type="button" id="btn-close-temp-modal" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer;">&times;</button>
      </div>

      <form id="form-temp-f05" style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Fecha:</label>
            <input type="date" id="f05-fecha" value="${dateStr}" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Turno:</label>
            <select id="f05-turno" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
              <option value="AM (08:00)" ${defaultTurno.includes('AM') ? 'selected' : ''}>AM (08:00 Hrs)</option>
              <option value="PM (18:00)" ${defaultTurno.includes('PM') ? 'selected' : ''}>PM (18:00 Hrs)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Temp. Nevera (+2° a +8°C):</label>
            <input type="number" step="0.1" id="f05-temp-nevera" value="4.5" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Temp. Almacén (15° a 25°C):</label>
            <input type="number" step="0.1" id="f05-temp-ambiente" value="21.0" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Humedad Relativa (%):</label>
            <input type="number" id="f05-humedad" value="50" min="10" max="100" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 0.82rem; font-weight: bold;">Hora Exacta:</label>
            <input type="time" id="f05-hora" value="${timeStr}" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
        </div>

        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.82rem; font-weight: bold;">Observaciones / Medidas Correctivas:</label>
          <textarea id="f05-observaciones" rows="2" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">Rangos de temperatura dentro de parámetros normales. Sin anomalías en compresores.</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-temp-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="background: #38bdf8; color: #000; font-weight: bold; border: none;">
            🌡️ Guardar Lectura
          </button>
        </div>
      </form>
    </div>
  `;

  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-close-temp-modal').addEventListener('click', close);
  modal.querySelector('#btn-cancel-temp-modal').addEventListener('click', close);

  modal.querySelector('#form-temp-f05').addEventListener('submit', (e) => {
    e.preventDefault();
    const tempN = parseFloat(modal.querySelector('#f05-temp-nevera').value) || 0;
    const tempA = parseFloat(modal.querySelector('#f05-temp-ambiente').value) || 0;
    const hum = parseInt(modal.querySelector('#f05-humedad').value) || 50;

    const logRecord = {
      id: `TEMP-${Date.now()}`,
      fecha: modal.querySelector('#f05-fecha').value,
      turno: modal.querySelector('#f05-turno').value,
      horaLectura: modal.querySelector('#f05-hora').value,
      tempNevera: tempN,
      tempAmbiente: tempA,
      humedad: hum,
      observaciones: modal.querySelector('#f05-observaciones').value.trim(),
      responsable: state.currentUser?.name || 'Personal de Farmacia',
      timestamp: new Date().toISOString()
    };

    state.bitacoraTemperatura = state.bitacoraTemperatura || [];
    state.bitacoraTemperatura.unshift(logRecord);

    saveAppState(state);
    close();
    alert("✅ Lectura de temperatura y cadena de frío registrada en la bitácora.");
    refreshActiveTab();
  });
}

// ==========================================
// 8. BANDEJA DE AUTORIZACIONES (NIVEL 2 Y 3)
// ==========================================

function renderAutorizacionesTab() {
  const state = getAppState();
  const tbody = document.getElementById('auth-tray-tbody');
  if (!tbody) return;

  const authList = state.autorizacionesEspeciales || [];

  if (authList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding: 20px; text-align: center; color: var(--text-muted);">No hay solicitudes de autorización especial pendientes ni registradas.</td></tr>`;
  } else {
    tbody.innerHTML = authList.map(a => {
      const dateStr = new Date(a.details?.date || Date.now()).toLocaleDateString('es-GT');
      const isPending = a.status === 'Pendiente';
      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 8px;"><strong>${a.id}</strong><br><span style="font-size: 0.72rem; color: var(--text-muted);">${dateStr}</span></td>
          <td style="padding: 8px;"><strong>${a.patientName}</strong></td>
          <td style="padding: 8px;">
            ${(a.medicines || []).map(m => `<div>${m.name} (x${m.quantity})</div>`).join('')}
          </td>
          <td style="padding: 8px;">
            <span style="background: ${a.level === 3 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}; color: ${a.level === 3 ? '#ef4444' : '#f59e0b'}; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.75rem;">
              Nivel ${a.level}
            </span>
          </td>
          <td style="padding: 8px;">Dr. ${a.doctorName || 'Tratante'}</td>
          <td style="padding: 8px; font-size: 0.75rem; max-width: 200px;">${a.details?.rationale || 'Sin justificación'}</td>
          <td style="padding: 8px; text-align: center;">
            <span style="color: ${isPending ? '#f59e0b' : '#10b981'}; font-weight: bold;">
              ${isPending ? '⏳ Pendiente' : '✅ Aprobado'}
            </span>
          </td>
          <td style="padding: 8px; text-align: center;">
            ${isPending ? `
              <button class="btn btn-success btn-small btn-approve-special-auth" data-id="${a.id}" style="padding: 2px 6px; font-size: 0.72rem;">
                🛡️ Aprobar
              </button>
            ` : `<span style="font-size: 0.72rem; color: var(--text-muted);">Firmado</span>`}
          </td>
        </tr>
      `;
    }).join('');
  }
}

function approveSpecialAuth(authId) {
  const state = getAppState();
  const auth = (state.autorizacionesEspeciales || []).find(a => a.id === authId);
  if (!auth) return;

  if (auth.level === 3) {
    const pass = prompt("Ingrese contraseña de Gerencia Administrativa para autorizar Nivel 3:");
    const adminUser = (state.users || []).find(u => String(u.role || '').toLowerCase().includes('administrador') || u.id === 'Admin');
    const hashed = hashPassword(pass || '');
    const isAuth = pass === 'Glol5414' || (adminUser && (adminUser.password === pass || adminUser.password === hashed || adminUser.password === 'Glol5414'));
    if (!isAuth) {
      alert("❌ Contraseña de Gerencia Administrativa incorrecta.");
      return;
    }
  }

  auth.status = 'Aprobado';
  saveAppState(state);
  alert("🎉 Autorización especial aprobada y firmada digitalmente.");
  refreshActiveTab();
}

// ==========================================
// 9. DASHBOARD DE KPIS Y AUDITORÍA CÍCLICA
// ==========================================

function renderDashboardKPIsTab() {
  const state = getAppState();
  ensureKardexPEPS(state);
  const tbody = document.getElementById('auditorias-tbody');

  // Calcular ECL
  const liquidations = state.liquidacionesUnidosis || [];
  let totalEnv = 0;
  let totalOk = 0;
  liquidations.forEach(l => {
    totalEnv += (l.totalEnviadas || 0);
    totalOk += ((l.totalAdministradas || 0) + (l.totalDevueltas || 0));
  });
  const eclCalc = totalEnv > 0 ? ((totalOk / totalEnv) * 100).toFixed(1) + '%' : '100.0%';
  const eclEl = document.getElementById('kpi-ecl-value');
  if (eclEl) eclEl.textContent = eclCalc;

  // Calcular ERI (Exactitud de Registro de Inventario)
  const audits = state.auditoriasInventario || [];
  let totalItemsAudited = 0;
  let totalItemsExact = 0;
  audits.forEach(a => {
    totalItemsAudited += (a.totalItems || 0);
    totalItemsExact += (a.itemsConformes || 0);
  });
  const eriCalc = totalItemsAudited > 0 ? ((totalItemsExact / totalItemsAudited) * 100).toFixed(1) + '%' : '99.2%';
  const eriEl = document.getElementById('kpi-eri-value');
  if (eriEl) eriEl.textContent = eriCalc;

  // Render Auditorías
  if (tbody) {
    if (audits.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="padding: 20px; text-align: center; color: var(--text-muted);">No se han ejecutado auditorías cíclicas todavía. Haga clic en "Nueva Auditoría Cíclica".</td></tr>`;
    } else {
      tbody.innerHTML = audits.map(a => `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 8px; font-weight: bold; color: var(--accent-primary);">${a.id}</td>
          <td style="padding: 8px;">${new Date(a.date).toLocaleDateString('es-GT')}</td>
          <td style="padding: 8px;">${a.tipoConteo || 'Conteo Ciego Rotativo'}</td>
          <td style="padding: 8px; text-align: center; font-weight: bold;">${a.totalItems}</td>
          <td style="padding: 8px; text-align: center; color: #10b981; font-weight: bold;">${a.itemsConformes}</td>
          <td style="padding: 8px; text-align: center; color: ${a.discrepancias > 0 ? '#ef4444' : 'var(--text-muted)'}; font-weight: bold;">${a.discrepancias}</td>
          <td style="padding: 8px; text-align: right; font-weight: bold; color: #38bdf8;">${a.eriResult}%</td>
          <td style="padding: 8px;">${a.auditor}</td>
        </tr>
      `).join('');
    }
  }
}

function showAuditoriaModal() {
  const state = getAppState();
  ensureKardexPEPS(state);
  const activeBatches = (state.almacenKardexPEPS || []).filter(b => b.activo !== false && (b.stockActual || 0) > 0).slice(0, 5);

  if (activeBatches.length === 0) {
    alert("No hay lotes activos con existencias para auditar.");
    return;
  }

  let modal = document.getElementById('modal-audit-kardex');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-audit-kardex';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px); padding: 15px;';
    document.body.appendChild(modal);
  }

  const rowsHtml = activeBatches.map((b, idx) => `
    <tr style="border-bottom: 1px solid var(--border-color);">
      <td style="padding: 6px;">
        <strong>${b.medicationName}</strong> (Lote: ${b.lote})<br>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Kardex PEPS: ${b.stockActual} ${b.unidad_dispensable}(s)</span>
      </td>
      <td style="padding: 6px; text-align: center;">
        <input type="number" class="audit-physical-count" data-index="${idx}" data-expected="${b.stockActual}" value="${b.stockActual}" min="0" style="width: 80px; padding: 4px; text-align: center; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
      </td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="glass-card modal-card" style="max-width: 580px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.75rem; border-top: 4px solid #38bdf8; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="color: #38bdf8; margin: 0;">Auditoría Cíclica de Inventario (Muestreo Rotativo)</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 4px 0 0 0;">
            Conteo físico vs Kardex para cálculo del indicador ERI.
          </p>
        </div>
        <button type="button" id="btn-close-audit-modal" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer;">&times;</button>
      </div>

      <div style="border: 1px solid var(--border-color); border-radius: 4px; margin-bottom: 1rem; max-height: 250px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
          <thead>
            <tr style="background: rgba(255,255,255,0.03); color: var(--text-muted);">
              <th style="padding: 6px; text-align: left;">Medicamento / Lote Kardex</th>
              <th style="padding: 6px; text-align: center; width: 120px;">Conteo Físico Real</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div class="form-group" style="margin-bottom: 12px;">
        <label style="font-size: 0.82rem; font-weight: bold;">Auditor Responsable:</label>
        <input type="text" id="audit-auditor-name" value="${state.currentUser?.name || 'Comité de Farmacia y Auditoría'}" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button type="button" class="btn btn-secondary" id="btn-cancel-audit-modal">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btn-submit-audit" style="background: #38bdf8; color: #000; font-weight: bold; border: none;">
          📊 Registrar Auditoría
        </button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-close-audit-modal').addEventListener('click', close);
  modal.querySelector('#btn-cancel-audit-modal').addEventListener('click', close);

  modal.querySelector('#btn-submit-audit').addEventListener('click', () => {
    const inputs = modal.querySelectorAll('.audit-physical-count');
    let totalItems = inputs.length;
    let exactCount = 0;
    let discCount = 0;

    inputs.forEach(inp => {
      const expected = parseInt(inp.getAttribute('data-expected'));
      const physical = parseInt(inp.value) || 0;
      if (expected === physical) {
        exactCount++;
      } else {
        discCount++;
      }
    });

    const eriScore = ((exactCount / Math.max(1, totalItems)) * 100).toFixed(1);
    const auditRecord = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString(),
      tipoConteo: 'Conteo Ciego Rotativo',
      totalItems,
      itemsConformes: exactCount,
      discrepancias: discCount,
      eriResult: eriScore,
      auditor: modal.querySelector('#audit-auditor-name').value.trim()
    };

    state.auditoriasInventario = state.auditoriasInventario || [];
    state.auditoriasInventario.unshift(auditRecord);

    saveAppState(state);
    close();
    alert(`🎉 Auditoría de inventario registrada:\n- ERI Resultante: ${eriScore}%\n- Ítems Conformes: ${exactCount}/${totalItems}`);
    refreshActiveTab();
  });
}

// ==========================================
// 10. VENTAS EXTERNAS (DESCARGA PEPS)
// ==========================================

function renderCartTable() {
  const tbody = document.getElementById('cart-table-body');
  const totalDisplay = document.getElementById('cart-total-display');
  if (!tbody || !totalDisplay) return;

  tbody.innerHTML = '';
  let total = 0;

  if (currentCart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">El carrito está vacío.</td></tr>`;
    totalDisplay.textContent = 'Q0.00';
    return;
  }

  currentCart.forEach((item, idx) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
    tr.innerHTML = `
      <td style="padding: 10px;">
        <strong>${item.name}</strong><br>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${item.generic}</span>
      </td>
      <td style="padding: 10px; text-align: center; font-weight: bold;">${item.displayQuantity || item.quantity}</td>
      <td style="padding: 10px; text-align: right; color: var(--text-muted);">Q${parseFloat(item.price).toFixed(2)}</td>
      <td style="padding: 10px; text-align: right; font-weight: bold; color: var(--accent-success);">Q${subtotal.toFixed(2)}</td>
      <td style="padding: 10px; text-align: center;">
        <button class="btn btn-danger btn-small btn-remove-cart-item" data-index="${idx}" style="padding: 4px 8px; font-size: 0.8rem;">&times;</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  totalDisplay.textContent = `Q${total.toFixed(2)}`;
}

function addToCart() {
  if (!selectedMedicineForSale) {
    alert("Por favor seleccione un medicamento primero.");
    return;
  }

  const qtyInput = document.getElementById('pharmacy-med-qty');
  const qty = parseInt(qtyInput ? qtyInput.value : 1);
  if (isNaN(qty) || qty <= 0) {
    alert("Ingrese una cantidad válida mayor a cero.");
    return;
  }

  const saleType = document.getElementById('pharmacy-sale-type')?.value || 'presentacion';
  const m = enrichMedication(selectedMedicineForSale);
  const state = getAppState();
  const currentStock = getAvailableStockPEPS(state, m.id);

  if (currentStock <= 0) {
    alert(`❌ No hay existencias PEPS de "${m.name}".`);
    return;
  }

  let totalUnitsToAdd = saleType === 'presentacion' ? qty * m.unidades_por_presentacion : qty;

  const existingInCart = currentCart
    .filter(item => item.id === m.id)
    .reduce((sum, item) => sum + (item.unidades_totales || item.quantity), 0);

  if (existingInCart + totalUnitsToAdd > currentStock) {
    alert(`❌ Existencias PEPS insuficientes de "${m.name}". Disponibles: ${currentStock} unds.`);
    return;
  }

  const itemPrice = saleType === 'presentacion' ? m.precio_presentacion : m.precio_unitario;
  const displayQty = saleType === 'presentacion' ? `${qty} ${m.presentation || 'caja'}(s)` : `${qty} ${m.unidad_dispensable || 'tableta'}(s)`;

  const existingIdx = currentCart.findIndex(item => item.id === m.id && item.tipoVenta === saleType);
  if (existingIdx !== -1) {
    currentCart[existingIdx].quantity += qty;
    currentCart[existingIdx].unidades_totales += totalUnitsToAdd;
  } else {
    currentCart.push({
      id: m.id,
      name: m.name,
      generic: m.generic || '',
      presentation: m.presentation || '',
      price: itemPrice,
      quantity: qty,
      tipoVenta: saleType,
      unidades_totales: totalUnitsToAdd,
      displayQuantity: displayQty
    });
  }

  selectedMedicineForSale = null;
  document.getElementById('pharmacy-selection-preview').style.display = 'none';
  renderCartTable();
}

function finalizeExternalSale() {
  if (currentCart.length === 0) {
    alert("El carrito está vacío.");
    return;
  }

  const buyerNit = document.getElementById('buyer-nit').value.trim() || 'CF';
  const buyerName = document.getElementById('buyer-name').value.trim() || 'Consumidor Final';
  const appState = getAppState();
  ensureKardexPEPS(appState);

  let total = currentCart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const saleId = 'FAC-EXT-' + Date.now();

  // Descarga PEPS
  const deductions = [];
  for (const item of currentCart) {
    const units = item.unidades_totales || item.quantity;
    const res = consumeStockPEPS(appState, item.id, units, 'Venta Externa Mostrador', saleId);
    if (res.success) deductions.push(...res.consumed);
  }

  const newSale = {
    id: saleId,
    date: new Date().toISOString(),
    buyerName,
    buyerNit,
    items: [...currentCart],
    total,
    kardexDeductions: deductions
  };

  appState.externalSales = appState.externalSales || [];
  appState.externalSales.unshift(newSale);
  saveAppState(appState);

  printSalesVoucher(newSale);
  currentCart = [];
  renderCartTable();
  alert("🎉 Venta externa completada y existencias descargadas del Kardex PEPS.");
  refreshActiveTab();
}

function renderSalesHistory() {
  const dispensedRecipesContainer = document.getElementById('dispensed-recipes-list');
  const externalSalesContainer = document.getElementById('external-sales-list');
  const state = getAppState();

  if (dispensedRecipesContainer) {
    dispensedRecipesContainer.innerHTML = '';
    const dispensed = [];
    (state.patients || []).forEach(p => {
      (p.prescriptions || []).forEach(r => {
        if (r.dispenseStatus === 'Despachado') {
          dispensed.push({ patientName: p.name, recipe: r });
        }
      });
    });

    if (dispensed.length === 0) {
      dispensedRecipesContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No hay recetas despachadas</div>`;
    } else {
      dispensed.sort((a, b) => new Date(b.recipe.dispenseDate) - new Date(a.recipe.dispenseDate));
      dispensedRecipesContainer.innerHTML = dispensed.map(item => `
        <div class="history-card" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px; font-size: 0.82rem;">
          <div style="display: flex; justify-content: space-between; font-weight: 600;">
            <span>${item.patientName}</span>
            <span style="color: var(--accent-success);">Entregado (FIFO)</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
            Fecha: ${new Date(item.recipe.dispenseDate).toLocaleString('es-GT')} | Dr. ${item.recipe.doctorName}
          </div>
          <div style="margin-top: 4px; color: var(--text-primary);">
            <strong>Meds:</strong> ${(item.recipe.medicines || []).map(m => `${m.name} (x${m.quantity})`).join(', ')}
          </div>
        </div>
      `).join('');
    }
  }

  if (externalSalesContainer) {
    externalSalesContainer.innerHTML = '';
    const sales = state.externalSales || [];
    if (sales.length === 0) {
      externalSalesContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No hay ventas externas</div>`;
    } else {
      externalSalesContainer.innerHTML = sales.map(sale => `
        <div class="history-card" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px; font-size: 0.82rem;">
          <div style="display: flex; justify-content: space-between; font-weight: 600;">
            <span>${sale.buyerName}</span>
            <strong style="color: var(--accent-success);">Q${parseFloat(sale.total).toFixed(2)}</strong>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; display: flex; justify-content: space-between;">
            <span>Doc: ${sale.id} | ${new Date(sale.date).toLocaleString('es-GT')}</span>
            <button class="btn btn-secondary btn-small btn-reprint-sale" data-id="${sale.id}" style="padding: 1px 5px; font-size: 0.7rem;">🖨️</button>
          </div>
        </div>
      `).join('');
    }
  }
}

// ==========================================
// 11. BAJAS Y DISPOSICIÓN FINAL (F03)
// ==========================================

function renderBajasVencidosTab() {
  const state = getAppState();
  ensureKardexPEPS(state);
  const today = new Date();
  const expiredBatches = (state.almacenKardexPEPS || []).filter(b => b.activo !== false && (b.stockActual || 0) > 0 && new Date(b.fechaVencimiento) < today);

  const totalExpiredUnits = expiredBatches.reduce((acc, b) => acc + (b.stockActual || 0), 0);
  const totalLoss = expiredBatches.reduce((acc, b) => acc + (b.stockActual * (b.precioCosto / Math.max(1, b.unidades_por_presentacion || 1))), 0);
  const bajasHistory = state.bajasInventario || state.bajasDisposicion || [];

  const statExpCount = document.getElementById('baja-stat-expired-count');
  const statExpUnits = document.getElementById('baja-stat-expired-units');
  const statLoss = document.getElementById('baja-stat-loss-total');
  const statActas = document.getElementById('baja-stat-actas-count');

  if (statExpCount) statExpCount.textContent = expiredBatches.length;
  if (statExpUnits) statExpUnits.textContent = totalExpiredUnits;
  if (statLoss) statLoss.textContent = `Q${totalLoss.toFixed(2)}`;
  if (statActas) statActas.textContent = bajasHistory.length;

  const pendingTbody = document.getElementById('vencidos-pendientes-tbody');
  if (pendingTbody) {
    if (expiredBatches.length === 0) {
      pendingTbody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #10b981;">✅ No hay lotes vencidos pendientes de descarte en el Kardex PEPS.</td></tr>`;
    } else {
      pendingTbody.innerHTML = expiredBatches.map(b => {
        const loss = b.stockActual * (b.precioCosto / Math.max(1, b.unidades_por_presentacion || 1));
        return `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 8px;"><strong>${b.medicationName}</strong> (${b.presentation})</td>
            <td style="padding: 8px; font-family: monospace;">${b.lote}</td>
            <td style="padding: 8px; color: #ef4444; font-weight: bold;">${b.fechaVencimiento}</td>
            <td style="padding: 8px; text-align: right; font-weight: bold;">${b.stockActual} ${b.unidad_dispensable}(s)</td>
            <td style="padding: 8px; text-align: right; color: #f472b6; font-weight: bold;">Q${loss.toFixed(2)}</td>
            <td style="padding: 8px; text-align: center;">
              <button class="btn btn-danger btn-small btn-trigger-baja-direct" data-med-id="${b.medicationId}" data-batch-id="${b.id}" style="padding: 3px 8px; font-size: 0.75rem;">
                🗑️ Solicitar Baja
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  const actasTbody = document.getElementById('actas-historial-tbody');
  if (actasTbody) {
    if (bajasHistory.length === 0) {
      actasTbody.innerHTML = `<tr><td colspan="8" style="padding: 20px; text-align: center; color: var(--text-muted);">No hay actas F03 registradas.</td></tr>`;
    } else {
      actasTbody.innerHTML = bajasHistory.map(b => `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 8px; font-family: monospace; font-weight: bold; color: var(--accent-primary);">${b.id}</td>
          <td style="padding: 8px;">${new Date(b.date).toLocaleDateString('es-GT')}</td>
          <td style="padding: 8px;"><strong>${b.medicationName}</strong> (Lote: ${b.lote || 'N/D'})</td>
          <td style="padding: 8px; text-align: right; font-weight: bold;">${b.unitsDiscarded} ${b.unidad_dispensable || 'unds'}</td>
          <td style="padding: 8px; text-align: right; color: #ef4444; font-weight: bold;">Q${parseFloat(b.totalLoss || 0).toFixed(2)}</td>
          <td style="padding: 8px;">${b.operatorName}</td>
          <td style="padding: 8px; color: #10b981; font-weight: bold;">🛡️ ${b.authorizedBy}</td>
          <td style="padding: 8px; text-align: center;">
            <button class="btn btn-secondary btn-small btn-print-baja-acta" data-acta-id="${b.id}" style="padding: 2px 6px; font-size: 0.72rem;">🖨️ F03</button>
          </td>
        </tr>
      `).join('');
    }
  }
}

function showBajaVencidoModal(medId, batchId = null) {
  const state = getAppState();
  ensureKardexPEPS(state);
  const med = (state.medications || []).find(m => m.id === medId);
  const batch = batchId ? state.almacenKardexPEPS.find(b => b.id === batchId) : state.almacenKardexPEPS.find(b => b.medicationId === medId && b.stockActual > 0);
  if (!med && !batch) return;

  const enriched = enrichMedication(med);
  const currentStock = batch ? batch.stockActual : (med.stock || 0);

  let modal = document.getElementById('modal-baja-vencido');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-baja-vencido';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px); padding: 15px;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="glass-card modal-card" style="max-width: 580px; width: 100%; padding: 1.75rem; border-top: 4px solid var(--accent-danger); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="color: var(--accent-danger); margin: 0;">Acta de Baja y Disposición Final (HMM-ALM-F03)</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 4px 0 0 0;">
            Descarte de inventario por caducidad con clave obligatoria de Administrador Maestro.
          </p>
        </div>
        <button type="button" id="btn-close-baja-modal" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer;">&times;</button>
      </div>

      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 10px; border-radius: 6px; margin-bottom: 1rem; font-size: 0.85rem;">
        <strong>${med ? med.name : batch.medicationName}</strong> (Lote: ${batch ? batch.lote : med.lote})<br>
        <span style="color: var(--text-muted);">Existencias a Descartar: <strong>${currentStock} ${enriched.unidad_dispensable}(s)</strong></span>
      </div>

      <form id="form-baja-vencido" style="display: flex; flex-direction: column; gap: 10px;">
        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.82rem; font-weight: bold;">Cantidad a Dar de Baja (${enriched.unidad_dispensable}s):</label>
          <input type="number" id="baja-units-input" value="${currentStock}" min="1" max="${currentStock}" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
        </div>

        <div class="form-group" style="margin: 0;">
          <label style="font-size: 0.82rem; font-weight: bold;">Motivo / Protocolo de Destrucción:</label>
          <textarea id="baja-reason-input" rows="2" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">Vencimiento de caducidad cumplido. Descarte y disposición final según norma HMM-MAN-ALM-05.</textarea>
        </div>

        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.4); padding: 10px; border-radius: 6px;">
          <label style="font-size: 0.8rem; font-weight: bold; color: #ef4444; display: block; margin-bottom: 4px;">
            🔒 Clave del Administrador Maestro (Obligatoria):
          </label>
          <input type="password" id="baja-admin-password" placeholder="Ingrese contraseña..." required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.5); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-baja-modal">Cancelar</button>
          <button type="submit" class="btn btn-danger" style="font-weight: bold;">
            🗑️ Aprobar y Emitir Acta F03
          </button>
        </div>
      </form>
    </div>
  `;

  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  modal.querySelector('#btn-close-baja-modal').addEventListener('click', close);
  modal.querySelector('#btn-cancel-baja-modal').addEventListener('click', close);

  modal.querySelector('#form-baja-vencido').addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = modal.querySelector('#baja-admin-password').value.trim();
    const adminUser = (state.users || []).find(u => String(u.role || '').toLowerCase().includes('administrador') || u.id === 'Admin');
    const hashed = hashPassword(pass);
    const isAuth = pass === 'Glol5414' || (adminUser && (adminUser.password === pass || adminUser.password === hashed || adminUser.password === 'Glol5414'));

    if (!isAuth) {
      alert("❌ Contraseña de Administrador Maestro incorrecta. Baja no autorizada.");
      return;
    }

    const units = parseInt(modal.querySelector('#baja-units-input').value) || 0;
    const reason = modal.querySelector('#baja-reason-input').value.trim();
    const loss = parseFloat((units * enriched.precio_unitario).toFixed(2));
    const actaId = `ACTA-F03-${Date.now().toString().slice(-6)}`;

    // Reducir stock del lote y catálogo
    if (batch) {
      batch.stockActual = Math.max(0, batch.stockActual - units);
    }
    if (med) {
      med.stock = Math.max(0, (med.stock || 0) - units);
    }

    const actaRecord = {
      id: actaId,
      date: new Date().toISOString(),
      medicationId: medId,
      medicationName: med ? med.name : batch.medicationName,
      generic: enriched.generic || '',
      presentation: enriched.presentation,
      unidad_dispensable: enriched.unidad_dispensable,
      lote: batch ? batch.lote : med.lote,
      vencimiento: batch ? batch.fechaVencimiento : med.vencimiento,
      unitsDiscarded: units,
      totalLoss: loss,
      operatorName: state.currentUser?.name || 'Encargado de Farmacia',
      authorizedBy: 'Administrador Maestro',
      reason
    };

    state.bajasInventario = state.bajasInventario || [];
    state.bajasInventario.unshift(actaRecord);

    saveAppState(state);
    close();
    alert(`✅ Acta de Baja y Disposición Final F03 emitida con éxito (${actaId}).`);
    refreshActiveTab();
  });
}

// ==========================================
// 12. DEMANDA REAL Y ALERTAS DE INVENTARIO
// ==========================================

function renderDemandaReal() {
  const tbody = document.getElementById('dr-table-body');
  if (!tbody) return;

  const state = getAppState();
  const rawList = state.demandaReal || [];

  const uniqueMeds = new Set(rawList.map(r => (r.medicineName || '').toLowerCase().trim())).size;
  document.getElementById('dr-stat-unique-meds').textContent = uniqueMeds;
  document.getElementById('dr-stat-total-records').textContent = rawList.length;

  const medCounts = {};
  rawList.forEach(r => {
    const k = r.medicineName || 'N/D';
    medCounts[k] = (medCounts[k] || 0) + (r.quantity || 1);
  });

  let topMed = 'Ninguno';
  let topQty = 0;
  Object.keys(medCounts).forEach(m => {
    if (medCounts[m] > topQty) {
      topQty = medCounts[m];
      topMed = m;
    }
  });

  document.getElementById('dr-stat-top-med').textContent = topMed;
  document.getElementById('dr-stat-top-med-qty').textContent = `${topQty} unidades acumuladas`;

  if (rawList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-muted);">No hay registros de demanda real.</td></tr>`;
  } else {
    tbody.innerHTML = rawList.map(r => `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 8px; color: var(--text-muted);">${new Date(r.date).toLocaleString('es-GT')}</td>
        <td style="padding: 8px; font-weight: bold; color: var(--accent-primary);">${r.medicineName}</td>
        <td style="padding: 8px; text-align: center; font-weight: bold;">${r.quantity}</td>
        <td style="padding: 8px;">${r.patientName}</td>
        <td style="padding: 8px; font-style: italic;">Dr/a. ${r.doctorName}</td>
      </tr>
    `).join('');
  }
}

function renderInventoryAlerts() {
  const container = document.getElementById('inventory-alerts-container');
  if (!container) return;

  const state = getAppState();
  ensureKardexPEPS(state);
  const alerts = [];
  const today = new Date();
  const ninetyDays = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  (state.almacenKardexPEPS || []).forEach(b => {
    if (b.activo !== false && (b.stockActual || 0) > 0 && b.fechaVencimiento) {
      const exp = new Date(b.fechaVencimiento);
      if (exp < today) {
        alerts.push({
          type: 'expired',
          text: `🚨 <strong>LOTE CADUCADO:</strong> "${b.medicationName}" (Lote: ${b.lote}) venció el ${exp.toLocaleDateString('es-GT')}. Existencias: ${b.stockActual} unds.`
        });
      } else if (exp <= ninetyDays) {
        const days = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        alerts.push({
          type: 'expiring',
          text: `⚠️ <strong>PRÓXIMO A VENCER:</strong> "${b.medicationName}" (Lote: ${b.lote}) vence en ${days} días (${exp.toLocaleDateString('es-GT')}).`
        });
      }
    }
  });

  if (alerts.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
    <div style="background: rgba(18, 18, 30, 0.6); border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem;">
      <h4 style="color: var(--accent-danger); margin: 0 0 8px 0; font-size: 0.9rem;">📢 Alertas Sanitarias de Caducidad (Kardex PEPS)</h4>
      <div style="display: flex; flex-direction: column; gap: 6px; max-height: 150px; overflow-y: auto;">
        ${alerts.map(a => `
          <div style="background: ${a.type === 'expired' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'}; color: ${a.type === 'expired' ? '#ff7961' : '#ffb74d'}; padding: 6px 10px; border-radius: 4px; font-size: 0.8rem;">
            ${a.text}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ==========================================
// 13. GENERADORES DE REPORTES IMPRIMIBLES HMM
// ==========================================

export function printHojaUnidosisF06(uObj) {
  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ' };
  const w = window.open('', '_blank');

  w.document.write(`
    <html>
    <head>
      <title>HMM-ALM-F06 - Hoja de Control y Despacho Unidosis</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 25px; color: #111; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-size: 1.1rem; font-weight: bold; text-transform: uppercase; }
        .doc-code { font-size: 0.8rem; font-weight: bold; color: #555; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; font-size: 0.85rem; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        th, td { border: 1px solid #333; padding: 6px; text-align: left; }
        th { background: #eee; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
        .sig { width: 40%; border-top: 1px solid #000; text-align: center; font-size: 0.8rem; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${clinic.name}</div>
        <div>SISTEMA LUGAMED - SERVICIO DE FARMACIA Y DOSIS UNITARIA</div>
        <div class="doc-code">HMM-ALM-F06: CONTROL Y DESPACHO DE DOSIS UNITARIA 24 HORAS (V5.0)</div>
      </div>
      <div class="meta">
        <div><strong>Cassette:</strong> ${uObj.id}</div>
        <div><strong>Fecha/Hora Corte:</strong> ${new Date(uObj.fechaGeneracion).toLocaleString('es-GT')}</div>
        <div><strong>Paciente:</strong> ${uObj.patientName}</div>
        <div><strong>Cama / Servicio:</strong> ${uObj.bed} (${uObj.service})</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Horario</th>
            <th>Medicamento / Principio Activo</th>
            <th>Dosis y Vía</th>
            <th>Lote PEPS</th>
            <th>Firma Enfermera</th>
          </tr>
        </thead>
        <tbody>
          ${(uObj.doses || []).map(d => `
            <tr>
              <td style="font-weight: bold; text-align: center;">${d.scheduleHour}</td>
              <td><strong>${d.medicineName}</strong></td>
              <td>${d.dosage} (${d.via})</td>
              <td style="font-family: monospace;">${d.lotePEPS}</td>
              <td></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="signatures">
        <div class="sig">Farmacéutico Despachador</div>
        <div class="sig">Enfermera Receptora (Piso)</div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

export function printThermalUnidosisLabel(uObj, dose) {
  const w = window.open('', '_blank');
  w.document.write(`
    <html>
    <head>
      <title>Viñeta Térmica - ${dose.id}</title>
      <style>
        @page { size: 50mm 30mm; margin: 0; }
        body { font-family: monospace; font-size: 9px; margin: 3px; padding: 2px; }
        .hdr { font-weight: bold; font-size: 10px; border-bottom: 1px solid #000; text-align: center; }
        .qr { font-size: 8px; text-align: center; margin-top: 2px; }
      </style>
    </head>
    <body>
      <div class="hdr">MULTIMÉDICA - LUGAMED</div>
      <div><strong>PAC:</strong> ${uObj.patientName.slice(0, 22)}</div>
      <div><strong>CAMA:</strong> ${uObj.bed} | <strong>HORA:</strong> ${dose.scheduleHour}</div>
      <div><strong>MED:</strong> ${dose.medicineName}</div>
      <div><strong>DOSIS:</strong> ${dose.dosage} (${dose.via})</div>
      <div><strong>LOTE:</strong> ${dose.lotePEPS}</div>
      <div class="qr">|||||| ${dose.id.slice(-8)} ||||||</div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

export function printLiquidacionUnidosisF07(l) {
  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ' };
  const w = window.open('', '_blank');

  w.document.write(`
    <html>
    <head>
      <title>HMM-ALM-F07 - Liquidación Diaria Unidosis</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 25px; color: #111; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-size: 1.1rem; font-weight: bold; text-transform: uppercase; }
        .doc-code { font-size: 0.8rem; font-weight: bold; color: #555; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; font-size: 0.85rem; margin-bottom: 15px; }
        .kpis { display: flex; justify-content: space-around; background: #f4f4f4; padding: 8px; border: 1px solid #ccc; margin-bottom: 15px; font-size: 0.85rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        th, td { border: 1px solid #333; padding: 6px; text-align: left; }
        th { background: #eee; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
        .sig { width: 40%; border-top: 1px solid #000; text-align: center; font-size: 0.8rem; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${clinic.name}</div>
        <div>DEPARTAMENTO DE FARMACIA Y AUDITORÍA DE CUENTAS</div>
        <div class="doc-code">HMM-ALM-F07: LIQUIDACIÓN Y DEVOLUCIÓN DIARIA DE UNIDOSIS (V5.0)</div>
      </div>
      <div class="meta">
        <div><strong>Acta Liquidación:</strong> ${l.id}</div>
        <div><strong>Fecha:</strong> ${new Date(l.fechaLiquidacion).toLocaleString('es-GT')}</div>
        <div><strong>Paciente:</strong> ${l.patientName}</div>
        <div><strong>Cassette Referencia:</strong> ${l.cassetteId} (${l.bed})</div>
      </div>
      <div class="kpis">
        <div><strong>Enviadas:</strong> ${l.totalEnviadas}</div>
        <div><strong>Administradas (Cobradas):</strong> ${l.totalAdministradas} (Q${parseFloat(l.costoFacturado || 0).toFixed(2)})</div>
        <div><strong>Devueltas Conformes:</strong> ${l.totalDevueltas}</div>
        <div><strong>Merma:</strong> ${l.totalDescartadas}</div>
        <div><strong>ECL:</strong> ${l.ecl}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Dosis</th>
            <th>Medicamento</th>
            <th>Horario</th>
            <th>Lote PEPS</th>
            <th>Estado Conciliación</th>
          </tr>
        </thead>
        <tbody>
          ${(l.dosesDetail || []).map(d => `
            <tr>
              <td>${d.id.slice(-6)}</td>
              <td>${d.medicineName}</td>
              <td style="text-align: center;">${d.scheduleHour}</td>
              <td style="font-family: monospace;">${d.lotePEPS}</td>
              <td style="font-weight: bold;">${d.estadoDosis}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="signatures">
        <div class="sig">Enfermera Responsable</div>
        <div class="sig">Auditor / Farmacéutico</div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

export function printActaRecepcionF01(r) {
  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ' };
  const w = window.open('', '_blank');

  w.document.write(`
    <html>
    <head>
      <title>HMM-ALM-F01 - Acta Recepción Técnica</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 25px; color: #111; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-size: 1.1rem; font-weight: bold; text-transform: uppercase; }
        .doc-code { font-size: 0.8rem; font-weight: bold; color: #555; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; font-size: 0.85rem; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th, td { border: 1px solid #333; padding: 8px; text-align: left; }
        th { background: #eee; }
        .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
        .sig { width: 40%; border-top: 1px solid #000; text-align: center; font-size: 0.8rem; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${clinic.name}</div>
        <div>ALMACÉN CENTRAL Y FARMACIA HOSPITALARIA</div>
        <div class="doc-code">HMM-ALM-F01: ACTA DE RECEPCIÓN TÉCNICA DE MEDICAMENTOS (V5.0)</div>
      </div>
      <div class="meta">
        <div><strong>Folio:</strong> ${r.id}</div>
        <div><strong>Fecha Recepción:</strong> ${new Date(r.fechaRecepcion).toLocaleString('es-GT')}</div>
        <div><strong>Proveedor:</strong> ${r.proveedor}</div>
        <div><strong>Factura / Guía:</strong> ${r.factura}</div>
      </div>
      <table>
        <tr><th>Medicamento / Insumo</th><td>${r.medicationName}</td></tr>
        <tr><th>Número de Lote</th><td style="font-family: monospace; font-weight: bold;">${r.lote}</td></tr>
        <tr><th>Fecha de Vencimiento</th><td>${r.fechaVencimiento}</td></tr>
        <tr><th>Cantidad Ingresada</th><td><strong>${r.cantidadRecibida}</strong> unidades mínimas</td></tr>
        <tr><th>Temperatura de Recepción</th><td>${r.temperaturaRecepcion} °C</td></tr>
        <tr><th>Inspección Organoléptica</th><td>${r.inspeccionOrganoleptica}</td></tr>
        <tr><th>Costo Total en Libros</th><td>Q${parseFloat(r.costoTotal || 0).toFixed(2)}</td></tr>
      </table>
      <div class="signatures">
        <div class="sig">Recibido por (Almacén / Farmacia)</div>
        <div class="sig">Firma Gerencia Administrativa</div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

export function printValeRequisicionF02(r) {
  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ' };
  const w = window.open('', '_blank');

  w.document.write(`
    <html>
    <head>
      <title>HMM-ALM-F02 - Vale de Requisición y Despacho</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 25px; color: #111; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-size: 1.1rem; font-weight: bold; text-transform: uppercase; }
        .doc-code { font-size: 0.8rem; font-weight: bold; color: #555; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; font-size: 0.85rem; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th, td { border: 1px solid #333; padding: 8px; text-align: left; }
        th { background: #eee; }
        .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
        .sig { width: 40%; border-top: 1px solid #000; text-align: center; font-size: 0.8rem; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${clinic.name}</div>
        <div>ALMACÉN CENTRAL Y CONTROL DE PISOS</div>
        <div class="doc-code">HMM-ALM-F02: VALE DE REQUISICIÓN Y DESPACHO INTERNO (V5.0)</div>
      </div>
      <div class="meta">
        <div><strong>Vale No:</strong> ${r.id}</div>
        <div><strong>Fecha Despacho:</strong> ${new Date(r.fechaDespacho).toLocaleString('es-GT')}</div>
        <div><strong>Servicio Solicitante:</strong> ${r.servicioSolicitante}</div>
        <div><strong>Destino:</strong> ${r.justificacion}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Medicamento / Material</th>
            <th style="text-align: center;">Cantidad Despachada</th>
            <th>Lote Kardex PEPS</th>
          </tr>
        </thead>
        <tbody>
          ${(r.items || []).map(i => `
            <tr>
              <td><strong>${i.medicationName}</strong></td>
              <td style="text-align: center; font-weight: bold;">${i.cantidadDespachada}</td>
              <td style="font-family: monospace;">${(i.consumedLots || []).map(l => `${l.lote} (x${l.cantidadConsumida})`).join(', ')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="signatures">
        <div class="sig">Despachado por (Farmacia)</div>
        <div class="sig">Recibido Conforme (Servicio)</div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

export function printBitacoraTemperaturaF05() {
  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ' };
  const logs = state.bitacoraTemperatura || [];
  const w = window.open('', '_blank');

  w.document.write(`
    <html>
    <head>
      <title>HMM-ALM-F05 - Bitácora de Temperatura</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
        .title { font-size: 1.1rem; font-weight: bold; }
        .doc-code { font-size: 0.8rem; font-weight: bold; color: #555; }
        table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
        th, td { border: 1px solid #333; padding: 5px; text-align: left; }
        th { background: #eee; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
        .sig { width: 40%; border-top: 1px solid #000; text-align: center; font-size: 0.8rem; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${clinic.name}</div>
        <div>CONTROL DE CALIDAD Y CADENA DE FRÍO</div>
        <div class="doc-code">HMM-ALM-F05: CONTROL DIARIO DE TEMPERATURA Y HUMEDAD RELATIVA (V5.0)</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Turno</th>
            <th>Hora</th>
            <th>Temp. Nevera (+2 a +8°C)</th>
            <th>Temp. Ambiente (15 a 25°C)</th>
            <th>Humedad (%)</th>
            <th>Responsable</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td>${l.fecha}</td>
              <td>${l.turno}</td>
              <td>${l.horaLectura}</td>
              <td style="text-align: center; font-weight: bold;">${l.tempNevera} °C</td>
              <td style="text-align: center; font-weight: bold;">${l.tempAmbiente} °C</td>
              <td style="text-align: center;">${l.humedad} %</td>
              <td>${l.responsable}</td>
              <td>${l.observaciones}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="signatures">
        <div class="sig">Responsable de Farmacia</div>
        <div class="sig">Dirección Médica / Calidad</div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

export function printActaBajaVencido(record) {
  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ' };
  const w = window.open('', '_blank');

  w.document.write(`
    <html>
    <head>
      <title>HMM-ALM-F03 - Acta de Baja y Disposición Final</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 25px; color: #111; }
        .header { text-align: center; border-bottom: 2px solid #b91c1c; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-size: 1.1rem; font-weight: bold; color: #b91c1c; }
        .doc-code { font-size: 0.8rem; font-weight: bold; color: #555; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; font-size: 0.85rem; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th, td { border: 1px solid #333; padding: 8px; text-align: left; }
        th { background: #fee2e2; }
        .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
        .sig { width: 40%; border-top: 1px solid #000; text-align: center; font-size: 0.8rem; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${clinic.name}</div>
        <div>COMITÉ DE BIOSEGURIDAD Y CONTROL DE CADUCIDADES</div>
        <div class="doc-code">HMM-ALM-F03: ACTA DE BAJA Y DISPOSICIÓN FINAL DE MEDICAMENTOS (V5.0)</div>
      </div>
      <div class="meta">
        <div><strong>Folio Acta:</strong> ${record.id}</div>
        <div><strong>Fecha:</strong> ${new Date(record.date).toLocaleString('es-GT')}</div>
        <div><strong>Solicitó:</strong> ${record.operatorName}</div>
        <div><strong>Autorizó:</strong> ${record.authorizedBy}</div>
      </div>
      <table>
        <tr><th>Medicamento Descartado</th><td><strong>${record.medicationName}</strong></td></tr>
        <tr><th>Lote / Vencimiento</th><td>${record.lote} (Caducidad: ${record.vencimiento})</td></tr>
        <tr><th>Cantidad Descartada</th><td><strong>${record.unitsDiscarded} ${record.unidad_dispensable || 'unds'}</strong></td></tr>
        <tr><th>Pérdida Económica</th><td style="color: #b91c1c; font-weight: bold;">Q${parseFloat(record.totalLoss || 0).toFixed(2)}</td></tr>
        <tr><th>Justificación y Destrucción</th><td>${record.reason}</td></tr>
      </table>
      <div class="signatures">
        <div class="sig">Responsable de Farmacia</div>
        <div class="sig">Administrador Maestro (Autorización)</div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

export function printBajasSummaryReport() {
  const state = getAppState();
  const rawList = state.bajasInventario || state.bajasDisposicion || [];
  const clinic = state.clinicInfo || { name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ' };
  const w = window.open('', '_blank');

  w.document.write(`
    <html>
    <head>
      <title>Reporte Consolidado de Bajas - ${clinic.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 25px; color: #111; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        th, td { border: 1px solid #333; padding: 6px; text-align: left; }
        th { background: #eee; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${clinic.name}</h2>
        <div>HISTORIAL CONSOLIDADO DE BAJAS Y MERMAS (HMM-ALM-F03)</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Folio</th>
            <th>Fecha</th>
            <th>Medicamento</th>
            <th>Lote</th>
            <th style="text-align: right;">Cantidad</th>
            <th style="text-align: right;">Pérdida (Q)</th>
            <th>Autorizado</th>
          </tr>
        </thead>
        <tbody>
          ${rawList.map(b => `
            <tr>
              <td>${b.id}</td>
              <td>${new Date(b.date).toLocaleDateString('es-GT')}</td>
              <td>${b.medicationName}</td>
              <td>${b.lote || 'N/D'}</td>
              <td style="text-align: right;">${b.unitsDiscarded}</td>
              <td style="text-align: right; color: red;">Q${parseFloat(b.totalLoss || 0).toFixed(2)}</td>
              <td>${b.authorizedBy}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

export function printDemandaRealReport() {
  const state = getAppState();
  const rawList = state.demandaReal || [];
  const clinic = state.clinicInfo || { name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ' };
  const w = window.open('', '_blank');

  w.document.write(`
    <html>
    <head>
      <title>Reporte de Demanda Real - ${clinic.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 25px; color: #111; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th, td { border: 1px solid #333; padding: 6px; text-align: left; }
        th { background: #eee; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${clinic.name}</h2>
        <div>REPORTE OFICIAL DE DEMANDA REAL DE MEDICAMENTOS FUERA DE CATÁLOGO</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Medicamento Solicitado</th>
            <th style="text-align: center;">Cantidad</th>
            <th>Paciente</th>
            <th>Médico Tratante</th>
          </tr>
        </thead>
        <tbody>
          ${rawList.map(r => `
            <tr>
              <td>${new Date(r.date).toLocaleString('es-GT')}</td>
              <td><strong>${r.medicineName}</strong></td>
              <td style="text-align: center; font-weight: bold;">${r.quantity}</td>
              <td>${r.patientName}</td>
              <td>Dr/a. ${r.doctorName}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  w.document.close();
}

export function printSalesVoucher(sale) {
  const state = getAppState();
  const clinic = state.clinicInfo || { name: 'HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ' };
  const w = window.open('', '_blank');

  w.document.write(`
    <html>
    <head>
      <title>Comprobante de Venta - ${sale.id}</title>
      <style>
        body { font-family: 'Courier New', monospace; margin: 20px; color: #111; max-width: 380px; }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 10px; }
        .title { font-size: 1.1rem; font-weight: bold; }
        .items { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin: 10px 0; }
        .items th, .items td { padding: 4px 0; }
        .total { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; font-size: 1rem; font-weight: bold; display: flex; justify-content: space-between; }
        .footer { text-align: center; font-size: 0.75rem; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${clinic.name}</div>
        <div>FARMACIA EXTERNA - COMPROBANTE</div>
        <div style="font-size: 0.8rem;">Doc: ${sale.id}</div>
        <div style="font-size: 0.75rem;">Fecha: ${new Date(sale.date).toLocaleString('es-GT')}</div>
        <div style="font-size: 0.75rem;">Cliente: ${sale.buyerName} (NIT: ${sale.buyerNit})</div>
      </div>
      <table class="items">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: left;">Cant/Item</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${(sale.items || []).map(i => `
            <tr>
              <td>${i.quantity}x ${i.name}</td>
              <td style="text-align: right;">Q${(i.price * i.quantity).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="total">
        <span>TOTAL COBRADO:</span>
        <span>Q${parseFloat(sale.total).toFixed(2)}</span>
      </div>
      <div class="footer">
        <div>¡Gracias por su compra!</div>
        <div>LUGAMED 2.0 - Hospital Privado Multimédica</div>
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
    </html>
  `);
  w.document.close();
}
