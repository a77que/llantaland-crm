const bcrypt = require('bcryptjs');

const prisma = require('../lib/prisma');

const ROLES = ['ADMIN', 'VENDEDOR'];
const SELECT = { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true };

const listar = async (req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: SELECT,
      orderBy: [{ activo: 'desc' }, { createdAt: 'asc' }],
    });
    res.json(usuarios);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    const rolFinal = ROLES.includes(rol) ? rol : 'VENDEDOR';

    const existe = await prisma.usuario.findUnique({ where: { email: emailNorm } });
    if (existe) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });

    const usuario = await prisma.usuario.create({
      data: {
        nombre: String(nombre).trim(),
        email: emailNorm,
        password: await bcrypt.hash(String(password), 10),
        rol: rolFinal,
      },
      select: SELECT,
    });
    res.status(201).json(usuario);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, rol, activo, password } = req.body;
    const data = {};
    if (nombre !== undefined) data.nombre = String(nombre).trim();
    if (rol !== undefined && ROLES.includes(rol)) data.rol = rol;
    if (activo !== undefined) data.activo = !!activo;
    if (password) {
      if (String(password).length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      data.password = await bcrypt.hash(String(password), 10);
    }

    // Protección: un admin no puede desactivarse ni quitarse el rol a sí mismo
    if (req.usuario.id === id && (data.activo === false || data.rol === 'VENDEDOR')) {
      return res.status(400).json({ error: 'No puedes desactivarte ni cambiar tu propio rol de administrador' });
    }

    const usuario = await prisma.usuario.update({ where: { id }, data, select: SELECT });
    res.json(usuario);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    next(err);
  }
};

module.exports = { listar, crear, actualizar };
