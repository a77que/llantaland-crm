const prisma = require('../lib/prisma');

// Límites de fecha para los filtros rápidos "Hoy" / "Ayer"
const inicioHoy  = () => new Date(new Date().setHours(0, 0, 0, 0));
const inicioAyer = () => { const d = inicioHoy(); d.setDate(d.getDate() - 1); return d; };

// Condiciones Prisma para cada tarjeta de contador seleccionable en /leads.
// Se combinan entre sí con OR (selección múltiple: ej. "ayer" + "caliente"
// muestra los leads de ayer junto con todos los calientes).
const CARD_FILTROS = {
  hoy:            () => ({ timestamp: { gte: inicioHoy() } }),
  ayer:           () => ({ timestamp: { gte: inicioAyer(), lt: inicioHoy() } }),
  caliente:       () => ({ ranking: 'caliente' }),
  tibio:          () => ({ ranking: 'tibio' }),
  frio:           () => ({ ranking: 'frio' }),
  no_desea:       () => ({ descartadoEn: { not: null } }),
  con_cotizacion: () => ({ cotizaciones: { some: {} } }),
  sin_cotizacion: () => ({ cotizaciones: { none: {} }, descartadoEn: null }),
};

// Campos permitidos para ordenar
const SORT_FIELDS = {
  nombreCliente:   'nombreCliente',
  telefono:        'telefono',
  medidaDetectada: 'medidaDetectada',
  marcaAuto:       'marcaAuto',
  pasoActual:      'pasoActual',
  ranking:         'ranking',
  updatedAt:       'updatedAt',
  timestamp:       'timestamp',
  fechaCita:       'fechaCita',
};

// Campos seguros para VENDEDOR (sin historial completo)
const LEAD_SELECT_VENDEDOR = {
  id: true, telefono: true, timestamp: true, updatedAt: true,
  pasoActual: true, ranking: true, tipoServicio: true,
  medidaDetectada: true, marcaLlanta: true, modeloLlanta: true,
  precioLlanta: true, cantidadLlantas: true,
  distritoCliente: true, localInstalacion: true, localAsignado: true, provinciaDestino: true,
  estadoLogistica: true, fechaCita: true,
  nombreCliente: true,           // necesario para llamar al cliente
  marcaAuto: true, modeloAuto: true, anioAuto: true,
  intentosMedida: true, emailSeguimientoEnviado: true,
  descartadoEn: true,            // para mostrar el badge "no desea" en la lista
  // EXCLUIDOS para vendedor: dniCe, estadoFlujo, stockMap, ofertaPrecios, hashMensaje
};

