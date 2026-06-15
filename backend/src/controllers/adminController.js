const { PrismaClient } = require('@prisma/client');
const XLSXStyle = require('xlsx-js-style');
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

/**
 * Exporta a Excel las llantas SIN STOCK o SIN PRECIO definido.
 * GET /api/admin/stock-critico/export?tipo=sin-stock|sin-precio
 */
const exportarStockCritico = async (req, res, next) => {
  try {
    const tipo = req.query.tipo === 'sin-precio' ? 'sin-precio' : 'sin-stock';

    const sedes = await prisma.sede.findMany({
      where: { activo: true }, orderBy: { codigoLocal: 'asc' },
      select: { id: true, nombre: true, codigoLocal: true },
    });

    const productos = await prisma.producto.findMany({
      where: { activo: true },
      include: { stocks: { include: { sede: true } } },
      orderBy: [{ marca: 'asc' }, { medida: 'asc' }],
    });

    const stockTotal = (p) => p.stocks.reduce((s, x) => s + (x.cantidad || 0), 0);
    const precioReg = (p) => (p.precioRegular == null ? 0 : parseFloat(p.precioRegular));

    const filtrados = tipo === 'sin-precio'
      ? productos.filter(p => !precioReg(p) || precioReg(p) <= 0)
      : productos.filter(p => stockTotal(p) <= 0);

    // Encabezados
    const headBase = ['SKU', 'Medida', 'Marca', 'Nombre Comercial', 'Tipo', 'Grupo',
      'Precio Regular', 'Precio Oferta', 'Stock Total'];
    const headSedes = sedes.map(s => `Stock ${s.codigoLocal || ''} ${s.nombre}`.trim());
    const header = [...headBase, ...headSedes];

    const rows = filtrados.map(p => {
      const porSede = sedes.map(s => {
        const st = p.stocks.find(x => x.sedeId === s.id);
        return st ? st.cantidad : 0;
      });
      return [
        p.sku, p.medida, p.marca, p.nombreComercial || '', p.tipo || '', p.grupo || '',
        precioReg(p), p.precioOferta == null ? '' : parseFloat(p.precioOferta), stockTotal(p),
        ...porSede,
      ];
    });

    // Construir hoja con estilo de encabezado
    const aoa = [header, ...rows];
    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    const azul = { fill: { fgColor: { rgb: tipo === 'sin-precio' ? 'B45309' : 'B91C1C' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true }, alignment: { horizontal: 'center' } };
    for (let c = 0; c < header.length; c++) {
      const ref = XLSXStyle.utils.encode_cell({ r: 0, c });
      if (ws[ref]) ws[ref].s = azul;
    }
    ws['!cols'] = header.map((h, i) => ({ wch: i === 3 ? 28 : Math.max(10, h.length + 2) }));

    const wb = XLSXStyle.utils.book_new();
    const hojaNombre = tipo === 'sin-precio' ? 'Sin Precio' : 'Sin Stock';
    XLSXStyle.utils.book_append_sheet(wb, ws, hojaNombre);

    const buf = XLSXStyle.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fecha = new Date().toISOString().slice(0, 10);
    const fname = `llantas_${tipo}_${fecha}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(buf);
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

module.exports = { stockCritico, exportarStockCritico, resumen, seedCitasTest };
