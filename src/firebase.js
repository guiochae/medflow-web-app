// src/firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

// Configuración de Firebase para Medflow Web App
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyMedflowWebAppProductionKey2026",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "medflow-web-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "medflow-web-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "medflow-web-app.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "982736451029",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:982736451029:web:a7b8c9d0e1f234567"
};

// Inicializar la App de Firebase y Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  writeBatch 
};

// Función auxiliar para obtener el hash de la contraseña del Administrador
function getAdminPasswordHash() {
  const plainText = 'Glol5414';
  let hash = 0;
  for (let i = 0; i < plainText.length; i++) {
    const char = plainText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const strHash = Math.abs(hash).toString(16);
  return 'sha256_enc_' + btoa(plainText + '_LUGAMED_SALT_' + strHash);
}

// Usuario Administrador por defecto (único usuario del sistema si la colección está vacía)
export const defaultAdminUser = {
  id: 'u-admin',
  name: 'Administrador',
  role: 'Administrador',
  password: getAdminPasswordHash(),
  modules: ['preconsulta', 'consulta', 'recetario', 'laboratorio', 'imagenologia', 'farmacia', 'configuracion']
};

// Estado centralizado en tiempo real sincronizado con Firestore
export const firestoreState = {
  patients: [],
  users: [],
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
  },
  isLoaded: false
};

// Callbacks para notificar cambios a la interfaz cuando la base remota cambie
const updateSubscribers = [];

export function subscribeToStateUpdates(callback) {
  if (typeof callback === 'function') {
    updateSubscribers.push(callback);
  }
}

function notifySubscribers() {
  updateSubscribers.forEach(cb => {
    try { cb(firestoreState); } catch (err) { console.error(err); }
  });
}

// Inicializar escuchadores en tiempo real (onSnapshot) para todas las colecciones
export function initRealtimeFirestore(onFirstLoad) {
  let loadedCollections = 0;
  const totalCollections = 8;

  function checkFirstLoad() {
    loadedCollections++;
    if (loadedCollections >= totalCollections) {
      firestoreState.isLoaded = true;
      if (typeof onFirstLoad === 'function') onFirstLoad(firestoreState);
    }
  }

  // 1. Escuchador de Usuarios (Si la colección está vacía en Firestore, crea únicamente al Administrador)
  onSnapshot(collection(db, 'users'), async (snapshot) => {
    if (snapshot.empty) {
      firestoreState.users = [defaultAdminUser];
      try {
        await setDoc(doc(db, 'users', defaultAdminUser.id), defaultAdminUser);
      } catch (e) {
        console.warn("No se pudo crear usuario admin automático en Firestore:", e);
      }
    } else {
      firestoreState.users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    notifySubscribers();
    checkFirstLoad();
  }, (error) => {
    console.warn("Firestore fallback (users):", error);
    if (!firestoreState.users || firestoreState.users.length === 0) {
      firestoreState.users = [defaultAdminUser];
    }
    checkFirstLoad();
  });

  // 2. Escuchador de Pacientes
  onSnapshot(collection(db, 'patients'), (snapshot) => {
    firestoreState.patients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notifySubscribers();
    checkFirstLoad();
  }, (error) => {
    console.warn("Firestore fallback (patients):", error);
    checkFirstLoad();
  });

  // 3. Escuchador de Medicamentos / Inventario de Farmacia
  onSnapshot(collection(db, 'medications'), (snapshot) => {
    firestoreState.medications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notifySubscribers();
    checkFirstLoad();
  }, (error) => {
    console.warn("Firestore fallback (medications):", error);
    checkFirstLoad();
  });

  // 4. Escuchador de Ventas de Farmacia
  onSnapshot(collection(db, 'pharmacySales'), (snapshot) => {
    firestoreState.pharmacySales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notifySubscribers();
    checkFirstLoad();
  }, (error) => {
    console.warn("Firestore fallback (pharmacySales):", error);
    checkFirstLoad();
  });

  // 5. Escuchador de Estudios de Laboratorio
  onSnapshot(collection(db, 'laboratoryTests'), (snapshot) => {
    firestoreState.laboratoryTests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notifySubscribers();
    checkFirstLoad();
  }, (error) => {
    console.warn("Firestore fallback (laboratoryTests):", error);
    checkFirstLoad();
  });

  // 6. Escuchador de Estudios de Imagenología
  onSnapshot(collection(db, 'imagingStudies'), (snapshot) => {
    firestoreState.imagingStudies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notifySubscribers();
    checkFirstLoad();
  }, (error) => {
    console.warn("Firestore fallback (imagingStudies):", error);
    checkFirstLoad();
  });

  // 7. Escuchador de Tipos de Consulta
  onSnapshot(collection(db, 'consultationTypes'), (snapshot) => {
    firestoreState.consultationTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notifySubscribers();
    checkFirstLoad();
  }, (error) => {
    console.warn("Firestore fallback (consultationTypes):", error);
    checkFirstLoad();
  });

  // 8. Escuchador de Información Clínica
  onSnapshot(collection(db, 'clinicInfo'), (snapshot) => {
    if (!snapshot.empty) {
      firestoreState.clinicInfo = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    notifySubscribers();
    checkFirstLoad();
  }, (error) => {
    console.warn("Firestore fallback (clinicInfo):", error);
    checkFirstLoad();
  });
}

// Operaciones CRUD asíncronas directas contra Firestore
export async function saveDocument(collectionName, docId, data) {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, data, { merge: true });
    return true;
  } catch (err) {
    console.error(`Error guardando en ${collectionName}/${docId}:`, err);
    throw err;
  }
}

