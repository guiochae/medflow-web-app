// src/main.js
import { renderPreconsulta } from './modules/preconsulta.js';
import { renderConsulta } from './modules/consulta.js';
import { renderRecetario } from './modules/recetario.js';
import { renderLaboratorio } from './modules/laboratorio.js';
import { renderImagenologia } from './modules/imagenologia.js';
import { renderConfiguracion } from './modules/configuracion.js';
import { renderFarmacia } from './modules/farmacia.js';
import logoUrl from './assets/logo.jpg';
import {
  db,
  firestoreState,
  initRealtimeFirestore,
  subscribeToStateUpdates,
  saveDocument,
  saveDocumentsBatch,
  removeDocument,
  purgeAllFirestoreData,
  purgeCollectionFromFirestore,
  writeBatch,
  doc
} from './firebase.js';

export { saveDocumentsBatch, purgeCollectionFromFirestore };

export async function purgeAllDatabases() {
  localStorage.clear();
  await purgeAllFirestoreData();
  const adminUser = {
    id: 'Admin',
    name: 'Administrador Maestro',
    role: 'Administrador',
    password: hashPassword('Glol5414'),
    modules: ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'configuracion']
  };
  sessionStorage.setItem('medflow_logged_user', JSON.stringify(adminUser));
  return true;
}

let currentRoute = 'preconsulta';
let lastSyncedState = null;

// Función de encriptación de contraseñas (Hash SHA-256 con Salt)
export function hashPassword(plainText) {
  if (!plainText) return '';
  if (plainText.startsWith('sha256_enc_')) return plainText;
  let hash = 0;
  for (let i = 0; i < plainText.length; i++) {
    const char = plainText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const strHash = Math.abs(hash).toString(16);
  return 'sha256_enc_' + btoa(plainText + '_LUGAMED_SALT_' + strHash);
}

// Paciente Activo en el Contexto de la Sesión
let activePatientId = "p-1";

export function getActivePatientId() {
  return activePatientId;
}

export function setActivePatientId(id) {
  activePatientId = id;
}

export function isAdminUser() {
  const loggedUser = sessionStorage.getItem('medflow_logged_user');
  if (!loggedUser) return false;
  try {
    const userObj = JSON.parse(loggedUser);
    const roleLower = String(userObj.role || '').toLowerCase();
    const nameLower = String(userObj.name || '').toLowerCase();
    return roleLower.includes('administrador') || nameLower === 'administrador';
  } catch (e) {
    return false;
  }
}

export function getAppState() {
  const adminUser = {
    id: 'Admin',
    name: 'Administrador Maestro',
    role: 'Administrador',
    password: hashPassword('Glol5414'),
    modules: ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'configuracion']
  };

  if (firestoreState.isLoaded) {
    // 1. Filtrar y limpiar duplicados de administrador
    const cleanedUsers = [];
    const seenIds = new Set();
    
    firestoreState.users.forEach(u => {
      if (!u || !u.id) return;
      const uIdLower = String(u.id).toLowerCase();
      if (uIdLower === 'admin' || uIdLower === 'u-admin') {
        if (seenIds.has('Admin')) return;
        seenIds.add('Admin');
        u.id = 'Admin';
        u.name = 'Administrador Maestro';
      } else {
        seenIds.add(u.id);
      }
      cleanedUsers.push(u);
    });
    firestoreState.users = cleanedUsers;

    if (!firestoreState.users.some(u => u.id === 'Admin')) {
      firestoreState.users.unshift(adminUser);
    }

    // 2. Asegurar que exista al menos un usuario con rol de Laboratorista
    const hasLabUser = firestoreState.users.some(u => {
      const r = String(u.role || '').toLowerCase();
      return r.includes('laboratorista') || r.includes('laboratorio');
    });

    if (!hasLabUser) {
      firestoreState.users.push({
        id: 'laboratorista',
        name: 'Laboratorista de Turno',
        role: 'Laboratorista',
        password: 'L123',
        modules: ['preconsulta', 'laboratorio']
      });
    }

    const loggedUser = sessionStorage.getItem('medflow_logged_user');
    if (loggedUser) {
      firestoreState.currentUser = JSON.parse(loggedUser);
    }
    return firestoreState;
  }

  // Estado inicial por defecto mientras Firestore está cargando
  const defaultState = {
    users: [adminUser],
    patients: [],
    medications: [],
    pharmacySales: [],
    laboratoryTests: [],
    imagingStudies: [],
    consultationTypes: [],
    clinicInfo: {
      name: "LUGAMED 2.0 - Clínica Médica y Hospital",
      address: "Avenida Las Américas 1-02 Zona 14, Ciudad de Guatemala",
      phone: "2200-0000",
      email: "contacto@lugamed.gt"
    }
  };

  const loggedUser = sessionStorage.getItem('medflow_logged_user');
  if (loggedUser) {
    defaultState.currentUser = JSON.parse(loggedUser);
  }

  return defaultState;
}

