/**
 * Normaliza una medida de llanta a su forma canónica: ANCHO/PERFILRARO (ej: "145/65R16").
 * Acepta cualquier combinación de espacios y mayúsculas:
 *   "145/65r16", "145 / 65 r 16", "145/ 65r16", "145 65 16" → "145/65R16"
 * Si no reconoce el patrón estándar, devuelve la entrada compacta en mayúsculas (sin espacios).
 */
function normalizarMedida(m) {
  if (m === null || m === undefined) return m;
  const up = String(m).toUpperCase();
  // ANCHO(3) [sep] PERFIL(2-3) [sep/R] ARO(2). Separadores flexibles: espacios, "/", "-", "R" o nada.
  const match = up.match(/(\d{3})\s*[\/\-]?\s*(\d{2,3})\s*[\/\-R]?\s*(\d{2})(?!\d)/);
  if (match) return `${match[1]}/${match[2]}R${match[3]}`;
  return up.replace(/\s+/g, '');
}

/**
 * ¿La cadena parece una medida (contiene dígitos y formato de llanta)?
 * Útil para decidir si normalizar un término de búsqueda libre.
 */
function pareceMedida(q) {
  if (!q) return false;
  return /\d{3}.*\d{2}/.test(String(q).toUpperCase().replace(/\s+/g, ''));
}

module.exports = { normalizarMedida, pareceMedida };
