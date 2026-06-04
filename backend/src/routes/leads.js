const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { auth } = require('../middleware/auth');
const { listar, obtener, obtenerPorTelefono, actualizar, resumen } = require('../controllers/leadsController');

// Limita búsquedas por teléfono para prevenir enumeración
const telLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minuto
  max: 30,               // 30 lookups por minuto por IP
  message: { error: 'Demasiadas búsquedas. Espera un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(auth);
router.get('/',                listar);
router.get('/resumen',         resumen);
router.get('/tel/:telefono',   telLimiter, obtenerPorTelefono);
router.get('/:id',             obtener);
router.put('/:id',             actualizar);

module.exports = router;