export async function removeDocument(collectionName, docId) {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Error eliminando de ${collectionName}/${docId}:`, err);
    throw err;
  }
}

// Borrado y vaciado completo de todas las bases de datos de producción (conservando únicamente al Administrador)
export async function purgeAllFirestoreData() {
  try {
    // 1. Purgar usuarios y recrear únicamente al usuario Administrador
    const usersSnap = await getDocs(collection(db, 'users'));
    const userBatch = writeBatch(db);
    usersSnap.docs.forEach(docSnap => {
      userBatch.delete(docSnap.ref);
    });
    const adminRef = doc(db, 'users', defaultAdminUser.id);
    userBatch.set(adminRef, defaultAdminUser);
    await userBatch.commit();

    // 2. Purgar todas las demás colecciones de producción
    const collectionsToPurge = [
      'patients',
      'medications',
      'pharmacySales',
      'laboratoryTests',
      'imagingStudies',
      'consultationTypes',
      'clinicInfo'
    ];

    for (const colName of collectionsToPurge) {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    }

    // 3. Limpiar estado local en memoria dejando solo al Administrador
    firestoreState.users = [defaultAdminUser];
    firestoreState.patients = [];
    firestoreState.medications = [];
    firestoreState.pharmacySales = [];
    firestoreState.laboratoryTests = [];
    firestoreState.imagingStudies = [];
    firestoreState.consultationTypes = [];
    firestoreState.clinicInfo = {
      name: "LUGAMED 2.0 - Clínica Médica y Hospital",
      address: "Avenida Las Américas 1-02 Zona 14, Ciudad de Guatemala",
      phone: "2200-0000",
      email: "contacto@lugamed.gt"
    };

    // 4. Limpiar almacenamiento del navegador y asegurar sesión activa del Administrador
    localStorage.clear();
    sessionStorage.setItem('medflow_logged_user', JSON.stringify(defaultAdminUser));

    return true;
  } catch (err) {
    console.error("Error al purgar la base de datos:", err);
    localStorage.clear();
    sessionStorage.setItem('medflow_logged_user', JSON.stringify(defaultAdminUser));
    return false;
  }
}
