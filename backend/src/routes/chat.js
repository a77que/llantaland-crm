const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { auth } = require('../middleware/auth');
const {
  iniciarSesion, enviarMensaje, listarMensajes, relay, responderVendedor,
  listarConversaciones, vapid, suscribirPush, desuscribirPush,
} = require('../controllers/chatController');

// Endpoints públicos del cliente (sin login): límite para evitar abuso.
const limiter = rateLimit({ windowMs: 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });

router.post('/session', limiter, iniciarSesion);
router.post('/mensaje', limiter, enviarMensaje);
router.get('/mensajes/:sessionId', limiter, listarMensajes);

// El vendedor (logueado) responde en un chat web.
router.post('/vendedor', auth, responderVendedor);

// Panel del vendedor: lista de conversaciones web + notificaciones push (PWA).
router.get('/conversaciones', auth, listarConversaciones);
router.get('/vapid', vapid);                        // público: el front pide la llave pública
router.post('/push/subscribe', auth, suscribirPush);
router.post('/push/unsubscribe', auth, desuscribirPush);

// n8n entrega aquí las respuestas del bot (y reenvía a YCloud los números reales).
router.post('/relay', relay);

module.exports = router;
