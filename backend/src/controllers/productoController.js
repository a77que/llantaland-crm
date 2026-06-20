const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { paginar } = require('../utils/helpers');
const XLSXStyle = require('xlsx-js-style');
const { normalizarMedida, pareceMedida } = require('../utils/medida');
const { llamarIA } = require('../services/iaService');

const prisma = new PrismaClient();

// Campos permitidos para ordenar (evita injection)
const SORT_FIELDS = {
  medida: 'medida', marca: 'marca', nombreComercial: 'nombreComercial',
  grupo: 'grupo', precioRegular: 'precioRegular', precioOferta: 'precioOferta',
  descuentoMaximo: 'descuentoMaximo', garantia: 'garantia',
  indice_carga: 'indice_carga', velocidad_max: 'velocidad_max',
  cargaMaxNeumatico: 'cargaMaxNeumatico', velocidadMaxKmh: 'velocidadMaxKmh',
  eficienciaCombustible: 'eficienciaCombustible', eficienciaFrenado: 'eficienciaFrenado',
  nivelRuido: 'nivelRuido', paisFabricacion: 'paisFabricacion', origenMarca: 'origenMarca',
  sku: 'sku', tipo: 'tipo', createdAt: 'createdAt',
};

const listar = async (req, res, next) => {
  try {
    const { medida, marca, tipo, sedeId, q, page, limit, orderBy, orderDir } = req.query;
    const { skip, take } = paginar(page, limit);
    const where = { activo: true };
    const and = [];

    // Búsqueda por medida: usa la clave canónica (medidaNorm) para que cualquier
    // formato (ZR, RF, C, LT, X, numérico, compactos, espacios) coincida de forma
    // inclusiva. Fallback a `medida` por si algún producto aún no tiene medidaNorm.
    if (medida) {
      const norm = normalizarMedida(medida);
      and.push({ OR: [
        { medidaNorm: { contains: norm, mode: 'insensitive' } },
        { medida:     { contains: norm, mode: 'insensitive' } },
      ]});
    }
    if (marca)  where.marca  = { contains: marca,  mode: 'insensitive' };
    if (tipo)   where.tipo   = tipo;
    if (q) {
      const or = [
        { sku:            { contains: q, mode: 'insensitive' } },
        { medida:         { contains: q, mode: 'insensitive' } },
        { marca:          { contains: q, mode: 'insensitive' } },
        { nombreComercial:{ contains: q, mode: 'insensitive' } },
        { grupo:          { contains: q, mode: 'insensitive' } },
      ];
      // Si el término parece una medida, buscar también su clave canónica
      // para aceptar "145 / 65 r 16", "165R13C", "35X12,5R20", "650R16", etc.
      if (pareceMedida(q)) {
        const qm = normalizarMedida(q);
        if (qm) {
          or.push({ medidaNorm: { contains: qm, mode: 'insensitive' } });
          or.push({ medida:     { contains: qm, mode: 'insensitive' } });
        }
      }
      and.push({ OR: or });
    }
    if (and.length) where.AND = and;

    const sortField = SORT_FIELDS[orderBy] || 'createdAt';
    const sortDir   = orderDir === 'asc' ? 'asc' : 'desc';

    const [total, productos] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where, skip, take,
        orderBy: { [sortField]: sortDir },
        include: {
          stocks: sedeId
            ? { where: { sedeId }, include: { sede: true } }
            : { include: { sede: true }, orderBy: { sede: { codigoLocal: 'asc' } } },
        },
      }),
    ]);

    res.json({ total, page: parseInt(page) || 1, limit: take, data: productos });
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: req.params.id },
      include: {
        stocks: { include: { sede: true }, orderBy: { sede: { codigoLocal: 'asc' } } },
      },
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.medida) data.medidaNorm = normalizarMedida(data.medida);
    const producto = await prisma.producto.create({ data });
    res.status(201).json(producto);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.medida) data.medidaNorm = normalizarMedida(data.medida);
    const producto = await prisma.producto.update({
      where: { id: req.params.id },
      data,
    });
    res.json(producto);
  } catch (err) {
    next(err);
  }
};

// Eliminación lógica: activo=false (conserva historial de ventas y movimientos)
const eliminar = async (req, res, next) => {
  try {
    const producto = await prisma.producto.findUnique({ where: { id: req.params.id } });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    await prisma.producto.update({ where: { id: req.params.id }, data: { activo: false } });
    res.json({ ok: true, mensaje: `Producto ${producto.sku} eliminado del catálogo` });
  } catch (err) {
    next(err);
  }
};

