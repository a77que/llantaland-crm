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

// Extrae la letra de eficiencia EU (A–G) desde el texto de la ficha técnica.
const CLAVES_COMBUSTIBLE = ['eficiencia (?:de |energ[ée]tica |en el )?(?:consumo de )?combustible', 'eficiencia energ[ée]tica', 'resistencia a la rodadura', 'consumo de combustible', 'ahorro de combustible', 'rodadura'];
const CLAVES_FRENADO = ['frenado en mojado', 'frenado sobre mojado', 'agarre en mojado', 'agarre sobre mojado', 'frenado en h[úu]medo', 'agarre en h[úu]medo', 'eficiencia de frenado', 'adherencia en mojado', 'adherencia sobre mojado'];
function extraerLetraEU(texto, claves) {
  if (!texto) return null;
  const t = String(texto);
  for (const k of claves) {
    const mk = new RegExp(k, 'i').exec(t);
    if (!mk) continue;
    const seg = t.slice(mk.index + mk[0].length, mk.index + mk[0].length + 40).replace(/\(?\b(?:eu|ue)\b\)?/ig, ' ');
    let m = seg.match(/^\s*["'(:=\-–]?\s*([A-G])(?![A-Za-z])/);
    if (m) return m[1];
    m = seg.match(/^[^.\n]{0,15}?(?:clase|categor[íi]a|nivel|grado|valor)\s*["'(]?([A-Ga-g])(?![A-Za-z])/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}
const esLetraEU = (v) => v != null && /^[A-G]$/.test(String(v).trim().toUpperCase());

(async () => {
  const productos = await prisma.producto.findMany({
    select: { id: true, ...Object.fromEntries(TECH_FIELDS.map(f => [f, true])) },
  });
  let tocados = 0, campos = 0, letras = 0, eficiencias = 0;
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
    // Eficiencias EU: si no son letra válida, intentar extraerlas de la ficha técnica;
    // si tampoco está en la ficha y el valor actual es inválido, dejar en NULL.
    const ficha = ('fichaTecnica' in data) ? null : p.fichaTecnica;
    for (const [f, claves] of [['eficienciaCombustible', CLAVES_COMBUSTIBLE], ['eficienciaFrenado', CLAVES_FRENADO]]) {
      if (f in data) continue;
      if (esLetraEU(p[f])) continue;                    // ya válida, no tocar
      const l = extraerLetraEU(ficha, claves);          // intentar desde la ficha
      if (l) { data[f] = l; eficiencias++; }
      else if (p[f] != null) { data[f] = null; campos++; } // inválida e irrecuperable → NULL
    }
    if (Object.keys(data).length) {
      await prisma.producto.update({ where: { id: p.id }, data });
      tocados++;
    }
  }
  console.log(`Limpieza completa: ${tocados} productos, ${campos} campos a NULL, ${letras} índices de velocidad corregidos, ${eficiencias} eficiencias extraídas de la ficha.`);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
