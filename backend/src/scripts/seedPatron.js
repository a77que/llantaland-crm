require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🎭 Ejecutando seed de "El Patrón" (Sorprendete Perú)...');

  // ── Personajes (shows a S/150 c/u, sin movilidad) ─────────────────────────
  const personajesData = [
    { nombre: 'PATRON',       precioBase: 150, descripcion: 'Show de El Patrón' },
    { nombre: 'PATRONA',      precioBase: 150, descripcion: 'Show de La Patrona' },
    { nombre: 'OSO_MARIACHI', precioBase: 150, descripcion: 'Show de Oso Mariachi' },
  ];
  for (const p of personajesData) {
    await prisma.personajeShow.upsert({
      where: { nombre: p.nombre },
      update: {},
      create: p,
    });
    console.log(`✓ Personaje: ${p.nombre}`);
  }

  // ── Distritos de cobertura iniciales (Lima/Callao) — costos aproximados ──
  const distritosData = [
    { distrito: 'Lima Cercado',       costoTransporteAprox: 20 },
    { distrito: 'San Isidro',         costoTransporteAprox: 20 },
    { distrito: 'Miraflores',         costoTransporteAprox: 20 },
    { distrito: 'Surco',              costoTransporteAprox: 25 },
    { distrito: 'San Borja',          costoTransporteAprox: 20 },
    { distrito: 'La Molina',          costoTransporteAprox: 30 },
    { distrito: 'San Juan de Lurigancho', costoTransporteAprox: 30 },
    { distrito: 'Los Olivos',         costoTransporteAprox: 30 },
    { distrito: 'San Miguel',         costoTransporteAprox: 25 },
    { distrito: 'Callao',             costoTransporteAprox: 35 },
  ];
  for (const d of distritosData) {
    await prisma.distritoCobertura.upsert({
      where: { distrito: d.distrito },
      update: { costoTransporteAprox: d.costoTransporteAprox },
      create: d,
    });
    console.log(`✓ Distrito: ${d.distrito}`);
  }

  // ── Agregados de regalo ────────────────────────────────────────────────────
  const agregadosData = [
    { nombre: 'Ramo de flores clásico', tipo: 'RAMO_FLORES', precio: 60 },
    { nombre: 'Caja de chocolates',     tipo: 'CHOCOLATES',  precio: 35 },
    { nombre: 'Peluche mediano',        tipo: 'PELUCHE',     precio: 45 },
  ];
  for (const a of agregadosData) {
    const existe = await prisma.agregadoRegalo.findFirst({ where: { nombre: a.nombre } });
    if (!existe) {
      await prisma.agregadoRegalo.create({ data: a });
      console.log(`✓ Agregado: ${a.nombre}`);
    }
  }

  console.log('🎉 Seed de "El Patrón" completado.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
