import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { chatApi } from '../services/api';
import { iniciarAlarma, detenerAlarma, desbloquearAudio, audioDesbloqueado } from '../lib/alarma';
import { activarPush, estaSuscrito, esIOS, esStandalone, pushSoportado } from '../lib/webpush';

const COLORS = {
  bg: '#0a0a0a', panel: '#111', panel2: '#161616', border: '#242424',
  yellow: '#f5c400', red: '#e3000f', green: '#22c55e', text: '#eaeaea', muted: 'rgba(255,255,255,.45)',
};

function horaCorta(ts) {
  try { return new Date(ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export default function Chat() {
  const [params, setParams] = useSearchParams();
  const [convs, setConvs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [segGrab, setSegGrab] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [unread, setUnread] = useState(() => new Set());
  const [alerta, setAlerta] = useState(null);           // { sessionId, texto } del modal de sirena
  const [alertasOn, setAlertasOn] = useState(false);     // audio desbloqueado
  const [pushOn, setPushOn] = useState(false);
  const [mostrarInstalar, setMostrarInstalar] = useState(false);

  const selectedRef = useRef(null);
  const socketRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const scrollAbajo = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  // ── Carga inicial de conversaciones ──────────────────────────────────────
  const cargarConvs = useCallback(async () => {
    try {
      const { conversaciones } = await chatApi.conversaciones();
      setConvs(conversaciones || []);
    } catch { /* se reintenta al llegar un evento */ }
  }, []);

  useEffect(() => { cargarConvs(); }, [cargarConvs]);

  // ── Estado del push al entrar ─────────────────────────────────────────────
  useEffect(() => {
    estaSuscrito().then(setPushOn);
    if (esIOS() && !esStandalone()) setMostrarInstalar(true);
  }, []);

  // ── Abrir una conversación ────────────────────────────────────────────────
  const abrirConv = useCallback(async (sessionId) => {
    setSelected(sessionId);
    setParams({ c: sessionId }, { replace: true });
    setUnread(prev => {
      const next = new Set(prev); next.delete(sessionId);
      if (next.size === 0) { detenerAlarma(); setAlerta(null); }
      return next;
    });
    try {
      const { mensajes: msgs } = await chatApi.mensajes(sessionId);
      setMensajes(msgs || []);
      scrollAbajo();
    } catch { setMensajes([]); }
  }, [setParams, scrollAbajo]);

  // ── Socket.IO en vivo ─────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('vendedor:join'));

    socket.on('chat:cliente', ({ sessionId, id, texto: t, ts }) => {
      setConvs(prev => upsertConv(prev, sessionId, { ultimoMensaje: t, ultimoRol: 'cliente', ts }));
      const viendo = selectedRef.current === sessionId && document.visibilityState === 'visible';
      if (viendo) {
        const mid = id || ('rt-' + ts);
        setMensajes(prev => prev.some(m => m.id === mid) ? prev : [...prev, { id: mid, rol: 'cliente', mensaje: t, timestamp: ts }]);
        scrollAbajo();
      } else {
        setUnread(prev => new Set(prev).add(sessionId));
        setAlerta({ sessionId, texto: t });
        iniciarAlarma();
      }
    });

    socket.on('chat:bot', ({ sessionId, id, texto: t, audioUrl, ts, vendedor }) => {
      if (!t && !audioUrl) return;
      setConvs(prev => upsertConv(prev, sessionId, { ultimoMensaje: audioUrl ? '🎤 Nota de voz' : t, ultimoRol: vendedor ? 'vendedor' : 'bot', ts }));
      if (selectedRef.current === sessionId) {
        const mid = id || ('rt-' + ts);
        setMensajes(prev => prev.some(m => m.id === mid) ? prev : [...prev, { id: mid, rol: vendedor ? 'vendedor' : 'bot', mensaje: t, audioUrl, timestamp: ts }]);
        scrollAbajo();
      }
    });

    return () => { socket.close(); socketRef.current = null; };
  }, [scrollAbajo]);

  // Abrir la conversación que venga en la URL (?c=...) tras cargar la lista.
  useEffect(() => {
    const c = params.get('c');
    if (c && c !== selected) abrirConv(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Al volver a enfocar la ventana con la conversación abierta, marcar leído.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && selectedRef.current) {
        setUnread(prev => {
          const next = new Set(prev); next.delete(selectedRef.current);
          if (next.size === 0) { detenerAlarma(); setAlerta(null); }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Responder ─────────────────────────────────────────────────────────────
  const enviar = async () => {
    const t = texto.trim();
    if (!t || !selected || enviando) return;
    setEnviando(true);
    setMensajes(prev => [...prev, { id: 'me-' + Date.now(), rol: 'vendedor', mensaje: t, timestamp: Date.now() }]);
    setTexto('');
    scrollAbajo();
    try {
      await chatApi.responder(selected, t);
      setConvs(prev => upsertConv(prev, selected, { ultimoMensaje: t, ultimoRol: 'vendedor', ts: Date.now(), agenteActivo: true }));
    } catch {
      toast.error('No se pudo enviar');
    } finally { setEnviando(false); }
  };

  // ── Nota de voz del vendedor ──────────────────────────────────────────────
  const pickMime = () => {
    const cands = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    for (const c of cands) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c; } catch { /* no-op */ } }
    return '';
  };

  const subirAudio = async (blob, mime) => {
    if (!selected) return;
    const ext = (mime || '').includes('mp4') ? 'm4a' : (mime || '').includes('ogg') ? 'ogg' : 'webm';
    try {
      const r = await chatApi.responderAudio(selected, blob, `nota.${ext}`);
      setMensajes(prev => [...prev, { id: 'me-' + Date.now(), rol: 'vendedor', mensaje: '[nota de voz]', audioUrl: r?.audioUrl, timestamp: Date.now() }]);
      setConvs(prev => upsertConv(prev, selected, { ultimoMensaje: '🎤 Nota de voz', ultimoRol: 'vendedor', ts: Date.now(), agenteActivo: true }));
      scrollAbajo();
    } catch { toast.error('No se pudo enviar el audio'); }
  };

  const iniciarGrabacion = async () => {
    if (!selected || grabando) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast.error('Tu navegador no soporta grabar audio'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
        if (rec._cancelado) return;
        subirAudio(new Blob(chunksRef.current, { type: mime || 'audio/webm' }), mime);
      };
      recorderRef.current = rec;
      rec.start();
      setGrabando(true);
      setSegGrab(0);
      timerRef.current = setInterval(() => setSegGrab(s => s + 1), 1000);
    } catch { toast.error('No se pudo acceder al micrófono (revisa permisos)'); }
  };

  const detenerYEnviar = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    setGrabando(false);
  };

  const cancelarGrabacion = () => {
    const rec = recorderRef.current;
    if (rec) { rec._cancelado = true; if (rec.state !== 'inactive') rec.stop(); }
    setGrabando(false);
    clearInterval(timerRef.current);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Activar alertas (audio) + push ────────────────────────────────────────
  const activarAlertas = async () => {
    const ok = desbloquearAudio();
    setAlertasOn(ok || audioDesbloqueado());
    if (esIOS() && !esStandalone()) { setMostrarInstalar(true); toast('Agrega el CRM a la pantalla de inicio para recibir avisos con la app cerrada', { icon: '📲', duration: 6000 }); return; }
    if (!pushSoportado()) { toast('Este navegador no soporta notificaciones push'); return; }
    const r = await activarPush();
    if (r.ok) { setPushOn(true); toast.success('Notificaciones activadas'); }
    else if (r.motivo === 'ios-instalar') { setMostrarInstalar(true); }
    else if (r.motivo === 'permiso-denegado') { toast.error('Permiso de notificaciones denegado'); }
    else if (r.motivo === 'sin-vapid') { toast.error('Push no configurado en el servidor'); }
    else { toast.error('No se pudo activar el push'); }
  };

  const atenderAlerta = () => {
    detenerAlarma();
    if (alerta?.sessionId) abrirConv(alerta.sessionId);
    setAlerta(null);
  };

  const nombreConv = (c) => c.nombre || `Web ${String(c.sessionId).slice(-6)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: COLORS.bg, color: COLORS.text }}>
      {/* Barra superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}`, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Black Ops One', sans-serif", color: COLORS.yellow, letterSpacing: 1, fontSize: 16 }}>💬 CHAT WEB</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!alertasOn && (
            <button onClick={activarAlertas} style={btnPrimary}>🔔 Activar alertas</button>
          )}
          {alertasOn && (
            <span style={{ fontSize: 12, color: pushOn ? COLORS.green : COLORS.muted, fontWeight: 700 }}>
              {pushOn ? '🔔 Push activo' : '🔊 Sonido activo'}
            </span>
          )}
        </div>
      </div>

      {/* Aviso instalar PWA en iOS */}
      {mostrarInstalar && (
        <div style={{ background: 'rgba(245,196,0,.1)', borderBottom: `1px solid ${COLORS.border}`, padding: '8px 14px', fontSize: 12.5, color: COLORS.yellow, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>📲 Para recibir avisos con la app cerrada en iPhone: abre este sitio en <b>Safari</b> → botón <b>Compartir</b> → <b>“Agregar a inicio”</b>, y abre el CRM desde ese ícono.</span>
          <button onClick={() => setMostrarInstalar(false)} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 16 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Lista de conversaciones */}
        <div style={{
          width: selected ? 0 : '100%', maxWidth: 340, flexShrink: 0,
          borderRight: `1px solid ${COLORS.border}`, overflowY: 'auto',
          display: selected ? 'none' : 'block',
        }} className="conv-list">
          {convs.length === 0 && (
            <div style={{ padding: 24, color: COLORS.muted, fontSize: 13, textAlign: 'center' }}>Sin conversaciones web todavía.</div>
          )}
          {convs.map(c => (
            <button key={c.sessionId} onClick={() => abrirConv(c.sessionId)} style={{
              width: '100%', textAlign: 'left', padding: '11px 14px', background: selected === c.sessionId ? COLORS.panel2 : 'transparent',
              border: 'none', borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, cursor: 'pointer', display: 'block',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nombreConv(c)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {c.agenteActivo && <span title="Atendido por vendedor" style={{ fontSize: 10, color: COLORS.green }}>● tú</span>}
                  {unread.has(c.sessionId) && <span style={{ background: COLORS.red, color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 900, padding: '1px 6px' }}>NUEVO</span>}
                  <span style={{ fontSize: 10, color: COLORS.muted }}>{horaCorta(c.ts)}</span>
                </span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.ultimoRol === 'cliente' ? '🧑 ' : c.ultimoRol === 'vendedor' ? '🧑‍💼 ' : '🤖 '}{c.ultimoMensaje || '—'}
              </div>
            </button>
          ))}
        </div>

        {/* Hilo */}
        <div style={{ flex: 1, display: selected ? 'flex' : 'none', flexDirection: 'column', minWidth: 0 }}>
          {selected && (
            <>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => { setSelected(null); setParams({}, { replace: true }); }} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: '4px 10px', fontSize: 13 }}>←</button>
                <span style={{ fontWeight: 700 }}>{nombreConv(convs.find(c => c.sessionId === selected) || { sessionId: selected })}</span>
                <span style={{ fontSize: 11, color: COLORS.muted }}>({selected})</span>
              </div>

              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mensajes.map(m => {
                  const mine = m.rol === 'vendedor' || m.rol === 'bot';
                  return (
                    <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                      <div style={{
                        background: m.rol === 'cliente' ? COLORS.panel2 : m.rol === 'vendedor' ? COLORS.yellow : '#1f2937',
                        color: m.rol === 'vendedor' ? '#000' : COLORS.text,
                        padding: m.audioUrl ? '6px 8px' : '8px 11px', borderRadius: 12, fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {m.audioUrl
                          ? <audio controls preload="metadata" src={m.audioUrl} style={{ display: 'block', maxWidth: 230, height: 38 }} />
                          : m.mensaje}
                      </div>
                      <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                        {m.rol === 'cliente' ? 'Cliente' : m.rol === 'vendedor' ? 'Tú' : 'Bot'} · {horaCorta(m.timestamp)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${COLORS.border}`, alignItems: 'center' }}>
                {grabando ? (
                  <>
                    <button onClick={cancelarGrabacion} title="Cancelar" style={btnGhost}>✕</button>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, color: COLORS.red, fontWeight: 700 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS.red, animation: 'pulse 1s infinite' }} />
                      Grabando… {Math.floor(segGrab / 60)}:{String(segGrab % 60).padStart(2, '0')}
                    </div>
                    <button onClick={detenerYEnviar} style={btnPrimary}>Enviar 🎤</button>
                  </>
                ) : (
                  <>
                    <textarea
                      value={texto}
                      onChange={e => setTexto(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                      placeholder="Escribe un mensaje…"
                      rows={1}
                      style={{ flex: 1, resize: 'none', background: COLORS.panel2, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 10, padding: '10px 12px', fontSize: 16, maxHeight: 120 }}
                    />
                    <button onClick={iniciarGrabacion} title="Grabar nota de voz" style={btnMic}>🎤</button>
                    <button onClick={enviar} disabled={enviando || !texto.trim()} style={{ ...btnPrimary, opacity: enviando || !texto.trim() ? .5 : 1 }}>Enviar</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de sirena persistente */}
      {alerta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: COLORS.panel, border: `2px solid ${COLORS.yellow}`, borderRadius: 16, padding: 24, maxWidth: 380, width: '100%', textAlign: 'center', animation: 'pulse 1.2s infinite' }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ fontFamily: "'Black Ops One', sans-serif", color: COLORS.yellow, fontSize: 20, margin: '8px 0', letterSpacing: 1 }}>¡MENSAJE NUEVO!</div>
            <div style={{ color: COLORS.text, fontSize: 14, marginBottom: 6 }}>
              {nombreConv(convs.find(c => c.sessionId === alerta.sessionId) || { sessionId: alerta.sessionId })}
            </div>
            <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 18, maxHeight: 80, overflow: 'hidden' }}>“{alerta.texto}”</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={atenderAlerta} style={{ ...btnPrimary, flex: 1, padding: '12px' }}>Atender</button>
              <button onClick={() => { detenerAlarma(); setAlerta(null); }} style={{ flex: 1, padding: '12px', background: COLORS.panel2, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 10, fontWeight: 700 }}>Silenciar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnPrimary = {
  background: COLORS.yellow, color: '#000', border: 'none', borderRadius: 10,
  padding: '8px 16px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: .5,
};

const btnMic = {
  background: COLORS.panel2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 10,
  padding: '8px 12px', fontSize: 18, cursor: 'pointer', lineHeight: 1,
};

const btnGhost = {
  background: 'transparent', color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 10,
  padding: '8px 12px', fontSize: 16, cursor: 'pointer', lineHeight: 1,
};

// Inserta/actualiza una conversación en la lista y la sube al tope.
function upsertConv(prev, sessionId, patch) {
  const idx = prev.findIndex(c => c.sessionId === sessionId);
  if (idx === -1) {
    return [{ sessionId, nombre: null, pasoActual: null, agenteActivo: false, ultimoMensaje: '', ultimoRol: '', ts: Date.now(), ...patch }, ...prev];
  }
  const actualizado = { ...prev[idx], ...patch };
  const resto = prev.filter((_, i) => i !== idx);
  return [actualizado, ...resto];
}
