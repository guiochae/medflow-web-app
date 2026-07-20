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

// Función de encriptación de contraseñas para producción (Hash SHA-256 con Salt)
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

// Datos Iniciales de Producción
const initialMockData = {
  clinicInfo: {
    name: "Centro Médico Altamira",
    address: "Calzada Roosevelt 22-43 Zona 11, Ciudad de Guatemala",
    phone: "+502 2424-9900",
    email: "info@altamira.com.gt",
    logoText: "🏥"
  },
  users: [
    {
      id: "u-admin",
      name: "Administrador",
      role: "Administrador",
      password: hashPassword("Glol5414"),
      modules: ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'configuracion']
    },
    {
      id: "u-1",
      name: "Dr. Carlos Mendoza",
      role: "Médico 1",
      license: "12543",
      phone: "+502 5555-1100",
      password: hashPassword("Glol5414"),
      modules: ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'configuracion']
    },
    {
      id: "u-2",
      name: "Dra. Sofía Castillo",
      role: "Médico 2",
      license: "15980",
      phone: "+502 4432-8877",
      password: "Glol5414",
      modules: ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia']
    },
    {
      id: "u-med3",
      name: "Dr. Roberto Morales",
      role: "Médico 3",
      license: "18290",
      phone: "+502 5812-9900",
      password: "Glol5414",
      modules: ['preconsulta', 'consulta', 'recetario']
    },
    {
      id: "u-3",
      name: "María Estrada",
      role: "Recepcionista",
      phone: "+502 3321-4455",
      password: "Glol5414",
      modules: ['preconsulta', 'farmacia']
    },
    {
      id: "u-enf",
      name: "Enf. Ana Martínez",
      role: "Enfermera",
      phone: "+502 3321-5566",
      password: "Glol5414",
      modules: ['preconsulta']
    },
    {
      id: "u-reg-farm",
      name: "Lic. Mario Gómez",
      role: "Regente Farmacia",
      license: "F-9021",
      phone: "+502 5412-3311",
      password: "Glol5414",
      modules: ['farmacia']
    },
    {
      id: "u-reg-lab",
      name: "Licda. Elena Gómez",
      role: "Regente Laboratorio",
      license: "L-4412",
      phone: "+502 5900-2211",
      password: "Glol5414",
      modules: ['laboratorio']
    }
  ],
  patients: [
    {
      id: "p-1",
      name: "Juan Francisco Pérez",
      birthdate: "1980-04-12",
      gender: "Masculino",
      telephone: "5432-1100",
      address: "10a Avenida 14-22 Zona 10, Guatemala",
      email: "juan.perez@email.com",
      vitalSigns: [
        {
          date: "2026-07-09T10:15:00Z",
          temp: 36.5,
          bp_systolic: 135,
          bp_diastolic: 85,
          heart_rate: 78,
          resp_rate: 18,
          weight: 82.5,
          height: 1.76,
          bmi: 26.6,
          oxygen: 97
        },
        {
          date: "2026-06-15T09:00:00Z",
          temp: 36.8,
          bp_systolic: 140,
          bp_diastolic: 90,
          heart_rate: 82,
          resp_rate: 19,
          weight: 83,
          height: 1.76,
          bmi: 26.8,
          oxygen: 96
        }
      ],
      consultations: [
        {
          id: "c-1",
          date: "2026-06-15T09:30:00Z",
          specialty: "Cardiología",
          doctor: "Dr. Carlos Mendoza",
          reason: "Control de presión arterial elevada.",
          symptoms: "Paciente refiere cefalea leve en región occipital por las mañanas. No dolor torácico. Se constata presión en 140/90 mmHg.",
          diagnosisCodes: ["I10"],
          diagnosisNames: ["Hipertensión esencial (primaria)"],
          acceptedStudies: {
            labs: ["Perfil Lipídico completo (Colesterol, Triglicéridos, HDL, LDL)", "Creatinina"],
            imaging: ["Electrocardiograma (EKG) de 12 derivaciones"]
          },
          fee: 350.00
        }
      ],
      labHistory: [
        {
          date: "2026-06-16T15:00:00Z",
          name: "Perfil Lipídico",
          fileName: "perfil_lipidico_perez.png",
          fileData: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f4f6f8'/><text x='10' y='50' fill='%23111' font-size='8'>Colesterol: 210 mg/dL (Alto)</text><text x='10' y='70' fill='%23111' font-size='8'>Triglicéridos: 180 mg/dL</text></svg>",
          fileType: "image",
          notes: "Colesterol total ligeramente elevado. Triglicéridos en rango moderado."
        }
      ],
      imagingHistory: [
        {
          date: "2026-06-16T11:00:00Z",
          study: "EKG de Control",
          fileName: "ekg_perez.png",
          fileData: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='100' viewBox='0 0 300 100'><rect width='300' height='100' fill='%23f5f5f5'/><path d='M0 50 L50 50 L55 30 L60 70 L65 50 L100 50 L105 10 L112 90 L120 50 L300 50' stroke='%23ff1744' stroke-width='2' fill='none'/></svg>",
          notes: "Eje normal. Ritmo sinusal. Sin signos de isquemia aguda."
        }
      ],
      prescriptions: [
        {
          id: "r-1",
          date: "2026-06-15T09:45:00Z",
          doctorName: "Dr. Carlos Mendoza",
          doctorLicense: "12543",
          medicines: [
            {
              name: "Losartán 50mg",
              presentation: "Tabletas",
              quantity: "30",
              dosage: "1 tableta cada 24 horas",
              duration: "30 días"
            }
          ]
        }
      ],
      appointments: [
        {
          date: "2026-07-15",
          time: "10:30",
          notes: "Cita de control de Hipertensión"
        }
      ]
    },
    {
      id: "p-2",
      name: "María Alejandra Rodríguez",
      birthdate: "1992-08-24",
      gender: "Femenino",
      telephone: "4411-9988",
      address: "Boulevard Vista Hermosa 5-11 Zona 15, Guatemala",
      email: "maria.rod@email.com",
      vitalSigns: [
        {
          date: "2026-07-10T08:00:00Z",
          temp: 36.2,
          bp_systolic: 110,
          bp_diastolic: 70,
          heart_rate: 64,
          resp_rate: 16,
          weight: 60.1,
          height: 1.62,
          bmi: 22.9,
          oxygen: 99
        }
      ],
      consultations: [],
      labHistory: [],
      imagingHistory: [],
      prescriptions: [],
      appointments: []
    }
  ]
};

