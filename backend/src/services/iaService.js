/**
 * Servicio central de IA: llama a Groq y/o Gemini respetando la PRIORIDAD y la
 * ACTIVACIÓN configuradas en Config APIs. Devuelve { datos, rate, sinIa }.
 *   - datos: objeto JSON parseado (o null si ninguna respondió)
 *   - rate:  true si alguna IA respondió 429 (límite de velocidad)
 *   - sinIa: true si no hay ninguna IA activa/configurada
 */
const { getConfigApis } = require('./apiConfigService');

const GROQ_MODEL = 'llama-3.1-8b-instant';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Parseo tolerante: la IA a veces envuelve el JSON en ```json ... ``` o agrega texto.
function extraerJson(text) {
  if (!text) return null;
  let s = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(s); } catch (e) { /* intentar extraer el bloque {...} */ }
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch (e) { /* nada */ } }
  return null;
}

async function _groq(prompt, key, jsonObject, maxTokens, timeoutMs) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, max_tokens: maxTokens,
      ...(jsonObject ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (r.status === 429) return { rate: true };
  if (r.ok) { const d = await r.json(); const c = d.choices?.[0]?.message?.content; const datos = extraerJson(c); if (datos) return { datos }; }
  return {};
}

async function _gemini(prompt, key, jsonObject, maxTokens, timeoutMs) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens, ...(jsonObject ? { responseMimeType: 'application/json' } : {}) } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (r.status === 429) return { rate: true };
  if (r.ok) { const d = await r.json(); const c = d.candidates?.[0]?.content?.parts?.[0]?.text; const datos = extraerJson(c); if (datos) return { datos }; }
  return {};
}

async function llamarIA(prompt, { jsonObject = true, maxTokens = 900, timeoutMs = 20000 } = {}) {
  const cfg = await getConfigApis();
  const usarGroq = cfg.groqActivo && !!cfg.groqKey;
  const usarGemini = cfg.geminiActivo && !!cfg.geminiKey;
  if (!usarGroq && !usarGemini) return { datos: null, rate: false, sinIa: true };

  const orden = cfg.iaPrioridad === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini'];
  let rate = false;
  for (const prov of orden) {
    try {
      let res = null;
      if (prov === 'groq' && usarGroq) res = await _groq(prompt, cfg.groqKey, jsonObject, maxTokens, timeoutMs);
      else if (prov === 'gemini' && usarGemini) res = await _gemini(prompt, cfg.geminiKey, jsonObject, maxTokens, timeoutMs);
      if (res) {
        if (res.rate) rate = true;
        if (res.datos) return { datos: res.datos, rate, sinIa: false };
      }
    } catch (e) { /* probar el siguiente proveedor */ }
  }
  return { datos: null, rate, sinIa: false };
}

module.exports = { llamarIA };
