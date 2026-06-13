const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { paginar } = require('../utils/helpers');

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

    if (medida) where.medida = { contains: medida, mode: 'insensitive' };
    if (marca)  where.marca  = { contains: marca,  mode: 'insensitive' };
    if (tipo)   where.tipo   = tipo;
    if (q) {
      where.OR = [
        { sku:            { contains: q, mode: 'insensitive' } },
        { medida:         { contains: q, mode: 'insensitive' } },
        { marca:          { contains: q, mode: 'insensitive' } },
        { nombreComercial:{ contains: q, mode: 'insensitive' } },
        { grupo:          { contains: q, mode: 'insensitive' } },
      ];
    }

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
    const producto = await prisma.producto.create({ data: req.body });
    res.status(201).json(producto);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const producto = await prisma.producto.update({
      where: { id: req.params.id },
      data: req.body,
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
    const productos = await prisma.producto.findMany({
      where: { activo: true, medida: { contains: medida, mode: 'insensitive' } },
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
    if (q) where.medida = { contains: String(q), mode: 'insensitive' };
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

const enriquecerConIA = async (req, res, next) => {
  try {
    const prod = await prisma.producto.findUnique({ where: { id: req.params.id } });
    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

    const missing = TECH_FIELDS.filter(f => prod[f] === null || prod[f] === undefined || prod[f] === '');
    if (missing.length === 0) {
      return res.json({ mensaje: 'Producto ya tiene información completa', producto: prod });
    }

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

IMPORTANTE para el campo "fichaTecnica": Si está en la lista, genera una ficha técnica completa y detallada en español (mínimo 3 párrafos) que incluya: descripción del neumático, aplicaciones recomendadas, ventajas de la banda de rodamiento, tecnologías de construcción, condiciones de uso ideales, y argumentos de venta para el vendedor. Debe ser rica y útil para que el vendedor asesore correctamente al cliente.

Formato de ejemplo:
{
  "indice_carga": "91",
  "velocidad_max": "H",
  "garantia": "2 años",
  "cargaMaxNeumatico": 615,
  "velocidadMaxKmh": 210,
  "eficienciaCombustible": "B",
  "eficienciaFrenado": "A",
  "nivelRuido": 71,
  "paisFabricacion": "Japón",
  "origenMarca": "Japón",
  "fichaTecnica": "Descripción técnica completa del neumático..."
}`;

    let datos = null;

    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 500,
            response_format: { type: 'json_object' },
          }),
        });
        if (groqResp.ok) {
          const d = await groqResp.json();
          const content = d.choices?.[0]?.message?.content;
          if (content) datos = JSON.parse(content);
        }
      } catch (e) {
        console.warn('[IA] Groq falló:', e.message);
      }
    }

    if (!datos) {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) return res.status(503).json({ error: 'No hay claves de IA configuradas (GROQ_API_KEY o GEMINI_API_KEY)' });
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
          }),
        }
      );
      if (!geminiResp.ok) {
        return res.status(502).json({ error: 'IA no disponible', detalle: await geminiResp.text() });
      }
      const gd = await geminiResp.json();
      const content = gd.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) datos = JSON.parse(content);
    }

    if (!datos) return res.status(502).json({ error: 'No se pudo obtener respuesta de la IA' });

    const INT_FIELDS  = ['cargaMaxNeumatico', 'velocidadMaxKmh', 'nivelRuido'];
    const STR_FIELDS  = ['indice_carga', 'velocidad_max', 'garantia', 'eficienciaCombustible', 'eficienciaFrenado', 'paisFabricacion', 'origenMarca'];
    const update = {};

    for (const f of missing) {
      if (datos[f] == null) continue;
      if (f === 'fichaTecnica') {
        update[f] = String(datos[f]).trim();
      } else if (INT_FIELDS.includes(f)) {
        const n = parseInt(datos[f]);
        if (!isNaN(n)) update[f] = n;
      } else if (STR_FIELDS.includes(f)) {
        update[f] = String(datos[f]).trim().substring(0, 50);
      }
    }

    if (Object.keys(update).length === 0) {
      return res.json({ mensaje: 'La IA no pudo determinar los campos faltantes', producto: prod });
    }

    const productoActualizado = await prisma.producto.update({
      where: { id: req.params.id },
      data: update,
      include: { stocks: { include: { sede: true }, orderBy: { sede: { codigoLocal: 'asc' } } } },
    });

    res.json({
      mensaje: `${Object.keys(update).length} campos completados con IA`,
      camposActualizados: Object.keys(update),
      producto: productoActualizado,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar, eliminarMasivo, compatibles, subirImagen, marcas, tipos, medidas, enriquecerConIA };
