const { PrismaClient } = require('@prisma/client');
const { calcularTotales, generarNumero, paginar } = require('../utils/helpers');
const pdfService = require('../services/pdfService');

const prisma = new PrismaClient();

const listar = async (req, res, next) => {
  try {
    const { estado, clienteId, vendedorId, desde, hasta, page, limit } = req.query;
    const { skip, take } = paginar(page, limit);
    const where = {};
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;
    if (vendedorId) where.usuarioId = vendedorId;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) where.createdAt.lte = new Date(hasta);
    }

    const [total, cotizaciones] = await Promise.all([
      prisma.cotizacion.count({ where }),
      prisma.cotizacion.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          cliente: { select: { nombre: true, apellidos: true, razonSocial: true, celular: true } },
          usuario: { select: { nombre: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);
    res.json({ total, page: parseInt(page) || 1, limit: take, data: cotizaciones });
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id: req.params.id },
      include: {
        cliente: { include: { vehiculos: true } },
        usuario: { select: { nombre: true, email: true } },
        items: { include: { producto: { include: { imagenes: { where: { esPortada: true }, take: 1 } } }, sede: true } },
      },
    });
    if (!cotizacion) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(cotizacion);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const { clienteId, items, descuentoTipo, descuentoValor, descuentoMotivo } = req.body;

    const count = await prisma.cotizacion.count();
    const numero = generarNumero('COT-', count);
    const totales = calcularTotales(items || [], descuentoTipo, descuentoValor);

    const cotizacion = await prisma.$transaction(async (tx) => {
      const cot = await tx.cotizacion.create({
        data: {
          numero,
          clienteId,
          usuarioId: req.usuario.id,
          descuentoTipo: descuentoTipo || null,
          descuentoValor: descuentoValor ? parseFloat(descuentoValor) : null,
          descuentoMotivo: descuentoMotivo || null,
          subtotal: totales.subtotal,
          igv: totales.igv,
          total: totales.total,
          items: {
            create: items.map((item) => ({
              productoId: item.productoId,
              sedeId: item.sedeId,
              cantidad: item.cantidad,
              precioUnit: parseFloat(item.precioUnit),
              subtotal: parseFloat(item.precioUnit) * item.cantidad,
            })),
          },
        },
        include: { items: true, cliente: true },
      });

      // Crear alerta de descuento si aplica
      if (descuentoTipo && descuentoValor > 0) {
        const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
        const resumen = items.map((i) => `${i.cantidad}x ${i.productoId}`).join(', ');
        await tx.alertaDescuento.create({
          data: {
            cotizacionId: cot.id,
            usuarioId: req.usuario.id,
            clienteNombre: `${cliente.nombre || ''} ${cliente.apellidos || cliente.razonSocial || ''}`.trim(),
            productoResumen: resumen,
            descuentoTipo,
            descuentoValor: parseFloat(descuentoValor),
            motivo: descuentoMotivo || null,
            montoAhorrado: totales.montoAhorrado,
          },
        });
      }

      return cot;
    });

    res.status(201).json(cotizacion);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const { items, descuentoTipo, descuentoValor, descuentoMotivo, estado } = req.body;

    const updateData = { estado };
    if (items) {
      const totales = calcularTotales(items, descuentoTipo, descuentoValor);
      Object.assign(updateData, {
        descuentoTipo: descuentoTipo || null,
        descuentoValor: descuentoValor ? parseFloat(descuentoValor) : null,
        descuentoMotivo: descuentoMotivo || null,
        subtotal: totales.subtotal,
        igv: totales.igv,
        total: totales.total,
      });
    }

    const cotizacion = await prisma.cotizacion.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(cotizacion);
  } catch (err) {
    next(err);
  }
};

const generarPdf = async (req, res, next) => {
  try {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id: req.params.id },
      include: {
        cliente: true,
        usuario: { select: { nombre: true } },
        items: { include: { producto: true } },
      },
    });
    if (!cotizacion) return res.status(404).json({ error: 'Cotización no encontrada' });

    const filename = await pdfService.generarCotizacion(cotizacion);
    await prisma.cotizacion.update({ where: { id: req.params.id }, data: { pdfUrl: `/uploads/${filename}` } });
    res.json({ pdfUrl: `/uploads/${filename}` });
  } catch (err) {
    next(err);
  }
};

const convertirAVenta = async (req, res, next) => {
  try {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!cotizacion) return res.status(404).json({ error: 'Cotización no encontrada' });
    if (cotizacion.estado === 'ACEPTADA') {
      return res.status(409).json({ error: 'Cotización ya fue convertida' });
    }

    const count = await prisma.venta.count();
    const numero = generarNumero('VTA-', count);

    const venta = await prisma.$transaction(async (tx) => {
      const v = await tx.venta.create({
        data: {
          numero,
          cotizacionId: cotizacion.id,
          clienteId: cotizacion.clienteId,
          usuarioId: req.usuario.id,
          descuentoTipo: cotizacion.descuentoTipo,
          descuentoValor: cotizacion.descuentoValor,
          descuentoMotivo: cotizacion.descuentoMotivo,
          subtotal: cotizacion.subtotal,
          igv: cotizacion.igv,
          total: cotizacion.total,
          metodoPago: req.body.metodoPago || null,
          items: {
            create: cotizacion.items.map((item) => ({
              productoId: item.productoId,
              sedeId: item.sedeId,
              cantidad: item.cantidad,
              precioUnit: item.precioUnit,
              subtotal: item.subtotal,
            })),
          },
        },
      });

      // Descontar stock
      for (const item of cotizacion.items) {
        const stock = await tx.stock.findUnique({
          where: { productoId_sedeId: { productoId: item.productoId, sedeId: item.sedeId } },
        });
        if (!stock || stock.cantidad < item.cantidad) {
          throw new Error(`Stock insuficiente para producto ${item.productoId}`);
        }
        await tx.stock.update({
          where: { productoId_sedeId: { productoId: item.productoId, sedeId: item.sedeId } },
          data: { cantidad: { decrement: item.cantidad } },
        });
        await tx.movimientoStock.create({
          data: {
            productoId: item.productoId,
            sedeId: item.sedeId,
            tipo: 'SALIDA',
            cantidad: item.cantidad,
            referencia: v.numero,
            usuarioId: req.usuario.id,
          },
        });
      }

      await tx.cotizacion.update({ where: { id: cotizacion.id }, data: { estado: 'ACEPTADA' } });
      return v;
    });

    res.status(201).json(venta);
  } catch (err) {
    next(err);
  }
};

const marcarWhatsapp = async (req, res, next) => {
  try {
    const cot = await prisma.cotizacion.update({
      where: { id: req.params.id },
      data: { whatsappEnviado: true },
    });
    res.json(cot);
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, crear, actualizar, generarPdf, convertirAVenta, marcarWhatsapp };