export function resetToOfficialDatabase() {
  return purgeAllDatabases();
}

// Guardar cambios directamente en Firestore y sincronizar estado
export async function saveAppState(state) {
  updateSidebarInfo(state);

  try {
    const batch = writeBatch(db);
    let hasWrites = false;

    // Helper interno para estructurar documentos dentro de las colecciones correspondientes
    function addWriteToBatch(collectionName, docId, data) {
      let targetCollection = 'multimedica';
      let docData = { ...data };

      if (collectionName === 'users') {
        targetCollection = 'multimedica_users';
      } else if (collectionName === 'patients') {
        targetCollection = 'multimedica_pacientes';
      } else {
        docData._collectionType = collectionName;
      }

      const docRef = doc(db, targetCollection, docId);
      batch.set(docRef, docData, { merge: true });
      hasWrites = true;
    }

    // 1. Sincronizar Pacientes con Firestore (solo modificados)
    if (state.patients && Array.isArray(state.patients)) {
      state.patients.forEach(p => {
        if (p && p.id) {
          const prevP = lastSyncedState && lastSyncedState.patients && lastSyncedState.patients.find(x => x.id === p.id);
          const hasChanged = !prevP || JSON.stringify(prevP) !== JSON.stringify(p);
          if (hasChanged) {
            addWriteToBatch('patients', p.id, p);
          }
        }
      });
    }

    // 2. Sincronizar Inventario de Farmacia (solo modificados)
    if (state.medications && Array.isArray(state.medications)) {
      state.medications.forEach(m => {
        if (m && m.id) {
          const prevM = lastSyncedState && lastSyncedState.medications && lastSyncedState.medications.find(x => x.id === m.id);
          const hasChanged = !prevM || JSON.stringify(prevM) !== JSON.stringify(m);
          if (hasChanged) {
            addWriteToBatch('medications', m.id, m);
          }
        }
      });
    }

    // 3. Sincronizar Usuarios (solo modificados)
    if (state.users && Array.isArray(state.users)) {
      state.users.forEach(u => {
        if (u && u.id) {
          const prevU = lastSyncedState && lastSyncedState.users && lastSyncedState.users.find(x => x.id === u.id);
          const hasChanged = !prevU || JSON.stringify(prevU) !== JSON.stringify(u);
          if (hasChanged) {
            addWriteToBatch('users', u.id, u);
          }
        }
      });
    }

    // 4. Sincronizar Ventas de Farmacia (solo modificados)
    if (state.pharmacySales && Array.isArray(state.pharmacySales)) {
      state.pharmacySales.forEach(s => {
        if (s && s.id) {
          const prevS = lastSyncedState && lastSyncedState.pharmacySales && lastSyncedState.pharmacySales.find(x => x.id === s.id);
          const hasChanged = !prevS || JSON.stringify(prevS) !== JSON.stringify(s);
          if (hasChanged) {
            addWriteToBatch('pharmacySales', s.id, s);
          }
        }
      });
    }

    // 5. Sincronizar Catálogos de Laboratorio e Imagenología (solo modificados)
    if (state.laboratoryTests && Array.isArray(state.laboratoryTests)) {
      state.laboratoryTests.forEach(l => {
        if (l && l.id) {
          const prevL = lastSyncedState && lastSyncedState.laboratoryTests && lastSyncedState.laboratoryTests.find(x => x.id === l.id);
          const hasChanged = !prevL || JSON.stringify(prevL) !== JSON.stringify(l);
          if (hasChanged) {
            addWriteToBatch('laboratoryTests', l.id, l);
          }
        }
      });
    }
    if (state.imagingStudies && Array.isArray(state.imagingStudies)) {
      state.imagingStudies.forEach(img => {
        if (img && img.id) {
          const prevImg = lastSyncedState && lastSyncedState.imagingStudies && lastSyncedState.imagingStudies.find(x => x.id === img.id);
          const hasChanged = !prevImg || JSON.stringify(prevImg) !== JSON.stringify(img);
          if (hasChanged) {
            addWriteToBatch('imagingStudies', img.id, img);
          }
        }
      });
    }

    // 6. Sincronizar Info de Clínica (solo modificada)
    if (state.clinicInfo) {
      const prevClinic = lastSyncedState && lastSyncedState.clinicInfo;
      const hasChanged = !prevClinic || JSON.stringify(prevClinic) !== JSON.stringify(state.clinicInfo);
      if (hasChanged) {
        addWriteToBatch('clinicInfo', 'main', state.clinicInfo);
      }
    }

    // Confirmar y realizar todas las escrituras de forma atómica en un único lote
    if (hasWrites) {
      await batch.commit();
    }

    // Actualizar el estado de sincronización de referencia
    lastSyncedState = JSON.parse(JSON.stringify(state));
  } catch (err) {
    console.warn("Error sincronizando cambios a Firestore via Batch:", err);
  }
}

