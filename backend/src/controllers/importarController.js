const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Columnas del modelo Producto en BD
const CAMPOS_BD = [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'medida', label: 'Medida', required: true },
  { key: 'marca', label: 'Marca', required: true },
  { key: 'modelo', label: 'Modelo' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'tipo', label: 'Tipo (AUTO/CAMIONETA/CAMION/MOTO)' },
  { key: 'indice_carga', label: 'Índice de carga' },
  { key: 'velocidad_max', label: 'Velocidad máxima' },
  { key: 'ancho_mm', label: 'Ancho (mm)' },
  { key: 'aro', label: 'Aro' },
  { key: 'tipo_terreno', label: 'Tipo terreno' },
  { key: 'garantia', label: 'Garantía' },
  { key: 'cargaMaxNeumatico', label: 'Carga Maxima Neumatico kg' },
  { key: 'velocidadMaxKmh', label: 'Velocidad Maxima km/h' },
  { key: 'eficienciaCombustible', label: 'Eficiencia Combustible EU' },
  { key: 'eficienciaFrenado', label: 'Eficiencia Frenado EU' },
  { key: 'nivelRuido', label: 'Nivel Ruido dB' },
  { key: 'paisFabricacion', label: 'Pais Fabricacion' },
  { key: 'origenMarca', label: 'Origen Marca' },
  { key: 'precio', label: 'Precio', required: true },
  { key: '_stock_cantidad', label: 'Stock cantidad' },
  { key: '_stock_sede', label: 'Sede del stock' },
];

const preview = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (!data.length) return res.status(400).json({ error: 'Archivo vacío' });

    const headers = data[0].map((h) => String(h || '').trim());
    const rows = data.slice(1, 11); // primeras 10 filas

    res.json({
      columnas: headers.map((h) => ({ nombre: h, sugerencia: sugerirCampo(h) })),
      preview: rows,
      camposBD: CAMPOS_BD,
      totalFilas: data.length - 1,
    });
  } catch (err) {
    next(err);
  }
};

const ejecutar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const { mapeo } = req.body; // { "0": "sku", "1": "medida", ... }
    const columnMap = typeof mapeo === 'string' ? JSON.parse(mapeo) : mapeo;

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const dataRows = rows.slice(1);

    let creados = 0;
    let actualizados = 0;
    const errores = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const record = {};
      for (const [colIdx, campo] of Object.entries(columnMap)) {
        if (campo && campo !== '_skip') {
          record[campo] = row[parseInt(colIdx)];
        }
      }

      if (!record.sku || !record.medida || !record.marca || !record.precio) {
        errores.push({ fila: i + 2, error: 'Campos obligatorios faltantes (sku, medida, marca, precio)' });
        continue;
      }

      try {
        const stockCantidad = record._stock_cantidad ? parseInt(record._stock_cantidad) : null;
        const stockSede = record._stock_sede || null;
        delete record._stock_cantidad;
        delete record._stock_sede;

        const productoData = {
          sku: String(record.sku).trim(),
          medida: String(record.medida).trim(),
          marca: String(record.marca).trim(),
          modelo: record.modelo ? String(record.modelo).trim() : null,
          descripcion: record.descripcion ? String(record.descripcion).trim() : null,
          tipo: normalizarTipo(record.tipo),
          indice_carga: record.indice_carga ? String(record.indice_carga) : null,
          velocidad_max: record.velocidad_max ? String(record.velocidad_max) : null,
          ancho_mm: record.ancho_mm ? parseInt(record.ancho_mm) : null,
          aro: record.aro ? parseInt(record.aro) : null,
          tipo_terreno: record.tipo_terreno ? String(record.tipo_terreno).trim() : null,
          garantia: record.garantia ? String(record.garantia).trim() : null,
          cargaMaxNeumatico: record.cargaMaxNeumatico ? parseInt(record.cargaMaxNeumatico) : null,
          velocidadMaxKmh: record.velocidadMaxKmh ? parseInt(record.velocidadMaxKmh) : null,
          eficienciaCombustible: record.eficienciaCombustible ? String(record.eficienciaCombustible).trim().toUpperCase() : null,
          eficienciaFrenado: record.eficienciaFrenado ? String(record.eficienciaFrenado).trim().toUpperCase() : null,
          nivelRuido: record.nivelRuido ? parseInt(record.nivelRuido) : null,
          paisFabricacion: record.paisFabricacion ? String(record.paisFabricacion).trim() : null,
          origenMarca: record.origenMarca ? String(record.origenMarca).trim() : null,
          precio: parseFloat(String(record.precio).replace(',', '.')),
        };

        const existing = await prisma.producto.findUnique({ where: { sku: productoData.sku } });
        let producto;
        if (existing) {
          producto = await prisma.producto.update({ where: { sku: productoData.sku }, data: productoData });
          actualizados++;
        } else {
          producto = await prisma.producto.create({ data: productoData });
          creados++;
        }

        // Actualizar stock si se proporcionó
        if (stockCantidad !== null && stockSede) {
          const sede = await prisma.sede.findFirst({
            where: { nombre: { contains: String(stockSede), mode: 'insensitive' } },
          });
          if (sede) {
            await prisma.stock.upsert({
              where: { productoId_sedeId: { productoId: producto.id, sedeId: sede.id } },
              update: { cantidad: stockCantidad },
              create: { productoId: producto.id, sedeId: sede.id, cantidad: stockCantidad },
            });
          }
        }
      } catch (rowErr) {
        errores.push({ fila: i + 2, error: rowErr.message });
      }
    }

    res.json({ creados, actualizados, errores, total: dataRows.length });
  } catch (err) {
    next(err);
  }
};

