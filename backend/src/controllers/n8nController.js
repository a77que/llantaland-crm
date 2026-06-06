/**
 * API exclusiva para el flujo n8n — reemplaza Google Sheets.
 * Cada endpoint corresponde a una operación de hoja del flujo.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── CRM SHEET ───────────────────────────────────────────────────────────────

/** LECTURA CRM | Base* — lee el registro del cliente por teléfono */
const leerCRM = async (req, res, next) => {
  try {
    const { telefono } = req.params;
    const lead = await prisma.leadCRM.findUnique({
      where: { telefono },
      include: { humanTakeover: true },
    });
    // n8n espera siempre un objeto, nunca 404
    res.json(lead ? mapLeadToSheet(lead) : {});
  } catch (err) {
    next(err);
  }
};

/** CRM | Crear Fila Nueva — captura TODOS los datos disponibles del primer mensaje */
const crearCRM = async (req, res, next) => {
  try {
    const b = req.body;
    const tel = b.Telefono || b.telefono || b.telefono_cliente;
    if (!tel) return res.status(400).json({ error: 'Telefono requerido' });

    // Capturar todos los campos del webhook que estén disponibles
    const mensajeInicial = b.texto_mensaje || b.Mensaje_Cliente || b.mensaje || null;
    const tipoMensaje    = b.tipo_mensaje  || b.Tipo_Mensaje   || null;

    // Mapear campos adicionales si vienen del webhook
    const camposExtra = mapSheetToLead(b);

    const lead = await prisma.leadCRM.upsert({
      where: { telefono: tel },
      update: {
        // En actualización solo actualizamos si hay datos nuevos útiles
        mensajeCliente: mensajeInicial || undefined,
        ...camposExtra,
      },
      create: {
        telefono: tel,
        pasoActual: camposExtra.pasoActual || 'nuevo',
        mensajeCliente: mensajeInicial,
        emailSeguimientoEnviado: false,
        timestamp: new Date(),
        // Campos del webhook
        ...camposExtra,
        // Aseguramos que pasoActual siempre tenga un valor inicial
        ...(camposExtra.pasoActual ? {} : { pasoActual: 'nuevo' }),
      },
    });

    res.json(mapLeadToSheet(lead));
  } catch (err) {
    next(err);
  }
};

/** PASO | Guardar ... — actualiza campos del lead según el paso */
const actualizarCRM = async (req, res, next) => {
  try {
    const { telefono } = req.params;
    const data = mapSheetToLead(req.body);

    const lead = await prisma.leadCRM.upsert({
      where: { telefono },
      update: data,
      create: { telefono, ...data },
    });
    res.json(mapLeadToSheet(lead));
  } catch (err) {
    next(err);
  }
};

/** CRM | Resetear Paso_Actual a Nuevo */
const resetearCRM = async (req, res, next) => {
  try {
    const lead = await prisma.leadCRM.update({
      where: { telefono: req.params.telefono },
      data: { pasoActual: 'nuevo' },
    });
    res.json(mapLeadToSheet(lead));
  } catch (err) {
    next(err);
  }
};

// ─── PRECIOS (catálogo) ───────────────────────────────────────────────────────

/** Consultar Catalogo Completo en Sheets */
const listarPrecios = async (req, res, next) => {
  try {
    const { medida } = req.query;
    const where = { activo: true };
    if (medida) where.medida = { equals: medida, mode: 'insensitive' };

    const productos = await prisma.producto.findMany({
      where,
      include: { stocks: { include: { sede: true } } },
      orderBy: [{ medida: 'asc' }, { marca: 'asc' }],
    });

    // Nombres exactos que usa el flujo n8n en MOD | Cruzar Distrito y Stock
    const STOCK_KEY_MAP = {
      'L0': 'Stock_L0_Almacen',
      'L1': 'Stock_L1_SantaAnita',
      'L2': 'Stock_L2_Surco',
      'L3': 'Stock_L3_Surquillo',
      'L4': 'Stock_L4_Miraflores',
      'L5': 'Stock_L5_PuebloLibre',
    };

    const filas = productos.map(p => {
      const stockPorLocal = {};
      p.stocks.forEach(s => {
        const codigo = s.sede?.codigoLocal || '';
        const keyN8n = STOCK_KEY_MAP[codigo];
        if (keyN8n) stockPorLocal[keyN8n] = s.cantidad;
        // Clave corta por si acaso: Stock_L0, Stock_L1, etc.
        stockPorLocal[`Stock_${codigo}`] = s.cantidad;
      });
      return {
        SKU: p.sku,
        Medida: p.medida,
        Marca: p.marca,
        Nombre_Comercial: p.nombreComercial || '',
        Grupo: p.grupo || '',
        Precio_Regular: parseFloat(p.precioRegular),
        Precio_Oferta: p.precioOferta ? parseFloat(p.precioOferta) : null,
        Stock: p.stocks.reduce((sum, s) => sum + s.cantidad, 0),
        Imagen: p.imagenUrl || '',
        ...stockPorLocal,
      };
    });

    res.json(filas);
  } catch (err) {
    next(err);
  }
};

