require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  : null;

async function getSheets() {
  if (!SERVICE_ACCOUNT_KEY) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no configurado en .env');

  const auth = new google.auth.GoogleAuth({
    credentials: SERVICE_ACCOUNT_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function leerHoja(sheets, rango) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: rango,
  });
  return resp.data.values || [];
}

// ─── MIGRACIÓN DE PRODUCTOS / STOCK ──────────────────────────────────────────
async function migrarProductos(sheets) {
  console.log('\n📦 Migrando productos desde Google Sheets...');
  const rows = await leerHoja(sheets, 'Stock!A:Z');
  if (rows.length < 2) { console.log('  Sin datos en hoja "Stock"'); return { creados: 0, actualizados: 0, errores: [] }; }

  const headers = rows[0].map((h) => String(h).trim().toLowerCase());
  const dataRows = rows.slice(1);

  let creados = 0, actualizados = 0;
  const errores = [];

  // Obtener o crear sede principal
  let sedePrincipal = await prisma.sede.findFirst({ where: { nombre: { contains: 'Principal', mode: 'insensitive' } } });
  if (!sedePrincipal) {
    sedePrincipal = await prisma.sede.create({ data: { nombre: 'Sede Principal', tipo: 'TIENDA', activo: true } });
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const get = (col) => {
      const idx = headers.indexOf(col);
      return idx >= 0 ? String(row[idx] || '').trim() : '';
    };

    const sku = get('sku') || get('codigo') || get('id');
    const medida = get('medida') || get('talla') || get('size');
    const marca = get('marca') || get('brand');
    const precio = parseFloat(get('precio') || get('price') || '0');

    if (!sku || !medida || !marca || isNaN(precio)) {
      errores.push({ fila: i + 2, error: 'Campos obligatorios faltantes' });
      continue;
    }

    try {
      const data = {
        sku,
        medida,
        marca,
        modelo: get('modelo') || get('model') || null,
        descripcion: get('descripcion') || get('descripción') || null,
        precio,
        tipo: 'AUTO',
        activo: true,
      };

      const existing = await prisma.producto.findUnique({ where: { sku } });
      let producto;
      if (existing) {
        producto = await prisma.producto.update({ where: { sku }, data });
        actualizados++;
      } else {
        producto = await prisma.producto.create({ data });
        creados++;
      }

      const stockVal = parseInt(get('stock') || get('cantidad') || '0');
      if (!isNaN(stockVal)) {
        await prisma.stock.upsert({
          where: { productoId_sedeId: { productoId: producto.id, sedeId: sedePrincipal.id } },
          update: { cantidad: stockVal },
          create: { productoId: producto.id, sedeId: sedePrincipal.id, cantidad: stockVal },
        });
      }
    } catch (err) {
      errores.push({ fila: i + 2, error: err.message });
    }
  }

  return { creados, actualizados, errores };
}

// ─── MIGRACIÓN DE CLIENTES ────────────────────────────────────────────────────
async function migrarClientes(sheets) {
  console.log('\n👥 Migrando clientes desde Google Sheets...');
  const rows = await leerHoja(sheets, 'Clientes!A:Z');
  if (rows.length < 2) { console.log('  Sin datos en hoja "Clientes"'); return { creados: 0, actualizados: 0, errores: [] }; }

  const headers = rows[0].map((h) => String(h).trim().toLowerCase());
  const dataRows = rows.slice(1);

  let creados = 0, actualizados = 0;
  const errores = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const get = (col) => {
      const idx = headers.indexOf(col);
      return idx >= 0 ? String(row[idx] || '').trim() : '';
    };

    const celular = get('celular') || get('telefono') || get('whatsapp');
    const nombre = get('nombre') || get('nombres');
    if (!celular && !nombre) {
      errores.push({ fila: i + 2, error: 'Sin celular ni nombre' });
      continue;
    }

    try {
      const data = {
        tipoDoc: 'DNI',
        numDoc: get('dni') || get('doc') || celular || `MIGRADO-${i}`,
        nombre: nombre || null,
        apellidos: get('apellidos') || get('apellido') || null,
        celular: celular || null,
        email: get('email') || get('correo') || null,
        canalOrigen: 'WHATSAPP',
        crmEstado: 'PENDIENTE',
      };

      const existing = celular
        ? await prisma.cliente.findFirst({ where: { celular } })
        : null;

      if (existing) {
        await prisma.cliente.update({ where: { id: existing.id }, data });
        actualizados++;
      } else {
        await prisma.cliente.create({ data });
        creados++;
      }
    } catch (err) {
      errores.push({ fila: i + 2, error: err.message });
    }
  }

  return { creados, actualizados, errores };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Iniciando migración desde Google Sheets...');
  console.log(`   Sheet ID: ${SHEET_ID || '⚠️  NO CONFIGURADO'}`);

  if (!SHEET_ID || !SERVICE_ACCOUNT_KEY) {
    console.error('\n❌ Configure GOOGLE_SHEETS_ID y GOOGLE_SERVICE_ACCOUNT_KEY en .env');
    process.exit(1);
  }

  const sheets = await getSheets();
  const resultadoProductos = await migrarProductos(sheets);
  const resultadoClientes = await migrarClientes(sheets);

  console.log('\n✅ MIGRACIÓN COMPLETADA');
  console.log('─'.repeat(40));
  console.log(`Productos: ${resultadoProductos.creados} creados, ${resultadoProductos.actualizados} actualizados, ${resultadoProductos.errores.length} errores`);
  console.log(`Clientes:  ${resultadoClientes.creados} creados, ${resultadoClientes.actualizados} actualizados, ${resultadoClientes.errores.length} errores`);

  if (resultadoProductos.errores.length > 0) {
    console.log('\n⚠️  Errores en productos:');
    resultadoProductos.errores.forEach((e) => console.log(`  Fila ${e.fila}: ${e.error}`));
  }
  if (resultadoClientes.errores.length > 0) {
    console.log('\n⚠️  Errores en clientes:');
    resultadoClientes.errores.forEach((e) => console.log(`  Fila ${e.fila}: ${e.error}`));
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('\n❌ Error fatal:', err.message);
  prisma.$disconnect();
  process.exit(1);
});
