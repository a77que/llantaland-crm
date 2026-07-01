const jwt = require('jsonwebtoken');

const prisma = require('../lib/prisma');

const auth = async (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });
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
