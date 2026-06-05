const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Campos seguros para VENDEDOR (sin historial completo)
const LEAD_SELECT_VENDEDOR = {
  id: true, telefono: true, timestamp: true, updatedAt: true,
  pasoActual: true, ranking: true, tipoServicio: true,
  medidaDetectada: true, marcaLlanta: true, modeloLlanta: true,
  precioLlanta: true, cantidadLlantas: true,
  distritoCliente: true, localInstalacion: true,
  estadoLogistica: true, fechaCita: true,
  nombreCliente: true,           // necesario para llamar al cliente
  marcaAuto: true, modeloAuto: true, anioAuto: true,
  intentosMedida: true, emailSeguimientoEnviado: true,
  // EXCLUIDOS para vendedor: dniCe, estadoFlujo, stockMap, ofertaPrecios, hashMensaje
};

const listar = async (req, res, next) => {
  try {
    const { paso, ranking, q, page = 1, limit = 50 } = req.query;
    const isAdmin = req.usuario?.rol === 'ADMIN';

    // Forzar máximo 100 registros para evitar extracción masiva
    const take = Math.min(parseInt(limit) || 50, 100);
    const skip = (parseInt(page) - 1) * take;

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
        take,
        // Admin ve todo; vendedor ve campos filtrados
        ...(isAdmin ? {
          include: { humanTakeover: true, _count: { select: { historial: true } } },
        } : {
          select: { ...LEAD_SELECT_VENDEDOR, humanTakeover: true, _count: { select: { historial: true } } },
        }),
      }),
      prisma.leadCRM.count({ where }),
    ]);

    res.json({ leads, total, page: parseInt(page), limit: take });
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const isAdmin = req.usuario?.rol === 'ADMIN';

    const lead = await prisma.leadCRM.findUnique({
      where: { id: req.params.id },
      include: {
        humanTakeover: true,
        historial: isAdmin
          ? { orderBy: { timestamp: 'asc' }, take: 200 }
          : { orderBy: { timestamp: 'asc' }, take: 50, select: { id: true, rol: true, mensaje: true, timestamp: true, pasoActual: true } },
        // Historial completo de cotizaciones del cliente
        cotizaciones: {
          orderBy: { createdAt: 'desc' },
          include: { usuario: { select: { nombre: true } }, venta: { select: { id: true, numero: true, estado: true } } },
        },
        // Historial completo de ventas del cliente
        ventas: {
          orderBy: { createdAt: 'desc' },
          include: { usuario: { select: { nombre: true } } },
        },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (!isAdmin) {
      delete lead.dniCe;
      delete lead.estadoFlujo;
      delete lead.stockMap;
      delete lead.ofertaPrecios;
      delete lead.hashMensaje;
      delete lead.respuestaBot;
    }

    res.json(lead);
  } catch (err) {
    next(err);
  }
};

const obtenerPorTelefono = async (req, res, next) => {
  try {
    const isAdmin = req.usuario?.rol === 'ADMIN';

    const lead = await prisma.leadCRM.findUnique({
      where: { telefono: req.params.telefono },
      include: {
        humanTakeover: true,
        historial: {
          orderBy: { timestamp: 'asc' },
          take: isAdmin ? 100 : 30,
          select: { id: true, rol: true, mensaje: true, timestamp: true },
        },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    if (!isAdmin) {
      delete lead.dniCe;
      delete lead.estadoFlujo;
      delete lead.stockMap;
      delete lead.hashMensaje;
    }

    res.json(lead);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    // Vendedor solo puede actualizar campos no sensibles
    const isAdmin = req.usuario?.rol === 'ADMIN';
    const CAMPOS_VENDEDOR = ['pasoActual', 'nombreCliente', 'marcaAuto', 'modeloAuto', 'anioAuto', 'fechaCita', 'estadoLogistica', 'notas'];

    const data = isAdmin
      ? req.body
      : Object.fromEntries(Object.entries(req.body).filter(([k]) => CAMPOS_VENDEDOR.includes(k)));

    if (Object.keys(data).length === 0) return res.status(403).json({ error: 'Sin campos permitidos para actualizar' });

    const lead = await prisma.leadCRM.update({ where: { id: req.params.id }, data });
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
      prisma.leadCRM.count({ where: { timestamp: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
    ]);
    res.json({ porPaso, porRanking, total, hoy });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, obtenerPorTelefono, actualizar, resumen };
