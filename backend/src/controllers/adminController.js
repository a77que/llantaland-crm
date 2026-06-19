const { PrismaClient } = require('@prisma/client');
const XLSXStyle = require('xlsx-js-style');
const prisma = new PrismaClient();

const stockCritico = async (req, res, next) => {
  try {
    const alertas = await prisma.alertaStock.findMany({
      where: { resuelta: false },
      orderBy: { createdAt: 'desc' },
      include: {
        producto: { select: { sku: true, medida: true, marca: true, nombreComercial: true } },
        sede: { select: { nombre: true, codigoLocal: true } },
      },
    });
    res.json(alertas);
  } catch (err) {
    next(err);
  }
};

/**
 * Exporta a Excel las llantas SIN STOCK o SIN PRECIO definido.
 * GET /api/admin/stock-critico/export?tipo=sin-stock|sin-precio
 */
const exportarStockCritico = async (req, res, next) => {
  try {
    const tipo = req.query.tipo === 'sin-precio' ? 'sin-precio' : 'sin-stock';

    const sedes = await prisma.sede.findMany({
      where: { activo: true }, orderBy: { codigoLocal: 'asc' },
      select: { id: true, nombre: true, codigoLocal: true },
    });

    const productos = await prisma.producto.findMany({
      where: { activo: true },
      include: { stocks: { include: { sede: true } } },
      orderBy: [{ marca: 'asc' }, { medida: 'asc' }],
    });

    const stockTotal = (p) => p.stocks.reduce((s, x) => s + (x.cantidad || 0), 0);
    const precioReg = (p) => (p.precioRegular == null ? 0 : parseFloat(p.precioRegular));

    const filtrados = tipo === 'sin-precio'
      ? productos.filter(p => !precioReg(p) || precioReg(p) <= 0)
      : productos.filter(p => stockTotal(p) <= 0);

    // Encabezados
    const headBase = ['SKU', 'Medida', 'Marca', 'Nombre Comercial', 'Tipo', 'Grupo',
      'Precio Regular', 'Precio Oferta', 'Stock Total'];
    const headSedes = sedes.map(s => `Stock ${s.codigoLocal || ''} ${s.nombre}`.trim());
    const header = [...headBase, ...headSedes];

    const rows = filtrados.map(p => {
      const porSede = sedes.map(s => {
        const st = p.stocks.find(x => x.sedeId === s.id);
        return st ? st.cantidad : 0;
      });
      return [
        p.sku, p.medida, p.marca, p.nombreComercial || '', p.tipo || '', p.grupo || '',
        precioReg(p), p.precioOferta == null ? '' : parseFloat(p.precioOferta), stockTotal(p),
        ...porSede,
      ];
    });

    // Construir hoja con estilo de encabezado
    const aoa = [header, ...rows];
    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    const azul = { fill: { fgColor: { rgb: tipo === 'sin-precio' ? 'B45309' : 'B91C1C' } },
      font: { color: { rgb: 'FFFFFF' }, bold: true }, alignment: { horizontal: 'center' } };
    for (let c = 0; c < header.length; c++) {
      const ref = XLSXStyle.utils.encode_cell({ r: 0, c });
      if (ws[ref]) ws[ref].s = azul;
    }
    ws['!cols'] = header.map((h, i) => ({ wch: i === 3 ? 28 : Math.max(10, h.length + 2) }));

    const wb = XLSXStyle.utils.book_new();
    const hojaNombre = tipo === 'sin-precio' ? 'Sin Precio' : 'Sin Stock';
    XLSXStyle.utils.book_append_sheet(wb, ws, hojaNombre);

    const buf = XLSXStyle.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fecha = new Date().toISOString().slice(0, 10);
    const fname = `llantas_${tipo}_${fecha}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
};

const resumen = async (req, res, next) => {
  try {
    const { desde, hasta } = req.query;
    const where = {};
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) where.createdAt.lte = new Date(hasta);
    }

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

    const [ventasTotal, ventasHoy, leadsTotal, leadsHoy, leadsCompletados, leadsCalientes] = await Promise.all([
      prisma.venta.count({ where: { ...where, estado: { not: 'ANULADA' } } }),
      prisma.venta.count({ where: { createdAt: { gte: hoy }, estado: { not: 'ANULADA' } } }),
      prisma.leadCRM.count(),
      prisma.leadCRM.count({ where: { timestamp: { gte: hoy } } }),
      prisma.leadCRM.count({ where: { pasoActual: 'completado' } }),
      prisma.leadCRM.count({ where: { ranking: 'caliente' } }),
    ]);

    const ventasAgregado = await prisma.venta.aggregate({
      where: { ...where, estado: { not: 'ANULADA' } },
      _sum: { precioTotal: true },
      _count: true,
    });

    res.json({
      ventas: { total: ventasAgregado._sum.precioTotal || 0, cantidad: ventasAgregado._count, hoy: ventasHoy },
      leads: { total: leadsTotal, hoy: leadsHoy, completados: leadsCompletados, calientes: leadsCalientes },
    });
  } catch (err) {
    next(err);
  }
};

const seedCitasTest = async (req, res, next) => {
  try {
    const localSantaAnita = { ID: 'L1', Nombre: 'Santa Anita', Tipo: 'lima', Distrito: 'Santa Anita', Direccion: 'Av. Las Torres 412' };
    const localSurco      = { ID: 'L2', Nombre: 'Surco',       Tipo: 'lima', Distrito: 'Surquillo',   Direccion: 'Av. Angamos Este 1580' };
    const stockMap1 = { Stock_L1_SantaAnita: 8, Stock_L1: 8, Stock_L2_Surco: 3, Stock_L2: 3 };
    const stockMap2 = { Stock_L1_SantaAnita: 0, Stock_L1: 0, Stock_L2_Surco: 5, Stock_L2: 5 };

    const c1 = await prisma.leadCRM.upsert({
      where: { telefono: '51900000001' },
      update: {
        nombreCliente: 'Carlos Mendoza Ríos', dniCe: '46123789',
        pasoActual: 'esperando_confirmacion', ranking: 'caliente',
        marcaAuto: 'Toyota', modeloAuto: 'Corolla', anioAuto: 2019,
        medidaDetectada: '195/65R15', marcaLlanta: 'Michelin', modeloLlanta: 'Energy Saver',
        cantidadLlantas: 4, precioLlanta: 380.00,
        localInstalacion: localSantaAnita, stockMap: stockMap1,
      },
      create: {
        telefono: '51900000001',
        nombreCliente: 'Carlos Mendoza Ríos', dniCe: '46123789',
        pasoActual: 'esperando_confirmacion', ranking: 'caliente',
        marcaAuto: 'Toyota', modeloAuto: 'Corolla', anioAuto: 2019,
        medidaDetectada: '195/65R15', marcaLlanta: 'Michelin', modeloLlanta: 'Energy Saver',
        cantidadLlantas: 4, precioLlanta: 380.00,
        localInstalacion: localSantaAnita, stockMap: stockMap1,
      },
    });

    const c2 = await prisma.leadCRM.upsert({
      where: { telefono: '51900000002' },
      update: {
        nombreCliente: 'María Flores Vega', dniCe: '72456318',
        pasoActual: 'completado', ranking: 'tibio',
        marcaAuto: 'Hyundai', modeloAuto: 'Tucson', anioAuto: 2021,
        medidaDetectada: '225/55R18', marcaLlanta: 'Bridgestone', modeloLlanta: 'Turanza T005',
        cantidadLlantas: 2, precioLlanta: 620.00,
        localInstalacion: localSurco, stockMap: stockMap2,
      },
      create: {
        telefono: '51900000002',
        nombreCliente: 'María Flores Vega', dniCe: '72456318',
        pasoActual: 'completado', ranking: 'tibio',
        marcaAuto: 'Hyundai', modeloAuto: 'Tucson', anioAuto: 2021,
        medidaDetectada: '225/55R18', marcaLlanta: 'Bridgestone', modeloLlanta: 'Turanza T005',
        cantidadLlantas: 2, precioLlanta: 620.00,
        localInstalacion: localSurco, stockMap: stockMap2,
      },
    });

    res.json({ ok: true, creadas: [c1.telefono, c2.telefono] });
  } catch (err) {
    next(err);
  }
};

/**
 * Diagnóstico en vivo de las APIs de búsqueda (DNI, RUC, CE, placa, IA versiones).
 * Hace una llamada de prueba real a cada servicio y reporta su estado SIN exponer claves.
 * GET /api/admin/diagnostico-apis
 */
const diagnosticoApis = async (req, res, next) => {
  const lookupService = require('../services/lookupService');
  const vehiculoService = require('../services/vehiculoService');
  const { getConfigApis } = require('../services/apiConfigService');
  const cfg = await getConfigApis();

  const out = {};

  // ── DNI ──────────────────────────────────────────────────────
  if (!cfg.dniUrl) {
    out.dni = { servicio: 'Consulta DNI', configurada: false, estado: 'no_configurada', mensaje: 'Falta API_DNI_URL en las variables de entorno' };
  } else {
    try {
      const r = await lookupService.consultar('dni', '44556677'); // documento de prueba
      out.dni = { servicio: 'Consulta DNI', configurada: true, estado: r.encontrado ? 'ok' : 'responde',
        mensaje: r.encontrado ? 'Consulta exitosa (datos recibidos)' : (r.mensaje || 'La API respondió (documento de prueba no hallado, es normal)') };
    } catch (e) { out.dni = { servicio: 'Consulta DNI', configurada: true, estado: 'error', mensaje: e.message }; }
  }

  // ── RUC (RUC público real para confirmar respuesta con datos) ─
  if (!cfg.rucUrl) {
    out.ruc = { servicio: 'Consulta RUC', configurada: false, estado: 'no_configurada', mensaje: 'Falta API_RUC_URL en las variables de entorno' };
  } else {
    try {
      const r = await lookupService.consultar('ruc', '20100070970'); // RUC público (Backus)
      out.ruc = { servicio: 'Consulta RUC', configurada: true, estado: r.encontrado ? 'ok' : 'responde',
        mensaje: r.encontrado ? 'Consulta exitosa (datos recibidos)' : (r.mensaje || 'La API respondió') };
    } catch (e) { out.ruc = { servicio: 'Consulta RUC', configurada: true, estado: 'error', mensaje: e.message }; }
  }

  // ── CE (solo verificación de configuración) ──────────────────
  out.ce = cfg.ceUrl
    ? { servicio: 'Consulta CE', configurada: true, estado: 'configurada', mensaje: 'Configurada (pruébala con un carné real desde una cotización)' }
    : { servicio: 'Consulta CE', configurada: false, estado: 'no_configurada', mensaje: 'Falta la URL de la API de CE' };

  // ── Placa (Factiliza) ────────────────────────────────────────
  if (!cfg.factilizaToken) {
    out.placa = { servicio: 'Consulta de placa', configurada: false, estado: 'no_configurada', mensaje: 'Falta el token de la API de placa' };
  } else {
    try {
      const r = await vehiculoService.consultarPlaca('ABC123'); // placa de prueba
      out.placa = { servicio: 'Consulta de placa', configurada: true, estado: r.encontrado ? 'ok' : 'responde',
        mensaje: r.encontrado ? 'Consulta exitosa (datos recibidos)' : (r.mensaje || 'La API respondió (placa de prueba no hallada, es normal)') };
    } catch (e) { out.placa = { servicio: 'Consulta de placa', configurada: true, estado: 'error', mensaje: e.message }; }
  }

  // ── IA versiones (Groq → Gemini) ─────────────────────────────
  const iaConfig = !!(cfg.groqKey || cfg.geminiKey);
  if (!iaConfig) {
    out.ia = { servicio: 'IA de versiones (Groq/Gemini)', configurada: false, estado: 'no_configurada', mensaje: 'Falta la clave de Groq y de Gemini' };
  } else {
    try {
      const r = await vehiculoService.buscarVersiones('Toyota', 'Corolla', '2020');
      const n = Array.isArray(r.versiones) ? r.versiones.length : 0;
      out.ia = { servicio: 'IA de versiones (Groq/Gemini)', configurada: true, estado: (r.encontrado && n) ? 'ok' : 'error',
        mensaje: (r.encontrado && n) ? `IA respondió con ${n} versiones de prueba` : (r.mensaje || 'La IA no devolvió versiones') };
    } catch (e) { out.ia = { servicio: 'IA de versiones (Groq/Gemini)', configurada: true, estado: 'error', mensaje: e.message }; }
  }

  res.json({ generado: new Date(), apis: out });
};

/**
 * Lee la config de APIs de búsqueda para edición.
 * Devuelve las URLs en claro y las claves SOLO como booleano "configurada" (nunca el valor).
 * GET /api/admin/config-apis
 */
const getConfigApiBusqueda = async (req, res, next) => {
  try {
    const cfg = await require('../services/apiConfigService').getConfigApis();
    res.json({
      // URLs efectivas (incluye los valores por defecto de Factiliza)
      dniUrl: cfg.dniUrl || '',
      rucUrl: cfg.rucUrl || '',
      ceUrl:  cfg.ceUrl  || '',
      factilizaUrl: cfg.factilizaUrl || '',
      // Claves: solo si están resueltas (nunca se devuelve el valor)
      dniKeySet:         !!cfg.dniKey,
      rucKeySet:         !!cfg.rucKey,
      ceKeySet:          !!cfg.ceKey,
      factilizaTokenSet: !!cfg.factilizaToken,
      groqKeySet:        !!cfg.groqKey,
      geminiKeySet:      !!cfg.geminiKey,
      // Prioridad y activación de IA
      iaPrioridad:  cfg.iaPrioridad || 'groq',
      groqActivo:   cfg.groqActivo !== false,
      geminiActivo: cfg.geminiActivo !== false,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Guarda la config de APIs. Las URLs se actualizan siempre (permite vaciarlas).
 * Las claves SOLO se actualizan si se envía un valor no vacío (dejar en blanco = no cambiar).
 * POST /api/admin/config-apis
 */
const saveConfigApiBusqueda = async (req, res, next) => {
  try {
    const b = req.body || {};
    const data = {};
    // URLs (siempre se setean si vienen definidas, aceptan vacío para limpiar)
    ['dniUrl', 'rucUrl', 'ceUrl', 'factilizaUrl'].forEach(k => { if (b[k] !== undefined) data[k] = String(b[k]).trim() || null; });
    // Claves/tokens (solo si trae valor no vacío)
    [['dniKey'], ['rucKey'], ['ceKey'], ['factilizaToken'], ['groqKey'], ['geminiKey']].forEach(([k]) => {
      if (b[k] !== undefined && String(b[k]).trim() !== '') data[k] = String(b[k]).trim();
    });
    // Prioridad y activación de IA
    if (b.iaPrioridad !== undefined) data.iaPrioridad = b.iaPrioridad === 'gemini' ? 'gemini' : 'groq';
    if (b.groqActivo !== undefined) data.groqActivo = !!b.groqActivo;
    if (b.geminiActivo !== undefined) data.geminiActivo = !!b.geminiActivo;

    const existing = await prisma.configApiBusqueda.findFirst();
    const row = existing
      ? await prisma.configApiBusqueda.update({ where: { id: existing.id }, data })
      : await prisma.configApiBusqueda.create({ data });

    // Refrescar cache para que aplique de inmediato (sin reiniciar el servidor)
    try { require('../services/apiConfigService').invalidarCacheApis(); } catch {}

    res.json({ ok: true, updatedAt: row.updatedAt });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  stockCritico, exportarStockCritico, diagnosticoApis,
  getConfigApiBusqueda, saveConfigApiBusqueda,
  resumen, seedCitasTest,
};
