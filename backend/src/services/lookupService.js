const { mapApiToCrm } = require('../config/apiMapping');
const { getConfigApis } = require('./apiConfigService');

async function consultar(tipoDoc, numDoc) {
  const tipo = tipoDoc.toLowerCase();
  const cfg = await getConfigApis();
  let url, key;

  if (tipo === 'dni') {
    url = cfg.dniUrl;
    key = cfg.dniKey;
  } else if (tipo === 'ruc') {
    url = cfg.rucUrl;
    key = cfg.rucKey;
  } else if (tipo === 'ce') {
    url = cfg.ceUrl;
    key = cfg.ceKey;
  } else {
    return { encontrado: false, datos: {}, rawJson: null, mensaje: 'Tipo de documento no soportado para búsqueda automática' };
  }

  if (!url) {
    return { encontrado: false, datos: {}, rawJson: null, mensaje: `API de ${tipoDoc} no configurada` };
  }
  if (!key) {
    return { encontrado: false, datos: {}, rawJson: null, mensaje: `Falta el token de la API de ${tipoDoc}. Cárgalo en Config APIs (el mismo token de la placa sirve para DNI/RUC en Factiliza).` };
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    // Construir URL — la mayoría de APIs aceptan el número en el path o query
    const endpoint = url.includes('{numero}')
      ? url.replace('{numero}', numDoc)
      : `${url}/${numDoc}`;

    const resp = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8000) });

    if (!resp.ok) {
      const detalle = (resp.status === 401 || resp.status === 403)
        ? `Token inválido o sin permiso para ${tipoDoc} (HTTP ${resp.status}). Revisa el token en Config APIs.`
        : `No se encontró ${tipoDoc}: ${numDoc} (HTTP ${resp.status})`;
      return { encontrado: false, datos: {}, rawJson: null, mensaje: detalle };
    }

    const rawJson = await resp.json();
    const datos = mapApiToCrm(tipo, rawJson);

    return { encontrado: true, datos, rawJson };
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { encontrado: false, datos: {}, rawJson: null, mensaje: 'Tiempo de espera agotado al consultar la API' };
    }
    return { encontrado: false, datos: {}, rawJson: null, mensaje: err.message };
  }
}

module.exports = { consultar };
