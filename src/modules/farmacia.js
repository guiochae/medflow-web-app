// src/modules/farmacia.js
import { getAppState, saveAppState, hashPassword, isAdminUser } from '../main.js';
import logoUrl from '../assets/logo.jpg';

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

let activeFarmaciaTab = 'tab-dispense-recipes'; // 'tab-dispense-recipes' | 'tab-external-sale' | 'tab-sales-history'
let currentCart = [];
let selectedMedicineForSale = null;

export function renderFarmacia(container) {
  const state = getAppState();

  console.log("Renderizando módulo de Farmacia...");

  // HTML Layout
  container.innerHTML = `
    <div class="module-header">
      <div class="module-title">
        <h1>Módulo de Farmacia</h1>
        <p>Despache recetas emitidas por los médicos y realice ventas directas a compradores externos.</p>
      </div>
    </div>

    <!-- Pestañas internas de Farmacia -->
    <div class="tabs-container" style="display: flex; gap: 10px; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
      <button class="tab-btn active" id="tab-dispense-recipes">📋 Despachar Recetas</button>
      <button class="tab-btn" id="tab-external-sale">🏪 Venta Externa</button>
      <button class="tab-btn" id="tab-sales-history">📜 Historial de Farmacia</button>
      <button class="tab-btn" id="tab-bajas-vencidos">🗑️ Bajas de Vencidos</button>
      <button class="tab-btn" id="tab-demanda-real">📈 Demanda Real</button>
    </div>

    <!-- Contenedor de Alertas de Inventario y Vencimiento -->
    <div id="inventory-alerts-container" style="margin-bottom: 1.5rem; display: none;"></div>

    <div class="glass-card" style="padding: 1.5rem;">
      <!-- PESTAÑA: DESPACHAR RECETAS -->
      <div id="pane-dispense-recipes" class="tab-pane active" style="display: block;">
        <h3 style="margin-bottom: 1rem; color: var(--accent-primary);">Recetas Médicas Cobradas y Pendientes de Despacho</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">
          A continuación se muestran las recetas emitidas en consulta que ya han sido liquidadas. Haga clic en "Despachar" para completar la entrega física de los medicamentos.
        </p>
        
        <div id="pending-recipes-list" style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Listado de recetas pendientes -->
        </div>
      </div>

      <!-- PESTAÑA: VENTA EXTERNA -->
      <div id="pane-external-sale" class="tab-pane" style="display: none;">
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 2rem;">
          <!-- Buscador y Agregador de Productos -->
          <div>
            <h3 style="margin-bottom: 1.25rem; color: var(--accent-secondary);">Buscar y Agregar Medicamentos</h3>
            
            <div class="form-group" style="position: relative; margin-bottom: 1.5rem;">
              <label for="pharmacy-med-search">Buscar Medicamento (Catálogo de Farmacia)</label>
              <input type="text" id="pharmacy-med-search" placeholder="Ej. Acetaminofén, Amoxicilina..." autocomplete="off">
              <div id="pharmacy-autocomplete-list" style="
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-sm);
                z-index: 10;
                display: none;
                max-height: 200px;
                overflow-y: auto;
                box-shadow: var(--shadow-lg);
              "></div>
            </div>

            <!-- Previsualización del Item Seleccionado -->
            <div id="pharmacy-selection-preview" style="
              display: none; 
              background: rgba(0, 242, 254, 0.03); 
              border: 1px solid rgba(0, 242, 254, 0.2); 
              border-radius: var(--radius-md); 
              padding: 1.25rem; 
              margin-bottom: 1.5rem;
            ">
              <h4 id="prev-med-name" style="color: var(--accent-primary); margin-bottom: 5px;">Medicamento</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">
                Genérico: <span id="prev-med-generic">--</span> | Presentación: <span id="prev-med-presentation">--</span>
              </p>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 15px;">
                🩺 Existencias: <strong id="prev-med-stock" style="color: var(--accent-success);">--</strong>
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
                  <label id="lbl-prev-price-title">Precio Unitario</label>
                  <strong style="color: var(--accent-success); font-size: 1.2rem; display: block; margin-top: 5px;" id="prev-med-price">Q0.00</strong>
                </div>
                <button type="button" class="btn btn-success" id="btn-add-to-cart" style="height: 38px; display: flex; align-items: center; gap: 5px;">
                  <span>🛒</span> Agregar
                </button>
              </div>
            </div>

            <!-- Datos del Comprador Externo -->
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

          <!-- Carrito de Compras de Venta Externa -->
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
                <tbody id="cart-table-body" style="font-size: 0.85rem;">
                  <!-- Items agregados al carrito -->
                </tbody>
              </table>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.15); border-radius: var(--radius-sm); margin-bottom: 1.5rem;">
              <span style="font-weight: 600;">Total a Cobrar:</span>
              <strong style="color: var(--accent-success); font-size: 1.4rem;" id="cart-total-display">Q0.00</strong>
            </div>

            <button class="btn btn-primary" id="btn-finalize-sale" style="width: 100%; padding: 12px; font-size: 1.05rem;">
              <span>⚡</span> Confirmar Venta e Imprimir Comprobante
            </button>
          </div>
        </div>
      </div>

      <!-- PESTAÑA: HISTORIAL -->
      <div id="pane-sales-history" class="tab-pane" style="display: none;">
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 2rem;">
          <!-- Despachos Realizados -->
          <div>
            <h3 style="margin-bottom: 1.25rem; color: var(--accent-primary);">Recetas Médicas Despachadas</h3>
            <div id="dispensed-recipes-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 450px; overflow-y: auto; padding-right: 5px;">
              <!-- Se listan las recetas despachadas -->
            </div>
          </div>

          <!-- Ventas Externas -->
          <div>
            <h3 style="margin-bottom: 1.25rem; color: var(--accent-secondary);">Historial de Ventas Externas</h3>
            <div id="external-sales-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 450px; overflow-y: auto; padding-right: 5px;">
              <!-- Se listan las ventas externas -->
            </div>
          </div>
        </div>
      </div>

      <!-- PESTAÑA: DEMANDA REAL -->
      <div id="pane-demanda-real" class="tab-pane" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div>
            <h3 style="color: var(--accent-primary); margin-bottom: 0.25rem;">Demanda Real de Medicamentos</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">
              Registro de medicamentos recetados por médicos que no se encuentran en el Catálogo de Farmacia.
            </p>
          </div>
          <button class="btn btn-secondary" id="btn-print-demanda-real" style="display: flex; align-items: center; gap: 6px;">
            🖨️ Exportar / Imprimir Reporte
          </button>
        </div>

        <!-- Panel de Estadísticas (Aesthetic Cards) -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 1.5rem;">
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-primary); display: flex; flex-direction: column; gap: 4px; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Medicamentos Solicitados</span>
            <strong style="font-size: 1.6rem; color: var(--text-primary);" id="dr-stat-unique-meds">0</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Nombres distintos recetados</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-secondary); display: flex; flex-direction: column; gap: 4px; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Total Recetas Afectadas</span>
            <strong style="font-size: 1.6rem; color: var(--text-primary);" id="dr-stat-total-records">0</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Solicitudes registradas en recetario</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-success); display: flex; flex-direction: column; gap: 4px; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Medicamento Más Solicitado</span>
            <strong style="font-size: 1.1rem; color: var(--text-primary); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;" id="dr-stat-top-med">Ninguno</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);" id="dr-stat-top-med-qty">0 unidades acumuladas</span>
          </div>
        </div>

        <div style="margin-bottom: 1rem; display: flex; gap: 10px;">
          <input type="text" id="dr-search" placeholder="Buscar medicamento o médico..." style="flex: 1; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
        </div>

        <!-- Tabla de Datos -->
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
            <tbody id="dr-table-body">
              <!-- Creado por JS -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- PESTAÑA: BAJAS DE MEDICAMENTOS VENCIDOS -->
      <div id="pane-bajas-vencidos" class="tab-pane" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="color: var(--accent-danger); margin-bottom: 0.25rem; display: flex; align-items: center; gap: 8px;">
              <span>🗑️</span> Control y Bajas de Medicamentos Vencidos
            </h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">
              Gestión de caducidades, descarte de existencias vencidas y actas oficiales de destrucción autorizadas por el Administrador Maestro.
            </p>
          </div>
          <button class="btn btn-secondary" id="btn-print-bajas-report" style="display: flex; align-items: center; gap: 6px;">
            🖨️ Exportar / Imprimir Reporte de Bajas
          </button>
        </div>

        <!-- Panel de Métricas / KPIs de Caducidad -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 1.5rem;">
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-danger); display: flex; flex-direction: column; gap: 4px; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Medicamentos Caducados</span>
            <strong style="font-size: 1.6rem; color: var(--accent-danger);" id="baja-stat-expired-count">0</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Con existencias en inventario</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-warning); display: flex; flex-direction: column; gap: 4px; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Unidades Físicas Vencidas</span>
            <strong style="font-size: 1.6rem; color: var(--accent-warning);" id="baja-stat-expired-units">0</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Pendientes de descarte</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid #ec4899; display: flex; flex-direction: column; gap: 4px; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Pérdida Económica Pendiente</span>
            <strong style="font-size: 1.4rem; color: #f472b6;" id="baja-stat-loss-total">Q0.00</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Valor de productos caducados</span>
          </div>
          <div class="glass-card" style="padding: 1rem; border-top: 3px solid var(--accent-success); display: flex; flex-direction: column; gap: 4px; background: rgba(30, 41, 59, 0.4);">
            <span style="font-size: 0.8rem; color: var(--text-muted);">Actas Procesadas</span>
            <strong style="font-size: 1.6rem; color: var(--accent-success);" id="baja-stat-actas-count">0</strong>
            <span style="font-size: 0.72rem; color: var(--text-muted);">Bajas autorizadas</span>
          </div>
        </div>

        <!-- SECCIÓN 1: MEDICAMENTOS VENCIDOS PENDIENTES DE BAJA -->
        <div style="margin-bottom: 2rem;">
          <h4 style="color: var(--text-primary); margin-bottom: 0.75rem; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
            <span>⚠️</span> Medicamentos Vencidos en Inventario (Pendientes de Autorización)
          </h4>
          <div style="margin-bottom: 10px;">
            <input type="text" id="bajas-vencidos-search" placeholder="🔍 Buscar en medicamentos vencidos..." style="width: 100%; max-width: 400px; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
          </div>
          <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(0,0,0,0.15);">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;" id="table-vencidos-pendientes">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); background: rgba(255,255,255,0.03); color: var(--text-muted);">
                  <th style="padding: 10px;">Medicamento / Genérico</th>
                  <th style="padding: 10px;">Lote</th>
                  <th style="padding: 10px;">Fecha Vencimiento</th>
                  <th style="padding: 10px;">Estado Caducidad</th>
                  <th style="padding: 10px; text-align: right;">Existencias Vencidas</th>
                  <th style="padding: 10px; text-align: right;">Pérdida Estimada</th>
                  <th style="padding: 10px; text-align: center;">Acción Requerida</th>
                </tr>
              </thead>
              <tbody id="vencidos-pendientes-tbody">
                <!-- Se inyecta con JS -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- SECCIÓN 2: HISTORIAL DE ACTAS DE BAJA Y DESTRUCCIÓN -->
        <div>
          <h4 style="color: var(--text-primary); margin-bottom: 0.75rem; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
            <span>📜</span> Historial de Actas de Baja y Destrucción Autorizadas
          </h4>
          <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(0,0,0,0.15);">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;" id="table-actas-historial">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); background: rgba(255,255,255,0.03); color: var(--text-muted);">
                  <th style="padding: 10px;">Folio / Acta</th>
                  <th style="padding: 10px;">Fecha y Hora</th>
                  <th style="padding: 10px;">Medicamento y Lote</th>
                  <th style="padding: 10px; text-align: right;">Cantidad Descartada</th>
                  <th style="padding: 10px; text-align: right;">Pérdida Total</th>
                  <th style="padding: 10px;">Solicitó</th>
                  <th style="padding: 10px;">Autorizado Por</th>
                  <th style="padding: 10px; text-align: center;">Acta Oficial</th>
                </tr>
              </thead>
              <tbody id="actas-historial-tbody">
                <!-- Se inyecta con JS -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render inicial de la pestaña activa
  refreshActiveTab();

  // ==========================================
  // DELEGACIÓN ENCAPSULADA DE EVENTOS (CONTAINER)
  // ==========================================

  // 1. Clics en la pestaña principal
  if (!container.dataset.farmaciaListenersInitialized) {
    container.dataset.farmaciaListenersInitialized = 'true';
    container.addEventListener('click', (e) => {
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

    // Botón Despachar Receta
    const btnDispense = e.target.closest('.btn-dispense-recipe');
    if (btnDispense) {
      e.preventDefault();
      const recipeId = btnDispense.getAttribute('data-recipe-id');
      const patientId = btnDispense.getAttribute('data-patient-id');
      dispenseRecipe(patientId, recipeId);
      return;
    }

    // Botón Agregar al Carrito (Venta Externa)
    const btnAddToCart = e.target.closest('#btn-add-to-cart');
    if (btnAddToCart) {
      e.preventDefault();
      addToCart();
      return;
    }

    // Botón Vaciar Carrito
    const btnClearCart = e.target.closest('#btn-clear-cart');
    if (btnClearCart) {
      e.preventDefault();
      currentCart = [];
      renderCartTable();
      return;
    }

    // Botón Quitar del Carrito
    const btnRemoveCartItem = e.target.closest('.btn-remove-cart-item');
    if (btnRemoveCartItem) {
      e.preventDefault();
      const idx = parseInt(btnRemoveCartItem.getAttribute('data-index'));
      currentCart.splice(idx, 1);
      renderCartTable();
      return;
    }

    // Botón Finalizar Venta Externa
    const btnFinalizeSale = e.target.closest('#btn-finalize-sale');
    if (btnFinalizeSale) {
      e.preventDefault();
      finalizeExternalSale();
      return;
    }

    // Botón Re-Imprimir Venta Externa
    const btnReprintSale = e.target.closest('.btn-reprint-sale');
    if (btnReprintSale) {
      e.preventDefault();
      const saleId = btnReprintSale.getAttribute('data-id');
      const stateObj = getAppState();
      const sale = (stateObj.externalSales || []).find(s => s.id === saleId);
      if (sale) {
        printSalesVoucher(sale);
      }
      return;
    }

    // Botón Solicitar Baja de Medicamento Vencido
    const btnBaja = e.target.closest('.btn-trigger-baja-direct');
    if (btnBaja) {
      e.preventDefault();
      const medId = btnBaja.getAttribute('data-med-id');
      showBajaVencidoModal(medId);
      return;
    }

    // Botón Imprimir Acta de Baja
    const btnPrintActa = e.target.closest('.btn-print-baja-acta');
    if (btnPrintActa) {
      e.preventDefault();
      const actaId = btnPrintActa.getAttribute('data-acta-id');
      const stateObj = getAppState();
      const acta = (stateObj.bajasInventario || []).find(b => b.id === actaId);
      if (acta) {
        printActaBajaVencido(acta);
      }
      return;
    }

    // Botón Imprimir Reporte General de Bajas
    const btnPrintReport = e.target.closest('#btn-print-bajas-report');
    if (btnPrintReport) {
      e.preventDefault();
      printBajasSummaryReport();
      return;
    }
  });

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
}

  // 2. Eventos de entrada de texto (Buscador Autocomplete)
  const medSearchInput = document.getElementById('pharmacy-med-search');
  if (medSearchInput) {
    medSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const autocompleteList = document.getElementById('pharmacy-autocomplete-list');
      if (!autocompleteList) return;

      autocompleteList.innerHTML = '';
      if (query.trim().length < 2) {
        autocompleteList.style.display = 'none';
        return;
      }

      const appState = getAppState();
      const medications = appState.medications || [];

      const matches = medications.filter(m => {
        const nameMatch = m.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query);
        const genericMatch = (m.generic || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(query);
        return nameMatch || genericMatch;
      });

      if (matches.length === 0) {
        autocompleteList.innerHTML = `
          <div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; font-style: italic;">
            Medicamento no encontrado en el catálogo de Farmacia.
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
          transition: background-color 0.2s;
        `;
        const enrichedMatch = enrichMedication(match);
        const friendlyStock = formatStockFriendly(
          enrichedMatch.stock,
          enrichedMatch.unidades_por_presentacion,
          enrichedMatch.presentation,
          enrichedMatch.unidad_dispensable
        );

        item.innerHTML = `
          <strong style="color: var(--accent-primary);">${match.name}</strong> 
          <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 5px;">(${match.generic} - ${match.presentation})</span><br>
          <span style="font-size: 0.72rem; color: var(--text-muted);">Stock: ${friendlyStock}</span>
          <strong style="color: var(--accent-success); float: right; margin-top: -10px;">Q${parseFloat(match.price).toFixed(2)}</strong>
        `;

        item.addEventListener('mouseover', () => {
          item.style.backgroundColor = 'rgba(0, 242, 254, 0.08)';
        });
        item.addEventListener('mouseout', () => {
          item.style.backgroundColor = 'transparent';
        });

        item.addEventListener('click', () => {
          selectedMedicineForSale = enrichedMatch;
          
          document.getElementById('prev-med-name').textContent = match.name;
          document.getElementById('prev-med-generic').textContent = match.generic || 'N/D';
          document.getElementById('prev-med-presentation').textContent = match.presentation || 'N/D';
          document.getElementById('prev-med-stock').textContent = friendlyStock;

          // Restablecer valores por defecto del tipo de venta
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

    // Cerrar autocomplete si se hace clic fuera del input
    document.addEventListener('click', (e) => {
      const autocompleteList = document.getElementById('pharmacy-autocomplete-list');
      if (autocompleteList && e.target !== medSearchInput) {
        autocompleteList.style.display = 'none';
      }
    });
  }
}

function refreshActiveTab() {
  renderInventoryAlerts();
  if (activeFarmaciaTab === 'tab-dispense-recipes') {
    renderPendingRecipes();
  } else if (activeFarmaciaTab === 'tab-external-sale') {
    renderCartTable();
  } else if (activeFarmaciaTab === 'tab-sales-history') {
    renderSalesHistory();
  } else if (activeFarmaciaTab === 'tab-bajas-vencidos') {
    renderBajasVencidosTab();
  } else if (activeFarmaciaTab === 'tab-demanda-real') {
    renderDemandaReal();
  }
}

// 1. RENDERIZAR RECETAS PENDIENTES DE DESPACHO
function renderPendingRecipes() {
  const listContainer = document.getElementById('pending-recipes-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  const state = getAppState();
  const patients = state.patients || [];
  const pending = [];

  patients.forEach(p => {
    if (p.prescriptions) {
      p.prescriptions.forEach(r => {
        if (!r.dispenseStatus) r.dispenseStatus = 'Pendiente';
        if (r.dispenseStatus === 'Pendiente') {
          pending.push({
            patientId: p.id,
            patientName: p.name,
            patientNit: p.nit || 'CF',
            recipe: r
          });
        }
      });
    }
  });

  if (pending.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
        <span style="font-size: 3rem; display: block; margin-bottom: 10px;">✅</span>
        No hay recetas pendientes de despacho en este momento. Todas las recetas emitidas han sido entregadas.
      </div>
    `;
    return;
  }

  // Ordenar recetas por fecha descendente
  pending.sort((a, b) => new Date(b.recipe.date) - new Date(a.recipe.date));

  pending.forEach(item => {
    // Buscar cobro correspondiente al billId o fecha
    const stateObj = getAppState();
    const patientObj = stateObj.patients.find(p => p.id === item.patientId);
    const billingHistory = patientObj.billingHistory || [];
    
    // Buscar coincidencia por billId, por medicamento en el desglose, o por fecha de la factura
    const bill = billingHistory.find(b => b.id === item.recipe.billId) ||
                 billingHistory.find(b => (b.details || []).some(d => (item.recipe.medicines || []).some(m => d.description.includes(m.name)))) ||
                 billingHistory.find(b => b.date.substring(0, 10) === item.recipe.date.substring(0, 10));

    // Por defecto asumimos Pagado si no hay cobro registrado (para compatibilidad de datos mock anteriores),
    // pero si hay un cobro pendiente, bloqueamos el despacho.
    // Los medicamentos de Hospitalización/Encamamiento se despachan sin requerir pago previo.
    let isPaid = true;
    const isHospitalization = item.recipe.isHospitalization === true;
    if (isHospitalization) {
      isPaid = true;
    } else if (bill) {
      isPaid = (bill.status === 'Pagado');
    }

    let statusBadge = '';
    let actionButton = '';

    if (isHospitalization) {
      statusBadge = `<span class="badge" style="background: rgba(33, 150, 243, 0.15); color: #2196f3; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; display: inline-block; margin-top: 5px;">🏥 Encamamiento (Despacho Autorizado)</span>`;
      actionButton = `
        <button class="btn btn-success btn-dispense-recipe" data-patient-id="${item.patientId}" data-recipe-id="${item.recipe.id}">
          <span>📦</span> Despachar Medicamentos
        </button>
      `;
    } else if (isPaid) {
      statusBadge = `<span class="badge" style="background: rgba(76, 175, 80, 0.15); color: #4caf50; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; display: inline-block; margin-top: 5px;">✅ Pago Confirmado (Liquidada en Caja)</span>`;
      actionButton = `
        <button class="btn btn-success btn-dispense-recipe" data-patient-id="${item.patientId}" data-recipe-id="${item.recipe.id}">
          <span>📦</span> Despachar Medicamentos
        </button>
      `;
    } else {
      statusBadge = `<span class="badge" style="background: rgba(255, 152, 0, 0.15); color: #ff9800; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; display: inline-block; margin-top: 5px;">⚠️ Pago Pendiente (Debe cobrar en caja)</span>`;
      actionButton = `
        <button class="btn btn-secondary btn-dispense-recipe" disabled style="opacity: 0.5; cursor: not-allowed; display: flex; align-items: center; gap: 5px;" title="Esta receta no ha sido cobrada en la sección de Preconsulta -> Facturación.">
          <span>🔒</span> Despachar Bloqueado
        </button>
      `;
    }

    const card = document.createElement('div');
    card.className = 'glass-card';
    card.style.cssText = `
      padding: 1.25rem;
      border: 1px solid var(--border-color);
      border-left: 4px solid ${isPaid ? 'var(--accent-success)' : 'var(--accent-warning)'};
      background: rgba(255, 255, 255, 0.01);
    `;

    const medsListHtml = item.recipe.medicines.map(m => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
        <td style="padding: 6px 0;"><strong>${m.name}</strong> <span style="font-size: 0.8rem; color: var(--text-muted);">(${m.presentation})</span></td>
        <td style="padding: 6px 0; text-align: center; font-weight: bold; color: var(--accent-primary);">${m.quantity}</td>
        <td style="padding: 6px 0; color: var(--text-muted); font-size: 0.85rem;">Dosis: ${m.dosage || 'Indeterminada'} | Duración: ${m.duration || 'N/A'}</td>
      </tr>
    `).join('');

    const dateFormatted = new Date(item.recipe.date).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem;">
        <div>
          <span style="font-size: 0.8rem; color: var(--accent-primary); text-transform: uppercase; font-weight: 600;">Paciente</span>
          <h4 style="color: var(--text-primary); margin-top: 2px;">${item.patientName} <span style="font-size: 0.85rem; font-weight: normal; color: var(--text-muted);">(NIT: ${item.patientNit})</span></h4>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
            Recetado por: <strong>Dr. ${item.recipe.doctorName}</strong> (Col. ${item.recipe.doctorLicense}) | Emitida: <strong>${dateFormatted}</strong>
          </p>
          ${statusBadge}
        </div>
        ${actionButton}
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 10px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="color: var(--text-muted); font-size: 0.75rem; border-bottom: 1px solid var(--border-color);">
              <th style="padding-bottom: 4px;">Medicamento</th>
              <th style="padding-bottom: 4px; text-align: center; width: 80px;">Cantidad</th>
              <th style="padding-bottom: 4px;">Instrucciones de Toma</th>
            </tr>
          </thead>
          <tbody>
            ${medsListHtml}
          </tbody>
        </table>
      </div>

      ${item.recipe.indications ? `
        <div style="margin-top: 10px; padding: 8px 12px; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); border-radius: 4px; font-size: 0.85rem;">
          <strong>Notas del Médico:</strong> ${item.recipe.indications}
        </div>
      ` : ''}
    `;

    listContainer.appendChild(card);
  });
}

