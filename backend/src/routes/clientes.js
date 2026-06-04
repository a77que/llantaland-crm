const router = require('express').Router();
const { listar, buscar, lookup, obtener, crear, actualizar } = require('../controllers/clienteController');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/', listar);
router.get('/buscar', buscar);
router.post('/lookup', lookup);
router.get('/:id', obtener);
router.post('/', crear);
router.put('/:id', actualizar);

module.exports = router;
