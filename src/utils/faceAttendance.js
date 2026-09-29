// src/utils/faceAttendance.js
import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let modelLoadingPromise = null;
let isWarmedUp = false;

// Rutas base para modelos (Local en /models con fallback a CDN jsdelivr)
const CDN_MODEL_PATH = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

/**
 * Carga los modelos de detección y reconocimiento facial ultra-rápidos
 * @returns {Promise<boolean>}
 */
export async function loadFaceModels() {
  if (modelsLoaded) return true;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    const localOrigin = typeof window !== 'undefined' && window.location.origin ? `${window.location.origin}/models` : '/models';
    const origins = [localOrigin, '/models', CDN_MODEL_PATH];

    let lastError = null;
    for (const modelPath of origins) {
      try {
        console.log(`🤖 Cargando modelos de reconocimiento facial desde: ${modelPath}`);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelPath).catch(() => null),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath).catch(() => null),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
        ]);

        if (!faceapi.nets.faceLandmark68Net.isLoaded && !faceapi.nets.faceLandmark68TinyNet.isLoaded) {
          throw new Error('No se pudo cargar ningún modelo de puntos de referencia (landmarks).');
        }

        modelsLoaded = true;
        console.log(`✅ Modelos faciales cargados exitosamente desde ${modelPath}`);
        
        // Calentamiento en segundo plano no bloqueante
        warmUpFaceModels().catch(() => {});
        return true;
      } catch (err) {
        lastError = err;
        console.warn(`Aviso: error cargando modelos desde ${modelPath}, probando siguiente ruta...`, err);
      }
    }

    console.error('❌ Error fatal al cargar modelos de reconocimiento facial:', lastError);
    throw lastError;
  })();

  return modelLoadingPromise;
}

/**
 * Pre-calienta los shaders de WebGL en la GPU para que la primera inferencia sea instantánea (0 ms lag)
 */
export async function warmUpFaceModels() {
  if (isWarmedUp || !modelsLoaded) return;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.fillStyle = '#888888';
      ctx.fillRect(0, 0, 128, 128);
      const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.2 });
      const useTiny = !faceapi.nets.faceLandmark68Net.isLoaded;
      await faceapi.detectSingleFace(canvas, opts).withFaceLandmarks(useTiny).withFaceDescriptor().catch(() => null);
    }
    isWarmedUp = true;
    console.log('⚡ GPU / WebGL Shaders pre-calentados exitosamente.');
  } catch (e) {
    // Si falla el calentamiento de WebGL, continúa normalmente
  }
}

/**
 * Comprueba si los modelos ya están cargados en memoria
 */
export function areFaceModelsLoaded() {
  return modelsLoaded;
}

/**
 * Detecta un único rostro en un elemento HTML (video, img, canvas)
 * de forma ultra-rápida y extrae su descriptor de 128 dimensiones.
 * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} inputElement
 * @param {object} [options]
 * @returns {Promise<{ detection: object, landmarks: object, descriptor: Float32Array } | null>}
 */
export async function detectSingleFaceAndDescriptor(inputElement, options = {}) {
  await loadFaceModels();

  if (!inputElement) return null;

  // Si es un video, verificar que esté reproduciendo y tenga dimensiones válidas
  if (inputElement instanceof HTMLVideoElement) {
    if (inputElement.readyState < 2 || inputElement.videoWidth === 0 || inputElement.videoHeight === 0) {
      return null;
    }
  }

  // 320px es el tamaño óptimo de detección para balance perfecto de velocidad y alcance
  const inputSize = options.inputSize || 320;
  // 0.25 permite detección inmediata en condiciones reales de iluminación de recepción
  const scoreThreshold = options.scoreThreshold !== undefined ? options.scoreThreshold : 0.25;

  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize,
    scoreThreshold
  });

  const useTinyLandmarks = !faceapi.nets.faceLandmark68Net.isLoaded && faceapi.nets.faceLandmark68TinyNet.isLoaded;

  let detectionResult = null;
  try {
    detectionResult = await faceapi
      .detectSingleFace(inputElement, detectorOptions)
      .withFaceLandmarks(useTinyLandmarks)
      .withFaceDescriptor();
  } catch (e) {
    try {
      detectionResult = await faceapi
        .detectSingleFace(inputElement, detectorOptions)
        .withFaceLandmarks(!useTinyLandmarks)
        .withFaceDescriptor();
    } catch (e2) {
      detectionResult = null;
    }
  }

  return detectionResult || null;
}

