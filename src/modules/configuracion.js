// src/modules/configuracion.js
import { getAppState, saveAppState, removeFromFirestore, purgeAllDatabases, saveDocumentsBatch } from '../main.js';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

let editingUserId = null;
let activeCatalogType = null; // 'medications' | 'laboratoryTests' | 'imagingStudies' | 'consultationTypes'
let selectedImportFile = null;
let activeConfigTab = 'tab-clinic-info';

export function renderConfiguracion(container) {
  const state = getAppState();
  let loadedLogoBase64 = state.clinicInfo.logoData || '';

  console.log("Renderizando módulo de Configuración (Event Delegation Encapsulado)...");

  // Tab definitions
  const tabs = {
    'tab-clinic-info': 'pane-clinic-info',
    'tab-users-roles': 'pane-users-roles',
    'tab-services-products': 'pane-services-products',
    'tab-database-backup': 'pane-database-backup'
  };

  // HTML Layout incorporating the modal internally
  container.innerHTML = `
    <div class="module-header">
      <div class="module-title">
        <h1>Configuración</h1>
        <p>Ajustes generales del consultorio, perfiles de usuarios, catálogos y respaldo de datos.</p>
      </div>
    </div>

    <!-- Pestañas internas de Configuración -->
    <div class="tabs-container" style="display: flex; gap: 10px; margin-bottom: 1rem;">
      <button class="tab-btn active" id="tab-clinic-info">Información de la Clínica</button>
      <button class="tab-btn" id="tab-users-roles">Gestión de Usuarios y Roles</button>
      <button class="tab-btn" id="tab-services-products">Servicios, Estudios y Productos</button>
      <button class="tab-btn" id="tab-database-backup">Base de Datos (Respaldo)</button>
    </div>

    <div class="glass-card" style="padding: 1.5rem;">
      <!-- Pestaña Información de la Clínica -->
      <div id="pane-clinic-info" class="tab-pane active" style="display: block;">
        <h3 style="margin-bottom: 1.5rem; color: var(--accent-primary);">Datos Generales de la Clínica</h3>
        <form id="clinic-info-form">
          <div class="form-row" style="align-items: flex-start; display: flex; gap: 1.5rem;">
            <div class="form-group" style="flex: 2;">
              <label for="c-info-name">Nombre de la Clínica</label>
              <input type="text" id="c-info-name" value="${state.clinicInfo.name || ''}" required placeholder="Ej. Centro Médico Integral">
            </div>
            
            <div class="form-group" style="flex: 1;">
              <label for="clinic-logo-upload">Logotipo de la Clínica</label>
              <input type="file" id="clinic-logo-upload" accept="image/*" style="display: none;">
              <div id="clinic-logo-trigger" style="
                border: 1px dashed var(--border-color); 
                padding: 10px; 
                border-radius: var(--radius-sm); 
                text-align: center; 
                cursor: pointer; 
                background: rgba(255,255,255,0.01);
                transition: all 0.2s;
                height: 42px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.85rem;
                color: var(--text-muted);
              ">
                Seleccionar imagen...
              </div>
              <div id="clinic-logo-preview-box" style="margin-top: 10px; display: ${loadedLogoBase64 ? 'flex' : 'none'}; align-items: center; gap: 10px;">
                <img id="clinic-logo-preview" src="${loadedLogoBase64}" style="max-height: 40px; border-radius: 4px; border: 1px solid var(--border-color);">
                <span id="clinic-logo-name" style="font-size: 0.8rem; color: var(--accent-success);">${loadedLogoBase64 ? 'Logo cargado' : ''}</span>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label for="c-info-address">Dirección Física</label>
            <input type="text" id="c-info-address" value="${state.clinicInfo.address || ''}" required placeholder="Ej. Avenida Las Américas 1-02 Zona 14">
          </div>
          <div class="form-row" style="display: flex; gap: 1.5rem;">
            <div class="form-group" style="flex: 1;">
              <label for="c-info-phone">Teléfono de Contacto</label>
              <input type="tel" id="c-info-phone" value="${state.clinicInfo.phone || ''}" required placeholder="Ej. 2424-0000">
            </div>
            <div class="form-group" style="flex: 1;">
              <label for="c-info-email">Correo de Contacto</label>
              <input type="email" id="c-info-email" value="${state.clinicInfo.email || ''}" required placeholder="Ej. contacto@clinica.com">
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
            <button type="submit" class="btn btn-primary">Guardar Información</button>
          </div>
        </form>
      </div>

      <!-- Pestaña Usuarios y Roles -->
      <div id="pane-users-roles" class="tab-pane" style="display: none;">
        <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          <!-- Formulario de ingreso de usuario -->
          <div>
            <h3 id="new-user-form-title" style="margin-bottom: 1.25rem; color: var(--accent-secondary);">Registrar Nuevo Usuario</h3>
            <form id="new-user-form">
              <div class="form-group">
                <label for="u-name">Nombre Completo</label>
                <input type="text" id="u-name" required placeholder="Ej. Dr. Francisco López">
              </div>
              <div class="form-group">
                <label for="u-role">Rol / Puesto</label>
                <select id="u-role" required>
                  <option value="Administrador">Administrador</option>
                  <option value="Médico 1">Médico 1 (Atribuciones Administrador)</option>
                  <option value="Médico 2">Médico 2</option>
                  <option value="Médico 3">Médico 3</option>
                  <option value="Recepcionista">Recepcionista</option>
                  <option value="Enfermera">Enfermera</option>
                  <option value="Regente Farmacia">Regente Farmacia</option>
                  <option value="Regente Laboratorio">Regente Laboratorio</option>
                  <option value="Laboratorista">Laboratorista</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 1.25rem;">
                <label for="u-password">Contraseña de Acceso</label>
                <input type="password" id="u-password" required value="Glol5414" placeholder="Ej. Glol5414">
              </div>

              <!-- Permisos de Módulos y Submódulos -->
              <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
                <h5 style="color: var(--accent-secondary); margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase;">Permisos de Módulos y Submódulos</h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-transform: none; color: var(--text-primary);">
                    <input type="checkbox" class="u-module-cb" value="preconsulta" checked> 📋 Preconsulta
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-transform: none; color: var(--text-primary);">
                    <input type="checkbox" class="u-module-cb" value="consulta" checked> 🩺 Consulta
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-transform: none; color: var(--text-primary);">
                    <input type="checkbox" class="u-module-cb" value="recetario" checked> 💊 Recetario
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-transform: none; color: var(--text-primary);">
                    <input type="checkbox" class="u-module-cb" value="laboratorio" checked> 🔬 Laboratorio
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-transform: none; color: var(--text-primary);">
                    <input type="checkbox" class="u-module-cb" value="imagenologia" checked> 🖼️ Imagenología
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-transform: none; color: var(--text-primary);">
                    <input type="checkbox" class="u-module-cb" value="farmacia" checked> 🏪 Farmacia
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-transform: none; color: var(--text-primary);">
                    <input type="checkbox" class="u-module-cb" value="configuracion" checked> ⚙️ Configuración
                  </label>
                </div>
              </div>

              <!-- Campos condicionales -->
              <div id="doctor-extra-fields" style="background: rgba(0, 242, 254, 0.02); border: 1px solid rgba(0, 242, 254, 0.15); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
                <h5 style="color: var(--accent-primary); margin-bottom: 8px; font-size: 0.85rem; text-transform: uppercase;">Detalles Adicionales</h5>
                
                <div class="form-group" id="field-group-license">
                  <label for="u-license">Número de Colegiado / Licencia</label>
                  <input type="text" id="u-license" placeholder="Ej. 14231">
                </div>
                
                <div class="form-group" id="field-group-phone" style="margin-bottom: 0;">
                  <label for="u-phone">Teléfono del Usuario</label>
                  <input type="tel" id="u-phone" placeholder="Ej. 4432-1234">
                </div>
              </div>

              <div style="display: flex; gap: 10px; margin-top: 1rem;">
                <button type="submit" class="btn btn-primary btn-small" id="btn-submit-user">Crear Usuario</button>
                <button type="button" class="btn btn-secondary btn-small" id="btn-cancel-user-edit" style="display: none;">Cancelar</button>
              </div>
            </form>
          </div>

          <!-- Listado de usuarios creados -->
          <div>
            <h3 style="margin-bottom: 1.25rem; color: var(--text-primary);">Usuarios Registrados</h3>
            <div style="overflow-y: auto; max-height: 400px; padding-right: 5px;" id="users-list-container">
              <!-- Renderizado de tarjetas de usuarios -->
            </div>
          </div>
        </div>
      </div>

      <!-- Pestaña Servicios, Estudios y Productos -->
      <div id="pane-services-products" class="tab-pane" style="display: none;">
        <h3 style="margin-bottom: 1rem; color: var(--accent-primary);">Catálogos y Asignación de Precios</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.5;">
          Configure el catálogo de medicamentos de la clínica (Farmacia), los análisis propios y de envío externo (Laboratorio e Imagenología), y el tarifario de consultas médicas. Gestione nombres, características y los precios monetarios (Quetzales) que se utilizarán para la facturación automática.
        </p>
        
        <div style="display: flex; gap: 2rem; justify-content: center; align-items: center; margin-top: 1.5rem; flex-wrap: wrap; padding: 10px;">
          <button class="btn btn-primary" id="btn-config-farmacia" style="
            padding: 2rem 1.5rem; 
            font-size: 1.1rem; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            gap: 12px; 
            width: 180px;
            background: linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(0, 242, 254, 0.05) 100%);
            border: 1px solid var(--accent-primary);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.2s;
          ">
            <span style="font-size: 2.8rem;">💊</span>
            <strong style="color: var(--text-primary);">Farmacia</strong>
          </button>
          
          <button class="btn btn-secondary" id="btn-config-laboratorio" style="
            padding: 2rem 1.5rem; 
            font-size: 1.1rem; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            gap: 12px; 
            width: 180px;
            background: linear-gradient(135deg, rgba(160, 0, 255, 0.15) 0%, rgba(160, 0, 255, 0.05) 100%);
            border: 1px solid var(--accent-secondary);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.2s;
          ">
            <span style="font-size: 2.8rem;">🔬</span>
            <strong style="color: var(--text-primary);">Laboratorio</strong>
          </button>
          
          <button class="btn btn-success" id="btn-config-imagenologia" style="
            padding: 2rem 1.5rem; 
            font-size: 1.1rem; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            gap: 12px; 
            width: 180px;
            background: linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(0, 230, 118, 0.05) 100%);
            border: 1px solid var(--accent-success);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.2s;
          ">
            <span style="font-size: 2.8rem;">🖼️</span>
            <strong style="color: var(--text-primary);">Imagenología</strong>
          </button>
          
          <button class="btn btn-primary" id="btn-config-consulta" style="
            padding: 2rem 1.5rem; 
            font-size: 1.1rem; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            gap: 12px; 
            width: 180px;
            background: linear-gradient(135deg, rgba(255, 179, 0, 0.15) 0%, rgba(255, 179, 0, 0.05) 100%);
            border: 1px solid #ffb300;
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.2s;
          ">
            <span style="font-size: 2.8rem;">🩺</span>
            <strong style="color: var(--text-primary);">Consulta</strong>
          </button>
        </div>
      </div>

      <!-- Pestaña Base de Datos (Respaldo) -->
      <div id="pane-database-backup" class="tab-pane" style="display: none;">
        <h3 style="margin-bottom: 1rem; color: var(--accent-primary);">💾 Importación y Exportación de Base de Datos</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 2rem;">
          Realiza copias de seguridad completas de toda la información registrada en el sistema (Datos de la clínica, Usuarios, Pacientes, Historial Clínico, Consultas, Recetas, Facturación / Comprobantes, Inventario y Ventas de Farmacia, Laboratorio e Imagenología) o restaura una copia previa.
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
          <!-- Tarjeta Exportar -->
          <div style="background: rgba(0, 242, 254, 0.03); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📤</div>
              <h4 style="color: var(--accent-primary); font-size: 1.2rem; margin-bottom: 0.5rem;">Exportar Base de Datos</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
                Descarga un respaldo completo de todo el sistema. Podrás elegir entre formato <strong>JSON</strong> (respaldo integral del sistema) o <strong>EXCEL (.xlsx)</strong> (hojas organizadas por catálogos y facturación).
              </p>
            </div>
            <button type="button" class="btn btn-primary" id="btn-trigger-export-db" style="margin-top: 1.5rem; width: 100%;">
              <span>📤</span> Exportar Información...
            </button>
          </div>

          <!-- Tarjeta Importar -->
          <div style="background: rgba(157, 78, 221, 0.03); border: 1px solid rgba(157, 78, 221, 0.2); border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📥</div>
              <h4 style="color: var(--accent-secondary); font-size: 1.2rem; margin-bottom: 0.5rem;">Importar Base de Datos</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
                Carga y restaura una base de datos externa en formato <strong>JSON</strong> o <strong>EXCEL (.xlsx)</strong>. Todos los catálogos, expedientes y registros de facturación serán actualizados.
              </p>
            </div>
            <button type="button" class="btn btn-secondary" id="btn-trigger-import-db" style="margin-top: 1.5rem; width: 100%;">
              <span>📥</span> Importar Información...
            </button>
          </div>

          <!-- Tarjeta Vaciar / Borrar Todas las Bases de Datos -->
          <div style="background: rgba(239, 68, 68, 0.04); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🗑️</div>
              <h4 style="color: #ef4444; font-size: 1.2rem; margin-bottom: 0.5rem;">Borrar Todas las Bases de Datos</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
                Elimina por completo toda la información almacenada en el servidor (Firebase Firestore) y localmente (pacientes, expedientes, recetas, laboratorio, imagenología e inventario), borrando todos los usuarios adicionales y conservando únicamente al usuario <strong>Administrador</strong> (clave: <code>Glol5414</code>).
              </p>
            </div>
            <button type="button" class="btn" id="btn-trigger-purge-all-db" style="margin-top: 1.5rem; width: 100%; background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; border: none; font-weight: 700; padding: 12px; border-radius: var(--radius-sm); cursor: pointer;">
              <span>🗑️</span> Borrar Todas las Bases de Datos
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CONFIG CATALOGS MODAL (ALOJADO LOCALMENTE EN LA CONFIGURACIÓN) -->
    <div id="config-catalog-modal" class="modal-overlay" style="display: none; z-index: 1100;">
      <div class="modal-content" style="max-width: 800px; width: 90%;">
        <div class="modal-header">
          <h2 id="config-catalog-title">Gestión de Catálogo</h2>
          <button class="modal-close" id="btn-close-config-catalog">&times;</button>
        </div>
        <div class="modal-body" style="max-height: 500px; overflow-y: auto; padding: 1.5rem;">
          
          <!-- Formulario para agregar / editar item -->
          <div id="config-item-form-area" class="glass-card" style="margin-bottom: 1.5rem; padding: 1.25rem; border-top: 3px solid var(--accent-primary); background: rgba(255, 255, 255, 0.01);">
            <h4 id="config-form-title" style="margin-bottom: 10px; color: var(--accent-primary);">Agregar Nuevo Item</h4>
            <form id="config-item-form" style="display: flex; flex-direction: column; gap: 12px;">
              <input type="hidden" id="config-item-id">
              
              <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <div class="form-group" style="flex: 2; min-width: 200px;">
                  <label for="config-item-name" id="lbl-item-name">Nombre</label>
                  <input type="text" id="config-item-name" required placeholder="Ej. Acetaminofén, Hemograma, Rx Tórax...">
                </div>
                <div class="form-group" style="flex: 1; min-width: 120px;">
                  <label for="config-item-price" id="lbl-item-price">Precio (Q)</label>
                  <input type="number" id="config-item-price" step="0.01" min="0" required placeholder="0.00">
                </div>
              </div>

              <!-- Campos específicos según catálogo -->
              <div id="config-specific-fields" style="display: flex; gap: 15px; flex-wrap: wrap; width: 100%; margin: 0;">
                <!-- Se inyectan dinámicamente -->
              </div>

              <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
                <button type="button" class="btn btn-secondary btn-small" id="btn-clear-config-form">Limpiar</button>
                <button type="submit" class="btn btn-success btn-small" id="btn-submit-config-item">Guardar</button>
              </div>
            </form>
          </div>

          <!-- Importar desde Excel o Word -->
          <div id="config-import-area" class="glass-card" style="margin-bottom: 1.5rem; padding: 1.25rem; border-top: 3px solid var(--accent-secondary); background: rgba(255, 255, 255, 0.01); display: flex; flex-direction: column; gap: 10px;">
            <h4 style="margin: 0; color: var(--accent-secondary);">📂 Importación Masiva (Excel / Word)</h4>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0; line-height: 1.4;">
              Cargue un archivo Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) o Word (<strong>.docx</strong>). Se extraerán los elementos automáticamente.
            </p>
            <div style="display: flex; gap: 12px; align-items: center; margin-top: 5px;">
              <input type="file" id="config-catalog-import-file" accept=".xlsx, .xls, .docx" style="display: none;">
              <button type="button" class="btn btn-secondary btn-small" id="btn-trigger-import-file" style="padding: 6px 12px; font-size: 0.85rem;">
                <span>📂</span> Seleccionar Archivo...
              </button>
              <span id="import-file-name" style="font-size: 0.8rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px;">Ningún archivo seleccionado</span>
              <button type="button" class="btn btn-primary btn-small" id="btn-process-import-file" style="padding: 6px 12px; font-size: 0.85rem; display: none;">
                <span>⚡</span> Cargar Catálogo
              </button>
            </div>
          </div>

          <!-- Tabla con listado de items -->
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-size: 0.85rem;">
                  <th style="padding: 10px;">Nombre</th>
                  <th id="th-extra-col" style="padding: 10px;">Categoría/Detalle</th>
                  <th style="padding: 10px; text-align: right;">Precio</th>
                  <th style="padding: 10px; text-align: center; width: 120px;">Acciones</th>
                </tr>
              </thead>
              <tbody id="config-catalog-table-body" style="font-size: 0.9rem;">
                <!-- Se inyecta dinámicamente -->
              </tbody>
            </table>
          </div>

        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-close-catalog-modal">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  // Restore active tab
  if (activeConfigTab && activeConfigTab !== 'tab-clinic-info') {
    const activeBtn = container.querySelector(`#${activeConfigTab}`);
    if (activeBtn) {
      container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      container.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
      });
      activeBtn.classList.add('active');
      const paneId = tabs[activeConfigTab];
      const targetPane = container.querySelector(`#${paneId}`);
      if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'block';
      }
    }
  }

  // Render list of users
  renderUsersList();

  // Restore open catalog modal if any
  if (activeCatalogType) {
    setTimeout(() => {
      if (activeCatalogType) {
        openCatalogConfig(activeCatalogType);
        renderCatalogTable();
      }
    }, 0);
  }

  // ==========================================
  // ENCAPSULATED EVENT DELEGATION ON CONTAINER
  // ==========================================
  
  if (!container.dataset.configListenersInitialized) {
    container.dataset.configListenersInitialized = 'true';

    // 1. Click events
    container.addEventListener('click', (e) => {
      // sub-module tab switcher
      const tabBtn = e.target.closest('.tab-btn');
      if (tabBtn && tabBtn.id && tabs[tabBtn.id]) {
        e.preventDefault();
        console.log(`Pestaña interna seleccionada: ${tabBtn.id}`);
        activeConfigTab = tabBtn.id;
        container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        container.querySelectorAll('.tab-pane').forEach(pane => {
          pane.classList.remove('active');
          pane.style.display = 'none';
        });

        tabBtn.classList.add('active');
        const targetPane = document.getElementById(tabs[tabBtn.id]);
        if (targetPane) {
          targetPane.classList.add('active');
          targetPane.style.display = 'block';
        }
        return;
      }

    // sub-module buttons (Farmacia, Laboratorio, Imagenología, Consulta)
    const btnFarmacia = e.target.closest('#btn-config-farmacia');
    const btnLab = e.target.closest('#btn-config-laboratorio');
    const btnImg = e.target.closest('#btn-config-imagenologia');
    const btnConsulta = e.target.closest('#btn-config-consulta');

    if (btnFarmacia) {
      e.preventDefault();
      openCatalogConfig('medications');
      return;
    } else if (btnLab) {
      e.preventDefault();
      openCatalogConfig('laboratoryTests');
      return;
    } else if (btnImg) {
      e.preventDefault();
      openCatalogConfig('imagingStudies');
      return;
    } else if (btnConsulta) {
      e.preventDefault();
      openCatalogConfig('consultationTypes');
      return;
    }

    // clinic logo trigger
    const logoTrigger = e.target.closest('#clinic-logo-trigger');
    if (logoTrigger) {
      e.preventDefault();
      const logoUpload = document.getElementById('clinic-logo-upload');
      if (logoUpload) logoUpload.click();
      return;
    }

    // user delete button
    const deleteUserBtn = e.target.closest('.btn-delete-user');
    if (deleteUserBtn) {
      e.preventDefault();
      const idToDelete = deleteUserBtn.getAttribute('data-id');
      const stateObj = getAppState();
      if (stateObj.users.length <= 1) {
        alert("Debe registrar al menos un usuario.");
        return;
      }
      stateObj.users = stateObj.users.filter(x => x.id !== idToDelete);
      removeFromFirestore('users', idToDelete);
      saveAppState(stateObj);
      renderUsersList();
      return;
    }

    // user edit button
    const editUserBtn = e.target.closest('.btn-edit-user');
    if (editUserBtn) {
      e.preventDefault();
      const idToEdit = editUserBtn.getAttribute('data-id');
      const stateObj = getAppState();
      const user = stateObj.users.find(usr => usr.id === idToEdit);
      if (!user) return;

      editingUserId = user.id;
      document.getElementById('u-name').value = user.name;
      document.getElementById('u-role').value = user.role;
      if (document.getElementById('u-license')) document.getElementById('u-license').value = user.license || '';
      if (document.getElementById('u-phone')) document.getElementById('u-phone').value = user.phone || '';
      if (document.getElementById('u-password')) document.getElementById('u-password').value = user.password || 'Glol5414';

      const userMods = user.modules || ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'configuracion'];
      document.querySelectorAll('.u-module-cb').forEach(cb => {
        cb.checked = userMods.includes(cb.value);
      });

      document.getElementById('new-user-form-title').textContent = "Modificar Usuario";
      document.getElementById('btn-submit-user').textContent = "Guardar Cambios";
      const cancelBtn = document.getElementById('btn-cancel-user-edit');
      if (cancelBtn) cancelBtn.style.display = 'inline-block';
      return;
    }

    // user cancel edit button
    const cancelUserEditBtn = e.target.closest('#btn-cancel-user-edit');
    if (cancelUserEditBtn) {
      e.preventDefault();
      editingUserId = null;
      document.getElementById('new-user-form').reset();
      document.getElementById('new-user-form-title').textContent = "Registrar Nuevo Usuario";
      document.getElementById('btn-submit-user').textContent = "Crear Usuario";
      cancelUserEditBtn.style.display = 'none';
      handleRoleChange('medico');
      return;
    }

    // modal close buttons
    const closeBtn = e.target.closest('#btn-close-config-catalog, #btn-close-catalog-modal');
    if (closeBtn) {
      e.preventDefault();
      const configModal = document.getElementById('config-catalog-modal');
      if (configModal) configModal.style.display = 'none';
      return;
    }

    // modal clear form
    const clearBtn = e.target.closest('#btn-clear-config-form');
    if (clearBtn) {
      e.preventDefault();
      const configForm = document.getElementById('config-item-form');
      if (configForm) {
        configForm.reset();
        document.getElementById('config-item-id').value = '';
        document.getElementById('config-form-title').textContent = "Agregar Nuevo Item";
      }
      return;
    }

    // mass import trigger file select
    const triggerImportBtn = e.target.closest('#btn-trigger-import-file');
    if (triggerImportBtn) {
      e.preventDefault();
      const importFile = document.getElementById('config-catalog-import-file');
      if (importFile) importFile.click();
      return;
    }

    // catalog item edit button
    const editBtn = e.target.closest('.btn-edit-config');
    if (editBtn && activeCatalogType) {
      e.preventDefault();
      const id = editBtn.getAttribute('data-id');
      const stateObj = getAppState();
      const itemObj = stateObj[activeCatalogType].find(x => x.id === id);
      if (itemObj) {
        document.getElementById('config-item-id').value = itemObj.id;
        document.getElementById('config-item-name').value = itemObj.name;
        document.getElementById('config-item-price').value = itemObj.price;
        document.getElementById('config-form-title').textContent = "Modificar Item";

        if (activeCatalogType === 'medications') {
          document.getElementById('c-spec-generic').value = itemObj.generic || '';
          document.getElementById('c-spec-presentation').value = itemObj.presentation || '';
          document.getElementById('c-spec-category').value = itemObj.category || '';
          document.getElementById('c-spec-stock').value = itemObj.stock !== undefined ? itemObj.stock : 120;
          document.getElementById('c-spec-lote').value = itemObj.lote || '';
          document.getElementById('c-spec-vencimiento').value = itemObj.vencimiento || '';
        } else if (activeCatalogType === 'laboratoryTests') {
          document.getElementById('c-spec-category').value = itemObj.category || '';
          const unitEl = document.getElementById('c-spec-unit');
          const refEl = document.getElementById('c-spec-reference');
          if (unitEl) unitEl.value = itemObj.unit || itemObj.units || '';
          if (refEl) refEl.value = itemObj.reference || itemObj.referenceInterval || itemObj.normal || '';
        } else if (activeCatalogType === 'imagingStudies') {
          document.getElementById('c-spec-category').value = itemObj.category || '';
        } else if (activeCatalogType === 'consultationTypes') {
          document.getElementById('c-spec-specialty').value = itemObj.specialty || '';
        }
      }
      return;
    }

    // catalog item delete button
    const deleteBtn = e.target.closest('.btn-delete-config');
    if (deleteBtn && activeCatalogType) {
      e.preventDefault();
      if (!confirm("¿Está seguro de que desea eliminar este item del catálogo?")) return;
      const id = deleteBtn.getAttribute('data-id');
      const stateObj = getAppState();
      stateObj[activeCatalogType] = stateObj[activeCatalogType].filter(x => x.id !== id);
      removeFromFirestore(activeCatalogType, id);
      saveAppState(stateObj);
      renderCatalogTable();
      return;
    }

    // process mass file import click
    const btnProcessImport = e.target.closest('#btn-process-import-file');
    if (btnProcessImport) {
      e.preventDefault();
      processFileImport();
      return;
    }

    // Trigger Database Export Modal
    const btnExportDb = e.target.closest('#btn-trigger-export-db');
    if (btnExportDb) {
      e.preventDefault();
      renderExportModal();
      return;
    }

    // Trigger Database Import Modal
    const btnImportDb = e.target.closest('#btn-trigger-import-db');
    if (btnImportDb) {
      e.preventDefault();
      renderImportModal();
      return;
    }

    // Trigger Purge All Database
    const btnPurgeDb = e.target.closest('#btn-trigger-purge-all-db');
    if (btnPurgeDb) {
      e.preventDefault();
      const confirmed = confirm("⚠️ ATENCIÓN Y ADVERTENCIA:\n\n¿Está completamente seguro de que desea BORRAR Y ELIMINAR toda la base de datos de producción (Pacientes, Consultas, Recetas, Laboratorio, Imagenología e Inventario)?\n\nEsta acción borrará los datos tanto de la nube (Firebase Firestore) como del almacenamiento local de forma IRREVERSIBLE.");
      if (confirmed) {
        const doubleCheck = prompt("Escriba 'BORRAR' en mayúsculas para confirmar la eliminación total:");
        if (doubleCheck && doubleCheck.trim() === 'BORRAR') {
          btnPurgeDb.disabled = true;
          btnPurgeDb.textContent = "⏳ Eliminando base de datos...";
          purgeAllDatabases().then(() => {
            alert("🗑️ Toda la información de la base de datos ha sido borrada exitosamente.");
            window.location.reload();
          }).catch(err => {
            alert("❌ Ocurrió un error al eliminar los datos: " + err.message);
            window.location.reload();
          });
        } else {
          alert("Operación cancelada. Debe escribir 'BORRAR' exactamente para confirmar.");
        }
      }
      return;
    }
  });

  // 2. Submit events
  container.addEventListener('submit', (e) => {
    // Clinic details form submit
    if (e.target && e.target.id === 'clinic-info-form') {
      e.preventDefault();
      const appState = getAppState();
      appState.clinicInfo.name = document.getElementById('c-info-name').value;
      appState.clinicInfo.logoData = loadedLogoBase64;
      appState.clinicInfo.address = document.getElementById('c-info-address').value;
      appState.clinicInfo.phone = document.getElementById('c-info-phone').value;
      appState.clinicInfo.email = document.getElementById('c-info-email').value;
      saveAppState(appState);

      // Update sidebar logo dynamically
      const clinicLogo = document.querySelector('.clinic-mini-logo');
      const sidebarClinicName = document.getElementById('sidebar-clinic-name');
      const sidebarClinicPhone = document.getElementById('sidebar-clinic-phone');
      if (sidebarClinicName) sidebarClinicName.textContent = appState.clinicInfo.name;
      if (sidebarClinicPhone) sidebarClinicPhone.textContent = appState.clinicInfo.phone;
      if (clinicLogo) {
        if (loadedLogoBase64) {
          clinicLogo.innerHTML = `<img src="${loadedLogoBase64}" style="width: 28px; height: 28px; object-fit: cover; border-radius: 4px;">`;
        } else {
          clinicLogo.innerHTML = appState.clinicInfo.logoText || '🏥';
        }
      }
      alert("Información de la clínica actualizada.");
      return;
    }

    // User creation/edit form submit
    if (e.target && e.target.id === 'new-user-form') {
      e.preventDefault();
      const appState = getAppState();
      const name = document.getElementById('u-name').value;
      const role = document.getElementById('u-role').value;
      const password = document.getElementById('u-password').value || 'Glol5414';
      const license = document.getElementById('u-license') ? document.getElementById('u-license').value : '';
      const phone = document.getElementById('u-phone') ? document.getElementById('u-phone').value : '';
      const selectedModules = Array.from(document.querySelectorAll('.u-module-cb:checked')).map(cb => cb.value);

      if (editingUserId) {
        const user = appState.users.find(usr => usr.id === editingUserId);
        if (user) {
          user.name = name;
          user.role = role;
          user.password = password;
          user.license = license;
          user.phone = phone;
          user.modules = selectedModules;
        }
        editingUserId = null;
        document.getElementById('new-user-form-title').textContent = "Registrar Nuevo Usuario";
        document.getElementById('btn-submit-user').textContent = "Crear Usuario";
        const cancelBtn = document.getElementById('btn-cancel-user-edit');
        if (cancelBtn) cancelBtn.style.display = 'none';
        alert("Usuario actualizado exitosamente.");
      } else {
        const newUser = {
          id: 'u-' + (appState.users.length + 1) + '-' + Math.random().toString(36).substr(2, 4),
          name,
          role,
          password,
          license,
          phone,
          modules: selectedModules
        };
        appState.users.push(newUser);
        alert("Usuario registrado exitosamente.");
      }
      saveAppState(appState);
      e.target.reset();
      handleRoleChange('medico');
      renderUsersList();
      return;
    }

    // Catalog item add/edit form submit
    if (e.target && e.target.id === 'config-item-form') {
      e.preventDefault();
      const appState = getAppState();
      const id = document.getElementById('config-item-id').value;
      const name = document.getElementById('config-item-name').value;
      const price = parseFloat(document.getElementById('config-item-price').value);

      let itemObj = {};
      if (id) {
        itemObj = appState[activeCatalogType].find(x => x.id === id);
      } else {
        const prefix = activeCatalogType === 'medications' ? 'm-' :
                       activeCatalogType === 'laboratoryTests' ? 'l-' :
                       activeCatalogType === 'imagingStudies' ? 'i-' : 'c-';
        itemObj.id = prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        appState[activeCatalogType].unshift(itemObj);
      }

      itemObj.name = name;
      itemObj.price = price;

      if (activeCatalogType === 'medications') {
        itemObj.generic = document.getElementById('c-spec-generic').value;
        itemObj.presentation = document.getElementById('c-spec-presentation').value;
        itemObj.category = document.getElementById('c-spec-category').value;
        itemObj.stock = parseInt(document.getElementById('c-spec-stock').value) || 0;
        itemObj.lote = document.getElementById('c-spec-lote').value;
        itemObj.vencimiento = document.getElementById('c-spec-vencimiento').value;
      } else if (activeCatalogType === 'laboratoryTests') {
        itemObj.category = document.getElementById('c-spec-category').value;
        const unitEl = document.getElementById('c-spec-unit');
        const refEl = document.getElementById('c-spec-reference');
        if (unitEl) itemObj.unit = unitEl.value.trim() || 'N/A';
        if (refEl) itemObj.reference = refEl.value.trim() || 'N/A';
        if (!itemObj.parameters) {
          itemObj.parameters = [
            { name: "Resultado General", unit: itemObj.unit || '', normal: itemObj.reference || 'Estable' }
          ];
        }
      } else if (activeCatalogType === 'imagingStudies') {
        itemObj.category = document.getElementById('c-spec-category').value;
      } else if (activeCatalogType === 'consultationTypes') {
        itemObj.specialty = document.getElementById('c-spec-specialty').value;
      }

      saveAppState(appState);
      renderCatalogTable();
      e.target.reset();
      document.getElementById('config-item-id').value = '';
      document.getElementById('config-form-title').textContent = "Agregar Nuevo Item";
      alert("Elemento guardado exitosamente en el catálogo.");
      return;
    }
  });

  // 3. Change events
  container.addEventListener('change', (e) => {
    // catalog inline price change
    if (e.target && e.target.classList.contains('catalog-price-input') && activeCatalogType) {
      const id = e.target.getAttribute('data-id');
      const newPrice = parseFloat(e.target.value) || 0;
      const appState = getAppState();
      const list = appState[activeCatalogType] || [];
      const item = list.find(x => x.id === id);
      if (item) {
        item.price = newPrice;
        saveAppState(appState);
      }
      return;
    }
    // user role dropdown change
    if (e.target && e.target.id === 'u-role') {
      const selectedRole = e.target.value.toLowerCase();
      let roleKey = selectedRole;
      if (selectedRole.includes('medico') || selectedRole.includes('médico')) {
        roleKey = 'medico';
      } else if (selectedRole.includes('enfermer')) {
        roleKey = 'enfermero';
      } else if (selectedRole.includes('recep')) {
        roleKey = 'recepcionista';
      } else if (selectedRole.includes('laboratorio') || selectedRole.includes('laboratorista')) {
        roleKey = 'laboratorista';
      }
      handleRoleChange(roleKey);
      return;
    }

    // mass catalog file upload change
    if (e.target && e.target.id === 'config-catalog-import-file') {
      const file = e.target.files[0];
      if (!file) return;

      selectedImportFile = file;
      const importFileName = document.getElementById('import-file-name');
      const btnProcessImport = document.getElementById('btn-process-import-file');
      if (importFileName) importFileName.textContent = file.name;
      if (btnProcessImport) btnProcessImport.style.display = 'inline-block';
      return;
    }

    // clinic logo file upload change
    if (e.target && e.target.id === 'clinic-logo-upload') {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        loadedLogoBase64 = evt.target.result;
        const previewImg = document.getElementById('clinic-logo-preview');
        const previewName = document.getElementById('clinic-logo-name');
        const previewBox = document.getElementById('clinic-logo-preview-box');
        if (previewImg) previewImg.src = loadedLogoBase64;
        if (previewName) previewName.textContent = file.name;
        if (previewBox) previewBox.style.display = 'flex';
      };
      reader.readAsDataURL(file);
      return;
    }
  });
}
}

