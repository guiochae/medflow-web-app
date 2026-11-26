// src/modules/configuracion.js
import { getAppState, saveAppState, saveCatalogDirectly, removeFromFirestore, purgeAllDatabases, saveDocumentsBatch, purgeCollectionFromFirestore, resetToOfficialDatabase } from '../main.js';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { findExistingPatientByDpi, isGenericDpi } from '../utils/patientDpiValidator.js';

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
          <div class="form-group" style="margin-top: 1rem;">
            <label for="c-info-whatsapp-url">Servidor de WhatsApp Bridge (Opcional)</label>
            <input type="url" id="c-info-whatsapp-url" value="${state.clinicInfo.whatsappBridgeUrl || 'http://localhost:3001'}" placeholder="Ej. http://localhost:3001">
            <small style="color: var(--text-muted); display: block; margin-top: 4px;">Indica el puerto o dirección IP de la máquina donde se ejecuta el puente de WhatsApp (ej. si usas ngrok para acceso externo).</small>
          </div>
          
          <!-- Panel de Estado y Conexión de WhatsApp Bridge -->
          <div id="whatsapp-bridge-status-card" style="margin-top: 1.5rem; padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.03); box-shadow: 0 4px 6px rgba(0,0,0,0.15);">
            <h4 style="margin: 0 0 10px 0; font-size: 0.9rem; color: var(--accent-primary); display: flex; align-items: center; gap: 8px;">
              <span>📱</span> Estado de Conexión de WhatsApp (Panel Interactivo)
            </h4>
            <div id="whatsapp-bridge-status-content" style="font-size: 0.82rem; color: var(--text-muted);">
              Cargando estado del servidor de WhatsApp...
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
                    <input type="checkbox" class="u-module-cb" value="encamamiento" checked> 🛌 Encamamiento
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-transform: none; color: var(--text-primary);">
                    <input type="checkbox" class="u-module-cb" value="quirofano" checked> 🏥 Quirófano
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; text-transform: none; color: var(--text-primary);">
                    <input type="checkbox" class="u-module-cb" value="administracion" checked> 🏢 Administración
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
          
          <button class="btn btn-secondary" id="btn-config-room-rates" style="
            padding: 2rem 1.5rem; 
            font-size: 1.1rem; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            gap: 12px; 
            width: 180px;
            background: linear-gradient(135deg, rgba(142, 68, 173, 0.15) 0%, rgba(142, 68, 173, 0.05) 100%);
            border: 1px solid #8e44ad;
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.2s;
          ">
            <span style="font-size: 2.8rem;">🛏️</span>
            <strong style="color: var(--text-primary);">Habitaciones</strong>
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

          <!-- Tarjeta Restablecer Base de Datos Oficial -->
          <div style="background: rgba(16, 185, 129, 0.04); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔄</div>
              <h4 style="color: #10b981; font-size: 1.2rem; margin-bottom: 0.5rem;">Restablecer Base de Datos Oficial</h4>
              <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
                Restaura de inmediato todos los <strong>51 pacientes registrados</strong> con sus historiales clínicos, signos vitales, consultas y recetas, así como la plantilla completa de los <strong>13 usuarios médicos y de enfermería</strong> oficiales del hospital, sincronizándolos en la nube y localmente.
              </p>
            </div>
            <button type="button" class="btn" id="btn-trigger-restore-official-db" style="margin-top: 1.5rem; width: 100%; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; font-weight: 700; padding: 12px; border-radius: var(--radius-sm); cursor: pointer;">
              <span>🔄</span> Restablecer Pacientes y Usuarios Oficiales
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
      <div class="modal-content" style="max-width: 900px; width: 92%;">
        <div class="modal-header">
          <h2 id="config-catalog-title">Gestión de Catálogo</h2>
          <button class="modal-close" id="btn-close-config-catalog">&times;</button>
        </div>
        <div class="modal-body" style="max-height: 520px; overflow-y: auto; padding: 1.5rem;">
          
          <!-- Formulario para agregar / editar item -->
          <div id="config-item-form-area" class="glass-card" style="margin-bottom: 1.5rem; padding: 1.25rem; border-top: 3px solid var(--accent-primary); background: rgba(255, 255, 255, 0.01);">
            <h4 id="config-form-title" style="margin-bottom: 10px; color: var(--accent-primary);">Agregar Nuevo Item</h4>
            <form id="config-item-form" style="display: flex; flex-direction: column; gap: 12px;">
              <input type="hidden" id="config-item-id">
              
              <div id="config-standard-top-row" style="display: flex; gap: 15px; flex-wrap: wrap;">
                <div class="form-group" style="flex: 2; min-width: 200px; position: relative;">
                  <label for="config-item-name" id="lbl-item-name">Nombre</label>
                  <input type="text" id="config-item-name" required placeholder="Ej. Acetaminofén, Hemograma, Rx Tórax..." autocomplete="off">
                  <div id="config-item-autocomplete-list" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 1200; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 200px; overflow-y: auto; display: none; box-shadow: var(--shadow-lg); margin-top: 4px; backdrop-filter: blur(10px);"></div>
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
        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <button type="button" class="btn" id="btn-purge-this-catalog" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; border: none; font-weight: 700; font-size: 0.85rem; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; display: none;">
            <span>🗑️</span> Vaciar Catálogo Completo
          </button>
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

  // Polling del estado de WhatsApp Bridge
  const updateWhatsAppBridgeStatus = () => {
    const statusContainer = document.getElementById('whatsapp-bridge-status-content');
    if (!statusContainer) {
      if (window.whatsappBridgeStatusInterval) {
        clearInterval(window.whatsappBridgeStatusInterval);
        window.whatsappBridgeStatusInterval = null;
      }
      return;
    }

    const bridgeUrl = (state.clinicInfo && state.clinicInfo.whatsappBridgeUrl) || 'http://localhost:3001';

    fetch(`${bridgeUrl}/api/status`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!document.getElementById('whatsapp-bridge-status-content')) return;
        if (data.isReady) {
          statusContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: var(--accent-success);"></span>
              <strong style="color: var(--accent-success);">Conectado y Listo</strong>
            </div>
            <p style="margin: 8px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">El microservicio de WhatsApp Web está autenticado. Las notificaciones se enviarán automáticamente en segundo plano al registrar pacientes.</p>
          `;
        } else if (data.qr) {
          statusContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: var(--accent-secondary);"></span>
              <strong style="color: var(--accent-secondary);">Pendiente de Autenticación (Escanear QR)</strong>
            </div>
            <p style="margin: 0 0 12px 0; font-size: 0.8rem;">Escanea este código QR con la cámara de tu celular desde la aplicación de WhatsApp (**Dispositivos vinculados > Vincular un dispositivo**) para iniciar la sesión:</p>
            <div style="display: flex; justify-content: center; background: white; padding: 15px; border-radius: 6px; width: fit-content; margin: 10px auto;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.qr)}" style="width: 250px; height: 250px; display: block;" alt="WhatsApp QR Code">
            </div>
            <small style="color: var(--text-muted); display: block; text-align: center; margin-top: 4px;">El código QR se actualizará automáticamente en pantalla si expira.</small>
          `;
        } else {
          statusContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: var(--text-muted);"></span>
              <strong style="color: var(--text-primary);">Iniciando cliente de WhatsApp...</strong>
            </div>
            <p style="margin: 8px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">El servidor de WhatsApp está levantado pero está arrancando el navegador Chrome interno. Espera unos segundos...</p>
          `;
        }
      })
      .catch(err => {
        if (!document.getElementById('whatsapp-bridge-status-content')) return;
        statusContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: var(--accent-danger);"></span>
            <strong style="color: var(--accent-danger);">Servidor Desconectado / Fuera de Línea</strong>
          </div>
          <p style="margin: 8px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">No se pudo establecer conexión con el puente de WhatsApp en <code>${bridgeUrl}</code>.</p>
          <div style="margin-top: 10px; font-size: 0.78rem; background: rgba(239, 68, 68, 0.05); padding: 8px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.1);">
            <strong>Posibles razones:</strong><br>
            1. El servidor microservicio local no se está ejecutando (corre <code>npm start</code> en la carpeta <code>whatsapp-bridge</code>).<br>
            2. Si estás accediendo desde otra computadora, asegúrate de que el campo de arriba apunte a la IP correcta del servidor (ej. <code>http://192.168.1.5:3001</code>) o que tengas tu túnel ngrok configurado y activo.
          </div>
        `;
      });
  };

  if (window.whatsappBridgeStatusInterval) {
    clearInterval(window.whatsappBridgeStatusInterval);
  }
  window.whatsappBridgeStatusInterval = setInterval(updateWhatsAppBridgeStatus, 3000);
  updateWhatsAppBridgeStatus();

  // ==========================================
  // ENCAPSULATED EVENT DELEGATION ON CONTAINER
  // ==========================================
  
  if (!container.dataset.configListenersInitialized) {
    container.dataset.configListenersInitialized = 'true';

    // 1. Click events
    container.addEventListener('click', async (e) => {
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
    const btnRoomRates = e.target.closest('#btn-config-room-rates');

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
    } else if (btnRoomRates) {
      e.preventDefault();
      openCatalogConfig('roomRates');
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

      const userMods = user.modules || ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'encamamiento', 'quirofano', 'administracion', 'configuracion'];
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

    // Purgar catálogo completo
    const purgeCatalogBtn = e.target.closest('#btn-purge-this-catalog');
    if (purgeCatalogBtn) {
      e.preventDefault();
      if (!activeCatalogType) return;
      
      let catalogLabel = '';
      if (activeCatalogType === 'medications') catalogLabel = 'Farmacia';
      else if (activeCatalogType === 'laboratoryTests') catalogLabel = 'Laboratorio';
      else if (activeCatalogType === 'imagingStudies') catalogLabel = 'Imagenología';
      else return;

      const confirmPurge = confirm(`⚠️ ADVERTENCIA CRÍTICA:\n\n¿Está completamente seguro de que desea eliminar todos los elementos del catálogo de "${catalogLabel}"?\n\nSe borrarán todos los productos/exámenes de esta base de datos en la nube y esta acción no se puede deshacer.`);
      if (confirmPurge) {
        const promptConfirm = prompt(`Para confirmar la eliminación completa del catálogo de "${catalogLabel}", escriba "ELIMINAR" a continuación:`);
        if (promptConfirm === 'ELIMINAR') {
          try {
            purgeCatalogBtn.disabled = true;
            purgeCatalogBtn.textContent = 'Procesando...';

            // Purgar de Firestore
            await purgeCollectionFromFirestore(activeCatalogType);

            // Purgar localmente
            const stateObj = getAppState();
            stateObj[activeCatalogType] = [];
            await saveAppState(stateObj);

            alert(`🗑️ El catálogo de "${catalogLabel}" ha sido vaciado completamente.`);
            openCatalogConfig(activeCatalogType);
          } catch (err) {
            let msg = 'Error al intentar borrar el catálogo de la nube: ' + err.message;
            if (err.message.includes('Quota limit exceeded') || err.message.includes('quota') || err.message.includes('limit exceeded')) {
              msg = `⚠️ Límite de Cuota de Google Cloud/Firestore Excedido.\n\nEl sistema gratuito superó el límite diario de lecturas. Para solucionarlo definitivamente, se recomienda activar el plan "Blaze" (pago por uso) en la consola de Firebase del proyecto.\n\nMientras tanto, se ha vaciado el catálogo localmente en este navegador para que pueda realizar la nueva importación de inmediato sin bloqueos ni duplicados.`;
              try {
                const stateObj = getAppState();
                stateObj[activeCatalogType] = [];
                await saveAppState(stateObj);
                openCatalogConfig(activeCatalogType);
              } catch (localErr) {
                console.error(localErr);
              }
            }
            alert(msg);
          } finally {
            purgeCatalogBtn.disabled = false;
            purgeCatalogBtn.innerHTML = '<span>🗑️</span> Vaciar Catálogo Completo';
          }
        } else {
          alert('Acción cancelada. La palabra clave no coincide.');
        }
      }
      return;
    }

    // modal clear form
    const clearBtn = e.target.closest('#btn-clear-config-form');
    if (clearBtn) {
      e.preventDefault();
      if (activeCatalogType === 'medications') {
        resetPharmacyForm();
      } else {
        const configForm = document.getElementById('config-item-form');
        if (configForm) {
          configForm.reset();
          document.getElementById('config-item-id').value = '';
          document.getElementById('config-form-title').textContent = "Agregar Nuevo Item";
        }
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
          loadMedicationIntoForm(itemObj);
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
        } else if (activeCatalogType === 'roomRates') {
          document.getElementById('c-spec-description').value = itemObj.description || '';
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

    // Trigger Restore Official Database
    const btnRestoreDb = e.target.closest('#btn-trigger-restore-official-db');
    if (btnRestoreDb) {
      e.preventDefault();
      const confirmed = confirm("🔄 RESTABLECER BASE DE DATOS OFICIAL:\n\n¿Desea restablecer todos los 51 pacientes registrados con sus expedientes e historiales clínicos completos y los 13 usuarios médicos y de enfermería oficiales?\n\nEsta acción recuperará y sincronizará la base de datos oficial tanto en la nube como en memoria.");
      if (confirmed) {
        btnRestoreDb.disabled = true;
        btnRestoreDb.textContent = "⏳ Restableciendo base de datos oficial...";
        resetToOfficialDatabase().then(() => {
          alert("✅ Todos los pacientes (51) y usuarios oficiales han sido restablecidos exitosamente.");
          window.location.reload();
        }).catch(err => {
          alert("❌ Ocurrió un error al restablecer: " + err.message);
          window.location.reload();
        });
      }
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
      appState.clinicInfo.whatsappBridgeUrl = document.getElementById('c-info-whatsapp-url').value;
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

      if (activeCatalogType === 'medications') {
        const commercialName = document.getElementById('med-commercial-name')?.value.trim();
        if (!commercialName) {
          alert("Por favor ingrese el Nombre Comercial del medicamento.");
          return;
        }

        let itemObj = {};
        if (id) {
          itemObj = appState.medications.find(x => x.id === id);
          if (!itemObj) {
            itemObj = { id: id };
            appState.medications.unshift(itemObj);
          }
        } else {
          itemObj.id = 'm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
          appState.medications.unshift(itemObj);
        }

        const genericName = document.getElementById('c-spec-generic')?.value.trim() || '';
        const category = document.getElementById('c-spec-category')?.value.trim() || 'Farmacia';
        const lote = document.getElementById('c-spec-lote')?.value.trim() || '';
        const vencimiento = document.getElementById('c-spec-vencimiento')?.value || '';
        const purchasePres = document.getElementById('c-purchase-presentation')?.value.trim() || 'Caja';
        const purchaseQty = parseInt(document.getElementById('c-purchase-qty')?.value) || 1;
        const purchasePrice = parseFloat(document.getElementById('c-purchase-price')?.value) || 0;
        const baseUnit = document.getElementById('c-base-unit')?.value.trim() || 'Tableta';
        const factorCompra = Math.max(1, parseInt(document.getElementById('c-factor-compra')?.value) || 1);
        const stock = Math.max(0, parseInt(document.getElementById('c-spec-stock')?.value) || 0);

        const salesPresentations = [];
        document.querySelectorAll('#sales-presentations-tbody .sales-pres-row').forEach(row => {
          const pName = row.querySelector('.sp-name')?.value.trim();
          const pFactor = Math.max(1, parseInt(row.querySelector('.sp-factor')?.value) || 1);
          const pPrice = parseFloat(row.querySelector('.sp-price')?.value) || 0;
          if (pName) {
            salesPresentations.push({
              presentation: pName,
              factor: pFactor,
              price: pPrice
            });
          }
        });

        if (salesPresentations.length === 0) {
          salesPresentations.push({
            presentation: purchasePres,
            factor: factorCompra,
            price: purchasePrice
          });
        }

        const topPres = salesPresentations.find(p => p.factor === factorCompra) || salesPresentations[0];
        const unitPres = salesPresentations.find(p => p.factor === 1);
        const calculatedUnitPrice = unitPres ? unitPres.price : parseFloat(((topPres ? topPres.price : 0) / factorCompra).toFixed(4));

        itemObj.name = commercialName;
        itemObj.generic = genericName;
        itemObj.category = category;
        itemObj.lote = lote;
        itemObj.vencimiento = vencimiento;
        itemObj.presentation = purchasePres;
        itemObj.cantidad_comprada = purchaseQty;
        itemObj.precio_compra = purchasePrice;
        itemObj.unidad_dispensable = baseUnit;
        itemObj.unidades_por_presentacion = factorCompra;
        itemObj.stock = stock;
        itemObj.salesPresentations = salesPresentations;
        itemObj.price = topPres ? topPres.price : purchasePrice;
        itemObj.precio_unitario = calculatedUnitPrice;

        saveAppState(appState);
        saveCatalogDirectly('medications', appState.medications);
        renderCatalogTable();
        resetPharmacyForm();
        alert("Medicamento guardado exitosamente en el catálogo.");
        return;
      }

      // Catálogos estándares (Laboratorio, Imagenología, Consultas, Habitaciones)
      const name = document.getElementById('config-item-name').value;
      const price = parseFloat(document.getElementById('config-item-price').value);

      let itemObj = {};
      if (id) {
        itemObj = appState[activeCatalogType].find(x => x.id === id);
      } else {
        const prefix = activeCatalogType === 'laboratoryTests' ? 'l-' :
                       activeCatalogType === 'imagingStudies' ? 'i-' :
                       activeCatalogType === 'roomRates' ? 'hr-' : 'c-';
        itemObj.id = prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        appState[activeCatalogType].unshift(itemObj);
      }

      itemObj.name = name;
      itemObj.price = price;

      if (activeCatalogType === 'laboratoryTests') {
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
      } else if (activeCatalogType === 'roomRates') {
        itemObj.description = document.getElementById('c-spec-description').value;
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

  // 4. Input events for Autocomplete list
  container.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'config-item-name') {
      handleCatalogNameInput(e.target);
    }
  });

  // Close autocomplete list when clicking outside
  document.addEventListener('click', (e) => {
    const list = document.getElementById('config-item-autocomplete-list');
    if (list && !e.target.closest('#config-item-name') && !e.target.closest('#config-item-autocomplete-list')) {
      list.style.display = 'none';
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

  // Auto-seleccionar módulo Administración para roles autorizados
  const roleSelectVal = (document.getElementById('u-role')?.value || '').toLowerCase();
  const adminCb = document.querySelector('.u-module-cb[value="administracion"]');
  if (adminCb) {
    if (roleSelectVal.includes('admin') || roleSelectVal.includes('medico 1') || roleSelectVal.includes('médico 1') || role === 'enfermero' || role === 'recepcionista') {
      adminCb.checked = true;
    }
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

export function getMedicationSalesPresentations(med) {
  if (!med) return [];
  if (Array.isArray(med.salesPresentations) && med.salesPresentations.length > 0) {
    return med.salesPresentations.map(p => ({
      presentation: p.presentation || 'Presentación',
      factor: Math.max(1, parseInt(p.factor) || 1),
      price: parseFloat(p.price) || 0
    }));
  }
  // Retrocompatibilidad con esquemas anteriores
  const factor = Math.max(1, parseInt(med.unidades_por_presentacion) || 30);
  const pres = med.presentation || 'Caja';
  const unit = med.unidad_dispensable || 'Tableta';
  const fullPrice = parseFloat(med.price) || 50.00;
  const unitPrice = parseFloat(med.precio_unitario) || (fullPrice / factor);

  const list = [
    { presentation: pres, factor: factor, price: fullPrice }
  ];
  if (factor > 1 && pres.toLowerCase() !== unit.toLowerCase()) {
    list.push({ presentation: unit, factor: 1, price: parseFloat(unitPrice.toFixed(2)) });
  }
  return list;
}

export function formatHierarchicalStock(stock, med) {
  const stockVal = Math.max(0, parseInt(stock) || 0);
  const unit = (med && med.unidad_dispensable) ? med.unidad_dispensable : 'Tableta';
  if (!med) return `${stockVal} ${unit}(s)`;

  const salesPres = getMedicationSalesPresentations(med)
    .filter(p => p.factor > 0)
    .sort((a, b) => b.factor - a.factor);

  const higherPresentations = salesPres.filter(p => p.factor > 1);
  if (higherPresentations.length === 0) {
    return `${stockVal} ${unit}(s)`;
  }

  let remaining = stockVal;
  const parts = [];

  for (const pres of higherPresentations) {
    if (pres.factor <= 1) continue;
    const count = Math.floor(remaining / pres.factor);
    if (count > 0) {
      parts.push(`${count} ${pres.presentation}(s)`);
      remaining = remaining % pres.factor;
    }
  }

  if (remaining > 0) {
    parts.push(`${remaining} ${unit}(s)`);
  }

  if (parts.length === 0) {
    return `0 ${unit}(s)`;
  }

  if (parts.length === 1 && remaining === stockVal) {
    return `${stockVal} ${unit}(s)`;
  }

  let breakdown = '';
  if (parts.length === 1) {
    breakdown = parts[0];
  } else if (parts.length === 2) {
    breakdown = `${parts[0]} y ${parts[1]}`;
  } else {
    breakdown = parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
  }

  return `${stockVal} ${unit}(s) (${breakdown})`;
}

export function formatStockFriendly(stock, factor, presentacion = 'Caja', unidadDispensable = 'Tableta', med = null) {
  if (med) return formatHierarchicalStock(stock, med);
  const dummyMed = {
    presentation: presentacion,
    unidad_dispensable: unidadDispensable,
    unidades_por_presentacion: factor
  };
  return formatHierarchicalStock(stock, dummyMed);
}

function addSalesPresentationRow(presName = '', factor = 1, price = 0, baseUnit = 'Tableta') {
  const tbody = document.getElementById('sales-presentations-tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.className = 'sales-pres-row';
  tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
  tr.innerHTML = `
    <td style="padding: 6px;">
      <input type="text" class="sp-name" list="standard-sales-presentations" value="${presName}" placeholder="Ej. Caja, Blíster, Tableta..." required style="width: 100%; padding: 5px 8px; font-size: 0.85rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-card); color: var(--text-primary);">
    </td>
    <td style="padding: 6px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <input type="number" class="sp-factor" min="1" step="1" value="${factor}" required style="width: 85px; padding: 5px 8px; font-size: 0.85rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-card); color: var(--text-primary); text-align: center;">
        <span class="sp-unit-label" style="font-size: 0.78rem; color: var(--text-muted);">${baseUnit}(s)</span>
      </div>
    </td>
    <td style="padding: 6px; text-align: right;">
      <div style="display: inline-flex; align-items: center; gap: 4px;">
        <span style="color: var(--accent-success); font-weight: bold; font-size: 0.85rem;">Q</span>
        <input type="number" class="sp-price" min="0" step="0.01" value="${parseFloat(price || 0).toFixed(2)}" required style="width: 90px; text-align: right; padding: 5px 8px; font-size: 0.85rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-card); color: var(--accent-success); font-weight: bold;">
      </div>
    </td>
    <td style="padding: 6px; text-align: center;">
      <button type="button" class="btn btn-danger btn-small btn-remove-sp-row" style="padding: 3px 8px; font-size: 0.85rem; line-height: 1;" title="Eliminar presentación">&times;</button>
    </td>
  `;
  tbody.appendChild(tr);

  tr.querySelector('.btn-remove-sp-row').addEventListener('click', () => {
    const totalRows = tbody.querySelectorAll('.sales-pres-row').length;
    if (totalRows <= 1) {
      alert("Debe mantener al menos una presentación de venta.");
      return;
    }
    tr.remove();
  });
}

function renderSalesPresentationsRows(list, baseUnit = 'Tableta') {
  const tbody = document.getElementById('sales-presentations-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const rows = (Array.isArray(list) && list.length > 0) ? list : [
    { presentation: 'Caja', factor: 100, price: 150.00 },
    { presentation: 'Blíster', factor: 10, price: 18.00 },
    { presentation: 'Tableta', factor: 1, price: 2.00 }
  ];

  rows.forEach(p => {
    addSalesPresentationRow(p.presentation, p.factor, p.price, baseUnit);
  });
}

function updateStockCalculationBadge() {
  const qtyEl = document.getElementById('c-purchase-qty');
  const factorEl = document.getElementById('c-factor-compra');
  const presEl = document.getElementById('c-purchase-presentation');
  const unitEl = document.getElementById('c-base-unit');
  const badgeEl = document.getElementById('c-calc-stock-badge');
  const detailEl = document.getElementById('c-calc-stock-detail');
  const stockFinalEl = document.getElementById('c-spec-stock');

  if (!qtyEl || !factorEl || !badgeEl) return;

  const qty = parseInt(qtyEl.value) || 0;
  const factor = Math.max(1, parseInt(factorEl.value) || 1);
  const pres = (presEl ? presEl.value.trim() : '') || 'Caja';
  const unit = (unitEl ? unitEl.value.trim() : '') || 'Tableta';

  const total = qty * factor;
  badgeEl.textContent = `${total} ${unit}(s)`;
  if (detailEl) {
    detailEl.textContent = `Fórmula: ${qty} ${pres}(s) × ${factor} ${unit}(s) = ${total} ${unit}(s) en inventario`;
  }

  const currentId = document.getElementById('config-item-id')?.value;
  if (!currentId && stockFinalEl) {
    stockFinalEl.value = total;
  }

  document.querySelectorAll('.sp-unit-label').forEach(el => {
    el.textContent = `${unit}(s)`;
  });
}

function loadMedicationIntoForm(itemObj) {
  if (!itemObj) return;
  const idEl = document.getElementById('config-item-id');
  const titleEl = document.getElementById('config-form-title');
  if (idEl) idEl.value = itemObj.id;
  if (titleEl) titleEl.textContent = `Modificar Medicamento (${itemObj.name})`;

  // Grupo 1: Datos Generales
  const nameEl = document.getElementById('med-commercial-name');
  const genericEl = document.getElementById('c-spec-generic');
  const catEl = document.getElementById('c-spec-category');
  const loteEl = document.getElementById('c-spec-lote');
  const vencEl = document.getElementById('c-spec-vencimiento');

  if (nameEl) nameEl.value = itemObj.name || '';
  if (genericEl) genericEl.value = itemObj.generic || '';
  if (catEl) catEl.value = itemObj.category || '';
  if (loteEl) loteEl.value = itemObj.lote || '';
  if (vencEl) vencEl.value = itemObj.vencimiento || '';

  // Grupo 2: Datos de Compra e Ingreso
  const presEl = document.getElementById('c-purchase-presentation');
  const qtyEl = document.getElementById('c-purchase-qty');
  const priceEl = document.getElementById('c-purchase-price');
  const unitEl = document.getElementById('c-base-unit');
  const factorEl = document.getElementById('c-factor-compra');
  const stockEl = document.getElementById('c-spec-stock');

  if (presEl) presEl.value = itemObj.presentation || 'Caja';
  if (qtyEl) qtyEl.value = itemObj.cantidad_comprada || 1;
  if (priceEl) priceEl.value = itemObj.precio_compra || (itemObj.price || 0);
  if (unitEl) unitEl.value = itemObj.unidad_dispensable || 'Tableta';
  if (factorEl) factorEl.value = itemObj.unidades_por_presentacion || 30;
  if (stockEl) stockEl.value = itemObj.stock !== undefined ? itemObj.stock : 0;

  updateStockCalculationBadge();

  // Grupo 3: Presentaciones de Venta
  const salesPres = getMedicationSalesPresentations(itemObj);
  renderSalesPresentationsRows(salesPres, itemObj.unidad_dispensable || 'Tableta');
}

function resetPharmacyForm() {
  const form = document.getElementById('config-item-form');
  if (form) form.reset();
  const idEl = document.getElementById('config-item-id');
  const titleEl = document.getElementById('config-form-title');
  if (idEl) idEl.value = '';
  if (titleEl) titleEl.textContent = "Agregar Nuevo Item";

  const presEl = document.getElementById('c-purchase-presentation');
  const qtyEl = document.getElementById('c-purchase-qty');
  const priceEl = document.getElementById('c-purchase-price');
  const unitEl = document.getElementById('c-base-unit');
  const factorEl = document.getElementById('c-factor-compra');
  const stockEl = document.getElementById('c-spec-stock');

  if (presEl) presEl.value = 'Caja';
  if (qtyEl) qtyEl.value = '5';
  if (priceEl) priceEl.value = '120.00';
  if (unitEl) unitEl.value = 'Tableta';
  if (factorEl) factorEl.value = '100';
  if (stockEl) stockEl.value = '500';

  updateStockCalculationBadge();
  renderSalesPresentationsRows([
    { presentation: 'Caja', factor: 100, price: 150.00 },
    { presentation: 'Blíster', factor: 10, price: 18.00 },
    { presentation: 'Tableta', factor: 1, price: 2.00 }
  ], 'Tableta');

  const autoList = document.getElementById('med-catalog-autocomplete-list');
  if (autoList) autoList.style.display = 'none';
}

function handleMedCommercialNameInput(inputEl) {
  const query = inputEl.value.trim().toLowerCase();
  const listEl = document.getElementById('med-catalog-autocomplete-list');
  if (!listEl) return;

  if (!query) {
    listEl.style.display = 'none';
    return;
  }

  const stateObj = getAppState();
  const items = stateObj.medications || [];

  const filtered = items.filter(item => {
    const nameMatch = (item.name || '').toLowerCase().includes(query);
    const genericMatch = (item.generic || '').toLowerCase().includes(query);
    return nameMatch || genericMatch;
  });

  if (filtered.length === 0) {
    listEl.style.display = 'none';
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    const extraLabel = item.generic ? ` <span style="color: var(--text-muted); font-size: 0.75rem;">(Genérico: ${item.generic})</span>` : '';
    const stockHier = formatHierarchicalStock(item.stock, item);
    return `
      <div class="med-autocomplete-item" data-id="${item.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 0.2s;">
        <div style="font-weight: 600; color: #00f2fe; font-size: 0.88rem;">${item.name}${extraLabel}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; margin-top: 2px;">
          <span>Categoría: ${item.category || 'Farmacia'}</span>
          <span style="color: ${(item.stock || 0) > 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">Stock: ${stockHier}</span>
        </div>
      </div>
    `;
  }).join('');

  listEl.style.display = 'block';

  listEl.querySelectorAll('.med-autocomplete-item').forEach(itemBtn => {
    itemBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = itemBtn.getAttribute('data-id');
      const selectedItem = items.find(x => x.id === id);
      if (selectedItem) {
        loadMedicationIntoForm(selectedItem);
      }
      listEl.style.display = 'none';
    });
  });
}

function openCatalogConfig(type) {
  console.log(`[openCatalogConfig] Abriendo modal para tipo: ${type}`);
  activeCatalogType = type;

  const configModal = document.getElementById('config-catalog-modal');
  const configTitle = document.getElementById('config-catalog-title');
  const configForm = document.getElementById('config-item-form');
  const configStandardTopRow = document.getElementById('config-standard-top-row');
  const configNameInput = document.getElementById('config-item-name');
  const configPriceInput = document.getElementById('config-item-price');
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

  // Mostrar modal y ajustar visibilidad del botón de vaciado
  configModal.style.display = 'flex';
  const purgeBtn = document.getElementById('btn-purge-this-catalog');
  if (purgeBtn) {
    if (type === 'consultationTypes') {
      purgeBtn.style.display = 'none';
    } else {
      purgeBtn.style.display = 'inline-block';
    }
  }

  // Ajustar campos específicos
  if (type === 'medications') {
    configTitle.textContent = "💊 Gestión de Catálogo de Farmacia";
    if (thExtraCol) thExtraCol.textContent = "Presentaciones de Venta";

    if (configStandardTopRow) configStandardTopRow.style.display = 'none';
    if (configNameInput) configNameInput.removeAttribute('required');
    if (configPriceInput) configPriceInput.removeAttribute('required');

    configSpecificFields.innerHTML = `
      <!-- GRUPO 1: DATOS GENERALES -->
      <div class="pharmacy-form-group-card" style="background: rgba(0, 242, 254, 0.02); border: 1px solid rgba(0, 242, 254, 0.25); border-left: 4px solid #00f2fe; border-radius: 6px; padding: 14px; margin-bottom: 12px; width: 100%;">
        <h5 style="margin: 0 0 12px 0; color: #00f2fe; font-size: 0.92rem; display: flex; align-items: center; gap: 6px;">
          <span>📋</span> GRUPO 1: DATOS GENERALES
        </h5>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <div class="form-group" style="position: relative; margin: 0; grid-column: span 2;">
            <label for="med-commercial-name" style="font-weight: 600; font-size: 0.82rem;">
              Nombre Comercial <small style="color: var(--accent-primary); font-weight: normal;">(Búsqueda en vivo / Autocompletado - seleccione para editar)</small>
            </label>
            <input type="text" id="med-commercial-name" required placeholder="Escriba el nombre comercial (ej. Amoxicilina 500mg, Panadol Ultra)..." autocomplete="off" style="width: 100%; border: 1px solid rgba(0, 242, 254, 0.4);">
            <div id="med-catalog-autocomplete-list" style="position: absolute; top: 100%; left: 0; right: 0; z-index: 1200; background: #13151f; border: 1px solid rgba(0,242,254,0.3); border-radius: 4px; max-height: 220px; overflow-y: auto; display: none; box-shadow: var(--shadow-lg); margin-top: 4px;"></div>
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="c-spec-generic" style="font-size: 0.82rem;">Nombre Genérico</label>
            <input type="text" id="c-spec-generic" required placeholder="Ej. Amoxicilina, Paracetamol">
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="c-spec-category" style="font-size: 0.82rem;">Categoría Farmacéutica</label>
            <input type="text" id="c-spec-category" list="pharmacy-categories-datalist" required placeholder="Ej. Analgésicos, Antibióticos">
            <datalist id="pharmacy-categories-datalist">
              <option value="Analgésicos y Antipiréticos">
              <option value="Antibióticos y Antimicrobianos">
              <option value="Antiinflamatorios">
              <option value="Antihistamínicos">
              <option value="Gastrointestinales">
              <option value="Cardiovasculares y Antihipertensivos">
              <option value="Respiratorios y Antitusivos">
              <option value="Vitaminas y Suplementos">
              <option value="Dermatológicos">
              <option value="Inyectables y Soluciones">
            </datalist>
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="c-spec-lote" style="font-size: 0.82rem;">Número de Lote</label>
            <input type="text" id="c-spec-lote" required placeholder="Ej. LT-8902">
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="c-spec-vencimiento" style="font-size: 0.82rem;">Fecha de Vencimiento</label>
            <input type="date" id="c-spec-vencimiento" required>
          </div>
        </div>
      </div>

      <!-- GRUPO 2: DATOS DE COMPRA E INGRESO A INVENTARIO -->
      <div class="pharmacy-form-group-card" style="background: rgba(16, 185, 129, 0.02); border: 1px solid rgba(16, 185, 129, 0.25); border-left: 4px solid #10b981; border-radius: 6px; padding: 14px; margin-bottom: 12px; width: 100%;">
        <h5 style="margin: 0 0 12px 0; color: #10b981; font-size: 0.92rem; display: flex; align-items: center; gap: 6px;">
          <span>📦</span> GRUPO 2: DATOS DE COMPRA E INGRESO A INVENTARIO
        </h5>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: flex-start;">
          <div class="form-group" style="margin: 0;">
            <label for="c-purchase-presentation" style="font-size: 0.82rem;">Presentación de Compra</label>
            <input type="text" id="c-purchase-presentation" list="purchase-pres-datalist" required placeholder="Ej. Caja, Frasco, Galón, Paquete" value="Caja">
            <datalist id="purchase-pres-datalist">
              <option value="Caja">
              <option value="Frasco">
              <option value="Galón">
              <option value="Paquete">
              <option value="Bulto">
              <option value="Lata">
              <option value="Ampolla">
              <option value="Tubo">
            </datalist>
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="c-purchase-qty" style="font-size: 0.82rem;">Cantidad Comprada</label>
            <input type="number" id="c-purchase-qty" min="1" step="1" required value="5" placeholder="Ej. 5">
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="c-purchase-price" style="font-size: 0.82rem;">Precio de Compra (Q)</label>
            <input type="number" id="c-purchase-price" min="0" step="0.01" required value="120.00" placeholder="0.00">
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="c-base-unit" style="font-size: 0.82rem;">Unidad Base (Mínima dispensable)</label>
            <input type="text" id="c-base-unit" list="base-unit-datalist" required placeholder="Ej. Tableta, Cápsula, ml, Ampolla" value="Tableta">
            <datalist id="base-unit-datalist">
              <option value="Tableta">
              <option value="Cápsula">
              <option value="ml">
              <option value="Ampolla">
              <option value="Gramos">
              <option value="Óvulo">
              <option value="Dosis">
            </datalist>
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="c-factor-compra" style="font-size: 0.82rem;">Unidades Base por Pres. Compra</label>
            <input type="number" id="c-factor-compra" min="1" step="1" required value="100" placeholder="Ej. 100">
          </div>
        </div>

        <!-- Cálculo automático de stock base -->
        <div style="margin-top: 12px; padding: 10px 14px; background: rgba(16, 185, 129, 0.06); border: 1px dashed rgba(16, 185, 129, 0.35); border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 500;">Cálculo Automático de Stock Base:</span>
            <div id="c-calc-stock-badge" style="font-size: 1.2rem; font-weight: bold; color: #10b981; margin: 2px 0;">
              500 Tabletas
            </div>
            <small id="c-calc-stock-detail" style="font-size: 0.76rem; color: var(--text-muted);">
              Fórmula: 5 Cajas × 100 Tabletas = 500 Tabletas en inventario
            </small>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label for="c-spec-stock" style="font-size: 0.82rem; margin: 0; color: #10b981; font-weight: 600;">Stock Base Almacenado:</label>
            <input type="number" id="c-spec-stock" min="0" value="500" required style="width: 110px; padding: 6px 10px; font-weight: bold; font-size: 1rem; text-align: center; color: #10b981; border: 1px solid rgba(16, 185, 129, 0.5); border-radius: 4px; background: rgba(0,0,0,0.3);">
          </div>
        </div>
      </div>

      <!-- GRUPO 3: PRESENTACIONES DE VENTA (LISTA DINÁMICA) -->
      <div class="pharmacy-form-group-card" style="background: rgba(245, 158, 11, 0.02); border: 1px solid rgba(245, 158, 11, 0.25); border-left: 4px solid #f59e0b; border-radius: 6px; padding: 14px; margin-bottom: 8px; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h5 style="margin: 0; color: #f59e0b; font-size: 0.92rem; display: flex; align-items: center; gap: 6px;">
              <span>🏷️</span> GRUPO 3: PRESENTACIONES DE VENTA (LISTA DINÁMICA)
            </h5>
            <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: var(--text-muted);">
              Configure las formas en que este medicamento se puede recetar y vender (cada una descuenta de acuerdo a su equivalencia de unidades base).
            </p>
          </div>
          <button type="button" class="btn btn-secondary btn-small" id="btn-add-sales-presentation-row" style="padding: 5px 12px; font-size: 0.82rem; border-color: #f59e0b; color: #f59e0b; font-weight: 600;">
            <span>➕</span> Agregar Presentación de Venta
          </button>
        </div>

        <datalist id="standard-sales-presentations">
          <option value="Caja">
          <option value="Blíster">
          <option value="Tableta">
          <option value="Cápsula">
          <option value="Frasco">
          <option value="Ampolla">
          <option value="ml">
          <option value="Sobre">
          <option value="Tubo">
          <option value="Gotero">
          <option value="Inhalador">
          <option value="Parche">
        </datalist>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;" id="sales-presentations-table">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                <th style="padding: 8px 6px;">Presentación de Venta</th>
                <th style="padding: 8px 6px;">Equivalencia (Uds Base)</th>
                <th style="padding: 8px 6px; text-align: right;">Precio de Venta al Público (Q)</th>
                <th style="padding: 8px 6px; text-align: center; width: 60px;">Acción</th>
              </tr>
            </thead>
            <tbody id="sales-presentations-tbody">
              <!-- Filas dinámicas -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    setTimeout(() => {
      // Wire input listeners Grupo 2
      const qtyEl = document.getElementById('c-purchase-qty');
      const factorEl = document.getElementById('c-factor-compra');
      const presEl = document.getElementById('c-purchase-presentation');
      const unitEl = document.getElementById('c-base-unit');

      if (qtyEl) qtyEl.addEventListener('input', updateStockCalculationBadge);
      if (factorEl) factorEl.addEventListener('input', updateStockCalculationBadge);
      if (presEl) presEl.addEventListener('input', updateStockCalculationBadge);
      if (unitEl) unitEl.addEventListener('input', updateStockCalculationBadge);

      // Wire button "+ Agregar Presentación de Venta"
      const addRowBtn = document.getElementById('btn-add-sales-presentation-row');
      if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
          const baseUnit = document.getElementById('c-base-unit')?.value.trim() || 'Tableta';
          addSalesPresentationRow('', 1, 0, baseUnit);
        });
      }

      // Wire live search Grupo 1
      const commNameInput = document.getElementById('med-commercial-name');
      if (commNameInput) {
        commNameInput.addEventListener('input', () => handleMedCommercialNameInput(commNameInput));
      }

      // Initial defaults for dynamic sales presentations
      renderSalesPresentationsRows([
        { presentation: 'Caja', factor: 100, price: 150.00 },
        { presentation: 'Blíster', factor: 10, price: 18.00 },
        { presentation: 'Tableta', factor: 1, price: 2.00 }
      ], 'Tableta');
      updateStockCalculationBadge();
    }, 40);

  } else {
    // Otros catálogos: diseño estándar
    if (configStandardTopRow) configStandardTopRow.style.display = 'flex';
    if (configNameInput) configNameInput.setAttribute('required', 'required');
    if (configPriceInput) configPriceInput.setAttribute('required', 'required');

    if (type === 'laboratoryTests') {
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
      if (thExtraCol) thExtraCol.textContent = "Categoría del Estudio";
      configSpecificFields.innerHTML = `
        <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom:0;">
          <label for="c-spec-category">Categoría (Rayos X, USG, TC, RMN...)</label>
          <input type="text" id="c-spec-category" required placeholder="Ej. Ultrasonografía, Radiología...">
        </div>
      `;
    } else if (type === 'consultationTypes') {
      configTitle.textContent = "🩺 Tarifario de Consultas Médicas";
      if (thExtraCol) thExtraCol.textContent = "Especialidad / Detalle";
      configSpecificFields.innerHTML = `
        <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom:0;">
          <label for="c-spec-specialty">Especialidad</label>
          <input type="text" id="c-spec-specialty" required placeholder="Ej. Medicina General, Pediatría, Cardiología...">
        </div>
      `;
    } else if (type === 'roomRates') {
      configTitle.textContent = "🛌 Catálogo de Habitaciones y Tarifas";
      if (thExtraCol) thExtraCol.textContent = "Descripción / Tipo";
      configSpecificFields.innerHTML = `
        <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom:0;">
          <label for="c-spec-description">Descripción de Habitación</label>
          <input type="text" id="c-spec-description" required placeholder="Ej. Habitación Privada, Cama 1, Intensivo...">
        </div>
      `;
    }
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
          <th id="th-extra-col" style="padding: 10px;">${activeCatalogType === 'medications' ? 'Presentación / Categoría' : (activeCatalogType === 'imagingStudies' ? 'Categoría del Estudio' : (activeCatalogType === 'roomRates' ? 'Descripción / Tipo' : 'Especialidad / Detalle'))}</th>
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
        const stockHierarchical = formatHierarchicalStock(item.stock, item);
        const salesPres = getMedicationSalesPresentations(item);

        const presPillsHtml = salesPres.map(p => `
          <span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); border-radius: 4px; padding: 2px 7px; margin: 2px; font-size: 0.76rem; color: #00f2fe;">
            <strong>${p.presentation}</strong> (${p.factor} ${item.unidad_dispensable || 'und'}s) = <strong style="color: var(--accent-success);">Q${parseFloat(p.price).toFixed(2)}</strong>
          </span>
        `).join('');

        nameCellHtml = `
          <strong style="color: #00f2fe; font-size: 0.95rem;">${item.name}</strong><br>
          <span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Genérico: ${item.generic || 'N/D'}</span><br>
          <span style="font-size: 0.75rem; color: var(--accent-primary); text-transform: uppercase; font-weight: 600;">${item.category || 'Farmacia'}</span> | 
          <span style="font-size: 0.75rem; color: var(--text-muted);">Lote: <strong>${item.lote || 'N/D'}</strong> | Vence: ${expirationDateStr}</span>
        `;

        extraCellHtml = `
          <div style="margin-bottom: 4px; font-size: 0.82rem;">
            <span style="color: var(--text-muted); text-transform: uppercase; font-size: 0.72rem;">Compra:</span> 
            <strong>${item.presentation || 'Caja'}</strong> (${item.unidades_por_presentacion || 30} ${item.unidad_dispensable || 'Tableta'}s)
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 2px; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 0.72rem; color: #f59e0b; font-weight: 600; margin-right: 4px;">Venta:</span>
            ${presPillsHtml}
          </div>
          <div>
            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Stock Desglosado:</span><br>
            <strong style="font-size: 0.88rem; color: ${(item.stock || 0) <= 0 ? 'var(--accent-danger)' : 'var(--accent-success)'};">
              ${stockHierarchical}
            </strong>
          </div>
        `;
      } else if (activeCatalogType === 'imagingStudies') {
        nameCellHtml = `<strong>${item.name}</strong>`;
        extraCellHtml = `${item.category || 'General'}`;
      } else if (activeCatalogType === 'consultationTypes') {
        nameCellHtml = `<strong>${item.name}</strong>`;
        extraCellHtml = `${item.specialty || 'General'}`;
      } else if (activeCatalogType === 'roomRates') {
        nameCellHtml = `<strong>${item.name}</strong>`;
        extraCellHtml = `${item.description || 'Habitación Hospitalaria'}`;
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
      newItem.presentation = presentationIdx !== -1 && row[presentationIdx] ? String(row[presentationIdx]).trim() : "Caja";
      newItem.category = categoryIdx !== -1 && row[categoryIdx] ? String(row[categoryIdx]).trim() : "Farmacia";
      newItem.stock = 120;
      newItem.lote = 'L-IMP-' + Math.floor(1000 + Math.random() * 9000);
      newItem.vencimiento = '2027-06-30';
      newItem.unidad_dispensable = 'Tableta';
      newItem.unidades_por_presentacion = 30;
      newItem.cantidad_comprada = 4;
      newItem.precio_compra = priceVal;
      newItem.salesPresentations = [
        { presentation: newItem.presentation, factor: 30, price: priceVal },
        { presentation: 'Tableta', factor: 1, price: parseFloat((priceVal / 30).toFixed(2)) }
      ];
      newItem.precio_unitario = parseFloat((priceVal / 30).toFixed(2));
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

  // Guardar estado
  appState[activeCatalogType] = catalog;
  saveAppState(appState);
  
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
        let msg = "❌ Error al sincronizar los elementos importados con la base de datos en la nube.";
        if (err.message && (err.message.includes('Quota limit exceeded') || err.message.includes('quota') || err.message.includes('limit exceeded'))) {
          msg = "⚠️ Sincronización en la Nube Demorada por Límite de Cuota de Firestore.\n\nLos elementos se importaron correctamente en la base de datos local y puede utilizarlos de inmediato. Se sincronizarán automáticamente con la nube en cuanto la cuota diaria se restablezca (a las 12:00 AM PST) o al activar el plan Blaze.";
        }
        alert(msg);
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
          const pDpi = String(pr['DPI / CUI'] || pr['DPI'] || 'No Presenta Documento');

          let pObj = currentState.patients.find(p => p.id === pid || p.name === pname);
          if (!pObj && !isGenericDpi(pDpi)) {
            pObj = findExistingPatientByDpi(pDpi, currentState.patients);
          }

          if (!pObj) {
            pObj = {
              id: pid,
              name: pname,
              dpi: pDpi,
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

function handleCatalogNameInput(inputEl) {
  const query = inputEl.value.trim().toLowerCase();
  const listEl = document.getElementById('config-item-autocomplete-list');
  if (!listEl) return;

  if (!query || !activeCatalogType) {
    listEl.style.display = 'none';
    return;
  }

  const stateObj = getAppState();
  const items = stateObj[activeCatalogType] || [];
  
  // Filtrar los elementos del catálogo activo que coincidan por nombre o por nombre genérico (si es medicamento)
  const filtered = items.filter(item => {
    const nameMatch = (item.name || '').toLowerCase().includes(query);
    const genericMatch = (item.generic || '').toLowerCase().includes(query);
    return nameMatch || genericMatch;
  });

  if (filtered.length === 0) {
    listEl.style.display = 'none';
    return;
  }

  if (!document.getElementById('catalog-autocomplete-styles')) {
    const style = document.createElement('style');
    style.id = 'catalog-autocomplete-styles';
    style.textContent = `
      .autocomplete-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 0.88rem;
        color: var(--text-primary);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        transition: background 0.2s ease;
      }
      .autocomplete-item:last-child {
        border-bottom: none;
      }
      .autocomplete-item:hover {
        background: rgba(255, 255, 255, 0.08);
        color: var(--accent-primary);
      }
    `;
    document.head.appendChild(style);
  }

  // Generar HTML de opciones
  listEl.innerHTML = filtered.map(item => {
    const extraLabel = item.generic ? ` (${item.generic})` : '';
    return `
      <div class="autocomplete-item" data-id="${item.id}">
        <strong>${item.name}</strong>${extraLabel} - Q${item.price}
      </div>
    `;
  }).join('');
  
  listEl.style.display = 'block';

  // Configurar clicks en los items
  listEl.querySelectorAll('.autocomplete-item').forEach(itemBtn => {
    itemBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = itemBtn.getAttribute('data-id');
      const selectedItem = items.find(x => x.id === id);
      if (selectedItem) {
        // Rellenar todos los campos del formulario con la información del elemento seleccionado
        document.getElementById('config-item-id').value = selectedItem.id;
        document.getElementById('config-item-name').value = selectedItem.name;
        document.getElementById('config-item-price').value = selectedItem.price;
        document.getElementById('config-form-title').textContent = "Modificar Item";

        if (activeCatalogType === 'medications') {
          loadMedicationIntoForm(selectedItem);
        } else if (activeCatalogType === 'laboratoryTests') {
          document.getElementById('c-spec-category').value = selectedItem.category || '';
          const unitEl = document.getElementById('c-spec-unit');
          const refEl = document.getElementById('c-spec-reference');
          if (unitEl) unitEl.value = selectedItem.unit || selectedItem.units || '';
          if (refEl) refEl.value = selectedItem.reference || selectedItem.referenceInterval || selectedItem.normal || '';
        } else if (activeCatalogType === 'imagingStudies') {
          document.getElementById('c-spec-category').value = selectedItem.category || '';
        } else if (activeCatalogType === 'consultationTypes') {
          document.getElementById('c-spec-specialty').value = selectedItem.specialty || '';
        } else if (activeCatalogType === 'roomRates') {
          document.getElementById('c-spec-description').value = selectedItem.description || '';
        }
      }
      listEl.style.display = 'none';
    });
  });
}
