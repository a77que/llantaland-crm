import React, { useState, useMemo } from 'react';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const ATENDIDA = new Set(['ATENDIDO', 'ENTREGADO']);
const esAtendida = (c) => ATENDIDA.has(c.estadoCitaCalc);

// Clave local YYYY-MM-DD a partir de la fecha de instalación (evita corrimientos de zona).
function dateKey(d) {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function CalendarioCitas({ citas = [], onAbrir, isMobile }) {
  const hoy = new Date();
  const [cursor, setCursor] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  // Agrupar por día + lista de "sin agendar"
  const { porDia, sinAgendar } = useMemo(() => {
    const porDia = {};
    const sinAgendar = [];
    for (const c of citas) {
      const k = dateKey(c.fechaInstalacion);
      if (!k) { sinAgendar.push(c); continue; }
      (porDia[k] = porDia[k] || []).push(c);
    }
    return { porDia, sinAgendar };
  }, [citas]);

  // Construir matriz de semanas (lunes primero)
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const primero = new Date(year, month, 1);
  const offset = (primero.getDay() + 6) % 7; // 0 = lunes
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(new Date(year, month, d));
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));

  const hoyKey = dateKey(hoy);
  const mesCitas = citas.filter(c => { const k = dateKey(c.fechaInstalacion); return k && k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`); });
  const nAtendidas = mesCitas.filter(esAtendida).length;
  const nPend = mesCitas.length - nAtendidas;

  const navBtn = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--color-text)', fontSize: 14, fontWeight: 700 };

  const Chip = ({ c }) => {
    const at = esAtendida(c);
    const bg = at ? '#dcfce7' : '#dbeafe';
    const fg = at ? '#15803d' : '#1d4ed8';
    const bd = at ? '#86efac' : '#93c5fd';
    return (
      <button onClick={() => onAbrir && onAbrir(c)} title={`${c.nombreCliente || c.telefono || ''} — ${at ? 'Atendida' : 'Pendiente'}`}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: bg, color: fg, border: `1px solid ${bd}`, borderRadius: 6, padding: '2px 6px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {c.horaInstalacion ? `${c.horaInstalacion} · ` : ''}{c.nombreCliente || c.telefono || 'Cita'}
      </button>
    );
  };

  return (
    <div>
      {/* Cabecera mes + navegación + leyenda */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={navBtn} onClick={() => setCursor(new Date(year, month - 1, 1))}>←</button>
          <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, minWidth: 150, textAlign: 'center' }}>{MESES[month]} {year}</div>
          <button style={navBtn} onClick={() => setCursor(new Date(year, month + 1, 1))}>→</button>
          <button style={{ ...navBtn, fontSize: 12 }} onClick={() => setCursor(new Date(hoy.getFullYear(), hoy.getMonth(), 1))}>Hoy</button>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
          <span style={{ color: '#1d4ed8' }}>● Pendientes: {nPend}</span>
          <span style={{ color: '#15803d' }}>● Atendidas: {nAtendidas}</span>
        </div>
      </div>

      {/* Cabecera de días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DIAS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{isMobile ? d[0] : d}</div>)}
      </div>

      {/* Semanas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {semanas.map((sem, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {sem.map((dia, di) => {
              if (!dia) return <div key={di} style={{ minHeight: isMobile ? 56 : 92, background: 'transparent' }} />;
              const k = dateKey(dia);
              const lista = porDia[k] || [];
              const esHoy = k === hoyKey;
              const max = isMobile ? 2 : 3;
              return (
                <div key={di} style={{ minHeight: isMobile ? 56 : 92, background: 'var(--color-surface)', border: `1px solid ${esHoy ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, padding: 4, overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: esHoy ? 'var(--color-primary)' : 'var(--color-text-muted)', marginBottom: 2 }}>{dia.getDate()}</div>
                  {lista.slice(0, max).map(c => <Chip key={c.id} c={c} />)}
                  {lista.length > max && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700 }}>+{lista.length - max} más</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sin agendar */}
      {sinAgendar.length > 0 && (
        <div style={{ marginTop: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, color: '#b45309' }}>⏳ Sin fecha de instalación ({sinAgendar.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sinAgendar.map(c => (
              <button key={c.id} onClick={() => onAbrir && onAbrir(c)} style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {c.nombreCliente || c.telefono || 'Cita'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