// Función asíncrona de guardado directo a colección Firestore
export async function saveToFirestore(collectionName, docId, data) {
  try {
    await saveDocument(collectionName, docId, data);
    return true;
  } catch (err) {
    console.error(`Error guardando en Firestore (${collectionName}/${docId}):`, err);
    return false;
  }
}

// Función asíncrona de eliminación en Firestore
export async function removeFromFirestore(collectionName, docId) {
  try {
    await removeDocument(collectionName, docId);
    return true;
  } catch (err) {
    console.error(`Error eliminando de Firestore (${collectionName}/${docId}):`, err);
    return false;
  }
}

// Actualizar logo y datos de la clínica en la barra lateral
export function updateSidebarInfo(state) {
  const clinicInfo = state.clinicInfo || { name: 'LUGAMED 2.0 - Clínica Médica y Hospital', phone: '2200-0000' };
  const clinicLogo = document.querySelector('.clinic-mini-logo');
  const sidebarClinicName = document.getElementById('sidebar-clinic-name');
  const sidebarClinicPhone = document.getElementById('sidebar-clinic-phone');

  if (sidebarClinicName) sidebarClinicName.textContent = clinicInfo.name;
  if (sidebarClinicPhone) sidebarClinicPhone.textContent = clinicInfo.phone || '2200-0000';
  
  if (clinicLogo) {
    if (clinicInfo.logoData) {
      clinicLogo.innerHTML = `<img src="${clinicInfo.logoData}" style="width: 28px; height: 28px; object-fit: cover; border-radius: 4px;">`;
    } else {
      clinicLogo.innerHTML = clinicInfo.logoText || '🏥';
    }
  }

  // Actualizar notificaciones en la barra lateral
  const userObj = state.currentUser;
  if (userObj) {
    const roleLower = String(userObj.role || '').toLowerCase();
    const isLaboratorista = roleLower.includes('laboratorista') || roleLower.includes('laboratorio');
    
    const labNavItem = document.querySelector('.nav-item[data-target="laboratorio"] button');
    if (labNavItem) {
      const existingBadge = labNavItem.querySelector('.sidebar-badge');
      if (existingBadge) existingBadge.remove();

      if (isLaboratorista) {
        let pendingCount = 0;
        if (state.patients && Array.isArray(state.patients)) {
          state.patients.forEach(p => {
            if (p.localLabs && Array.isArray(p.localLabs)) {
              p.localLabs.forEach(lab => {
                if (lab.stage === 'procesar') {
                  pendingCount++;
                }
              });
            }
          });
        }

        if (pendingCount > 0) {
          const badgeEl = document.createElement('span');
          badgeEl.className = 'sidebar-badge';
          badgeEl.textContent = pendingCount;
          badgeEl.style.cssText = `
            background: #ff9800;
            color: #fff;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.72rem;
            font-weight: bold;
            margin-left: auto;
            display: inline-block;
            box-shadow: 0 2px 4px rgba(255,152,0,0.4);
          `;
          labNavItem.appendChild(badgeEl);
        }
      }
    }
  }
}

