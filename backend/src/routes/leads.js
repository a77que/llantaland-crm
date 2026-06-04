const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listar, obtener, obtenerPorTelefono, actualizar, resumen } = require('../controllers/leadsController');

router.use(auth);
router.get('/',                  listar);
router.get('/resumen',           resumen);
router.get('/tel/:telefono',     obtenerPorTelefono);
router.get('/:id',               obtener);
router.put('/:id',               actualizar);

module.exports = router;
