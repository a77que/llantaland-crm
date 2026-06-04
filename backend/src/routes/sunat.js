const router = require('express').Router();
const { getConfig, saveConfig, emitir, listarComprobantes } = require('../controllers/sunatController');
const { auth, requireAdmin } = require('../middleware/auth');

router.use(auth);
router.get('/config', requireAdmin, getConfig);
router.post('/config', requireAdmin, saveConfig);
router.post('/emitir/:ventaId', emitir);
router.get('/comprobantes', listarComprobantes);

module.exports = router;