const eliminarMasivo = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Debes enviar un array "ids" con al menos un producto' });
    }
    const result = await prisma.producto.updateMany({
      where: { id: { in: ids }, activo: true },
      data: { activo: false },
    });
    res.json({ ok: true, eliminados: result.count });
  } catch (err) {
    next(err);
  }
};

const compatibles = async (req, res, next) => {
  try {
    const { medida } = req.query;
    if (!medida) return res.status(400).json({ error: 'medida requerida' });
    const norm = normalizarMedida(medida);
    const productos = await prisma.producto.findMany({
      where: {
        activo: true,
        OR: [
          { medidaNorm: { contains: norm, mode: 'insensitive' } },
          { medida:     { contains: norm, mode: 'insensitive' } },
        ],
      },
      include: { stocks: { include: { sede: true } } },
    });
    res.json(productos);
  } catch (err) {
    next(err);
  }
};

const subirImagen = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
    const url = `/uploads/${req.file.filename}`;
    const producto = await prisma.producto.update({
      where: { id: req.params.id },
      data: { imagenUrl: url },
    });
    res.status(201).json({ url, producto });
  } catch (err) {
    next(err);
  }
};

const marcas = async (req, res, next) => {
  try {
    const result = await prisma.producto.findMany({
      distinct: ['marca'],
      select: { marca: true },
      where: { activo: true },
      orderBy: { marca: 'asc' },
    });
    res.json(result.map(r => r.marca).filter(Boolean));
  } catch (err) {
    next(err);
  }
};

const tipos = async (req, res, next) => {
  try {
    const result = await prisma.producto.findMany({
      distinct: ['tipo'],
      select: { tipo: true },
      where: { activo: true },
      orderBy: { tipo: 'asc' },
    });
    res.json(result.map(r => r.tipo).filter(Boolean));
  } catch (err) {
    next(err);
  }
};

// Medidas distintas del catálogo (para autocompletado). Filtro opcional ?q=
const medidas = async (req, res, next) => {
  try {
    const { q } = req.query;
    const where = { activo: true };
    if (q) {
      if (pareceMedida(q)) {
        const norm = normalizarMedida(q);
        where.OR = [
          { medidaNorm: { contains: norm, mode: 'insensitive' } },
          { medida:     { contains: norm, mode: 'insensitive' } },
        ];
      } else {
        where.medida = { contains: String(q), mode: 'insensitive' };
      }
    }
    const result = await prisma.producto.findMany({
      distinct: ['medida'],
      select: { medida: true },
      where,
      orderBy: { medida: 'asc' },
      take: 50,
    });
    res.json(result.map(r => r.medida).filter(Boolean));
  } catch (err) {
    next(err);
  }
};

const TECH_FIELDS = [
  'indice_carga', 'velocidad_max', 'garantia',
  'cargaMaxNeumatico', 'velocidadMaxKmh',
  'eficienciaCombustible', 'eficienciaFrenado', 'nivelRuido',
  'paisFabricacion', 'origenMarca', 'fichaTecnica',
];

// Completa con IA UN producto (botón "Rellenar con IA"). Usa el servicio central
// (respeta prioridad y activación de Groq/Gemini configuradas en Config APIs).
const enriquecerConIA = async (req, res, next) => {
  try {
    const r = await enriquecerUno(req.params.id);
    if (r.status === 'no_encontrado') return res.status(404).json({ error: 'Producto no encontrado' });
    if (r.status === 'sin_ia') return res.status(503).json({ error: 'No hay IA activa/configurada. Revisa Admin → Config APIs (activa Groq o Gemini).' });
    if (r.status === 'completo') return res.json({ mensaje: 'Producto ya tiene información completa', producto: r.producto });
    if (r.status === 'error') return res.status(502).json({ error: 'La IA no respondió. Reintenta en un momento.' });
    if (r.status === 'sin_cambios') return res.json({ mensaje: 'La IA no pudo determinar los campos faltantes', producto: r.producto });
    return res.json({ mensaje: `${r.camposActualizados.length} campos completados con IA`, camposActualizados: r.camposActualizados, producto: r.producto });
  } catch (err) {
    next(err);
  }
};

