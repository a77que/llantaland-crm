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

  _cache = {
    dniUrl:         pick(row.dniUrl,         process.env.API_DNI_URL),
    dniKey:         pick(row.dniKey,         process.env.API_DNI_KEY),
    rucUrl:         pick(row.rucUrl,         process.env.API_RUC_URL),
    rucKey:         pick(row.rucKey,         process.env.API_RUC_KEY),
    ceUrl:          pick(row.ceUrl,          process.env.API_CE_URL),
    ceKey:          pick(row.ceKey,          process.env.API_CE_KEY),
    factilizaUrl:   pick(row.factilizaUrl,   process.env.FACTILIZA_URL) || 'https://api.factiliza.com/v1/placa/info',
    factilizaToken: pick(row.factilizaToken, process.env.FACTILIZA_TOKEN),
    groqKey:        pick(row.groqKey,        process.env.GROQ_API_KEY),
    geminiKey:      pick(row.geminiKey,      process.env.GEMINI_API_KEY),
  };
  _cacheTs = Date.now();
  return _cache;
}

// Invalida el cache (llamar tras guardar config)
function invalidarCacheApis() { _cache = null; _cacheTs = 0; }

module.exports = { getConfigApis, invalidarCacheApis };
