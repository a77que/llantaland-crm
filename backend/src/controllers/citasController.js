const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Pasos que indican que el cliente eligió una tienda en Lima o colocó una provincia
const CITAS_PASOS = [
  'lima_lista',
  'esperando_eleccion_b',
  'esperando_local_destino',
  'esperando_datos_cliente',
  'esperando_confirmacion',
  'completado',
];

function parseJsonField(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
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
    const { q, page = 1, limit = 50, orderBy, orderDir } = req.query;

    const take = Math.min(parseInt(limit) || 50, 100);
    const skip = (parseInt(page) - 1) * take;

    const SORT = {
      updatedAt: 'updatedAt', timestamp: 'timestamp',
      nombreCliente: 'nombreCliente', telefono: 'telefono',
      pasoActual: 'pasoActual', ranking: 'ranking',
    };
    const sortField = SORT[orderBy] || 'updatedAt';
    const sortDir   = orderDir === 'asc' ? 'asc' : 'desc';

    const where = { pasoActual: { in: CITAS_PASOS } };
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
          marcaAuto: true, modeloAuto: true, anioAuto: true,
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

    const citasConInfo = leads.map(l => {
      const cotReciente = l.cotizaciones?.[0] || null;
      const tieneCot    = (l._count?.cotizaciones || 0) > 0;

      const localElegido = parseJsonField(l.localInstalacion) || parseJsonField(l.localAsignado) || null;

      // Precio: desde cotización si existe, si no desde el lead
      const precioUnit  = cotReciente ? parseFloat(cotReciente.precioUnit  || 0) : (l.precioLlanta  ? parseFloat(l.precioLlanta) : null);
      const cantidad    = cotReciente ? (cotReciente.cantidad  || 1)              : (l.cantidadLlantas || 1);
      const precioTotal = cotReciente ? parseFloat(cotReciente.precioTotal || 0)  : (precioUnit ? precioUnit * cantidad : null);

      return {
        ...l,
        stockEnLocal: stockEnLocalElegido(l),
        localElegido,
        tipoVenta: tieneCot ? 'CRM' : 'WhatsApp',
        cotizacion: cotReciente,
        precioUnitCalc:  precioUnit,
        cantidadCalc:    cantidad,
        precioTotalCalc: precioTotal,
      };
    });

    res.json({ citas: citasConInfo, total, page: parseInt(page), limit: take });
  } catch (err) {
    next(err);
  }
};

// Polling ligero para notificaciones
const poll = async (req, res, next) => {
  try {
    const citas = await prisma.leadCRM.findMany({
      where: { pasoActual: { in: CITAS_PASOS } },
      select: { id: true, updatedAt: true, pasoActual: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    res.json({ ids: citas.map(c => c.id), pasos: Object.fromEntries(citas.map(c => [c.id, c.pasoActual])) });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, poll, CITAS_PASOS };
