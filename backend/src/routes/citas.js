const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listar, poll, actualizar } = require('../controllers/citasController');

router.use(auth);
router.get('/',      listar);
router.get('/poll',  poll);
router.put('/:id',   actualizar);

module.exports = router;
