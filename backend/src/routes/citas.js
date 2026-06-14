const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listar, poll, actualizar, generarPdf } = require('../controllers/citasController');

router.use(auth);
router.get('/',      listar);
router.get('/poll',  poll);
router.post('/:id/pdf', generarPdf);
router.put('/:id',   actualizar);

module.exports = router;
