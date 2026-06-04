const { PrismaClient } = require('@prisma/client');
const { paginar } = require('../utils/helpers');
const pdfService = require('../services/pdfService');
const prisma = new PrismaClient();

const listar = async (req, res, next) => {
  try {
    const { estado, leadId, page, limit } = req.query;
    const { skip, take } = paginar(page, limit);
    const isAdmin = req.usuario?.rol === 'ADMIN';
    const where = {};
    if (estado) where.estado = estado;
    if (leadId) where.leadId = leadId;
    // Vendedor solo ve sus propias cotizaciones
    if (!isAdmin) where.usuarioId = req.usuario.id;

    const [total, cotizaciones] = await Promise.all([
      prisma.cotizacion.count({ where }),
      prisma.cotizacion.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          usuario: { select: { nombre: true } },
          lead:    { select: { telefono: true } },
          venta:   { select: { id: true, numero: true } },
        },
      }),
    ]);
    res.json({ total, page: parseInt(page) || 1, limit: take, data: cotizaciones });
  } catch (err) { next(err); }
};

const obtener = async (req, res, next) => {
  try {
    const cot = await prisma.cotizacion.findUnique({
      where: { id: req.params.id },
      include: {
        usuario: { select: { nombre: true, email: true } },
        lead:    true,
        venta:   { select: { id: true, numero: true, estado: true } },
      },
    });
    if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(cot);
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    const {
      leadId, medidaLlanta, marcaLlanta, modeloLlanta,
      cantidad, precioUnit, descuento, notas,
      nombreCliente, dniCe, telefonoCliente, marcaAuto, modeloAuto, anioAuto,
    } = req.body;

    const qty   = parseInt(cantidad || 1);
    const pUnit = parseFloat(precioUnit || 0);
    const desc  = descuento ? parseFloat(descuento) : 0;

    // Validaciones de integridad
    if (qty <= 0)   return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
    if (pUnit < 0)  return res.status(400).json({ error: 'Precio no puede ser negativo' });
    if (pUnit === 0 && req.body.estado !== 'BORRADOR') {
      return res.status(400).json({ error: 'Precio requerido para cotización confirmada' });
    }
    if (desc < 0)   return res.status(400).json({ error: 'Descuento no puede ser negativo' });
    if (desc > pUnit * qty) return res.status(400).json({ error: 'Descuento no puede superar el total' });

    const total = Math.max(0, (pUnit * qty) - desc);

    const count  = await prisma.cotizacion.count();
    const numero = `COT-${String(count + 1).padStart(5, '0')}`;

    // Snapshot del lead si existe
    let leadData = {};
    if (leadId) {
      const lead = await prisma.leadCRM.findUnique({ where: { id: leadId } });
      if (lead) leadData = {
        telefonoCliente: lead.telefono,
        nombreCliente:   lead.nombreCliente,
        dniCe:           lead.dniCe,
        marcaAuto:       lead.marcaAuto,
        modeloAuto:      lead.modeloAuto,
        anioAuto:        lead.anioAuto,
        medidaLlanta:    medidaLlanta || lead.medidaDetectada,
        marcaLlanta:     marcaLlanta  || lead.marcaLlanta,
        modeloLlanta:    modeloLlanta || lead.modeloLlanta,
      };
    }

    const cot = await prisma.cotizacion.create({
      data: {
        numero,
        leadId:          leadId || null,
        usuarioId:       req.usuario.id,
        nombreCliente:   nombreCliente   || leadData.nombreCliente   || null,
        dniCe:           dniCe           || leadData.dniCe           || null,
        telefonoCliente: telefonoCliente || leadData.telefonoCliente || null,
        marcaAuto:       marcaAuto       || leadData.marcaAuto       || null,
        modeloAuto:      modeloAuto      || leadData.modeloAuto      || null,
        anioAuto:        anioAuto ? parseInt(anioAuto) : (leadData.anioAuto || null),
        medidaLlanta:    medidaLlanta    || leadData.medidaLlanta    || null,
        marcaLlanta:     marcaLlanta     || leadData.marcaLlanta     || null,
        modeloLlanta:    modeloLlanta    || leadData.modeloLlanta    || null,
        cantidad: qty, precioUnit: pUnit,
        descuento: desc > 0 ? desc : null,
        precioTotal: total,
        notas: notas || null,
        estado: 'BORRADOR',
      },
      include: { usuario: { select: { nombre: true } } },
    });
    res.status(201).json(cot);
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const { cantidad, precioUnit, descuento, ...rest } = req.body;
    const data = { ...rest };
    if (cantidad !== undefined) data.cantidad = parseInt(cantidad);
    if (precioUnit !== undefined) data.precioUnit = parseFloat(precioUnit);
    if (descuento !== undefined) data.descuento = parseFloat(descuento) || null;
    // Recalcular total si cambian precio/cantidad
    const cot = await prisma.cotizacion.findUnique({ where: { id: req.params.id }, select: { cantidad: true, precioUnit: true, descuento: true } });
    if (cot) {
      const qty  = data.cantidad   ?? cot.cantidad;
      const pUnit = data.precioUnit ?? parseFloat(cot.precioUnit);
      const disc  = data.descuento  ?? (cot.descuento ? parseFloat(cot.descuento) : 0);
      data.precioTotal = Math.max(0, pUnit * qty - disc);
    }

    const updated = await prisma.cotizacion.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (err) { next(err); }
};

const convertirAVenta = async (req, res, next) => {
  try {
    const cot = await prisma.cotizacion.findUnique({ where: { id: req.params.id }, include: { lead: true } });
    if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });
    if (cot.venta) return res.status(400).json({ error: 'Esta cotización ya tiene una venta asociada' });

    const count  = await prisma.venta.count();
    const numero = `VTA-${String(count + 1).padStart(5, '0')}`;

    const venta = await prisma.$transaction(async (tx) => {
      const v = await tx.venta.create({
        data: {
          numero,
          cotizacionId:    cot.id,
          leadId:          cot.leadId,
          usuarioId:       req.usuario.id,
          telefonoCliente: cot.telefonoCliente,
          nombreCliente:   cot.nombreCliente,
          dniCe:           cot.dniCe,
          marcaAuto:       cot.marcaAuto,
          modeloAuto:      cot.modeloAuto,
          anioAuto:        cot.anioAuto,
          medidaLlanta:    cot.medidaLlanta,
          marcaLlanta:     cot.marcaLlanta,
          modeloLlanta:    cot.modeloLlanta,
          cantidad:        cot.cantidad,
          precioUnit:      cot.precioUnit,
          precioTotal:     cot.precioTotal,
          tipoVenta:       cot.leadId ? 'whatsapp' : 'tienda',
          estado:          'PENDIENTE',
        },
      });
      await tx.cotizacion.update({ where: { id: cot.id }, data: { estado: 'CONVERTIDA' } });
      if (cot.leadId) {
        await tx.leadCRM.update({ where: { id: cot.leadId }, data: { pasoActual: 'completado' } });
      }
      return v;
    });

    res.json({ ventaId: venta.id, numero: venta.numero });
  } catch (err) { next(err); }
};

const generarPdf = async (req, res, next) => {
  try {
    const cot = await prisma.cotizacion.findUnique({
      where: { id: req.params.id },
      include: { usuario: { select: { nombre: true } } },
    });
    if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });
    const filename = await pdfService.generarCotizacion(cot);
    res.json({ pdfUrl: `/uploads/${filename}` });
  } catch (err) { next(err); }
};

module.exports = { listar, obtener, crear, actualizar, convertirAVenta, generarPdf };