// Module-level supporting functions
function handleRoleChange(role) {
  const licenseGroup = document.getElementById('field-group-license');
  const phoneGroup = document.getElementById('field-group-phone');
  const licenseInput = document.getElementById('u-license');
  const phoneInput = document.getElementById('u-phone');
  const extraFieldsContainer = document.getElementById('doctor-extra-fields');

  if (!extraFieldsContainer) return;

  if (role === 'medico') {
    extraFieldsContainer.style.display = 'block';
    if (licenseGroup) licenseGroup.style.display = 'block';
    if (licenseInput) licenseInput.setAttribute('required', 'true');
    if (phoneGroup) phoneGroup.style.display = 'block';
    if (phoneInput) phoneInput.setAttribute('required', 'true');
  } else if (role === 'enfermero' || role === 'recepcionista' || role === 'laboratorista') {
    extraFieldsContainer.style.display = 'block';
    if (licenseGroup) licenseGroup.style.display = 'none';
    if (licenseInput) licenseInput.removeAttribute('required');
    if (phoneGroup) phoneGroup.style.display = 'block';
    if (phoneInput) phoneInput.setAttribute('required', 'true');
  } else {
    extraFieldsContainer.style.display = 'none';
    if (licenseGroup) licenseGroup.style.display = 'none';
    if (licenseInput) licenseInput.removeAttribute('required');
    if (phoneGroup) phoneGroup.style.display = 'none';
    if (phoneInput) phoneInput.removeAttribute('required');
  }
}

