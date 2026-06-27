/**
 * Catálogo administrado del negocio "El Patrón" (vista "Detalles del Patrón" del CRM).
 */
const router = require('express').Router();
const { auth, requireAdmin } = require('../middleware/auth');
const {
  listarPersonajes, actualizarPersonaje,
  listarDistritos, crearDistrito, actualizarDistrito, eliminarDistrito,
  listarAgregados, crearAgregado, actualizarAgregado, eliminarAgregado,
} = require('../controllers/patronController');

router.use(auth);

router.get('/personajes',     listarPersonajes);
router.put('/personajes/:id', requireAdmin, actualizarPersonaje);

router.get('/distritos',      listarDistritos);
router.post('/distritos',     requireAdmin, crearDistrito);
router.put('/distritos/:id',  requireAdmin, actualizarDistrito);
router.delete('/distritos/:id', requireAdmin, eliminarDistrito);

router.get('/agregados',      listarAgregados);
router.post('/agregados',     requireAdmin, crearAgregado);
router.put('/agregados/:id',  requireAdmin, actualizarAgregado);
router.delete('/agregados/:id', requireAdmin, eliminarAgregado);

module.exports = router;
