/**
 * API exclusiva para el flujo n8n — reemplaza Google Sheets.
 * Cada endpoint corresponde a una operación de hoja del flujo.
 */
const { normalizarMedida } = require('../utils/medida');
const prisma = require('../lib/prisma');

// ─── CACHE de catálogo con stock ──────────────────────────────────────────────
// El bot de WhatsApp consulta /api/n8n/precios en varios pasos de cada
// conversación. Sin caché, esta consulta compite por conexiones/recursos con
// la importación masiva de catálogo (que escribe en las mismas tablas en
// lotes de 20 concurrentes) y puede quedar esperando minutos. Con esta caché
// de 45s, como máximo una consulta por ventana toca la base de datos — el
// resto se sirve desde memoria, sin importar cuántas conversaciones ocurran
// a la vez ni si coincide con una importación.
const PRECIOS_CACHE_TTL_MS = 45 * 1000;
let preciosCache = { data: null, timestamp: 0 };
let preciosCacheInflight = null; // evita que varias consultas simultáneas disparen cada una su propio refresh

// Nombres exactos que usa el flujo n8n en MOD | Cruzar Distrito y Stock
const STOCK_KEY_MAP = {
  'L0': 'Stock_L0_Almacen',
  'L1': 'Stock_L1_SantaAnita',
  'L2': 'Stock_L2_Surco',
  'L3': 'Stock_L3_Surquillo',
  'L4': 'Stock_L4_Miraflores',
  'L5': 'Stock_L5_PuebloLibre',
};

function productoAFila(p) {
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
    Ficha_Tecnica: p.fichaTecnica || '',
    Garantia: p.garantia || '',
    Descuento_Maximo: p.descuentoMaximo ? parseFloat(p.descuentoMaximo) : 0,
    // Ficha técnica ampliada (datos estructurados) — para la respuesta de "información técnica"
    Indice_Carga: p.indice_carga || '',
    Velocidad_Max: p.velocidad_max || '',
    Carga_Max_Neumatico: p.cargaMaxNeumatico ?? null,
    Velocidad_Max_Kmh: p.velocidadMaxKmh ?? null,
    Eficiencia_Combustible: p.eficienciaCombustible || '',
    Eficiencia_Frenado: p.eficienciaFrenado || '',
    Nivel_Ruido: p.nivelRuido ?? null,
    Pais_Fabricacion: p.paisFabricacion || '',
    Origen_Marca: p.origenMarca || '',
    Campos_Extra: p.camposExtra || null,
    ...stockPorLocal,
  };
}

// Cachea el catálogo YA MAPEADO a filas (no solo la consulta a Prisma): bajo
// concurrencia, rearmar ~3200 objetos + serializar el JSON en cada request es
// trabajo de CPU que bloquea el event loop de Node y también generaba demoras
// (confirmado con prueba de carga: 25 llamadas simultáneas con la caché de
// Prisma tibia igual tardaban ~17s por repetir el mapeo). Cachear el resultado
// final reduce eso a un solo mapeo por ventana de 45s.
async function obtenerFilasCatalogo() {
  const ahora = Date.now();
  if (preciosCache.data && (ahora - preciosCache.timestamp) < PRECIOS_CACHE_TTL_MS) {
    return preciosCache.data;
  }
  if (preciosCacheInflight) return preciosCacheInflight;

  preciosCacheInflight = (async () => {
    try {
      const productos = await prisma.producto.findMany({
        where: { activo: true, stocks: { some: { cantidad: { gt: 0 } } } },
        include: { stocks: { include: { sede: true } } },
        orderBy: [{ medida: 'asc' }, { marca: 'asc' }],
      });
      const filas = productos.map(productoAFila);
      preciosCache = { data: filas, timestamp: Date.now() };
      return filas;
    } finally {
      preciosCacheInflight = null;
    }
  })();
  return preciosCacheInflight;
}

/** Invalida la caché de catálogo. Llamar después de escribir Producto/Stock
 * (importación masiva, edición manual) para que el bot no sirva datos viejos. */
