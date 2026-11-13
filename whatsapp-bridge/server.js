import express from 'express';
import cors from 'cors';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authPath = path.join(__dirname, '.wwebjs_auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Habilitar CORS y Private Network Access para permitir peticiones desde Vercel (HTTPS) hacia localhost (HTTP)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let isReady = false;
let latestQr = null;
let clientStatus = 'starting'; // 'starting', 'qr_ready', 'ready', 'error'
let clientError = null;
let detectedBrowser = null;
let client = null;

// Endpoint GET /api/ping (Verificación rápida de conectividad)
app.get('/api/ping', (req, res) => {
  return res.status(200).json({ ok: true, isReady, status: clientStatus });
});

// Endpoint GET /api/status (Reporte completo del microservicio)
app.get('/api/status', (req, res) => {
  return res.status(200).json({
    success: true,
    online: true,
    isReady: isReady,
    qr: isReady ? null : latestQr,
    status: isReady ? 'ready' : (latestQr ? 'qr_ready' : (clientError ? 'error' : 'starting')),
    error: clientError,
    browser: detectedBrowser
  });
});

// Endpoint POST /api/logout (Desvincular WhatsApp para permitir escanear un nuevo QR)
app.post('/api/logout', async (req, res) => {
  try {
    if (client) {
      isReady = false;
      latestQr = null;
      clientStatus = 'starting';
      try {
        await client.logout();
      } catch (e) {
        console.warn('Aviso en logout:', e.message);
      }
      setTimeout(() => {
        client.initialize().catch(err => console.error("Error al re-inicializar:", err));
      }, 1500);
      return res.status(200).json({ success: true, message: 'Sesión desvinculada. Generando nuevo código QR...' });
    }
    return res.status(400).json({ success: false, error: 'Cliente de WhatsApp no disponible.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Levantar el Servidor Express INMEDIATAMENTE para responder al instante
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Microservicio WhatsApp local escuchando en http://0.0.0.0:${PORT}`);
});

// Prevenir caídas del proceso por errores no controlados
process.on('uncaughtException', (err) => {
  console.error('❌ Excepción no capturada en microservicio:', err);
  clientStatus = 'error';
  clientError = err.message || String(err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Rechazo de promesa no controlado:', reason);
  clientStatus = 'error';
  clientError = (reason && reason.message) || String(reason);
});

const puppeteerOptions = {
  handleSIGINT: false,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ]
};

// Auto-detección amplia de navegadores Chromium (Chrome, Edge o Brave) en Windows
if (process.platform === 'win32') {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`🧭 Navegador Chromium detectado en Windows: ${p}`);
      puppeteerOptions.executablePath = p;
      detectedBrowser = p;
      break;
    }
  }
}

// Permitir personalización mediante variable de entorno si se especifica
if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  detectedBrowser = process.env.PUPPETEER_EXECUTABLE_PATH;
}

if (!puppeteerOptions.executablePath) {
  console.warn("⚠️ No se encontró Chrome o Edge en las rutas estándar.");
  clientStatus = 'error';
  clientError = 'No se encontró Google Chrome ni Microsoft Edge instalado en esta máquina.';
}

// Inicializar el cliente de WhatsApp Web con manejo robusto de excepciones
try {
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: authPath
    }),
    puppeteer: puppeteerOptions
  });

  client.on('qr', (qr) => {
    latestQr = qr;
    clientStatus = 'qr_ready';
    console.log('\n======================================================');
    console.log('📌 ESCANEA ESTE CÓDIGO QR EN TU CELULAR PARA INICIAR SESIÓN:');
    console.log('======================================================\n');
    try { qrcode.generate(qr, { small: true }); } catch (e) {}
  });

  client.on('ready', () => {
    console.log('\n✅ ¡Cliente de WhatsApp Web listo y autenticado exitosamente!\n');
    isReady = true;
    latestQr = null;
    clientStatus = 'ready';
    clientError = null;
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Fallo de autenticación en WhatsApp:', msg);
    isReady = false;
    clientStatus = 'error';
    clientError = 'Fallo de autenticación: ' + msg;
  });

  client.on('disconnected', (reason) => {
    console.warn('⚠️ Sesión de WhatsApp desconectada:', reason);
    isReady = false;
    clientStatus = 'disconnected';
    setTimeout(() => {
      client.initialize().catch(err => console.error("Error al re-inicializar:", err));
    }, 3000);
  });

  client.initialize().catch(err => {
    console.error("Error inicial en client.initialize():", err);
    clientStatus = 'error';
    clientError = err.message || String(err);
  });
} catch (err) {
  console.error("Error al crear instancia de WhatsApp Client:", err);
  clientStatus = 'error';
  clientError = err.message || String(err);
}

