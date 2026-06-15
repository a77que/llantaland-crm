/**
 * Normalización de medidas de llanta a una CLAVE CANÓNICA para búsqueda.
 *
 * El catálogo Llantaland tiene 8 familias de formato. Esta función las unifica
 * para que cualquier variante (espacios, coma/punto, ZR, RF, C, LT, compactos)
 * caiga en la misma clave y sea encontrable. La coincidencia es INCLUSIVA:
 * los marcadores de velocidad (Z), run-flat (RF), comercial (C) y light-truck
 * (LT/P) se descartan en la clave, de modo que buscar "195/50R15" también trae
 * "195/50ZR15", "LT195/50R15", "195/50R15C", etc.
 *
 *  Familia                         Ejemplo            → clave
 *  1. Métrico estándar             245/75R16          → 245/75R16
 *  2. Velocidad Z (ZR)             195/50ZR15         → 195/50R15
 *  3. Comercial (C)                175/65R14C         → 175/65R14
 *  4. Métrico sin perfil           165R13 / 185R14C   → 165R13 / 185R14
 *  5. Flotación (pulgadas, X)      35X12.50R20        → 35X12.5R20
 *  6. Numérico/bias (pulgadas)     7.00R15 / 650R16   → 7.00R15 / 6.50R16
 *  7. Light Truck (LT/P)           LT245/75 R16       → 245/75R16
 *  8. Run-flat (RF) / aro decimal  225/40RF19 / R17.5 → 225/40R19 / 205/75R17.5
 */

// "12.50" → "12.5", "12.0" → "12", "12" → "12"
function recortarDecimal(x) {
  if (!x.includes('.')) return x;
  return x.replace(/0+$/, '').replace(/\.$/, '');
}

function normalizarMedida(m) {
  if (m === null || m === undefined) return m;

  // Limpieza base: mayúsculas, coma→punto, colapsar espacios, quitar prefijo LT/P
  let s = String(m).toUpperCase().replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(LT|P)\s*(?=\d)/, '');
  const c = s.replace(/\s+/g, ''); // compacto sin espacios

  let mm;

  // 1. Flotación: 35X12.50R20 / 33X12,5R20 / 27X8.50R14
  mm = c.match(/^(\d{2})X(\d{1,2})(?:\.(\d+))?R(\d{2}(?:\.\d)?)/);
  if (mm) {
    let width = mm[3] ? `${mm[2]}.${mm[3]}` : mm[2];
    return `${mm[1]}X${recortarDecimal(width)}R${mm[4]}`;
  }

  // 2/3/7/8. Métrico con perfil (acepta ZR, RF, FR, R, C y aro decimal): 245/75R16, 195/50ZR15, 225/40RF19, 175/65R14C, 205/75R17.5
  // El separador antes del aro puede ser ZR (velocidad), RF/FR (run-flat) o R.
  mm = c.match(/^(\d{3})\/(\d{2,3})(?:ZR|RF|FR|R)(\d{2}(?:\.\d)?)C?/);
  if (mm) return `${mm[1]}/${mm[2]}R${mm[3]}`;

  // 6a. Numérico con punto: 7.00R15 / 6.50-16 / 7.50 16 / 5.50R13C
  mm = c.match(/^(\d)\.(\d{2})[R\-]?(\d{2})C?/);
  if (mm) return `${mm[1]}.${mm[2]}R${mm[3]}`;

  // 6b. Numérico compacto (ancho en pulgadas, 1er dígito 4-8): 650R16 → 6.50R16, 750R16 → 7.50R16
  mm = c.match(/^([4-8])(\d{2})[R\-]?(\d{2})C?(?!\d)/);
  if (mm) return `${mm[1]}.${mm[2]}R${mm[3]}`;

  // 4. Métrico sin perfil: 165R13 / 185R14C / 205R16  (ancho mm, 1er dígito 1-3)
  mm = c.match(/^(\d{3})R(\d{2})C?/);
  if (mm) return `${mm[1]}R${mm[2]}`;

  // 5. Métrico estándar con separadores variados: 245 75 16, 245-75-16, 245/75/16
  mm = c.match(/^(\d{3})[\/\-]?(\d{2,3})[\/\-R]?(\d{2})(?!\d)/);
  if (mm) return `${mm[1]}/${mm[2]}R${mm[3]}`;

  // Sin patrón reconocible: compacto en mayúsculas (no pierde la búsqueda)
  return c;
}

/**
 * ¿La cadena PARECE una medida de llanta (alguna de las 8 familias)?
 * Sirve para decidir si normalizar un término de búsqueda libre.
 */
function pareceMedida(q) {
  if (!q) return false;
  const s = String(q).toUpperCase().replace(/,/g, '.').replace(/\s+/g, '');
  return (
    /\d{2}X\d/.test(s) ||                              // flotación
    /\d{3}\/\d{2,3}/.test(s) ||                        // métrico con perfil
    /\d\.\d{2}[R\- ]?\d{2}/.test(s) ||                 // numérico con punto
    /^[4-8]\d{2}R?\d{2}/.test(s) ||                    // numérico compacto
    /\d{3}R?\d{2}/.test(s) ||                          // sin perfil / estándar compacto
    /\d{3}[\/\-\s]\d{2,3}[\/\-\sR]?\d{2}/.test(s)       // estándar con separadores
  );
}

module.exports = { normalizarMedida, pareceMedida };
