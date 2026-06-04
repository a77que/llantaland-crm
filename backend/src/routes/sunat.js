const router = require('express').Router();
const { getConfig, saveConfig, emitir, listarComprobantes } = require('../controllers/sunatController');
const { auth, requireAdmin } = require('../middleware/auth');

router.use(auth);
router.get('/config',           requireAdmin, getConfig);
router.post('/config',          requireAdmin, saveConfig);
router.post('/emitir/:ventaId', requireAdmin, emitir);
router.get('/comprobantes',     requireAdmin, listarComprobantes);

module.exports = router;
