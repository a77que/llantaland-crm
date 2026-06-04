const router = require('express').Router();
const { listar, obtener, crear, actualizar } = require('../controllers/sedeController');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/',    listar);
router.get('/:id', obtener);
router.post('/',   crear);
router.put('/:id', actualizar);

module.exports = router;
