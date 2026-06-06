const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { listar, poll } = require('../controllers/citasController');

router.use(auth);
router.get('/',      listar);
router.get('/poll',  poll);

module.exports = router;
