// Resolución de medida de llanta a partir del vehículo.
// 1) Placa → datos del vehículo (Factiliza, igual que el flujo n8n)
// 2) Marca + Modelo + Año → versiones con su medida de llanta (IA: Groq o Gemini)

const { getConfigApis } = require('./apiConfigService');
const { normalizarMedida } = require('../utils/medida');

// Consulta una placa peruana y devuelve marca, modelo y año si la API responde.
async function consultarPlaca(placa) {
  const cfg = await getConfigApis();
  const token = cfg.factilizaToken;
  const baseUrl = cfg.factilizaUrl; // configurable por si cambia de proveedor
  const limpia = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!limpia) return { encontrado: false, mensaje: 'Placa vacía' };
  if (!token) return { encontrado: false, mensaje: 'API de placa no configurada (falta el token)' };
  if (!baseUrl) return { encontrado: false, mensaje: 'API de placa no configurada (falta la URL)' };

  // Soporta {placa} en la URL o se agrega al final (estilo Factiliza)
  const endpoint = baseUrl.includes('{placa}') ? baseUrl.replace('{placa}', limpia) : `${baseUrl}/${limpia}`;

  try {
    const resp = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(9000),
    });
    if (!resp.ok) return { encontrado: false, mensaje: `No se encontró la placa ${limpia}` };
    const json = await resp.json();
    const d = json?.data || {};
    if (!d || (json.status && json.status !== 200)) {
      return { encontrado: false, mensaje: `Placa ${limpia} no encontrada` };
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

// Llama a una IA (Groq → Gemini fallback) para listar versiones de un vehículo y su medida.
async function llamarIA(prompt) {
  const cfg = await getConfigApis();
  const groqKey = cfg.groqKey;
  if (groqKey) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // mismo modelo barato que usa el flujo n8n
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2, max_tokens: 800,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        const d = await r.json();
        const c = d.choices?.[0]?.message?.content;
        if (c) return JSON.parse(c);
      }
    } catch (e) { console.warn('[vehiculo] Groq falló:', e.message); }
  }

  const geminiKey = cfg.geminiKey;
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(15000),
        }
      );
      if (r.ok) {
        const d = await r.json();
        const c = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (c) return JSON.parse(c);
      }
    } catch (e) { console.warn('[vehiculo] Gemini falló:', e.message); }
  }
  return null;
}

// Devuelve las versiones de un vehículo (marca/modelo/año) con la medida de llanta original.
async function buscarVersiones(marca, modelo, anio) {
  if (!marca || !modelo) return { encontrado: false, mensaje: 'Marca y modelo son obligatorios', versiones: [] };

  const prompt = `Eres un experto en especificaciones técnicas de automóviles y sus neumáticos de equipo original (OEM).
Para el siguiente vehículo, lista TODAS las versiones/equipamientos disponibles en el mercado peruano con su medida de neumático de fábrica.

Vehículo:
- Marca: ${marca}
- Modelo: ${modelo}
- Año: ${anio || 'no especificado'}

Responde ÚNICAMENTE con un JSON válido con esta forma exacta:
{
  "versiones": [
    { "version": "nombre de la versión/equipamiento", "medida": "medida en formato 195/65R15", "aro": 15 }
  ]
}
Reglas:
- Acepta cualquier formato de medida (métrico 205/55R16, comercial 205/65R16C, sin perfil 165R13, pulgadas 7.50R16 o 31X10.50R15).
- Si una versión tiene varias medidas según el aro, lista cada una como una entrada separada.
- Si no estás seguro del año, da las versiones más comunes de ese modelo.
- SIEMPRE devuelve al menos UNA entrada. Si NO puedes determinar versiones específicas,
  devuelve una sola entrada con "version": "GENERAL" y la medida de neumático original
  más común para ese modelo/año. Nunca devuelvas la lista vacía.
- Máximo 8 versiones, las más relevantes. No inventes versiones inexistentes.`;

  const datos = await llamarIA(prompt);
  if (!datos || !Array.isArray(datos.versiones)) {
    return { encontrado: false, mensaje: 'No se pudieron obtener las versiones', versiones: [] };
  }

  // Normalizar la medida de cada versión (acepta TODAS las familias)
  const reCanon = /^(\d{3}\/\d{2,3}R\d{2}(?:\.\d)?|\d{2}X[\d.]+R\d{2}|\d\.\d{2}R\d{2}|\d{3}R\d{2})$/;
  const versiones = datos.versiones
    .map(v => {
      const norm = normalizarMedida(String(v.medida || ''));
      if (!norm || !reCanon.test(norm)) return null;
      const aro = (norm.match(/R(\d{2})/) || [])[1];
      return { version: String(v.version || '').slice(0, 80) || 'Estándar', medida: norm, aro: aro ? parseInt(aro) : null };
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
