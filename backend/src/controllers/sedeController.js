const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const listar = async (req, res, next) => {
  try {
    const sedes = await prisma.sede.findMany({
      orderBy: { codigoLocal: 'asc' },
      include: { _count: { select: { stocks: true } } },
    });
    res.json(sedes);
  } catch (err) { next(err); }
};

const obtener = async (req, res, next) => {
  try {
    const sede = await prisma.sede.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { stocks: true } },
        stocks: {
          include: { producto: { select: { sku: true, medida: true, marca: true, nombreComercial: true } } },
          orderBy: { cantidad: 'desc' },
          take: 10,
        },
      },
    });
    if (!sede) return res.status(404).json({ error: 'Almacén no encontrado' });
    res.json(sede);
  } catch (err) { next(err); }
};

function sanitizarSede(body) {
  const str = (v) => (typeof v === 'string' ? v.trim() || null : null);
  return {
    ...(body.codigoLocal !== undefined && { codigoLocal: String(body.codigoLocal).trim() }),
    ...(body.nombre      !== undefined && { nombre:      String(body.nombre).trim() }),
    ...(body.tipo        !== undefined && { tipo:        body.tipo }),
    distrito:    str(body.distrito),
    direccion:   str(body.direccion),
    telefono:    str(body.telefono),
    email:       str(body.email),
    horario:     str(body.horario),
    encargado:   str(body.encargado),
    latitud:     str(body.latitud),
    longitud:    str(body.longitud),
    ...(body.activo !== undefined && { activo: body.activo === true || body.activo === 'true' }),
  };
}

const crear = async (req, res, next) => {
  try {
    const data = sanitizarSede(req.body);
    if (!data.codigoLocal) return res.status(400).json({ error: 'El código de local es requerido' });
    if (!data.nombre)      return res.status(400).json({ error: 'El nombre es requerido' });
    const sede = await prisma.sede.create({ data });
    res.status(201).json(sede);
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const { codigoLocal: _, ...resto } = sanitizarSede(req.body);
    const sede = await prisma.sede.update({ where: { id: req.params.id }, data: resto });
    res.json(sede);
  } catch (err) { next(err); }
};

module.exports = { listar, obtener, crear, actualizar };