function renderUsersList() {
  const container = document.getElementById('users-list-container');
  if (!container) return;

  container.innerHTML = '';
  const appState = getAppState();

  appState.users.forEach(u => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 12px 16px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    let roleIcon = '👤';
    if (u.role && (u.role.includes('Médico') || u.role.includes('medico'))) roleIcon = '🩺';
    else if (u.role === 'Enfermera' || u.role === 'enfermero') roleIcon = '🫁';
    else if (u.role === 'Recepcionista' || u.role === 'recepcionista') roleIcon = '📞';
    else if (u.role === 'Administrador' || u.role === 'administrador') roleIcon = '⚙️';
    else if (u.role && u.role.includes('Farmacia')) roleIcon = '🏪';
    else if (u.role && (u.role.includes('Laboratorio') || u.role.includes('Laboratorista') || u.role.includes('laboratorista'))) roleIcon = '🔬';

    const modulesList = u.modules && u.modules.length > 0 ? u.modules.join(', ') : 'Todos';

    card.innerHTML = `
      <div>
        <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">
          ${roleIcon} ${u.name}
        </div>
        <div style="font-size: 0.8rem; color: var(--accent-primary); text-transform: uppercase; margin-top: 2px;">
          Rol: ${u.role}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
          ${u.license ? `Lic/Col: <strong>${u.license}</strong> | ` : ''}Tel: <strong>${u.phone || 'N/A'}</strong> | Clave: <strong>${u.password || 'Glol5414'}</strong>
        </div>
        <div style="font-size: 0.72rem; color: var(--accent-secondary); margin-top: 2px;">
          Módulos: <strong>${modulesList}</strong>
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary btn-small btn-edit-user" data-id="${u.id}" style="padding: 4px 8px; font-size: 0.8rem;" title="Editar Usuario">✏️</button>
        <button class="btn btn-danger btn-small btn-delete-user" data-id="${u.id}" style="padding: 4px 8px; font-size: 0.8rem;" title="Eliminar Usuario">&times;</button>
      </div>
    `;

    container.appendChild(card);
  });
}

