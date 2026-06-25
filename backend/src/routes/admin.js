const router = require('express').Router();
const { stockCritico, exportarStockCritico, diagnosticoApis, getConfigApiBusqueda, saveConfigApiBusqueda, resumen, seedCitasTest } = require('../controllers/adminController');
const costos = require('../controllers/costosController');
const { auth, requireAdmin } = require('../middleware/auth');

router.use(auth, requireAdmin);
router.get('/stock-critico', stockCritico);
router.get('/stock-critico/export', exportarStockCritico);
router.get('/diagnostico-apis', diagnosticoApis);
router.get('/config-apis', getConfigApiBusqueda);
router.post('/config-apis', saveConfigApiBusqueda);
router.get('/resumen', resumen);
router.post('/seed-citas-test', seedCitasTest);
router.get('/costos', costos.listar);
router.post('/costos', costos.guardar);

module.exports = router;
