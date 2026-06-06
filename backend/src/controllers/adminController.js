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

const seedCitasTest = async (req, res, next) => {
  try {
    const localSantaAnita = { ID: 'L1', Nombre: 'Santa Anita', Tipo: 'lima', Distrito: 'Santa Anita', Direccion: 'Av. Las Torres 412' };
    const localSurco      = { ID: 'L2', Nombre: 'Surco',       Tipo: 'lima', Distrito: 'Surquillo',   Direccion: 'Av. Angamos Este 1580' };
    const stockMap1 = { Stock_L1_SantaAnita: 8, Stock_L1: 8, Stock_L2_Surco: 3, Stock_L2: 3 };
    const stockMap2 = { Stock_L1_SantaAnita: 0, Stock_L1: 0, Stock_L2_Surco: 5, Stock_L2: 5 };

    const c1 = await prisma.leadCRM.upsert({
      where: { telefono: '51900000001' },
      update: {
        nombreCliente: 'Carlos Mendoza Ríos', dniCe: '46123789',
        pasoActual: 'esperando_confirmacion', ranking: 'caliente',
        marcaAuto: 'Toyota', modeloAuto: 'Corolla', anioAuto: 2019,
        medidaDetectada: '195/65R15', marcaLlanta: 'Michelin', modeloLlanta: 'Energy Saver',
        cantidadLlantas: 4, precioLlanta: 380.00,
        localInstalacion: localSantaAnita, stockMap: stockMap1,
      },
      create: {
        telefono: '51900000001',
        nombreCliente: 'Carlos Mendoza Ríos', dniCe: '46123789',
        pasoActual: 'esperando_confirmacion', ranking: 'caliente',
        marcaAuto: 'Toyota', modeloAuto: 'Corolla', anioAuto: 2019,
        medidaDetectada: '195/65R15', marcaLlanta: 'Michelin', modeloLlanta: 'Energy Saver',
        cantidadLlantas: 4, precioLlanta: 380.00,
        localInstalacion: localSantaAnita, stockMap: stockMap1,
      },
    });

    const c2 = await prisma.leadCRM.upsert({
      where: { telefono: '51900000002' },
      update: {
        nombreCliente: 'María Flores Vega', dniCe: '72456318',
        pasoActual: 'completado', ranking: 'tibio',
        marcaAuto: 'Hyundai', modeloAuto: 'Tucson', anioAuto: 2021,
        medidaDetectada: '225/55R18', marcaLlanta: 'Bridgestone', modeloLlanta: 'Turanza T005',
        cantidadLlantas: 2, precioLlanta: 620.00,
        localInstalacion: localSurco, stockMap: stockMap2,
      },
      create: {
        telefono: '51900000002',
        nombreCliente: 'María Flores Vega', dniCe: '72456318',
        pasoActual: 'completado', ranking: 'tibio',
        marcaAuto: 'Hyundai', modeloAuto: 'Tucson', anioAuto: 2021,
        medidaDetectada: '225/55R18', marcaLlanta: 'Bridgestone', modeloLlanta: 'Turanza T005',
        cantidadLlantas: 2, precioLlanta: 620.00,
        localInstalacion: localSurco, stockMap: stockMap2,
      },
    });

    res.json({ ok: true, creadas: [c1.telefono, c2.telefono] });
  } catch (err) {
    next(err);
  }
};

module.exports = { stockCritico, resumen, seedCitasTest };
