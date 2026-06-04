const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const listar = async (req, res, next) => {
  try {
    const { paso, ranking, q, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (paso) where.pasoActual = paso;
    if (ranking) where.ranking = ranking;
    if (q) {
      where.OR = [
        { telefono: { contains: q } },
        { nombreCliente: { contains: q, mode: 'insensitive' } },
        { medidaDetectada: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.leadCRM.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: { humanTakeover: true, _count: { select: { historial: true } } },
      }),
      prisma.leadCRM.count({ where }),
    ]);

    res.json({ leads, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const lead = await prisma.leadCRM.findUnique({
      where: { id: req.params.id },
      include: {
        humanTakeover: true,
        historial: { orderBy: { timestamp: 'asc' } },
        ventas: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    res.json(lead);
  } catch (err) {
    next(err);
  }
};

const obtenerPorTelefono = async (req, res, next) => {
  try {
    const lead = await prisma.leadCRM.findUnique({
      where: { telefono: req.params.telefono },
      include: {
        humanTakeover: true,
        historial: { orderBy: { timestamp: 'asc' }, take: 50 },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    res.json(lead);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const lead = await prisma.leadCRM.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(lead);
  } catch (err) {
    next(err);
  }
};

const resumen = async (req, res, next) => {
  try {
    const [porPaso, porRanking, total, hoy] = await Promise.all([
      prisma.leadCRM.groupBy({ by: ['pasoActual'], _count: true }),
      prisma.leadCRM.groupBy({ by: ['ranking'], _count: true }),
      prisma.leadCRM.count(),
      prisma.leadCRM.count({
        where: { timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);
    res.json({ porPaso, porRanking, total, hoy });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, obtenerPorTelefono, actualizar, resumen };
