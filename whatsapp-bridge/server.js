import express from 'express';
import cors from 'cors';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

const app = express();
const PORT = process.env.PORT || 3001;

// Habilitar CORS para permitir peticiones desde la aplicación web (ej. Vercel o localhost)
app.use(cors());
app.use(express.json());

// Inicializar el cliente de WhatsApp Web
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth'
  }),
  puppeteer: {
    handleSIGINT: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

let isReady = false;

// Evento de generación del código QR en terminal
client.on('qr', (qr) => {
  console.log('\n======================================================');
  console.log('📌 ESCANEA ESTE CÓDIGO QR EN TU CELULAR PARA INICIAR SESIÓN:');
  console.log('======================================================\n');
  qrcode.generate(qr, { small: true });
});

// Evento de cliente listo
client.on('ready', () => {
  console.log('\n✅ ¡Cliente de WhatsApp Web listo y autenticado exitosamente!\n');
  isReady = true;
});

// Evento de fallo de autenticación
client.on('auth_failure', (msg) => {
  console.error('❌ Fallo de autenticación en WhatsApp:', msg);
  isReady = false;
});

// Evento de desconexión
client.on('disconnected', (reason) => {
  console.warn('⚠️ Sesión de WhatsApp desconectada:', reason);
  isReady = false;
  // Re-inicialización automática
  client.initialize().catch(err => console.error("Error al re-inicializar:", err));
});

client.initialize().catch(err => {
  console.error("Error inicial en client.initialize():", err);
});

// Endpoint POST /api/notify-doctor
app.post('/api/notify-doctor', async (req, res) => {
  const { nombreMedico, telefonoMedico, nombrePaciente } = req.body;

  if (!nombreMedico || !telefonoMedico || !nombrePaciente) {
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

    // 3. Template del mensaje solicitado al pie de la letra
    const message = `Estimado ${nombreMedico}, el paciente ${nombrePaciente} espera por tu atencion en tu consultorio`;

    // 4. Enviar el mensaje en segundo plano de forma invisible
    await client.sendMessage(chatId, message);

    console.log(`✉️ Notificación enviada a: ${nombreMedico} (Tel: ${cleanPhone}) | Paciente: ${nombrePaciente}`);
    
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

// Levantar el Servidor Express
app.listen(PORT, () => {
  console.log(`🚀 Microservicio WhatsApp local escuchando en http://localhost:${PORT}`);
});
