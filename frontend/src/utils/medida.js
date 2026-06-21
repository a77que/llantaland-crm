// Normalización y dimensiones de medidas de llanta (espejo de backend/src/utils/medida.js).
// Soporta las 8 familias de formato del catálogo Llantaland.

function recortarDecimal(x) {
  if (!x.includes('.')) return x;
  return x.replace(/0+$/, '').replace(/\.$/, '');
}

export function normalizarMedida(m) {
  if (m === null || m === undefined) return m;
  let s = String(m).toUpperCase().replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(LT|P)\s*(?=\d)/, '');
  const c = s.replace(/\s+/g, '');
  let mm;

  // Flotación: 35X12.50R20
  mm = c.match(/^(\d{2})X(\d{1,2})(?:\.(\d+))?R(\d{2}(?:\.\d)?)/);
  if (mm) {
    let width = mm[3] ? `${mm[2]}.${mm[3]}` : mm[2];
    return `${mm[1]}X${recortarDecimal(width)}R${mm[4]}`;
  }
  // Métrico con perfil (ZR/RF/FR/R/C, aro decimal): 245/75R16, 195/50ZR15, 205/75R17.5
  mm = c.match(/^(\d{3})\/(\d{2,3})(?:ZR|RF|FR|R)(\d{2}(?:\.\d)?)C?/);
  if (mm) return `${mm[1]}/${mm[2]}R${mm[3]}`;
  // Numérico con punto: 7.00R15 / 6.50-16
  mm = c.match(/^(\d)\.(\d{2})[R\-]?(\d{2})C?/);
  if (mm) return `${mm[1]}.${mm[2]}R${mm[3]}`;
  // Numérico compacto: 650R16 → 6.50R16
  mm = c.match(/^([4-8])(\d{2})[R\-]?(\d{2})C?(?!\d)/);
  if (mm) return `${mm[1]}.${mm[2]}R${mm[3]}`;
  // Métrico sin perfil: 165R13 / 185R14
  mm = c.match(/^(\d{3})R(\d{2})C?/);
  if (mm) return `${mm[1]}R${mm[2]}`;
  // Métrico estándar con separadores variados: 245 75 16, 245-75-16
  mm = c.match(/^(\d{3})[\/\-]?(\d{2,3})[\/\-R]?(\d{2})(?!\d)/);
  if (mm) return `${mm[1]}/${mm[2]}R${mm[3]}`;

  return c;
}

// Ancho / Perfil / Radio para cualquier familia (null donde no aplique).
export function dimensionesMedida(m) {
  const s = normalizarMedida(m);
  if (!s) return { ancho: null, perfil: null, radio: null };
  let mm;

  // Flotación: 35X12.5R20
  mm = s.match(/^(\d{2})X(\d{1,2}(?:\.\d+)?)R(\d{2}(?:\.\d)?)$/);
  if (mm) return { ancho: parseFloat(mm[2]), perfil: null, radio: parseFloat(mm[3]) };
  // Métrico con perfil: 245/75R16
  mm = s.match(/^(\d{3})\/(\d{2,3})R(\d{2}(?:\.\d)?)$/);
  if (mm) return { ancho: parseInt(mm[1]), perfil: parseInt(mm[2]), radio: parseFloat(mm[3]) };
  // Numérico con punto: 7.50R16
  mm = s.match(/^(\d)\.(\d{2})R(\d{2})$/);
  if (mm) return { ancho: parseFloat(`${mm[1]}.${mm[2]}`), perfil: null, radio: parseInt(mm[3]) };
  // Métrico sin perfil: 165R13
  mm = s.match(/^(\d{3})R(\d{2})$/);
  if (mm) return { ancho: parseInt(mm[1]), perfil: null, radio: parseInt(mm[2]) };

  return { ancho: null, perfil: null, radio: null };
}
