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

import migratedInitialData from './data/medflow_db.json';

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

  // 1. Escuchador de Usuarios
  onSnapshot(collection(db, 'users'), (snapshot) => {
    firestoreState.users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notifySubscribers();
    checkFirstLoad();
  }, (error) => {
    console.warn("Firestore fallback (users):", error);
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

// Sembrado asíncrono inicial si la base de Firestore está vacía en producción
export async function seedInitialFirestoreData() {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log("Inicializando colecciones oficiales en Firebase Firestore...");
      const batch = writeBatch(db);

      // Cargar Usuarios
      (migratedInitialData.users || []).forEach(user => {
        const ref = doc(db, 'users', user.id);
        batch.set(ref, user);
      });

      // Cargar Pacientes
      (migratedInitialData.patients || []).forEach(patient => {
        const ref = doc(db, 'patients', patient.id);
        batch.set(ref, patient);
      });

      // Cargar Medicamentos
      (migratedInitialData.medications || []).forEach(med => {
        const ref = doc(db, 'medications', med.id);
        batch.set(ref, med);
      });

      // Cargar Laboratorio
      (migratedInitialData.laboratoryTests || []).forEach(lab => {
        const ref = doc(db, 'laboratoryTests', lab.id);
        batch.set(ref, lab);
      });

      // Cargar Imagenología
      (migratedInitialData.imagingStudies || []).forEach(img => {
        const ref = doc(db, 'imagingStudies', img.id);
        batch.set(ref, img);
      });

      // Cargar Tipos de Consulta
      (migratedInitialData.consultationTypes || []).forEach(cons => {
        const ref = doc(db, 'consultationTypes', cons.id);
        batch.set(ref, cons);
      });

      // Cargar Info de la Clínica
      if (migratedInitialData.clinicInfo) {
        const ref = doc(db, 'clinicInfo', 'main');
        batch.set(ref, migratedInitialData.clinicInfo);
      }

      await batch.commit();
      console.log("🎉 ¡Éxito! Colecciones de Firestore sincronizadas en la nube.");
    }
  } catch (err) {
    console.warn("Sembrado inicial de Firestore (modo offline o restringido):", err);
  }
}

// Borrado y vaciado completo de todas las bases de datos de producción
export async function purgeAllFirestoreData() {
  try {
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

    // Limpiar estado local en memoria
    firestoreState.patients = [];
    firestoreState.medications = [];
    firestoreState.pharmacySales = [];
    firestoreState.laboratoryTests = [];
    firestoreState.imagingStudies = [];
    firestoreState.consultationTypes = [];

    // Limpiar almacenamiento del navegador
    localStorage.removeItem('medflow_db');

    return true;
  } catch (err) {
    console.error("Error al purgar la base de datos:", err);
    localStorage.removeItem('medflow_db');
    return false;
  }
}
