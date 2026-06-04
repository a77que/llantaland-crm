const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { listar, obtener, crear, actualizar, compatibles, subirImagen } = require('../controllers/productoController');
const { auth } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(auth);
router.get('/', listar);
router.get('/compatibles', compatibles);
router.get('/:id', obtener);
router.post('/', crear);
router.put('/:id', actualizar);
router.post('/:id/imagenes', upload.single('imagen'), subirImagen);

module.exports = router;
