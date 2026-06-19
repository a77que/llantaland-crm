/**
 * Resuelve la configuración de las APIs externas de búsqueda.
 * Prioridad: lo guardado en BD (config_api_busqueda) sobre las variables de entorno.
 * Cache corto en memoria para no consultar la BD en cada llamada.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let _cache = null;
let _cacheTs = 0;
const TTL_MS = 10_000;

async function getConfigApis() {
  if (_cache && Date.now() - _cacheTs < TTL_MS) return _cache;

  let row = {};
  try { row = (await prisma.configApiBusqueda.findFirst()) || {}; } catch { row = {}; }
  const pick = (dbVal, envVal) => (dbVal && String(dbVal).trim()) ? dbVal : (envVal || null);

  const factTo = pick(row.factilizaToken, process.env.FACTILIZA_TOKEN);
  // Endpoints de Factiliza por defecto (mismo proveedor que la placa). Si no hay URL/clave
  // propia configurada, se usan estos con el token de Factiliza → funciona sin config extra.
  const F = 'https://api.factiliza.com/v1';

  _cache = {
    dniUrl:         pick(row.dniUrl, process.env.API_DNI_URL) || `${F}/dni/info/{numero}`,
    dniKey:         pick(row.dniKey, process.env.API_DNI_KEY) || factTo,
    rucUrl:         pick(row.rucUrl, process.env.API_RUC_URL) || `${F}/ruc/info/{numero}`,
    rucKey:         pick(row.rucKey, process.env.API_RUC_KEY) || factTo,
    ceUrl:          pick(row.ceUrl,  process.env.API_CE_URL)  || `${F}/cee/info/{numero}`,
    ceKey:          pick(row.ceKey,  process.env.API_CE_KEY)  || factTo,
    factilizaUrl:   pick(row.factilizaUrl, process.env.FACTILIZA_URL) || `${F}/placa/info`,
    factilizaToken: factTo,
    groqKey:        pick(row.groqKey,   process.env.GROQ_API_KEY),
    geminiKey:      pick(row.geminiKey, process.env.GEMINI_API_KEY),
    iaPrioridad:    (row.iaPrioridad === 'gemini' ? 'gemini' : 'groq'),
    groqActivo:     row.groqActivo !== false,    // por defecto activo
    geminiActivo:   row.geminiActivo !== false,
  };
  _cacheTs = Date.now();
  return _cache;
}

// Invalida el cache (llamar tras guardar config)
function invalidarCacheApis() { _cache = null; _cacheTs = 0; }

module.exports = { getConfigApis, invalidarCacheApis };
