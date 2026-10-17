// Suscripción a Web Push desde el navegador del vendedor.
import { chatApi } from '../services/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad moderno

export const esStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const pushSoportado = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Activa el push. En iOS SOLO funciona si la PWA está instalada (pantalla de inicio).
export async function activarPush() {
  if (!pushSoportado()) return { ok: false, motivo: 'no-soportado' };
  if (esIOS() && !esStandalone()) return { ok: false, motivo: 'ios-instalar' };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, motivo: 'permiso-denegado' };

  const reg = await navigator.serviceWorker.ready;
  let publicKey;
  try { ({ publicKey } = await chatApi.vapid()); } catch { return { ok: false, motivo: 'sin-vapid' }; }
  if (!publicKey) return { ok: false, motivo: 'sin-vapid' };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await chatApi.suscribirPush(sub.toJSON ? sub.toJSON() : sub);
  return { ok: true };
}

export async function estaSuscrito() {
  if (!pushSoportado()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}