function sugerirCampo(header) {
  const h = header.toLowerCase();
  if (h.includes('sku') || h.includes('codigo') || h.includes('código')) return 'sku';
  if (h.includes('medida') || h.includes('talla') || h.includes('size')) return 'medida';
  if (h.includes('marca') || h.includes('brand')) return 'marca';
  if (h.includes('modelo') || h.includes('model')) return 'modelo';
  if (h.includes('precio') || h.includes('price')) return 'precio';
  if (h.includes('stock') && h.includes('cant')) return '_stock_cantidad';
  if (h.includes('sede') || h.includes('tienda') || h.includes('almacen')) return '_stock_sede';
  if (h.includes('descripcion') || h.includes('descripción')) return 'descripcion';
  if (h.includes('garantia') || h.includes('garantía')) return 'garantia';
  return null;
}

function normalizarTipo(tipo) {
  if (!tipo) return 'AUTO';
  const t = String(tipo).toUpperCase();
  if (t.includes('CAMION') && !t.includes('ETA')) return 'CAMION';
  if (t.includes('CAMIONETA')) return 'CAMIONETA';
  if (t.includes('MOTO')) return 'MOTO';
  return 'AUTO';
}

// ─── ACTUALIZAR STOCK ─────────────────────────────────────────────────────────

/**
 * Retorna columnas del archivo + campos disponibles para match/update en el CRM.
 */
