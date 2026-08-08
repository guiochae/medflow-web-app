// src/modules/quirofano.js
import { getAppState, saveAppState, setActivePatientId } from '../main.js';

// Catálogo de Procedimientos Quirúrgicos Comunes
const SURGICAL_PROCEDURES_CATALOG = [
  { id: "sp-1", name: "Apendicectomía Laparoscópica", specialty: "Cirugía General" },
  { id: "sp-2", name: "Colecistectomía Laparoscópica", specialty: "Cirugía General" },
  { id: "sp-3", name: "Herniorrafía Inguinal (con Malla)", specialty: "Cirugía General" },
  { id: "sp-4", name: "Cesárea Segmentaria", specialty: "Ginecología y Obstetricia" },
  { id: "sp-5", name: "Histerectomía Abdominal Total", specialty: "Ginecología y Obstetricia" },
  { id: "sp-6", name: "Osteosíntesis de Fémur / Tibia", specialty: "Traumatología y Ortopedia" },
  { id: "sp-7", name: "Artroplastia Total de Rodilla", specialty: "Traumatología y Ortopedia" },
  { id: "sp-8", name: "Craneotomía Descompresiva", specialty: "Neurocirugía" },
  { id: "sp-9", name: "Rinoplastia Estética / Funcional", specialty: "Cirugía Plástica" },
  { id: "sp-10", name: "Lobectomía Pulmonar", specialty: "Cirugía Torácica" },
  { id: "sp-11", name: "Catarata con Lente Intraocular", specialty: "Oftalmología" },
  { id: "sp-12", name: "Resección Transuretral de Próstata (RTUP)", specialty: "Urología" }
];

// Catálogo de Insumos Médicos para Sala de Operaciones
const SURGICAL_SUPPLIES_CATALOG = [
  { id: "sup-1", name: "Sutura Vicryl 2-0", price: 65.00 },
  { id: "sup-2", name: "Sutura Seda 3-0", price: 45.00 },
  { id: "sup-3", name: "Sutura Nylon 4-0", price: 40.00 },
  { id: "sup-4", name: "Gasas Estériles (Paquete de 5)", price: 15.00 },
  { id: "sup-5", name: "Compresas Laparotómicas (Paquete)", price: 120.00 },
  { id: "sup-6", name: "Propofol Anestésico 20ml", price: 180.00 },
  { id: "sup-7", name: "Fentanilo Ampolla 2ml", price: 95.00 },
  { id: "sup-8", name: "Solución Salina 0.9% 500ml", price: 25.00 },
  { id: "sup-9", name: "Jeringa Desechable 10cc (Unidad)", price: 5.00 },
  { id: "sup-10", name: "Guantes Estériles Quirúrgicos 7.5", price: 20.00 },
  { id: "sup-11", name: "Kit de Ropa Quirúrgica Desechable", price: 150.00 },
  { id: "sup-12", name: "Hoja de Bisturí No. 15", price: 12.00 },
  { id: "sup-13", name: "Cánula Guedel", price: 35.00 }
];

