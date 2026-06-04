const router = require('express').Router();
const { listar, actualizar, registrarMovimiento } = require('../controllers/stockController');
const { auth, requireAdmin } = require('../middleware/auth');

router.use(auth);
router.get('/',                            listar);
router.put('/:productoId/:sedeId',         requireAdmin, actualizar);
router.post('/movimiento',                 requireAdmin, registrarMovimiento);

module.exports = router;