// ─── LOCALES ─────────────────────────────────────────────────────────────────

/** MOD | Consultar Locales Sheets */
const listarLocales = async (req, res, next) => {
  try {
    const sedes = await prisma.sede.findMany({
      where: { activo: true },
      orderBy: { codigoLocal: 'asc' },
    });
    const filas = sedes.map(s => ({
      ID: s.codigoLocal,
      Nombre: s.nombre,
      Tipo: s.tipo,
      Distrito: s.distrito || '',
      Direccion: s.direccion || '',
    }));
    res.json(filas);
  } catch (err) {
    next(err);
  }
};

// ─── HISTORIAL ───────────────────────────────────────────────────────────────

/** HISTORIAL | Guardar Mensaje */
const guardarHistorial = async (req, res, next) => {
  try {
    const { Telefono, telefono, Hash_Mensaje, Rol, rol, Mensaje, mensaje, Paso_Actual, paso_actual } = req.body;
    const tel = Telefono || telefono;
    if (!tel) return res.status(400).json({ error: 'Telefono requerido' });

    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.leadCRM.upsert({
        where: { telefono: tel },
        update: {},
        create: { telefono: tel },
      });

      // Deduplicación dentro de la misma transacción
      if (Hash_Mensaje) {
        const existe = await tx.mensajeHistorial.findUnique({ where: { hashMensaje: Hash_Mensaje } });
        if (existe) return existe;
      }

      return tx.mensajeHistorial.create({
        data: {
          leadId: lead.id,
          telefono: tel,
          hashMensaje: Hash_Mensaje || null,
          rol: Rol || rol || 'cliente',
          mensaje: Mensaje || mensaje || '',
          pasoActual: Paso_Actual || paso_actual || null,
        },
      });
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/** HISTORIAL | Leer Mensajes Cliente */
const leerHistorial = async (req, res, next) => {
  try {
    const mensajes = await prisma.mensajeHistorial.findMany({
      where: { telefono: req.params.telefono },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });
    res.json(mensajes);
  } catch (err) {
    next(err);
  }
};

// ─── HUMAN TAKEOVER ──────────────────────────────────────────────────────────

const activarHumanTakeover = async (req, res, next) => {
  try {
    const { Telefono, telefono, Agente_Activo, Timestamp_Ultimo_Agente } = req.body;
    const tel = Telefono || telefono;
    if (!tel) return res.status(400).json({ error: 'Telefono requerido' });

    const ht = await prisma.$transaction(async (tx) => {
      const lead = await tx.leadCRM.upsert({
        where: { telefono: tel },
        update: {},
        create: { telefono: tel },
      });

      return tx.humanTakeover.upsert({
        where: { telefono: tel },
        update: {
          agenteActivo: Agente_Activo === true || Agente_Activo === 'true',
          timestampUltimoAgente: Timestamp_Ultimo_Agente ? new Date(Timestamp_Ultimo_Agente) : new Date(),
        },
        create: {
          leadId: lead.id,
          telefono: tel,
          agenteActivo: Agente_Activo === true || Agente_Activo === 'true',
          timestampUltimoAgente: new Date(),
        },
      });
    });

    res.json(ht);
  } catch (err) {
    next(err);
  }
};

const leerHumanTakeover = async (req, res, next) => {
  try {
    const ht = await prisma.humanTakeover.findUnique({ where: { telefono: req.params.telefono } });
    res.json(ht || { telefono: req.params.telefono, Agente_Activo: false, agenteActivo: false });
  } catch (err) {
    next(err);
  }
};

// ─── OPT-OUT ─────────────────────────────────────────────────────────────────

const marcarOptOut = async (req, res, next) => {
  try {
    const { telefono, Telefono, mensaje, Mensaje } = req.body;
    const tel = telefono || Telefono;
    if (!tel) return res.status(400).json({ error: 'Telefono requerido' });

    const oo = await prisma.$transaction(async (tx) => {
      const o = await tx.optOut.upsert({
        where: { telefono: tel },
        update: { mensaje: mensaje || Mensaje || null, fecha: new Date() },
        create: { telefono: tel, mensaje: mensaje || Mensaje || null },
      });
      // Actualizar lead atómicamente — si falla, el optOut también se revierte
      await tx.leadCRM.updateMany({ where: { telefono: tel }, data: { pasoActual: 'opt_out' } });
      return o;
    });

    res.json(oo);
  } catch (err) {
    next(err);
  }
};

const listarOptOut = async (req, res, next) => {
  try {
    // Paginación obligatoria para evitar extracción masiva de teléfonos
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const skip  = parseInt(req.query.offset) || 0;
    const [lista, total] = await Promise.all([
      prisma.optOut.findMany({ orderBy: { fecha: 'desc' }, take: limit, skip }),
      prisma.optOut.count(),
    ]);
    res.json({ data: lista, total, limit, offset: skip });
  } catch (err) {
    next(err);
  }
};

// ─── LOGÍSTICA PENDIENTE ─────────────────────────────────────────────────────

const guardarLogistica = async (req, res, next) => {
  try {
    const b = req.body;
    const log = await prisma.logisticaPendiente.create({
      data: {
        telefono: b.Telefono || b.telefono || '',
        nombreCliente: b.Nombre_Cliente || b.nombre_cliente || null,
        medida: b.Medida || b.medida || null,
        marcaLlanta: b.Marca_Llanta || b.marca_llanta || null,
        cantidad: parseInt(b.Cantidad || b.cantidad || 1),
        precioUnit: b.Precio_Unit ? parseFloat(b.Precio_Unit) : null,
        localOrigen: b.Local_Origen || null,
        localDestino: b.Local_Destino || null,
        tipoLogistica: b.Tipo_Logistica || b.tipo_logistica || null,
        observaciones: b.Observaciones || null,
      },
    });
    res.json(log);
  } catch (err) {
    next(err);
  }
};

const listarLogistica = async (req, res, next) => {
  try {
    const { estado } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const lista = await prisma.logisticaPendiente.findMany({
      where: estado ? { estado } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(lista);
  } catch (err) {
    next(err);
  }
};

const actualizarLogistica = async (req, res, next) => {
  try {
    const log = await prisma.logisticaPendiente.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(log);
  } catch (err) {
    next(err);
  }
};

// ─── REGISTRO DE VENTAS ──────────────────────────────────────────────────────

/** REGISTRO | Guardar Venta — desde n8n al completar el flujo */
const registrarVenta = async (req, res, next) => {
  try {
    const b = req.body;
    const telefono = b.Telefono || b.telefono || b._reg_telefono;

    const adminUser = await prisma.usuario.findFirst({ where: { rol: 'ADMIN', activo: true } });
    if (!adminUser) return res.status(500).json({ error: 'No hay usuario admin configurado' });

    const lead = telefono ? await prisma.leadCRM.findUnique({ where: { telefono } }) : null;

    const count = await prisma.venta.count();
    const numero = `VTA-WA-${String(count + 1).padStart(5, '0')}`;

    const precioUnit = parseFloat(b.Precio_Unit || b._reg_precio_unit || 0);
    const cantidad = parseInt(b.Cantidad || b._reg_cantidad || 1);

    const localInstalacion = b.Local_Instalacion
      ? (typeof b.Local_Instalacion === 'string' ? (() => { try { return JSON.parse(b.Local_Instalacion); } catch { return {}; } })() : b.Local_Instalacion)
      : null;

    const venta = await prisma.$transaction(async (tx) => {
      const v = await tx.venta.create({
      data: {
        numero,
        leadId: lead?.id || null,
        usuarioId: adminUser.id,
        telefonoCliente: telefono || null,
        nombreCliente: b.Nombre_Cliente || b._reg_nombre || null,
        dniCe: b.DNI_CE || b._reg_dni || null,
        marcaAuto: b.Marca_Auto || b._reg_marca_auto || null,
        modeloAuto: b.Modelo_Auto || b._reg_modelo_auto || null,
        anioAuto: b.Anio_Auto ? parseInt(b.Anio_Auto) : null,
        medidaLlanta: b.Medida_Llanta || b._reg_medida || null,
        marcaLlanta: b.Marca_Llanta || b._reg_marca_llanta || null,
        modeloLlanta: b.Modelo_Llanta || b._reg_modelo_llanta || null,
        cantidad,
        precioUnit,
        precioTotal: parseFloat(b.Precio_Total || b._reg_precio_total || precioUnit * cantidad),
        tipoVenta: b.Tipo_Venta || b._reg_tipo_venta || 'whatsapp',
        caso: b.Caso || b._reg_caso || null,
        esTraslado: b.Es_Traslado === 'true' || b.Es_Traslado === true,
        localInstalacion,
        direccionLocal: b.Direccion_Local || b._reg_direccion || null,
        provinciaDestino: b.Provincia_Destino || b._reg_provincia || null,
        fechaCita: b.Fecha_Cita || b._reg_fecha_cita || null,
        calendarId: b.Calendar_ID || b._reg_calendar_id || null,
        rankingLead: b.Ranking_Lead || b._reg_ranking || null,
        estadoLogistica: b.Estado_Logistica || b._reg_estado_logistica || null,
        estado: 'PENDIENTE',
      },
      });

      // Actualización del lead atómica con la venta
      if (lead) {
        await tx.leadCRM.update({ where: { id: lead.id }, data: { pasoActual: 'completado' } });
      }

      return v;
    }); // fin $transaction

    res.json({ ok: true, ventaId: venta.id, numero: venta.numero });
  } catch (err) {
    next(err);
  }
};

// ─── COLA DE REINTENTOS ──────────────────────────────────────────────────────

const guardarColaReintento = async (req, res, next) => {
  try {
    const { Telefono, Mensaje_Body, Intentos, Status, Error_Detalle } = req.body;
    const item = await prisma.colaReintento.create({
      data: {
        telefono: Telefono || '',
        mensajeBody: Mensaje_Body || '',
        intentos: parseInt(Intentos || 0),
        status: Status || 'pendiente',
        errorDetalle: Error_Detalle || null,
      },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

// ─── HELPERS DE MAPEO ────────────────────────────────────────────────────────

function mapSheetToLead(body) {
  const data = {};
  const parseJson = v => { if (!v) return undefined; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return v; } };

  if (body.Paso_Actual !== undefined) data.pasoActual = body.Paso_Actual;
  if (body.Medida_Detectada !== undefined) data.medidaDetectada = body.Medida_Detectada;
  if (body.Precio !== undefined) data.precioLlanta = body.Precio ? parseFloat(body.Precio) : null;
  if (body.Ranking !== undefined) data.ranking = body.Ranking || null;
  if (body.Tipo_Servicio !== undefined) data.tipoServicio = body.Tipo_Servicio;
  if (body.Local_Asignado !== undefined) data.localAsignado = parseJson(body.Local_Asignado);
  if (body.Local_Instalacion !== undefined) data.localInstalacion = parseJson(body.Local_Instalacion);
  if (body.Local_Origen_Traslado !== undefined) data.localOrigenTraslado = parseJson(body.Local_Origen_Traslado);
  if (body.Estado_Flujo !== undefined) data.estadoFlujo = parseJson(body.Estado_Flujo);
  if (body.Stock_Map !== undefined) data.stockMap = parseJson(body.Stock_Map);
  if (body.Distrito_Cliente !== undefined) data.distritoCliente = body.Distrito_Cliente;
  if (body.Intentos_Medida !== undefined) data.intentosMedida = parseInt(body.Intentos_Medida) || 0;
  if (body.Respuesta_Bot !== undefined) data.respuestaBot = body.Respuesta_Bot;
  if (body.Mensaje_Cliente !== undefined) data.mensajeCliente = body.Mensaje_Cliente;
  if (body.Hash_Mensaje !== undefined) data.hashMensaje = body.Hash_Mensaje;
  if (body.Estado_Logistica !== undefined) data.estadoLogistica = body.Estado_Logistica;
  if (body.Calendar_Event_ID !== undefined) data.calendarEventId = body.Calendar_Event_ID;
  if (body.Fecha_Cita !== undefined) data.fechaCita = body.Fecha_Cita;
  if (body.Email_Seguimiento_Enviado !== undefined) data.emailSeguimientoEnviado = body.Email_Seguimiento_Enviado === 'si' || body.Email_Seguimiento_enviado === true;
  if (body.Nombre_Cliente !== undefined) data.nombreCliente = body.Nombre_Cliente;
  if (body.DNI_CE !== undefined) data.dniCe = body.DNI_CE;
  if (body.Marca_Auto !== undefined) data.marcaAuto = body.Marca_Auto;
  if (body.Modelo_Auto !== undefined) data.modeloAuto = body.Modelo_Auto;
  if (body.Anio_Auto !== undefined) data.anioAuto = body.Anio_Auto ? parseInt(body.Anio_Auto) : null;
  if (body.Oferta_Precios !== undefined) data.ofertaPrecios = parseJson(body.Oferta_Precios);
  if (body.Provincia_Destino !== undefined) data.provinciaDestino = body.Provincia_Destino;
  if (body.Timestamp !== undefined) data.timestamp = new Date(body.Timestamp);
  return data;
}

function mapLeadToSheet(lead) {
  // Solo expone campos que el flujo n8n necesita operacionalmente
  // DNI_CE y datos sensibles se incluyen porque el flujo los necesita para registrar la venta
  return {
    Telefono:                   lead.telefono,
    Timestamp:                  lead.timestamp,
    Paso_Actual:                lead.pasoActual,
    Nombre_Cliente:             lead.nombreCliente || '',
    DNI_CE:                     lead.dniCe || '',           // necesario para registro de venta
    Marca_Auto:                 lead.marcaAuto || '',
    Modelo_Auto:                lead.modeloAuto || '',
    Anio_Auto:                  lead.anioAuto || '',
    Medida_Detectada:           lead.medidaDetectada || '',
    Precio:                     lead.precioLlanta || '',
    Ranking:                    lead.ranking || '',
    Tipo_Servicio:              lead.tipoServicio || '',
    Distrito_Cliente:           lead.distritoCliente || '',
    Provincia_Destino:          lead.provinciaDestino || '',
    Local_Asignado:             lead.localAsignado ? JSON.stringify(lead.localAsignado) : '',
    Local_Instalacion:          lead.localInstalacion ? JSON.stringify(lead.localInstalacion) : '',
    Local_Origen_Traslado:      lead.localOrigenTraslado ? JSON.stringify(lead.localOrigenTraslado) : '',
    Estado_Flujo:               lead.estadoFlujo ? JSON.stringify(lead.estadoFlujo) : '',
    Stock_Map:                  lead.stockMap ? JSON.stringify(lead.stockMap) : '',
    Oferta_Precios:             lead.ofertaPrecios ? JSON.stringify(lead.ofertaPrecios) : '',
    Intentos_Medida:            lead.intentosMedida,
    Hash_Mensaje:               lead.hashMensaje || '',
    Mensaje_Cliente:            lead.mensajeCliente || '',
    Respuesta_Bot:              lead.respuestaBot || '',
    Estado_Logistica:           lead.estadoLogistica || '',
    Fecha_Cita:                 lead.fechaCita || '',
    Calendar_Event_ID:          lead.calendarEventId || '',
    Email_Seguimiento_Enviado:  lead.emailSeguimientoEnviado ? 'si' : 'no',
    // Metadatos internos (no PII directamente)
    _id:                        lead.id,
    _updatedAt:                 lead.updatedAt,
    // Human takeover: solo estado activo, sin datos personales del agente
    _agenteActivo:              lead.humanTakeover?.agenteActivo ?? false,
  };
}

module.exports = {
  leerCRM, crearCRM, actualizarCRM, resetearCRM,
  listarPrecios,
  listarLocales,
  guardarHistorial, leerHistorial,
  activarHumanTakeover, leerHumanTakeover,
  marcarOptOut, listarOptOut,
  guardarLogistica, listarLogistica, actualizarLogistica,
  registrarVenta,
  guardarColaReintento,
};
