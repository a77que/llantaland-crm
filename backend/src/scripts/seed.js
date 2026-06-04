require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Ejecutando seed inicial...');

  // ── Usuarios ──────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Llantaland2024!', 10);
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@llantaland.com' },
    update: {},
    create: { nombre: 'Administrador', email: 'admin@llantaland.com', password: hash, rol: 'ADMIN' },
  });
  console.log(`✓ Admin: ${admin.email}`);

  const hash2 = await bcrypt.hash('Vendedor2024!', 10);
  const vendedor = await prisma.usuario.upsert({
    where: { email: 'vendedor@llantaland.com' },
    update: {},
    create: { nombre: 'Vendedor Demo', email: 'vendedor@llantaland.com', password: hash2, rol: 'VENDEDOR' },
  });
  console.log(`✓ Vendedor: ${vendedor.email}`);

  // ── Sedes / Locales — replica hoja LOCALES del sheet ─────────────────────
  // Los codigoLocal L0-L5 son los IDs que usa n8n en el stock map
  const sedesData = [
    { codigoLocal: 'L0', nombre: 'Almacén Central', tipo: 'ALMACEN', distrito: 'Santa Anita', direccion: 'Av. Nicolás Ayllón 123, Santa Anita, Lima' },
    { codigoLocal: 'L1', nombre: 'Tienda Santa Anita', tipo: 'TIENDA', distrito: 'Santa Anita', direccion: 'Av. Circunvalación 456, Santa Anita, Lima' },
    { codigoLocal: 'L2', nombre: 'Tienda Surco', tipo: 'TIENDA', distrito: 'Santiago de Surco', direccion: 'Av. Caminos del Inca 789, Surco, Lima' },
    { codigoLocal: 'L3', nombre: 'Tienda Surquillo', tipo: 'TIENDA', distrito: 'Surquillo', direccion: 'Av. República de Panamá 321, Surquillo, Lima' },
    { codigoLocal: 'L4', nombre: 'Tienda Miraflores', tipo: 'TIENDA', distrito: 'Miraflores', direccion: 'Av. Larco 654, Miraflores, Lima' },
    { codigoLocal: 'L5', nombre: 'Tienda Pueblo Libre', tipo: 'TIENDA', distrito: 'Pueblo Libre', direccion: 'Av. Brasil 987, Pueblo Libre, Lima' },
  ];

  const sedes = {};
  for (const s of sedesData) {
    const sede = await prisma.sede.upsert({
      where: { codigoLocal: s.codigoLocal },
      update: { nombre: s.nombre, tipo: s.tipo, distrito: s.distrito, direccion: s.direccion },
      create: s,
    });
    sedes[s.codigoLocal] = sede;
    console.log(`✓ Sede: ${s.codigoLocal} — ${s.nombre}`);
  }

  // ── Productos — replica hoja PRECIOS del sheet ────────────────────────────
  const productosData = [
    // AUTO
    { sku: 'BRID-195-65R15-EP150',  medida: '195/65R15', marca: 'Bridgestone', nombreComercial: 'Ecopia EP150',      grupo: 'Turismo',  tipo: 'AUTO',      precioRegular: 320.00, precioOferta: null,   stock: { L0: 30, L1: 8,  L2: 6,  L3: 4, L4: 3, L5: 5 } },
    { sku: 'MICH-195-65R15-E3',     medida: '195/65R15', marca: 'Michelin',    nombreComercial: 'Energy E3',         grupo: 'Turismo',  tipo: 'AUTO',      precioRegular: 380.00, precioOferta: 350.00, stock: { L0: 20, L1: 5,  L2: 5,  L3: 3, L4: 2, L5: 4 } },
    { sku: 'CONT-195-65R15-CC',     medida: '195/65R15', marca: 'Continental', nombreComercial: 'ContiContact',      grupo: 'Turismo',  tipo: 'AUTO',      precioRegular: 360.00, precioOferta: null,   stock: { L0: 15, L1: 4,  L2: 3,  L3: 2, L4: 3, L5: 2 } },
    { sku: 'GOOR-175-70R13-AS',     medida: '175/70R13', marca: 'Goodyear',   nombreComercial: 'Assurance',         grupo: 'Turismo',  tipo: 'AUTO',      precioRegular: 220.00, precioOferta: null,   stock: { L0: 40, L1: 10, L2: 8,  L3: 6, L4: 4, L5: 6 } },
    { sku: 'BRID-185-60R14-EP150',  medida: '185/60R14', marca: 'Bridgestone', nombreComercial: 'Ecopia EP150',      grupo: 'Turismo',  tipo: 'AUTO',      precioRegular: 290.00, precioOferta: 270.00, stock: { L0: 25, L1: 6,  L2: 5,  L3: 4, L4: 3, L5: 4 } },
    { sku: 'MICH-205-55R16-P3',     medida: '205/55R16', marca: 'Michelin',    nombreComercial: 'Primacy 3',         grupo: 'Turismo',  tipo: 'AUTO',      precioRegular: 450.00, precioOferta: null,   stock: { L0: 18, L1: 4,  L2: 4,  L3: 3, L4: 2, L5: 3 } },
    { sku: 'PIRE-205-55R16-P7',     medida: '205/55R16', marca: 'Pirelli',     nombreComercial: 'P7 Cinturato',      grupo: 'Turismo',  tipo: 'AUTO',      precioRegular: 480.00, precioOferta: 440.00, stock: { L0: 12, L1: 3,  L2: 3,  L3: 2, L4: 2, L5: 2 } },
    // CAMIONETA
    { sku: 'MICH-265-70R17-LTX',    medida: '265/70R17', marca: 'Michelin',    nombreComercial: 'LTX Force',         grupo: 'SUV/4x4',  tipo: 'CAMIONETA', precioRegular: 580.00, precioOferta: null,   stock: { L0: 20, L1: 5,  L2: 4,  L3: 3, L4: 2, L5: 3 } },
    { sku: 'CONT-265-70R17-CCA',    medida: '265/70R17', marca: 'Continental', nombreComercial: 'CrossContact ATR',  grupo: 'SUV/4x4',  tipo: 'CAMIONETA', precioRegular: 560.00, precioOferta: 520.00, stock: { L0: 16, L1: 4,  L2: 3,  L3: 2, L4: 2, L5: 2 } },
    { sku: 'BRID-265-70R17-D840',   medida: '265/70R17', marca: 'Bridgestone', nombreComercial: 'Dueler D840',       grupo: 'SUV/4x4',  tipo: 'CAMIONETA', precioRegular: 540.00, precioOferta: null,   stock: { L0: 12, L1: 3,  L2: 3,  L3: 2, L4: 2, L5: 2 } },
    { sku: 'MICH-225-60R17-PRI',    medida: '225/60R17', marca: 'Michelin',    nombreComercial: 'Primacy SUV',       grupo: 'SUV/4x4',  tipo: 'CAMIONETA', precioRegular: 520.00, precioOferta: null,   stock: { L0: 14, L1: 4,  L2: 3,  L3: 2, L4: 2, L5: 3 } },
    { sku: 'GOOR-245-70R16-WRSP',   medida: '245/70R16', marca: 'Goodyear',   nombreComercial: 'Wrangler HP',       grupo: 'SUV/4x4',  tipo: 'CAMIONETA', precioRegular: 490.00, precioOferta: 460.00, stock: { L0: 10, L1: 3,  L2: 2,  L3: 2, L4: 1, L5: 2 } },
    // CAMIÓN
    { sku: 'BRID-11R22.5-R152',     medida: '11R22.5',   marca: 'Bridgestone', nombreComercial: 'R152 II',           grupo: 'Comercial', tipo: 'CAMION',   precioRegular: 1200.00, precioOferta: null,  stock: { L0: 20, L1: 2,  L2: 1,  L3: 1, L4: 0, L5: 1 } },
  ];

  for (const p of productosData) {
    const { stock, ...prodData } = p;
    const prod = await prisma.producto.upsert({
      where: { sku: p.sku },
      update: { precioRegular: prodData.precioRegular, precioOferta: prodData.precioOferta },
      create: prodData,
    });

    for (const [codigo, cantidad] of Object.entries(stock)) {
      const sede = sedes[codigo];
      if (!sede) continue;
      await prisma.stock.upsert({
        where: { productoId_sedeId: { productoId: prod.id, sedeId: sede.id } },
        update: { cantidad },
        create: { productoId: prod.id, sedeId: sede.id, cantidad, stockMinimo: 3 },
      });
    }
    console.log(`✓ Producto: ${prod.sku} (${prod.medida} ${prod.marca})`);
  }

  console.log('\n✅ Seed completado.');
  console.log('\nCredenciales de acceso:');
  console.log('  Admin:    admin@llantaland.com   / Llantaland2024!');
  console.log('  Vendedor: vendedor@llantaland.com / Vendedor2024!');
  console.log('\nEndpoints n8n (requieren x-n8n-api-key header):');
  console.log('  GET  /api/n8n/crm/:telefono       — leer lead');
  console.log('  POST /api/n8n/crm                 — crear lead');
  console.log('  PATCH /api/n8n/crm/:telefono      — actualizar paso');
  console.log('  GET  /api/n8n/precios             — catálogo completo');
  console.log('  GET  /api/n8n/locales             — locales/tiendas');
  console.log('  POST /api/n8n/historial           — guardar mensaje');
  console.log('  POST /api/n8n/ventas              — registrar venta');
}

main().catch(console.error).finally(() => prisma.$disconnect());
