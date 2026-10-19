const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const { emitirChat, emitirVendedores } = require('../lib/io');
const { notificarVendedores, vapidPublicKey, guardarSuscripcion, borrarSuscripcion } = require('../lib/push');

// Convierte la nota de voz a AAC (.m4a), que se reproduce en TODOS los
// dispositivos (iPhone incluido). Android/Chrome graba en webm/opus, que no
// suena en iOS; esto lo normaliza. Si ya es .m4a no reconvierte. Si ffmpeg no
// está (p.ej. entorno local), devuelve null y se usa el archivo original.
function transcodificarM4a(inputPath) {
  return new Promise((resolve) => {
    const outPath = inputPath.replace(/\.[^.]+$/, '') + '.m4a';
    if (inputPath === outPath) return resolve(inputPath); // ya es m4a (iOS) → universal
    const ff = spawn('ffmpeg', ['-y', '-i', inputPath, '-vn', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', outPath]);
    let err = '';
    ff.stderr.on('data', (d) => { err += d.toString(); });
    ff.on('error', () => resolve(null));           // ffmpeg no instalado
    ff.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPath)) {
        try { fs.unlinkSync(inputPath); } catch { /* no-op */ }
        resolve(outPath);
      } else {
        console.error('ffmpeg transcode falló:', err.slice(-300));
        resolve(null);
      }
    });
  });
}

// WhatsApp pausado: mientras YCloud cobra, no se envía nada a WhatsApp. El bot y
// el chat web siguen funcionando; solo los números reales se dejan de reenviar.
// Reactivar = poner WHATSAPP_ENABLED=true en el entorno y reiniciar. No borra nada.
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';

// ─── Chat interno (web) ──────────────────────────────────────────────────────
// Reusa el MISMO cerebro del bot en n8n: cada sesión web se identifica con un
// "teléfono" numérico de 11 dígitos que empieza en WEB_PREFIX. Así toda la
// lógica de n8n (que trabaja por número) funciona igual, sin reescribirla.
// Las respuestas del bot vuelven por /api/chat/relay (ver abajo).

const N8N_WEBHOOK = process.env.N8N_WEBHOOK_URL
  || 'https://llantaland-n8n.vqoynm.easypanel.host/webhook/whatsapp';
const YCLOUD_URL = 'https://api.ycloud.com/v2/whatsapp/messages';
const WEB_PREFIX = '99';          // ids web: '99' + 9 dígitos = 11 (los móviles reales quedan en 9)

const esWeb = (tel) => typeof tel === 'string' && tel.startsWith(WEB_PREFIX) && tel.replace(/\D/g, '').length === 11;

function nuevoWebId() {
  let s = WEB_PREFIX;
  for (let i = 0; i < 9; i++) s += Math.floor(Math.random() * 10);
  return s;
}

// Extrae texto + opciones de un cuerpo estilo YCloud (texto o interactivo).
function parsearSalidaBot(body) {
  const out = { texto: '', opciones: [] };
  if (!body || typeof body !== 'object') return out;
  if (body.text && body.text.body) out.texto = String(body.text.body);
  else if (body.interactive) {
    const it = body.interactive;
    out.texto = String(it.body?.text || '');
    const botones = it.action?.buttons || [];
    const filas = (it.action?.sections || []).flatMap(s => s.rows || []);
    out.opciones = [
      ...botones.map(b => ({ id: b.reply?.id, titulo: b.reply?.title })),
      ...filas.map(r => ({ id: r.id, titulo: r.title, descripcion: r.description })),
    ].filter(o => o.id != null);
  } else if (body.image) out.texto = '[imagen]' + (body.image.caption ? ' ' + body.image.caption : '');
  else if (body.audio) out.texto = '[nota de voz]';
  else if (body.document) out.texto = '[documento]';
  return out;
}

async function guardarMensaje(telefono, rol, mensaje) {
  const lead = await prisma.leadCRM.findUnique({ where: { telefono }, select: { id: true } });
  if (!lead) return null;
  return prisma.mensajeHistorial.create({
    data: { leadId: lead.id, telefono, rol, mensaje },
  });
}

// POST /api/chat/session  — crea (o retoma) una sesión de chat web.
const iniciarSesion = async (req, res, next) => {
  try {
    let { sessionId } = req.body || {};
    if (sessionId && esWeb(sessionId)) {
      const existe = await prisma.leadCRM.findUnique({ where: { telefono: sessionId } });
      if (existe) return res.json({ sessionId, nuevo: false });
    }
    sessionId = nuevoWebId();
    await prisma.leadCRM.create({
      data: { telefono: sessionId, canal: 'web', pasoActual: 'nuevo' },
    });
    res.json({ sessionId, nuevo: true });
  } catch (err) { next(err); }
};