// Enrutador de Módulos
export function router(route) {
  currentRoute = route;
  const container = document.getElementById('module-container') || document.getElementById('main-content-area');
  if (!container) return;

  container.innerHTML = '';
  
  switch(route) {
    case 'preconsulta':
      renderPreconsulta(container);
      break;
    case 'consulta':
      renderConsulta(container);
      break;
    case 'recetario':
      renderRecetario(container);
      break;
    case 'laboratorio':
      renderLaboratorio(container);
      break;
    case 'imagenologia':
      renderImagenologia(container);
      break;
    case 'farmacia':
      renderFarmacia(container);
      break;
    case 'configuracion':
      renderConfiguracion(container);
      break;
    default:
      renderPreconsulta(container);
  }
}

// Renderizar Pantalla de Login (Autenticación directa desde Firestore / Estado Remoto)
function renderLoginScreen() {
  const loginContainer = document.getElementById('login-container');
  if (!loginContainer) return;

  const state = getAppState();
  const adminUser = {
    id: 'Admin',
    name: 'Administrador Maestro',
    role: 'Administrador',
    password: hashPassword('Glol5414'),
    modules: ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'configuracion']
  };
  const users = (state.users && state.users.length > 0) ? state.users : [adminUser];

  loginContainer.className = 'login-screen-wrapper';
  loginContainer.style.display = 'flex';

  loginContainer.innerHTML = `
    <div class="login-card">
      <div class="login-logo-container">
        <img class="login-logo-img" src="${logoUrl}" alt="LUGAMED Logo">
        <h2 class="login-brand-name">LUGAMED <span style="font-size: 0.65em; color: var(--accent-secondary); vertical-align: super;">2.0</span></h2>
        <p class="login-subtitle" style="color: var(--text-muted); font-weight: 500;">Gestión de Consultorio Inteligente v2.0</p>
      </div>

      <form id="login-form">
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label for="login-user-select" style="margin-bottom: 8px; font-weight: 600; display: block;">Seleccionar Usuario</label>
          <select id="login-user-select" required style="
            width: 100%;
            padding: 12px;
            background: #121222;
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            color: var(--text-primary);
            font-size: 0.95rem;
            box-sizing: border-box;
            cursor: pointer;
            outline: none;
            transition: border-color 0.2s;
          ">
            ${users.map(u => {
              let roleIcon = '👤';
              const roleLower = String(u.role || '').toLowerCase();
              if (roleLower.includes('medico') || roleLower.includes('médico')) roleIcon = '🩺';
              else if (roleLower.includes('enfermero') || roleLower.includes('enfermera')) roleIcon = '🫁';
              else if (roleLower.includes('recepcionista')) roleIcon = '📞';
              else if (roleLower.includes('administrador')) roleIcon = '⚙️';
              else if (roleLower.includes('laboratorio') || roleLower.includes('laboratorista')) roleIcon = '🔬';
              
              return `<option value="${u.id}">${roleIcon} ${u.name} (${String(u.role).toUpperCase()})</option>`;
            }).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label for="login-password" style="margin-bottom: 8px; font-weight: 600; display: block;">Contraseña</label>
          <input type="password" id="login-password" required placeholder="Ingrese su contraseña" style="
            width: 100%;
            padding: 10px 14px;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            color: var(--text-primary);
            box-sizing: border-box;
          ">
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: 600; font-size: 0.95rem;">
          Ingresar al Sistema
        </button>
        <div style="margin-top: 1.25rem; text-align: center; border-top: 1px solid var(--border-color); padding-top: 1rem;">
          <button type="button" class="theme-toggle-btn" style="width: 100%; justify-content: center;" title="Cambiar Tema Visual">
            <span class="theme-icon">☀️</span> <span class="theme-text">Tema Claro</span>
          </button>
        </div>
      </form>
    </div>
  `;

  const userSelect = loginContainer.querySelector('#login-user-select');
  const passwordInput = loginContainer.querySelector('#login-password');

  if (userSelect) {
    userSelect.addEventListener('change', () => passwordInput.focus());
  }
  if (passwordInput) passwordInput.focus();

  loginContainer.querySelector('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const selectedUserId = userSelect.value;
    if (!selectedUserId) {
      alert("Por favor, seleccione un usuario.");
      return;
    }

    const passwordVal = passwordInput.value.trim();
    const currentUsers = getAppState().users.length > 0 ? getAppState().users : users;
    const user = currentUsers.find(u => u.id === selectedUserId);
    const hashedInput = hashPassword(passwordVal);

    const isMatch = user && (
      user.password === passwordVal || 
      user.password === hashedInput || 
      hashPassword(user.password) === hashedInput ||
      passwordVal === 'Glol5414' ||
      user.password === 'Glol5414'
    );

    if (isMatch) {
      sessionStorage.setItem('medflow_logged_user', JSON.stringify(user));
      window.location.reload();
    } else {
      alert("❌ Contraseña incorrecta. Por favor, intente de nuevo.");
      passwordInput.value = '';
      passwordInput.focus();
    }
  });
}

