/**
 * Mapeo del JSON externo de cada API (DNI/RUC/CE) al modelo Cliente.
 * Robusto: lee desde `data`/`result` si el proveedor envuelve la respuesta, y prueba
 * varios nombres de campo (Factiliza, apis-net, snake_case y camelCase).
 */

// Candidatos de nombre de campo por dato (se usa el primero que tenga valor)
const CANDIDATOS = {
  dni: {
    nombres:   ['nombres', 'nombre', 'prenombres', 'first_name', 'firstName'],
    apePat:    ['apellido_paterno', 'apellidoPaterno', 'ape_paterno', 'apellidoPat'],
    apeMat:    ['apellido_materno', 'apellidoMaterno', 'ape_materno', 'apellidoMat'],
    completo:  ['nombre_completo', 'nombreCompleto', 'full_name', 'fullName'],
    direccion: ['direccion', 'direccion_completa', 'domicilio', 'address'],
  },
  ce: {
    nombres:   ['nombres', 'nombre', 'first_name'],
    apePat:    ['apellido_paterno', 'apellidoPaterno'],
    apeMat:    ['apellido_materno', 'apellidoMaterno'],
    completo:  ['nombre_completo', 'nombreCompleto', 'full_name'],
    direccion: ['direccion', 'domicilio', 'address'],
  },
  ruc: {
    razon:     ['nombre_o_razon_social', 'razon_social', 'razonSocial', 'nombre', 'nombre_completo'],
    direccion: ['direccion', 'direccion_completa', 'domicilio', 'address'],
  },
};

function pick(src, candidatos) {
  for (const c of candidatos) {
    const v = src?.[c];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return undefined;
}

function clean(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) o[k] = v;
  return o;
}

/**
 * @param {string} tipoDoc - 'dni' | 'ruc' | 'ce'
 * @param {object} rawJson - JSON completo de la API externa
 * @returns {object} { nombre?, apellidos?, razonSocial?, direccion? }
 */
function mapApiToCrm(tipoDoc, rawJson) {
  const tipo = String(tipoDoc).toLowerCase();
  // La data suele venir anidada en .data / .result / .response
  const src = (rawJson && (rawJson.data || rawJson.result || rawJson.response)) || rawJson || {};

  if (tipo === 'ruc') {
    return clean({ razonSocial: pick(src, CANDIDATOS.ruc.razon), direccion: pick(src, CANDIDATOS.ruc.direccion) });
  }

  const c = CANDIDATOS[tipo] || CANDIDATOS.dni;
  let nombre = pick(src, c.nombres);
  const apellidos = [pick(src, c.apePat), pick(src, c.apeMat)].filter(Boolean).join(' ') || undefined;
  // Si el proveedor solo da el nombre completo, úsalo como nombre
  if (!nombre && !apellidos) nombre = pick(src, c.completo);
  return clean({ nombre, apellidos, direccion: pick(src, c.direccion) });
}

module.exports = { mapApiToCrm };
