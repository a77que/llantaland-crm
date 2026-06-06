// Script para insertar 2 citas de prueba
// Ejecutar: node seed_citas_test.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const localSantaAnita = { ID: 'L1', Nombre: 'Santa Anita', Tipo: 'lima', Distrito: 'Santa Anita', Direccion: 'Av. Las Torres 412' };
  const localSurco      = { ID: 'L2', Nombre: 'Surco',       Tipo: 'lima', Distrito: 'Surquillo',    Direccion: 'Av. Angamos Este 1580' };

  const stockMap1 = { Stock_L1_SantaAnita: 8, Stock_L1: 8, Stock_L2_Surco: 3, Stock_L2: 3 };
  const stockMap2 = { Stock_L1_SantaAnita: 0, Stock_L1: 0, Stock_L2_Surco: 5, Stock_L2: 5 };

  const cita1 = await prisma.leadCRM.upsert({
    where: { telefono: '51999000001' },
    update: {
      nombreCliente:    'Carlos Mendoza Ríos',
      dniCe:            '46123789',
      pasoActual:       'esperando_confirmacion',
      ranking:          'caliente',
      marcaAuto:        'Toyota',
      modeloAuto:       'Corolla',
      anioAuto:         2019,
      medidaDetectada:  '195/65R15',
      marcaLlanta:      'Michelin',
      modeloLlanta:     'Energy Saver',
      cantidadLlantas:  4,
      precioLlanta:     380.00,
      localInstalacion: localSantaAnita,
      stockMap:         stockMap1,
      timestamp:        new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    create: {
      telefono:         '51999000001',
      nombreCliente:    'Carlos Mendoza Ríos',
      dniCe:            '46123789',
      pasoActual:       'esperando_confirmacion',
      ranking:          'caliente',
      marcaAuto:        'Toyota',
      modeloAuto:       'Corolla',
      anioAuto:         2019,
      medidaDetectada:  '195/65R15',
      marcaLlanta:      'Michelin',
      modeloLlanta:     'Energy Saver',
      cantidadLlantas:  4,
      precioLlanta:     380.00,
      localInstalacion: localSantaAnita,
      stockMap:         stockMap1,
      timestamp:        new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  });

  const cita2 = await prisma.leadCRM.upsert({
    where: { telefono: '51999000002' },
    update: {
      nombreCliente:    'María Flores Vega',
      dniCe:            '72456318',
      pasoActual:       'completado',
      ranking:          'tibio',
      marcaAuto:        'Hyundai',
      modeloAuto:       'Tucson',
      anioAuto:         2021,
      medidaDetectada:  '225/55R18',
      marcaLlanta:      'Bridgestone',
      modeloLlanta:     'Turanza T005',
      cantidadLlantas:  2,
      precioLlanta:     620.00,
      localInstalacion: localSurco,
      stockMap:         stockMap2,
      provinciaDestino: null,
      timestamp:        new Date(Date.now() - 5 * 60 * 60 * 1000),
    },
    create: {
      telefono:         '51999000002',
      nombreCliente:    'María Flores Vega',
      dniCe:            '72456318',
      pasoActual:       'completado',
      ranking:          'tibio',
      marcaAuto:        'Hyundai',
      modeloAuto:       'Tucson',
      anioAuto:         2021,
      medidaDetectada:  '225/55R18',
      marcaLlanta:      'Bridgestone',
      modeloLlanta:     'Turanza T005',
      cantidadLlantas:  2,
      precioLlanta:     620.00,
      localInstalacion: localSurco,
      stockMap:         stockMap2,
      timestamp:        new Date(Date.now() - 5 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Cita 1:', cita1.telefono, '-', cita1.nombreCliente);
  console.log('✅ Cita 2:', cita2.telefono, '-', cita2.nombreCliente);
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
