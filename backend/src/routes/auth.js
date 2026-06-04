const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { login, logout, me } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// Máximo 10 intentos de login por IP en 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de acceso. Intenta en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.post('/logout', auth, logout);
router.get('/me', auth, me);

module.exports = router;