function invalidarCachePrecios() {
  preciosCache = { data: null, timestamp: 0 };
}

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
    // Clave canónica: "145 / 65 r 16", "165R13C", "35X12,5R20", "650R16", "195/50ZR15" → forma única.
    // Coincidencia INCLUSIVA por medidaNorm (la Z/RF/C/LT se descartan en la clave).
    const medidaNorm = medida ? normalizarMedida(medida) : null;

    // Las filas ya vienen mapeadas y cacheadas — filtrar por medida es solo
    // comparar strings sobre objetos ya construidos, no reconstruye nada.
    let filas = await obtenerFilasCatalogo();
    if (medidaNorm) {
      filas = filas.filter(f => normalizarMedida(f.Medida) === medidaNorm);
    }

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
      Maps: s.googleMaps || '',
      Latitud: s.latitud || '',
      Longitud: s.longitud || '',
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

// ─── RECUPERACIÓN DE CARRITO (RECORDATORIOS) ─────────────────────────────────

// Pasos que NO cuentan como "carrito abandonado" (no hay nada que recuperar)
const PASOS_NO_RECUPERABLES = new Set([
  'nuevo', 'completado', 'finalizado', 'venta_registrada', 'opt_out', 'cancelado',
  'sin_stock', // su medida no tiene stock: no hay nada que recuperar
  'cotizado', // ya se le mostró precio/tienda, queda a la espera de un vendedor: no es abandono
]);

// Nombre amable de cada paso para mostrarlo en el recordatorio al cliente.
// Cubre los pasos reales del flujo; cualquier otro cae al texto genérico.
const PASO_AMIGABLE = {
  esperando_medida:             'buscando la medida de tu llanta',
  esperando_version_auto:       'eligiendo la versión de tu vehículo',
  esperando_eleccion_llanta:    'eligiendo tu llanta',
  esperando_eleccion_marca:     'eligiendo la marca de tu llanta',
  esperando_info_tecnica:       'revisando la información técnica de tus llantas',
  info_tecnica:                 'revisando la información técnica de tus llantas',
  esperando_datos_cliente:      'registrando tus datos',
  esperando_destino:            'eligiendo cómo quieres recibir tus llantas',
  esperando_distrito:           'indicando tu distrito',
  esperando_provincia_destino:  'indicando tu provincia',
  esperando_local_cliente:      'eligiendo tu local',
  esperando_local_destino:      'eligiendo el local de instalación',
  esperando_eleccion_b:         'eligiendo el local de instalación',
  esperando_eleccion_local_lima:'eligiendo tu tienda en Lima',
  esperando_confirmacion:       'confirmando tu cita',
  cotizado:                     'esperando el contacto de un asesor',
};

// Ventanas de tiempo por nivel: [desde_min, hasta_min) de inactividad
const NIVELES_RECORDATORIO = {
  '15m': { campo: 'recordatorio15',  desde: 15,   hasta: 180 },    // 15 min – 3 h
  '3h':  { campo: 'recordatorio3h',  desde: 180,  hasta: 1260 },   // 3 h – 21 h
  '21h': { campo: 'recordatorio21h', desde: 1260, hasta: 10080 },  // 21 h – 7 días
};

/**
 * LISTAR CARRITOS ABANDONADOS POR NIVEL
 * GET /api/n8n/recordatorios?nivel=15m|3h|21h
 * Devuelve los leads que dejaron el flujo a medias dentro de la ventana del
 * nivel y que aún no recibieron ese recordatorio.
 */
const listarRecordatorios = async (req, res, next) => {
  try {
    const nivel = String(req.query.nivel || '').trim();
    const cfg = NIVELES_RECORDATORIO[nivel];
    if (!cfg) {
      return res.status(400).json({ error: 'nivel inválido (usa 15m, 3h o 21h)' });
    }
    const ahora = Date.now();
    const limiteReciente = new Date(ahora - cfg.desde * 60 * 1000); // updatedAt <= esto
    const limiteAntiguo  = new Date(ahora - cfg.hasta * 60 * 1000); // updatedAt >  esto

    const leads = await prisma.leadCRM.findMany({
      where: {
        [cfg.campo]: false,
        updatedAt: { lte: limiteReciente, gt: limiteAntiguo },
        pasoActual: { notIn: Array.from(PASOS_NO_RECUPERABLES) },
      },
      select: {
        telefono: true, nombreCliente: true, pasoActual: true,
        medidaDetectada: true, respuestaBot: true, updatedAt: true,
      },
      take: 200,
    });

    // No molestar si hay un agente humano atendiendo ese chat
    const activos = await prisma.humanTakeover.findMany({
      where: { agenteActivo: true, telefono: { in: leads.map(l => l.telefono) } },
      select: { telefono: true },
    });
    const enAgente = new Set(activos.map(a => a.telefono));

    const items = leads
      .filter(l => !enAgente.has(l.telefono))
      .map(l => ({
        Telefono:        l.telefono,
        Nombre_Cliente:  l.nombreCliente || '',
        Paso_Actual:     l.pasoActual,
        Paso_Amigable:   PASO_AMIGABLE[l.pasoActual] || 'eligiendo tus llantas',
        Medida_Detectada: l.medidaDetectada || '',
        Respuesta_Bot:   l.respuestaBot || '',
        Nivel:           nivel,
      }));

    res.json({ nivel, total: items.length, items });
  } catch (err) {
    next(err);
  }
};

