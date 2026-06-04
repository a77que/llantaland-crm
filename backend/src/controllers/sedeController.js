const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const listar = async (req, res, next) => {
  try {
    const sedes = await prisma.sede.findMany({
      orderBy: { codigoLocal: 'asc' },
      include: { _count: { select: { stocks: true } } },
    });
    res.json(sedes);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const sede = await prisma.sede.create({ data: req.body });
    res.status(201).json(sede);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const sede = await prisma.sede.update({ where: { id: req.params.id }, data: req.body });
    res.json(sede);
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, crear, actualizar };
