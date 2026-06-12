const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { listar, obtener, crear, actualizar, eliminar, eliminarMasivo, compatibles, subirImagen, marcas, enriquecerConIA } = require('../controllers/productoController');
const { auth, requireAdmin } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Solo se permiten imágenes JPG, PNG, WebP o GIF'));
  },
});

router.use(auth);
router.get('/',           listar);
router.get('/marcas',     marcas);
router.get('/compatibles',compatibles);
router.get('/:id',        obtener);
router.post('/',          requireAdmin, crear);
router.put('/:id',        requireAdmin, actualizar);
router.delete('/:id',     requireAdmin, eliminar);
router.post('/eliminar-masivo', requireAdmin, eliminarMasivo);
router.post('/:id/imagenes',      requireAdmin, upload.single('imagen'), subirImagen);
router.post('/:id/enriquecer-ia', requireAdmin, enriquecerConIA);

module.exports = router;
