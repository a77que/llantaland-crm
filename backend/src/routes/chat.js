const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middleware/auth');
const {
  iniciarSesion, enviarMensaje, listarMensajes, relay, responderVendedor, responderVendedorAudio,
  listarConversaciones, vapid, suscribirPush, desuscribirPush,
} = require('../controllers/chatController');

// Subida de notas de voz del vendedor. La extensión sale SIEMPRE del mimetype
// (no del nombre del cliente) para no servir luego algo disfrazado desde /uploads.
const MIME_TO_EXT = {
  'audio/mp4': '.m4a', 'audio/aac': '.m4a', 'audio/mpeg': '.mp3',
  'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-m4a': '.m4a',
};
const audioStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => cb(null, `chat-${uuidv4()}${MIME_TO_EXT[file.mimetype] || '.webm'}`),
});
const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (file.mimetype || '').startsWith('audio/') ? cb(null, true) : cb(new Error('Solo audio')),
});

// Endpoints públicos del cliente (sin login): límite para evitar abuso.
// Límite por SESIÓN de chat (no por IP): el widget hace polling cada 4s, así que
// 40/min por IP se agotaba rápido (y detrás del proxy varias sesiones comparten
// IP). Keyeamos por sessionId con margen amplio; validate:false evita el warning
// de trust-proxy en este limiter (ya está trust proxy activo globalmente).
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body && req.body.sessionId) || req.params.sessionId || req.ip,
  validate: false,
});

router.post('/session', limiter, iniciarSesion);
router.post('/mensaje', limiter, enviarMensaje);
router.get('/mensajes/:sessionId', limiter, listarMensajes);

// El vendedor (logueado) responde en un chat web (texto o nota de voz).
router.post('/vendedor', auth, responderVendedor);
router.post('/vendedor/audio', auth, uploadAudio.single('audio'), responderVendedorAudio);

// Panel del vendedor: lista de conversaciones web + notificaciones push (PWA).
router.get('/conversaciones', auth, listarConversaciones);
router.get('/vapid', vapid);                        // público: el front pide la llave pública
router.post('/push/subscribe', auth, suscribirPush);
router.post('/push/unsubscribe', auth, desuscribirPush);

// n8n entrega aquí las respuestas del bot (y reenvía a YCloud los números reales).
router.post('/relay', relay);

module.exports = router;