// Etiquetas legibles de los campos técnicos (para mostrar qué falta).
const TECH_LABELS = {
  indice_carga: 'Índice de carga', velocidad_max: 'Índice de velocidad', garantia: 'Garantía',
  cargaMaxNeumatico: 'Carga máx. (kg)', velocidadMaxKmh: 'Velocidad máx. (km/h)',
  eficienciaCombustible: 'Eficiencia combustible', eficienciaFrenado: 'Frenado en mojado',
  nivelRuido: 'Nivel de ruido', paisFabricacion: 'País de fabricación', origenMarca: 'Origen de marca',
  fichaTecnica: 'Ficha técnica',
};

// Helper reutilizable: completa con IA los campos técnicos faltantes de UN producto.
// Devuelve { status: 'ok'|'completo'|'sin_cambios'|'error'|'sin_ia'|'no_encontrado', ... }.
async function enriquecerUno(prodId) {
  const prod = await prisma.producto.findUnique({ where: { id: prodId } });
  if (!prod) return { status: 'no_encontrado' };
  const info = { id: prod.id, sku: prod.sku, marca: prod.marca, modelo: prod.nombreComercial || '', medida: prod.medida };
  const missing = TECH_FIELDS.filter(f => prod[f] === null || prod[f] === undefined || prod[f] === '');
  if (missing.length === 0) return { status: 'completo', producto: prod, info };

  const prompt = `Eres un experto en neumáticos de automóvil. Dado el siguiente neumático, proporciona los datos técnicos faltantes con la mayor precisión posible basándote en estándares de la industria.

Neumático:
- Medida: ${prod.medida}
- Marca: ${prod.marca}
- Modelo: ${prod.nombreComercial || 'no especificado'}
- Tipo de vehículo: ${prod.tipo}
${prod.indice_carga ? `- Índice de carga: ${prod.indice_carga}` : ''}
${prod.velocidad_max ? `- Índice de velocidad: ${prod.velocidad_max}` : ''}

Campos faltantes que necesito: ${missing.join(', ')}

Responde ÚNICAMENTE con un objeto JSON válido. Usa null para campos que genuinamente no puedas determinar.
Solo incluye en el JSON los campos de esta lista: ${missing.join(', ')}

IMPORTANTE para el campo "fichaTecnica": Si está en la lista, genera una ficha técnica completa y detallada en español (mínimo 3 párrafos) que incluya: descripción del neumático, aplicaciones recomendadas, ventajas de la banda de rodamiento, tecnologías de construcción, condiciones de uso ideales, y argumentos de venta. Debe ser rica y útil para el vendedor.`;

  const { datos, rate, sinIa } = await llamarIA(prompt);
  if (sinIa) return { status: 'sin_ia', motivo: 'sin_ia', info };
  if (!datos) return { status: 'error', motivo: rate ? 'limite_velocidad' : 'sin_respuesta', rate, info };

  const INT_FIELDS = ['cargaMaxNeumatico', 'velocidadMaxKmh', 'nivelRuido'];
  const STR_FIELDS = ['indice_carga', 'velocidad_max', 'garantia', 'eficienciaCombustible', 'eficienciaFrenado', 'paisFabricacion', 'origenMarca'];
  const update = {};
  for (const f of missing) {
    if (datos[f] == null) continue;
    if (f === 'fichaTecnica') update[f] = String(datos[f]).trim();
    else if (INT_FIELDS.includes(f)) { const n = parseInt(datos[f]); if (!isNaN(n)) update[f] = n; }
    else if (STR_FIELDS.includes(f)) update[f] = String(datos[f]).trim().substring(0, 50);
  }
  if (Object.keys(update).length === 0) return { status: 'sin_cambios', motivo: 'sin_campos', producto: prod, info };
  const producto = await prisma.producto.update({ where: { id: prodId }, data: update });
  return { status: 'ok', camposActualizados: Object.keys(update), producto, info };
}

// Lista de llantas con ficha técnica incompleta + qué campos faltan.
const incompletos = async (req, res, next) => {
  try {
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, sku: true, marca: true, nombreComercial: true, medida: true,
        ...Object.fromEntries(TECH_FIELDS.map(f => [f, true])) },
      orderBy: [{ marca: 'asc' }, { nombreComercial: 'asc' }, { medida: 'asc' }],
    });
    const items = [];
    for (const p of productos) {
      const faltan = TECH_FIELDS.filter(f => p[f] === null || p[f] === undefined || p[f] === '');
      if (faltan.length) items.push({ id: p.id, sku: p.sku, marca: p.marca, modelo: p.nombreComercial || '', medida: p.medida, faltan, faltanLabels: faltan.map(f => TECH_LABELS[f] || f) });
    }
    res.json({ total: items.length, items });
  } catch (err) {
    next(err);
  }
};