export function renderQuirofano(container) {
  const state = getAppState();
  
  // Garantizar que la colección de cirugías exista
  state.surgeries = state.surgeries || [];

  container.innerHTML = `
    <div style="display: flex; gap: 1.5rem; height: calc(100vh - 120px); overflow: hidden; font-family: var(--font-main);">
      
      <!-- COLUMNA IZQUIERDA: Pacientes aptos para cirugía -->
      <div class="glass-card" style="width: 320px; display: flex; flex-direction: column; padding: 1.25rem; flex-shrink: 0; background: rgba(30, 41, 59, 0.4); border-right: 1px solid var(--border-color);">
        <div style="margin-bottom: 1rem;">
          <h3 style="color: var(--accent-primary); font-family: var(--font-heading); margin-bottom: 0.5rem; font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
            <span>👥</span> Candidatos a Quirófano
          </h3>
          <button class="btn btn-primary btn-small" id="btn-add-external-patient" style="width: 100%; margin-top: 10px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none;">
            ➕ Ingresar Paciente Externo
          </button>
        </div>

        <input type="text" id="q-search-patient" placeholder="Buscar paciente..." style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); margin-bottom: 1rem; font-size: 0.85rem;">

        <!-- Listado scrollable -->
        <div id="q-patient-list" style="flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px;">
          <!-- Pacientes inyectados por JS -->
        </div>
      </div>

      <!-- COLUMNA DERECHA: Pizarra Quirúrgica Kanban -->
      <div style="flex-grow: 1; display: flex; flex-direction: column; overflow: hidden;">
        
        <!-- Encabezado de Pizarra -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <h2 style="font-family: var(--font-heading); color: var(--text-primary); margin: 0; font-size: 1.5rem;">🏥 Pizarra de Control Quirúrgico</h2>
            <span style="font-size: 0.82rem; color: var(--text-muted);">Sincronización en tiempo real de Quirófanos y Procedimientos</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-muted);">
              Total Programadas: <strong style="color: var(--accent-primary);" id="badge-total-scheduled">0</strong>
            </div>
            <div style="font-size: 0.8rem; background: rgba(0, 242, 254, 0.05); padding: 6px 12px; border-radius: 4px; border: 1px solid rgba(0, 242, 254, 0.15); color: var(--accent-primary);">
              En Proceso: <strong id="badge-total-process">0</strong>
            </div>
          </div>
        </div>

        <!-- Columnas del Kanban -->
        <div style="display: flex; gap: 1rem; flex-grow: 1; overflow: hidden;">
          
          <!-- Columna: Programadas -->
          <div class="q-kanban-col" style="flex: 1; display: flex; flex-direction: column; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
            <div style="padding: 10px; background: rgba(37,99,235,0.1); border-bottom: 2px solid var(--accent-primary); font-weight: 700; color: var(--accent-primary); font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
              <span>📅 Programadas</span>
              <span class="col-count-badge" id="count-scheduled" style="background: var(--accent-primary); color: #fff; padding: 2px 6px; border-radius: 10px; font-size: 0.75rem;">0</span>
            </div>
            <div class="q-kanban-cards" id="col-scheduled" style="flex-grow: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;">
              <!-- Tarjetas -->
            </div>
          </div>

          <!-- Columna: En Proceso -->
          <div class="q-kanban-col" style="flex: 1; display: flex; flex-direction: column; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
            <div style="padding: 10px; background: rgba(0, 242, 254, 0.1); border-bottom: 2px solid var(--accent-secondary); font-weight: 700; color: var(--accent-secondary); font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
              <span>⚡ En Proceso</span>
              <span class="col-count-badge" id="count-in_progress" style="background: var(--accent-secondary); color: #fff; padding: 2px 6px; border-radius: 10px; font-size: 0.75rem;">0</span>
            </div>
            <div class="q-kanban-cards" id="col-in_progress" style="flex-grow: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;">
              <!-- Tarjetas -->
            </div>
          </div>

          <!-- Columna: Completadas -->
          <div class="q-kanban-col" style="flex: 1; display: flex; flex-direction: column; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
            <div style="padding: 10px; background: rgba(16,185,129,0.1); border-bottom: 2px solid var(--accent-success); font-weight: 700; color: var(--accent-success); font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
              <span>✅ Completadas</span>
              <span class="col-count-badge" id="count-completed" style="background: var(--accent-success); color: #fff; padding: 2px 6px; border-radius: 10px; font-size: 0.75rem;">0</span>
            </div>
            <div class="q-kanban-cards" id="col-completed" style="flex-grow: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;">
              <!-- Tarjetas -->
            </div>
          </div>

          <!-- Columna: Canceladas -->
          <div class="q-kanban-col" style="flex: 1; display: flex; flex-direction: column; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
            <div style="padding: 10px; background: rgba(244,63,94,0.1); border-bottom: 2px solid var(--accent-danger); font-weight: 700; color: var(--accent-danger); font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
              <span>❌ Canceladas</span>
              <span class="col-count-badge" id="count-cancelled" style="background: var(--accent-danger); color: #fff; padding: 2px 6px; border-radius: 10px; font-size: 0.75rem;">0</span>
            </div>
            <div class="q-kanban-cards" id="col-cancelled" style="flex-grow: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;">
              <!-- Tarjetas -->
            </div>
          </div>

        </div>

      </div>

    </div>

    <!-- MODAL DE ASIGNACIÓN / PROGRAMACIÓN QUIRÚRGICA -->
    <div id="q-schedule-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 2000;">
      <div class="modal-content glass-card" style="max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; padding: 1.5rem; border-top: 3px solid var(--accent-primary);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3 style="color: var(--accent-primary); font-family: var(--font-heading); margin: 0;">📅 Programar Intervención Quirúrgica</h3>
          <button type="button" class="modal-close" id="btn-close-schedule-modal" style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <form id="q-schedule-form" style="display: flex; flex-direction: column; gap: 12px;">
          <input type="hidden" id="q-sched-patient-id">
          
          <div class="form-group">
            <label>Paciente</label>
            <input type="text" id="q-sched-patient-name" readonly style="background: rgba(255,255,255,0.05); font-weight: bold; cursor: not-allowed;">
          </div>

          <div style="border-top: 1px dashed var(--border-color); padding-top: 8px;">
            <h5 style="color: var(--accent-secondary); margin-bottom: 6px; font-size: 0.9rem;">Equipo Médico Asignado</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label>Cirujano Principal</label>
                <select id="q-sched-surgeon" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                  <!-- Inyectado por JS -->
                </select>
                <input type="text" id="q-sched-external-name" placeholder="Nombre del Cirujano Externo" style="display: none; width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                <label style="display: flex; align-items: center; gap: 6px; margin-top: 5px; font-size: 0.78rem; text-transform: none; color: var(--text-muted); cursor: pointer;">
                  <input type="checkbox" id="q-sched-is-external-surgeon"> ¿Es cirujano externo?
                </label>
              </div>
              <div class="form-group" id="q-group-colegiado" style="display: none;">
                <label>Número de Colegiado</label>
                <input type="text" id="q-sched-colegiado" placeholder="Ej. 12345">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 6px;">
              <div class="form-group">
                <label>Anestesiólogo/a</label>
                <input type="text" id="q-sched-anesthesiologist" required placeholder="Nombre completo" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              </div>
              <div class="form-group">
                <label>Enfermero/a Circulante</label>
                <input type="text" id="q-sched-circulating" required placeholder="Nombre completo" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              </div>
              <div class="form-group">
                <label>Enfermero/a Instrumentista</label>
                <input type="text" id="q-sched-scrub" required placeholder="Nombre completo" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              </div>
            </div>
          </div>

          <div style="border-top: 1px dashed var(--border-color); padding-top: 8px;">
            <h5 style="color: var(--accent-secondary); margin-bottom: 6px; font-size: 0.9rem;">Procedimiento y Ubicación</h5>
            <div class="form-group" style="position: relative;">
              <label>Procedimiento Quirúrgico</label>
              <input type="text" id="q-sched-procedure-search" placeholder="Escriba para buscar o ingrese un procedimiento..." required autocomplete="off" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
              <!-- Autocomplete suggestions dropdown -->
              <div id="q-procedure-suggestions" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; background: #1e293b; border: 1px solid var(--border-color); z-index: 100; max-height: 150px; overflow-y: auto; border-radius: var(--radius-sm); box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">
              <div class="form-group">
                <label>Sala Quirúrgica</label>
                <select id="q-sched-room" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                  <option value="Quirófano Único">Quirófano Único</option>
                </select>
              </div>
              <div class="form-group">
                <label>Duración Estimada</label>
                <select id="q-sched-duration" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                  <option value="30 minutos">30 minutos</option>
                  <option value="1 hora">1 hora</option>
                  <option value="1 hora 30 minutos">1 hora 30 minutos</option>
                  <option value="2 horas">2 horas</option>
                  <option value="3 horas">3 horas</option>
                  <option value="4 horas o más">4 horas o más</option>
                </select>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-schedule">Cancelar</button>
            <button type="submit" class="btn btn-success">📅 Agendar Cirugía</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL DE CIERRE / REGISTRO POST-OPERATORIO (POST-OP) -->
    <div id="q-postop-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 2000;">
      <div class="modal-content glass-card" style="max-width: 650px; width: 90%; max-height: 92vh; overflow-y: auto; padding: 1.5rem; border-top: 3px solid var(--accent-success);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3 style="color: var(--accent-success); font-family: var(--font-heading); margin: 0;">✅ Cierre de Cirugía y Registro Post-Operatorio</h3>
          <button type="button" class="modal-close" id="btn-close-postop-modal" style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <form id="q-postop-form" style="display: flex; flex-direction: column; gap: 12px;">
          <input type="hidden" id="q-post-surgery-id">
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label>Paciente</label>
              <input type="text" id="q-post-patient-name" readonly style="background: rgba(255,255,255,0.05); font-weight: bold; cursor: not-allowed;">
            </div>
            <div class="form-group">
              <label>Estado de Salida del Paciente</label>
              <select id="q-post-status" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                <option value="Estable">Estable</option>
                <option value="En recuperación">En recuperación</option>
                <option value="Cuidado Intensivo/UTI">Cuidado Intensivo / UTI</option>
                <option value="Traslado">Traslado a Hospital de Especialidades</option>
                <option value="Fallecido">Fallecido en Sala</option>
              </select>
            </div>
          </div>

          <!-- Detalle de Insumos Consumidos -->
          <div style="border-top: 1px dashed var(--border-color); padding-top: 10px;">
            <h4 style="color: var(--accent-secondary); margin-bottom: 8px; font-size: 0.95rem;">Desglose de Material Médico y Medicamentos Usados</h4>
            
            <div style="display: grid; grid-template-columns: 1.5fr 80px 1fr auto; gap: 8px; align-items: flex-end; margin-bottom: 10px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.8rem; color: var(--text-muted);">Insumo / Medicamento</label>
                <select id="q-supply-select" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
                  <!-- Inyectado por JS -->
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.8rem; color: var(--text-muted);">Cantidad</label>
                <input type="number" id="q-supply-qty" min="1" value="1" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 0.85rem;">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.8rem; color: var(--text-muted);">Precio Unitario (Q)</label>
                <input type="number" step="0.01" id="q-supply-price" readonly style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: rgba(255,255,255,0.05); color: var(--text-primary); font-size: 0.85rem; cursor: not-allowed;">
              </div>
              <button type="button" class="btn btn-primary" id="btn-add-supply-item" style="padding: 8px 12px; font-size: 0.85rem;">Agregar</button>
            </div>

            <!-- Tabla de consumos agregados -->
            <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; background: rgba(0,0,0,0.15); margin-bottom: 10px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                <thead>
                  <tr style="background: rgba(255,255,255,0.05); border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-align: left;">
                    <th style="padding: 6px 8px;">Insumo</th>
                    <th style="padding: 6px 8px; text-align: center;">Cant.</th>
                    <th style="padding: 6px 8px; text-align: right;">Unitario</th>
                    <th style="padding: 6px 8px; text-align: right;">Total</th>
                    <th style="padding: 6px 8px; text-align: center;">Acción</th>
                  </tr>
                </thead>
                <tbody id="q-supplies-table-body">
                  <!-- Inyectado por JS -->
                </tbody>
              </table>
            </div>
          </div>

          <div style="border-top: 1px dashed var(--border-color); padding-top: 10px; display: grid; grid-template-columns: 1.5fr 1fr; gap: 15px; align-items: center;">
            <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
              * Al guardar, el costo se sincronizará automáticamente a la cuenta/facturación del paciente.
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-weight: 700; color: var(--accent-success);">Costo Total del Procedimiento (Q)</label>
              <input type="number" step="0.01" id="q-post-total-cost" required placeholder="0.00" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--accent-success); background: var(--bg-card); color: var(--text-primary); font-weight: bold; font-size: 1.1rem; text-align: right;">
            </div>
          </div>

          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-postop">Cancelar</button>
            <button type="submit" class="btn btn-success" id="btn-submit-postop">💾 Completar Cirugía</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL DE REGISTRO PACIENTE EXTERNO -->
    <div id="q-external-patient-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 2000;">
      <div class="modal-content glass-card" style="max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; padding: 1.5rem; border-top: 3px solid var(--accent-primary);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3 style="color: var(--accent-primary); font-family: var(--font-heading); margin: 0;">🏥 Registrar Paciente Externo para Quirófano</h3>
          <button type="button" class="modal-close" id="btn-close-external-modal" style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <form id="q-external-patient-form" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="form-group">
            <label>Nombre Completo</label>
            <input type="text" id="q-ext-name" required placeholder="Ej. Alejandra de León">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label>Fecha de Nacimiento</label>
              <input type="date" id="q-ext-birthdate" required>
            </div>
            <div class="form-group">
              <label>Género</label>
              <select id="q-ext-gender" required style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label>DPI / Documento</label>
              <input type="text" id="q-ext-dpi" placeholder="Ej. 2500 12345 0101">
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input type="tel" id="q-ext-phone" required placeholder="Ej. 5555-1234">
            </div>
          <div class="form-group">
            <label>Dirección</label>
            <input type="text" id="q-ext-address" required placeholder="Ej. Calle Principal 1-23 Zona 10">
          </div>
          <div style="border-top: 1px dashed var(--border-color); padding-top: 8px; margin-bottom: 8px;">
            <h5 style="color: var(--accent-secondary); margin-bottom: 6px; font-size: 0.9rem; text-transform: none;">Familiar o Responsable</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.8rem; color: var(--text-muted);">Nombre del Responsable</label>
                <input type="text" id="q-ext-responsible-name" required placeholder="Ej. Carlos de León">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 0.8rem; color: var(--text-muted);">Teléfono del Responsable</label>
                <input type="tel" id="q-ext-responsible-phone" required placeholder="Ej. 4444-1234">
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-external">Cancelar</button>
            <button type="submit" class="btn btn-primary">➕ Registrar e Ingresar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Variables de control de estado del Modal Post-Op
  let activePostOpSupplies = [];
  
  // Renderizadores internos
  renderCandidatos();
  renderPizarraBoard();

  // 1. Renderizar Sidebar de Pacientes Candidatos
  function renderCandidatos(query = '') {
    const listDiv = document.getElementById('q-patient-list');
    if (!listDiv) return;

    listDiv.innerHTML = '';
    const activeSurgIds = state.surgeries.filter(s => s.status === 'scheduled' || s.status === 'in_progress').map(s => s.patientId);

    // Filtrar pacientes no programados o en progreso actualmente
    const candidates = state.patients.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(query.toLowerCase());
      const notCurrentlyInSurgery = !activeSurgIds.includes(p.id);
      return matchesSearch && notCurrentlyInSurgery;
    });

    if (candidates.length === 0) {
      listDiv.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No hay candidatos disponibles.</div>`;
      return;
    }

    candidates.forEach(p => {
      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.padding = '10px';
      card.style.background = 'rgba(255,255,255,0.02)';
      card.style.border = '1px solid var(--border-color)';
      card.style.cursor = 'pointer';
      card.style.transition = 'all 0.2s';
      card.style.fontSize = '0.85rem';

      card.innerHTML = `
        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${p.name}</div>
        <div style="color: var(--text-muted); font-size: 0.75rem; margin-bottom: 8px;">DPI: ${p.dpi || 'N/A'} | Tel: ${p.telephone || 'N/A'}</div>
        <button class="btn btn-secondary btn-small btn-sched-trigger" style="width: 100%; border: 1px solid var(--accent-primary); color: var(--accent-primary); padding: 4px 0;" data-pid="${p.id}" data-pname="${p.name}">
          📅 Programar Cirugía
        </button>
      `;

      card.querySelector('.btn-sched-trigger').addEventListener('click', (e) => {
        e.stopPropagation();
        openSchedulingModal(p.id, p.name);
      });

      listDiv.appendChild(card);
    });
  }

  // Buscar en pacientes sidebar
  const searchInput = document.getElementById('q-search-patient');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderCandidatos(e.target.value);
    });
  }

  // 2. Renderizar columnas de Pizarra Kanban
  function renderPizarraBoard() {
    const columns = {
      scheduled: document.getElementById('col-scheduled'),
      in_progress: document.getElementById('col-in_progress'),
      completed: document.getElementById('col-completed'),
      cancelled: document.getElementById('col-cancelled')
    };

    const counts = { scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 };

    Object.keys(columns).forEach(status => {
      if (columns[status]) columns[status].innerHTML = '';
    });

    const surgeries = state.surgeries || [];
    surgeries.forEach(s => {
      if (!columns[s.status]) return;
      counts[s.status]++;

      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.padding = '12px';
      card.style.background = 'rgba(30, 41, 59, 0.6)';
      card.style.border = `1px solid var(--border-color)`;
      if (s.status === 'in_progress') {
        card.style.borderLeft = `4px solid var(--accent-secondary)`;
      } else if (s.status === 'completed') {
        card.style.borderLeft = `4px solid var(--accent-success)`;
      } else if (s.status === 'scheduled') {
        card.style.borderLeft = `4px solid var(--accent-primary)`;
      }

      const formattedDate = new Date(s.createdAt).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
          <strong style="font-size: 0.9rem; color: var(--text-primary);">${s.patientName}</strong>
          <span style="font-size: 0.7rem; color: var(--text-muted);">${formattedDate}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 700; margin-bottom: 5px;">🔬 ${s.procedureName}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px;">
          <span>🧑‍⚕️ <strong>Cirujano:</strong> ${s.surgeon.name} ${s.surgeon.colegiadoNumber ? `(Col. ${s.surgeon.colegiadoNumber})` : surgIsExternalLabel(s)}</span>
          <span>🧪 <strong>Anestesiólogo:</strong> ${s.anesthesiologist}</span>
          <span>🏥 <strong>Sala:</strong> ${s.operatingRoom} | ⏱️ Duración: ${s.estimatedDuration}</span>
          ${s.postOpStatus ? `<span>🏃‍♂️ <strong>Post-Op:</strong> <span style="font-weight:bold; color:var(--accent-success);">${s.postOpStatus}</span></span>` : ''}
          ${s.totalCost ? `<span>💳 <strong>Costo Total:</strong> <strong style="color:var(--accent-success);">Q${parseFloat(s.totalCost).toFixed(2)}</strong></span>` : ''}
        </div>
        
        <div style="display: flex; gap: 5px; margin-top: 10px; justify-content: flex-end;">
          ${s.status === 'scheduled' ? `
            <button class="btn btn-danger btn-small btn-q-cancel" data-id="${s.id}" style="padding: 3px 8px; font-size: 0.72rem;">Cancelar</button>
            <button class="btn btn-success btn-small btn-q-start" data-id="${s.id}" style="padding: 3px 8px; font-size: 0.72rem;">⚡ Iniciar</button>
          ` : ''}
          ${s.status === 'in_progress' ? `
            <button class="btn btn-success btn-small btn-q-finish" data-id="${s.id}" style="padding: 3px 8px; font-size: 0.72rem;">💾 Cerrar Cirugía</button>
          ` : ''}
          ${s.status === 'completed' ? `
            <button class="btn btn-secondary btn-small btn-q-print" data-id="${s.id}" style="padding: 3px 8px; font-size: 0.72rem;">🖨️ Reporte</button>
          ` : ''}
        </div>
      `;

      function surgIsExternalLabel(surg) {
        return surg.surgeon.isExternal ? '(Externo)' : '(Staff)';
      }

      // Eventos de control
      const startBtn = card.querySelector('.btn-q-start');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          s.status = 'in_progress';
          saveAppState(state);
          renderQuirofano(container);
        });
      }

      const cancelBtn = card.querySelector('.btn-q-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          if (confirm(`¿Está seguro de cancelar el procedimiento para ${s.patientName}?`)) {
            s.status = 'cancelled';
            saveAppState(state);
            renderQuirofano(container);
          }
        });
      }

      const finishBtn = card.querySelector('.btn-q-finish');
      if (finishBtn) {
        finishBtn.addEventListener('click', () => {
          openPostOpModal(s);
        });
      }

      const printBtn = card.querySelector('.btn-q-print');
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          printSurgicalRecord(s);
        });
      }

      columns[s.status].appendChild(card);
    });

    // Actualizar badges e indicadores
    Object.keys(counts).forEach(status => {
      const el = document.getElementById(`count-${status}`);
      if (el) el.textContent = counts[status];
    });

    const badgeTotalSched = document.getElementById('badge-total-scheduled');
    if (badgeTotalSched) badgeTotalSched.textContent = counts.scheduled;

    const badgeTotalProc = document.getElementById('badge-total-process');
    if (badgeTotalProc) badgeTotalProc.textContent = counts.in_progress;
  }

  // 3. Modales y Control de Programación
  const schedModal = document.getElementById('q-schedule-modal');
  const closeSchedBtn = document.getElementById('btn-close-schedule-modal');
  const cancelSchedBtn = document.getElementById('btn-cancel-schedule');

  function openSchedulingModal(patientId, patientName) {
    document.getElementById('q-sched-patient-id').value = patientId;
    document.getElementById('q-sched-patient-name').value = patientName;

    // Poblar médicos cirujanos
    const surgeonSelect = document.getElementById('q-sched-surgeon');
    const doctors = state.users.filter(u => {
      const r = String(u.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return r === 'medico' || r === 'medico 1' || r === 'medico 2' || r === 'medico 3';
    });
    if (surgeonSelect) {
      surgeonSelect.innerHTML = doctors.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    }

    // Limpiar form
    document.getElementById('q-sched-is-external-surgeon').checked = false;
    document.getElementById('q-group-colegiado').style.display = 'none';
    document.getElementById('q-sched-colegiado').value = '';
    document.getElementById('q-sched-colegiado').required = false;
    document.getElementById('q-sched-surgeon').disabled = false;
    document.getElementById('q-sched-surgeon').style.display = 'block';
    document.getElementById('q-sched-surgeon').required = true;
    document.getElementById('q-sched-external-name').value = '';
    document.getElementById('q-sched-external-name').style.display = 'none';
    document.getElementById('q-sched-external-name').required = false;
    document.getElementById('q-sched-anesthesiologist').value = '';
    document.getElementById('q-sched-circulating').value = '';
    document.getElementById('q-sched-scrub').value = '';
    document.getElementById('q-sched-procedure-search').value = '';

    schedModal.style.display = 'flex';
  }

  if (closeSchedBtn) closeSchedBtn.addEventListener('click', () => schedModal.style.display = 'none');
  if (cancelSchedBtn) cancelSchedBtn.addEventListener('click', () => schedModal.style.display = 'none');

  // Control de cirujano externo
  const externalSurgeonCb = document.getElementById('q-sched-is-external-surgeon');
  if (externalSurgeonCb) {
    externalSurgeonCb.addEventListener('change', (e) => {
      const colegiadoGroup = document.getElementById('q-group-colegiado');
      const colegiadoInput = document.getElementById('q-sched-colegiado');
      const surgeonSelect = document.getElementById('q-sched-surgeon');
      const externalNameInput = document.getElementById('q-sched-external-name');
      
      if (e.target.checked) {
        colegiadoGroup.style.display = 'block';
        colegiadoInput.required = true;
        surgeonSelect.style.display = 'none';
        surgeonSelect.required = false;
        externalNameInput.style.display = 'block';
        externalNameInput.required = true;
      } else {
        colegiadoGroup.style.display = 'none';
        colegiadoInput.required = false;
        surgeonSelect.style.display = 'block';
        surgeonSelect.required = true;
        externalNameInput.style.display = 'none';
        externalNameInput.required = false;
      }
    });
  }

  // Autocompletado del procedimiento
  const procedureSearch = document.getElementById('q-sched-procedure-search');
  const procedureSuggestions = document.getElementById('q-procedure-suggestions');

  if (procedureSearch && procedureSuggestions) {
    procedureSearch.addEventListener('input', (e) => {
      const val = e.target.value.trim().toLowerCase();
      if (!val) {
        procedureSuggestions.style.display = 'none';
        return;
      }

      const filtered = SURGICAL_PROCEDURES_CATALOG.filter(p => p.name.toLowerCase().includes(val));
      if (filtered.length === 0) {
        procedureSuggestions.style.display = 'none';
        return;
      }

      procedureSuggestions.innerHTML = filtered.map(p => `
        <div class="suggestion-item" style="padding: 8px 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;" data-name="${p.name}">
          <span style="color:var(--accent-primary); font-weight:bold;">${p.name}</span> <small style="color:var(--text-muted); float:right;">${p.specialty}</small>
        </div>
      `).join('');

      procedureSuggestions.style.display = 'block';

      procedureSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          procedureSearch.value = item.getAttribute('data-name');
          procedureSuggestions.style.display = 'none';
        });
      });
    });

    // Cerrar sugerencias al hacer click fuera
    document.addEventListener('click', (e) => {
      if (e.target !== procedureSearch) {
        procedureSuggestions.style.display = 'none';
      }
    });
  }

  // Guardar programación de cirugía
  const schedForm = document.getElementById('q-schedule-form');
  if (schedForm) {
    schedForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const pId = document.getElementById('q-sched-patient-id').value;
      const pName = document.getElementById('q-sched-patient-name').value;
      const isExternalSurg = document.getElementById('q-sched-is-external-surgeon').checked;
      
      let surgeonName = '';
      let colegiado = '';
      if (isExternalSurg) {
        colegiado = document.getElementById('q-sched-colegiado').value.trim();
        surgeonName = document.getElementById('q-sched-external-name').value.trim() || "Cirujano Externo";
      } else {
        surgeonName = document.getElementById('q-sched-surgeon').value;
      }

      const anesthesiologist = document.getElementById('q-sched-anesthesiologist').value.trim();
      const circulating = document.getElementById('q-sched-circulating').value.trim();
      const scrub = document.getElementById('q-sched-scrub').value.trim();
      const procedure = document.getElementById('q-sched-procedure-search').value.trim();
      const room = document.getElementById('q-sched-room').value;
      const duration = document.getElementById('q-sched-duration').value;

      const newSurgery = {
        id: 'surg-' + Date.now(),
        patientId: pId,
        patientName: pName,
        isExternalPatient: false,
        surgeon: {
          name: surgeonName,
          isExternal: isExternalSurg,
          colegiadoNumber: colegiado || null
        },
        anesthesiologist,
        circulatingNurse: circulating,
        scrubNurse: scrub,
        procedureName: procedure,
        operatingRoom: room,
        estimatedDuration: duration,
        status: 'scheduled',
        medicalSuppliesUsed: [],
        totalCost: 0,
        billingSynced: false,
        createdAt: new Date().toISOString()
      };

      state.surgeries.unshift(newSurgery);
      saveAppState(state);
      schedModal.style.display = 'none';
      renderQuirofano(container);
    });
  }

  // 4. Modales y Control de Post-Op (Cierre)
  const postopModal = document.getElementById('q-postop-modal');
  const closePostopBtn = document.getElementById('btn-close-postop-modal');
  const cancelPostopBtn = document.getElementById('btn-cancel-postop');
  let currentSurgeryObj = null;

  function openPostOpModal(surgery) {
    currentSurgeryObj = surgery;
    document.getElementById('q-post-surgery-id').value = surgery.id;
    document.getElementById('q-post-patient-name').value = surgery.patientName;
    document.getElementById('q-post-status').value = 'En recuperación';
    document.getElementById('q-post-total-cost').value = '0.00';
    activePostOpSupplies = [];

    // Poblar dropdown de insumos
    const supplySelect = document.getElementById('q-supply-select');
    if (supplySelect) {
      supplySelect.innerHTML = SURGICAL_SUPPLIES_CATALOG.map(s => `<option value="${s.id}">${s.name} (Q${s.price.toFixed(2)})</option>`).join('');
      updateSupplyPriceField();
      supplySelect.removeEventListener('change', updateSupplyPriceField);
      supplySelect.addEventListener('change', updateSupplyPriceField);
    }

    renderPostOpSuppliesTable();
    postopModal.style.display = 'flex';
  }

  function updateSupplyPriceField() {
    const supplySelect = document.getElementById('q-supply-select');
    const priceInput = document.getElementById('q-supply-price');
    if (!supplySelect || !priceInput) return;
    const found = SURGICAL_SUPPLIES_CATALOG.find(s => s.id === supplySelect.value);
    priceInput.value = found ? found.price.toFixed(2) : '0.00';
  }

  if (closePostopBtn) closePostopBtn.addEventListener('click', () => postopModal.style.display = 'none');
  if (cancelPostopBtn) cancelPostopBtn.addEventListener('click', () => postopModal.style.display = 'none');

  // Agregar insumo a la tabla de consumos en el modal
  const addSupplyBtn = document.getElementById('btn-add-supply-item');
  if (addSupplyBtn) {
    addSupplyBtn.addEventListener('click', () => {
      const supplySelect = document.getElementById('q-supply-select');
      const qtyInput = document.getElementById('q-supply-qty');
      
      const found = SURGICAL_SUPPLIES_CATALOG.find(s => s.id === supplySelect.value);
      if (!found) return;

      const qty = parseInt(qtyInput.value) || 1;
      const existing = activePostOpSupplies.find(i => i.supplyId === found.id);
      if (existing) {
        existing.quantity += qty;
      } else {
        activePostOpSupplies.push({
          supplyId: found.id,
          name: found.name,
          quantity: qty,
          unitPrice: found.price
        });
      }

      qtyInput.value = "1";
      renderPostOpSuppliesTable();
    });
  }

  function renderPostOpSuppliesTable() {
    const tbody = document.getElementById('q-supplies-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    let totalSuppliesCost = 0;

    activePostOpSupplies.forEach((item, index) => {
      const totalItem = item.quantity * item.unitPrice;
      totalSuppliesCost += totalItem;

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
      tr.innerHTML = `
        <td style="padding: 6px 8px;">${item.name}</td>
        <td style="padding: 6px 8px; text-align: center;">${item.quantity}</td>
        <td style="padding: 6px 8px; text-align: right;">Q${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight:bold;">Q${totalItem.toFixed(2)}</td>
        <td style="padding: 6px 8px; text-align: center;">
          <button type="button" class="btn-delete-item" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:1rem;" data-idx="${index}">&times;</button>
        </td>
      `;

      tr.querySelector('.btn-delete-item').addEventListener('click', () => {
        activePostOpSupplies.splice(index, 1);
        renderPostOpSuppliesTable();
      });

      tbody.appendChild(tr);
    });

    // Auto-completar costo total estimado
    document.getElementById('q-post-total-cost').value = totalSuppliesCost.toFixed(2);
  }

  // Guardar Cierre de Cirugía
  const postopForm = document.getElementById('q-postop-form');
  if (postopForm) {
    postopForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!currentSurgeryObj) return;

      const postStatus = document.getElementById('q-post-status').value;
      const totalCost = parseFloat(document.getElementById('q-post-total-cost').value) || 0;

      // 1. Guardar detalles en el objeto cirugía
      currentSurgeryObj.status = 'completed';
      currentSurgeryObj.postOpStatus = postStatus;
      currentSurgeryObj.medicalSuppliesUsed = [...activePostOpSupplies];
      currentSurgeryObj.totalCost = totalCost;
      currentSurgeryObj.completedAt = new Date().toISOString();

      // 2. Sincronizar en el Récord de Facturación del Paciente
      const patientObj = state.patients.find(p => p.id === currentSurgeryObj.patientId);
      if (patientObj) {
        patientObj.billingHistory = patientObj.billingHistory || [];
        
        const detailsList = [
          { description: `Honorarios de Procedimiento Quirúrgico: ${currentSurgeryObj.procedureName}`, amount: totalCost - activePostOpSupplies.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) },
          ...activePostOpSupplies.map(i => ({ description: `Insumo Quirúrgico: ${i.name} (Cant: ${i.quantity})`, amount: i.quantity * i.unitPrice }))
        ].filter(d => d.amount > 0);

        if (detailsList.length === 0 && totalCost > 0) {
          detailsList.push({ description: `Procedimiento Quirúrgico: ${currentSurgeryObj.procedureName}`, amount: totalCost });
        }

        const billId = 'FAC-SURG-' + Date.now();
        const newBill = {
          id: billId,
          date: new Date().toISOString(),
          concept: `Servicio Quirúrgico - Sala ${currentSurgeryObj.operatingRoom}`,
          details: detailsList,
          diagnosis: `Post-Operatorio: ${postStatus}`,
          total: totalCost,
          status: 'Pendiente'
        };

        patientObj.billingHistory.unshift(newBill);
        currentSurgeryObj.billId = billId;
        currentSurgeryObj.billingSynced = true;
      }

      saveAppState(state);
      postopModal.style.display = 'none';
      alert(`Cirugía finalizada con éxito. Se ha generado un cobro pendiente de Q${totalCost.toFixed(2)} para el paciente.`);
      renderQuirofano(container);
    });
  }

  // 5. Registro de Paciente Externo Modal
  const extModal = document.getElementById('q-external-patient-modal');
  const btnAddExternal = document.getElementById('btn-add-external-patient');
  const closeExtBtn = document.getElementById('btn-close-external-modal');
  const cancelExtBtn = document.getElementById('btn-cancel-external');

  if (btnAddExternal) btnAddExternal.addEventListener('click', () => {
    document.getElementById('q-ext-name').value = '';
    document.getElementById('q-ext-birthdate').value = '';
    document.getElementById('q-ext-gender').value = 'Femenino';
    document.getElementById('q-ext-dpi').value = '';
    document.getElementById('q-ext-phone').value = '';
    document.getElementById('q-ext-address').value = '';
    document.getElementById('q-ext-responsible-name').value = '';
    document.getElementById('q-ext-responsible-phone').value = '';
    extModal.style.display = 'flex';
  });

  if (closeExtBtn) closeExtBtn.addEventListener('click', () => extModal.style.display = 'none');
  if (cancelExtBtn) cancelExtBtn.addEventListener('click', () => extModal.style.display = 'none');

  const extForm = document.getElementById('q-external-patient-form');
  if (extForm) {
    extForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('q-ext-name').value.trim();
      const birthdate = document.getElementById('q-ext-birthdate').value;
      const gender = document.getElementById('q-ext-gender').value;
      let dpi = document.getElementById('q-ext-dpi').value.trim();
      const phone = document.getElementById('q-ext-phone').value.trim();
      const address = document.getElementById('q-ext-address').value.trim();
      const responsibleName = document.getElementById('q-ext-responsible-name').value.trim();
      const responsiblePhone = document.getElementById('q-ext-responsible-phone').value.trim();

      const dob = new Date(birthdate);
      const ageMs = Date.now() - dob.getTime();
      const ageYears = Math.abs(new Date(ageMs).getUTCFullYear() - 1970);
      if (ageYears < 18) {
        dpi = 'Menor de Edad';
      } else if (!dpi) {
        dpi = 'No Presenta Documento';
      }

      // Crear paciente del sistema
      const newId = 'p-' + (state.patients.length + 1) + '-' + Math.random().toString(36).substr(2, 4);
      const newPatient = {
        id: newId,
        name,
        birthdate,
        gender,
        dpi,
        assignedDoctorId: state.users[0]?.id || 'Admin',
        assignedDoctorName: state.users[0]?.name || 'Administrador Maestro',
        telephone: phone,
        address,
        responsibleFamilyName: responsibleName,
        responsibleFamilyPhone: responsiblePhone,
        email: 'Paciente Externo Quirófano',
        vitalSigns: [],
        consultations: [],
        labHistory: [],
        imagingHistory: [],
        prescriptions: [],
        appointments: []
      };

      state.patients.push(newPatient);
      saveAppState(state);
      extModal.style.display = 'none';
      alert(`Paciente Externo ${name} registrado con éxito.`);
      renderCandidatos();
    });
  }

  // 6. Impresión de Reporte Quirúrgico Post-Operatorio
  function printSurgicalRecord(surg) {
    const stateObj = getAppState();
    const clinicInfo = stateObj.clinicInfo || { name: 'HOSPITAL MULTIMÉDICA', phone: '2200-0000', address: 'Guatemala' };
    const patientObj = stateObj.patients.find(p => p.id === surg.patientId) || {};

    const dob = patientObj.birthdate ? new Date(patientObj.birthdate) : null;
    let ageText = 'N/D';
    if (dob) {
      const ageDiff = Date.now() - dob.getTime();
      const ageDate = new Date(ageDiff);
      ageText = `${Math.abs(ageDate.getUTCFullYear() - 1970)} años`;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte Post-Operatorio - ${surg.id}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #333;
              padding: 20px;
              line-height: 1.5;
            }
            .header {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #1e3a8a;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .title {
              font-size: 1.4rem;
              font-weight: bold;
              color: #1e3a8a;
            }
            .grid-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 20px;
              font-size: 0.9rem;
            }
            .section-title {
              font-size: 1.1rem;
              font-weight: bold;
              background: #f3f4f6;
              color: #1e3a8a;
              padding: 5px 10px;
              margin-top: 20px;
              margin-bottom: 10px;
              border-left: 4px solid #1e3a8a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 0.85rem;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 8px;
              text-align: left;
            }
            th {
              background: #f9fafb;
              font-weight: bold;
            }
            .signatures-block {
              margin-top: 50px;
              display: flex;
              justify-content: space-between;
              font-size: 0.9rem;
            }
            .signature-line {
              border-top: 1px solid #000;
              width: 220px;
              text-align: center;
              padding-top: 5px;
              margin-top: 30px;
            }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px;">
            <button onclick="window.print();" style="padding: 10px 20px; background: #1e3a8a; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🖨️ Imprimir Reporte</button>
            <button onclick="window.close();" style="padding: 10px 20px; background: #f3f4f6; color: #333; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; margin-left: 10px;">Cerrar</button>
          </div>

          <div class="header">
            <div>
              <div class="title">${clinicInfo.name}</div>
              <span style="font-size: 0.8rem; color: #666;">Dirección: ${clinicInfo.address} | Tel: ${clinicInfo.phone}</span>
            </div>
            <div style="text-align: right;">
              <strong style="font-size: 1.1rem; color: #1e3a8a;">REGISTRO QUIRÚRGICO POST-OPERATORIO</strong><br>
              <strong>ID Cirugía:</strong> ${surg.id}<br>
              <strong>Fecha:</strong> ${new Date(surg.completedAt || surg.createdAt).toLocaleDateString('es-GT')}
            </div>
          </div>

          <div class="section-title">Información del Paciente</div>
          <div class="grid-info">
            <div><strong>Nombre:</strong> ${surg.patientName}</div>
            <div><strong>DPI / Pasaporte:</strong> ${patientObj.dpi || 'N/A'}</div>
            <div><strong>Edad:</strong> ${ageText}</div>
            <div><strong>Género:</strong> ${patientObj.gender || 'N/A'}</div>
          </div>

          <div class="section-title">Detalles del Procedimiento</div>
          <div class="grid-info">
            <div><strong>Procedimiento Quirúrgico:</strong> ${surg.procedureName}</div>
            <div><strong>Sala de Operaciones:</strong> ${surg.operatingRoom}</div>
            <div><strong>Fecha/Hora de Inicio:</strong> ${new Date(surg.createdAt).toLocaleString('es-GT')}</div>
            <div><strong>Fecha/Hora de Cierre:</strong> ${surg.completedAt ? new Date(surg.completedAt).toLocaleString('es-GT') : 'N/A'}</div>
            <div><strong>Estado Post-Operatorio:</strong> <span style="font-weight:bold;">${surg.postOpStatus || 'Estable'}</span></div>
            <div><strong>Costo Total Asignado:</strong> Q${surg.totalCost ? parseFloat(surg.totalCost).toFixed(2) : '0.00'}</div>
          </div>

          <div class="section-title">Equipo Quirúrgico</div>
          <div class="grid-info">
            <div><strong>Cirujano Principal:</strong> ${surg.surgeon.name} ${surg.surgeon.colegiadoNumber ? `(Col. ${surg.surgeon.colegiadoNumber})` : ''}</div>
            <div><strong>Anestesiólogo/a:</strong> ${surg.anesthesiologist}</div>
            <div><strong>Enfermero/a Circulante:</strong> ${surg.circulatingNurse}</div>
            <div><strong>Enfermero/a Instrumentista:</strong> ${surg.scrubNurse}</div>
          </div>

          <div class="section-title">Desglose de Insumos y Medicamentos Utilizados</div>
          ${surg.medicalSuppliesUsed && surg.medicalSuppliesUsed.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Insumo Médico / Fármaco</th>
                  <th style="text-align: center;">Cantidad</th>
                  <th style="text-align: right;">Precio Unitario</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${surg.medicalSuppliesUsed.map(i => `
                  <tr>
                    <td>${i.name}</td>
                    <td style="text-align: center;">${i.quantity}</td>
                    <td style="text-align: right;">Q${parseFloat(i.unitPrice).toFixed(2)}</td>
                    <td style="text-align: right; font-weight: bold;">Q${(i.quantity * i.unitPrice).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="font-size:0.85rem; color:#666;">No se registraron insumos de sala detallados en este reporte.</p>'}

          <div class="signatures-block">
            <div class="signature-line">
              Firma del Cirujano Principal<br>
              Col. ${surg.surgeon.colegiadoNumber || '_________________'}
            </div>
            <div class="signature-line">
              Firma del Anestesiólogo/a
            </div>
            <div class="signature-line">
              Firma Supervisor de Quirófano
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}
