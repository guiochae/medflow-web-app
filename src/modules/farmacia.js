// src/modules/farmacia.js
import { getAppState, saveAppState } from '../main.js';

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
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;">
                Genérico: <span id="prev-med-generic">--</span> | Presentación: <span id="prev-med-presentation">--</span>
              </p>
              
              <div style="display: flex; gap: 15px; align-items: flex-end;">
                <div class="form-group" style="flex: 1; margin: 0;">
                  <label>Precio Unitario</label>
                  <strong style="color: var(--accent-success); font-size: 1.2rem; display: block; margin-top: 5px;" id="prev-med-price">Q0.00</strong>
                </div>
                <div class="form-group" style="flex: 1; margin: 0;">
                  <label for="pharmacy-med-qty">Cantidad</label>
                  <input type="number" id="pharmacy-med-qty" value="1" min="1" step="1" style="height: 38px;">
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
        item.innerHTML = `
          <strong style="color: var(--accent-primary);">${match.name}</strong> 
          <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 5px;">(${match.generic} - ${match.presentation})</span>
          <strong style="color: var(--accent-success); float: right;">Q${parseFloat(match.price).toFixed(2)}</strong>
        `;

        item.addEventListener('mouseover', () => {
          item.style.backgroundColor = 'rgba(0, 242, 254, 0.08)';
        });
        item.addEventListener('mouseout', () => {
          item.style.backgroundColor = 'transparent';
        });

        item.addEventListener('click', () => {
          selectedMedicineForSale = match;
          
          document.getElementById('prev-med-name').textContent = match.name;
          document.getElementById('prev-med-generic').textContent = match.generic || 'N/D';
          document.getElementById('prev-med-presentation').textContent = match.presentation || 'N/D';
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
    let isPaid = true;
    if (bill) {
      isPaid = (bill.status === 'Pagado');
    }

    let statusBadge = '';
    let actionButton = '';

    if (isPaid) {
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
    const currentStock = catalogItem ? (catalogItem.stock !== undefined ? catalogItem.stock : 120) : 0;
    const requestedQty = parseInt(m.quantity) || 1;
    if (currentStock < requestedQty) {
      insufficientStock.push(`${m.name} (Stock: ${currentStock}, Solicitado: ${requestedQty})`);
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
      const requestedQty = parseInt(m.quantity) || 1;
      catalogItem.stock = Math.max(0, (catalogItem.stock !== undefined ? catalogItem.stock : 120) - requestedQty);
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
      <td style="padding: 10px; text-align: center; font-weight: bold;">${item.quantity}</td>
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

  // Validar existencia
  const currentStock = selectedMedicineForSale.stock !== undefined ? selectedMedicineForSale.stock : 120;
  if (currentStock <= 0) {
    alert(`❌ NOTIFICACIÓN DE INVENTARIO:\nNo se puede vender el medicamento "${selectedMedicineForSale.name}" porque su existencia es igual a cero.`);
    return;
  }

  // Validar cantidad acumulada vs stock disponible
  const existingIdx = currentCart.findIndex(item => item.id === selectedMedicineForSale.id);
  const cartQty = existingIdx !== -1 ? currentCart[existingIdx].quantity : 0;
  if (cartQty + qty > currentStock) {
    alert(`❌ NOTIFICACIÓN DE INVENTARIO:\nNo hay suficientes existencias disponibles de "${selectedMedicineForSale.name}".\n\nStock disponible: ${currentStock}\nEn carrito: ${cartQty}\nSolicitado: ${qty}`);
    return;
  }

  if (existingIdx !== -1) {
    currentCart[existingIdx].quantity += qty;
  } else {
    currentCart.push({
      id: selectedMedicineForSale.id,
      name: selectedMedicineForSale.name,
      generic: selectedMedicineForSale.generic || '',
      presentation: selectedMedicineForSale.presentation || '',
      price: parseFloat(selectedMedicineForSale.price),
      quantity: qty
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

  // Reducir stock del inventario
  currentCart.forEach(cartItem => {
    const catalogItem = appState.medications && appState.medications.find(m => m.id === cartItem.id || m.name === cartItem.name);
    if (catalogItem) {
      catalogItem.stock = Math.max(0, (catalogItem.stock !== undefined ? catalogItem.stock : 120) - cartItem.quantity);
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
      <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
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
      if (expDate < today) {
        expirationAlerts.push({
          type: 'expired',
          text: `🚨 <strong>CADUCADO:</strong> El medicamento "${med.name}" (Lote: ${med.lote || 'N/D'}) venció el ${expDate.toLocaleDateString('es-GT')}.`
        });
      } else if (expDate <= ninetyDaysFromNow) {
        const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        expirationAlerts.push({
          type: 'expiring-soon',
          text: `⚠️ <strong>PRÓXIMO A VENCER:</strong> "${med.name}" (Lote: ${med.lote || 'N/D'}) vence el ${expDate.toLocaleDateString('es-GT')} (en ${daysLeft} días).`
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
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; padding-right: 5px;">
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
            ">
              ${alert.text}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
