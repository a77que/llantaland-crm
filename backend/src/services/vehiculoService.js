// Resolución de medida de llanta a partir del vehículo.
// 1) Placa → datos del vehículo (Factiliza, igual que el flujo n8n)
// 2) Marca + Modelo + Año → versiones con su medida de llanta (IA: Groq o Gemini)

const { getConfigApis } = require('./apiConfigService');
const { llamarIA: iaLlamar } = require('./iaService');
const { normalizarMedida } = require('../utils/medida');

// Consulta una placa peruana y devuelve marca, modelo y año si la API responde.
// Dos estilos de API soportados, según cómo esté configurada la URL:
// - GET con la placa en la URL (ej. Factiliza: .../placa/info/{placa}) — si la
//   URL trae {placa} o {numero}, se sustituye y se manda GET.
// - POST con la placa en el cuerpo JSON (ej. api.json.pe: URL fija +
//   {"placa": "..."}) — si la URL no trae marcador, este es el modo por
//   defecto, ya que es el proveedor real configurado hoy.
async function consultarPlaca(placa) {
  const cfg = await getConfigApis();
  const token = cfg.factilizaToken;
  const baseUrl = cfg.factilizaUrl; // configurable por si cambia de proveedor
  const limpia = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!limpia) return { encontrado: false, mensaje: 'Placa vacía' };
  if (!token) return { encontrado: false, mensaje: 'API de placa no configurada (falta el token)' };
  if (!baseUrl) return { encontrado: false, mensaje: 'API de placa no configurada (falta la URL)' };

  const tieneMarcador = baseUrl.includes('{placa}') || baseUrl.includes('{numero}');
  const endpoint = tieneMarcador ? baseUrl.replace('{placa}', limpia).replace('{numero}', limpia) : baseUrl;

  try {
    const resp = await fetch(endpoint, {
      method: tieneMarcador ? 'GET' : 'POST',
      headers: tieneMarcador
        ? { Authorization: `Bearer ${token}` }
        : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: tieneMarcador ? undefined : JSON.stringify({ placa: limpia }),
      signal: AbortSignal.timeout(9000),
    });
    if (!resp.ok) return { encontrado: false, mensaje: `No se encontró la placa ${limpia} (HTTP ${resp.status})` };
    const json = await resp.json();
    // Distintos proveedores devuelven la data en distinto lugar/forma:
    // {success, data:{...}} (json.pe), {status, data:{...}} (Factiliza), o plano.
    const d = json?.data || json || {};
    const exito = json.success !== false && (json.status === undefined || json.status === 200) && d && Object.keys(d).length > 0;
    if (!exito) {
      return { encontrado: false, mensaje: json.message || json.mensaje || `Placa ${limpia} no encontrada` };
    }
    // Año: a veces viene directo, a veces en el VIN (10º carácter)
    let anio = d.anio || d.año || null;
    if (!anio && d.vin && d.vin.length >= 10) {
      const code = d.vin[9].toUpperCase();
      const map = { A:2010,B:2011,C:2012,D:2013,E:2014,F:2015,G:2016,H:2017,J:2018,K:2019,L:2020,M:2021,N:2022,P:2023,R:2024,S:2025,T:2026 };
      if (map[code]) anio = map[code];
    }
    return {
      encontrado: true,
      placa: limpia,
      marca:  d.marca  || null,
      modelo: d.modelo || null,
      anio:   anio ? parseInt(anio) : null,
      version: d.version || null,
      raw: d,
    };
  } catch (err) {
    if (err.name === 'TimeoutError') return { encontrado: false, mensaje: 'Tiempo de espera agotado al consultar la placa' };
    return { encontrado: false, mensaje: err.message };
  }
}

// Llama a la IA (servicio central: respeta prioridad y activación Groq/Gemini).
async function llamarIA(prompt) {
  const { datos } = await iaLlamar(prompt);
  return datos;
}