function dispenseRecipe(patientId, recipeId) {
  const stateObj = getAppState();
  const patientObj = stateObj.patients.find(p => p.id === patientId);
  if (!patientObj) return;

  const recipeObj = patientObj.prescriptions.find(r => r.id === recipeId);
  if (!recipeObj) return;

  // Validar existencias antes de despachar
  let insufficientStock = [];
  recipeObj.medicines.forEach(m => {
    const catalogItem = stateObj.medications && stateObj.medications.find(med => med.name === m.name);
    if (catalogItem) {
      const enrichedCatalog = enrichMedication(catalogItem);
      const currentStock = enrichedCatalog.stock !== undefined ? enrichedCatalog.stock : 120;
      
      let requestedUnits = parseInt(m.qty);
      if (m.qty === undefined || isNaN(requestedUnits)) {
        const qtyParsed = parseInt(m.quantity) || 1;
        if (m.quantity.toLowerCase().includes('caja')) {
          requestedUnits = qtyParsed * enrichedCatalog.unidades_por_presentacion;
        } else {
          requestedUnits = qtyParsed;
        }
      }

      if (currentStock < requestedUnits) {
        const friendlyStock = formatStockFriendly(currentStock, enrichedCatalog.unidades_por_presentacion, enrichedCatalog.presentation, enrichedCatalog.unidad_dispensable);
        const requestedFriendly = m.quantity || `${requestedUnits} unidades`;
        insufficientStock.push(`${m.name} (Stock: ${friendlyStock}, Solicitado: ${requestedFriendly})`);
      }
    }
  });

  if (insufficientStock.length > 0) {
    alert(`❌ NOTIFICACIÓN DE INVENTARIO:\nNo se puede despachar la receta porque no hay existencias suficientes para los siguientes medicamentos:\n\n- ${insufficientStock.join('\n- ')}`);
    return;
  }

  // Reducir stock de medicamentos
  recipeObj.medicines.forEach(m => {
    const catalogItem = stateObj.medications && stateObj.medications.find(med => med.name === m.name);
    if (catalogItem) {
      const enrichedCatalog = enrichMedication(catalogItem);
      let requestedUnits = parseInt(m.qty);
      if (m.qty === undefined || isNaN(requestedUnits)) {
        const qtyParsed = parseInt(m.quantity) || 1;
        if (m.quantity.toLowerCase().includes('caja')) {
          requestedUnits = qtyParsed * enrichedCatalog.unidades_por_presentacion;
        } else {
          requestedUnits = qtyParsed;
        }
      }
      catalogItem.stock = Math.max(0, (catalogItem.stock !== undefined ? catalogItem.stock : 120) - requestedUnits);
    }
  });

  recipeObj.dispenseStatus = 'Despachado';
  recipeObj.dispenseDate = new Date().toISOString();

  saveAppState(stateObj);
  alert("🎉 Medicamentos despachados correctamente y existencias reducidas en el inventario.");
  refreshActiveTab();
}

