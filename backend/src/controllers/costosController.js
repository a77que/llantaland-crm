const prisma = require('../lib/prisma');

const TIPOS = ['fijo', 'porcentaje'];

// Conceptos obligatorios: son la base del cálculo de precioOferta (ver
// productoController.actualizar) y no se pueden renombrar ni eliminar desde
// la UI. Comparación sin tildes/mayúsculas para que "instalación"/"Instalacion"
// cuenten igual.
const normalizarNombre = (s) => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');
const NOMBRES_OBLIGATORIOS = ['igv', 'instalacion', 'ganancia'];
const esObligatorio = (nombre) => NOMBRES_OBLIGATORIOS.includes(normalizarNombre(nombre));

// Lista los conceptos de costo globales (ordenados). Si no hay ninguno, sugiere
// los típicos (IGV, instalación, ganancia) sin guardarlos todavía.
const listar = async (req, res, next) => {
  try {
    const items = await prisma.costoVenta.findMany({ orderBy: { orden: 'asc' } });
    if (items.length === 0) {
      return res.json({ items: [], sugeridos: [
        { nombre: 'IGV', tipo: 'porcentaje', valor: 18, activo: true, obligatorio: true },
        { nombre: 'Instalación', tipo: 'fijo', valor: 0, activo: true, obligatorio: true },
        { nombre: 'Ganancia', tipo: 'porcentaje', valor: 10, activo: true, obligatorio: true },
      ] });
    }
    res.json({ items: items.map(c => ({ ...c, obligatorio: esObligatorio(c.nombre) })) });
  } catch (err) { next(err); }
};

// Guarda TODA la lista de conceptos (reemplaza la existente). Los 3 conceptos
// obligatorios (IGV, Instalación, Ganancia) deben seguir presentes y activos —
// son la base de precioOferta = precioProveedor + suma de costos activos.
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
        // Los obligatorios no se pueden desactivar: siempre entran al cálculo.
        activo: esObligatorio(c.nombre) ? true : c.activo !== false,
      }));

    const presentes = new Set(data.map(c => normalizarNombre(c.nombre)));
    const faltantes = NOMBRES_OBLIGATORIOS.filter(n => !presentes.has(n));
    if (faltantes.length > 0) {
      return res.status(400).json({
        error: `Los conceptos obligatorios no se pueden eliminar ni renombrar: ${faltantes.join(', ')}`,
      });
    }

    await prisma.$transaction([
      prisma.costoVenta.deleteMany({}),
      ...(data.length ? [prisma.costoVenta.createMany({ data })] : []),
    ]);
    const items = await prisma.costoVenta.findMany({ orderBy: { orden: 'asc' } });
    res.json({ ok: true, items: items.map(c => ({ ...c, obligatorio: esObligatorio(c.nombre) })) });
  } catch (err) { next(err); }
};

module.exports = { listar, guardar, esObligatorio, NOMBRES_OBLIGATORIOS };
