const pdfService = require('../services/pdfService');
const prisma = require('../lib/prisma');

// Pasos que indican que el cliente eligió una tienda en Lima o colocó una provincia
// (negocio Llantas) o ya cotizó un show (negocio Patrón)
const CITAS_PASOS = [
  'lima_lista',
  'esperando_eleccion_b',
  'esperando_local_destino',
  'esperando_datos_cliente',
  'esperando_confirmacion',
  'completado',
  'cotizado',
];

function parseJsonField(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

// Deriva el estado de la cita: RECIBIDO (llega de leads) → ATENDIDO (vendedor agenda
// fecha/hora/local) → ENTREGADO (sistema, cuando hay venta con comprobante).
function derivarEstadoCita(lead) {
  if (lead.estadoCita === 'ENTREGADO') return 'ENTREGADO';
  const tieneVentaEntregada = (lead.ventas || []).some(v => v.estado === 'COMPLETADA' || (v.comprobantes && v.comprobantes.length > 0));
  if (tieneVentaEntregada) return 'ENTREGADO';
  if (lead.estadoCita === 'ATENDIDO' || lead.fechaInstalacion) return 'ATENDIDO';
  return lead.estadoCita || 'RECIBIDO';
}

function stockEnLocalElegido(lead) {
  const local =
    parseJsonField(lead.localInstalacion) ||
    parseJsonField(lead.localAsignado);

  // listarLocales devuelve { ID, Nombre, ... } — probar 'ID' primero, luego variantes camelCase
  const codigo = local?.ID || local?.codigoLocal || local?.codigo_local || local?.local_codigo || null;
  if (!codigo || !lead.stockMap || typeof lead.stockMap !== 'object') return null;

  // listarPrecios guarda Stock_L1_SantaAnita y también Stock_L1 (clave corta)
  const qty = lead.stockMap[`Stock_${codigo}`] ?? lead.stockMap[codigo];
  return qty !== undefined ? Number(qty) : null;
}

const listar = async (req, res, next) => {
  try {
    const { q, estado, rango, tipoNegocio, page = 1, limit = 50, orderBy, orderDir } = req.query;

    const take = Math.min(parseInt(limit) || 50, 100);
    const skip = (parseInt(page) - 1) * take;

    const SORT = {
      updatedAt: 'updatedAt', timestamp: 'timestamp',
      nombreCliente: 'nombreCliente', telefono: 'telefono',
      pasoActual: 'pasoActual', ranking: 'ranking',
      fechaInstalacion: 'fechaInstalacion', estadoCita: 'estadoCita',
    };
    const sortField = SORT[orderBy] || 'updatedAt';
    const sortDir   = orderDir === 'asc' ? 'asc' : 'desc';

    const where = { pasoActual: { in: CITAS_PASOS } };
    if (tipoNegocio) where.tipoNegocio = tipoNegocio;

    // Filtro por rango de fecha de instalación: hoy | manana
    if (rango === 'hoy' || rango === 'manana') {
      const base = new Date();
      if (rango === 'manana') base.setDate(base.getDate() + 1);
      const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      const fin    = new Date(inicio); fin.setDate(fin.getDate() + 1);
      where.fechaInstalacion = { gte: inicio, lt: fin };
    }
    if (q) {
      where.AND = [{
        OR: [
          { telefono:      { contains: q } },
          { nombreCliente: { contains: q, mode: 'insensitive' } },
          { dniCe:         { contains: q, mode: 'insensitive' } },
        ],
      }];
    }

    const [leads, total] = await Promise.all([
      prisma.leadCRM.findMany({
        where, skip, take,
        orderBy: { [sortField]: sortDir },
        select: {
          id: true, telefono: true, timestamp: true, updatedAt: true,
          pasoActual: true, ranking: true,
          nombreCliente: true, dniCe: true,
          medidaDetectada: true, marcaLlanta: true, modeloLlanta: true,
          precioLlanta: true, cantidadLlantas: true,
          provinciaDestino: true, distritoCliente: true,
          localInstalacion: true, localAsignado: true, stockMap: true,
          tipoServicio: true, fechaCita: true,
          estadoCita: true, fechaInstalacion: true, horaInstalacion: true, origenCita: true,
          marcaAuto: true, modeloAuto: true, anioAuto: true,
          ventas: { select: { id: true, numero: true, estado: true, comprobantes: { select: { id: true } } } },
          _count: { select: { cotizaciones: true, ventas: true } },
          cotizaciones: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true, numero: true, estado: true,
              precioUnit: true, precioTotal: true, cantidad: true,
              medidaLlanta: true, marcaLlanta: true, modeloLlanta: true,
              nombreCliente: true, dniCe: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.leadCRM.count({ where }),
    ]);

    let citasConInfo = leads.map(l => {
      const cotReciente = l.cotizaciones?.[0] || null;
      const tieneCot    = (l._count?.cotizaciones || 0) > 0;

      const localElegido = parseJsonField(l.localInstalacion) || parseJsonField(l.localAsignado) || null;

      // Precio: desde cotización si existe, si no desde el lead
      const precioUnit  = cotReciente ? parseFloat(cotReciente.precioUnit  || 0) : (l.precioLlanta  ? parseFloat(l.precioLlanta) : null);
      const cantidad    = cotReciente ? (cotReciente.cantidad  || 1)              : (l.cantidadLlantas || 1);
      const precioTotal = cotReciente ? parseFloat(cotReciente.precioTotal || 0)  : (precioUnit ? precioUnit * cantidad : null);

      const { ventas, ...leadSinVentas } = l;
      return {
        ...leadSinVentas,
        estadoCitaCalc: derivarEstadoCita(l),
        stockEnLocal: stockEnLocalElegido(l),
        localElegido,
        tipoVenta: tieneCot ? 'CRM' : 'WhatsApp',
        cotizacion: cotReciente,
        precioUnitCalc:  precioUnit,
        cantidadCalc:    cantidad,
        precioTotalCalc: precioTotal,
      };
    });

    // Filtro por estado de cita (se calcula post-query porque es derivado)
    if (estado) citasConInfo = citasConInfo.filter(c => c.estadoCitaCalc === estado);

    res.json({ citas: citasConInfo, total: estado ? citasConInfo.length : total, page: parseInt(page), limit: take });
  } catch (err) {
    next(err);
  }
};

// Polling ligero para notificaciones
const poll = async (req, res, next) => {
  try {
    const { tipoNegocio } = req.query;
    const where = { pasoActual: { in: CITAS_PASOS } };
    if (tipoNegocio) where.tipoNegocio = tipoNegocio;
    const citas = await prisma.leadCRM.findMany({
      where,
      select: { id: true, updatedAt: true, pasoActual: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    res.json({ ids: citas.map(c => c.id), pasos: Object.fromEntries(citas.map(c => [c.id, c.pasoActual])) });
  } catch (err) {
    next(err);
  }
};

// Agendar / actualizar la cita: el vendedor pone fecha, hora y local → pasa a ATENDIDO
const actualizar = async (req, res, next) => {
  try {
    const { fechaInstalacion, horaInstalacion, localInstalacion, estadoCita } = req.body;
    const data = {};
    if (fechaInstalacion !== undefined) data.fechaInstalacion = fechaInstalacion ? new Date(fechaInstalacion) : null;
    if (horaInstalacion  !== undefined) data.horaInstalacion  = horaInstalacion || null;
    if (localInstalacion !== undefined) data.localInstalacion = localInstalacion || null;
    if (estadoCita       !== undefined) data.estadoCita       = estadoCita;

    // Si agenda fecha y no hay estado explícito, pasa a ATENDIDO
    if (data.fechaInstalacion && estadoCita === undefined) data.estadoCita = 'ATENDIDO';

    const lead = await prisma.leadCRM.update({ where: { id: req.params.id }, data });
    res.json({ ok: true, cita: lead });
  } catch (err) {
    next(err);
  }
};

// Genera un PDF de la cita por cliente. Si la cita tiene una cotización, usa esa;
// si no, sintetiza el documento desde los datos del lead/cita.
const generarPdf = async (req, res, next) => {
  try {
    const lead = await prisma.leadCRM.findUnique({
      where: { id: req.params.id },
      include: { cotizaciones: { orderBy: { createdAt: 'desc' }, take: 1, include: { usuario: { select: { nombre: true } } } } },
    });
    if (!lead) return res.status(404).json({ error: 'Cita no encontrada' });

    let cot = lead.cotizaciones?.[0] || null;
    if (!cot) {
      // Documento sintetizado a partir de los datos de la cita/lead
      const cant = lead.cantidadLlantas || 1;
      const pUnit = lead.precioLlanta ? parseFloat(lead.precioLlanta) : 0;
      cot = {
        numero: `CITA-${String(lead.id).slice(-6).toUpperCase()}`,
        createdAt: new Date(),
        estado: 'BORRADOR',
        usuario: { nombre: req.usuario?.nombre || '' },
        nombreCliente: lead.nombreCliente, telefonoCliente: lead.telefono, dniCe: lead.dniCe,
        marcaAuto: lead.marcaAuto, modeloAuto: lead.modeloAuto, anioAuto: lead.anioAuto,
        medidaLlanta: lead.medidaDetectada, marcaLlanta: lead.marcaLlanta, modeloLlanta: lead.modeloLlanta,
        cantidad: cant, precioUnit: pUnit, precioTotal: pUnit * cant,
        fechaInstalacion: lead.fechaInstalacion, horaInstalacion: lead.horaInstalacion,
        localInstalacion: lead.localInstalacion || lead.localAsignado || null,
        provinciaDestino: lead.provinciaDestino, fechaCita: lead.fechaCita,
        notas: null, items: null,
      };
    }
    const filename = await pdfService.generarCotizacion(cot);
    res.json({ pdfUrl: `/uploads/${filename}` });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, poll, actualizar, generarPdf, derivarEstadoCita, CITAS_PASOS };