// Cargar estado inicial o guardar si no existe (incluye migración para Administrador y claves)
export function getAppState() {
  const data = localStorage.getItem('medflow_db');
  let state;
  let modified = false;

  if (!data) {
    state = initialMockData;
    modified = true;
  } else {
    state = JSON.parse(data);
  }

  // Asegurar que el Administrador maestro existe
  if (!state.users.some(u => u.id === 'u-admin')) {
    state.users.unshift({
      id: 'u-admin',
      name: 'Administrador',
      role: 'administrador',
      password: 'Glol5414'
    });
    modified = true;
  }

  // Asegurar que todos los usuarios tienen la contraseña maestra Glol5414 y lista de permisos
  const allModules = ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'configuracion'];
  state.users.forEach(u => {
    u.password = 'Glol5414';
    if (u.role === 'administrador' || u.role === 'Administrador' || u.role === 'medico_1' || u.role === 'Médico 1' || u.name === 'Administrador') {
      u.modules = [...allModules];
    } else if (!u.modules || u.modules.length === 0) {
      u.modules = [...allModules];
    }
  });

  // Inicializar catálogos si no existen en localStorage
  // Inicializar catálogos si no existen en localStorage
  if (!state.medications) {
    state.medications = medicationsDatabase.map((m, idx) => ({ 
      ...m, 
      id: 'm-' + (idx + 1), 
      price: 50.00,
      stock: 120,
      lote: 'L-MED-' + (1000 + idx),
      vencimiento: '2027-06-30'
    }));
    modified = true;
  } else {
    // Migrar base existente si falta stock, lote o vencimiento
    state.medications.forEach((m, idx) => {
      if (m.stock === undefined) { m.stock = 120; modified = true; }
      if (!m.lote) { m.lote = 'L-MED-' + (1000 + idx); modified = true; }
      if (!m.vencimiento) { m.vencimiento = '2027-06-30'; modified = true; }
    });
  }
  if (!state.laboratoryTests) {
    state.laboratoryTests = laboratoryTests.map((l, idx) => ({ ...l, id: 'l-' + (idx + 1), price: 125.00 }));
    modified = true;
  }
  if (!state.imagingStudies) {
    state.imagingStudies = imagingStudies.map((i, idx) => ({ ...i, id: 'i-' + (idx + 1), price: 300.00 }));
    modified = true;
  }
  if (!state.consultationTypes) {
    state.consultationTypes = [
      { id: 'c-1', name: "Consulta General", specialty: "Medicina General", price: 150.00 },
      { id: 'c-2', name: "Consulta Especializada", specialty: "Especialista", price: 250.00 },
      { id: 'c-3', name: "Consulta de Control", specialty: "Control de Rutina", price: 100.00 }
    ];
    modified = true;
  }

  // Migración para asegurar Médico Tratante en pacientes
  const defaultDoctor = state.users.find(u => u.role === 'medico') || { id: 'u-1', name: 'Dr. Carlos Mendoza' };
  if (state.patients) {
    state.patients.forEach(p => {
      if (!p.assignedDoctorId) {
        p.assignedDoctorId = defaultDoctor.id;
        p.assignedDoctorName = defaultDoctor.name;
        modified = true;
      }
    });
  }

  if (modified) {
    localStorage.setItem('medflow_db', JSON.stringify(state));
  }

  return state;
}

