const router = require('express').Router();
const { stockCritico, resumen, seedCitasTest } = require('../controllers/adminController');
const { auth, requireAdmin } = require('../middleware/auth');

router.use(auth, requireAdmin);
router.get('/stock-critico', stockCritico);
router.get('/resumen', resumen);
router.post('/seed-citas-test', seedCitasTest);

module.exports = router;
