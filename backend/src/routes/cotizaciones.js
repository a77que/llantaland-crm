const router = require('express').Router();
const { listar, obtener, crear, actualizar, generarPdf, convertirAVenta } = require('../controllers/cotizacionController');
const { auth, requireAdmin } = require('../middleware/auth');

router.use(auth);
router.get('/',               listar);            // todos ven sus cotizaciones
router.get('/:id',            obtener);
router.post('/',              crear);             // vendedores pueden crear
router.put('/:id',            actualizar);        // vendedores pueden editar
router.post('/:id/pdf',       generarPdf);
router.post('/:id/convertir', convertirAVenta);   // vendedores convierten a venta

module.exports = router;