// Devuelve las versiones de un vehículo (marca/modelo/año) con la medida de llanta original.
async function buscarVersiones(marca, modelo, anio) {
  if (!marca || !modelo) return { encontrado: false, mensaje: 'Marca y modelo son obligatorios', versiones: [] };

  // Mismo prompt (y mismo criterio: máximo 5, solo OEM real) que usa el bot
  // de WhatsApp (n8n, nodo "Groq chainLlm | versiones auto") — antes el CRM
  // tenía su propio prompt aparte, más permisivo (hasta 8, cualquier
  // formato), por eso mostraba más opciones que el bot para el mismo auto.
  const prompt = `Eres un experto en especificaciones tecnicas de vehiculos para el mercado peruano.

Lista las medidas de llanta originales de fabrica (OEM) para este vehiculo:
- Marca: ${marca || 'no especificado'}
- Modelo: ${modelo || 'no especificado'}
- Anio: ${anio || 'no especificado'}

REGLAS:
1. Lista SOLO medidas OEM originales de fabrica. No inventes medidas.
2. Maximo 5 versiones, ordenadas de la mas comun a la menos comun en Peru.
3. SIEMPRE devuelve al menos UNA medida si conoces la marca y el modelo; si no estas seguro de las versiones exactas, devuelve solo la medida de fabrica mas comun para ese modelo/anio (una sola entrada). Devuelve array vacio [] UNICAMENTE si no hay marca ni modelo.
4. El campo "descripcion" debe indicar brevemente que version/trim del vehiculo usa esa medida.

EJEMPLOS:
Marca:Toyota Modelo:Yaris Anio:2019 -> {"versiones":[{"medida":"185/65R15","descripcion":"version base XL aro 15"},{"medida":"195/60R16","descripcion":"version XLS sedan aro 16"}]}
Marca:Kia Modelo:Sportage Anio:2020 -> {"versiones":[{"medida":"235/55R18","descripcion":"version EX/LX"},{"medida":"235/50R19","descripcion":"version SXL premium"}]}
Marca:desconocido Modelo:desconocido Anio:no especificado -> {"versiones":[]}

Responde SOLO con JSON valido sin markdown:
{"versiones":[]}`;

  const datos = await llamarIA(prompt);
  if (!datos || !Array.isArray(datos.versiones)) {
    return { encontrado: false, mensaje: 'No se pudieron obtener las versiones', versiones: [] };
  }

  // Normalizar la medida de cada versión (acepta TODAS las familias — esta
  // parte SÍ se queda más permisiva que n8n a propósito: es solo la
  // validación de formato de lo que la IA ya devolvió, no cambia cuántas
  // opciones se piden ni el criterio de la IA, que es lo que se unificó).
  const reCanon = /^(\d{3}\/\d{2,3}R\d{2}(?:\.\d)?|\d{2}X[\d.]+R\d{2}|\d\.\d{2}R\d{2}|\d{3}R\d{2})$/;
  const versiones = datos.versiones
    .map(v => {
      const norm = normalizarMedida(String(v.medida || ''));
      if (!norm || !reCanon.test(norm)) return null;
      const aro = (norm.match(/R(\d{2})/) || [])[1];
      const desc = String(v.descripcion || v.version || '').slice(0, 80);
      return { version: desc || 'Estándar', medida: norm, aro: aro ? parseInt(aro) : null };
    })
    .filter(Boolean);

  // Quitar duplicados por versión+medida
  const seen = new Set();
  const unicas = versiones.filter(v => {
    const k = `${v.version}|${v.medida}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  // ¿Es resultado genérico? (la IA no halló versiones concretas y devolvió la medida de fábrica)
  const generico = unicas.length > 0 && unicas.every(v => /^general$/i.test(v.version));
  if (generico) unicas.forEach(v => { v.version = 'Medida de tu vehículo'; });

  return { encontrado: unicas.length > 0, versiones: unicas, generico };
}

module.exports = { consultarPlaca, buscarVersiones };