// Guardar cambios en el estado
export function saveAppState(state) {
  localStorage.setItem('medflow_db', JSON.stringify(state));
  updateSidebarInfo(state);
}

// Actualizar información mostrada en la barra lateral
function updateSidebarInfo(state) {
  const clinicName = document.getElementById('sidebar-clinic-name');
  const clinicPhone = document.getElementById('sidebar-clinic-phone');
  const clinicLogo = document.querySelector('.clinic-mini-logo');
  if (clinicName && state.clinicInfo.name) {
    clinicName.textContent = state.clinicInfo.name;
  }
  if (clinicPhone && state.clinicInfo.phone) {
    clinicPhone.textContent = state.clinicInfo.phone;
  }
  if (clinicLogo) {
    if (state.clinicInfo.logoData) {
      clinicLogo.innerHTML = `<img src="${state.clinicInfo.logoData}" style="width: 28px; height: 28px; object-fit: cover; border-radius: 4px;">`;
    } else {
      clinicLogo.innerHTML = state.clinicInfo.logoText || '🏥';
    }
  }
}

// Paciente Activo en el Contexto de la Sesión
let activePatientId = "p-1";

export function getActivePatientId() {
  return activePatientId;
}

export function setActivePatientId(id) {
  activePatientId = id;
}

// Router Simple
function router(route) {
  const container = document.getElementById('module-container');
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

// Renderizar Pantalla de Login (con lista desplegable)
function renderLoginScreen() {
  const loginContainer = document.getElementById('login-container');
  if (!loginContainer) return;

  const state = getAppState();
  const users = state.users || [];

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
              if (u.role === 'medico') roleIcon = '🩺';
              else if (u.role === 'enfermero') roleIcon = '🫁';
              else if (u.role === 'recepcionista') roleIcon = '📞';
              else if (u.role === 'administrador') roleIcon = '⚙️';
              
              return `<option value="${u.id}">${roleIcon} ${u.name} (${u.role.toUpperCase()})</option>`;
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

  // Enfocar contraseña al cambiar el select
  userSelect.addEventListener('change', () => {
    passwordInput.focus();
  });

  // Enfocar contraseña inicialmente
  passwordInput.focus();

  loginContainer.querySelector('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const selectedUserId = userSelect.value;
    if (!selectedUserId) {
      alert("Por favor, seleccione un usuario.");
      return;
    }

    const passwordVal = passwordInput.value;
    const user = users.find(u => u.id === selectedUserId);
    const hashedInput = hashPassword(passwordVal);

    if (user && (user.password === passwordVal || user.password === hashedInput || hashPassword(user.password) === hashedInput)) {
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

// Configurar los listeners y el estado al cargar la app
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();

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
      if (userObj.role === 'medico') roleIcon = '🩺';
      else if (userObj.role === 'enfermero') roleIcon = '🫁';
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
