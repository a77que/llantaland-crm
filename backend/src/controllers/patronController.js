/**
 * Catálogo administrado del negocio "El Patrón" (shows de personajes).
 * CRUD simple para Personajes, Distritos de cobertura y Agregados de regalo.
 */
const prisma = require('../lib/prisma');

// ─── PERSONAJES ──────────────────────────────────────────────────────────────

const listarPersonajes = async (req, res, next) => {
  try {
    const personajes = await prisma.personajeShow.findMany({ orderBy: { nombre: 'asc' } });
    res.json(personajes);
  } catch (err) {
    next(err);
  }
};

const actualizarPersonaje = async (req, res, next) => {
  try {
    const { precioBase, descripcion, imagenUrl, activo } = req.body;
    const data = {};
    if (precioBase !== undefined) data.precioBase = parseFloat(precioBase);
    if (descripcion !== undefined) data.descripcion = descripcion || null;
    if (imagenUrl !== undefined) data.imagenUrl = imagenUrl || null;
    if (activo !== undefined) data.activo = !!activo;

    const personaje = await prisma.personajeShow.update({ where: { id: req.params.id }, data });
    res.json(personaje);
  } catch (err) {
    next(err);
  }
};

// ─── DISTRITOS DE COBERTURA (costo de movilidad) ─────────────────────────────

const listarDistritos = async (req, res, next) => {
  try {
    const distritos = await prisma.distritoCobertura.findMany({ orderBy: { distrito: 'asc' } });
    res.json(distritos);
  } catch (err) {
    next(err);
  }
};

const crearDistrito = async (req, res, next) => {
  try {
    const { distrito, costoTransporteAprox } = req.body;
    if (!distrito) return res.status(400).json({ error: 'distrito es requerido' });

    const item = await prisma.distritoCobertura.create({
      data: {
        distrito,
        costoTransporteAprox: costoTransporteAprox !== undefined && costoTransporteAprox !== '' ? parseFloat(costoTransporteAprox) : null,
      },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

const actualizarDistrito = async (req, res, next) => {
  try {
    const { costoTransporteAprox, activo } = req.body;
    const data = {};
    if (costoTransporteAprox !== undefined) data.costoTransporteAprox = costoTransporteAprox === '' || costoTransporteAprox === null ? null : parseFloat(costoTransporteAprox);
    if (activo !== undefined) data.activo = !!activo;

    const item = await prisma.distritoCobertura.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

const eliminarDistrito = async (req, res, next) => {
  try {
    await prisma.distritoCobertura.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

// ─── AGREGADOS DE REGALO ──────────────────────────────────────────────────────

const listarAgregados = async (req, res, next) => {
  try {
    const agregados = await prisma.agregadoRegalo.findMany({ orderBy: { nombre: 'asc' } });
    res.json(agregados);
  } catch (err) {
    next(err);
  }
};

const crearAgregado = async (req, res, next) => {
  try {
    const { nombre, tipo, precio } = req.body;
    if (!nombre || !tipo || precio === undefined) {
      return res.status(400).json({ error: 'nombre, tipo y precio son requeridos' });
    }
    const item = await prisma.agregadoRegalo.create({
      data: { nombre, tipo, precio: parseFloat(precio) },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

const actualizarAgregado = async (req, res, next) => {
  try {
    const { nombre, tipo, precio, activo } = req.body;
    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (tipo !== undefined) data.tipo = tipo;
    if (precio !== undefined) data.precio = parseFloat(precio);
    if (activo !== undefined) data.activo = !!activo;

    const item = await prisma.agregadoRegalo.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

const eliminarAgregado = async (req, res, next) => {
  try {
    await prisma.agregadoRegalo.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listarPersonajes, actualizarPersonaje,
  listarDistritos, crearDistrito, actualizarDistrito, eliminarDistrito,
  listarAgregados, crearAgregado, actualizarAgregado, eliminarAgregado,
};
