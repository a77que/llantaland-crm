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
            if (sedeId) datosStock[sedeId] = parseInt(valorArchivo) || 0;
          } else if (campoCRM === 'precioRegular' || campoCRM === 'precioOferta') {
            const num = parseFloat(String(valorArchivo).replace(',', '.'));
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

module.exports = { preview, ejecutar, previewUpdate, aplicarUpdate };
