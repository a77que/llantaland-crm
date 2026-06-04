const router = require('express').Router();
const { listar, actualizar, registrarMovimiento } = require('../controllers/stockController');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/', listar);
router.post('/movimiento', registrarMovimiento);
router.put('/:productoId/:sedeId', actualizar);

module.exports = router;
