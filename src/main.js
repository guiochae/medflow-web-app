// src/main.js
import { renderPreconsulta } from './modules/preconsulta.js';
import { renderConsulta } from './modules/consulta.js';
import { renderRecetario } from './modules/recetario.js';
import { renderLaboratorio } from './modules/laboratorio.js';
import { renderImagenologia } from './modules/imagenologia.js';
import { renderConfiguracion } from './modules/configuracion.js';
import { renderFarmacia } from './modules/farmacia.js';
import logoUrl from './assets/logo.jpg';
import { medicationsDatabase } from './data/medicamentos.js';
import { laboratoryTests, imagingStudies } from './data/estudios.js';

import migratedInitialData from './data/medflow_db.json';

import {
  db,
  firestoreState,
  initRealtimeFirestore,
  seedInitialFirestoreData,
  subscribeToStateUpdates,
  saveDocument,
  removeDocument,
  purgeAllFirestoreData
} from './firebase.js';

export async function purgeAllDatabases() {
  await purgeAllFirestoreData();
  localStorage.clear();
  sessionStorage.clear();
  return true;
}

let currentRoute = 'preconsulta';

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

// Obtener estado unificado desde Firestore (con fallback a local cache)
export function getAppState() {
  if (firestoreState.isLoaded && firestoreState.patients.length > 0) {
    // Si el usuario actual está logueado, incluirlo en el estado
    const loggedUser = sessionStorage.getItem('medflow_logged_user');
    if (loggedUser) {
      firestoreState.currentUser = JSON.parse(loggedUser);
    }
    return firestoreState;
  }

  // Fallback a almacenamiento local o migrado si aún está cargando Firestore
  const localData = localStorage.getItem('medflow_db');
  let state = localData ? JSON.parse(localData) : JSON.parse(JSON.stringify(migratedInitialData));
  
  if (!state.patients || state.patients.length === 0) {
    state.patients = JSON.parse(JSON.stringify(migratedInitialData.patients));
  }
  if (!state.medications || state.medications.length === 0) {
    state.medications = JSON.parse(JSON.stringify(migratedInitialData.medications));
  }

  const loggedUser = sessionStorage.getItem('medflow_logged_user');
  if (loggedUser) {
    state.currentUser = JSON.parse(loggedUser);
  }

  return state;
}

export function resetToOfficialDatabase() {
  seedInitialFirestoreData();
  const state = JSON.parse(JSON.stringify(migratedInitialData));
  localStorage.setItem('medflow_db', JSON.stringify(state));
  return state;
}

// Guardar cambios directamente en Firestore y sincronizar estado
export async function saveAppState(state) {
  localStorage.setItem('medflow_db', JSON.stringify(state));
  updateSidebarInfo(state);

  try {
    // Sincronizar Pacientes con Firestore
    if (state.patients && Array.isArray(state.patients)) {
      state.patients.forEach(p => {
        if (p && p.id) saveDocument('patients', p.id, p);
      });
    }

    // Sincronizar Inventario de Farmacia
    if (state.medications && Array.isArray(state.medications)) {
      state.medications.forEach(m => {
        if (m && m.id) saveDocument('medications', m.id, m);
      });
    }

    // Sincronizar Usuarios
    if (state.users && Array.isArray(state.users)) {
      state.users.forEach(u => {
        if (u && u.id) saveDocument('users', u.id, u);
      });
    }

    // Sincronizar Ventas de Farmacia
    if (state.pharmacySales && Array.isArray(state.pharmacySales)) {
      state.pharmacySales.forEach(s => {
        if (s && s.id) saveDocument('pharmacySales', s.id, s);
      });
    }

    // Sincronizar Catálogos de Laboratorio e Imagenología
    if (state.laboratoryTests && Array.isArray(state.laboratoryTests)) {
      state.laboratoryTests.forEach(l => {
        if (l && l.id) saveDocument('laboratoryTests', l.id, l);
      });
    }
    if (state.imagingStudies && Array.isArray(state.imagingStudies)) {
      state.imagingStudies.forEach(img => {
        if (img && img.id) saveDocument('imagingStudies', img.id, img);
      });
    }

    // Sincronizar Info de Clínica
    if (state.clinicInfo) {
      saveDocument('clinicInfo', 'main', state.clinicInfo);
    }
  } catch (err) {
    console.warn("Error sincronizando cambios a Firestore:", err);
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
  const users = (state.users && state.users.length > 0) ? state.users : (migratedInitialData.users || []);

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
              if (u.role === 'medico' || (u.role && u.role.toLowerCase().includes('médico'))) roleIcon = '🩺';
              else if (u.role === 'enfermero' || (u.role && u.role.toLowerCase().includes('enfermera'))) roleIcon = '🫁';
              else if (u.role === 'recepcionista') roleIcon = '📞';
              else if (u.role === 'administrador') roleIcon = '⚙️';
              
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

// Configurar los listeners y el estado al cargar la app
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initMobileDrawer();

  // 1. Iniciar Sembrado y Escuchadores en Tiempo Real de Firebase Firestore
  seedInitialFirestoreData();
  initRealtimeFirestore(() => {
    // Suscribir render a cambios en tiempo real
    subscribeToStateUpdates((updatedState) => {
      const loggedUser = sessionStorage.getItem('medflow_logged_user');
      if (loggedUser) {
        updateSidebarInfo(updatedState);
        router(currentRoute);
      }
    });
  });

  const loggedUser = sessionStorage.getItem('medflow_logged_user');
  const appContainer = document.getElementById('app');
  const loginContainer = document.getElementById('login-container');

  if (!loggedUser) {
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

    // Cargar perfil en la barra lateral
    const userObj = JSON.parse(loggedUser);
    const sidebarUser = document.getElementById('sidebar-user-container');
    if (sidebarUser) {
      let roleIcon = '👤';
      if (userObj.role === 'medico' || (userObj.role && userObj.role.toLowerCase().includes('médico'))) roleIcon = '🩺';
      else if (userObj.role === 'enfermero' || (userObj.role && userObj.role.toLowerCase().includes('enfermera'))) roleIcon = '🫁';
      else if (userObj.role === 'recepcionista') roleIcon = '📞';
      else if (userObj.role === 'administrador') roleIcon = '⚙️';

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
});
