// src/utils/faceAttendance.js
import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let modelLoadingPromise = null;

// Rutas base para modelos (Local en /models con fallback a CDN jsdelivr)
const LOCAL_MODEL_PATH = '/models';
const CDN_MODEL_PATH = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

/**
 * Carga los modelos de detección y reconocimiento facial
 * @returns {Promise<boolean>}
 */
export async function loadFaceModels() {
  if (modelsLoaded) return true;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      console.log('🤖 Cargando modelos de Inteligencia Artificial Facial desde almacenamiento local...');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_MODEL_PATH),
        faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_MODEL_PATH),
        faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODEL_PATH)
      ]);
      modelsLoaded = true;
      console.log('✅ Modelos faciales locales cargados exitosamente.');
      return true;
    } catch (localErr) {
      console.warn('⚠️ No se pudieron cargar los modelos locales, intentando desde CDN...', localErr);
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(CDN_MODEL_PATH),
          faceapi.nets.faceLandmark68Net.loadFromUri(CDN_MODEL_PATH),
          faceapi.nets.faceRecognitionNet.loadFromUri(CDN_MODEL_PATH)
        ]);
        modelsLoaded = true;
        console.log('✅ Modelos faciales CDN cargados exitosamente.');
        return true;
      } catch (cdnErr) {
        console.error('❌ Error fatal al cargar modelos de reconocimiento facial:', cdnErr);
        throw new Error('No se pudieron descargar los modelos de reconocimiento facial. Verifica tu conexión a internet.');
      }
    }
  })();

  return modelLoadingPromise;
}

/**
 * Comprueba si los modelos ya están cargados en memoria
 */
export function areFaceModelsLoaded() {
  return modelsLoaded;
}

/**
 * Detecta un único rostro en un elemento HTML (video, img, canvas)
 * y extrae su descriptor de 128 dimensiones y sus landmarks.
 * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} inputElement
 * @param {object} [options]
 * @returns {Promise<{ detection: object, landmarks: object, descriptor: Float32Array } | null>}
 */
export async function detectSingleFaceAndDescriptor(inputElement, options = {}) {
  await loadFaceModels();

  const inputSize = options.inputSize || 320;
  const scoreThreshold = options.scoreThreshold || 0.5;

  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize,
    scoreThreshold
  });

  const detectionResult = await faceapi
    .detectSingleFace(inputElement, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detectionResult || null;
}

/**
 * Calcula la distancia euclidiana entre dos vectores de características (128-d)
 * @param {number[]|Float32Array} vecA
 * @param {number[]|Float32Array} vecB
 * @returns {number}
 */
export function calculateEuclideanDistance(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 1.0;
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Busca el colaborador con mayor coincidencia facial en la base de datos
 * @param {Float32Array|number[]} queryDescriptor - Vector descriptor del rostro detectado
 * @param {Array<object>} employees - Lista de empleados registrados
 * @param {number} [threshold=0.55] - Umbral de tolerancia de distancia euclidiana (menor = más estricto)
 * @returns {{ matched: boolean, employee: object|null, distance: number, confidence: number }}
 */
export function matchFaceAgainstEmployees(queryDescriptor, employees, threshold = 0.55) {
  if (!queryDescriptor || !Array.isArray(employees) || employees.length === 0) {
    return { matched: false, employee: null, distance: 1.0, confidence: 0 };
  }

  let bestMatch = null;
  let minDistance = Infinity;

  for (const emp of employees) {
    if (!emp || (emp.status && emp.status !== 'Activo')) continue;
    if (!emp.face_descriptor || !Array.isArray(emp.face_descriptor) || emp.face_descriptor.length !== 128) {
      continue;
    }

    const dist = calculateEuclideanDistance(queryDescriptor, emp.face_descriptor);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = emp;
    }
  }

  if (bestMatch && minDistance <= threshold) {
    // Calcular porcentaje de confianza aproximado
    const confidence = Math.max(0, Math.min(100, Math.round((1 - (minDistance / threshold)) * 100)));
    return {
      matched: true,
      employee: bestMatch,
      distance: minDistance,
      confidence
    };
  }

  return {
    matched: false,
    employee: bestMatch,
    distance: minDistance === Infinity ? 1.0 : minDistance,
    confidence: 0
  };
}

/**
 * Captura y comprime una fotografía en formato JPEG base64 (240x240 px)
 * para avatar del colaborador.
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} sourceEl
 * @param {object} [cropBox] - Coordenadas opcionales de recorte {x, y, width, height}
 * @returns {string} Data URL JPEG en base64
 */
export function captureCompressedFaceThumbnail(sourceEl, cropBox = null) {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');

  if (cropBox && cropBox.width > 0 && cropBox.height > 0) {
    // Añadir margen alrededor de la cara
    const marginX = cropBox.width * 0.2;
    const marginY = cropBox.height * 0.25;
    const sx = Math.max(0, cropBox.x - marginX);
    const sy = Math.max(0, cropBox.y - marginY);
    const sWidth = cropBox.width + (marginX * 2);
    const sHeight = cropBox.height + (marginY * 2);

    ctx.drawImage(sourceEl, sx, sy, sWidth, sHeight, 0, 0, 240, 240);
  } else {
    // Captura centrada cuadrada
    const sWidth = sourceEl.videoWidth || sourceEl.naturalWidth || sourceEl.width || 240;
    const sHeight = sourceEl.videoHeight || sourceEl.naturalHeight || sourceEl.height || 240;
    const minDim = Math.min(sWidth, sHeight);
    const sx = (sWidth - minDim) / 2;
    const sy = (sHeight - minDim) / 2;

    ctx.drawImage(sourceEl, sx, sy, minDim, minDim, 0, 0, 240, 240);
  }

  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * Sintetiza tonos de audio para retroalimentación inmediata sin requerir archivos de sonido externos
 * @param {'success'|'warning'|'error'|'detect'} type
 */
export function playAttendanceFeedbackSound(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'success') {
      // Tono de éxito de doble frecuencia armónica (Do-Mi-Sol)
      const playTone = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playTone(523.25, 0, 0.12); // C5
      playTone(659.25, 0.10, 0.12); // E5
      playTone(783.99, 0.20, 0.25); // G5
    } else if (type === 'warning') {
      // Tono de advertencia suave (cooldown o casi reconocido)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'error') {
      // Tono de rechazo / desconocido
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Si el navegador bloquea audio antes de la interacción de usuario, ignorar
  }
}
