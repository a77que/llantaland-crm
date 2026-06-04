const router = require('express').Router();
const { listar, obtener, crear, generarPdf } = require('../controllers/ventaController');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/', listar);
router.get('/:id', obtener);
router.post('/', crear);
router.post('/:id/pdf', generarPdf);

module.exports = router;
