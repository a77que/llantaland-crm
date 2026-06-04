const router = require('express').Router();
const { listar, obtener, crear } = require('../controllers/ventaController');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/', listar);
router.get('/:id', obtener);
router.post('/', crear);

module.exports = router;