const listar = async (req, res, next) => {
  try {
    const { paso, ranking, q, hoy, cards, tipoNegocio, pendientes, page = 1, limit = 50, orderBy, orderDir } = req.query;
    const isAdmin = req.usuario?.rol === 'ADMIN';

    const take = Math.min(parseInt(limit) || 50, 100);
    const skip = (parseInt(page) - 1) * take;

    const sortField = SORT_FIELDS[orderBy] || 'updatedAt';
    const sortDir   = orderDir === 'asc' ? 'asc' : 'desc';

    const where = {};
    const condicionesAnd = [];

    if (tipoNegocio) where.tipoNegocio = tipoNegocio;
    if (paso) where.pasoActual = paso;
    if (ranking) where.ranking = ranking;
    if (hoy === '1' || hoy === 'true') {
      where.timestamp = { gte: inicioHoy() };
    }
    // "Solo pendientes": oculta lo que YA TIENE una cotización real generada
    // (el vendedor ya hizo su trabajo con ese lead — independiente del paso
    // interno del bot) y lo marcado manualmente como "cliente no desea nada".
    // Deja solo lo que realmente falta atender.
    if (pendientes === '1' || pendientes === 'true') {
      condicionesAnd.push({ cotizaciones: { none: {} } });
      condicionesAnd.push({ descartadoEn: null });
    }
    // Tarjetas de contador seleccionadas (selección múltiple, combinadas con OR)
    if (cards) {
      const grupo = String(cards).split(',').map(s => s.trim())
        .map(k => CARD_FILTROS[k]?.()).filter(Boolean);
      if (grupo.length) condicionesAnd.push({ OR: grupo });
    }
    if (q) {
      condicionesAnd.push({
        OR: [
          { telefono: { contains: q } },
          { nombreCliente: { contains: q, mode: 'insensitive' } },
          { medidaDetectada: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (condicionesAnd.length) where.AND = condicionesAnd;

    const [leads, total] = await Promise.all([
      prisma.leadCRM.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: sortDir },
        ...(isAdmin ? {
          include: { humanTakeover: true, _count: { select: { historial: true, cotizaciones: true } } },
        } : {
          select: { ...LEAD_SELECT_VENDEDOR, humanTakeover: true, _count: { select: { historial: true, cotizaciones: true } } },
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

    // ¿El cliente ya ELIGIÓ marcas y el bot le mostró esos precios? Solo en ese
    // caso se ofrece la cotización anticipada (también al vendedor, que no ve
    // el JSON en crudo).
    let _elegidas = 0;
    try {
      const o = typeof lead.llantasElegidas === 'string' ? JSON.parse(lead.llantasElegidas) : lead.llantasElegidas;
      if (o && Array.isArray(o.items)) _elegidas = o.items.length;
    } catch { _elegidas = 0; }
    lead.llantasConsultadas = _elegidas;

    if (!isAdmin) {
      delete lead.dniCe;
      delete lead.estadoFlujo;
      delete lead.stockMap;
      delete lead.ofertaPrecios;
      delete lead.llantasElegidas;
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

// Campos que puede editar un vendedor (todos los que muestra el formulario)
const CAMPOS_VENDEDOR = [
  'pasoActual', 'nombreCliente', 'dniCe',
  'marcaAuto', 'modeloAuto', 'anioAuto',
  'medidaDetectada', 'marcaLlanta', 'modeloLlanta', 'cantidadLlantas',
  'distritoCliente', 'provinciaDestino',
  'fechaCita', 'estadoLogistica',
  'ranking', 'tipoServicio',
];

// Campos enum que Prisma no acepta como string vacío
const ENUM_FIELDS = new Set(['pasoActual', 'ranking', 'tipoDoc', 'caso', 'rankingLead']);

// Campos requeridos (no pueden ser null en la DB)
const CAMPOS_REQUERIDOS = new Set(['pasoActual', 'cantidadLlantas', 'intentosMedida', 'emailSeguimientoEnviado']);

const actualizar = async (req, res, next) => {
  try {
    const isAdmin = req.usuario?.rol === 'ADMIN';
    const raw = isAdmin
      ? req.body
      : Object.fromEntries(Object.entries(req.body).filter(([k]) => CAMPOS_VENDEDOR.includes(k)));

    if (Object.keys(raw).length === 0) return res.status(403).json({ error: 'Sin campos permitidos para actualizar' });

    // Construir el objeto de datos para Prisma
    const data = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === undefined) continue;

      if (v === '' || v === null) {
        // Campos requeridos: no enviar null (mantener valor actual en DB)
        if (CAMPOS_REQUERIDOS.has(k)) continue;
        data[k] = null;
      } else if (k === 'anioAuto' || k === 'cantidadLlantas' || k === 'intentosMedida') {
        const num = parseInt(v);
        if (!isNaN(num)) data[k] = num;
      } else {
        data[k] = v;
      }
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Sin datos válidos para actualizar' });

    const lead = await prisma.leadCRM.update({ where: { id: req.params.id }, data });
    res.json(lead);
  } catch (err) {
    // Mostrar mensaje de error específico para facilitar debugging
    const msg = err.message?.includes('Argument') ? 'Error de validación: ' + err.message.slice(0, 200) : undefined;
    next(msg ? { status: 400, message: msg } : err);
  }
};

// El vendedor confirma que el cliente no desea nada: se marca como descartado
// (sale de "pendientes por atender") y se resetea el paso al inicio — si el
// cliente vuelve a escribir por WhatsApp más adelante, el bot empieza fresco.
const marcarNoDesea = async (req, res, next) => {
  try {
    const lead = await prisma.leadCRM.update({
      where: { id: req.params.id },
      data: { descartadoEn: new Date(), pasoActual: 'nuevo' },
    });
    res.json(lead);
  } catch (err) {
    next(err);
  }
};

// Deshace la marca anterior (por si fue un error del vendedor)
const desmarcarNoDesea = async (req, res, next) => {
  try {
    const lead = await prisma.leadCRM.update({
      where: { id: req.params.id },
      data: { descartadoEn: null },
    });
    res.json(lead);
  } catch (err) {
    next(err);
  }
};

/**
 * El vendedor toma o devuelve la conversación desde el CRM.
 * activo=true  → el bot deja de responder a ese cliente.
 * activo=false → el bot vuelve a atender (igual que enviar /bot por WhatsApp).
 * Es el control manual: no depende de que WhatsApp avise que el vendedor escribió.
 */
const tomarConversacion = async (req, res, next) => {
  try {
    const activo = req.body?.activo !== false;
    const lead = await prisma.leadCRM.findUnique({
      where: { id: req.params.id },
      select: { id: true, telefono: true },
    });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const ht = await prisma.humanTakeover.upsert({
      where: { telefono: lead.telefono },
      update: { agenteActivo: activo, timestampUltimoAgente: activo ? new Date() : null },
      create: {
        leadId: lead.id,
        telefono: lead.telefono,
        agenteActivo: activo,
        timestampUltimoAgente: activo ? new Date() : null,
      },
    });
    res.json({ ok: true, agenteActivo: ht.agenteActivo, humanTakeover: ht });
  } catch (err) {
    next(err);
  }
};

/**
 * Genera una cotización a partir de las llantas que el bot ya le mostró al
 * cliente por WhatsApp y que quedaron sin elegir (lead.ofertaPrecios).
 *
 * Son OPCIONES, no ítems que se suman: por eso se marca esConsulta y en el
 * documento se muestra, por cada llanta, el precio por llevar 1 y el total por
 * llevar 4 con el descuento del sistema ya aplicado.
 *
 * Descuento por traslado: el costo de traslado va incluido en el precio de cada
 * llanta. Al llevar varias, un solo viaje las trae todas, así que se descuenta
 * ese costo por cada llanta a partir de la segunda (misma regla que usa el bot
 * cuando aún no hay local elegido).
 */
const PCT_TRANSFERENCIA = 0.05;
const CANT_REFERENCIA = 4;
const normNombre = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const cotizarConsulta = async (req, res, next) => {
  try {
    const lead = await prisma.leadCRM.findUnique({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    // Solo se cotiza lo que el cliente ELIGIÓ por marca (no todas las de la medida).
    let elegidas = lead.llantasElegidas;
    if (typeof elegidas === 'string') {
      try { elegidas = JSON.parse(elegidas); } catch { elegidas = null; }
    }
    const opciones = elegidas && Array.isArray(elegidas.items) ? elegidas.items : [];
    if (opciones.length === 0) {
      return res.status(400).json({ error: 'El cliente todavía no eligió ninguna marca. Aún no hay llantas específicas para cotizar.' });
    }

    // Costo de traslado configurado en Precios y Margen (por defecto 30).
    const costos = await prisma.costoVenta.findMany();
    const cTraslado = costos.find(c => normNombre(c.nombre) === 'traslado');
    const montoTraslado = cTraslado ? (Number(cTraslado.valor) || 0) : 30;

    const medida = lead.medidaDetectada || null;
    const items = opciones.map(o => {
      const precioUnit = Number(o.precio_oferta ?? o.precioOferta ?? o.precio ?? 0) || 0;
      const brutoCuatro = precioUnit * CANT_REFERENCIA;
      const descTraslado = montoTraslado * (CANT_REFERENCIA - 1);
      const totalCuatro = Math.max(0, brutoCuatro - descTraslado);
      return {
        marca: o.marca || null,
        modelo: o.modelo || o.nombre_comercial || o.nombreComercial || null,
        medida: o.medida || medida,
        grupo: o.grupo || null,
        sku: o.sku || null,
        cantidad: 1,
        precioUnit: Number(precioUnit.toFixed(2)),
        // Referencias que se muestran en el documento
        totalCuatro: Number(totalCuatro.toFixed(2)),
        totalCuatroTransferencia: Number((totalCuatro * (1 - PCT_TRANSFERENCIA)).toFixed(2)),
        unoTransferencia: Number((precioUnit * (1 - PCT_TRANSFERENCIA)).toFixed(2)),
      };
    }).filter(i => i.precioUnit > 0);

    if (items.length === 0) {
      return res.status(400).json({ error: 'Las llantas consultadas no tienen precio válido.' });
    }

    // Referencia para los listados: la opción más económica.
    const masBarata = items.reduce((a, b) => (b.precioUnit < a.precioUnit ? b : a), items[0]);

    const count = await prisma.cotizacion.count();
    const numero = `COT-${String(count + 1).padStart(5, '0')}`;

    const notas = [
      'Cotización de las llantas que el cliente consultó por WhatsApp (opciones a elegir, no se suman).',
      `Precio por llevar 1 llanta y total por llevar ${CANT_REFERENCIA}, con el descuento por traslado ya aplicado.`,
      'Pagando por transferencia bancaria se descuenta 5% adicional.',
      'El local de instalación se define al momento de la compra. Precios sujetos a stock.',
    ].join('\n');

    const cot = await prisma.cotizacion.create({
      data: {
        numero,
        esConsulta: true,
        estado: 'BORRADOR',
        leadId: lead.id,
        usuarioId: req.usuario.id,
        telefonoCliente: lead.telefono,
        nombreCliente: lead.nombreCliente || null,
        dniCe: lead.dniCe || null,
        marcaAuto: lead.marcaAuto || null,
        modeloAuto: lead.modeloAuto || null,
        anioAuto: lead.anioAuto || null,
        medidaLlanta: medida,
        marcaLlanta: masBarata.marca,
        modeloLlanta: masBarata.modelo,
        cantidad: 1,
        precioUnit: masBarata.precioUnit,
        precioTotal: masBarata.totalCuatro,   // referencia "desde" en los listados
        items,
        notas,
      },
    });

    res.status(201).json(cot);
  } catch (err) {
    next(err);
  }
};

const resumen = async (req, res, next) => {
  try {
    const { tipoNegocio } = req.query;
    const where = tipoNegocio ? { tipoNegocio } : {};
    const hoyInicio  = inicioHoy();
    const ayerInicio = inicioAyer();
    const [porPaso, porRanking, total, hoy, ayer, noDesea, conCotizacion, sinCotizacion] = await Promise.all([
      prisma.leadCRM.groupBy({ by: ['pasoActual'], _count: true, where }),
      prisma.leadCRM.groupBy({ by: ['ranking'], _count: true, where }),
      prisma.leadCRM.count({ where }),
      prisma.leadCRM.count({ where: { ...where, timestamp: { gte: hoyInicio } } }),
      prisma.leadCRM.count({ where: { ...where, timestamp: { gte: ayerInicio, lt: hoyInicio } } }),
      prisma.leadCRM.count({ where: { ...where, descartadoEn: { not: null } } }),
      prisma.leadCRM.count({ where: { ...where, cotizaciones: { some: {} } } }),
      prisma.leadCRM.count({ where: { ...where, cotizaciones: { none: {} }, descartadoEn: null } }),
    ]);
    res.json({ porPaso, porRanking, total, hoy, ayer, noDesea, conCotizacion, sinCotizacion });
  } catch (err) {
    next(err);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const lead = await prisma.leadCRM.findUnique({
      where: { id: req.params.id },
      select: { id: true, telefono: true, nombreCliente: true,
        _count: { select: { ventas: true, cotizaciones: true } } },
    });
    if (!lead) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Advertir si tiene ventas o cotizaciones
    const totalRegistros = lead._count.ventas + lead._count.cotizaciones;
    if (totalRegistros > 0) {
      // Desvincular ventas y cotizaciones antes de eliminar (SetNull por schema)
      // El onDelete: SetNull en Venta y Cotizacion ya lo maneja Prisma automáticamente
    }

    await prisma.leadCRM.delete({ where: { id: req.params.id } });
    res.json({
      ok: true,
      mensaje: `Cliente ${lead.nombreCliente || lead.telefono} eliminado`,
      registrosAfectados: totalRegistros,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, obtenerPorTelefono, actualizar, eliminar, resumen, marcarNoDesea, desmarcarNoDesea, tomarConversacion, cotizarConsulta };
