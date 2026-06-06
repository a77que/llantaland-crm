const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Pasos que indican que el cliente eligió una tienda en Lima o colocó una provincia
const CITAS_PASOS = [
  'lima_lista',            // eligió Lima, viendo lista de locales
  'esperando_datos_cliente', // ya eligió local o provincia, dando sus datos
  'esperando_confirmacion',  // datos dados, esperando confirmación final
  'completado',              // flujo completo
];

// Calcular stock en el local elegido a partir de los JSON del lead
function stockEnLocalElegido(lead) {
  const local =
    (lead.localInstalacion && typeof lead.localInstalacion === 'object' ? lead.localInstalacion : null) ||
    (lead.localAsignado   && typeof lead.localAsignado   === 'object' ? lead.localAsignado   : null);

  const codigo = local?.codigoLocal || local?.codigo_local || local?.local_codigo || null;
  if (!codigo || !lead.stockMap || typeof lead.stockMap !== 'object') return null;

  const qty = lead.stockMap[codigo];
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
        },
      }),
      prisma.leadCRM.count({ where }),
    ]);

    // Añadir info de stock en local elegido
    const citasConStock = leads.map(l => ({
      ...l,
      stockEnLocal: stockEnLocalElegido(l),
      localElegido:
        (l.localInstalacion && typeof l.localInstalacion === 'object' ? l.localInstalacion : null) ||
        (l.localAsignado   && typeof l.localAsignado   === 'object' ? l.localAsignado   : null) ||
        null,
    }));

    res.json({ citas: citasConStock, total, page: parseInt(page), limit: take });
  } catch (err) {
    next(err);
  }
};

// Para el polling de notificaciones: sólo IDs y timestamps
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
