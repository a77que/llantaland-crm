const crypto = require('crypto');

// Comparación en tiempo constante (evita side-channel de timing). timingSafeEqual
// exige buffers del mismo largo, así que se compara contra un hash de largo fijo
// en vez del valor crudo — evita que un atacante infiera el largo real de la key.
function coincide(recibida, esperada) {
  if (!recibida || !esperada) return false;
  const a = crypto.createHash('sha256').update(recibida).digest();
  const b = crypto.createHash('sha256').update(esperada).digest();
  return crypto.timingSafeEqual(a, b);
}

const n8nAuth = (req, res, next) => {
  const apiKey = req.headers['x-n8n-api-key'];
  // N8N_API_KEY_OLD: solo existe durante la ventana de rotación de la clave
  // bot↔CRM, para que el workflow en vivo siga funcionando mientras se
  // actualizan sus ~30-40 nodos con la clave nueva. Se quita del entorno
  // (y de aquí) una vez confirmada la rotación completa.
  const valida = coincide(apiKey, process.env.N8N_API_KEY) ||
    (process.env.N8N_API_KEY_OLD && coincide(apiKey, process.env.N8N_API_KEY_OLD));
  if (!valida) {
    return res.status(401).json({ error: 'API Key inválida' });
  }
  next();
};

module.exports = { n8nAuth };
