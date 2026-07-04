const { paginar } = require('../utils/helpers');
const { invalidarCachePrecios } = require('./n8nController');

const prisma = require('../lib/prisma');

const listar = async (req, res, next) => {
  try {
    const { sedeId, critico } = req.query;
    const where = {};
    if (sedeId) where.sedeId = sedeId;
    if (critico === 'true') {
      where.cantidad = { lte: prisma.stock.fields.stockMinimo };
    }

    const stocks = await prisma.stock.findMany({
      where,
      include: {
        producto: {
          select: { id: true, sku: true, medida: true, marca: true, modelo: true, tipoVehiculo: true, precio: true },
        },
        sede: { select: { id: true, nombre: true } },
      },
      orderBy: [{ producto: { marca: 'asc' } }],
    });

    // Marcar críticos
    const data = stocks.map((s) => ({
      ...s,
      esCritico: s.cantidad <= s.stockMinimo,
    }));

    res.json(data);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const { productoId, sedeId } = req.params;
    const { cantidad, stockMinimo } = req.body;

    const stock = await prisma.stock.upsert({
      where: { productoId_sedeId: { productoId, sedeId } },
      update: {
        ...(cantidad !== undefined ? { cantidad: parseInt(cantidad) } : {}),
        ...(stockMinimo !== undefined ? { stockMinimo: parseInt(stockMinimo) } : {}),
      },
      create: {
        productoId,
        sedeId,
        cantidad: parseInt(cantidad) || 0,
        stockMinimo: parseInt(stockMinimo) || 5,
      },
      include: { producto: true, sede: true },
    });

    invalidarCachePrecios();
    res.json(stock);
  } catch (err) {
    next(err);
  }
};

const registrarMovimiento = async (req, res, next) => {
  try {
    const { productoId, sedeId, tipo, cantidad, referencia } = req.body;

    await prisma.$transaction(async (tx) => {
      const delta = tipo === 'ENTRADA' ? parseInt(cantidad) : -parseInt(cantidad);

      const stockActual = await tx.stock.findUnique({
        where: { productoId_sedeId: { productoId, sedeId } },
      });

      if (!stockActual && tipo === 'SALIDA') {
        throw new Error('No hay stock registrado para esta sede');
      }

      const nuevaCantidad = (stockActual?.cantidad || 0) + delta;
      if (nuevaCantidad < 0) throw new Error('Stock insuficiente');

      await tx.stock.upsert({
        where: { productoId_sedeId: { productoId, sedeId } },
        update: { cantidad: nuevaCantidad },
        create: { productoId, sedeId, cantidad: nuevaCantidad },
      });

      await tx.movimientoStock.create({
        data: { productoId, sedeId, tipo, cantidad: parseInt(cantidad), referencia, usuarioId: req.usuario.id },
      });

      // Verificar alerta de stock mínimo
      if (tipo === 'SALIDA') {
        const stockFinal = await tx.stock.findUnique({
          where: { productoId_sedeId: { productoId, sedeId } },
        });
        if (stockFinal && stockFinal.cantidad <= stockFinal.stockMinimo) {
          await tx.alertaStock.create({
            data: {
              productoId,
              sedeId,
              cantidadActual: stockFinal.cantidad,
              stockMinimo: stockFinal.stockMinimo,
            },
          });
        }
      }
    });

    invalidarCachePrecios();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, actualizar, registrarMovimiento };