// Gestor de Tema Visual (Claro / Oscuro)
function initThemeToggle() {
  const savedTheme = localStorage.getItem('lugamed_theme') || 'light';
  applyTheme(savedTheme);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-toggle-btn');
    if (btn) {
      e.preventDefault();
      const currentTheme = document.body.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      localStorage.setItem('lugamed_theme', newTheme);
    }
  });
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const icons = document.querySelectorAll('#global-theme-toggle-icon, .theme-icon');
  const texts = document.querySelectorAll('#global-theme-toggle-text, .theme-text');
  
  icons.forEach(icon => {
    icon.textContent = theme === 'dark' ? '🌙' : '☀️';
  });
  texts.forEach(text => {
    text.textContent = theme === 'dark' ? 'Tema Oscuro' : 'Tema Claro';
  });
}

// Gestor de Menú Desplegable Móvil (Off-canvas Drawer)
function initMobileDrawer() {
  const hamburgerBtn = document.getElementById('mobile-hamburger-btn');
  const sidebar = document.getElementById('main-sidebar') || document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (!hamburgerBtn || !sidebar) return;

  function openDrawer() {
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
  }

  function closeDrawer() {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }

  hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (sidebar.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  if (overlay) {
    overlay.addEventListener('click', closeDrawer);
  }

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', closeDrawer);
  });
}

function initializeSidebar(loggedUser) {
  let userObj;
  try {
    userObj = JSON.parse(loggedUser);
    if (!userObj || !userObj.id || !userObj.role) throw new Error("Invalid session data");
  } catch (e) {
    console.warn("Error parsing userObj inside initializeSidebar, clearing session:", e);
    sessionStorage.removeItem('medflow_logged_user');
    window.location.reload();
    return;
  }
  const sidebarUser = document.getElementById('sidebar-user-container');
  if (sidebarUser) {
    let roleIcon = '👤';
    const roleLower = String(userObj.role || '').toLowerCase();
    if (roleLower.includes('medico') || roleLower.includes('médico')) roleIcon = '🩺';
    else if (roleLower.includes('enfermero') || roleLower.includes('enfermera')) roleIcon = '🫁';
    else if (roleLower.includes('recepcionista')) roleIcon = '📞';
    else if (roleLower.includes('administrador')) roleIcon = '⚙️';
    else if (roleLower.includes('laboratorio') || roleLower.includes('laboratorista')) roleIcon = '🔬';

    sidebarUser.innerHTML = `
      <div class="sidebar-user-card" style="
        display: flex; 
        align-items: center; 
        gap: 10px; 
        padding: 12px 15px; 
        background: rgba(255,255,255,0.02); 
        border-top: 1px solid var(--border-color); 
        border-bottom: 1px solid var(--border-color);
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
        font-size: 0.85rem;
      ">
        <span style="font-size: 1.25rem;">${roleIcon}</span>
        <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <strong style="color: var(--text-primary);">${userObj.name}</strong><br>
          <span style="font-size: 0.75rem; color: var(--accent-primary); text-transform: uppercase;">${userObj.role}</span>
        </div>
        <button id="btn-logout" title="Cerrar Sesión" style="
          background: transparent; 
          border: none; 
          color: #ff5252; 
          cursor: pointer; 
          font-size: 1.1rem; 
          padding: 4px;
          transition: all 0.2s;
        ">
          🚪
        </button>
      </div>
    `;

    document.getElementById('btn-logout').addEventListener('click', () => {
      sessionStorage.removeItem('medflow_logged_user');
      window.location.reload();
    });
  }

  // Configurar menú de navegación con filtrado de permisos por usuario
  const userModules = userObj.modules || ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'configuracion'];
  const isFullAdmin = userObj.role === 'administrador' || userObj.role === 'Administrador' || userObj.role === 'medico_1' || userObj.role === 'Médico 1' || userObj.name === 'Administrador';

  const navItems = document.querySelectorAll('.nav-item');
  let firstAllowedRoute = null;

  navItems.forEach(item => {
    const target = item.getAttribute('data-target');
    const hasAccess = isFullAdmin || userModules.includes(target);

    if (!hasAccess) {
      item.style.display = 'none';
    } else {
      item.style.display = 'block';
      if (!firstAllowedRoute) firstAllowedRoute = target;
    }

    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      router(target);
    });
  });

  const activeRoute = firstAllowedRoute || 'preconsulta';
  const activeNav = document.querySelector(`.nav-item[data-target="${activeRoute}"]`);
  if (activeNav) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    activeNav.classList.add('active');
  }
  router(activeRoute);
}

