const jwt = require('jsonwebtoken');

const prisma = require('../lib/prisma');

const auth = async (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = header.split(' ')[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    // También se verifica contra la tabla Sesion, no solo la firma/expiración
    // del JWT: así "cerrar sesión" invalida el token de verdad en el server,
    // en vez de solo borrar el localStorage del navegador — un token robado
    // deja de servir apenas el usuario legítimo cierra sesión.
    const sesion = await prisma.sesion.findUnique({
      where: { token },
      include: { usuario: { select: { id: true, nombre: true, email: true, rol: true, activo: true } } },
    });
    if (!sesion || sesion.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    const usuario = sesion.usuario;
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
    }
    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.usuario?.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Requiere rol de administrador' });
  }
  next();
};

module.exports = { auth, requireAdmin };