// Rellena con IA varios productos (por lotes para no exceder límites de la IA).
const enriquecerMasivo = async (req, res, next) => {
  try {
    let { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids requeridos' });
    const CAP = 6; // lotes chicos: cada request termina rápido y respeta el límite de la IA
    const lote = ids.slice(0, CAP);
    let exitosos = 0, sinCambios = 0, fallidos = 0, rate = false;
    const fallos = []; // detalle de las que no se pudieron, con su motivo
    const sleep = (ms) => new Promise(s => setTimeout(s, ms));
    for (let i = 0; i < lote.length; i++) {
      try {
        const r = await enriquecerUno(lote[i]);
        if (r.status === 'ok') exitosos++;
        else if (r.status === 'completo') sinCambios++;
        else if (r.status === 'sin_ia') return res.status(503).json({ error: 'No hay claves de IA configuradas. Cárgalas en Admin → Config APIs (Groq o Gemini).' });
        else { // 'error' o 'sin_cambios' → reportar el motivo
          fallidos++;
          if (r.rate) rate = true;
          fallos.push({ id: lote[i], motivo: r.motivo || 'desconocido', ...(r.info || {}) });
        }
      } catch (e) {
        fallidos++;
        fallos.push({ id: lote[i], motivo: 'excepcion', detalle: String(e?.message || e).slice(0, 120) });
      }
      if (i < lote.length - 1) await sleep(rate ? 1500 : 500); // pausa entre llamadas (más si hubo límite)
    }
    res.json({ procesados: lote.length, exitosos, sinCambios, fallidos, rate, fallos, restantes: Math.max(0, ids.length - lote.length) });
  } catch (err) {
    next(err);
  }
};

// Llantas "hermanas": misma medida (canónica) + misma marca. Suelen ser el mismo
// producto físico con distinto nombre comercial → comparten imagen.
const hermanasImagen = async (req, res, next) => {
  try {
    const prod = await prisma.producto.findUnique({ where: { id: req.params.id } });
    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
    const norm = prod.medidaNorm || normalizarMedida(prod.medida);
    const hermanas = await prisma.producto.findMany({
      where: {
        id: { not: prod.id }, activo: true,
        marca: { equals: prod.marca, mode: 'insensitive' },
        OR: [{ medidaNorm: norm }, { medida: { equals: prod.medida, mode: 'insensitive' } }],
      },
      select: { id: true, sku: true, marca: true, medida: true, nombreComercial: true, imagenUrl: true },
      orderBy: { nombreComercial: 'asc' },
      take: 300,
    });
    res.json({
      producto: { id: prod.id, imagenUrl: prod.imagenUrl || null },
      conImagen: hermanas.filter(h => h.imagenUrl),
      sinImagen: hermanas.filter(h => !h.imagenUrl),
    });
  } catch (err) {
    next(err);
  }
};

// Detecta el "modelo" a partir del nombre comercial, quitando la marca, la medida
// y palabras comunes. Ej: "Llanta AUSTONE ASR71 195/65R15" -> "ASR71".
function modeloAuto(marca, nombreComercial) {
  let s = ` ${String(nombreComercial || '').toUpperCase()} `;
  if (marca) s = s.split(String(marca).toUpperCase()).join(' ');
  s = s.replace(/\b(LLANTA|LLANTAS|NEUMATICO|NEUMATICOS|TIRE|TIRES|RIN|ARO)\b/g, ' ');
  // Quitar medidas de cualquier familia
  s = s.replace(/\d{2}X[\d.,]+\s*R?\s*\d{2}(\.\d)?/g, ' ');            // flotación 35X12.50R20
  s = s.replace(/\d{3}\s*\/\s*\d{2,3}\s*(ZR|RF|FR|R)?\s*\d{2}(\.\d)?\s*C?/g, ' '); // métrico
  s = s.replace(/\d{3}\s*R\s*\d{2}\s*C?/g, ' ');                       // sin perfil 165R13C
  s = s.replace(/\b\d(?:[.,]\d{2})\s*R?\s*\d{2}\b/g, ' ');             // numérico 7.50R16
  s = s.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return s || '(sin modelo)';
}

// Agrupa el catálogo por marca + modelo con su estado de imagen.
// modo='modelo' (automático, junta variantes) o por nombre comercial exacto.
// Una foto de modelo aplica a TODAS las medidas de ese grupo.
const gruposImagen = async (req, res, next) => {
  try {
    const modo = req.query.modo === 'modelo' ? 'modelo' : 'exacto';
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, sku: true, marca: true, nombreComercial: true, medida: true, imagenUrl: true },
      orderBy: [{ marca: 'asc' }, { nombreComercial: 'asc' }, { medida: 'asc' }],
    });
    const map = new Map();
    for (const p of productos) {
      const modelo = modo === 'modelo'
        ? modeloAuto(p.marca, p.nombreComercial)
        : ((p.nombreComercial || '').trim() || '(sin modelo)');
      const key = `${(p.marca || '').trim().toUpperCase()}|${modelo.toUpperCase()}`;
      if (!map.has(key)) map.set(key, { key, marca: p.marca || '', modelo, total: 0, conImagen: 0, imagenUrl: null, llantas: [] });
      const g = map.get(key);
      g.total++;
      if (p.imagenUrl) { g.conImagen++; if (!g.imagenUrl) g.imagenUrl = p.imagenUrl; }
      g.llantas.push({ id: p.id, sku: p.sku, medida: p.medida, imagenUrl: p.imagenUrl || null });
    }
    const grupos = [...map.values()];
    res.json({
      grupos,
      totales: {
        grupos: grupos.length,
        gruposSinImagen: grupos.filter(g => g.conImagen === 0).length,
        gruposIncompletos: grupos.filter(g => g.conImagen < g.total).length,
        llantas: productos.length,
        llantasSinImagen: productos.filter(p => !p.imagenUrl).length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Excel de llantas SIN imagen (para pegar la URL pública y re-subir por "Actualizar").
// Una fila por producto, ordenado por marca+modelo para pegar fácil la misma URL al grupo.
const exportFaltantesImagen = async (req, res, next) => {
  try {
    const productos = await prisma.producto.findMany({
      where: { activo: true, OR: [{ imagenUrl: null }, { imagenUrl: '' }] },
      select: { sku: true, marca: true, nombreComercial: true, medida: true },
      orderBy: [{ marca: 'asc' }, { nombreComercial: 'asc' }, { medida: 'asc' }],
    });
    const head = ['SKU', 'Marca', 'Modelo', 'Medida', 'URL Imagen (pegar aquí)'];
    const aoa = [head, ...productos.map(p => [p.sku, p.marca || '', p.nombreComercial || '', p.medida, ''])];
    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    const azul = { fill: { fgColor: { rgb: '1F4E79' } }, font: { color: { rgb: 'FFFFFF' }, bold: true }, alignment: { horizontal: 'center' } };
    for (let c = 0; c < head.length; c++) {
      const ref = XLSXStyle.utils.encode_cell({ r: 0, c });
      if (ws[ref]) ws[ref].s = azul;
    }
    ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 26 }, { wch: 14 }, { wch: 40 }];
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Faltan imagen');
    const buf = XLSXStyle.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="llantas_sin_imagen_${new Date().toISOString().slice(0,10)}.xlsx"`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
};

// Sube UN archivo de imagen y lo aplica a varios productos (grupo o selección).
const subirImagenMultiple = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo de imagen requerido' });
    let ids = req.body.ids;
    if (typeof ids === 'string') {
      try { ids = JSON.parse(ids); } catch { ids = ids.split(',').map(s => s.trim()).filter(Boolean); }
    }
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Debes indicar las llantas (ids)' });
    const url = `/uploads/${req.file.filename}`;
    const r = await prisma.producto.updateMany({ where: { id: { in: ids } }, data: { imagenUrl: url } });
    res.json({ ok: true, url, actualizados: r.count });
  } catch (err) {
    next(err);
  }
};

// Aplica una misma imagen a varios productos (propagar a hermanas o tomar de una hermana).
const aplicarImagen = async (req, res, next) => {
  try {
    const { imagenUrl, ids } = req.body;
    if (!imagenUrl || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'imagenUrl e ids son requeridos' });
    }
    const r = await prisma.producto.updateMany({ where: { id: { in: ids } }, data: { imagenUrl } });
    res.json({ ok: true, actualizados: r.count });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar, eliminarMasivo, compatibles, subirImagen, marcas, tipos, medidas, enriquecerConIA, hermanasImagen, aplicarImagen, gruposImagen, subirImagenMultiple, exportFaltantesImagen, incompletos, enriquecerMasivo };
