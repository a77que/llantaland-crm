const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { auth, requireAdmin } = require('../middleware/auth');
const { listar, obtener, obtenerPorTelefono, actualizar, eliminar, resumen, marcarNoDesea, desmarcarNoDesea } = require('../controllers/leadsController');

const telLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Demasiadas búsquedas. Espera un minuto.' },
  standardHeaders: true, legacyHeaders: false,
});

router.use(auth);
router.get('/',               listar);
router.get('/resumen',        resumen);
router.get('/tel/:telefono',  telLimiter, obtenerPorTelefono);
router.get('/:id',            obtener);
router.put('/:id',            actualizar);
router.post('/:id/no-desea',   marcarNoDesea);
router.post('/:id/no-desea/deshacer', desmarcarNoDesea);
router.delete('/:id',         requireAdmin, eliminar);   // solo ADMIN

module.exports = router;