/**
 * MARCAR RECORDATORIO ENVIADO
 * POST /api/n8n/recordatorios/marcar  body: { telefono, nivel }
 * Usa SQL crudo para NO actualizar updatedAt (así no se reinicia la ventana
 * de inactividad y los niveles siguientes siguen disparando a su tiempo).
 */
const marcarRecordatorio = async (req, res, next) => {
  try {
    const telefono = String(req.body.telefono || '').trim();
    const nivel = String(req.body.nivel || '').trim();
    const cfg = NIVELES_RECORDATORIO[nivel];
    if (!telefono || !cfg) {
      return res.status(400).json({ error: 'telefono y nivel (15m, 3h, 21h) requeridos' });
    }
    // columna física en la tabla (camelCase tal cual la define Prisma)
    const columna = { '15m': 'recordatorio15', '3h': 'recordatorio3h', '21h': 'recordatorio21h' }[nivel];
    await prisma.$executeRawUnsafe(
      `UPDATE "leads_crm" SET "${columna}" = true WHERE "telefono" = $1`,
      telefono,
    );
    res.json({ ok: true, telefono, nivel });
  } catch (err) {
    next(err);
  }
};

// ─── NEGOCIO "EL PATRÓN" (shows de personajes) ──────────────────────────────
// Contrato simple en camelCase (flujo nuevo, sin compatibilidad con Sheets legacy).

/** POST /api/n8n/patron/lead — crea/actualiza el lead del flujo Patrón por teléfono */
const patronLead = async (req, res, next) => {
  try {
    const b = req.body;
    const telefono = String(b.telefono || '').trim();
    if (!telefono) return res.status(400).json({ error: 'telefono requerido' });

    const data = { tipoNegocio: 'PATRON' };
    if (b.pasoActual !== undefined) data.pasoActual = b.pasoActual;
    if (b.nombreCliente !== undefined) data.nombreCliente = b.nombreCliente || null;
    if (b.mensajeCliente !== undefined) data.mensajeCliente = b.mensajeCliente || null;
    if (b.personajeId !== undefined) data.personajeId = b.personajeId || null;
    if (b.distritoEvento !== undefined) data.distritoEvento = b.distritoEvento || null;
    if (b.costoMovilidadAprox !== undefined) data.costoMovilidadAprox = b.costoMovilidadAprox === null ? null : parseFloat(b.costoMovilidadAprox);
    if (b.agregadosSeleccionados !== undefined) data.agregadosSeleccionados = b.agregadosSeleccionados;
    if (b.esProvincia !== undefined) data.esProvincia = b.esProvincia === true || b.esProvincia === 'true';

    const lead = await prisma.leadCRM.upsert({
      where: { telefono },
      update: data,
      create: { telefono, pasoActual: data.pasoActual || 'nuevo', timestamp: new Date(), ...data },
    });

    res.json(lead);
  } catch (err) {
    next(err);
  }
};

/** GET /api/n8n/patron/personajes — catálogo activo (Patrón, Patrona, Oso Mariachi) */
const patronListarPersonajes = async (req, res, next) => {
  try {
    const personajes = await prisma.personajeShow.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(personajes.map(p => ({
      id: p.id,
      nombre: p.nombre,
      precioBase: parseFloat(p.precioBase),
      descripcion: p.descripcion || '',
    })));
  } catch (err) {
    next(err);
  }
};

