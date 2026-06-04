const router = require('express').Router();
const { listar, obtener, crear, actualizar } = require('../controllers/sedeController');
const { auth, requireAdmin } = require('../middleware/auth');

router.use(auth);
router.get('/',    listar);
router.get('/:id', obtener);
router.post('/',   requireAdmin, crear);
router.put('/:id', requireAdmin, actualizar);

module.exports = router;
