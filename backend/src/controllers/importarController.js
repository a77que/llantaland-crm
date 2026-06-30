const XLSX = require('xlsx');
const XLSXStyle = require('xlsx-js-style');
const { PrismaClient } = require('@prisma/client');
const { normalizarMedida, dimensionesMedida } = require('../utils/medida');

const prisma = new PrismaClient();

// Traduce los errores técnicos de Prisma a mensajes entendibles en español
function explicarErrorPrisma(err) {
  if (err?.code === 'P2000') {
    return `El valor es demasiado largo para el campo "${err.meta?.column_name || 'desconocido'}"`;
  }
  if (err?.code === 'P2002') {
    const campos = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : (err.meta?.target || 'campo único');
    return `Ya existe otro producto con el mismo valor en: ${campos}`;
  }
  if (err?.code === 'P2025') {
    return 'El producto ya no existe en la base de datos';
  }
  if (err?.name === 'PrismaClientValidationError' || /Invalid `prisma\./.test(err?.message || '')) {
    const m = (err.message || '').match(/Argument `(\w+)`[:\s]([^\n]*)/);
    if (m) {
      if (/must not be null/.test(m[2])) return `El campo "${m[1]}" quedó vacío o con un valor no válido (revisa que sea del tipo correcto, ej. números sin símbolos de moneda)`;
      return `Valor inválido para el campo "${m[1]}"`;
    }
    // Mostrar un fragmento útil del error real para facilitar el diagnóstico
    const unknown = (err.message || '').match(/Unknown argument `(\w+)`/);
    if (unknown) return `Campo desconocido "${unknown[1]}" — revisa el mapeo de columnas`;
    const lastLine = String(err.message || '').split('\n').map(l => l.trim()).filter(Boolean).pop() || '';
    return lastLine ? `Error de validación: ${lastLine.slice(0, 150)}` : 'Los datos de la fila tienen un formato inválido para la base de datos';
  }
  // Recortar mensajes largos de otros errores
  const lineas = String(err?.message || 'Error desconocido').split('\n').map(l => l.trim()).filter(Boolean);
  return lineas[lineas.length - 1].slice(0, 200);
}

// Campos base del modelo Producto (sin stock dinámico por sede)
const CAMPOS_BD_BASE = [
  { key: '_skip',                label: '— No importar —' },
  { key: 'sku',                  label: 'SKU', required: true },
  { key: 'medida',               label: 'Medida', required: true },
  { key: 'marca',                label: 'Marca', required: true },
  { key: 'nombreComercial',      label: 'Nombre Comercial' },
  { key: 'modelo',               label: 'Modelo' },
  { key: 'runFlat',              label: 'Run-Flat (Sí/No)' },
  { key: 'tipoLlanta',           label: 'Tipo de llanta' },
  { key: 'tipoVehiculo',         label: 'Tipo de vehículo' },
  { key: 'grupo',                label: 'Grupo' },
  { key: 'precioRegular',        label: 'Precio Regular', required: true },
  { key: 'precioOferta',         label: 'Precio Oferta' },
  { key: 'descuentoMaximo',      label: 'Descuento Máximo %' },
  { key: 'garantia',             label: 'Garantía' },
  { key: 'fichaTecnica',         label: 'Ficha Técnica' },
  { key: 'indice_carga',         label: 'Índice de carga' },
  { key: 'velocidad_max',        label: 'Índice de Velocidad' },
  { key: 'cargaMaxNeumatico',    label: 'Carga Maxima Neumatico kg' },
  { key: 'velocidadMaxKmh',      label: 'Velocidad Maxima km/h' },
  { key: 'eficienciaCombustible',label: 'Eficiencia Combustible EU' },
  { key: 'eficienciaFrenado',    label: 'Eficiencia Frenado EU' },
  { key: 'nivelRuido',           label: 'Nivel Ruido dB' },
  { key: 'paisFabricacion',      label: 'Pais Fabricacion' },
  { key: 'origenMarca',          label: 'Origen Marca' },
  { key: 'precioProveedor',      label: 'Precio Proveedor' },
  { key: 'precioReferencialVenta', label: 'Precio Referencial Venta' },
  { key: 'stockTotal',           label: 'Stock Total (almacén principal)' },
];

const preview = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (!data.length) return res.status(400).json({ error: 'Archivo vacío' });

    const sedes = await prisma.sede.findMany({ where: { activo: true }, orderBy: { codigoLocal: 'asc' } });

    const camposBD = [
      ...CAMPOS_BD_BASE,
      ...sedes.map(s => ({ key: `stock_${s.codigoLocal}`, label: `Stock ${s.nombre}` })),
    ];

    const headers = data[0].map((h) => String(h || '').trim());
    const rows = data.slice(1, 11); // primeras 10 filas para preview (fila 2 = notas, luego ejemplos)

    // Evitar sugerencias duplicadas: si dos columnas apuntan al mismo campo, solo la primera gana
    const camposUsados = new Set();
    const sugerencias = headers.map((h) => {
      let s = sugerirCampo(h, sedes);
      if (s !== '_skip' && camposUsados.has(s)) s = '_skip';
      if (s !== '_skip') camposUsados.add(s);
      return s;
    });

    res.json({
      columnas: headers.map((h, i) => ({ nombre: h, sugerencia: sugerencias[i] })),
      preview: rows,
      camposBD,
      totalFilas: data.length - 1,
    });
  } catch (err) {
    next(err);
  }
};

const ejecutar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const { mapeo } = req.body;
    const columnMap = typeof mapeo === 'string' ? JSON.parse(mapeo) : mapeo;

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // La plantilla tiene: fila 1=headers, fila 2=notas, filas 3-4=ejemplos → saltar hasta la primera fila con SKU real
    const skuColIdx = Object.entries(columnMap).find(([, campo]) => campo === 'sku')?.[0];
    const dataRows = [];
    rows.slice(1).forEach((row, idx) => {
      const val = skuColIdx !== undefined ? String(row[parseInt(skuColIdx)] || '').trim() : '';
      // Ignorar filas que son notas/ejemplos de la plantilla (empiezan con "←" o son los 2 ejemplos)
      if (val && !val.startsWith('←') && val !== 'LLT-195-65-R15-001' && val !== 'LLT-265-70-R17-002') {
        dataRows.push({ row, filaExcel: idx + 2 }); // +2: 1 por headers + 1 porque Excel cuenta desde 1
      }
    });

    // Pre-cargar sedes para mapear stock_LX → sedeId sin queries por fila
    const sedes = await prisma.sede.findMany({ where: { activo: true }, orderBy: { codigoLocal: 'asc' } });
    const sedeMap = Object.fromEntries(sedes.map(s => [s.codigoLocal, s.id]));
    const sedePrincipal = sedes[0] || null; // para la columna "Stock Total"

    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    const errores = [];
    const resultadosFila = []; // por índice de dataRows: { estado, detalle }

    const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? null : n; };
    const int = (v) => { const n = parseInt(v); return isNaN(n) ? null : n; };
    const str = (v) => v != null && String(v).trim() !== '' ? String(v).trim() : null;
    const eu  = (v) => { const s = str(v); return s ? s.toUpperCase().charAt(0) : null; };
    const bool = (v) => {
      const s = str(v); if (s === null) return undefined;
      const l = s.toLowerCase();
      if (['si','sí','yes','y','true','1','runflat','run-flat','run flat','rf','x','verdadero'].includes(l)) return true;
      if (['no','n','false','0','falso'].includes(l)) return false;
      return undefined;
    };

    // ── Fase 1: parsear y validar TODAS las filas (sin tocar la BD) ──
    const validas = [];
    dataRows.forEach(({ row, filaExcel }, idx) => {
      const record = {};
      for (const [colIdx, campo] of Object.entries(columnMap)) {
        if (!campo || campo === '_skip') continue;
        const valor = row[parseInt(colIdx)];
        if (valor === undefined || valor === null || String(valor).trim() === '') continue;
        record[campo] = valor;
      }

      const precioRaw = record.precioRegular ?? record.precio;
      const tienePrecio = precioRaw != null && String(precioRaw).trim() !== '';
      // Precio Regular YA NO es obligatorio. Solo SKU, Medida y Marca lo son.
      const faltantes = [];
      if (!record.sku) faltantes.push('SKU');
      if (!record.medida) faltantes.push('Medida');
      if (!record.marca) faltantes.push('Marca');
      if (faltantes.length > 0) {
        errores.push({ fila: filaExcel, error: `Campos obligatorios faltantes: ${faltantes.join(', ')}` });
        resultadosFila[idx] = { estado: 'error', detalle: `Faltan: ${faltantes.join(', ')}` };
        return;
      }
      if (tienePrecio && num(precioRaw) === null) {
        errores.push({ fila: filaExcel, error: `Precio Regular no es un número válido: "${precioRaw}". Usa solo números, sin símbolos de moneda (ej: 250.00)` });
        resultadosFila[idx] = { estado: 'error', detalle: 'Precio no numérico' };
        return;
      }

      const productoData = {
        sku:                   String(record.sku).trim(),
        medida:                String(record.medida).trim(),
        medidaNorm:            normalizarMedida(String(record.medida).trim()),
        marca:                 String(record.marca).trim(),
        nombreComercial:       str(record.nombreComercial),
        modelo:                str(record.modelo),
        runFlat:               bool(record.runFlat),
        tipoLlanta:            str(record.tipoLlanta),
        tipoVehiculo:          str(record.tipoVehiculo),
        grupo:                 str(record.grupo),
        precioRegular:         tienePrecio ? num(precioRaw) : undefined, // omitir si no viene (no pisa el existente)
        precioOferta:          num(record.precioOferta) ?? undefined,
        descuentoMaximo:       num(record.descuentoMaximo) ?? undefined,
        garantia:              str(record.garantia),
        fichaTecnica:          str(record.fichaTecnica),
        indice_carga:          str(record.indice_carga),
        velocidad_max:         str(record.velocidad_max),
        cargaMaxNeumatico:     int(record.cargaMaxNeumatico),
        velocidadMaxKmh:       int(record.velocidadMaxKmh),
        eficienciaCombustible: eu(record.eficienciaCombustible),
        eficienciaFrenado:     eu(record.eficienciaFrenado),
        nivelRuido:            int(record.nivelRuido),
        paisFabricacion:       str(record.paisFabricacion),
        origenMarca:           str(record.origenMarca),
        precioProveedor:       num(record.precioProveedor) ?? undefined,
        precioReferencialVenta: num(record.precioReferencialVenta) ?? undefined,
        activo:                true, // re-importar un producto eliminado lo reactiva
      };
      Object.keys(productoData).forEach(k => productoData[k] === undefined && delete productoData[k]);

      // Stock por sede pre-resuelto a { sedeId, cantidad }
      const stockEntries = [];
      for (const [campo, valor] of Object.entries(record)) {
        if (!campo.startsWith('stock_')) continue;
        const cantidad = int(valor);
        if (cantidad === null) continue;
        const sedeId = sedeMap[campo.replace('stock_', '').toUpperCase()];
        if (sedeId) stockEntries.push({ sedeId, cantidad });
      }
      // Stock Total: si no se especificó stock por tienda, va al almacén principal.
      if (stockEntries.length === 0 && record.stockTotal != null && String(record.stockTotal).trim() !== '') {
        const cantidad = int(record.stockTotal);
        if (cantidad !== null && sedePrincipal) stockEntries.push({ sedeId: sedePrincipal.id, cantidad });
      }

      validas.push({ idx, filaExcel, sku: productoData.sku, productoData, stockEntries });
    });

    // ── Fase 2: traer los productos que ya existen (completos) para detectar cambios ──
    const skus = [...new Set(validas.map(v => v.sku))];
    const existentesMap = new Map(); // sku → producto actual
    const TAM_IN = 1000; // dividir el IN para no exceder límites de parámetros
    for (let i = 0; i < skus.length; i += TAM_IN) {
      const lote = await prisma.producto.findMany({ where: { sku: { in: skus.slice(i, i + TAM_IN) } } });
      lote.forEach(p => existentesMap.set(p.sku, p));
    }

    // Compara el valor entrante contra el actual (normaliza Decimals/números).
    const norm = (x) => {
      if (x === null || x === undefined) return '';
      if (typeof x === 'object' && typeof x.toNumber === 'function') return String(x.toNumber());
      if (typeof x === 'number') return String(x);
      return String(x).trim();
    };
    const sinCambiosRespecto = (actual, data) => Object.keys(data).every(k => {
      if (k === 'medidaNorm' || k === 'activo') return true; // derivados / banderas
      return norm(actual[k]) === norm(data[k]);
    });

    // ── Fase 3: escribir en BD en lotes paralelos (rápido para miles de filas) ──
    const CONCURRENCIA = 20;
    for (let i = 0; i < validas.length; i += CONCURRENCIA) {
      const lote = validas.slice(i, i + CONCURRENCIA);
      await Promise.all(lote.map(async (v) => {
        try {
          const actual = existentesMap.get(v.sku);
          let estado;
          if (!actual) {
            // Producto nuevo: precioRegular es obligatorio en BD → por defecto 0 si no vino.
            const data = { ...v.productoData };
            if (data.precioRegular == null) data.precioRegular = 0;
            const producto = await prisma.producto.create({ data });
            await aplicarStock(producto.id, v.stockEntries);
            creados++; estado = 'creado';
          } else if (sinCambiosRespecto(actual, v.productoData) && v.stockEntries.length === 0) {
            sinCambios++; estado = 'sin_cambios';
          } else {
            await prisma.producto.update({ where: { sku: v.sku }, data: v.productoData });
            await aplicarStock(actual.id, v.stockEntries);
            actualizados++; estado = 'actualizado';
          }
          resultadosFila[v.idx] = { estado, detalle: estado === 'creado' ? 'Producto nuevo' : estado === 'actualizado' ? 'Datos actualizados' : 'Sin cambios' };
        } catch (rowErr) {
          const msg = explicarErrorPrisma(rowErr);
          errores.push({ fila: v.filaExcel, error: msg });
          resultadosFila[v.idx] = { estado: 'error', detalle: msg };
        }
      }));
    }

    // Reporte Excel con filas sombreadas según resultado
    let reporteBase64 = null;
    if (dataRows.length <= 10000) {
      try { reporteBase64 = generarReporteCrear(rows[0], dataRows.map(d => d.row), resultadosFila); }
      catch (e) { console.error('No se pudo generar el reporte de creación:', e.message); }
    }

    res.json({ creados, actualizados, sinCambios, errores, total: dataRows.length, reporteBase64 });
  } catch (err) {
    next(err);
  }
};

function sugerirCampo(header, sedes = []) {
  const h = header.toLowerCase().trim();

  // Columnas AUTO de la plantilla → ignorar
  if (h.includes('[auto]')) return '_skip';

  // Stock Total: si no se llena el stock por tienda, va al almacén principal
  if (h.includes('stock') && h.includes('total')) return 'stockTotal';
  // Ancho/Perfil/Radio del catálogo exportado — derivados de Medida, no importar
  if (/^(ancho|perfil|radio)\b/.test(h)) return '_skip';

  // Mapeo exacto de las etiquetas de la plantilla
  const EXACTO = {
    'sku':                          'sku',
    'medida':                       'medida',
    'marca':                        'marca',
    'nombre comercial':             'nombreComercial',
    'modelo':                       'modelo',
    'run-flat':                     'runFlat',
    'run flat':                     'runFlat',
    'runflat':                      'runFlat',
    'run-flat (sí/no)':             'runFlat',
    'run-flat (si/no)':             'runFlat',
    'tipo de llanta':               'tipoLlanta',
    'tipo llanta':                  'tipoLlanta',
    'tipo de vehiculo':             'tipoVehiculo',
    'tipo de vehículo':             'tipoVehiculo',
    'tipo vehiculo':                'tipoVehiculo',
    'tipo de carro':                'tipoVehiculo',
    'grupo':                        'grupo',
    'tipo':                         'tipoVehiculo',
    'precio regular':               'precioRegular',
    'precio oferta':                'precioOferta',
    'descuento máximo %':           'descuentoMaximo',
    'descuento maximo %':           'descuentoMaximo',
    'garantía':                     'garantia',
    'garantia':                     'garantia',
    'ficha técnica':                'fichaTecnica',
    'ficha tecnica':                'fichaTecnica',
    'índice de carga':              'indice_carga',
    'indice de carga':              'indice_carga',
    'índice de velocidad':          'velocidad_max',
    'indice de velocidad':          'velocidad_max',
    'carga maxima neumatico kg':    'cargaMaxNeumatico',
    'velocidad maxima km/h':        'velocidadMaxKmh',
    'eficiencia combustible eu':    'eficienciaCombustible',
    'eficiencia frenado eu':        'eficienciaFrenado',
    'nivel ruido db':               'nivelRuido',
    'pais fabricacion':             'paisFabricacion',
    'origen marca':                 'origenMarca',
    'precio proveedor':             'precioProveedor',
    'precio referencial venta':     'precioReferencialVenta',
    'precio referencial':           'precioReferencialVenta',
  };
  if (EXACTO[h]) return EXACTO[h];

  // Columnas de stock por sede: "stock tienda santa anita", "stock l0", etc.
  if (h.startsWith('stock ') || h.includes('stock')) {
    const texto = h.replace('stock', '').replace(/_/g, ' ').trim();
    const sede = sedes.find(s =>
      texto.includes(s.nombre.toLowerCase()) ||
      texto === s.codigoLocal.toLowerCase() ||
      texto.includes(s.codigoLocal.toLowerCase())
    );
    if (sede) return `stock_${sede.codigoLocal}`;
  }

  // Coincidencias parciales para archivos externos (no plantilla)
  if (h.includes('sku') || (h.includes('cod') && !h.includes('local'))) return 'sku';
  if (h.includes('medida') || h.includes('talla') || h.includes('size')) return 'medida';
  if (h.includes('marca') || h.includes('brand'))                         return 'marca';
  if (h.includes('run') && h.includes('flat'))                            return 'runFlat';
  if (h.includes('runflat'))                                              return 'runFlat';
  if (h.includes('modelo'))                                               return 'modelo';
  if (h.includes('nombre') || h.includes('comercial') || h.includes('model')) return 'nombreComercial';
  if (h.includes('precio') && h.includes('proveedor'))                     return 'precioProveedor';
  if (h.includes('proveedor') || h.includes('costo'))                      return 'precioProveedor';
  if (h.includes('precio') && (h.includes('referencial') || h.includes('mercado'))) return 'precioReferencialVenta';
  if (h.includes('precio') && (h.includes('regular') || h.includes('lista')))  return 'precioRegular';
  if (h.includes('precio') && (h.includes('oferta') || h.includes('especial'))) return 'precioOferta';
  if (h.includes('precio') || h.includes('price'))                         return 'precioRegular';
  if (h.includes('descuento') || h.includes('discount'))                   return 'descuentoMaximo';
  if (h.includes('garantia') || h.includes('garantía'))                    return 'garantia';
  if (h.includes('ficha'))                                                  return 'fichaTecnica';
  if (h.includes('indice') && h.includes('carga'))                         return 'indice_carga';
  if (h.includes('indice') && h.includes('vel'))                           return 'velocidad_max';
  if (h.includes('carga') && (h.includes('kg') || h.includes('max')))      return 'cargaMaxNeumatico';
  if (h.includes('velocidad') && h.includes('km'))                         return 'velocidadMaxKmh';
  if (h.includes('combustible'))                                            return 'eficienciaCombustible';
  if (h.includes('frenado') || h.includes('freno'))                        return 'eficienciaFrenado';
  if (h.includes('ruido') || h.includes('ruido') || h.includes('db'))      return 'nivelRuido';
  if (h.includes('fabricacion') || h.includes('fabricación'))              return 'paisFabricacion';
  if (h.includes('origen') && h.includes('marca'))                         return 'origenMarca';
  if (h.includes('tipo') && h.includes('llanta'))                          return 'tipoLlanta';
  if (h.includes('tipo') && (h.includes('veh') || h.includes('carro') || h.includes('auto'))) return 'tipoVehiculo';
  if (h.includes('tipo'))                                                   return 'tipoVehiculo';
  if (h.includes('grupo') || h.includes('categoria'))                      return 'grupo';

  // Stock con nombre de sede en la columna
  const sedeMatch = sedes.find(s =>
    h.includes(s.nombre.toLowerCase()) || h.includes(s.codigoLocal.toLowerCase())
  );
  if (sedeMatch) return `stock_${sedeMatch.codigoLocal}`;

  return '_skip';
}

function normalizarTipo(tipo) {
  // Categoría libre: se guarda lo que el usuario escriba (en mayúsculas). Vacío → AUTO.
  const t = String(tipo ?? '').trim();
  return t ? t.toUpperCase() : 'AUTO';
}

/**
 * Genera un Excel (base64) con las filas del archivo subido sombreadas según resultado:
 * verde = actualizado, naranja = no encontrado en CRM, rojo = error, gris = fila vacía.
 * Agrega columnas RESULTADO y DETALLE al final.
 */
function generarReporteUpdate(headers, dataRows, resultadosFila, dryRun) {
  const ESTILOS = {
    actualizado:   { fill: 'C6EFCE', font: '006100' },
    no_encontrado: { fill: 'FFD8A8', font: '9C5700' },
    error:         { fill: 'FFC7CE', font: '9C0006' },
    vacio:         { fill: 'EFEFEF', font: '777777' },
  };
  const LABEL = {
    actualizado:   dryRun ? 'SE ACTUALIZARÁ' : 'ACTUALIZADO',
    no_encontrado: 'NO ENCONTRADO EN CRM',
    error:         'ERROR',
    vacio:         'FILA VACÍA',
  };

  const head = [...headers.map(h => String(h ?? '')), 'RESULTADO', 'DETALLE'];
  const aoa = [head, ...dataRows.map((row, i) => {
    const r = resultadosFila[i] || { estado: 'vacio', detalle: '' };
    return [...headers.map((_, c) => row[c] ?? ''), LABEL[r.estado], r.detalle || ''];
  })];

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
  const nCols = head.length;

  // Header en negrita
  for (let c = 0; c < nCols; c++) {
    const addr = XLSXStyle.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'DDEBF7' } } };
  }

  // Sombrear cada fila según su estado
  for (let r = 0; r < dataRows.length; r++) {
    const estado = (resultadosFila[r] || {}).estado || 'vacio';
    const st = ESTILOS[estado];
    for (let c = 0; c < nCols; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: r + 1, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = {
        fill: { patternType: 'solid', fgColor: { rgb: st.fill } },
        font: { color: { rgb: st.font } },
      };
    }
  }

  ws['!cols'] = head.map(h => ({ wch: Math.min(Math.max(String(h).length + 2, 10), 32) }));

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Resultado');
  return XLSXStyle.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Wrapper base64 para compatibilidad con aplicarUpdate (JSON response)
function generarReporteUpdateBase64(headers, dataRows, resultadosFila, dryRun) {
  return generarReporteUpdate(headers, dataRows, resultadosFila, dryRun).toString('base64');
}

// Upsert de stock por sede para un producto.
async function aplicarStock(productoId, stockEntries) {
  for (const { sedeId, cantidad } of stockEntries) {
    await prisma.stock.upsert({
      where: { productoId_sedeId: { productoId, sedeId } },
      update: { cantidad },
      create: { productoId, sedeId, cantidad },
    });
  }
}

/**
 * Reporte Excel (base64) de la importación de NUEVOS productos: cada fila del
 * archivo sombreada según resultado (verde=creado, azul=actualizado,
 * gris=sin cambios, rojo=error) + columnas RESULTADO y DETALLE.
 */
function generarReporteCrear(headers, dataRowsRaw, resultadosFila) {
  const ESTILOS = {
    creado:      { fill: 'C6EFCE', font: '006100' },
    actualizado: { fill: 'BDD7EE', font: '1F4E79' },
    sin_cambios: { fill: 'EFEFEF', font: '777777' },
    error:       { fill: 'FFC7CE', font: '9C0006' },
    vacio:       { fill: 'FFFFFF', font: '000000' },
  };
  const LABEL = { creado: 'CREADO', actualizado: 'ACTUALIZADO', sin_cambios: 'SIN CAMBIOS', error: 'ERROR', vacio: '' };

  const head = [...(headers || []).map(h => String(h ?? '')), 'RESULTADO', 'DETALLE'];
  const aoa = [head, ...dataRowsRaw.map((row, i) => {
    const r = resultadosFila[i] || { estado: 'vacio', detalle: '' };
    return [...(headers || []).map((_, c) => row[c] ?? ''), LABEL[r.estado] || '', r.detalle || ''];
  })];

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
  const nCols = head.length;
  for (let c = 0; c < nCols; c++) {
    const addr = XLSXStyle.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'DDEBF7' } } };
  }
  for (let r = 0; r < dataRowsRaw.length; r++) {
    const estado = (resultadosFila[r] || {}).estado || 'vacio';
    const st = ESTILOS[estado] || ESTILOS.vacio;
    for (let c = 0; c < nCols; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: r + 1, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: st.fill } }, font: { color: { rgb: st.font } } };
    }
  }
  ws['!cols'] = head.map(h => ({ wch: Math.min(Math.max(String(h).length + 2, 10), 32) }));
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Resultado');
  return XLSXStyle.write(wb, { type: 'buffer', bookType: 'xlsx' }).toString('base64');
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
      { key: 'precioProveedor', label: 'Precio Proveedor', grupo: 'Precios' },
      { key: 'precioReferencialVenta', label: 'Precio Referencial Venta', grupo: 'Precios' },
      { key: 'nombreComercial', label: 'Nombre Comercial', grupo: 'Info producto' },
      { key: 'modelo',          label: 'Modelo',           grupo: 'Info producto' },
      { key: 'runFlat',         label: 'Run-Flat (Sí/No)', grupo: 'Info producto' },
      { key: 'tipoLlanta',      label: 'Tipo de llanta',   grupo: 'Info producto' },
      { key: 'tipoVehiculo',    label: 'Tipo de vehículo', grupo: 'Info producto' },
      { key: 'grupo',           label: 'Grupo',            grupo: 'Info producto' },
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
      else if (!hl.includes('total')) {
        // stock por local: "stock l0", "stock_l1", "l2", "santa anita", etc.
        // "Stock Total" se excluye: es un valor CALCULADO (suma de almacenes), nunca se sube
        const sede = sedes.find(s =>
          hl.includes(s.codigoLocal.toLowerCase()) ||
          hl.includes(s.nombre.toLowerCase()) ||
          (s.distrito && hl.includes(s.distrito.toLowerCase()))
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
    const noEncontradosLista = []; // valores de match que no existen en el CRM
    const resultadosFila = new Array(dataRows.length); // estado por fila (alineado por índice)
    const cambiosMuestra = []; // máx 10 para mostrar preview

    // ── Pre-cargar productos activos en memoria (1 consulta, match insensible a mayúsculas) ──
    const todosProd = await prisma.producto.findMany({ where: { activo: true }, include: { stocks: true } });
    const porMatch = new Map();
    for (const p of todosProd) {
      const key = String(p[matchCampoCRM] ?? '').trim().toLowerCase();
      if (key && !porMatch.has(key)) porMatch.set(key, p);
    }

    // ── Fase 1: planificar cada fila (sin escribir) ──
    const aActualizar = []; // { producto, datosProducto, datosStock }
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const valorMatch = String(row[matchIdx] ?? '').trim();
      if (!valorMatch) { resultadosFila[i] = { estado: 'vacio', detalle: 'Sin valor en la columna de match' }; continue; }

      const producto = porMatch.get(valorMatch.toLowerCase());
      if (!producto) {
        noEncontrados++;
        noEncontradosLista.push({ fila: i + 2, valor: valorMatch });
        resultadosFila[i] = { estado: 'no_encontrado', detalle: `"${valorMatch}" no existe en el CRM` };
        continue;
      }

      const datosProducto = {};
      const datosStock = {};
      for (const [colIdxStr, campoCRM] of Object.entries(updateMapeo)) {
        if (!campoCRM || campoCRM === '_skip') continue; // ignorar columnas marcadas como "No actualizar"
        const valorArchivo = String(row[parseInt(colIdxStr)] ?? '').trim();
        if (!valorArchivo) continue;
        if (campoCRM.startsWith('stock_')) {
          const sedeId = sedeMap[campoCRM.replace('stock_', '').toUpperCase()];
          if (sedeId) datosStock[sedeId] = Math.max(0, parseInt(valorArchivo) || 0);
        } else if (['precioRegular', 'precioOferta', 'precioProveedor', 'precioReferencialVenta'].includes(campoCRM)) {
          const n = parseFloat(String(valorArchivo).replace(',', '.'));
          if (!isNaN(n)) datosProducto[campoCRM] = n;
        } else if (['cargaMaxNeumatico', 'velocidadMaxKmh', 'nivelRuido'].includes(campoCRM)) {
          const n = parseInt(valorArchivo);
          if (!isNaN(n)) datosProducto[campoCRM] = n;
        } else if (campoCRM === 'eficienciaCombustible' || campoCRM === 'eficienciaFrenado') {
          datosProducto[campoCRM] = valorArchivo.toUpperCase().charAt(0);
        } else if (campoCRM === 'runFlat') {
          const l = valorArchivo.toLowerCase();
          if (['si','sí','yes','y','true','1','runflat','run-flat','run flat','rf','x','verdadero'].includes(l)) datosProducto.runFlat = true;
          else if (['no','n','false','0','falso'].includes(l)) datosProducto.runFlat = false;
        } else {
          datosProducto[campoCRM] = valorArchivo;
        }
      }
      // Si se actualiza la medida, recalcular su clave canónica de búsqueda
      if (datosProducto.medida) datosProducto.medidaNorm = normalizarMedida(datosProducto.medida);

      if (cambiosMuestra.length < 10) {
        cambiosMuestra.push({
          matchValor: valorMatch, sku: producto.sku, medida: producto.medida, marca: producto.marca,
          cambiosProducto: datosProducto,
          cambiosStock: Object.entries(datosStock).map(([sedeId, qty]) => {
            const sede = sedes.find(s => s.id === sedeId);
            const stockActual = producto.stocks.find(st => st.sedeId === sedeId)?.cantidad ?? 0;
            return { sede: sede?.nombre || sedeId, codigoLocal: sede?.codigoLocal, antes: stockActual, despues: qty };
          }),
        });
      }

      actualizados++;
      resultadosFila[i] = { estado: 'actualizado', detalle: dryRun ? 'Se actualizará' : 'Actualizado correctamente' };
      if (!dryRun) aActualizar.push({ idx: i, valorMatch, producto, datosProducto, datosStock });
    }

    // ── Fase 2: escribir en BD en lotes paralelos (solo si no es dry run) ──
    if (!dryRun) {
      const CONCURRENCIA = 20;
      for (let i = 0; i < aActualizar.length; i += CONCURRENCIA) {
        const lote = aActualizar.slice(i, i + CONCURRENCIA);
        await Promise.all(lote.map(async ({ idx, valorMatch, producto, datosProducto, datosStock }) => {
          try {
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
          } catch (rowErr) {
            const msg = explicarErrorPrisma(rowErr);
            errores.push({ fila: idx + 2, valor: valorMatch, error: msg });
            resultadosFila[idx] = { estado: 'error', detalle: msg };
            actualizados--;
          }
        }));
      }
    }

    // Reporte Excel con filas sombreadas según resultado (verde=ok, naranja=no encontrado, rojo=error)
    let reporteBase64 = null;
    let reporteError = null;
    if (dataRows.length <= 10000) {
      try {
        reporteBase64 = generarReporteUpdateBase64(rows[0], dataRows, resultadosFila, dryRun);
      } catch (e) {
        reporteError = e.message;
        console.error('No se pudo generar el reporte Excel:', e.message, e.stack);
      }
    }

    res.json({
      esPreview: dryRun,
      actualizados,
      noEncontrados,
      noEncontradosLista,
      errores,
      total: dataRows.length,
      cambiosMuestra,
      reporteBase64,
      reporteError,
    });
  } catch (err) {
    next(err);
  }
};

// ── Endpoint dedicado: genera el reporte Excel y lo devuelve como descarga directa ──
// Re-corre la Fase 1 (sin escrituras en BD) para reconstruir resultadosFila, luego
// genera y devuelve el xlsx directamente sin pasar por base64 en JSON.
const descargarReporteUpdate = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    const { matchColIdx, matchCampoCRM } = req.body;
    const matchIdx = parseInt(matchColIdx);

    if (isNaN(matchIdx) || !matchCampoCRM) return res.status(400).json({ error: 'matchColIdx y matchCampoCRM son requeridos' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    const dataRows = rows.slice(1);

    // Sin select dinámico — mismo patrón que aplicarUpdate para evitar errores de Prisma
    const todosProd = await prisma.producto.findMany({ where: { activo: true } });
    const porMatch = new Map();
    for (const p of todosProd) {
      const key = String(p[matchCampoCRM] ?? '').trim().toLowerCase();
      if (key && !porMatch.has(key)) porMatch.set(key, p);
    }

    const resultadosFila = dataRows.map((row) => {
      const valorMatch = String(row[matchIdx] ?? '').trim();
      if (!valorMatch) return { estado: 'vacio', detalle: 'Sin valor en la columna de match' };
      return porMatch.has(valorMatch.toLowerCase())
        ? { estado: 'actualizado', detalle: 'Encontrado en CRM' }
        : { estado: 'no_encontrado', detalle: `"${valorMatch}" no existe en el CRM` };
    });

    const buf = generarReporteUpdate(rows[0] || [], dataRows, resultadosFila, false);
    const filename = `reporte_actualizacion_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
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

// Ancho/Perfil/Radio para todas las familias de medida (delegado a utils/medida).
const parseMedida = (medida) => dimensionesMedida(medida);

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
      { key: 'modelo',          label: 'Modelo',               nota: 'Modelo específico de la llanta',            ej1: 'EP150',                ej2: 'LTX FORCE'           },
      { key: 'runFlat',         label: 'Run-Flat (Sí/No)',     nota: 'Sí o No (vacío = sin dato)',                ej1: 'No',                   ej2: 'Sí'                  },
      { key: 'tipoLlanta',      label: 'Tipo de llanta',       nota: 'Ej: Carga, Ciudad, Pistera, MT, AT',        ej1: 'Ciudad',               ej2: 'AT'                  },
      { key: 'tipoVehiculo',    label: 'Tipo de vehículo',     nota: 'Ej: Pick up, Sedán, Transporte urbano',     ej1: 'Sedán',                ej2: 'Pick up'             },
      { key: 'grupo',           label: 'Grupo',                nota: 'Excelente / Muy Buena / Buena',             ej1: 'Excelente',            ej2: 'Muy Buena'           },
      { key: 'precioRegular',   label: 'Precio Regular',       nota: '← OBLIGATORIO. Número, ej: 250.00',         ej1: 250.00,                 ej2: 480.00                },
      { key: 'precioOferta',    label: 'Precio Oferta',        nota: 'Vacío si no hay oferta',                    ej1: 220.00,                 ej2: ''                    },
      { key: 'descuentoMaximo', label: 'Descuento Máximo %',   nota: 'Número del %, ej: 15',                      ej1: 15,                     ej2: 10                    },
      { key: 'garantia',        label: 'Garantía',             nota: 'Ej: 2 años',                                ej1: '2 años',               ej2: '3 años'              },
      { key: 'fichaTecnica',    label: 'Ficha Técnica',        nota: 'URL o texto técnico',                       ej1: '',                     ej2: ''                    },
      { key: 'indice_carga',    label: 'Índice de carga',      nota: 'Ej: 91',                                    ej1: '91',                   ej2: '121'                 },
      { key: 'velocidad_max',   label: 'Índice de Velocidad',  nota: 'Ej: H (H=210km/h, V=240, S=180)',           ej1: 'H',                    ej2: 'S'                   },
    ];

    // Nota: Ancho/Perfil/Radio NO van en la plantilla — el sistema los calcula automáticamente desde Medida

    fixedCols.push(
      { key: 'cargaMaxNeumatico', label: 'Carga Maxima Neumatico kg', nota: 'Kg por neumatico, ej: 615', ej1: 615, ej2: 1450 },
      { key: 'velocidadMaxKmh', label: 'Velocidad Maxima km/h', nota: 'Km/h maxima, ej: 210', ej1: 210, ej2: 180 },
      { key: 'eficienciaCombustible', label: 'Eficiencia Combustible EU', nota: 'Etiqueta A/B/C/D/E/F/G', ej1: 'B', ej2: 'C' },
      { key: 'eficienciaFrenado', label: 'Eficiencia Frenado EU', nota: 'Etiqueta A/B/C/D/E/F/G', ej1: 'A', ej2: 'B' },
      { key: 'nivelRuido', label: 'Nivel Ruido dB', nota: 'Decibeles, ej: 71', ej1: 71, ej2: 73 },
      { key: 'paisFabricacion', label: 'Pais Fabricacion', nota: 'Ej: Japon, China, Peru', ej1: 'Japon', ej2: 'Tailandia' },
      { key: 'origenMarca', label: 'Origen Marca', nota: 'Pais origen de la marca', ej1: 'Japon', ej2: 'Francia' },
      { key: 'precioProveedor', label: 'Precio Proveedor', nota: 'Costo base del proveedor, ej: 180.00', ej1: 180.00, ej2: 350.00 },
      { key: 'precioReferencialVenta', label: 'Precio Referencial Venta', nota: 'Precio de mercado actual, ej: 300.00', ej1: 300.00, ej2: 560.00 }
    );

    // Columna Stock Total: la forma simple de cargar stock sin tocar cada tienda.
    const stockTotalCol = {
      key: 'stockTotal', label: 'Stock Total',
      nota: 'Va al almacén principal (úsalo si no llenas las tiendas)',
      ej1: 30, ej2: 15,
    };
    // Stock por tienda: opcional. Vacío en los ejemplos para promover el uso de Stock Total.
    const stockCols = sedes.map((s) => ({
      key: `stock_${s.codigoLocal}`, label: `Stock ${s.nombre}`,
      nota: 'Opcional. Número entero por tienda',
      ej1: '', ej2: '',
    }));

    const extraCols = extraKeys.map(k => ({
      key: k, label: extraKeyLabel(k),
      nota: 'Campo personalizado', ej1: '', ej2: '',
    }));

    const allCols = [...fixedCols, stockTotalCol, ...stockCols, ...extraCols];

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
      ['Medida',             'SÍ',  'Ej: 195/65R15',                     'Medida estándar. El sistema extrae automáticamente Ancho (195mm), Perfil (65%) y Radio (R15) — no necesitas columnas aparte.'],
      ['Marca',              'SÍ',  'Ej: BRIDGESTONE',                   'Nombre del fabricante.'],
      ['Nombre Comercial',   'No',  'Texto',                             'Nombre de la línea comercial.'],
      ['Modelo',             'No',  'Texto',                             'Modelo específico de la llanta.'],
      ['Run-Flat (Sí/No)',   'No',  'Sí / No',                           'Indica si la llanta es run-flat. Acepta Sí/No, RF, true/false. Vacío = sin dato.'],
      ['Tipo de llanta',     'No',  'Texto libre',                       'Tipo de llanta: Carga, Ciudad, Pistera, MT, AT, etc.'],
      ['Tipo de vehículo',   'No',  'Texto libre',                       'Para qué vehículo va: Pick up, Sedán, Transporte urbano, etc.'],
      ['Grupo',              'No',  'Excelente / Muy Buena / Buena',     'Grupo de calidad del producto.'],
      ['Precio Regular',     'No',  'Número decimal (ej: 250.00)',       'Precio de lista sin símbolo de moneda. Si lo dejas vacío en un producto NUEVO se guarda en 0; en uno existente no se modifica.'],
      ['Precio Oferta',      'No',  'Número decimal',                    'Dejar vacío si no hay precio de oferta.'],
      ['Descuento Máximo %', 'No',  'Número (ej: 15)',                   'Porcentaje máximo de descuento permitido.'],
      ['Garantía',           'No',  'Texto (ej: 2 años)',                'Período de garantía del fabricante.'],
      ['Ficha Técnica',      'No',  'URL o texto',                       'URL o descripción técnica del producto.'],
      ['Índice de carga',    'No',  'Número (ej: 91)',                   'Índice de carga estándar.'],
      ['Índice de Velocidad', 'No',  'Letra (ej: H, V, S)',               'Código de velocidad. H=210km/h, V=240km/h, S=180km/h, T=190km/h, Y=300km/h.'],
      ['Precio Proveedor',   'No',  'Número decimal (ej: 180.00)',       'Costo base del proveedor. Sirve para calcular el precio de venta en "Precios y Margen".'],
      ['Precio Referencial Venta', 'No', 'Número decimal (ej: 300.00)',  'Precio de mercado actual, para comparar contra el precio de venta calculado.'],
      ['Stock Total',        'No',  'Número entero (ej: 30)',            'Forma rápida de cargar stock: se asigna al almacén principal. Úsalo si no quieres llenar el stock de cada tienda. Si llenas alguna columna "Stock <tienda>", esa manda.'],
      ...sedes.map(s  => [`Stock ${s.nombre}`, 'No', 'Número entero (ej: 10)', `Opcional. Stock en sede ${s.nombre} (${s.codigoLocal}). Si lo llenas, tiene prioridad sobre Stock Total.`]),
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
      { key: '__ancho',         label: 'Ancho (mm)'           },
      { key: '__perfil',        label: 'Perfil (%)'           },
      { key: '__radio',         label: 'Radio (R)'            },
      { key: 'marca',           label: 'Marca'                },
      { key: 'nombreComercial', label: 'Nombre Comercial'     },
      { key: 'modelo',          label: 'Modelo'               },
      { key: 'runFlat',         label: 'Run-Flat'             },
      { key: 'tipoLlanta',      label: 'Tipo de llanta'       },
      { key: 'tipoVehiculo',    label: 'Tipo de vehículo'     },
      { key: 'grupo',           label: 'Grupo'                },
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
      { key: 'precioProveedor', label: 'Precio Proveedor'     },
      { key: 'precioReferencialVenta', label: 'Precio Referencial Venta' },
      { key: 'imagenUrl',       label: 'URL Imagen'           },
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
      const mp = parseMedida(prod.medida);

      return allCols.map(col => {
        if (col.key === '__stockTotal') return stockTotal;
        if (col.key === 'runFlat') return prod.runFlat === true ? 'Sí' : prod.runFlat === false ? 'No' : '';
        if (col.key === '__ancho')  return mp.ancho  ?? '';
        if (col.key === '__perfil') return mp.perfil ?? '';
        if (col.key === '__radio')  return mp.radio  ?? '';
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

module.exports = { preview, ejecutar, previewUpdate, aplicarUpdate, descargarReporteUpdate, generarTemplate, exportarCatalogo };