const previewUpdate = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    if (!rows.length) return res.status(400).json({ error: 'Archivo vacío' });

    const headers = rows[0].map((h) => String(h || '').trim());
    const previewRows = rows.slice(1, 6);

    // Sedes para campos de stock dinámicos
    const sedes = await prisma.sede.findMany({ where: { activo: true }, orderBy: { codigoLocal: 'asc' } });

    const camposMatch = [
      { key: 'sku',    label: 'SKU',    descripcion: 'Código único del producto' },
      { key: 'medida', label: 'Medida', descripcion: 'Ej: 195/65R15' },
    ];

    const camposUpdate = [
      { key: 'precioRegular',   label: 'Precio Regular',   grupo: 'Precios' },
      { key: 'precioOferta',    label: 'Precio Oferta',    grupo: 'Precios' },
      { key: 'nombreComercial', label: 'Nombre Comercial', grupo: 'Info producto' },
      { key: 'grupo',           label: 'Grupo',            grupo: 'Info producto' },
      { key: 'tipo',            label: 'Tipo',             grupo: 'Info producto' },
      { key: 'imagenUrl',       label: 'URL Imagen',       grupo: 'Info producto' },
      { key: 'garantia',        label: 'Garantia',         grupo: 'Tecnico' },
      { key: 'fichaTecnica',    label: 'Ficha Tecnica',    grupo: 'Tecnico' },
      { key: 'indice_carga',    label: 'Indice de carga',  grupo: 'Tecnico' },
      { key: 'velocidad_max',   label: 'Indice velocidad', grupo: 'Tecnico' },
      { key: 'cargaMaxNeumatico', label: 'Carga Maxima kg', grupo: 'Tecnico' },
      { key: 'velocidadMaxKmh', label: 'Velocidad Maxima km/h', grupo: 'Tecnico' },
      { key: 'eficienciaCombustible', label: 'Combustible EU', grupo: 'Etiqueta EU' },
      { key: 'eficienciaFrenado', label: 'Frenado EU', grupo: 'Etiqueta EU' },
      { key: 'nivelRuido',      label: 'Ruido dB',         grupo: 'Etiqueta EU' },
      { key: 'paisFabricacion', label: 'Pais Fabricacion', grupo: 'Origen' },
      { key: 'origenMarca',     label: 'Origen Marca',     grupo: 'Origen' },
      ...sedes.map(s => ({
        key: `stock_${s.codigoLocal}`,
        label: `Stock ${s.nombre}`,
        grupo: 'Stock por local',
        sedeId: s.id,
        codigoLocal: s.codigoLocal,
      })),
    ];

    // Auto-sugerir match y update por nombre de columna
    const sugerencias = headers.map(h => {
      const hl = h.toLowerCase();
      let matchSugerido = null;
      if (hl.includes('sku') || hl === 'codigo' || hl === 'código') matchSugerido = 'sku';
      else if (hl.includes('medida') || hl.includes('talla') || hl.includes('size')) matchSugerido = 'medida';

      let updateSugerido = null;
      if (hl.includes('precio') && (hl.includes('regular') || hl.includes('lista'))) updateSugerido = 'precioRegular';
      else if (hl.includes('precio') && (hl.includes('oferta') || hl.includes('especial'))) updateSugerido = 'precioOferta';
      else if (hl.includes('precio') && !hl.includes('oferta')) updateSugerido = 'precioRegular';
      else if (hl.includes('nombre') || hl.includes('comercial') || hl.includes('model')) updateSugerido = 'nombreComercial';
      else if (hl === 'grupo' || hl === 'categoria' || hl === 'categoría') updateSugerido = 'grupo';
      else if (hl.includes('imagen') || hl.includes('foto') || hl.includes('url')) updateSugerido = 'imagenUrl';
      else if (hl.includes('garantia') || hl.includes('garant')) updateSugerido = 'garantia';
      else if (hl.includes('ficha')) updateSugerido = 'fichaTecnica';
      else if (hl.includes('indice') && hl.includes('carga')) updateSugerido = 'indice_carga';
      else if ((hl.includes('indice') && hl.includes('vel')) || hl.includes('velocidad_max')) updateSugerido = 'velocidad_max';
      else if (hl.includes('carga') && (hl.includes('kg') || hl.includes('max'))) updateSugerido = 'cargaMaxNeumatico';
      else if (hl.includes('velocidad') && (hl.includes('km') || hl.includes('max'))) updateSugerido = 'velocidadMaxKmh';
      else if (hl.includes('combustible')) updateSugerido = 'eficienciaCombustible';
      else if (hl.includes('frenado') || hl.includes('freno')) updateSugerido = 'eficienciaFrenado';
      else if (hl.includes('ruido') || hl.includes('db')) updateSugerido = 'nivelRuido';
      else if (hl.includes('fabricacion') || hl.includes('fabricaci')) updateSugerido = 'paisFabricacion';
      else if (hl.includes('origen') && hl.includes('marca')) updateSugerido = 'origenMarca';
      else {
        // stock por local: "stock l0", "stock_l1", "l2", "santa anita", etc.
        const sede = sedes.find(s =>
          hl.includes(s.codigoLocal.toLowerCase()) ||
          hl.includes(s.nombre.toLowerCase()) ||
          hl.includes(s.distrito?.toLowerCase() || '')
        );
        if (sede) updateSugerido = `stock_${sede.codigoLocal}`;
        else if (hl.includes('stock') || hl.includes('cantidad') || hl.includes('qty')) updateSugerido = `stock_${sedes[0]?.codigoLocal || 'L0'}`;
      }

      return { matchSugerido, updateSugerido };
    });

    res.json({
      columnas: headers.map((h, i) => ({ nombre: h, sugerencias: sugerencias[i] })),
      preview: previewRows,
      totalFilas: rows.length - 1,
      camposMatch,
      camposUpdate,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Aplica la actualización masiva con el mapeo elegido por el usuario.
 * matchColIdx   : índice de la columna del archivo usada para buscar en CRM
 * matchCampoCRM : campo del CRM a comparar ('sku' | 'medida')
 * updateMapeo   : { colIdx: campoUpdateCRM } — qué columnas actualizan qué campo
 * soloPreview   : si true, solo cuenta cuántos rows matchearían (dry run)
 */
const aplicarUpdate = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const { matchColIdx, matchCampoCRM, updateMapeo: updateMapeoRaw, soloPreview } = req.body;
    const updateMapeo = typeof updateMapeoRaw === 'string' ? JSON.parse(updateMapeoRaw) : updateMapeoRaw;
    const matchIdx = parseInt(matchColIdx);
    const dryRun = soloPreview === 'true' || soloPreview === true;

    if (isNaN(matchIdx) || !matchCampoCRM) return res.status(400).json({ error: 'matchColIdx y matchCampoCRM son requeridos' });
    if (!updateMapeo || Object.keys(updateMapeo).length === 0) return res.status(400).json({ error: 'Debes seleccionar al menos un campo para actualizar' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    const dataRows = rows.slice(1);

    // Cargar sedes para mapear stock_LX → sedeId
    const sedes = await prisma.sede.findMany({ where: { activo: true } });
    const sedeMap = Object.fromEntries(sedes.map(s => [s.codigoLocal, s.id]));

    let actualizados = 0;
    let noEncontrados = 0;
    const errores = [];
    const cambiosMuestra = []; // máx 10 para mostrar preview

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const valorMatch = String(row[matchIdx] ?? '').trim();
      if (!valorMatch) continue;

      try {
        // Buscar producto
        const producto = await prisma.producto.findFirst({
          where: { [matchCampoCRM]: { equals: valorMatch, mode: 'insensitive' } },
          include: { stocks: { include: { sede: true } } },
        });

        if (!producto) { noEncontrados++; continue; }

        const datosProducto = {};
        const datosStock = {};

        for (const [colIdxStr, campoCRM] of Object.entries(updateMapeo)) {
          const colIdx = parseInt(colIdxStr);
          const valorArchivo = String(row[colIdx] ?? '').trim();
          if (!valorArchivo) continue;

          if (campoCRM.startsWith('stock_')) {
            const codigoLocal = campoCRM.replace('stock_', '').toUpperCase();
            const sedeId = sedeMap[codigoLocal];
            const qty = parseInt(valorArchivo) || 0;
            if (sedeId) datosStock[sedeId] = Math.max(0, qty); // stock nunca negativo
          } else if (campoCRM === 'precioRegular' || campoCRM === 'precioOferta') {
            const num = parseFloat(String(valorArchivo).replace(',', '.'));
            if (!isNaN(num)) datosProducto[campoCRM] = num;
          } else if (['cargaMaxNeumatico', 'velocidadMaxKmh', 'nivelRuido'].includes(campoCRM)) {
            const num = parseInt(valorArchivo);
            if (!isNaN(num)) datosProducto[campoCRM] = num;
          } else if (campoCRM === 'tipo') {
            datosProducto.tipo = normalizarTipo(valorArchivo);
          } else {
            datosProducto[campoCRM] = valorArchivo;
          }
        }

        // Muestra para preview (primeros 10)
        if (cambiosMuestra.length < 10) {
          cambiosMuestra.push({
            matchValor: valorMatch,
            sku: producto.sku,
            medida: producto.medida,
            marca: producto.marca,
            cambiosProducto: datosProducto,
            cambiosStock: Object.entries(datosStock).map(([sedeId, qty]) => {
              const sede = sedes.find(s => s.id === sedeId);
              const stockActual = producto.stocks.find(st => st.sedeId === sedeId)?.cantidad ?? 0;
              return { sede: sede?.nombre || sedeId, codigoLocal: sede?.codigoLocal, antes: stockActual, despues: qty };
            }),
          });
        }

        if (!dryRun) {
          if (Object.keys(datosProducto).length > 0) {
            await prisma.producto.update({ where: { id: producto.id }, data: datosProducto });
          }
          for (const [sedeId, cantidad] of Object.entries(datosStock)) {
            await prisma.stock.upsert({
              where: { productoId_sedeId: { productoId: producto.id, sedeId } },
              update: { cantidad },
              create: { productoId: producto.id, sedeId, cantidad, stockMinimo: 3 },
            });
          }
          actualizados++;
        } else {
          actualizados++; // en dry run contamos igualmente
        }
      } catch (rowErr) {
        errores.push({ fila: i + 2, valor: valorMatch, error: rowErr.message });
      }
    }

    res.json({
      esPreview: dryRun,
      actualizados,
      noEncontrados,
      errores,
      total: dataRows.length,
      cambiosMuestra,
    });
  } catch (err) {
    next(err);
  }
};

// Extrae todas las keys de camposExtra usadas en productos activos
async function getExtraKeys() {
  const muestra = await prisma.producto.findMany({
    select: { camposExtra: true },
    where: { activo: true },
  });
  const seen = new Set();
  const keys = [];
  muestra.forEach(p => {
    if (p.camposExtra && typeof p.camposExtra === 'object' && !Array.isArray(p.camposExtra)) {
      Object.keys(p.camposExtra).forEach(k => { if (!seen.has(k)) { seen.add(k); keys.push(k); } });
    }
  });
  return keys;
}

function extraKeyLabel(k) {
  return k.replace(/^custom_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function toNum(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
  return val;
}

const generarTemplate = async (req, res, next) => {
  try {
    const [sedes, extraKeys] = await Promise.all([
      prisma.sede.findMany({ where: { activo: true }, orderBy: { codigoLocal: 'asc' } }),
      getExtraKeys(),
    ]);

    // Columnas fijas del sistema
    const fixedCols = [
      { key: 'sku',             label: 'SKU',                  nota: '← OBLIGATORIO. Único, ej: LLT-001',         ej1: 'LLT-195-65-R15-001',  ej2: 'LLT-265-70-R17-002' },
      { key: 'medida',          label: 'Medida',               nota: '← OBLIGATORIO. Ej: 195/65R15',              ej1: '195/65R15',            ej2: '265/70R17'           },
      { key: 'marca',           label: 'Marca',                nota: '← OBLIGATORIO. Ej: BRIDGESTONE',            ej1: 'BRIDGESTONE',          ej2: 'MICHELIN'            },
      { key: 'nombreComercial', label: 'Nombre Comercial',     nota: 'Ej: ECOPIA EP150',                          ej1: 'ECOPIA EP150',         ej2: 'LTX FORCE'           },
      { key: 'grupo',           label: 'Grupo',                nota: 'Excelente / Muy Buena / Buena',             ej1: 'Excelente',            ej2: 'Muy Buena'           },
      { key: 'tipo',            label: 'Tipo',                 nota: 'AUTO / CAMIONETA / CAMION / MOTO',          ej1: 'AUTO',                 ej2: 'CAMIONETA'           },
      { key: 'precioRegular',   label: 'Precio Regular',       nota: '← OBLIGATORIO. Número, ej: 250.00',         ej1: 250.00,                 ej2: 480.00                },
      { key: 'precioOferta',    label: 'Precio Oferta',        nota: 'Vacío si no hay oferta',                    ej1: 220.00,                 ej2: ''                    },
      { key: 'descuentoMaximo', label: 'Descuento Máximo %',   nota: 'Número del %, ej: 15',                      ej1: 15,                     ej2: 10                    },
      { key: 'garantia',        label: 'Garantía',             nota: 'Ej: 2 años',                                ej1: '2 años',               ej2: '3 años'              },
      { key: 'fichaTecnica',    label: 'Ficha Técnica',        nota: 'URL o texto técnico',                       ej1: '',                     ej2: ''                    },
      { key: 'indice_carga',    label: 'Índice de carga',      nota: 'Ej: 91',                                    ej1: '91',                   ej2: '121'                 },
      { key: 'velocidad_max',   label: 'Velocidad máxima',     nota: 'Ej: H',                                     ej1: 'H',                    ej2: 'S'                   },
    ];

    fixedCols.push(
      { key: 'cargaMaxNeumatico', label: 'Carga Maxima Neumatico kg', nota: 'Kg por neumatico, ej: 615', ej1: 615, ej2: 1450 },
      { key: 'velocidadMaxKmh', label: 'Velocidad Maxima km/h', nota: 'Km/h maxima, ej: 210', ej1: 210, ej2: 180 },
      { key: 'eficienciaCombustible', label: 'Eficiencia Combustible EU', nota: 'Etiqueta A/B/C/D/E/F/G', ej1: 'B', ej2: 'C' },
      { key: 'eficienciaFrenado', label: 'Eficiencia Frenado EU', nota: 'Etiqueta A/B/C/D/E/F/G', ej1: 'A', ej2: 'B' },
      { key: 'nivelRuido', label: 'Nivel Ruido dB', nota: 'Decibeles, ej: 71', ej1: 71, ej2: 73 },
      { key: 'paisFabricacion', label: 'Pais Fabricacion', nota: 'Ej: Japon, China, Peru', ej1: 'Japon', ej2: 'Tailandia' },
      { key: 'origenMarca', label: 'Origen Marca', nota: 'Pais origen de la marca', ej1: 'Japon', ej2: 'Francia' }
    );

    const stockCols = sedes.map((s, i) => ({
      key: `stock_${s.codigoLocal}`, label: `Stock ${s.nombre}`,
      nota: 'Número entero, ej: 10',
      ej1: i === 0 ? 30 : 0,
      ej2: i === 1 ? 15 : 0,
    }));

    const extraCols = extraKeys.map(k => ({
      key: k, label: extraKeyLabel(k),
      nota: 'Campo personalizado', ej1: '', ej2: '',
    }));

    const allCols = [...fixedCols, ...stockCols, ...extraCols];

    const wsData = [
      allCols.map(c => c.label),
      allCols.map(c => c.nota),
      allCols.map(c => c.ej1),
      allCols.map(c => c.ej2),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = allCols.map((c, i) => {
      const max = Math.max(...wsData.map(row => String(row[i] ?? '').length));
      return { wch: Math.min(max + 2, 32) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    // Hoja instrucciones
    const instrRows = [
      ['CAMPO', 'OBLIGATORIO', 'FORMATO / OPCIONES', 'DESCRIPCIÓN'],
      ['SKU',                'SÍ',  'Texto único',                       'Código único del producto. No puede repetirse.'],
      ['Medida',             'SÍ',  'Ej: 195/65R15',                     'Medida estándar de la llanta.'],
      ['Marca',              'SÍ',  'Ej: BRIDGESTONE',                   'Nombre del fabricante.'],
      ['Nombre Comercial',   'No',  'Texto',                             'Nombre del modelo o línea comercial.'],
      ['Grupo',              'No',  'Excelente / Muy Buena / Buena',     'Grupo de calidad del producto.'],
      ['Tipo',               'No',  'AUTO / CAMIONETA / CAMION / MOTO',  'Si se omite, se asigna AUTO.'],
      ['Precio Regular',     'SÍ',  'Número decimal (ej: 250.00)',       'Precio de lista sin símbolo de moneda.'],
      ['Precio Oferta',      'No',  'Número decimal',                    'Dejar vacío si no hay precio de oferta.'],
      ['Descuento Máximo %', 'No',  'Número (ej: 15)',                   'Porcentaje máximo de descuento permitido.'],
      ['Garantía',           'No',  'Texto (ej: 2 años)',                'Período de garantía del fabricante.'],
      ['Ficha Técnica',      'No',  'URL o texto',                       'URL o descripción técnica del producto.'],
      ['Índice de carga',    'No',  'Número (ej: 91)',                   'Índice de carga estándar.'],
      ['Velocidad máxima',   'No',  'Letra (ej: H, V, S)',               'Código de velocidad máxima.'],
      ...sedes.map(s  => [`Stock ${s.nombre}`, 'No', 'Número entero (ej: 10)', `Stock en sede ${s.nombre} (${s.codigoLocal}).`]),
      ...extraKeys.map(k => [extraKeyLabel(k), 'No', 'Texto libre', 'Campo personalizado del catálogo.']),
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrRows);
    wsInstr['!cols'] = [{ wch: 22 }, { wch: 13 }, { wch: 34 }, { wch: 58 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_productos_llantaland.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

const exportarCatalogo = async (req, res, next) => {
  try {
    const [sedes, extraKeys] = await Promise.all([
      prisma.sede.findMany({ where: { activo: true }, orderBy: { codigoLocal: 'asc' } }),
      getExtraKeys(),
    ]);

    const productos = await prisma.producto.findMany({
      where: { activo: true },
      include: { stocks: { include: { sede: true } } },
      orderBy: [{ marca: 'asc' }, { medida: 'asc' }],
    });

    const fixedCols = [
      { key: 'sku',             label: 'SKU'                  },
      { key: 'medida',          label: 'Medida'               },
      { key: 'marca',           label: 'Marca'                },
      { key: 'nombreComercial', label: 'Nombre Comercial'     },
      { key: 'grupo',           label: 'Grupo'                },
      { key: 'tipo',            label: 'Tipo'                 },
      { key: 'precioRegular',   label: 'Precio Regular'       },
      { key: 'precioOferta',    label: 'Precio Oferta'        },
      { key: 'descuentoMaximo', label: 'Descuento Máximo %'   },
      { key: 'garantia',        label: 'Garantía'             },
      { key: 'fichaTecnica',    label: 'Ficha Técnica'        },
      { key: 'indice_carga',    label: 'Índice de carga'      },
      { key: 'velocidad_max',   label: 'Velocidad máxima'     },
      { key: 'cargaMaxNeumatico', label: 'Carga Maxima Neumatico kg' },
      { key: 'velocidadMaxKmh', label: 'Velocidad Maxima km/h' },
      { key: 'eficienciaCombustible', label: 'Eficiencia Combustible EU' },
      { key: 'eficienciaFrenado', label: 'Eficiencia Frenado EU' },
      { key: 'nivelRuido',      label: 'Nivel Ruido dB' },
      { key: 'paisFabricacion', label: 'Pais Fabricacion' },
      { key: 'origenMarca',     label: 'Origen Marca' },
      { key: '__stockTotal',    label: 'Stock Total'          },
    ];
    const stockCols = sedes.map(s => ({ key: `stock_${s.codigoLocal}`, label: `Stock ${s.nombre}`, codigoLocal: s.codigoLocal }));
    const extraCols  = extraKeys.map(k => ({ key: k, label: extraKeyLabel(k) }));
    const allCols    = [...fixedCols, ...stockCols, ...extraCols];

    const headers = allCols.map(c => c.label);

    const rows = productos.map(prod => {
      const stockMap = {};
      let stockTotal = 0;
      prod.stocks.forEach(s => { stockMap[s.sede.codigoLocal] = s.cantidad; stockTotal += s.cantidad; });

      return allCols.map(col => {
        if (col.key === '__stockTotal') return stockTotal;
        if (col.key.startsWith('stock_')) return stockMap[col.codigoLocal] ?? 0;
        if (extraKeys.includes(col.key)) return prod.camposExtra?.[col.key] ?? '';
        const v = prod[col.key];
        return toNum(v) === '' ? (v ?? '') : toNum(v);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map((h, i) => {
      const sample = [h, ...rows.slice(0, 15).map(r => String(r[i] ?? ''))];
      return { wch: Math.min(Math.max(...sample.map(v => v.length)) + 2, 32) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Catalogo');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="catalogo_llantaland_${fecha}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

module.exports = { preview, ejecutar, previewUpdate, aplicarUpdate, generarTemplate, exportarCatalogo };
