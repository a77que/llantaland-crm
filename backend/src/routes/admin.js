const router = require('express').Router();
const { stockCritico, resumen } = require('../controllers/adminController');
const { auth, requireAdmin } = require('../middleware/auth');

router.use(auth, requireAdmin);
router.get('/stock-critico', stockCritico);
router.get('/resumen', resumen);

module.exports = router;
