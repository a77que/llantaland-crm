/**
 * Limpieza única: pone en NULL los campos técnicos que quedaron con valores
 * "basura" guardados como texto ("null", "[object Object]", "n/a", etc.).
 * Tras correrlo, el detector de "Rellenar con IA" los verá como faltantes y los
 * podrá completar correctamente, y no se mostrará basura en cotizaciones/ventas.
 *
 * Uso en el contenedor (Easypanel):
 *   docker exec $(docker ps -qf name=llantaland-crm_api) node scripts/limpiarBasuraTecnica.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TECH_FIELDS = [
  'indice_carga', 'velocidad_max', 'garantia',
  'cargaMaxNeumatico', 'velocidadMaxKmh',
  'eficienciaCombustible', 'eficienciaFrenado', 'nivelRuido',
  'paisFabricacion', 'origenMarca', 'fichaTecnica',
];
const BASURA = new Set(['', 'null', 'undefined', 'nan', 'n/a', 'na', '-', '--', '.', '[object object]', 'none', 'no especificado', 'no disponible', 'sin información', 'sin informacion']);

function esBasura(v) {
  if (v === null || v === undefined) return false; // ya está limpio
  if (typeof v === 'string') return BASURA.has(v.trim().toLowerCase());
  if (typeof v === 'object') return true; // objeto en campo de texto
  return false;
}

(async () => {
  const productos = await prisma.producto.findMany({
    select: { id: true, ...Object.fromEntries(TECH_FIELDS.map(f => [f, true])) },
  });
  let tocados = 0, campos = 0;
  for (const p of productos) {
    const data = {};
    for (const f of TECH_FIELDS) {
      if (esBasura(p[f])) { data[f] = null; campos++; }
    }
    if (Object.keys(data).length) {
      await prisma.producto.update({ where: { id: p.id }, data });
      tocados++;
    }
  }
  console.log(`Limpieza completa: ${tocados} productos, ${campos} campos puestos en NULL.`);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