function openCatalogConfig(type) {
  console.log(`[openCatalogConfig] Abriendo modal para tipo: ${type}`);
  activeCatalogType = type;

  const configModal = document.getElementById('config-catalog-modal');
  const configTitle = document.getElementById('config-catalog-title');
  const configForm = document.getElementById('config-item-form');
  const configSpecificFields = document.getElementById('config-specific-fields');
  const thExtraCol = document.getElementById('th-extra-col');
  
  if (!configModal || !configForm) {
    console.error("No se encontraron los elementos del modal config-catalog-modal");
    return;
  }

  // Resetear formulario
  configForm.reset();
  document.getElementById('config-item-id').value = '';
  document.getElementById('config-form-title').textContent = "Agregar Nuevo Item";

  // Resetear área de importación
  const importFile = document.getElementById('config-catalog-import-file');
  const importFileName = document.getElementById('import-file-name');
  const btnProcessImport = document.getElementById('btn-process-import-file');
  if (importFile) importFile.value = '';
  if (importFileName) importFileName.textContent = 'Ningún archivo seleccionado';
  if (btnProcessImport) btnProcessImport.style.display = 'none';

  // Mostrar modal
  configModal.style.display = 'flex';

  // Ajustar campos específicos
  if (type === 'medications') {
    configTitle.textContent = "💊 Gestión de Catálogo de Farmacia";
    thExtraCol.textContent = "Presentación / Categoría";
    configSpecificFields.innerHTML = `
      <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom:0;">
        <label for="c-spec-generic">Nombre Genérico</label>
        <input type="text" id="c-spec-generic" required placeholder="Ej. Paracetamol">
      </div>
      <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom:0;">
        <label for="c-spec-presentation">Presentación</label>
        <input type="text" id="c-spec-presentation" required placeholder="Ej. Tabletas 500mg, Jarabe...">
      </div>
      <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom:0;">
        <label for="c-spec-category">Categoría</label>
        <input type="text" id="c-spec-category" required placeholder="Ej. Analgésicos, Antibióticos...">
      </div>
      <div class="form-group" style="flex: 1; min-width: 100px; margin-bottom:0;">
        <label for="c-spec-stock">Existencia (Stock)</label>
        <input type="number" id="c-spec-stock" required min="0" value="100" placeholder="Ej. 100">
      </div>
      <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom:0;">
        <label for="c-spec-lote">Número de Lote</label>
        <input type="text" id="c-spec-lote" required placeholder="Ej. LT-8902">
      </div>
      <div class="form-group" style="flex: 1; min-width: 130px; margin-bottom:0;">
        <label for="c-spec-vencimiento">Fecha de Vencimiento</label>
        <input type="date" id="c-spec-vencimiento" required>
      </div>
    `;
  } else if (type === 'laboratoryTests') {
    configTitle.textContent = "🔬 Catálogo de Laboratorio y Precios";
    if (thExtraCol) thExtraCol.textContent = "Categoría del Examen";
    configSpecificFields.innerHTML = `
      <div class="form-group" style="flex: 1; min-width: 160px; margin-bottom:0;">
        <label for="c-spec-category">Categoría del Examen</label>
        <input type="text" id="c-spec-category" required placeholder="Ej. Perfil Lipídico, Hematología...">
      </div>
      <div class="form-group" style="flex: 1; min-width: 140px; margin-bottom:0;">
        <label for="c-spec-unit">Unidades</label>
        <input type="text" id="c-spec-unit" placeholder="Ej. mg/dL, UI/mL, %, g/dL...">
      </div>
      <div class="form-group" style="flex: 1.5; min-width: 200px; margin-bottom:0;">
        <label for="c-spec-reference">Intervalo de Referencia</label>
        <input type="text" id="c-spec-reference" placeholder="Ej. 70 - 100 mg/dL, < 150, Negativo...">
      </div>
    `;
  } else if (type === 'imagingStudies') {
    configTitle.textContent = "🖼️ Catálogo de Imagenología y Precios";
    thExtraCol.textContent = "Categoría del Estudio";
    configSpecificFields.innerHTML = `
      <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom:0;">
        <label for="c-spec-category">Categoría (Rayos X, USG, TC, RMN...)</label>
        <input type="text" id="c-spec-category" required placeholder="Ej. Ultrasonografía, Radiología...">
      </div>
    `;
  } else if (type === 'consultationTypes') {
    configTitle.textContent = "🩺 Tarifario de Consultas Médicas";
    thExtraCol.textContent = "Especialidad / Detalle";
    configSpecificFields.innerHTML = `
      <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom:0;">
        <label for="c-spec-specialty">Especialidad</label>
        <input type="text" id="c-spec-specialty" required placeholder="Ej. Medicina General, Pediatría, Cardiología...">
      </div>
    `;
  }

  renderCatalogTable();
}

