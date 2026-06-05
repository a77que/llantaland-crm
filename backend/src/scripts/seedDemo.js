require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed de demostración Llantaland CRM...\n');

  // ── Usuarios ──────────────────────────────────────────────────
  const hash = await bcrypt.hash('Llantaland2024!', 10);
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@llantaland.com' },
    update: {},
    create: { nombre: 'Administrador', email: 'admin@llantaland.com', password: hash, rol: 'ADMIN' },
  });
  const hash2 = await bcrypt.hash('Vendedor2024!', 10);
  const vendedor = await prisma.usuario.upsert({
    where: { email: 'vendedor@llantaland.com' },
    update: {},
    create: { nombre: 'Carlos Vendedor', email: 'vendedor@llantaland.com', password: hash2, rol: 'VENDEDOR' },
  });
  console.log('✓ Usuarios creados');

  // ── Sedes ─────────────────────────────────────────────────────
  const sedesData = [
    { codigoLocal: 'L0', nombre: 'Almacén Central',    tipo: 'ALMACEN', distrito: 'Santa Anita',      direccion: 'Av. Nicolás Ayllón 123, Santa Anita' },
    { codigoLocal: 'L1', nombre: 'Tienda Santa Anita', tipo: 'TIENDA',  distrito: 'Santa Anita',      direccion: 'Av. Circunvalación 456, Santa Anita' },
    { codigoLocal: 'L2', nombre: 'Tienda Surco',       tipo: 'TIENDA',  distrito: 'Santiago de Surco', direccion: 'Av. Caminos del Inca 789, Surco' },
    { codigoLocal: 'L3', nombre: 'Tienda Surquillo',   tipo: 'TIENDA',  distrito: 'Surquillo',         direccion: 'Av. República de Panamá 321, Surquillo' },
    { codigoLocal: 'L4', nombre: 'Tienda Miraflores',  tipo: 'TIENDA',  distrito: 'Miraflores',        direccion: 'Av. Larco 654, Miraflores' },
    { codigoLocal: 'L5', nombre: 'Tienda Pueblo Libre',tipo: 'TIENDA',  distrito: 'Pueblo Libre',      direccion: 'Av. Brasil 987, Pueblo Libre' },
  ];
  const sedes = {};
  for (const s of sedesData) {
    const sede = await prisma.sede.upsert({ where: { codigoLocal: s.codigoLocal }, update: {}, create: s });
    sedes[s.codigoLocal] = sede;
  }
  console.log('✓ 6 sedes creadas (L0-L5)');

  // ── Productos ─────────────────────────────────────────────────
  const productosData = [
    { sku: 'BRID-195-65R15-EP150',  medida: '195/65R15', marca: 'Bridgestone', nombreComercial: 'Ecopia EP150',      grupo: 'Muy Buena', tipo: 'AUTO',      precioRegular: 320, precioOferta: null,  stock: { L0:30, L1:8, L2:6, L3:4, L4:3, L5:5 } },
    { sku: 'MICH-195-65R15-E3',     medida: '195/65R15', marca: 'Michelin',    nombreComercial: 'Energy E3',         grupo: 'Excelente', tipo: 'AUTO',      precioRegular: 380, precioOferta: 350,   stock: { L0:20, L1:5, L2:5, L3:3, L4:2, L5:4 } },
    { sku: 'CONT-195-65R15-CC',     medida: '195/65R15', marca: 'Continental', nombreComercial: 'ContiContact',      grupo: 'Excelente', tipo: 'AUTO',      precioRegular: 360, precioOferta: null,  stock: { L0:15, L1:4, L2:3, L3:2, L4:3, L5:2 } },
    { sku: 'GOOR-175-70R13-AS',     medida: '175/70R13', marca: 'Goodyear',    nombreComercial: 'Assurance',         grupo: 'Muy Buena', tipo: 'AUTO',      precioRegular: 220, precioOferta: null,  stock: { L0:40, L1:10, L2:8, L3:6, L4:4, L5:6 } },
    { sku: 'BRID-185-60R14-EP150',  medida: '185/60R14', marca: 'Bridgestone', nombreComercial: 'Ecopia EP150',      grupo: 'Muy Buena', tipo: 'AUTO',      precioRegular: 290, precioOferta: 270,   stock: { L0:25, L1:6, L2:5, L3:4, L4:3, L5:4 } },
    { sku: 'MICH-205-55R16-P3',     medida: '205/55R16', marca: 'Michelin',    nombreComercial: 'Primacy 3',         grupo: 'Excelente', tipo: 'AUTO',      precioRegular: 450, precioOferta: null,  stock: { L0:18, L1:4, L2:4, L3:3, L4:2, L5:3 } },
    { sku: 'PIRE-205-55R16-P7',     medida: '205/55R16', marca: 'Pirelli',     nombreComercial: 'P7 Cinturato',      grupo: 'Excelente', tipo: 'AUTO',      precioRegular: 480, precioOferta: 440,   stock: { L0:12, L1:3, L2:3, L3:2, L4:2, L5:2 } },
    { sku: 'HANK-205-55R16-K125',   medida: '205/55R16', marca: 'Hankook',     nombreComercial: 'Kinergy GT K125',   grupo: 'Buena',     tipo: 'AUTO',      precioRegular: 310, precioOferta: 280,   stock: { L0:22, L1:5, L2:5, L3:4, L4:3, L5:3 } },
    { sku: 'MICH-265-70R17-LTX',    medida: '265/70R17', marca: 'Michelin',    nombreComercial: 'LTX Force',         grupo: 'Excelente', tipo: 'CAMIONETA', precioRegular: 580, precioOferta: null,  stock: { L0:20, L1:5, L2:4, L3:3, L4:2, L5:3 } },
    { sku: 'CONT-265-70R17-CCA',    medida: '265/70R17', marca: 'Continental', nombreComercial: 'CrossContact ATR',  grupo: 'Excelente', tipo: 'CAMIONETA', precioRegular: 560, precioOferta: 520,   stock: { L0:16, L1:4, L2:3, L3:2, L4:2, L5:2 } },
    { sku: 'BRID-265-70R17-D840',   medida: '265/70R17', marca: 'Bridgestone', nombreComercial: 'Dueler D840',       grupo: 'Muy Buena', tipo: 'CAMIONETA', precioRegular: 540, precioOferta: null,  stock: { L0:12, L1:3, L2:3, L3:2, L4:2, L5:2 } },
    { sku: 'GOOR-245-70R16-WRSP',   medida: '245/70R16', marca: 'Goodyear',    nombreComercial: 'Wrangler HP',       grupo: 'Muy Buena', tipo: 'CAMIONETA', precioRegular: 490, precioOferta: 460,   stock: { L0:10, L1:3, L2:2, L3:2, L4:1, L5:2 } },
    { sku: 'MICH-225-60R17-PRI',    medida: '225/60R17', marca: 'Michelin',    nombreComercial: 'Primacy SUV',       grupo: 'Excelente', tipo: 'CAMIONETA', precioRegular: 520, precioOferta: null,  stock: { L0:14, L1:4, L2:3, L3:2, L4:2, L5:3 } },
    { sku: 'BRID-11R22-R152',       medida: '11R22.5',   marca: 'Bridgestone', nombreComercial: 'R152 II',           grupo: 'Muy Buena', tipo: 'CAMION',    precioRegular: 1200,precioOferta: null,  stock: { L0:20, L1:2, L2:1, L3:1, L4:0, L5:1 } },
    { sku: 'MICH-315-80R22-XZA3',   medida: '315/80R22', marca: 'Michelin',    nombreComercial: 'XZA3',              grupo: 'Excelente', tipo: 'CAMION',    precioRegular: 1450,precioOferta: 1380,  stock: { L0:15, L1:1, L2:1, L3:0, L4:0, L5:1 } },
  ];

  const productos = {};
  for (const p of productosData) {
    const { stock, ...data } = p;
    const prod = await prisma.producto.upsert({ where: { sku: p.sku }, update: { precioRegular: p.precioRegular, precioOferta: p.precioOferta }, create: data });
    for (const [cod, qty] of Object.entries(stock)) {
      const sede = sedes[cod];
      if (sede) await prisma.stock.upsert({
        where: { productoId_sedeId: { productoId: prod.id, sedeId: sede.id } },
        update: { cantidad: qty },
        create: { productoId: prod.id, sedeId: sede.id, cantidad: qty, stockMinimo: 3 },
      });
    }
    productos[p.sku] = prod;
  }
  console.log(`✓ ${productosData.length} productos con stock en 6 locales`);

  // ── Leads (clientes WhatsApp) ─────────────────────────────────
  const leadsData = [
    { telefono: '51987654321', nombreCliente: 'Juan Pérez',      dniCe: '45678901', marcaAuto: 'Toyota',   modeloAuto: 'Corolla',    anioAuto: 2020, medidaDetectada: '195/65R15', marcaLlanta: 'Michelin',    precioLlanta: 380,  pasoActual: 'completado',            ranking: 'caliente', distritoCliente: 'Surco',       fechaCita: '2026-06-05', estadoLogistica: 'instalado', localInstalacion: { Nombre: 'Tienda Surco', Distrito: 'Santiago de Surco' } },
    { telefono: '51912345678', nombreCliente: 'María García',    dniCe: '72345678', marcaAuto: 'Hyundai',  modeloAuto: 'Tucson',     anioAuto: 2021, medidaDetectada: '225/60R17', marcaLlanta: 'Michelin',    precioLlanta: 520,  pasoActual: 'esperando_confirmacion', ranking: 'caliente', distritoCliente: 'Miraflores',  localInstalacion: { Nombre: 'Tienda Miraflores', Distrito: 'Miraflores' } },
    { telefono: '51998877665', nombreCliente: 'Carlos Ramos',    dniCe: '35891234', marcaAuto: 'Kia',      modeloAuto: 'Sportage',   anioAuto: 2019, medidaDetectada: '245/70R16', marcaLlanta: 'Goodyear',    precioLlanta: 490,  pasoActual: 'esperando_confirmacion', ranking: 'tibio',   distritoCliente: 'San Borja' },
    { telefono: '51955443322', nombreCliente: 'Ana Flores',      dniCe: '62109876', marcaAuto: 'Nissan',   modeloAuto: 'Sentra',     anioAuto: 2018, medidaDetectada: '185/60R14', marcaLlanta: 'Bridgestone', precioLlanta: 290,  pasoActual: 'completado',            ranking: 'caliente', distritoCliente: 'La Molina',   fechaCita: '2026-06-04', estadoLogistica: 'instalado' },
    { telefono: '51911223344', nombreCliente: 'Pedro López',     dniCe: '87654321', marcaAuto: 'Ford',     modeloAuto: 'Explorer',   anioAuto: 2022, medidaDetectada: '265/70R17', marcaLlanta: 'Continental', precioLlanta: 560,  pasoActual: 'esperando_datos_cliente',ranking: 'caliente', distritoCliente: 'San Isidro' },
    { telefono: '51966778899', nombreCliente: null,              dniCe: null,       marcaAuto: 'Honda',    modeloAuto: 'Civic',      anioAuto: 2021, medidaDetectada: '205/55R16', marcaLlanta: null,          precioLlanta: null, pasoActual: 'esperando_eleccion_llanta', ranking: 'tibio', distritoCliente: 'Surquillo' },
    { telefono: '51933445566', nombreCliente: null,              dniCe: null,       marcaAuto: null,       modeloAuto: null,         anioAuto: null, medidaDetectada: '175/70R13', marcaLlanta: null,          precioLlanta: null, pasoActual: 'esperando_medida',       ranking: null },
    { telefono: '51977889900', nombreCliente: 'Luis Mendoza',    dniCe: '41237890', marcaAuto: 'Mitsubishi',modeloAuto: 'Outlander', anioAuto: 2020, medidaDetectada: '265/70R17', marcaLlanta: 'Michelin',    precioLlanta: 580,  pasoActual: 'completado',            ranking: 'caliente', distritoCliente: 'Independencia', fechaCita: '2026-06-03', estadoLogistica: 'traslado_completado' },
    { telefono: '51944556677', nombreCliente: 'Rosa Torres',     dniCe: '53219876', marcaAuto: 'Toyota',   modeloAuto: 'RAV4',       anioAuto: 2023, medidaDetectada: '225/60R17', marcaLlanta: null,          precioLlanta: null, pasoActual: 'esperando_distrito',     ranking: 'tibio' },
    { telefono: '51922334455', nombreCliente: null,              dniCe: null,       marcaAuto: null,       modeloAuto: null,         anioAuto: null, medidaDetectada: null,        marcaLlanta: null,          precioLlanta: null, pasoActual: 'nuevo',                  ranking: null },
    { telefono: '51900112233', nombreCliente: 'Diego Castillo',  dniCe: '78904561', marcaAuto: 'Chevrolet',modeloAuto: 'Sail',       anioAuto: 2017, medidaDetectada: '175/70R13', marcaLlanta: 'Goodyear',    precioLlanta: 220,  pasoActual: 'completado',            ranking: 'frio',    distritoCliente: 'Comas',       fechaCita: '2026-06-02' },
    { telefono: '51988776655', nombreCliente: 'Sandra Vega',     dniCe: '65432198', marcaAuto: 'Suzuki',   modeloAuto: 'Grand Vitara',anioAuto: 2019, medidaDetectada: '265/70R17', marcaLlanta: 'Bridgestone', precioLlanta: 540, pasoActual: 'esperando_local_destino', ranking: 'caliente', distritoCliente: 'Ate' },
  ];

  const leads = {};
  for (const l of leadsData) {
    const { localInstalacion, ...data } = l;
    const lead = await prisma.leadCRM.upsert({
      where: { telefono: l.telefono },
      update: {},
      create: { ...data, localInstalacion: localInstalacion || undefined, timestamp: new Date(Date.now() - Math.random() * 7 * 86400000) },
    });
    leads[l.telefono] = lead;
  }
  console.log(`✓ ${leadsData.length} leads WhatsApp creados`);

  // ── Historial de conversaciones ───────────────────────────────
  const conversaciones = [
    { tel: '51987654321', msgs: [
      { rol: 'cliente', msg: 'Hola, necesito llantas para mi Corolla 2020' },
      { rol: 'bot',     msg: '¡Hola! Con gusto te ayudo. ¿Cuál es la medida de tus llantas actuales? La encuentras en el costado de la llanta (ej: 195/65R15)' },
      { rol: 'cliente', msg: '195/65R15' },
      { rol: 'bot',     msg: 'Perfecto. Tenemos excelentes opciones para tu medida. ¿Prefieres Michelin, Bridgestone o Continental?' },
      { rol: 'cliente', msg: 'Michelin' },
      { rol: 'bot',     msg: 'La Michelin Energy E3 en 195/65R15 está a S/ 380 c/u. ¿Cuántas necesitas?' },
      { rol: 'cliente', msg: '4 llantas' },
      { rol: 'bot',     msg: '4x S/ 380 = S/ 1,520. ¿A qué distrito vas para la instalación?' },
    ]},
    { tel: '51977889900', msgs: [
      { rol: 'cliente', msg: 'Buenas, quiero cotizar llantas 265/70R17' },
      { rol: 'bot',     msg: '¡Hola! Para tu medida 265/70R17 tenemos: Michelin LTX Force S/ 580, Continental CrossContact ATR S/ 560, Bridgestone Dueler D840 S/ 540. ¿Cuál prefieres?' },
      { rol: 'cliente', msg: 'Michelin' },
      { rol: 'bot',     msg: 'Excelente elección. ¿A qué distrito llevas tu vehículo para la instalación?' },
      { rol: 'cliente', msg: 'Independencia' },
      { rol: 'bot',     msg: 'Tenemos stock disponible. Tu cita queda agendada para mañana. ¡Nos vemos!' },
    ]},
  ];

  for (const conv of conversaciones) {
    const lead = leads[conv.tel];
    if (!lead) continue;
    for (let i = 0; i < conv.msgs.length; i++) {
      const m = conv.msgs[i];
      await prisma.mensajeHistorial.upsert({
        where: { hashMensaje: `demo_${conv.tel}_${i}` },
        update: {},
        create: { leadId: lead.id, telefono: conv.tel, hashMensaje: `demo_${conv.tel}_${i}`, rol: m.rol, mensaje: m.msg, timestamp: new Date(Date.now() - (conv.msgs.length - i) * 60000 * 5) },
      });
    }
  }
  console.log('✓ Historial de conversaciones creado');

  // ── Ventas ────────────────────────────────────────────────────
  const ventasData = [
    { lead: '51987654321', medida: '195/65R15', marca: 'Michelin',    modelo: 'Energy E3',        qty: 4, precio: 380,  tipo: 'whatsapp', caso: 'A', estado: 'COMPLETADA', fecha: new Date('2026-06-05'), ranking: 'caliente' },
    { lead: '51955443322', medida: '185/60R14', marca: 'Bridgestone', modelo: 'Ecopia EP150',     qty: 4, precio: 290,  tipo: 'whatsapp', caso: 'A', estado: 'COMPLETADA', fecha: new Date('2026-06-04'), ranking: 'caliente' },
    { lead: '51977889900', medida: '265/70R17', marca: 'Michelin',    modelo: 'LTX Force',        qty: 4, precio: 580,  tipo: 'whatsapp', caso: 'B', estado: 'COMPLETADA', fecha: new Date('2026-06-03'), ranking: 'caliente' },
    { lead: '51900112233', medida: '175/70R13', marca: 'Goodyear',    modelo: 'Assurance',        qty: 2, precio: 220,  tipo: 'whatsapp', caso: 'A', estado: 'COMPLETADA', fecha: new Date('2026-06-02'), ranking: 'frio' },
    { lead: null,          medida: '205/55R16', marca: 'Pirelli',     modelo: 'P7 Cinturato',     qty: 4, precio: 480,  tipo: 'tienda',   caso: 'A', estado: 'COMPLETADA', fecha: new Date('2026-06-04'), ranking: null },
    { lead: null,          medida: '265/70R17', marca: 'Continental', modelo: 'CrossContact ATR', qty: 4, precio: 560,  tipo: 'tienda',   caso: 'A', estado: 'COMPLETADA', fecha: new Date('2026-06-03'), ranking: null },
    { lead: null,          medida: '195/65R15', marca: 'Continental', modelo: 'ContiContact',     qty: 2, precio: 360,  tipo: 'tienda',   caso: 'A', estado: 'PENDIENTE',  fecha: new Date('2026-06-05'), ranking: null },
    { lead: '51912345678', medida: '225/60R17', marca: 'Michelin',    modelo: 'Primacy SUV',      qty: 4, precio: 520,  tipo: 'whatsapp', caso: 'A', estado: 'PENDIENTE',  fecha: new Date('2026-06-05'), ranking: 'caliente' },
  ];

  let ventaCount = await prisma.venta.count();
  for (const v of ventasData) {
    ventaCount++;
    const numero = `VTA-${String(ventaCount).padStart(5, '0')}`;
    const lead = v.lead ? leads[v.lead] : null;
    const leadData = v.lead ? leadsData.find(l => l.telefono === v.lead) : null;
    await prisma.venta.create({
      data: {
        numero,
        leadId:          lead?.id || null,
        usuarioId:       admin.id,
        telefonoCliente: v.lead || null,
        nombreCliente:   leadData?.nombreCliente || null,
        dniCe:           leadData?.dniCe || null,
        marcaAuto:       leadData?.marcaAuto || null,
        modeloAuto:      leadData?.modeloAuto || null,
        anioAuto:        leadData?.anioAuto || null,
        medidaLlanta:    v.medida,
        marcaLlanta:     v.marca,
        modeloLlanta:    v.modelo,
        cantidad:        v.qty,
        precioUnit:      v.precio,
        precioTotal:     v.precio * v.qty,
        tipoVenta:       v.tipo,
        caso:            v.caso,
        esTraslado:      v.caso === 'B',
        rankingLead:     v.ranking,
        estado:          v.estado,
        createdAt:       v.fecha,
        localInstalacion: lead ? (leadData?.localInstalacion || null) : null,
      },
    });
  }
  console.log(`✓ ${ventasData.length} ventas creadas`);

  // ── Logística pendiente ───────────────────────────────────────
  await prisma.logisticaPendiente.create({
    data: {
      telefono: '51988776655',
      nombreCliente: 'Sandra Vega',
      medida: '265/70R17',
      marcaLlanta: 'Bridgestone',
      cantidad: 4,
      precioUnit: 540,
      localOrigen: { ID: 'L0', Nombre: 'Almacén Central', Distrito: 'Santa Anita' },
      localDestino: { ID: 'L1', Nombre: 'Tienda Santa Anita', Distrito: 'Santa Anita' },
      tipoLogistica: 'traslado',
      estado: 'pendiente',
    },
  }).catch(() => {});
  console.log('✓ Logística pendiente creada');

  // ── Resumen ───────────────────────────────────────────────────
  console.log('\n✅ Seed de demo completado!\n');
  console.log('📊 Resumen:');
  console.log(`   Usuarios:  2 (admin + vendedor)`);
  console.log(`   Sedes:     6 locales (L0-L5)`);
  console.log(`   Productos: ${productosData.length} llantas con stock`);
  console.log(`   Leads:     ${leadsData.length} clientes WhatsApp`);
  console.log(`   Ventas:    ${ventasData.length} ventas`);
  console.log('\n🔑 Credenciales:');
  console.log('   Admin:    admin@llantaland.com / Llantaland2024!');
  console.log('   Vendedor: vendedor@llantaland.com / Vendedor2024!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
