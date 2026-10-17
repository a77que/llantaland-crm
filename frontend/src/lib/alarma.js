// Sirena fuerte y persistente para avisar al vendedor de un mensaje nuevo
// mientras el CRM está abierto. Suena en bucle hasta que se detiene (al atender).
// En iOS/Safari el audio debe "desbloquearse" con un gesto del usuario primero
// (por eso el chat pide un toque de "Activar alertas" al entrar).
let ctx = null;
let intervalo = null;
let desbloqueado = false;

export function desbloquearAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    // Un "tic" mudo para confirmar el desbloqueo dentro del gesto del usuario.
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.02);
    desbloqueado = true;
  } catch { /* AudioContext no soportado */ }
  return desbloqueado;
}

export const audioDesbloqueado = () => desbloqueado;

function sirena() {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const now = ctx.currentTime;
  // Dos tonos tipo sirena, onda cuadrada, volumen alto.
  [{ f: 988, t: 0, d: 0.28 }, { f: 1319, t: 0.3, d: 0.34 }].forEach(({ f, t, d }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, now + t);
    g.gain.setValueAtTime(0, now + t);
    g.gain.linearRampToValueAtTime(0.9, now + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + t + d);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now + t);
    osc.stop(now + t + d + 0.05);
  });
}

export function iniciarAlarma() {
  if (!desbloqueado) desbloquearAudio();
  if (intervalo) return;                 // ya sonando
  sirena();
  intervalo = setInterval(sirena, 1600); // en bucle hasta detener
}

export function detenerAlarma() {
  if (intervalo) { clearInterval(intervalo); intervalo = null; }
}

export const alarmaActiva = () => intervalo !== null;
