# Llantaland — App del Vendedor (Expo, Android)

App móvil para que los vendedores reciban y atiendan los chats del CRM
(canal web y WhatsApp). Login con las mismas credenciales del CRM.

- API: `https://crm.llantaland.com` (configurable en `eas.json` → `EXPO_PUBLIC_API_URL`).
- Tiempo real por WebSocket (Socket.IO) contra el mismo backend.

## Requisitos (una sola vez)
```bash
npm i -g eas-cli
cd mobile
npm install
eas login            # cuenta Expo  (owner: a77que)
eas init             # crea/enlaza el projectId (lo escribe en app.json)
```

## Generar el APK (instalación directa, sin tiendas)
```bash
eas build -p android --profile preview
```
Al terminar, EAS da un **link / QR**: ábrelo en el celular Android y se instala
el `.apk` directo (habilitar "instalar apps de fuentes desconocidas").

## Probar en vivo sin compilar
```bash
npx expo start         # abrir con la app "Expo Go" (Android)
```

## Pantallas
- `app/login.tsx` — ingreso con correo/clave del CRM.
- `app/index.tsx` — lista de chats (💻 web / 📱 WhatsApp), se actualiza sola.
- `app/chat/[id].tsx` — conversación en vivo; responder (chats web), pausar/
  reactivar el bot (takeover). Los chats de WhatsApp se ven aquí pero se
  responden desde WhatsApp.

> iOS: por ahora no se genera (Apple exige cuenta de desarrollador para instalar
> fuera de la App Store). El código ya es compatible para cuando se active.