function renderCatalogTable() {
  const configTableHead = document.querySelector('#config-catalog-modal table thead');
  const configTableBody = document.getElementById('config-catalog-table-body');
  if (!configTableBody) return;
  configTableBody.innerHTML = '';

  const isLab = activeCatalogType === 'laboratoryTests';

  if (configTableHead) {
    if (isLab) {
      configTableHead.innerHTML = `
        <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-size: 0.85rem;">
          <th style="padding: 10px;">Nombre del Examen</th>
          <th style="padding: 10px;">Categoría</th>
          <th style="padding: 10px;">Unidades</th>
          <th style="padding: 10px;">Intervalo de Referencia</th>
          <th style="padding: 10px; text-align: right; width: 120px;">Precio (Q)</th>
          <th style="padding: 10px; text-align: center; width: 90px;">Acciones</th>
        </tr>
      `;
    } else {
      configTableHead.innerHTML = `
        <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-size: 0.85rem;">
          <th style="padding: 10px;">Nombre</th>
          <th id="th-extra-col" style="padding: 10px;">${activeCatalogType === 'medications' ? 'Presentación / Categoría' : (activeCatalogType === 'imagingStudies' ? 'Categoría del Estudio' : 'Especialidad / Detalle')}</th>
          <th style="padding: 10px; text-align: right;">Precio</th>
          <th style="padding: 10px; text-align: center; width: 120px;">Acciones</th>
        </tr>
      `;
    }
  }

  const appState = getAppState();
  const list = appState[activeCatalogType] || [];

  if (list.length === 0) {
    configTableBody.innerHTML = `
      <tr>
        <td colspan="${isLab ? 6 : 4}" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          No hay elementos registrados en este catálogo.
        </td>
      </tr>
    `;
    return;
  }

  list.forEach(item => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-color)';

    if (isLab) {
      const unitText = item.unit || item.units || 'N/A';
      const refText = item.reference || item.referenceInterval || item.normal || 'N/A';
      const priceVal = parseFloat(item.price || 0).toFixed(2);

      tr.innerHTML = `
        <td style="padding: 10px 8px;"><strong>${item.name}</strong></td>
        <td style="padding: 10px 8px;"><span style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 500;">${item.category || 'General'}</span></td>
        <td style="padding: 10px 8px; font-size: 0.85rem; color: var(--text-muted);">${unitText}</td>
        <td style="padding: 10px 8px; font-size: 0.85rem; color: var(--text-muted);">${refText}</td>
        <td style="padding: 10px 8px; text-align: right;">
          <div style="display: inline-flex; align-items: center; gap: 4px;">
            <span style="color: var(--accent-success); font-weight: bold; font-size: 0.85rem;">Q</span>
            <input type="number" step="0.5" min="0" class="catalog-price-input" data-id="${item.id}" value="${priceVal}" style="width: 80px; text-align: right; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--accent-success); font-weight: bold; font-size: 0.9rem;">
          </div>
        </td>
        <td style="padding: 10px 8px; text-align: center;">
          <button class="btn btn-secondary btn-small btn-edit-config" data-id="${item.id}" style="padding: 4px 8px; font-size: 0.8rem; margin-right: 4px;">✏️</button>
          <button class="btn btn-danger btn-small btn-delete-config" data-id="${item.id}" style="padding: 4px 8px; font-size: 0.8rem;">&times;</button>
        </td>
      `;
    } else {
      let nameCellHtml = '';
      let extraCellHtml = '';

      if (activeCatalogType === 'medications') {
        const expirationDateStr = item.vencimiento ? new Date(item.vencimiento).toLocaleDateString('es-GT') : 'N/D';
        nameCellHtml = `<strong>${item.name}</strong><br><span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Genérico: ${item.generic || 'N/D'}</span>`;
        extraCellHtml = `
          ${item.presentation || 'N/A'} | <span style="font-size: 0.75rem; color: var(--accent-primary); text-transform: uppercase;">${item.category || ''}</span><br>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Lote: ${item.lote || 'N/D'} | Vence: ${expirationDateStr}</span><br>
          <span style="font-size: 0.8rem; font-weight: bold; color: ${item.stock <= 0 ? 'var(--accent-danger)' : 'var(--accent-success)'};">Stock: ${item.stock !== undefined ? item.stock : 120}</span>
        `;
      } else if (activeCatalogType === 'imagingStudies') {
        nameCellHtml = `<strong>${item.name}</strong>`;
        extraCellHtml = `${item.category || 'General'}`;
      } else if (activeCatalogType === 'consultationTypes') {
        nameCellHtml = `<strong>${item.name}</strong>`;
        extraCellHtml = `${item.specialty || 'General'}`;
      }

      tr.innerHTML = `
        <td style="padding: 10px 8px;">${nameCellHtml}</td>
        <td style="padding: 10px 8px;">${extraCellHtml}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: var(--accent-success);">Q${parseFloat(item.price).toFixed(2)}</td>
        <td style="padding: 10px 8px; text-align: center;">
          <button class="btn btn-secondary btn-small btn-edit-config" data-id="${item.id}" style="padding: 4px 8px; font-size: 0.8rem; margin-right: 4px;">✏️</button>
          <button class="btn btn-danger btn-small btn-delete-config" data-id="${item.id}" style="padding: 4px 8px; font-size: 0.8rem;">&times;</button>
        </td>
      `;
    }

    configTableBody.appendChild(tr);
  });
}

