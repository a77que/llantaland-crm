const router = require('express').Router();
const multer = require('multer');
const { preview, ejecutar, previewUpdate, aplicarUpdate, generarTemplate } = require('../controllers/importarController');
const { auth, requireAdmin } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(auth, requireAdmin);
router.get('/template',          generarTemplate);
router.post('/preview',          upload.single('archivo'), preview);
router.post('/ejecutar',         upload.single('archivo'), ejecutar);
router.post('/preview-update',   upload.single('archivo'), previewUpdate);
router.post('/aplicar-update',   upload.single('archivo'), aplicarUpdate);

module.exports = router;