/**
 * Calcula la distancia euclidiana entre dos vectores de características (128-d)
 * @param {number[]|Float32Array} vecA
 * @param {number[]|Float32Array} vecB
 * @returns {number}
 */
export function calculateEuclideanDistance(vecA, vecB) {
  if (!vecA || !vecB) return 1.0;
  const len = Math.min(vecA.length, vecB.length);
  if (len !== 128) return 1.0;

  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Busca el colaborador con mayor coincidencia facial en la base de datos
 * @param {Float32Array|number[]|object} queryDescriptor - Vector descriptor del rostro detectado
 * @param {Array<object>} employees - Lista de empleados registrados
 * @param {number} [threshold=0.58] - Umbral de tolerancia de distancia euclidiana
 * @returns {{ matched: boolean, employee: object|null, distance: number, confidence: number }}
 */
export function matchFaceAgainstEmployees(queryDescriptor, employees, threshold = 0.58) {
  if (!queryDescriptor || !Array.isArray(employees) || employees.length === 0) {
    return { matched: false, employee: null, distance: 1.0, confidence: 0 };
  }

  // Normalizar query descriptor
  let qVec = queryDescriptor;
  if (qVec instanceof Float32Array) {
    qVec = Array.from(qVec);
  } else if (typeof qVec === 'object' && !Array.isArray(qVec)) {
    qVec = Object.values(qVec);
  }

  if (!qVec || qVec.length !== 128) {
    return { matched: false, employee: null, distance: 1.0, confidence: 0 };
  }

  let bestMatch = null;
  let minDistance = Infinity;

  for (const emp of employees) {
    if (!emp || (emp.status && emp.status !== 'Activo')) continue;
    
    let empDescriptor = emp.face_descriptor;
    if (!empDescriptor) continue;

    if (empDescriptor instanceof Float32Array) {
      empDescriptor = Array.from(empDescriptor);
    } else if (typeof empDescriptor === 'object' && !Array.isArray(empDescriptor)) {
      empDescriptor = Object.values(empDescriptor);
    }

    if (!empDescriptor || empDescriptor.length !== 128) {
      continue;
    }

    const dist = calculateEuclideanDistance(qVec, empDescriptor);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = emp;
    }
  }

  if (bestMatch && minDistance <= threshold) {
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

  const sWidth = sourceEl.videoWidth || sourceEl.naturalWidth || sourceEl.width || 240;
  const sHeight = sourceEl.videoHeight || sourceEl.naturalHeight || sourceEl.height || 240;

  if (cropBox && cropBox.width > 0 && cropBox.height > 0) {
    const marginX = cropBox.width * 0.25;
    const marginY = cropBox.height * 0.3;
    const sx = Math.max(0, cropBox.x - marginX);
    const sy = Math.max(0, cropBox.y - marginY);
    const sw = Math.min(sWidth - sx, cropBox.width + (marginX * 2));
    const sh = Math.min(sHeight - sy, cropBox.height + (marginY * 2));

    ctx.drawImage(sourceEl, sx, sy, sw, sh, 0, 0, 240, 240);
  } else {
    const minDim = Math.min(sWidth, sHeight);
    const sx = (sWidth - minDim) / 2;
    const sy = (sHeight - minDim) / 2;

    ctx.drawImage(sourceEl, sx, sy, minDim, minDim, 0, 0, 240, 240);
  }

  return canvas.toDataURL('image/jpeg', 0.85);
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
      playTone(523.25, 0, 0.12);
      playTone(659.25, 0.10, 0.12);
      playTone(783.99, 0.20, 0.25);
    } else if (type === 'warning') {
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
  } catch (e) {}
}

// Iniciar carga temprana de modelos
loadFaceModels().catch(() => {});

