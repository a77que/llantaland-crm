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

// Índice de velocidad: número (km/h) → letra correcta.
const KMH_A_LETRA = { 100:'J',110:'K',120:'L',130:'M',140:'N',150:'P',160:'Q',170:'R',180:'S',190:'T',200:'U',210:'H',240:'V',270:'W',300:'Y' };
function indiceVelocidadLetra(v) {
  if (v === null || v === undefined) return undefined; // sin cambio
  let s = String(v).trim().toUpperCase();
  if (s === 'ZR' || /^[A-Z]\d?$/.test(s)) return undefined; // ya es letra
  const m = s.match(/(\d{2,3})/);
  if (m) {
    const n = parseInt(m[1]);
    if (KMH_A_LETRA[n]) return KMH_A_LETRA[n];
    const keys = Object.keys(KMH_A_LETRA).map(Number).sort((a, b) => a - b);
    for (const k of keys) if (n <= k) return KMH_A_LETRA[k];
    return 'Y';
  }
  return null; // número irreconocible → limpiar
}

(async () => {
  const productos = await prisma.producto.findMany({
    select: { id: true, ...Object.fromEntries(TECH_FIELDS.map(f => [f, true])) },
  });
  let tocados = 0, campos = 0, letras = 0;
  for (const p of productos) {
    const data = {};
    for (const f of TECH_FIELDS) {
      if (esBasura(p[f])) { data[f] = null; campos++; }
    }
    // Corregir índice de velocidad numérico → letra
    if (!('velocidad_max' in data)) {
      const letra = indiceVelocidadLetra(p.velocidad_max);
      if (letra !== undefined) { data.velocidad_max = letra; letras++; }
    }
    // Eficiencias que no son letra A–G → NULL (irrecuperables sin IA)
    for (const f of ['eficienciaCombustible', 'eficienciaFrenado']) {
      if (!(f in data) && p[f] != null && !/^[A-G]$/.test(String(p[f]).trim().toUpperCase())) { data[f] = null; campos++; }
    }
    if (Object.keys(data).length) {
      await prisma.producto.update({ where: { id: p.id }, data });
      tocados++;
    }
  }
  console.log(`Limpieza completa: ${tocados} productos, ${campos} campos a NULL, ${letras} índices de velocidad corregidos a letra.`);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