// 3. RENDERIZAR TABLA DEL CARRITO (VENTA EXTERNA)
function renderCartTable() {
  const tbody = document.getElementById('cart-table-body');
  const totalDisplay = document.getElementById('cart-total-display');
  if (!tbody || !totalDisplay) return;

  tbody.innerHTML = '';
  let total = 0;

  if (currentCart.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          El carrito está vacío. Busque y agregue medicamentos.
        </td>
      </tr>
    `;
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

// 4. AGREGAR MEDICAMENTO AL CARRITO
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

  const saleTypeSelect = document.getElementById('pharmacy-sale-type');
  const saleType = saleTypeSelect ? saleTypeSelect.value : 'presentacion';

  const m = enrichMedication(selectedMedicineForSale);
  const currentStock = m.stock !== undefined ? m.stock : 120;
  if (currentStock <= 0) {
    alert(`❌ NOTIFICACIÓN DE INVENTARIO:\nNo se puede vender el medicamento "${m.name}" porque su existencia es igual a cero.`);
    return;
  }

  // Calcular las unidades totales solicitadas
  let totalUnitsToAdd = qty;
  if (saleType === 'presentacion') {
    totalUnitsToAdd = qty * m.unidades_por_presentacion;
  }

  // Calcular cantidad acumulada ya en el carrito para este medicamento (en unidades mínimas)
  const existingUnitsInCart = currentCart
    .filter(item => item.id === m.id)
    .reduce((sum, item) => sum + (item.unidades_totales || item.quantity), 0);

  if (existingUnitsInCart + totalUnitsToAdd > currentStock) {
    const friendlyStock = formatStockFriendly(currentStock, m.unidades_por_presentacion, m.presentation, m.unidad_dispensable);
    const requestedFriendly = saleType === 'presentacion' 
      ? `${qty} ${m.presentation || 'Caja'}(s) (${totalUnitsToAdd} unidades)` 
      : `${qty} ${m.unidad_dispensable || 'Tableta'}(s)`;
    
    alert(`❌ NOTIFICACIÓN DE INVENTARIO:\nNo hay suficientes existencias disponibles de "${m.name}".\n\nStock disponible: ${friendlyStock}\nEn carrito (equivalente): ${existingUnitsInCart} unidades\nSolicitado ahora: ${requestedFriendly}`);
    return;
  }

  const itemPrice = saleType === 'presentacion' ? m.precio_presentacion : m.precio_unitario;
  const displayQty = saleType === 'presentacion' 
    ? `${qty} ${m.presentation || 'caja'}(s)` 
    : `${qty} ${m.unidad_dispensable || 'tableta'}(s)`;

  // Consolidar si coincide el mismo ID y mismo tipo de venta
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

  // Limpiar selección
  selectedMedicineForSale = null;
  document.getElementById('pharmacy-selection-preview').style.display = 'none';
  document.getElementById('pharmacy-med-search').value = '';
  
  renderCartTable();
}

// 5. REGISTRAR Y COBRAR VENTA EXTERNA
function finalizeExternalSale() {
  if (currentCart.length === 0) {
    alert("El carrito está vacío. Agregue medicamentos para registrar la venta.");
    return;
  }

  const buyerNit = document.getElementById('buyer-nit').value.trim() || 'CF';
  const buyerName = document.getElementById('buyer-name').value.trim() || 'Consumidor Final';

  const appState = getAppState();
  appState.externalSales = appState.externalSales || [];

  let total = 0;
  currentCart.forEach(item => {
    total += item.price * item.quantity;
  });

  const newSale = {
    id: 'FAC-EXT-' + Date.now(),
    date: new Date().toISOString(),
    buyerName,
    buyerNit,
    items: [...currentCart],
    total
  };

  // Reducir stock del inventario (usando unidades base totales de cada ítem en el carrito)
  currentCart.forEach(cartItem => {
    const catalogItem = appState.medications && appState.medications.find(m => m.id === cartItem.id || m.name === cartItem.name);
    if (catalogItem) {
      const unitsToDeduct = cartItem.unidades_totales !== undefined ? cartItem.unidades_totales : cartItem.quantity;
      catalogItem.stock = Math.max(0, (catalogItem.stock !== undefined ? catalogItem.stock : 120) - unitsToDeduct);
    }
  });

  appState.externalSales.unshift(newSale);
  saveAppState(appState);

  // Imprimir comprobante
  printSalesVoucher(newSale);

  // Limpiar carrito y campos
  currentCart = [];
  document.getElementById('buyer-nit').value = 'CF';
  document.getElementById('buyer-name').value = 'Consumidor Final';
  renderCartTable();

  alert("🎉 Venta externa registrada exitosamente. Se ha abierto el comprobante para impresión.");
}

// 6. RENDERIZAR HISTORIAL DE FARMACIA (RECETAS Y VENTAS)
function renderSalesHistory() {
  const dispensedRecipesContainer = document.getElementById('dispensed-recipes-list');
  const externalSalesContainer = document.getElementById('external-sales-list');

  if (dispensedRecipesContainer) {
    dispensedRecipesContainer.innerHTML = '';
    const state = getAppState();
    const patients = state.patients || [];
    const dispensed = [];

    patients.forEach(p => {
      if (p.prescriptions) {
        p.prescriptions.forEach(r => {
          if (r.dispenseStatus === 'Despachado') {
            dispensed.push({
              patientName: p.name,
              recipe: r
            });
          }
        });
      }
    });

    if (dispensed.length === 0) {
      dispensedRecipesContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No hay despachos de recetas registrados</div>`;
    } else {
      dispensed.sort((a, b) => new Date(b.recipe.dispenseDate) - new Date(a.recipe.dispenseDate));
      dispensed.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-card';
        div.style.cssText = `background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px; font-size: 0.85rem;`;
        
        const meds = item.recipe.medicines.map(m => `${m.name} (x${m.quantity})`).join(', ');
        const dateFormatted = new Date(item.recipe.dispenseDate).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });

        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-weight: 600;">
            <span>${item.patientName}</span>
            <span style="color: var(--accent-success);">Entregado</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
            Fecha de Entrega: <strong>${dateFormatted}</strong> | Médico: Dr. ${item.recipe.doctorName}
          </div>
          <div style="font-size: 0.8rem; margin-top: 6px; color: var(--text-primary); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;">
            <strong>Meds:</strong> ${meds}
          </div>
        `;
        dispensedRecipesContainer.appendChild(div);
      });
    }
  }

  if (externalSalesContainer) {
    externalSalesContainer.innerHTML = '';
    const state = getAppState();
    const sales = state.externalSales || [];

    if (sales.length === 0) {
      externalSalesContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No hay ventas externas registradas</div>`;
    } else {
      sales.forEach(sale => {
        const div = document.createElement('div');
        div.className = 'history-card';
        div.style.cssText = `background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); padding: 10px; font-size: 0.85rem;`;
        
        const meds = sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ');
        const dateFormatted = new Date(sale.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });

        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-weight: 600; align-items: center;">
            <span>${sale.buyerName}</span>
            <strong style="color: var(--accent-success);">Q${parseFloat(sale.total).toFixed(2)}</strong>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span>Doc: ${sale.id} | Fecha: ${dateFormatted}</span>
            <button class="btn btn-secondary btn-small btn-reprint-sale" data-id="${sale.id}" style="padding: 2px 6px; font-size: 0.75rem;">🖨️ Re-imprimir</button>
          </div>
          <div style="font-size: 0.8rem; margin-top: 6px; color: var(--text-primary); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;">
            <strong>Meds:</strong> ${meds}
          </div>
        `;
        externalSalesContainer.appendChild(div);
      });
    }
  }
}

// 7. IMPRIMIR COMPROBANTE DE VENTA EXTERNA (POS PRINT)
function printSalesVoucher(sale) {
  const state = getAppState();
  const clinic = state.clinicInfo;
  const dateFormatted = new Date(sale.date).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });

  const printWindow = window.open('', '_blank');
  
  const logoHtml = clinic.logoData 
    ? `<img src="${clinic.logoData}" style="max-height: 60px; max-width: 140px; object-fit: contain; margin-bottom: 10px;">` 
    : `<span style="font-size: 2.5rem; display: block; margin-bottom: 5px;">🏥</span>`;

  const detailsRows = sale.items.map(item => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <strong>${item.name}</strong><br>
        <span style="font-size: 0.75rem; color: #666;">${item.generic} (${item.presentation})</span>
      </td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">${item.displayQuantity || item.quantity}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">Q ${parseFloat(item.price).toFixed(2)}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">Q ${parseFloat(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Comprobante de Venta - ${sale.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            color: #333;
            margin: 0;
            padding: 20px;
            background: #fff;
          }
          .ticket-container {
            max-width: 480px;
            margin: 0 auto;
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .header-box {
            text-align: center;
            border-bottom: 2px dashed #ddd;
            padding-bottom: 15px;
            margin-bottom: 15px;
          }
          .clinic-name {
            font-size: 1.25rem;
            font-weight: 700;
            margin: 0 0 5px 0;
            color: #111;
          }
          .clinic-details {
            font-size: 0.8rem;
            color: #666;
            margin: 0;
            line-height: 1.4;
          }
          .title-tag {
            background: #000;
            color: #fff;
            display: inline-block;
            padding: 4px 10px;
            font-size: 0.75rem;
            text-transform: uppercase;
            font-weight: 600;
            border-radius: 4px;
            margin-top: 10px;
          }
          .sale-meta {
            font-size: 0.8rem;
            color: #444;
            margin-bottom: 15px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
          }
          .table-title {
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 4px;
            margin-bottom: 5px;
          }
          .total-box {
            border-top: 2px double #333;
            margin-top: 15px;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .footer-box {
            text-align: center;
            font-size: 0.75rem;
            color: #888;
            margin-top: 25px;
            border-top: 1px dashed #ddd;
            padding-top: 15px;
          }
          @media print {
            body { padding: 0; }
            .ticket-container { border: none; box-shadow: none; max-width: 100%; }
            .btn-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="ticket-container">
          <div class="header-box">
            ${logoHtml}
            <h1 class="clinic-name">${clinic.name || 'MEDFLOW CLINIC'}</h1>
            <p class="clinic-details">
              ${clinic.address || ''}<br>
              Teléfono: ${clinic.phone || ''}<br>
              ${clinic.email || ''}
            </p>
            <div class="title-tag">Comprobante de Venta (Farmacia)</div>
          </div>

          <div class="sale-meta">
            <div><strong>Nro. Venta:</strong> ${sale.id}</div>
            <div><strong>Fecha:</strong> ${dateFormatted}</div>
            <div><strong>Cliente:</strong> ${sale.buyerName}</div>
            <div><strong>NIT:</strong> ${sale.buyerNit}</div>
          </div>

          <div class="table-title">Medicamentos</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid #ddd; font-weight: 600; color: #555;">
                <th style="padding: 5px 0; text-align: left;">Detalle</th>
                <th style="padding: 5px 0; text-align: center; width: 40px;">Cant.</th>
                <th style="padding: 5px 0; text-align: right; width: 85px;">P. Unit</th>
                <th style="padding: 5px 0; text-align: right; width: 85px;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${detailsRows}
            </tbody>
          </table>

          <div class="total-box">
            <span style="font-weight: 600; font-size: 1rem; text-transform: uppercase;">Total General:</span>
            <strong style="font-size: 1.3rem;">Q ${parseFloat(sale.total).toFixed(2)}</strong>
          </div>

          <div class="footer-box">
            <p style="margin: 0; font-weight: 600;">¡Gracias por su preferencia!</p>
            <p style="margin: 5px 0 0 0;">LUGAMED 2.0 - Gestión de Consultorio Médica</p>
          </div>

          <div style="text-align: center; margin-top: 20px;" class="btn-print">
            <button onclick="window.print()" style="
              padding: 10px 20px;
              background: #000;
              color: #fff;
              border: none;
              font-family: inherit;
              font-weight: 600;
              border-radius: 4px;
              cursor: pointer;
            ">🖨️ Imprimir Comprobante</button>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// Calcular el consumo mensual de un medicamento (últimos 30 días)
function getMonthlyConsumption(medName, state) {
  let totalUsage = 0;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  // 1. Recetas despachadas
  const patients = state.patients || [];
  patients.forEach(p => {
    if (p.prescriptions) {
      p.prescriptions.forEach(r => {
        if (r.dispenseStatus === 'Despachado' && r.dispenseDate) {
          const dispenseTime = new Date(r.dispenseDate).getTime();
          if (dispenseTime >= thirtyDaysAgo) {
            r.medicines.forEach(m => {
              if (m.name === medName) {
                totalUsage += parseInt(m.quantity) || 1;
              }
            });
          }
        }
      });
    }
  });

  // 2. Ventas externas
  const sales = state.externalSales || [];
  sales.forEach(s => {
    const saleTime = new Date(s.date).getTime();
    if (saleTime >= thirtyDaysAgo) {
      s.items.forEach(item => {
        if (item.name === medName) {
          totalUsage += parseInt(item.quantity) || 1;
        }
      });
    }
  });

  return totalUsage;
}

// Renderizar alertas de vencimiento e inventario
function renderInventoryAlerts() {
  const alertsContainer = document.getElementById('inventory-alerts-container');
  if (!alertsContainer) return;

  const state = getAppState();
  const medications = state.medications || [];
  const today = new Date();
  const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  const expirationAlerts = [];
  const stockAlerts = [];

  medications.forEach(med => {
    // 1. Validación de Vencimientos
    if (med.vencimiento) {
      const expDate = new Date(med.vencimiento);
      const enriched = enrichMedication(med);
      const stockVal = med.stock !== undefined ? med.stock : 120;
      const friendlyStock = formatStockFriendly(stockVal, enriched.unidades_por_presentacion, enriched.presentation, enriched.unidad_dispensable);

      if (expDate < today) {
        expirationAlerts.push({
          type: 'expired',
          medId: med.id,
          text: `🚨 <strong>CADUCADO:</strong> El medicamento "${med.name}" (Lote: ${med.lote || 'N/D'}) venció el ${expDate.toLocaleDateString('es-GT')}. Existencias: ${friendlyStock}.`
        });
      } else if (expDate <= ninetyDaysFromNow) {
        const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        expirationAlerts.push({
          type: 'expiring-soon',
          medId: med.id,
          text: `⚠️ <strong>PRÓXIMO A VENCER:</strong> "${med.name}" (Lote: ${med.lote || 'N/D'}) vence el ${expDate.toLocaleDateString('es-GT')} (en ${daysLeft} días). Existencias: ${friendlyStock}.`
        });
      }
    }

    // 2. Validación de Existencias (Stock Mínimo/Máximo en base a la venta mensual)
    const monthlyUsage = getMonthlyConsumption(med.name, state);
    
    // Si la venta mensual es 0, usamos un estimado por defecto de 10 unidades
    const usageBase = monthlyUsage > 0 ? monthlyUsage : 10;
    const minStock = usageBase;           // 1 mes de existencia
    const maxStock = usageBase * 3;       // 3 meses de existencia
    const currentStock = med.stock !== undefined ? med.stock : 120;

    if (currentStock === 0) {
      stockAlerts.push({
        type: 'out-of-stock',
        text: `❌ <strong>SIN EXISTENCIAS:</strong> "${med.name}" tiene stock de 0. No se puede vender ni despachar.`
      });
    } else if (currentStock < minStock) {
      stockAlerts.push({
        type: 'low-stock',
        text: `⚠️ <strong>STOCK BAJO:</strong> "${med.name}" tiene ${currentStock} unidades. Venta mensual: ${monthlyUsage} unds (mínimo de 1 mes: ${minStock} unds).`
      });
    } else if (currentStock > maxStock) {
      stockAlerts.push({
        type: 'over-stock',
        text: `ℹ️ <strong>SOBRE-EXISTENCIA:</strong> "${med.name}" tiene ${currentStock} unidades. Venta mensual: ${monthlyUsage} unds (máximo de 3 meses: ${maxStock} unds).`
      });
    }
  });

  const allAlerts = [...expirationAlerts, ...stockAlerts];

  if (allAlerts.length === 0) {
    alertsContainer.style.display = 'none';
    alertsContainer.innerHTML = '';
    return;
  }

  alertsContainer.style.display = 'block';
  
  alertsContainer.innerHTML = `
    <div style="
      background: rgba(18, 18, 30, 0.6);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      backdrop-filter: blur(10px);
    ">
      <h3 style="color: var(--accent-primary); font-size: 1rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
        📢 Alertas de Inventario y Caducidad
      </h3>
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; padding-right: 5px;">
        ${allAlerts.map(alert => {
          let bg = 'rgba(255, 255, 255, 0.02)';
          let borderL = '3px solid #ccc';
          let textColor = 'var(--text-primary)';

          if (alert.type === 'expired' || alert.type === 'out-of-stock') {
            bg = 'rgba(244, 67, 54, 0.08)';
            borderL = '3px solid #f44336';
            textColor = '#ff7961';
          } else if (alert.type === 'expiring-soon' || alert.type === 'low-stock') {
            bg = 'rgba(255, 152, 0, 0.08)';
            borderL = '3px solid #ff9800';
            textColor = '#ffb74d';
          } else if (alert.type === 'over-stock') {
            bg = 'rgba(33, 150, 243, 0.08)';
            borderL = '3px solid #2196f3';
            textColor = '#64b5f6';
          }

          return `
            <div style="
              background: ${bg};
              border-left: ${borderL};
              padding: 8px 12px;
              font-size: 0.8rem;
              color: ${textColor};
              border-radius: 2px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 10px;
            ">
              <div style="flex: 1;">${alert.text}</div>
              ${alert.type === 'expired' && alert.medId ? `
                <button type="button" class="btn btn-danger btn-small btn-trigger-baja-direct" data-med-id="${alert.medId}" style="padding: 3px 8px; font-size: 0.72rem; background: #ef4444; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; white-space: nowrap;">
                  🗑️ Dar de Baja
                </button>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// 7. RENDERIZAR REPORTE DE DEMANDA REAL
function renderDemandaReal() {
  const tbody = document.getElementById('dr-table-body');
  if (!tbody) return;

  const state = getAppState();
  const rawList = state.demandaReal || [];

  // 1. Estadísticas
  const uniqueMeds = new Set(rawList.map(r => r.medicineName.toLowerCase().trim())).size;
  const statUnique = document.getElementById('dr-stat-unique-meds');
  const statTotal = document.getElementById('dr-stat-total-records');
  if (statUnique) statUnique.textContent = uniqueMeds;
  if (statTotal) statTotal.textContent = rawList.length;

  // Calcular medicamento más solicitado
  const medCounts = {};
  rawList.forEach(r => {
    const key = r.medicineName;
    medCounts[key] = (medCounts[key] || 0) + (r.quantity || 1);
  });

  let topMed = 'Ninguno';
  let topQty = 0;
  Object.keys(medCounts).forEach(med => {
    if (medCounts[med] > topQty) {
      topQty = medCounts[med];
      topMed = med;
    }
  });
  
  const statTopMed = document.getElementById('dr-stat-top-med');
  const statTopMedQty = document.getElementById('dr-stat-top-med-qty');
  if (statTopMed) statTopMed.textContent = topMed;
  if (statTopMedQty) statTopMedQty.textContent = `${topQty} unidades acumuladas`;

  // 2. Filtro de Búsqueda
  const searchInput = document.getElementById('dr-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = rawList.filter(r => {
    return r.medicineName.toLowerCase().includes(query) ||
           (r.doctorName || '').toLowerCase().includes(query) ||
           (r.patientName || '').toLowerCase().includes(query);
  });

  // Ordenar por fecha descendente
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 20px; text-align: center; color: var(--text-muted);">
          No se encontraron registros de demanda real.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = filtered.map(r => {
      const dateFormatted = new Date(r.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 10px; color: var(--text-muted);">${dateFormatted}</td>
          <td style="padding: 10px; font-weight: bold; color: var(--accent-primary);">${r.medicineName}</td>
          <td style="padding: 10px; text-align: center; font-weight: bold; color: var(--accent-secondary);">${r.quantity}</td>
          <td style="padding: 10px; color: var(--text-primary);">${r.patientName}</td>
          <td style="padding: 10px; color: var(--text-primary); font-style: italic;">Dr/a. ${r.doctorName}</td>
        </tr>
      `;
    }).join('');
  }

  // 3. Registrar eventos para búsqueda e impresión (solo una vez)
  if (searchInput && !searchInput.dataset.listenerInitialized) {
    searchInput.dataset.listenerInitialized = 'true';
    searchInput.addEventListener('input', () => {
      renderDemandaReal();
    });
  }

  const printBtn = document.getElementById('btn-print-demanda-real');
  if (printBtn && !printBtn.dataset.listenerInitialized) {
    printBtn.dataset.listenerInitialized = 'true';
    printBtn.addEventListener('click', () => {
      printDemandaRealReport();
    });
  }
}

// 8. IMPRIMIR REPORTE DE DEMANDA REAL
function printDemandaRealReport() {
  const state = getAppState();
  const rawList = state.demandaReal || [];
  const clinicInfo = state.clinicInfo || { name: 'HOSPITAL MULTIMÉDICA', phone: '31640152', address: 'Guatemala' };

  if (rawList.length === 0) {
    alert("No hay registros en el reporte de Demanda Real para imprimir.");
    return;
  }

  // Ordenar por fecha descendente
  const list = [...rawList].sort((a, b) => new Date(b.date) - new Date(a.date));

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Reporte de Demanda Real - ${clinicInfo.name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #333;
            margin: 30px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #1e3a8a;
            font-size: 1.8rem;
          }
          .header p {
            margin: 5px 0 0 0;
            font-size: 0.9rem;
            color: #666;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            font-size: 0.85rem;
            color: #555;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #f3f4f6;
            border-bottom: 2px solid #d1d5db;
            color: #1f2937;
            font-weight: bold;
            text-align: left;
            padding: 10px;
            font-size: 0.85rem;
          }
          td {
            border-bottom: 1px solid #e5e7eb;
            padding: 10px;
            font-size: 0.85rem;
          }
          tr:nth-child(even) {
            background-color: #fafafa;
          }
          .signatures {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }
          .sig-line {
            width: 40%;
            border-top: 1px solid #333;
            text-align: center;
            padding-top: 5px;
            font-size: 0.85rem;
            margin-top: 40px;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${clinicInfo.name}</h1>
          <p>REPORTE OFICIAL DE DEMANDA REAL DE MEDICAMENTOS</p>
          <p style="font-size: 0.8rem; font-style: italic;">Medicamentos Recetados Fuera de Catálogo de Farmacia</p>
        </div>
        <div class="meta-info">
          <div><strong>Fecha de Generación:</strong> ${new Date().toLocaleString('es-GT')}</div>
          <div><strong>Registros Totales:</strong> ${list.length}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Medicamento Recetado</th>
              <th style="text-align: center;">Cantidad</th>
              <th>Paciente</th>
              <th>Médico Tratante</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(r => `
              <tr>
                <td>${new Date(r.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style="font-weight: bold; color: #1e3a8a;">${r.medicineName}</td>
                <td style="text-align: center; font-weight: bold;">${r.quantity}</td>
                <td>${r.patientName}</td>
                <td>Dr/a. ${r.doctorName}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="signatures">
          <div class="sig-line">
            Firma Encargado de Farmacia
          </div>
          <div class="sig-line">
            Firma Dirección Médica
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// 9. RENDERIZAR PESTAÑA DE BAJAS DE MEDICAMENTOS VENCIDOS
function renderBajasVencidosTab() {
  const state = getAppState();
  const medications = state.medications || [];
  const today = new Date();
  const bajasHistory = state.bajasInventario || [];

  // Filtrar medicamentos caducados (vencimiento anterior a hoy)
  const expiredMeds = medications.filter(m => {
    if (!m.vencimiento) return false;
    const expDate = new Date(m.vencimiento);
    return !isNaN(expDate.getTime()) && expDate < today;
  });

  // Métricas
  const expiredWithStock = expiredMeds.filter(m => (m.stock !== undefined ? m.stock : 120) > 0);
  const totalExpiredUnits = expiredWithStock.reduce((acc, m) => acc + (m.stock !== undefined ? m.stock : 120), 0);
  
  const totalLossQ = expiredWithStock.reduce((acc, m) => {
    const enriched = enrichMedication(m);
    const stockVal = m.stock !== undefined ? m.stock : 120;
    return acc + (stockVal * (enriched.precio_unitario || 0));
  }, 0);

  const statExpiredCount = document.getElementById('baja-stat-expired-count');
  const statExpiredUnits = document.getElementById('baja-stat-expired-units');
  const statLossTotal = document.getElementById('baja-stat-loss-total');
  const statActasCount = document.getElementById('baja-stat-actas-count');

  if (statExpiredCount) statExpiredCount.textContent = expiredWithStock.length;
  if (statExpiredUnits) statExpiredUnits.textContent = totalExpiredUnits;
  if (statLossTotal) statLossTotal.textContent = `Q${totalLossQ.toFixed(2)}`;
  if (statActasCount) statActasCount.textContent = bajasHistory.length;

  // Renderizar Tabla de Vencidos Pendientes de Descarte
  const pendingTbody = document.getElementById('vencidos-pendientes-tbody');
  const searchInput = document.getElementById('bajas-vencidos-search');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (pendingTbody) {
    let filteredExpired = expiredMeds;
    if (query) {
      filteredExpired = filteredExpired.filter(m => 
        (m.name && m.name.toLowerCase().includes(query)) ||
        (m.generic && m.generic.toLowerCase().includes(query)) ||
        (m.lote && m.lote.toLowerCase().includes(query))
      );
    }

    if (filteredExpired.length === 0) {
      pendingTbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 25px; text-align: center; color: var(--accent-success); font-weight: 500;">
            ✅ No hay medicamentos vencidos pendientes de descarte en el inventario.
          </td>
        </tr>
      `;
    } else {
      pendingTbody.innerHTML = filteredExpired.map(m => {
        const enriched = enrichMedication(m);
        const stockVal = m.stock !== undefined ? m.stock : 120;
        const friendlyStock = formatStockFriendly(stockVal, enriched.unidades_por_presentacion, enriched.presentation, enriched.unidad_dispensable);
        const expDate = new Date(m.vencimiento);
        const daysPast = Math.max(1, Math.floor((today - expDate) / (1000 * 60 * 60 * 24)));
        const lossEstimated = (stockVal * (enriched.precio_unitario || 0));

        return `
          <tr style="border-bottom: 1px solid var(--border-color); ${stockVal === 0 ? 'opacity: 0.6;' : ''}">
            <td style="padding: 10px;">
              <strong>${m.name}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${m.generic || 'Sin genérico'} (${m.presentation || 'Caja'})</div>
            </td>
            <td style="padding: 10px; font-family: monospace; font-weight: bold; color: var(--accent-primary);">${m.lote || 'N/D'}</td>
            <td style="padding: 10px; color: var(--accent-danger); font-weight: bold;">${expDate.toLocaleDateString('es-GT')}</td>
            <td style="padding: 10px;">
              <span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">
                🚨 Venció hace ${daysPast} día(s)
              </span>
            </td>
            <td style="padding: 10px; text-align: right; font-weight: bold; color: ${stockVal > 0 ? 'var(--text-primary)' : 'var(--text-muted)'};">
              ${friendlyStock}
            </td>
            <td style="padding: 10px; text-align: right; color: #f472b6; font-weight: bold;">
              Q${lossEstimated.toFixed(2)}
            </td>
            <td style="padding: 10px; text-align: center;">
              <button class="btn btn-danger btn-small btn-trigger-baja-direct" data-med-id="${m.id}" style="padding: 4px 10px; font-size: 0.75rem; background: var(--accent-danger); border: none; font-weight: bold; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                <span>🗑️</span> Solicitar Baja
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Renderizar Tabla Histórica de Actas de Baja
  const actasTbody = document.getElementById('actas-historial-tbody');
  if (actasTbody) {
    if (bajasHistory.length === 0) {
      actasTbody.innerHTML = `
        <tr>
          <td colspan="8" style="padding: 20px; text-align: center; color: var(--text-muted);">
            No se han registrado actas de baja de medicamentos vencidos todavía.
          </td>
        </tr>
      `;
    } else {
      actasTbody.innerHTML = bajasHistory.map(b => {
        const dateFormatted = new Date(b.date).toLocaleString('es-GT');
        return `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 10px; font-family: monospace; font-weight: bold; color: var(--accent-primary);">${b.id}</td>
            <td style="padding: 10px; color: var(--text-muted); font-size: 0.8rem;">${dateFormatted}</td>
            <td style="padding: 10px;">
              <strong>${b.medicationName}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Lote: ${b.lote || 'N/D'} | Venc: ${b.vencimiento || 'N/D'}</div>
            </td>
            <td style="padding: 10px; text-align: right; font-weight: bold;">
              ${b.unitsDiscarded} ${b.unidad_dispensable || 'uds'} (${b.packsDiscarded || '0'} cajas)
            </td>
            <td style="padding: 10px; text-align: right; color: var(--accent-danger); font-weight: bold;">
              Q${parseFloat(b.totalLoss || 0).toFixed(2)}
            </td>
            <td style="padding: 10px; font-size: 0.8rem;">${b.operatorName}</td>
            <td style="padding: 10px; font-size: 0.8rem;">
              <span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                🛡️ ${b.authorizedBy}
              </span>
            </td>
            <td style="padding: 10px; text-align: center;">
              <button class="btn btn-secondary btn-small btn-print-baja-acta" data-acta-id="${b.id}" style="padding: 3px 8px; font-size: 0.75rem; cursor: pointer;">
                🖨️ Acta
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Bind Search Input
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = 'true';
    searchInput.addEventListener('input', () => renderBajasVencidosTab());
  }
}

// 10. MODAL DE AUTORIZACIÓN Y BAJA POR ADMINISTRADOR MAESTRO
function showBajaVencidoModal(medId) {
  const state = getAppState();
  const med = (state.medications || []).find(m => m.id === medId);
  if (!med) {
    alert("Medicamento no encontrado en el inventario.");
    return;
  }

  const enriched = enrichMedication(med);
  const currentStock = med.stock !== undefined ? med.stock : 120;
  const unitPrice = enriched.precio_unitario || (enriched.price / (enriched.unidades_por_presentacion || 1));
  const friendlyStock = formatStockFriendly(currentStock, enriched.unidades_por_presentacion, enriched.presentation, enriched.unidad_dispensable);

  // Modal container
  let modal = document.getElementById('modal-baja-vencido');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-baja-vencido';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); padding: 15px;';
    document.body.appendChild(modal);
  }

  const expDateStr = med.vencimiento ? new Date(med.vencimiento).toLocaleDateString('es-GT') : 'Sin fecha';

  modal.innerHTML = `
    <div class="glass-card modal-card" style="max-width: 620px; width: 100%; max-height: 92vh; overflow-y: auto; padding: 1.75rem; border-top: 4px solid var(--accent-danger); box-shadow: var(--shadow-xl); border-radius: var(--radius-md);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div>
          <h2 style="color: var(--accent-danger); font-size: 1.25rem; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>🗑️</span> Autorización de Baja y Destrucción
          </h2>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin: 4px 0 0 0;">
            Salida por caducidad de inventario y generación de acta oficial.
          </p>
        </div>
        <button type="button" id="btn-close-baja-modal" style="background: none; border: none; font-size: 1.4rem; color: var(--text-muted); cursor: pointer; padding: 0 5px;">&times;</button>
      </div>

      <!-- Ficha del Medicamento Caducado -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; margin-bottom: 1.25rem;">
        <h3 style="margin: 0 0 6px 0; color: var(--text-primary); font-size: 1.05rem;">${med.name}</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.82rem; color: var(--text-muted);">
          <div><strong>Genérico:</strong> ${med.generic || 'N/D'}</div>
          <div><strong>Presentación:</strong> ${med.presentation || 'Caja'}</div>
          <div><strong>Lote:</strong> <span style="font-family: monospace; color: var(--accent-primary); font-weight: bold;">${med.lote || 'N/D'}</span></div>
          <div><strong>Fecha de Vencimiento:</strong> <span style="color: var(--accent-danger); font-weight: bold;">${expDateStr}</span></div>
          <div style="grid-column: span 2; margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--border-color);">
            <strong>Existencias en Sistema:</strong> <span style="color: var(--accent-success); font-weight: bold;">${friendlyStock}</span> (Stock: ${currentStock} ${enriched.unidad_dispensable}(s))
          </div>
        </div>
      </div>

      <form id="form-baja-vencido" style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Cantidad a dar de baja -->
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-weight: bold; font-size: 0.85rem;">Cantidad a Dar de Baja (${enriched.unidad_dispensable}s):</label>
          <div style="display: flex; gap: 10px; align-items: center;">
            <input type="number" id="baja-units-input" value="${currentStock}" min="1" max="${Math.max(1, currentStock)}" required style="flex: 1; padding: 8px 12px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.95rem; font-weight: bold;">
            <span style="font-size: 0.82rem; color: var(--text-muted);">${enriched.unidad_dispensable}(s)</span>
          </div>
          <div id="baja-units-helper" style="font-size: 0.78rem; color: #f472b6; margin-top: 4px; font-weight: 500;">
            <!-- Cálculo dinámico -->
          </div>
        </div>

        <!-- Acción en catálogo -->
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-weight: bold; font-size: 0.85rem;">Acción en Catálogo de Farmacia:</label>
          <select id="baja-catalog-action" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
            <option value="discount">Descontar existencias vencidas (Mantener medicamento en catálogo para futuras compras)</option>
            <option value="remove">Eliminar permanentemente este producto del catálogo</option>
          </select>
        </div>

        <!-- Observaciones / Método de destrucción -->
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-weight: bold; font-size: 0.85rem;">Motivo / Protocolo de Destrucción:</label>
          <textarea id="baja-reason-input" rows="2" required style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem; resize: vertical;">Vencimiento de caducidad cumplido. Descarte de lote por bioseguridad según normativa sanitaria y control de calidad institucional.</textarea>
        </div>

        <!-- Bloque de Validación de Seguridad (ADMINISTRADOR MAESTRO) -->
        <div style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 14px; margin-top: 5px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 1.2rem;">🔒</span>
            <strong style="color: #ef4444; font-size: 0.88rem; text-transform: uppercase; letter-spacing: 0.5px;">
              Aprobación Obligatoria: Administrador Maestro
            </strong>
          </div>
          <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.35; margin: 0 0 10px 0;">
            La baja de medicamentos vencidos genera un acta contable y merma de inventario. Ingrese la contraseña del <strong>Administrador Maestro</strong> para validar la transacción.
          </p>

          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; font-weight: bold; color: var(--text-primary);">Contraseña del Administrador Maestro</label>
            <input type="password" id="baja-admin-password" placeholder="Ingrese contraseña de Administrador..." required autocomplete="current-password" style="width: 100%; padding: 10px 12px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.5); background: var(--bg-card); color: var(--text-primary); font-size: 0.9rem;">
          </div>
        </div>

        <!-- Botones de Acción -->
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 12px;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-baja-form" style="padding: 8px 16px;">Cancelar</button>
          <button type="submit" class="btn btn-danger" id="btn-submit-baja" style="background: var(--accent-danger); border: none; padding: 8px 18px; font-weight: bold; display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <span>✅</span> Aprobar y Procesar Baja
          </button>
        </div>
      </form>
    </div>
  `;

  // Dynamic calculation helper
  const unitsInput = document.getElementById('baja-units-input');
  const helperEl = document.getElementById('baja-units-helper');

  const updateHelper = () => {
    const qty = parseInt(unitsInput.value) || 0;
    const packs = (qty / (enriched.unidades_por_presentacion || 1)).toFixed(1);
    const loss = (qty * unitPrice).toFixed(2);
    if (helperEl) {
      helperEl.textContent = `Equivalente a ${packs} ${enriched.presentation}(s). Pérdida económica total: Q${loss}`;
    }
  };

  unitsInput.addEventListener('input', updateHelper);
  updateHelper();

  // Close handlers
  const closeModal = () => {
    modal.style.display = 'none';
  };

  document.getElementById('btn-close-baja-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-baja-form').addEventListener('click', closeModal);

  // Submit Handler
  document.getElementById('form-baja-vencido').addEventListener('submit', (e) => {
    e.preventDefault();

    const unitsToDiscard = parseInt(unitsInput.value) || 0;
    if (unitsToDiscard <= 0) {
      alert("Por favor, ingrese una cantidad válida mayor a 0 para dar de baja.");
      return;
    }

    const passInput = document.getElementById('baja-admin-password').value.trim();
    if (!passInput) {
      alert("Debe ingresar la contraseña del Administrador Maestro para autorizar la baja.");
      return;
    }

    // Validación de la contraseña del Administrador Maestro
    const adminUser = (state.users || []).find(u => {
      const r = String(u.role || '').toLowerCase();
      const n = String(u.name || '').toLowerCase();
      return r.includes('administrador') || n === 'administrador' || u.id === 'Admin';
    });

    const hashedInput = hashPassword(passInput);
    const isMasterAuth = passInput === 'Glol5414' || (adminUser && (
      adminUser.password === passInput ||
      adminUser.password === hashedInput ||
      hashPassword(adminUser.password) === hashedInput ||
      adminUser.password === 'Glol5414'
    ));

    if (!isMasterAuth) {
      alert("❌ ACCESO DENEGADO:\nLa contraseña del Administrador Maestro es incorrecta. La baja de medicamento vencido no fue autorizada.");
      return;
    }

    const catalogAction = document.getElementById('baja-catalog-action').value;
    const reasonVal = document.getElementById('baja-reason-input').value.trim();
    const currentUser = state.currentUser || { name: 'Personal de Farmacia', role: 'Farmacia' };
    const lossAmount = parseFloat((unitsToDiscard * unitPrice).toFixed(2));
    const packsCount = parseFloat((unitsToDiscard / (enriched.unidades_por_presentacion || 1)).toFixed(1));

    const actaId = 'ACTA-BAJA-' + Date.now();
    const bajaRecord = {
      id: actaId,
      date: new Date().toISOString(),
      medicationId: med.id,
      medicationName: med.name,
      generic: med.generic || '',
      presentation: med.presentation || '',
      unidad_dispensable: enriched.unidad_dispensable || 'Tableta',
      unidades_por_presentacion: enriched.unidades_por_presentacion || 1,
      lote: med.lote || 'N/D',
      vencimiento: med.vencimiento || 'N/D',
      unitsDiscarded: unitsToDiscard,
      packsDiscarded: packsCount,
      unitPrice: unitPrice,
      totalLoss: lossAmount,
      operatorName: currentUser.name,
      operatorRole: currentUser.role,
      authorizedBy: 'Administrador Maestro',
      reason: reasonVal,
      removedFromCatalog: catalogAction === 'remove'
    };

    // 1. Guardar acta en state.bajasInventario
    state.bajasInventario = state.bajasInventario || [];
    state.bajasInventario.unshift(bajaRecord);

    // 2. Modificar o eliminar medicamento del catálogo
    if (catalogAction === 'remove') {
      state.medications = (state.medications || []).filter(m => m.id !== med.id);
    } else {
      const foundMed = (state.medications || []).find(m => m.id === med.id);
      if (foundMed) {
        foundMed.stock = Math.max(0, (foundMed.stock !== undefined ? foundMed.stock : 120) - unitsToDiscard);
      }
    }

    saveAppState(state);
    closeModal();

    alert(`✅ BAJA AUTORIZADA EXITOSAMENTE:\n\nEl Administrador Maestro ha aprobado la baja de ${unitsToDiscard} ${enriched.unidad_dispensable}(s) de "${med.name}".\n\nActa generada: ${actaId}\nPérdida contable registrada: Q${lossAmount.toFixed(2)}.`);

    // Ofrecer impresión del acta
    if (confirm("¿Desea imprimir el Acta Oficial de Baja y Destrucción ahora?")) {
      printActaBajaVencido(bajaRecord);
    }

    refreshActiveTab();
  });

  modal.style.display = 'flex';
}

// 11. IMPRIMIR ACTA OFICIAL DE BAJA Y DESTRUCCIÓN
function printActaBajaVencido(record) {
  const state = getAppState();
  const clinic = state.clinicInfo || {};
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Por favor, habilite las ventanas emergentes en su navegador para imprimir el acta.");
    return;
  }

  const dateFormatted = new Date(record.date).toLocaleString('es-GT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Acta de Baja y Destrucción - ${record.id}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; padding: 25px; line-height: 1.4; }
        .header-table { width: 100%; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; }
        .title-box { text-align: center; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; margin: 15px 0; }
        .title-box h2 { margin: 0; font-size: 1.15rem; color: #b91c1c; text-transform: uppercase; }
        .data-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 0.88rem; }
        .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
        .data-table th { background: #f8fafc; font-weight: bold; }
        .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding: 0 40px; }
        .sig-box { text-align: center; width: 220px; }
        .sig-line { border-top: 1px solid #111; margin-bottom: 6px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td style="vertical-align: middle; width: 60%;">
            <h1 style="margin: 0; font-size: 1.3rem; color: #1e3a8a;">${clinic.name || 'LUGAMED 2.0 - HOSPITAL Y FARMACIA'}</h1>
            <div style="font-size: 0.82rem; color: #64748b;">Departamento de Farmacia, Control de Calidad y Bioseguridad</div>
          </td>
          <td style="text-align: right; font-size: 0.8rem; color: #334155;">
            📍 ${clinic.address || 'Guatemala'}<br>
            📞 ${clinic.phone || '2200-0000'} | ✉️ ${clinic.email || 'farmacia@lugamed.gt'}
          </td>
        </tr>
      </table>

      <div class="title-box">
        <h2>Acta Oficial de Baja y Destrucción de Medicamento Vencido</h2>
        <div style="font-size: 0.85rem; color: #475569; margin-top: 3px;">Folio No. <strong>${record.id}</strong> | Fecha de Emisión: <strong>${dateFormatted}</strong></div>
      </div>

      <p style="font-size: 0.88rem; text-align: justify; margin-bottom: 15px;">
        Por medio de la presente acta se certifica que en las instalaciones del Servicio de Farmacia se ha procedido formalmente con el descarte, retiro de existencias activas y orden de destrucción del siguiente producto farmacéutico por haber alcanzado su fecha límite de caducidad, en estricto apego a los protocolos sanitarios y de control interno:
      </p>

      <table class="data-table">
        <thead>
          <tr>
            <th>Descripción del Medicamento</th>
            <th>Lote</th>
            <th>Fecha Vencimiento</th>
            <th>Cantidad Descartada</th>
            <th>Costo Unitario</th>
            <th>Pérdida Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${record.medicationName}</strong><br>
              <span style="font-size: 0.75rem; color: #555;">Genérico: ${record.generic || 'N/D'} | ${record.presentation || 'Caja'}</span>
            </td>
            <td style="font-family: monospace; font-weight: bold;">${record.lote || 'N/D'}</td>
            <td style="color: #b91c1c; font-weight: bold;">${record.vencimiento}</td>
            <td><strong>${record.unitsDiscarded} ${record.unidad_dispensable}(s)</strong><br><span style="font-size: 0.75rem; color: #555;">(${record.packsDiscarded} cajas)</span></td>
            <td>Q${parseFloat(record.unitPrice || 0).toFixed(2)}</td>
            <td style="font-weight: bold; color: #b91c1c;">Q${parseFloat(record.totalLoss || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; font-size: 0.85rem; margin-top: 15px;">
        <strong>Justificación y Protocolo Sanitario:</strong>
        <p style="margin: 4px 0 0 0; color: #334155;">${record.reason}</p>
        <div style="margin-top: 6px; font-size: 0.78rem; color: #64748b;">
          <strong>Estado en Catálogo:</strong> ${record.removedFromCatalog ? 'Producto eliminado completamente del catálogo farmacéutico' : 'Existencias descontadas a 0 (Catálogo activo)'}
        </div>
      </div>

      <div class="signatures">
        <div class="sig-box">
          <div class="sig-line"></div>
          <strong style="font-size: 0.85rem;">Responsable de Farmacia</strong><br>
          <span style="font-size: 0.78rem; color: #555;">${record.operatorName} (${record.operatorRole})</span>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <strong style="font-size: 0.85rem;">Administrador Maestro</strong><br>
          <span style="font-size: 0.78rem; color: #16a34a; font-weight: bold;">✅ Autorización Aprobada</span>
        </div>
      </div>

      <div class="no-print" style="text-align: center; margin-top: 35px;">
        <button onclick="window.print()" style="padding: 8px 18px; font-size: 1rem; background: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          🖨️ Imprimir Acta
        </button>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// 12. IMPRIMIR REPORTE CONSOLIDADO DE BAJAS
function printBajasSummaryReport() {
  const state = getAppState();
  const rawList = state.bajasInventario || [];
  const clinicInfo = state.clinicInfo || { name: 'LUGAMED 2.0', phone: '2200-0000', address: 'Guatemala' };

  if (rawList.length === 0) {
    alert("No hay registros de actas de bajas de medicamentos vencidos para imprimir.");
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Por favor, habilite las ventanas emergentes en su navegador para imprimir el reporte.");
    return;
  }

  const totalLoss = rawList.reduce((acc, b) => acc + (parseFloat(b.totalLoss) || 0), 0);
  const totalUnits = rawList.reduce((acc, b) => acc + (parseInt(b.unitsDiscarded) || 0), 0);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte General de Bajas y Destrucción - ${clinicInfo.name}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; padding: 25px; line-height: 1.4; }
        .header-table { width: 100%; border-bottom: 2px solid #b91c1c; padding-bottom: 10px; margin-bottom: 15px; }
        .title-box { text-align: center; margin-bottom: 15px; }
        .title-box h2 { margin: 0; font-size: 1.25rem; color: #b91c1c; text-transform: uppercase; }
        .summary-kpis { display: flex; justify-content: space-around; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 0.88rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.82rem; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: left; }
        th { background: #f1f5f9; font-weight: bold; }
        .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding: 0 40px; }
        .sig-box { text-align: center; width: 220px; }
        .sig-line { border-top: 1px solid #111; margin-bottom: 5px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td>
            <h1 style="margin: 0; font-size: 1.3rem; color: #1e3a8a;">${clinicInfo.name}</h1>
            <div style="font-size: 0.82rem; color: #64748b;">Departamento de Farmacia y Auditoría Médica</div>
          </td>
          <td style="text-align: right; font-size: 0.8rem; color: #334155;">
            📍 ${clinicInfo.address || 'Guatemala'}<br>
            📞 ${clinicInfo.phone || '2200-0000'} | ✉️ ${clinicInfo.email || 'contacto@lugamed.gt'}
          </td>
        </tr>
      </table>

      <div class="title-box">
        <h2>Historial Consolidado de Bajas y Destrucción de Medicamentos Caducados</h2>
        <div style="font-size: 0.82rem; color: #475569;">Fecha de Impresión: ${new Date().toLocaleString('es-GT')}</div>
      </div>

      <div class="summary-kpis">
        <div><strong>Total Actas:</strong> ${rawList.length}</div>
        <div><strong>Unidades Descartadas:</strong> ${totalUnits}</div>
        <div><strong>Pérdida Total Acumulada:</strong> <span style="color: #b91c1c; font-weight: bold;">Q${totalLoss.toFixed(2)}</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Folio</th>
            <th>Fecha</th>
            <th>Medicamento</th>
            <th>Lote / Vencimiento</th>
            <th style="text-align: right;">Cantidad</th>
            <th style="text-align: right;">Pérdida (Q)</th>
            <th>Solicitó</th>
            <th>Autorización</th>
          </tr>
        </thead>
        <tbody>
          ${rawList.map(b => `
            <tr>
              <td style="font-family: monospace; font-weight: bold;">${b.id}</td>
              <td>${new Date(b.date).toLocaleDateString('es-GT')}</td>
              <td><strong>${b.medicationName}</strong><br><span style="font-size: 0.72rem; color: #666;">${b.generic || ''} (${b.presentation || ''})</span></td>
              <td>${b.lote || 'N/D'} / <span style="color: #b91c1c;">${b.vencimiento || 'N/D'}</span></td>
              <td style="text-align: right; font-weight: bold;">${b.unitsDiscarded} ${b.unidad_dispensable || 'uds'}</td>
              <td style="text-align: right; color: #b91c1c; font-weight: bold;">Q${parseFloat(b.totalLoss || 0).toFixed(2)}</td>
              <td>${b.operatorName}</td>
              <td style="color: #16a34a; font-weight: bold;">🛡️ ${b.authorizedBy}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">
          <div class="sig-line"></div>
          <strong style="font-size: 0.85rem;">Responsable de Farmacia</strong>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <strong style="font-size: 0.85rem;">Administrador Maestro</strong>
        </div>
      </div>

      <div class="no-print" style="text-align: center; margin-top: 30px;">
        <button onclick="window.print()" style="padding: 8px 18px; font-size: 1rem; background: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          🖨️ Imprimir Reporte
        </button>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

