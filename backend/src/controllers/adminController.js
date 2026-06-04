const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const stockCritico = async (req, res, next) => {
  try {
    const alertas = await prisma.alertaStock.findMany({
      where: { resuelta: false },
      orderBy: { createdAt: 'desc' },
      include: {
        producto: { select: { sku: true, medida: true, marca: true, nombreComercial: true } },
        sede: { select: { nombre: true, codigoLocal: true } },
      },
    });
    res.json(alertas);
  } catch (err) {
    next(err);
  }
};

const resumen = async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;
    const where = {};
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) where.createdAt.lte = new Date(hasta);
    }

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

    const [ventasTotal, ventasHoy, leadsTotal, leadsHoy, leadsCompletados, leadsCalientes] = await Promise.all([
      prisma.venta.count({ where: { ...where, estado: { not: 'ANULADA' } } }),
      prisma.venta.count({ where: { createdAt: { gte: hoy }, estado: { not: 'ANULADA' } } }),
      prisma.leadCRM.count(),
      prisma.leadCRM.count({ where: { timestamp: { gte: hoy } } }),
      prisma.leadCRM.count({ where: { pasoActual: 'completado' } }),
      prisma.leadCRM.count({ where: { ranking: 'caliente' } }),
    ]);

    const ventasAgregado = await prisma.venta.aggregate({
      where: { ...where, estado: { not: 'ANULADA' } },
      _sum: { precioTotal: true },
      _count: true,
    });

    res.json({
      ventas: { total: ventasAgregado._sum.precioTotal || 0, cantidad: ventasAgregado._count, hoy: ventasHoy },
      leads: { total: leadsTotal, hoy: leadsHoy, completados: leadsCompletados, calientes: leadsCalientes },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { stockCritico, resumen };