function processFileImport() {
  if (!selectedImportFile) {
    alert("Debe seleccionar un archivo primero.");
    return;
  }

  const file = selectedImportFile;
  const reader = new FileReader();
  const extension = file.name.split('.').pop().toLowerCase();

  if (extension === 'xlsx' || extension === 'xls') {
    reader.onload = function(evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        processImportedRows(rows);
      } catch (err) {
        console.error(err);
        alert("❌ Error al procesar el archivo Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
  } else if (extension === 'docx') {
    reader.onload = function(evt) {
      const arrayBuffer = evt.target.result;
      const mammothObj = mammoth || window.mammoth;

      if (!mammothObj) {
        alert("❌ Error: Módulo de lectura de Word no disponible.");
        return;
      }

      mammothObj.convertToHtml({ arrayBuffer: arrayBuffer })
        .then(function(result) {
          const html = result.value;
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const table = doc.querySelector('table');
          const rows = [];
          if (table) {
            table.querySelectorAll('tr').forEach(tr => {
              const cells = [];
              tr.querySelectorAll('td, th').forEach(cell => {
                cells.push((cell.innerText || cell.textContent || '').trim());
              });
              if (cells.some(c => c.length > 0)) {
                rows.push(cells);
              }
            });
            processImportedRows(rows);
          } else {
            const paragraphs = doc.querySelectorAll('p, li, tr');
            const textRows = [];
            paragraphs.forEach(p => {
              const txt = (p.innerText || p.textContent || '').trim();
              if (txt) {
                const parts = txt.split(/[-,\t|]/).map(x => x.trim());
                if (parts.length > 0 && parts.some(x => x.length > 0)) {
                  textRows.push(parts);
                }
              }
            });
            processImportedRows(textRows);
          }
        })
        .catch(function(err) {
          console.error('Error parsing docx:', err);
          alert("❌ Error al procesar el archivo Word: " + (err.message || err));
        });
    };
    reader.readAsArrayBuffer(file);
  }
}

function processImportedRows(rows) {
  if (!rows || rows.length === 0) {
    alert("No se encontraron registros en el archivo.");
    return;
  }

  const appState = getAppState();
  let catalog = appState[activeCatalogType] || [];
  let count = 0;

  const headerRow = rows[0] || [];
  let nameIdx = 0;
  let priceIdx = -1;
  let genericIdx = -1;
  let presentationIdx = -1;
  let categoryIdx = -1;
  let specialtyIdx = -1;
  let unitIdx = -1;
  let referenceIdx = -1;

  headerRow.forEach((col, idx) => {
    if (col !== undefined && col !== null) {
      const text = String(col).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (text.includes("nombre") || text.includes("estudio") || text.includes("examen") || text.includes("producto") || text.includes("servicio") || text.includes("medicamento") || text.includes("item")) {
        nameIdx = idx;
      } else if (text.includes("precio") || text.includes("costo") || text.includes("valor") || text.includes("honorario") || text.includes("tarifa")) {
        priceIdx = idx;
      } else if (text.includes("generico")) {
        genericIdx = idx;
      } else if (text.includes("presentacion")) {
        presentationIdx = idx;
      } else if (text.includes("categoria") || text.includes("grupo")) {
        categoryIdx = idx;
      } else if (text.includes("especialidad")) {
        specialtyIdx = idx;
      } else if (text.includes("unidad") || text.includes("unidades") || text.includes("unit") || text.includes("medida")) {
        unitIdx = idx;
      } else if (text.includes("referencia") || text.includes("intervalo") || text.includes("rango") || text.includes("normal") || text.includes("limite")) {
        referenceIdx = idx;
      }
    }
  });

  const newItemsList = [];
  const startRow = (priceIdx === -1 && genericIdx === -1 && categoryIdx === -1 && unitIdx === -1 && referenceIdx === -1) ? 0 : 1;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const nameVal = row[nameIdx];
    if (!nameVal || String(nameVal).trim() === '') continue;

    // Omitir fila si es el encabezado repetido
    const checkHeaderStr = String(nameVal).toLowerCase();
    if (checkHeaderStr.includes("nombre") || checkHeaderStr.includes("medicamento") || checkHeaderStr.includes("estudio") || checkHeaderStr.includes("examen")) {
      if (i === 0) continue;
    }

    let priceVal = 50.00;
    if (priceIdx !== -1 && row[priceIdx] !== undefined) {
      const parsedPrice = parseFloat(String(row[priceIdx]).replace(/[^\d\.]/g, ''));
      if (!isNaN(parsedPrice)) priceVal = parsedPrice;
    } else {
      for (let j = 1; j < row.length; j++) {
        if (row[j] !== undefined && typeof row[j] === 'number') {
          priceVal = row[j];
          break;
        } else if (row[j] !== undefined) {
          const num = parseFloat(String(row[j]).replace(/[^\d\.]/g, ''));
          if (!isNaN(num) && num > 0) {
            priceVal = num;
            break;
          }
        }
      }
    }

    const prefix = activeCatalogType === 'medications' ? 'm-' :
                   activeCatalogType === 'laboratoryTests' ? 'l-' :
                   activeCatalogType === 'imagingStudies' ? 'i-' : 'c-';
    
    const newId = prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

    const newItem = {
      id: newId,
      name: String(nameVal).trim(),
      price: priceVal
    };

    if (activeCatalogType === 'medications') {
      newItem.generic = genericIdx !== -1 && row[genericIdx] ? String(row[genericIdx]).trim() : String(nameVal).trim();
      newItem.presentation = presentationIdx !== -1 && row[presentationIdx] ? String(row[presentationIdx]).trim() : "Tabletas";
      newItem.category = categoryIdx !== -1 && row[categoryIdx] ? String(row[categoryIdx]).trim() : "Farmacia";
      newItem.stock = 120;
      newItem.lote = 'L-IMP-' + Math.floor(1000 + Math.random() * 9000);
      newItem.vencimiento = '2027-06-30';
    } else if (activeCatalogType === 'laboratoryTests') {
      newItem.category = categoryIdx !== -1 && row[categoryIdx] ? String(row[categoryIdx]).trim() : "General";
      newItem.unit = unitIdx !== -1 && row[unitIdx] ? String(row[unitIdx]).trim() : "N/A";
      newItem.reference = referenceIdx !== -1 && row[referenceIdx] ? String(row[referenceIdx]).trim() : "N/A";
      newItem.parameters = [
        { name: "Resultado General", unit: newItem.unit, normal: newItem.reference }
      ];
    } else if (activeCatalogType === 'imagingStudies') {
      newItem.category = categoryIdx !== -1 && row[categoryIdx] ? String(row[categoryIdx]).trim() : "General";
    } else if (activeCatalogType === 'consultationTypes') {
      newItem.specialty = specialtyIdx !== -1 && row[specialtyIdx] ? String(row[specialtyIdx]).trim() : "Medicina General";
    }

    catalog.unshift(newItem);
    newItemsList.push(newItem);
    count++;
  }

  // Guardar estado localmente
  appState[activeCatalogType] = catalog;
  localStorage.setItem('medflow_db', JSON.stringify(appState));
  
  // Renderizar la tabla de inmediato
  renderCatalogTable();
  
  // Reset de campos de importación
  const importFile = document.getElementById('config-catalog-import-file');
  const importFileName = document.getElementById('import-file-name');
  const btnProcessImport = document.getElementById('btn-process-import-file');
  if (importFile) importFile.value = '';
  selectedImportFile = null;
  if (importFileName) importFileName.textContent = 'Ningún archivo seleccionado';
  if (btnProcessImport) btnProcessImport.style.display = 'none';

  // Guardar en Firestore en segundo plano usando lotes asíncronos para evitar bloquear el hilo principal
  if (newItemsList.length > 0) {
    (async () => {
      try {
        const chunkSize = 500;
        for (let i = 0; i < newItemsList.length; i += chunkSize) {
          const chunk = newItemsList.slice(i, i + chunkSize);
          await saveDocumentsBatch(activeCatalogType, chunk);
        }
        alert(`🎉 Éxito: Se importaron ${count} elementos correctamente al catálogo.`);
      } catch (err) {
        console.error("Error al guardar lote en Firestore:", err);
        alert("❌ Error al sincronizar los elementos importados con la base de datos en la nube.");
      }
    })();
  } else {
    alert("No se encontraron registros nuevos para importar.");
  }
}

// ==========================================
// BASE DE DATOS IMPORT / EXPORT MODALS & ACTIONS
// ==========================================

function renderExportModal() {
  let modal = document.getElementById('db-export-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'db-export-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 520px; width: 90%;">
      <div class="modal-header">
        <h2 style="font-family: var(--font-heading); color: var(--accent-primary);">Exportar Base de Datos</h2>
        <button class="modal-close" id="close-export-modal">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1.5rem;">
        <p style="margin-bottom: 1.5rem; color: var(--text-primary); line-height: 1.5;">
          Selecciona el formato en el que deseas exportar toda la información del consultorio (Clínica, Usuarios, Pacientes, Historiales, Consultas, Recetas, Facturación / Comprobantes, Inventarios y Ventas de Farmacia):
        </p>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <button type="button" class="btn btn-primary" id="btn-export-json" style="padding: 1rem; text-align: left; display: flex; justify-content: space-between; align-items: center; border-radius: var(--radius-sm);">
            <div>
              <div style="font-weight: bold; font-size: 1rem;">📄 Formato JSON (.json)</div>
              <div style="font-size: 0.75rem; opacity: 0.85;">Respaldo estructurado de alta fidelidad para migración completa del sistema.</div>
            </div>
            <span style="font-size: 1.5rem;">⬇️</span>
          </button>

          <button type="button" class="btn btn-success" id="btn-export-excel" style="padding: 1rem; text-align: left; display: flex; justify-content: space-between; align-items: center; border-radius: var(--radius-sm);">
            <div>
              <div style="font-weight: bold; font-size: 1rem;">📊 Formato EXCEL (.xlsx)</div>
              <div style="font-size: 0.75rem; opacity: 0.85;">Libro de cálculo con hojas ordenadas por Pacientes, Facturación, Recetas e Inventario.</div>
            </div>
            <span style="font-size: 1.5rem;">⬇️</span>
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="cancel-export-modal">Cancelar</button>
      </div>
    </div>
  `;

  document.getElementById('close-export-modal').onclick = () => modal.style.display = 'none';
  document.getElementById('cancel-export-modal').onclick = () => modal.style.display = 'none';

  document.getElementById('btn-export-json').onclick = () => {
    modal.style.display = 'none';
    exportDatabaseJSON();
  };

  document.getElementById('btn-export-excel').onclick = () => {
    modal.style.display = 'none';
    exportDatabaseExcel();
  };
}

function exportDatabaseJSON() {
  const state = getAppState();
  const jsonStr = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `LUGAMED_BaseDeDatos_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportDatabaseExcel() {
  if (typeof XLSX === 'undefined') {
    alert("La librería para exportación a Excel no está disponible.");
    return;
  }

  const state = getAppState();
  const wb = XLSX.utils.book_new();

  // 1. Información Clínica
  const clinicData = [{
    'Nombre Clínica': state.clinicInfo ? state.clinicInfo.name : '',
    'Dirección': state.clinicInfo ? state.clinicInfo.address : '',
    'Teléfono': state.clinicInfo ? state.clinicInfo.phone : '',
    'Correo Electrónico': state.clinicInfo ? state.clinicInfo.email : ''
  }];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clinicData), "Información Clínica");

  // 2. Usuarios y Roles
  const usersData = (state.users || []).map(u => ({
    'ID Usuario': u.id,
    'Nombre': u.name,
    'Rol': u.role,
    'Colegiado': u.license || 'N/A',
    'Especialidad': u.specialty || 'N/A',
    'Teléfono': u.phone || 'N/A'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usersData.length ? usersData : [{ 'Info': 'Sin registros' }]), "Usuarios");

  // 3. Pacientes
  const patientsData = (state.patients || []).map(p => ({
    'ID Expediente': p.id,
    'Nombre Completo': p.name,
    'DPI': p.dpi || 'N/A',
    'Fecha Nacimiento': p.birthdate,
    'Género': p.gender,
    'Teléfono': p.telephone,
    'Dirección': p.address,
    'Médico Tratante': p.assignedDoctorName || 'N/A'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patientsData.length ? patientsData : [{ 'Info': 'Sin registros' }]), "Pacientes");

  // 4. Consultas Médicas
  const consultationsData = [];
  (state.patients || []).forEach(p => {
    (p.consultations || []).forEach(c => {
      consultationsData.push({
        'ID Consulta': c.id,
        'Fecha': c.date,
        'ID Paciente': p.id,
        'Paciente': p.name,
        'Médico Evaluador': c.doctor,
        'Especialidad': c.specialty,
        'Motivo': c.reason,
        'Síntomas': c.symptoms,
        'Diagnósticos': c.diagnoses ? c.diagnoses.map(d => `${d.code} - ${d.description}`).join('; ') : '',
        'Costo (Q)': c.fee
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consultationsData.length ? consultationsData : [{ 'Info': 'Sin registros' }]), "Consultas Médicas");

  // 5. Recetas Emitidas
  const recipesData = [];
  (state.patients || []).forEach(p => {
    (p.prescriptions || []).forEach(r => {
      recipesData.push({
        'ID Receta': r.id,
        'Fecha': r.date,
        'ID Paciente': p.id,
        'Paciente': p.name,
        'Médico Prescribe': r.doctorName,
        'Colegiado': r.doctorLicense,
        'Medicamentos': r.medicines ? r.medicines.map(m => `${m.name} (${m.dosage || ''})`).join('; ') : '',
        'Indicaciones': r.indications || ''
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recipesData.length ? recipesData : [{ 'Info': 'Sin registros' }]), "Recetas Emitidas");

  // 6. Facturación y Comprobantes (REQUERIDO)
  const billingData = [];
  (state.patients || []).forEach(p => {
    (p.billingHistory || []).forEach(b => {
      billingData.push({
        'No. Factura / Comprobante': b.id,
        'Fecha Emisión': b.date,
        'ID Paciente': p.id,
        'Nombre Paciente': p.name,
        'Concepto Principal': b.concept,
        'Diagnóstico': b.diagnosis || 'N/A',
        'Estado': b.status === 'pagado' ? 'Pagado' : 'Pendiente',
        'Detalles': b.details ? b.details.map(d => `${d.concept || d.name} (Q${d.total ? d.total.toFixed(2) : 0})`).join('; ') : '',
        'Monto Total (Q)': b.total
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(billingData.length ? billingData : [{ 'Info': 'Sin registros' }]), "Facturación y Comprobantes");

  // 7. Inventario Farmacia
  const medicationsData = (state.medications || []).map(m => ({
    'ID': m.id,
    'Nombre Medicamento': m.name,
    'Presentación': m.presentation || '',
    'Categoría': m.category || '',
    'Precio Venta (Q)': m.price,
    'Stock': m.stock,
    'Lote': m.lote || 'N/A',
    'Fecha Vencimiento': m.vencimiento || 'N/A'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(medicationsData.length ? medicationsData : [{ 'Info': 'Sin registros' }]), "Inventario Farmacia");

  // 8. Ventas de Farmacia (Despachos y Ventas Directas)
  const salesData = (state.pharmacySales || []).map(s => ({
    'ID Venta': s.id,
    'Fecha': s.date,
    'Tipo': s.type === 'receta' ? 'Despacho de Receta' : 'Venta Externa',
    'Cliente / Paciente': s.patientName || s.buyerName || 'Cliente General',
    'Detalle Productos': s.items ? s.items.map(i => `${i.name} (Cant: ${i.qty})`).join('; ') : '',
    'Monto Total (Q)': s.total
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData.length ? salesData : [{ 'Info': 'Sin registros' }]), "Ventas Farmacia");

  // 9. Catálogos (Laboratorios, Imagenología)
  const labsCatalog = (state.laboratoryTests || []).map(l => ({ 'ID': l.id, 'Examen': l.name, 'Categoría': l.category || '', 'Precio (Q)': l.price }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(labsCatalog.length ? labsCatalog : [{ 'Info': 'Sin registros' }]), "Catálogo Laboratorios");

  const imgCatalog = (state.imagingStudies || []).map(i => ({ 'ID': i.id, 'Estudio': i.name, 'Categoría': i.category || '', 'Precio (Q)': i.price }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(imgCatalog.length ? imgCatalog : [{ 'Info': 'Sin registros' }]), "Catálogo Imagenología");

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `LUGAMED_RespaldoCompleto_${dateStr}.xlsx`);
}

function renderImportModal() {
  let modal = document.getElementById('db-import-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'db-import-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 550px; width: 90%;">
      <div class="modal-header">
        <h2 style="font-family: var(--font-heading); color: var(--accent-secondary);">Importar Base de Datos</h2>
        <button class="modal-close" id="close-import-modal">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1.5rem;">
        <div style="background: rgba(255, 171, 0, 0.1); border: 1px solid rgba(255, 171, 0, 0.3); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
          <strong style="color: var(--accent-warning);">⚠️ Advertencia Importante:</strong>
          <p style="font-size: 0.85rem; color: var(--text-primary); margin-top: 4px; margin-bottom: 0;">
            Al importar una base de datos, se actualizarán los expedientes, facturaciones, inventarios y catálogos de la clínica.
          </p>
        </div>

        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label for="import-format-type">Seleccione el Formato del Archivo</label>
          <select id="import-format-type" style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: rgba(255,255,255,0.05); color: var(--text-primary);">
            <option value="json">📄 Archivo JSON (.json)</option>
            <option value="excel">📊 Archivo EXCEL (.xlsx)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label>Seleccionar Archivo de Respaldo</label>
          <input type="file" id="import-db-file-input" accept=".json" style="width: 100%; padding: 10px; border: 1px dashed var(--border-color); border-radius: var(--radius-sm); background: rgba(255,255,255,0.02);">
        </div>

        <div id="import-status-text" style="font-size: 0.85rem; color: var(--accent-success); display: none;"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="cancel-import-modal">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btn-process-db-import">Restaurar / Importar</button>
      </div>
    </div>
  `;

  const formatSelect = document.getElementById('import-format-type');
  const fileInput = document.getElementById('import-db-file-input');

  formatSelect.addEventListener('change', () => {
    if (formatSelect.value === 'json') {
      fileInput.accept = '.json';
    } else {
      fileInput.accept = '.xlsx, .xls';
    }
  });

  document.getElementById('close-import-modal').onclick = () => modal.style.display = 'none';
  document.getElementById('cancel-import-modal').onclick = () => modal.style.display = 'none';

  document.getElementById('btn-process-db-import').onclick = () => {
    if (!fileInput.files || fileInput.files.length === 0) {
      alert("Por favor, seleccione un archivo de respaldo.");
      return;
    }

    const file = fileInput.files[0];
    const format = formatSelect.value;

    if (format === 'json') {
      importDatabaseJSON(file, () => {
        modal.style.display = 'none';
      });
    } else {
      importDatabaseExcel(file, () => {
        modal.style.display = 'none';
      });
    }
  };
}

function importDatabaseJSON(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || typeof data !== 'object') {
        alert("El archivo JSON no contiene una estructura de datos válida.");
        return;
      }
      saveAppState(data);
      alert("¡Base de Datos importada con éxito desde JSON!");
      if (callback) callback();
      window.location.reload();
    } catch (err) {
      alert("Error al leer el archivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}

function importDatabaseExcel(file, callback) {
  if (typeof XLSX === 'undefined') {
    alert("La librería de Excel no está disponible.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const currentState = getAppState();

      // Helper for header detection
      const getSheetRows = (sheetName, keyWords) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return [];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        let hIdx = 0;
        for (let i = 0; i < rawRows.length; i++) {
          const rowStr = (rawRows[i] || []).join(' ');
          if (keyWords.some(k => rowStr.includes(k))) {
            hIdx = i;
            break;
          }
        }
        return XLSX.utils.sheet_to_json(sheet, { range: hIdx });
      };

      // Find sheets dynamically
      const findSheet = (namePattern) => {
        return workbook.SheetNames.find(s => s.toLowerCase().includes(namePattern.toLowerCase()));
      };

      const pacientesSheet = findSheet("Pacientes");
      if (pacientesSheet) {
        const pRows = getSheetRows(pacientesSheet, ["ID Paciente", "ID Expediente", "Nombre Completo"]);
        pRows.forEach(pr => {
          const pid = String(pr['ID Paciente'] || pr['ID Expediente'] || ('p-' + Math.random().toString(36).substr(2, 5)));
          const pname = pr['Nombre Completo'] || pr['Nombre'];
          if (!pname || String(pid).includes('TOTAL')) return;

          let pObj = currentState.patients.find(p => p.id === pid || p.name === pname);
          if (!pObj) {
            pObj = {
              id: pid,
              name: pname,
              dpi: String(pr['DPI / CUI'] || pr['DPI'] || 'No Presenta Documento'),
              birthdate: String(pr['Fecha Nacimiento'] || ''),
              gender: (String(pr['Sexo'] || pr['Género'] || '').toUpperCase().includes('H') || String(pr['Sexo'] || '').toUpperCase().includes('MASC')) ? 'Masculino' : 'Femenino',
              telephone: String(pr['Teléfono'] || '00000000'),
              address: String(pr['Dirección / Domicilio'] || pr['Dirección'] || 'Ciudad de Guatemala'),
              assignedDoctorName: pr['Médico Tratante'] || 'Dr. Carlos Montenegro',
              vitalSigns: [],
              consultations: [],
              appointments: [],
              prescriptions: [],
              billingHistory: []
            };
            currentState.patients.push(pObj);
          }
        });
      }

      // Farmacia
      const farmaciaSheet = findSheet("Inventario") || findSheet("Farmacia");
      if (farmaciaSheet) {
        const fRows = getSheetRows(farmaciaSheet, ["Código SKU", "Nombre Producto", "ID"]);
        if (fRows.length > 0) {
          fRows.forEach(fr => {
            const mname = fr['Nombre Producto / Medicamento'] || fr['Nombre Medicamento'] || fr['Nombre'];
            if (!mname || String(mname).includes('TOTAL')) return;

            const existing = currentState.medications.find(m => m.name === mname);
            if (!existing) {
              currentState.medications.push({
                id: 'm-' + (currentState.medications.length + 1),
                sku: String(fr['Código SKU'] || fr['ID'] || 'MED-' + Date.now()),
                name: mname,
                category: fr['Categoría / Clasificación'] || fr['Categoría'] || 'Farmacia',
                stock: parseInt(fr['Stock Actual'] || fr['Stock']) || 100,
                price: parseFloat(fr['Precio Venta Unitario'] || fr['Precio Venta (Q)']) || 25.0,
                lote: fr['Lote'] || 'L-MED-100',
                vencimiento: fr['Fecha Vencimiento'] || '2027-12-31'
              });
            }
          });
        }
      }

      saveAppState(currentState);
      alert("¡Base de datos importada correctamente desde el archivo Excel!");
      if (callback) callback();
      window.location.reload();
    } catch (err) {
      alert("Error al procesar el archivo Excel: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}
