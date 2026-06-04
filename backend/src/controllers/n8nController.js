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

/** CRM | Crear Fila Nueva */
const crearCRM = async (req, res, next) => {
  try {
    const { Telefono, telefono, texto_mensaje, Mensaje_Cliente } = req.body;
    const tel = Telefono || telefono;
    if (!tel) return res.status(400).json({ error: 'Telefono requerido' });

    const lead = await prisma.leadCRM.upsert({
      where: { telefono: tel },
      update: { mensajeCliente: texto_mensaje || Mensaje_Cliente || undefined },
      create: {
        telefono: tel,
        pasoActual: 'nuevo',
        mensajeCliente: texto_mensaje || Mensaje_Cliente || null,
        emailSeguimientoEnviado: false,
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

    const filas = productos.map(p => {
      const stockPorLocal = {};
      p.stocks.forEach(s => {
        stockPorLocal[`Stock_${s.sede.codigoLocal}_${s.sede.nombre.replace(/\s+/g, '_')}`] = s.cantidad;
        // También nombre corto que usa el flujo
        const key = `Stock_${s.sede.codigoLocal}`;
        stockPorLocal[key] = s.cantidad;
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

    const lead = await prisma.leadCRM.upsert({
      where: { telefono: tel },
      update: {},
      create: { telefono: tel },
    });

    if (Hash_Mensaje) {
      const existe = await prisma.mensajeHistorial.findUnique({ where: { hashMensaje: Hash_Mensaje } });
      if (existe) return res.json(existe);
    }

    const msg = await prisma.mensajeHistorial.create({
      data: {
        leadId: lead.id,
        telefono: tel,
        hashMensaje: Hash_Mensaje || null,
        rol: Rol || rol || 'cliente',
        mensaje: Mensaje || mensaje || '',
        pasoActual: Paso_Actual || paso_actual || null,
      },
    });
    res.json(msg);
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

    const lead = await prisma.leadCRM.upsert({
      where: { telefono: tel },
      update: {},
      create: { telefono: tel },
    });

    const ht = await prisma.humanTakeover.upsert({
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

    const oo = await prisma.optOut.upsert({
      where: { telefono: tel },
      update: { mensaje: mensaje || Mensaje || null, fecha: new Date() },
      create: { telefono: tel, mensaje: mensaje || Mensaje || null },
    });
    await prisma.leadCRM.updateMany({ where: { telefono: tel }, data: { pasoActual: 'opt_out' } });
    res.json(oo);
  } catch (err) {
    next(err);
  }
};

const listarOptOut = async (req, res, next) => {
  try {
    const lista = await prisma.optOut.findMany({ orderBy: { fecha: 'desc' } });
    res.json(lista);
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
    const lista = await prisma.logisticaPendiente.findMany({
      where: estado ? { estado } : {},
      orderBy: { createdAt: 'desc' },
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

    const venta = await prisma.venta.create({
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

    if (lead) {
      await prisma.leadCRM.update({ where: { id: lead.id }, data: { pasoActual: 'completado' } });
    }

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
  if (body.Ranking !== undefined) data.ranking = body.Ranking;
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
  return {
    // Campos con nombre idéntico al sheet CRM
    Telefono: lead.telefono,
    Timestamp: lead.timestamp,
    Paso_Actual: lead.pasoActual,
    Nombre_Cliente: lead.nombreCliente || '',
    DNI_CE: lead.dniCe || '',
    Marca_Auto: lead.marcaAuto || '',
    Modelo_Auto: lead.modeloAuto || '',
    Anio_Auto: lead.anioAuto || '',
    Medida_Detectada: lead.medidaDetectada || '',
    Precio: lead.precioLlanta || '',
    Ranking: lead.ranking || '',
    Tipo_Servicio: lead.tipoServicio || '',
    Distrito_Cliente: lead.distritoCliente || '',
    Provincia_Destino: lead.provinciaDestino || '',
    Local_Asignado: lead.localAsignado ? JSON.stringify(lead.localAsignado) : '',
    Local_Instalacion: lead.localInstalacion ? JSON.stringify(lead.localInstalacion) : '',
    Local_Origen_Traslado: lead.localOrigenTraslado ? JSON.stringify(lead.localOrigenTraslado) : '',
    Estado_Flujo: lead.estadoFlujo ? JSON.stringify(lead.estadoFlujo) : '',
    Stock_Map: lead.stockMap ? JSON.stringify(lead.stockMap) : '',
    Oferta_Precios: lead.ofertaPrecios ? JSON.stringify(lead.ofertaPrecios) : '',
    Intentos_Medida: lead.intentosMedida,
    Hash_Mensaje: lead.hashMensaje || '',
    Mensaje_Cliente: lead.mensajeCliente || '',
    Respuesta_Bot: lead.respuestaBot || '',
    Estado_Logistica: lead.estadoLogistica || '',
    Fecha_Cita: lead.fechaCita || '',
    Calendar_Event_ID: lead.calendarEventId || '',
    Email_Seguimiento_Enviado: lead.emailSeguimientoEnviado ? 'si' : 'no',
    // Campos internos del CRM
    _id: lead.id,
    _updatedAt: lead.updatedAt,
    _humanTakeover: lead.humanTakeover || null,
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
