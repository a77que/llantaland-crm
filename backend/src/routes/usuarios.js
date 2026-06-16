const router = require('express').Router();
const { listar, crear, actualizar } = require('../controllers/userController');
const { auth, requireAdmin } = require('../middleware/auth');

// Solo administradores gestionan usuarios
router.use(auth, requireAdmin);

router.get('/', listar);
router.post('/', crear);
router.put('/:id', actualizar);

module.exports = router;
