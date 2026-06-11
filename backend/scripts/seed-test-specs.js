// Script de prueba: rellena campos técnicos en los primeros productos
// Uso: node scripts/seed-test-specs.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SAMPLES = [
  {
    indice_carga: '91', velocidad_max: 'H',
    cargaMaxNeumatico: 615, velocidadMaxKmh: 210,
    eficienciaCombustible: 'A', eficienciaFrenado: 'A',
    nivelRuido: 68, paisFabricacion: 'Japón', origenMarca: 'Japón',
    garantia: '3 años',
  },
  {
    indice_carga: '94', velocidad_max: 'V',
    cargaMaxNeumatico: 670, velocidadMaxKmh: 240,
    eficienciaCombustible: 'B', eficienciaFrenado: 'B',
    nivelRuido: 71, paisFabricacion: 'Alemania', origenMarca: 'Alemania',
    garantia: '4 años',
  },
  {
    indice_carga: '88', velocidad_max: 'T',
    cargaMaxNeumatico: 560, velocidadMaxKmh: 190,
    eficienciaCombustible: 'C', eficienciaFrenado: 'B',
    nivelRuido: 73, paisFabricacion: 'China', origenMarca: 'Francia',
    garantia: '2 años',
  },
  {
    indice_carga: '97', velocidad_max: 'W',
    cargaMaxNeumatico: 730, velocidadMaxKmh: 270,
    eficienciaCombustible: 'B', eficienciaFrenado: 'A',
    nivelRuido: 69, paisFabricacion: 'Corea del Sur', origenMarca: 'Corea del Sur',
    garantia: '5 años',
  },
  {
    indice_carga: '82', velocidad_max: 'S',
    cargaMaxNeumatico: 475, velocidadMaxKmh: 180,
    eficienciaCombustible: 'D', eficienciaFrenado: 'C',
    nivelRuido: 75, paisFabricacion: 'China', origenMarca: 'EE.UU.',
    garantia: '2 años',
  },
  {
    indice_carga: '100', velocidad_max: 'H',
    cargaMaxNeumatico: 800, velocidadMaxKmh: 210,
    eficienciaCombustible: 'C', eficienciaFrenado: 'B',
    nivelRuido: 72, paisFabricacion: 'Japón', origenMarca: 'Japón',
    garantia: '3 años',
  },
];

async function main() {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    orderBy: { createdAt: 'asc' },
    take: SAMPLES.length,
    select: { id: true, marca: true, medida: true },
  });

  if (productos.length === 0) {
    console.log('No hay productos activos en la base de datos.');
    return;
  }

  for (let i = 0; i < productos.length; i++) {
    const prod = productos[i];
    const data = SAMPLES[i % SAMPLES.length];
    await prisma.producto.update({ where: { id: prod.id }, data });
    console.log(`✅ ${prod.marca} ${prod.medida} — Efic. ${data.eficienciaCombustible} | Frenado ${data.eficienciaFrenado} | ${data.nivelRuido} dB | ${data.paisFabricacion}`);
  }

  console.log(`\n✅ ${productos.length} productos actualizados con datos de prueba.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