// POST /api/chat/mensaje  { sessionId, texto } — mensaje del cliente.
const enviarMensaje = async (req, res, next) => {
  try {
    const { sessionId, texto } = req.body || {};
    if (!esWeb(sessionId)) return res.status(400).json({ error: 'Sesión inválida' });
    const t = String(texto || '').trim();
    if (!t) return res.status(400).json({ error: 'Mensaje vacío' });

    await guardarMensaje(sessionId, 'cliente', t);
    emitirVendedores('chat:cliente', { sessionId, texto: t, ts: Date.now() });

    // Aviso push a los vendedores (PWA en iOS/Android/escritorio). Despierta al
    // vendedor aunque tenga el CRM cerrado; al abrirlo arranca la sirena fuerte.
    notificarVendedores({
      title: '💬 Nuevo mensaje de cliente',
      body: t.length > 120 ? t.slice(0, 117) + '…' : t,
      sessionId,
      url: '/chat?c=' + sessionId,
    }).catch(() => { /* el push nunca debe cortar el chat */ });

    // Reenviar al cerebro del bot (n8n), con el mismo formato que usa WhatsApp.
    try {
      await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'whatsapp.inbound_message.received',
          canal: 'web',
          whatsappInboundMessage: { from: sessionId, type: 'text', text: { body: t } },
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      console.error('chat: no se pudo contactar n8n:', e.message);
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// GET /api/chat/mensajes/:sessionId?after=<iso>  — historial / polling de respaldo.
const listarMensajes = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    if (!esWeb(sessionId)) return res.status(400).json({ error: 'Sesión inválida' });
    const after = req.query.after ? new Date(req.query.after) : null;
    const msgs = await prisma.mensajeHistorial.findMany({
      where: { telefono: sessionId, ...(after ? { timestamp: { gt: after } } : {}) },
      orderBy: { timestamp: 'asc' },
      take: 200,
      select: { id: true, rol: true, mensaje: true, audioUrl: true, timestamp: true },
    });
    res.json({ mensajes: msgs });
  } catch (err) { next(err); }
};

// POST /api/chat/relay — n8n envía aquí sus respuestas (en vez de directo a YCloud).
// Si el destino es una sesión web, la entrega al navegador; si es un número real,
// la reenvía a YCloud para que WhatsApp siga funcionando igual que antes.
const relay = async (req, res, next) => {
  try {
    const body = req.body || {};
    const toRaw = String(body.to || '');
    const to = toRaw.replace(/^\+?51/, '').replace(/\D/g, '');

    if (esWeb(to) || esWeb(toRaw)) {
      const sessionId = esWeb(to) ? to : toRaw;
      const { texto, opciones } = parsearSalidaBot(body);
      if (texto || opciones.length) {
        await guardarMensaje(sessionId, 'bot', texto || (opciones.length ? '[opciones]' : ''));
        emitirChat(sessionId, 'chat:bot', { texto, opciones, ts: Date.now() });
        emitirVendedores('chat:bot', { sessionId, texto, ts: Date.now() });
      }
      return res.json({ ok: true, canal: 'web' });
    }

    // WhatsApp pausado: no se reenvía a YCloud (así no hay conversación facturable).
    // Respondemos 200 para que n8n no reintente. Reversible con WHATSAPP_ENABLED=true.
    if (!WHATSAPP_ENABLED) {
      console.log('[WhatsApp OFF] mensaje a', toRaw, '— NO enviado a YCloud (WHATSAPP_ENABLED=false)');
      return res.json({ ok: true, canal: 'whatsapp', disabled: true });
    }

    // Número real → reenviar a YCloud con la misma autorización que mandó n8n.
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers['x-api-key']) headers['X-API-Key'] = req.headers['x-api-key'];
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
    const r = await fetch(YCLOUD_URL, {
      method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    const txt = await r.text();
    res.status(r.status).type('application/json').send(txt);
  } catch (err) {
    console.error('chat relay error:', err.message);
    res.status(502).json({ error: 'relay' });
  }
};

// POST /api/chat/vendedor  { sessionId, texto }  (requiere login) — el vendedor
// responde en un chat web. Pausa el bot (takeover) y entrega al navegador.
const responderVendedor = async (req, res, next) => {
  try {
    const { sessionId, texto } = req.body || {};
    if (!esWeb(sessionId)) return res.status(400).json({ error: 'Sesión inválida' });
    const t = String(texto || '').trim();
    if (!t) return res.status(400).json({ error: 'Mensaje vacío' });

    const lead = await prisma.leadCRM.findUnique({ where: { telefono: sessionId }, select: { id: true } });
    if (!lead) return res.status(404).json({ error: 'Sesión no encontrada' });

    // Al entrar el vendedor, se pausa el bot para ese cliente (como en WhatsApp).
    await prisma.humanTakeover.upsert({
      where: { telefono: sessionId },
      update: { agenteActivo: true, timestampUltimoAgente: new Date() },
      create: { leadId: lead.id, telefono: sessionId, agenteActivo: true, timestampUltimoAgente: new Date() },
    });

    await prisma.mensajeHistorial.create({ data: { leadId: lead.id, telefono: sessionId, rol: 'vendedor', mensaje: t } });
    emitirChat(sessionId, 'chat:bot', { texto: t, opciones: [], vendedor: true, ts: Date.now() });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// POST /api/chat/vendedor/audio  (requiere login, multipart campo "audio") — el
// vendedor manda una NOTA DE VOZ al cliente. Pausa el bot (takeover) igual que el
// texto, guarda el audio en /uploads y lo entrega al navegador del cliente.
const responderVendedorAudio = async (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (!esWeb(sessionId)) return res.status(400).json({ error: 'Sesión inválida' });
    if (!req.file) return res.status(400).json({ error: 'Audio requerido' });

    const lead = await prisma.leadCRM.findUnique({ where: { telefono: sessionId }, select: { id: true } });
    if (!lead) return res.status(404).json({ error: 'Sesión no encontrada' });

    // Normaliza a AAC para que suene en cualquier dispositivo del cliente; si
    // ffmpeg falla, cae al archivo original (no rompe el envío).
    const out = await transcodificarM4a(req.file.path);
    const filename = out ? path.basename(out) : req.file.filename;
    const audioUrl = '/uploads/' + filename;

    await prisma.humanTakeover.upsert({
      where: { telefono: sessionId },
      update: { agenteActivo: true, timestampUltimoAgente: new Date() },
      create: { leadId: lead.id, telefono: sessionId, agenteActivo: true, timestampUltimoAgente: new Date() },
    });

    await prisma.mensajeHistorial.create({ data: { leadId: lead.id, telefono: sessionId, rol: 'vendedor', mensaje: '[nota de voz]', audioUrl } });
    emitirChat(sessionId, 'chat:bot', { texto: '', audioUrl, opciones: [], vendedor: true, ts: Date.now() });
    res.json({ ok: true, audioUrl });
  } catch (err) { next(err); }
};

// GET /api/chat/conversaciones  (requiere login) — lista las conversaciones web
// para el panel del vendedor, con el último mensaje y si hay agente atendiendo.
const listarConversaciones = async (req, res, next) => {
  try {
    const leads = await prisma.leadCRM.findMany({
      where: { canal: 'web' },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        telefono: true, nombreCliente: true, pasoActual: true, updatedAt: true,
        humanTakeover: { select: { agenteActivo: true } },
      },
    });
    const tels = leads.map(l => l.telefono);
    const ultimos = await prisma.mensajeHistorial.findMany({
      where: { telefono: { in: tels } },
      orderBy: { timestamp: 'desc' },
      select: { telefono: true, rol: true, mensaje: true, timestamp: true },
    });
    const ultimoPorTel = {};
    for (const m of ultimos) if (!ultimoPorTel[m.telefono]) ultimoPorTel[m.telefono] = m;

    const conversaciones = leads.map(l => {
      const u = ultimoPorTel[l.telefono];
      return {
        sessionId: l.telefono,
        nombre: l.nombreCliente || null,
        pasoActual: l.pasoActual,
        agenteActivo: l.humanTakeover?.agenteActivo || false,
        ultimoMensaje: u?.mensaje || '',
        ultimoRol: u?.rol || '',
        ts: u?.timestamp || l.updatedAt,
      };
    }).sort((a, b) => new Date(b.ts) - new Date(a.ts));

    res.json({ conversaciones });
  } catch (err) { next(err); }
};

// GET /api/chat/vapid — llave pública para suscribir el navegador al push.
const vapid = (req, res) => res.json({ publicKey: vapidPublicKey() });

// POST /api/chat/push/subscribe  (requiere login) — guarda la suscripción del navegador.
const suscribirPush = async (req, res, next) => {
  try {
    const sub = (req.body && req.body.subscription) || req.body;
    const r = await guardarSuscripcion(sub, req.usuario?.id, req.headers['user-agent']);
    res.json({ ok: !!r });
  } catch (err) { next(err); }
};

// POST /api/chat/push/unsubscribe  (requiere login) — elimina la suscripción.
const desuscribirPush = async (req, res, next) => {
  try {
    await borrarSuscripcion(req.body && req.body.endpoint);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

module.exports = {
  iniciarSesion, enviarMensaje, listarMensajes, relay, responderVendedor, responderVendedorAudio, esWeb,
  listarConversaciones, vapid, suscribirPush, desuscribirPush,
};