// Endpoint POST /api/notify-doctor
app.post('/api/notify-doctor', async (req, res) => {
  const { nombreMedico, telefonoMedico, nombrePaciente, patientNameClean, prioridad, signosVitales, motivo, customMessage } = req.body;

  if (!nombreMedico || !telefonoMedico || (!nombrePaciente && !patientNameClean)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan parámetros requeridos (nombreMedico, telefonoMedico, nombrePaciente).' 
    });
  }

  if (!isReady) {
    return res.status(503).json({ 
      success: false, 
      error: 'El bot de WhatsApp aún no está listo. Por favor escanea el código QR en la terminal.' 
    });
  }

  try {
    // 1. Limpieza de formato del número telefónico (remover espacios, guiones y caracteres no numéricos)
    let cleanPhone = String(telefonoMedico).replace(/[^0-9]/g, '');

    // Validación de código de área internacional (longitud de 8 dígitos para Guatemala)
    if (cleanPhone.length === 8) {
      cleanPhone = '502' + cleanPhone;
    }

    // 2. Construcción del identificador de chat requerido por whatsapp-web.js
    const chatId = `${cleanPhone}@c.us`;
    const patientName = patientNameClean || nombrePaciente;

    // 3. Template del mensaje adaptado a la prioridad de atención / triaje
    let message = '';
    if (customMessage) {
      message = customMessage;
    } else if (prioridad) {
      let pIcon = '🟢';
      let pLabel = 'NORMAL / RUTINA';
      const pNorm = String(prioridad).toUpperCase();
      if (pNorm.includes('EMERGENCIA') || pNorm.includes('CRITICA') || pNorm.includes('ALTA') || pNorm.includes('ROJO')) {
        pIcon = '🚨';
        pLabel = 'EMERGENCIA (ATENCIÓN INMEDIATA)';
      } else if (pNorm.includes('URGENCIA') || pNorm.includes('MODERADA') || pNorm.includes('MEDIA') || pNorm.includes('AMARILLO')) {
        pIcon = '⚠️';
        pLabel = 'URGENCIA';
      }

      message = `${pIcon} *PRIORIDAD DE ATENCIÓN: ${pLabel}*\n\n` +
                `Estimado(a) *${nombreMedico}*,\n` +
                `El paciente *${patientName}* espera por tu atención en tu consultorio.`;

      if (motivo) {
        message += `\n\n📝 *Motivo de Consulta:* ${motivo}`;
      }

      if (signosVitales) {
        message += `\n\n📊 *Signos Vitales Tomados:*`;
        if (signosVitales.bp_systolic && signosVitales.bp_diastolic) message += `\n• Presión Arterial: *${signosVitales.bp_systolic}/${signosVitales.bp_diastolic} mmHg*`;
        if (signosVitales.temp) message += `\n• Temperatura: *${signosVitales.temp} °C*`;
        if (signosVitales.heart_rate) message += `\n• Frec. Cardíaca: *${signosVitales.heart_rate} lpm*`;
        if (signosVitales.resp_rate) message += `\n• Frec. Respiratoria: *${signosVitales.resp_rate} rpm*`;
        if (signosVitales.oxygen) message += `\n• Saturación O2: *${signosVitales.oxygen}%*`;
        if (signosVitales.glucose) message += `\n• Glucosa Capilar: *${signosVitales.glucose} mg/dL*`;
      }
    } else {
      message = `Estimado ${nombreMedico}, el paciente ${nombrePaciente} espera por tu atencion en tu consultorio`;
    }

    // 4. Enviar el mensaje en segundo plano de forma invisible
    await client.sendMessage(chatId, message);

    console.log(`✉️ Notificación enviada a: ${nombreMedico} (Tel: ${cleanPhone}) | Paciente: ${patientName} | Prioridad: ${prioridad || 'Normal'}`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Mensaje enviado de forma automatizada.' 
    });

  } catch (error) {
    console.error('❌ Error al enviar mensaje a través del bot:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor al procesar la notificación en WhatsApp.',
      details: error.message 
    });
  }
});

