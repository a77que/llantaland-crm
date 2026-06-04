const { mapApiToCrm } = require('../config/apiMapping');

async function consultar(tipoDoc, numDoc) {
  const tipo = tipoDoc.toLowerCase();
  let url, key;

  if (tipo === 'dni') {
    url = process.env.API_DNI_URL;
    key = process.env.API_DNI_KEY;
  } else if (tipo === 'ruc') {
    url = process.env.API_RUC_URL;
    key = process.env.API_RUC_KEY;
  } else if (tipo === 'ce') {
    url = process.env.API_CE_URL;
    key = process.env.API_CE_KEY;
  } else {
    return { encontrado: false, datos: {}, rawJson: null, mensaje: 'Tipo de documento no soportado para búsqueda automática' };
  }

  if (!url) {
    return { encontrado: false, datos: {}, rawJson: null, mensaje: `API de ${tipoDoc} no configurada` };
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
      return { encontrado: false, datos: {}, rawJson: null, mensaje: `No se encontró ${tipoDoc}: ${numDoc}` };
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
