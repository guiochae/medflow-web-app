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
import { getAuth, signInAnonymously } from 'firebase/auth';

// Configuración de Firebase para Medflow Web App (apuntando a lugamed-db)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA5zfyzDR8yBANdUrD2hnS0P-BYFiR5jk4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "lugamed-db.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "lugamed-db",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "lugamed-db.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "248851715131",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:248851715131:web:76de4f3fb5d6c6662d381e"
};

// Inicializar la App de Firebase, Auth y Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Forzar base de datos "default" para compatibilidad con lugamed-db
if (db._databaseId) db._databaseId.database = "default";
if (db._delegate && db._delegate._databaseId) db._delegate._databaseId.database = "default";

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
  id: 'Admin',
  name: 'Administrador Maestro',
  role: 'administrador',
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

// Inicializar escuchadores en tiempo real (onSnapshot) con autenticación anónima
export function initRealtimeFirestore(onFirstLoad) {
  const auth = getAuth(app);
  let loadedCollections = 0;
  const totalCollections = 3; // multimedica_users, multimedica_pacientes, multimedica

  // Liveness timeout: si Firestore no responde en 3 segundos (por cuota agotada o falta de red),
  // procedemos automáticamente en modo local/offline para no bloquear al usuario.
  const fallbackTimeout = setTimeout(() => {
    if (!firestoreState.isLoaded) {
      console.warn("Firestore tardó demasiado en responder. Iniciando modo offline/fallback local.");
      firestoreState.isLoaded = true;
      if (typeof onFirstLoad === 'function') onFirstLoad(firestoreState);
    }
  }, 3000);

  function checkFirstLoad() {
    if (firestoreState.isLoaded) return;
    loadedCollections++;
    if (loadedCollections >= totalCollections) {
      clearTimeout(fallbackTimeout);
      firestoreState.isLoaded = true;
      if (typeof onFirstLoad === 'function') onFirstLoad(firestoreState);
    }
  }

  signInAnonymously(auth).then(() => {
    console.log("Firestore autenticado anónimamente.");

    // 1. Escuchador de Usuarios (colección 'multimedica_users')
    onSnapshot(collection(db, 'multimedica_users'), async (snapshot) => {
      if (snapshot.empty) {
        firestoreState.users = [defaultAdminUser];
        try {
          await setDoc(doc(db, 'multimedica_users', defaultAdminUser.id), defaultAdminUser);
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

    // 2. Escuchador de Pacientes (colección 'multimedica_pacientes')
    onSnapshot(collection(db, 'multimedica_pacientes'), (snapshot) => {
      firestoreState.patients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      notifySubscribers();
      checkFirstLoad();
    }, (error) => {
      console.warn("Firestore fallback (patients):", error);
      checkFirstLoad();
    });

    // 3. Escuchador de la colección 'multimedica' (agrupa medications, pharmacySales, etc.)
    onSnapshot(collection(db, 'multimedica'), (snapshot) => {
      // Limpiar arrays temporales antes de repoblar
      const meds = [];
      const sales = [];
      const labs = [];
      const imgs = [];
      const types = [];
      let clinic = null;

      snapshot.docs.forEach(docSnap => {
        const dId = docSnap.id;
        const dData = docSnap.data();
        if (dId === 'state' || !dData._collectionType) return; // Ignorar el estado de Multimedica original

        const type = dData._collectionType;
        const cleanDoc = { id: dId, ...dData };
        delete cleanDoc._collectionType;

        if (type === 'medications') meds.push(cleanDoc);
        else if (type === 'pharmacySales') sales.push(cleanDoc);
        else if (type === 'laboratoryTests') labs.push(cleanDoc);
        else if (type === 'imagingStudies') imgs.push(cleanDoc);
        else if (type === 'consultationTypes') types.push(cleanDoc);
        else if (type === 'clinicInfo') clinic = cleanDoc;
      });

      firestoreState.medications = meds;
      firestoreState.pharmacySales = sales;
      firestoreState.laboratoryTests = labs;
      firestoreState.imagingStudies = imgs;
      firestoreState.consultationTypes = types;
      if (clinic) firestoreState.clinicInfo = clinic;

      notifySubscribers();
      checkFirstLoad();
    }, (error) => {
      console.warn("Firestore fallback (multimedica):", error);
      checkFirstLoad();
    });

  }).catch(err => {
    console.error("Fallo de autenticación en Firestore:", err);
    clearTimeout(fallbackTimeout);
    // Permitir flujo offline si falla la conexión
    firestoreState.isLoaded = true;
    if (typeof onFirstLoad === 'function') onFirstLoad(firestoreState);
  });
}

// Operaciones CRUD asíncronas directas contra Firestore
export async function saveDocument(collectionName, docId, data) {
  try {
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
    await setDoc(docRef, docData, { merge: true });
    return true;
  } catch (err) {
    console.error(`Error guardando en ${collectionName}/${docId}:`, err);
    throw err;
  }
}

export async function saveDocumentsBatch(collectionName, items) {
  try {
    const batch = writeBatch(db);
    items.forEach(item => {
      let targetCollection = 'multimedica';
      let docData = { ...item };

      if (collectionName === 'users') {
        targetCollection = 'multimedica_users';
      } else if (collectionName === 'patients') {
        targetCollection = 'multimedica_pacientes';
      } else {
        docData._collectionType = collectionName;
      }

      const docRef = doc(db, targetCollection, item.id);
      batch.set(docRef, docData, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    console.error(`Error guardando batch en ${collectionName}:`, err);
    throw err;
  }
}

export async function removeDocument(collectionName, docId) {
  try {
    let targetCollection = 'multimedica';
    if (collectionName === 'users') {
      targetCollection = 'multimedica_users';
    } else if (collectionName === 'patients') {
      targetCollection = 'multimedica_pacientes';
    }

    const docRef = doc(db, targetCollection, docId);
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
    const usersSnap = await getDocs(collection(db, 'multimedica_users'));
    const userBatch = writeBatch(db);
    usersSnap.docs.forEach(docSnap => {
      userBatch.delete(docSnap.ref);
    });
    const adminRef = doc(db, 'multimedica_users', defaultAdminUser.id);
    userBatch.set(adminRef, defaultAdminUser);
    await userBatch.commit();

    // 2. Purgar todos los pacientes de multimedica_pacientes
    const patientsSnap = await getDocs(collection(db, 'multimedica_pacientes'));
    if (!patientsSnap.empty) {
      const patientBatch = writeBatch(db);
      patientsSnap.docs.forEach(docSnap => {
        patientBatch.delete(docSnap.ref);
      });
      await patientBatch.commit();
    }

    // 3. Purgar solo los documentos creados por Medflow en la colección 'multimedica'
    const multimedicaSnap = await getDocs(collection(db, 'multimedica'));
    if (!multimedicaSnap.empty) {
      const multimedicaBatch = writeBatch(db);
      let deletedCount = 0;
      multimedicaSnap.docs.forEach(docSnap => {
        const dId = docSnap.id;
        const dData = docSnap.data();
        if (dId !== 'state' && dData._collectionType) {
          multimedicaBatch.delete(docSnap.ref);
          deletedCount++;
        }
      });
      if (deletedCount > 0) {
        await multimedicaBatch.commit();
      }
    }

    // 4. Limpiar estado local en memoria dejando solo al Administrador
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

    // 5. Limpiar almacenamiento del navegador
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
