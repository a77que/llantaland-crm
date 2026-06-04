/**
 * Mapeo de campos del JSON externo de cada API al modelo Cliente de Prisma.
 * Modifica este archivo cuando obtengas el JSON real de tu proveedor de API.
 *
 * Para campos compuestos usa un array: ['apellidoPaterno', 'apellidoMaterno']
 * El sistema los unirá con un espacio.
 */
const apiMapping = {
  dni: {
    nombre: 'nombres',
    apellidos: ['apellidoPaterno', 'apellidoMaterno'],
    direccion: 'direccion',
  },
  ruc: {
    razonSocial: 'razonSocial',
    direccion: 'direccion',
    // campos extras disponibles en apiRawJson: condicion, estado, tipoContribuyente
  },
  ce: {
    nombre: 'nombres',
    apellidos: ['apellidoPaterno', 'apellidoMaterno'],
    // campos extras disponibles en apiRawJson: pais, fechaVencimiento
  },
};

/**
 * Extrae el valor de un campo del objeto fuente.
 * Acepta string (un campo) o array (múltiples campos → concatena).
 */
function extractField(source, fieldDef) {
  if (!fieldDef || !source) return undefined;
  if (Array.isArray(fieldDef)) {
    return fieldDef.map((f) => source[f] || '').join(' ').trim() || undefined;
  }
  return source[fieldDef] || undefined;
}

/**
 * Mapea el JSON crudo de la API al objeto de cliente para Prisma.
 * @param {string} tipoDoc - 'dni' | 'ruc' | 'ce'
 * @param {object} rawJson - JSON completo devuelto por la API externa
 * @returns {object} campos mapeados para upsert del cliente
 */
function mapApiToCrm(tipoDoc, rawJson) {
  const tipo = tipoDoc.toLowerCase();
  const mapping = apiMapping[tipo];
  if (!mapping) return {};

  const result = {};
  for (const [crmField, sourceField] of Object.entries(mapping)) {
    const value = extractField(rawJson, sourceField);
    if (value !== undefined) result[crmField] = value;
  }
  return result;
}

module.exports = { apiMapping, mapApiToCrm };