// Endpoint POST /api/notify-employee
app.post('/api/notify-employee', async (req, res) => {
  const { employeeName, phoneNumber, employeeCode } = req.body;

  if (!employeeName || !phoneNumber || !employeeCode) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan parámetros requeridos (employeeName, phoneNumber, employeeCode).' 
    });
  }

  if (!isReady) {
    return res.status(503).json({ 
      success: false, 
      error: 'El bot de WhatsApp aún no está listo. Por favor escanea el código QR en la terminal.' 
    });
  }

  try {
    let cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '');
    if (cleanPhone.length === 8) {
      cleanPhone = '502' + cleanPhone;
    }

    const chatId = `${cleanPhone}@c.us`;
    const message = `🏥 *Hospital Privado Multimédica Sayaxché*\n\nEstimado(a) *${employeeName}*,\nBienvenido a LUGAMED. Tu código único de colaborador asignado para el control de asistencia es:\n\n🔑 *${employeeCode}*\n\nPor favor, ingresa este código cada vez que escanees el código QR dinámico de la clínica al iniciar o finalizar tu jornada.`;

    await client.sendMessage(chatId, message);
    console.log(`✉️ Código de asistencia enviado a: ${employeeName} (${cleanPhone}) | Código: ${employeeCode}`);

    return res.status(200).json({ 
      success: true, 
      message: 'Código de colaborador enviado exitosamente.' 
    });
  } catch (error) {
    console.error('❌ Error al enviar código a través del bot:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno al enviar mensaje de empleado.',
      details: error.message 
    });
  }
});

// Endpoint POST /api/send-message (Envío genérico de WhatsApp)
app.post('/api/send-message', async (req, res) => {
  const { phoneNumber, message } = req.body;

  if (!phoneNumber || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan parámetros requeridos (phoneNumber, message).' 
    });
  }

  if (!isReady) {
    return res.status(503).json({ 
      success: false, 
      error: 'El bot de WhatsApp aún no está listo. Por favor escanea el código QR en la terminal.' 
    });
  }

  try {
    let cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '');
    if (cleanPhone.length === 8) {
      cleanPhone = '502' + cleanPhone;
    }

    const chatId = `${cleanPhone}@c.us`;
    await client.sendMessage(chatId, message);
    console.log(`✉️ Mensaje enviado a: ${cleanPhone}`);

    return res.status(200).json({ 
      success: true, 
      message: 'Mensaje enviado exitosamente.' 
    });
  } catch (error) {
    console.error('❌ Error al enviar mensaje:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno al enviar mensaje.',
      details: error.message 
    });
  }
});

// Endpoint POST /api/notify-patient-reminder (Recordatorio de cita 48 horas antes)
app.post('/api/notify-patient-reminder', async (req, res) => {
  const { patientName, phoneNumber, appointmentDate, appointmentTime, doctorName, customMessage } = req.body;

  if (!patientName || !phoneNumber) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan parámetros requeridos (patientName, phoneNumber).' 
    });
  }

  if (!isReady) {
    return res.status(503).json({ 
      success: false, 
      error: 'El bot de WhatsApp aún no está listo. Por favor escanea el código QR en la terminal.' 
    });
  }

  try {
    let cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '');
    if (cleanPhone.length === 8) {
      cleanPhone = '502' + cleanPhone;
    }

    const chatId = `${cleanPhone}@c.us`;
    const message = customMessage || `Hola ${patientName}, Te saludamos de HOSPITAL MULTIMECA SAYAXCHÉ, te recordamos que tienes una cita con el ${doctorName || 'Médico Tratante'} el ${appointmentDate} a las ${appointmentTime}. Te Esperamos, saludos cordiales.`;

    await client.sendMessage(chatId, message);
    console.log(`✉️ Recordatorio de cita 48h enviado a: ${patientName} (${cleanPhone})`);

    return res.status(200).json({ 
      success: true, 
      message: 'Recordatorio enviado exitosamente.' 
    });
  } catch (error) {
    console.error('❌ Error al enviar recordatorio a paciente:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno al enviar recordatorio.',
      details: error.message 
    });
  }
});