/** GET /api/n8n/patron/distritos/:distrito — costo aproximado de movilidad */
const patronCostoDistrito = async (req, res, next) => {
  try {
    const distrito = String(req.params.distrito || '').trim();
    const item = await prisma.distritoCobertura.findFirst({
      where: { distrito: { equals: distrito, mode: 'insensitive' }, activo: true },
    });
    if (!item) {
      return res.json({ encontrado: false, distrito, costoTransporteAprox: null });
    }
    res.json({ encontrado: true, distrito: item.distrito, costoTransporteAprox: item.costoTransporteAprox ? parseFloat(item.costoTransporteAprox) : null });
  } catch (err) {
    next(err);
  }
};

/** POST /api/n8n/patron/cita — agenda el show validando que no choque con otro ya agendado */
const patronCita = async (req, res, next) => {
  try {
    const b = req.body;
    const telefono = String(b.telefono || '').trim();
    if (!telefono) return res.status(400).json({ error: 'telefono requerido' });
    if (!b.fechaInstalacion) return res.status(400).json({ error: 'fechaInstalacion requerida' });

    const fecha = new Date(b.fechaInstalacion);
    const hora = b.horaInstalacion || null;

    const choque = await prisma.leadCRM.findFirst({
      where: {
        tipoNegocio: 'PATRON',
        telefono: { not: telefono },
        fechaInstalacion: fecha,
        horaInstalacion: hora,
        estadoCita: { not: null },
      },
    });
    if (choque) {
      return res.status(409).json({ ok: false, error: 'Ya hay un show agendado en esa fecha y hora' });
    }

    const lead = await prisma.leadCRM.upsert({
      where: { telefono },
      update: {
        fechaInstalacion: fecha,
        horaInstalacion: hora,
        estadoCita: 'ATENDIDO',
        pasoActual: 'cotizado',
      },
      create: {
        telefono,
        tipoNegocio: 'PATRON',
        timestamp: new Date(),
        fechaInstalacion: fecha,
        horaInstalacion: hora,
        estadoCita: 'ATENDIDO',
        pasoActual: 'cotizado',
      },
    });

    res.json({ ok: true, lead });
  } catch (err) {
    next(err);
  }
};

// ─── HELPERS DE MAPEO ────────────────────────────────────────────────────────

function mapSheetToLead(body) {
  const data = {};
  const parseJson = v => { if (!v) return undefined; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return v; } };

  if (body.Paso_Actual !== undefined) data.pasoActual = body.Paso_Actual;
  // Guardar la medida siempre en forma canónica ("195 / 65 R 15" → "195/65R15")
  // para que las comparaciones del flujo n8n coincidan con el catálogo del CRM.
  if (body.Medida_Detectada !== undefined) data.medidaDetectada = body.Medida_Detectada ? normalizarMedida(body.Medida_Detectada) : body.Medida_Detectada;
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
  // Recuperación de carrito: si el cliente vuelve a interactuar (cambia de paso
  // o envía un mensaje), se limpian los flags para poder recordarle de nuevo
  // si vuelve a abandonar el flujo más adelante.
  if (body.Paso_Actual !== undefined || body.Mensaje_Cliente !== undefined) {
    data.recordatorio15 = false;
    data.recordatorio3h = false;
    data.recordatorio21h = false;
  }
  if (body.Hash_Mensaje !== undefined) data.hashMensaje = body.Hash_Mensaje;
  if (body.Estado_Logistica !== undefined) data.estadoLogistica = body.Estado_Logistica;
  if (body.Calendar_Event_ID !== undefined) data.calendarEventId = body.Calendar_Event_ID;
  if (body.Fecha_Cita !== undefined) data.fechaCita = body.Fecha_Cita;
  if (body.Email_Seguimiento_Enviado !== undefined) data.emailSeguimientoEnviado = body.Email_Seguimiento_Enviado === 'si' || body.Email_Seguimiento_enviado === true;
  if (body.Nombre_Cliente !== undefined) data.nombreCliente = body.Nombre_Cliente;
  if (body.DNI_CE !== undefined) data.dniCe = body.DNI_CE;
  if (body.Marca_Llanta !== undefined) data.marcaLlanta = body.Marca_Llanta || null;
  if (body.Modelo_Llanta !== undefined) data.modeloLlanta = body.Modelo_Llanta || null;
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
    Marca_Llanta:               lead.marcaLlanta || '',
    Modelo_Llanta:              lead.modeloLlanta || '',
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
  listarRecordatorios, marcarRecordatorio,
  patronLead, patronListarPersonajes, patronCostoDistrito, patronCita,
  invalidarCachePrecios,
};
