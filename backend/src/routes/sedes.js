const router = require('express').Router();
const { listar, crear, actualizar } = require('../controllers/sedeController');
const { auth } = require('../middleware/auth');

router.use(auth);
router.get('/', listar);
router.post('/', crear);
router.put('/:id', actualizar);

module.exports = router;
