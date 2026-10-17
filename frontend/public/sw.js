/* Service worker del CRM Llantaland.
 * - Habilita la PWA instalable (requisito de iOS para notificaciones).
 * - Recibe Web Push y muestra la notificación (despierta al vendedor).
 * - Al tocar la notificación, abre/enfoca el chat.
 * No cachea nada: siempre red (evita servir una app vieja tras un deploy).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Handler de fetch "pasa-todo": su sola presencia hace instalable la PWA en iOS,
// pero no intercepta nada (el navegador resuelve cada request con la red normal).
self.addEventListener('fetch', () => { /* passthrough */ });

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'Llantaland CRM';
  const options = {
    body: data.body || 'Tienes un mensaje nuevo',
    icon: '/OsoLogoSVG.svg',
    badge: '/OsoLogoSVG.svg',
    tag: data.sessionId ? ('chat-' + data.sessionId) : 'chat',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 120, 300, 120, 300],
    data: { url: data.url || '/chat' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/chat';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if ('navigate' in c) { try { c.navigate(url); } catch { /* no-op */ } }
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
