const { PrismaClient } = require('@prisma/client');
const { paginar } = require('../utils/helpers');
const pdfService = require('../services/pdfService');
const prisma = new PrismaClient();

const listar = async (req, res, next) => {
  try {
    const { estado, tipoVenta, desde, hasta, page, limit } = req.query;
    const { skip, take } = paginar(page, limit);
    const isAdmin = req.usuario?.rol === 'ADMIN';
    const where = {};
    if (estado) where.estado = estado;
    if (tipoVenta) where.tipoVenta = tipoVenta;
    // Vendedor solo ve sus propias ventas
    if (!isAdmin) where.usuarioId = req.usuario.id;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) where.createdAt.lte = new Date(hasta);
    }

    const [total, ventas] = await Promise.all([
      prisma.venta.count({ where }),
      prisma.venta.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          usuario: { select: { nombre: true } },
          lead: { select: { telefono: true, nombreCliente: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);
    res.json({ total, page: parseInt(page) || 1, limit: take, data: ventas });
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: req.params.id },
      include: {
        usuario: { select: { nombre: true, email: true } },
        lead: true,
        items: { include: { producto: true, sede: true } },
        comprobantes: true,
      },
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(venta);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const { items, medidaLlanta, marcaLlanta, modeloLlanta, cantidad, precioUnit, ...rest } = req.body;

    const cantFinal   = parseInt(cantidad || 1);
    const precioFinal = parseFloat(precioUnit || 0);

    // Validaciones de integridad
    if (cantFinal <= 0) return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
    if (precioFinal < 0) return res.status(400).json({ error: 'Precio no puede ser negativo' });
    if (items?.length > 0) {
      for (const item of items) {
        if (parseInt(item.cantidad) <= 0) return res.status(400).json({ error: 'Cantidad de item debe ser mayor a 0' });
        if (parseFloat(item.precioUnit) < 0) return res.status(400).json({ error: 'Precio de item no puede ser negativo' });
      }
    }

    const count = await prisma.venta.count();
    const numero = `VTA-${String(count + 1).padStart(5, '0')}`;

    const venta = await prisma.$transaction(async (tx) => {
      const v = await tx.venta.create({
        data: {
          numero,
          usuarioId: req.usuario.id,
          medidaLlanta: medidaLlanta || null,
          marcaLlanta: marcaLlanta || null,
          modeloLlanta: modeloLlanta || null,
          cantidad: cantFinal,
          precioUnit: precioFinal,
          precioTotal: precioFinal * cantFinal,
          tipoVenta: rest.tipoVenta || 'tienda',
          estado: 'PENDIENTE',
          ...rest,
        },
      });

      // Si vienen items de stock, descontarlos
      if (items && items.length > 0) {
        await tx.itemVenta.createMany({
          data: items.map(item => ({
            ventaId: v.id,
            productoId: item.productoId,
            sedeId: item.sedeId,
            cantidad: item.cantidad,
            precioUnit: parseFloat(item.precioUnit),
            subtotal: parseFloat(item.precioUnit) * item.cantidad,
          })),
        });
        for (const item of items) {
          const stock = await tx.stock.findUnique({
            where: { productoId_sedeId: { productoId: item.productoId, sedeId: item.sedeId } },
          });
          if (!stock || stock.cantidad < item.cantidad) throw new Error(`Stock insuficiente`);
          await tx.stock.update({
            where: { productoId_sedeId: { productoId: item.productoId, sedeId: item.sedeId } },
            data: { cantidad: { decrement: item.cantidad } },
          });
          await tx.movimientoStock.create({
            data: { productoId: item.productoId, sedeId: item.sedeId, tipo: 'SALIDA', cantidad: item.cantidad, referencia: v.numero, usuarioId: req.usuario.id },
          });
        }
      }
      return v;
    });

    res.status(201).json(venta);
  } catch (err) {
    next(err);
  }
};

const generarPdf = async (req, res, next) => {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: req.params.id },
      include: {
        usuario: { select: { nombre: true } },
        lead: { select: { telefono: true, nombreCliente: true } },
        items: { include: { producto: true, sede: true } },
        comprobantes: true,
      },
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const filename = await pdfService.generarVenta(venta);
    const pdfUrl = `/uploads/${filename}`;
    await prisma.venta.update({ where: { id: req.params.id }, data: {} }); // touch

    // Recibo generado = entrega completada: la cita del lead pasa a ENTREGADO
    if (venta.leadId) {
      await prisma.leadCRM.update({ where: { id: venta.leadId }, data: { estadoCita: 'ENTREGADO' } }).catch(() => {});
    }
    res.json({ pdfUrl });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, crear, generarPdf };