// Endpoint POST /api/notify-lab-result (Envío de resultados escaneados de laboratorio con PDF adjunto al médico)
app.post('/api/notify-lab-result', async (req, res) => {
  const { doctorName, doctorPhone, patientName, orderId, studies, fileName, mimeType, base64Data, customMessage } = req.body;

  if (!doctorName || !doctorPhone || !patientName) {
    return res.status(400).json({ 
      success: false, 
      error: 'Faltan parámetros requeridos (doctorName, doctorPhone, patientName).' 
    });
  }

  if (!isReady) {
    return res.status(503).json({ 
      success: false, 
      error: 'El bot de WhatsApp aún no está listo. Por favor escanea el código QR en la terminal o espera la vinculación.' 
    });
  }

  try {
    let cleanPhone = String(doctorPhone).replace(/[^0-9]/g, '');
    if (cleanPhone.length === 8) {
      cleanPhone = '502' + cleanPhone;
    }

    const chatId = `${cleanPhone}@c.us`;

    const messageCaption = customMessage || (
      `🔬 *HOSPITAL PRIVADO MULTIMÉDICA SAYAXCHÉ*\n` +
      `*RESULTADOS DE LABORATORIO CLÍNICO DISPONIBLES*\n\n` +
      `Estimado(a) *${doctorName}*,\n` +
      `Le informamos que ya están listos los resultados de laboratorio para el paciente:\n\n` +
      `👤 *Paciente:* ${patientName}\n` +
      `📋 *No. Orden:* #${orderId || 'S/N'}\n` +
      `🧪 *Estudio(s):* ${studies || 'Análisis Clínicos'}\n` +
      `📅 *Fecha:* ${new Date().toLocaleDateString('es-GT')}\n\n` +
      `📎 *Adjunto documento escaneado oficial con los resultados para su evaluación médica.*`
    );

    let sentWithMedia = false;

    // Si viene base64Data, intentar enviar como MessageMedia adjunto
    if (base64Data && MessageMedia) {
      try {
        const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '');
        const docMime = mimeType || (String(base64Data).includes('application/pdf') ? 'application/pdf' : 'image/jpeg');
        const docFileName = fileName || `Resultados_Lab_${orderId || 'paciente'}.pdf`;

        const media = new MessageMedia(docMime, cleanBase64, docFileName);
        await client.sendMessage(chatId, media, { caption: messageCaption });
        sentWithMedia = true;
        console.log(`📎 Resultados con documento adjunto enviados a ${doctorName} (${cleanPhone})`);
      } catch (mediaErr) {
        console.warn('Aviso: Falló envío de media, enviando texto como respaldo:', mediaErr.message);
      }
    }

    // Si no se envió con media o falló, enviar mensaje de texto
    if (!sentWithMedia) {
      await client.sendMessage(chatId, messageCaption);
      console.log(`✉️ Notificación de texto de laboratorio enviada a ${doctorName} (${cleanPhone})`);
    }

    return res.status(200).json({ 
      success: true, 
      sentWithMedia: sentWithMedia,
      message: 'Resultados de laboratorio notificados al médico exitosamente vía WhatsApp.' 
    });
  } catch (error) {
    console.error('❌ Error al notificar resultados por WhatsApp:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno al enviar resultados al médico por WhatsApp.',
      details: error.message 
    });
  }
});


