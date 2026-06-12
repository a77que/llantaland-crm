const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { placa, versiones } = require('../controllers/vehiculoController');

router.use(auth);
router.get('/placa/:placa', placa);
router.post('/versiones',   versiones);

module.exports = router;
