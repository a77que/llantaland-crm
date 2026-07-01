const prisma = require('../lib/prisma');

const TIPOS = ['fijo', 'porcentaje'];

// Lista los conceptos de costo globales (ordenados). Si no hay ninguno, sugiere
// los típicos (IGV, instalación, traslado) sin guardarlos todavía.
const listar = async (req, res, next) => {
  try {
    const items = await prisma.costoVenta.findMany({ orderBy: { orden: 'asc' } });
    if (items.length === 0) {
      return res.json({ items: [], sugeridos: [
        { nombre: 'IGV', tipo: 'porcentaje', valor: 18, activo: true },
        { nombre: 'Instalación', tipo: 'fijo', valor: 0, activo: true },
        { nombre: 'Traslado', tipo: 'fijo', valor: 0, activo: true },
      ] });
    }
    res.json({ items });
  } catch (err) { next(err); }
};

// Guarda TODA la lista de conceptos (reemplaza la existente).
const guardar = async (req, res, next) => {
  try {
    const lista = Array.isArray(req.body?.items) ? req.body.items : [];
    const data = lista
      .filter(c => c && String(c.nombre || '').trim())
      .map((c, i) => ({
        nombre: String(c.nombre).trim().substring(0, 60),
        tipo: TIPOS.includes(c.tipo) ? c.tipo : 'fijo',
        valor: isNaN(parseFloat(c.valor)) ? 0 : parseFloat(c.valor),
        orden: i,
        activo: c.activo !== false,
      }));
    await prisma.$transaction([
      prisma.costoVenta.deleteMany({}),
      ...(data.length ? [prisma.costoVenta.createMany({ data })] : []),
    ]);
    const items = await prisma.costoVenta.findMany({ orderBy: { orden: 'asc' } });
    res.json({ ok: true, items });
  } catch (err) { next(err); }
};

module.exports = { listar, guardar };
