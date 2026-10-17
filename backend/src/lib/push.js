// Web Push para avisar a los vendedores de mensajes nuevos del chat web.
// Las llaves VAPID viven en variables de entorno (VAPID_PUBLIC_KEY /
// VAPID_PRIVATE_KEY). Si no están, el push queda INACTIVO sin romper nada:
// el chat en vivo por Socket.IO sigue funcionando igual.
const prisma = require('./prisma');

let webpush = null;
let habilitado = false;
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@llantaland.com';

try {
  if (PUBLIC_KEY && PRIVATE_KEY) {
    webpush = require('web-push');
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    habilitado = true;
    console.log('🔔 Web Push habilitado');
  } else {
    console.log('🔕 Web Push inactivo (faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)');
  }
} catch (e) {
  console.warn('push: web-push no disponible —', e.message);
}

const vapidPublicKey = () => (habilitado ? PUBLIC_KEY : null);
const pushHabilitado = () => habilitado;

async function guardarSuscripcion(sub, usuarioId, userAgent) {
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return null;
  return prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, usuarioId: usuarioId || null, userAgent: userAgent || null },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, usuarioId: usuarioId || null, userAgent: userAgent || null },
  });
}

async function borrarSuscripcion(endpoint) {
  if (!endpoint) return;
  try { await prisma.pushSubscription.deleteMany({ where: { endpoint } }); } catch { /* no-op */ }
}

// Envía un push a TODOS los vendedores suscritos. Limpia las suscripciones
// muertas (404/410). Nunca lanza: un fallo de push jamás debe cortar el chat.
async function notificarVendedores(payload) {
  if (!habilitado) return;
  let subs = [];
  try { subs = await prisma.pushSubscription.findMany(); } catch { return; }
  if (!subs.length) return;
  const data = JSON.stringify(payload || {});
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        data,
        { TTL: 120, urgency: 'high' },
      );
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        try { await prisma.pushSubscription.delete({ where: { endpoint: s.endpoint } }); } catch { /* no-op */ }
      }
    }
  }));
}

module.exports = { vapidPublicKey, pushHabilitado, guardarSuscripcion, borrarSuscripcion, notificarVendedores };
