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

const crear = async (req, res, next) => {
  try {
    const sede = await prisma.sede.create({ data: req.body });
    res.status(201).json(sede);
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const sede = await prisma.sede.update({ where: { id: req.params.id }, data: req.body });
    res.json(sede);
  } catch (err) { next(err); }
};

module.exports = { listar, obtener, crear, actualizar };
