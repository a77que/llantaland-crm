const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { listar, obtener, crear, actualizar, eliminar, eliminarMasivo, eliminarPorSku, compatibles, subirImagen, marcas, tipos, medidas, enriquecerConIA, hermanasImagen, aplicarImagen, gruposImagen, subirImagenMultiple, exportFaltantesImagen, incompletos, enriquecerMasivo, sincronizarPrecioRegular, recalcularPrecioOferta, igualarPrecioReferencial, redondearPrecioProveedor } = require('../controllers/productoController');
const { listar: listarCostos } = require('../controllers/costosController');
const { auth, requireAdmin } = require('../middleware/auth');

// La extensión con la que se guarda SIEMPRE sale del mimetype (ya validado
// contra ALLOWED_MIME abajo), nunca del nombre original que manda el
// cliente: si se tomara del originalname, un archivo SVG/HTML disfrazado de
// imagen (Content-Type mentiroso "image/png" pero nombre "x.svg") terminaría
// guardado como .svg y servido luego como tal desde /uploads — riesgo de
// XSS almacenado, ya que un SVG puede llevar <script> embebido.
const MIME_TO_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const ALLOWED_MIME = Object.keys(MIME_TO_EXT);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '.bin';
    cb(null, `${uuidv4()}${ext}`);
  },
});

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
router.get('/tipos',      tipos);
router.get('/medidas',    medidas);
router.get('/compatibles',compatibles);
router.get('/grupos-imagen',      gruposImagen);
router.get('/imagenes/faltantes-export', exportFaltantesImagen);
router.get('/incompletos',        incompletos);
// Lectura de los conceptos de costo (IGV/Instalación/Ganancia/etc.) para
// cualquier usuario logueado — el vendedor la necesita en Nueva Cotización
// para calcular la ganancia en vivo. Guardar/editar sigue siendo solo admin
// (ver routes/admin.js -> POST /admin/costos).
router.get('/costos-venta',       listarCostos);
router.post('/enriquecer-masivo', requireAdmin, enriquecerMasivo);
router.post('/sync-precios-regulares', requireAdmin, sincronizarPrecioRegular);
router.post('/recalcular-precio-oferta', requireAdmin, recalcularPrecioOferta);
router.post('/igualar-precio-referencial', requireAdmin, igualarPrecioReferencial);
router.post('/redondear-precio-proveedor', requireAdmin, redondearPrecioProveedor);
router.post('/aplicar-imagen',    requireAdmin, aplicarImagen);
router.post('/imagen-multiple',   requireAdmin, upload.single('imagen'), subirImagenMultiple);
router.get('/:id/hermanas',       hermanasImagen);
router.get('/:id',        obtener);
router.post('/',          requireAdmin, crear);
router.put('/:id',        requireAdmin, actualizar);
router.delete('/:id',     requireAdmin, eliminar);
router.post('/eliminar-masivo', requireAdmin, eliminarMasivo);
router.post('/eliminar-sku',    requireAdmin, eliminarPorSku);
router.post('/:id/imagenes',      requireAdmin, upload.single('imagen'), subirImagen);
router.post('/:id/enriquecer-ia', requireAdmin, enriquecerConIA);

module.exports = router;