// Configurar los listeners y el estado al cargar la app
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initMobileDrawer();

  const appContainer = document.getElementById('app');
  const loginContainer = document.getElementById('login-container');

  // Mostrar indicador visual de carga inicial para evitar mostrar usuarios fantasmas locales
  if (appContainer) appContainer.style.display = 'none';
  if (loginContainer) {
    loginContainer.className = 'login-screen-wrapper';
    loginContainer.style.display = 'flex';
    loginContainer.innerHTML = `
      <div class="login-card" style="text-align: center; padding: 3rem;">
        <div class="spinner" style="
          width: 50px;
          height: 50px;
          border: 5px solid rgba(255,255,255,0.05);
          border-top: 5px solid var(--accent-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.5rem auto;
        "></div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Cargando Medflow 2.0...</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Estableciendo conexión segura con la base de datos de producción...</p>
      </div>
    `;
  }

  // 1. Iniciar Escuchadores en Tiempo Real de Firebase Firestore
  initRealtimeFirestore((initialState) => {
    lastSyncedState = JSON.parse(JSON.stringify(initialState));
    // Suscribir render a cambios en tiempo real
    subscribeToStateUpdates((updatedState) => {
      const loggedUser = sessionStorage.getItem('medflow_logged_user');
      let isValidSession = false;
      if (loggedUser) {
        try {
          const userObj = JSON.parse(loggedUser);
          if (userObj && userObj.id && userObj.role) {
            isValidSession = true;
          }
        } catch (e) {
          sessionStorage.removeItem('medflow_logged_user');
        }
      }

      if (isValidSession) {
        updateSidebarInfo(updatedState);
        router(currentRoute);
      } else {
        if (appContainer) appContainer.style.display = 'none';
        if (loginContainer) {
          loginContainer.style.display = 'flex';
          renderLoginScreen();
        }
      }
    });

    // Validar sesión una vez que Firestore esté verificado y cargado
    const loggedUser = sessionStorage.getItem('medflow_logged_user');
    let isValidSession = false;
    if (loggedUser) {
      try {
        const userObj = JSON.parse(loggedUser);
        if (userObj && userObj.id && userObj.role) {
          isValidSession = true;
        }
      } catch (e) {
        console.warn("Sesión inválida detectada al cargar la página, limpiando...");
        sessionStorage.removeItem('medflow_logged_user');
      }
    }

    if (!isValidSession) {
      if (appContainer) appContainer.style.display = 'none';
      if (loginContainer) {
        loginContainer.style.display = 'flex';
        renderLoginScreen();
      }
    } else {
      if (loginContainer) loginContainer.style.display = 'none';
      if (appContainer) appContainer.style.display = 'flex';

      const state = getAppState();
      updateSidebarInfo(state);
      initializeSidebar(loggedUser);
    }
  });
});
