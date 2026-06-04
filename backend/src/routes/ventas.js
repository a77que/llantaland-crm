const router = require('express').Router();
const { listar, obtener, crear, generarPdf } = require('../controllers/ventaController');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/',       listar);     // todos ven ventas
router.get('/:id',    obtener);
router.post('/',      crear);      // vendedores pueden crear ventas en tienda
router.post('/:id/pdf', generarPdf);

module.exports = router;
