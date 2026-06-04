const router = require('express').Router();
const { listar, obtener, crear, actualizar, generarPdf, convertirAVenta, marcarWhatsapp } = require('../controllers/cotizacionController');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/', listar);
router.get('/:id', obtener);
router.post('/', crear);
router.put('/:id', actualizar);
router.post('/:id/pdf', generarPdf);
router.post('/:id/convertir', convertirAVenta);
router.post('/:id/whatsapp', marcarWhatsapp);

module.exports = router;
