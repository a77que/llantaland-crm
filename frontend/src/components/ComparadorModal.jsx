import React, { useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import { productosApi } from '../services/api';
import LoadingSpinner from './common/LoadingSpinner';

const LOAD_INDEX_KG = {
  60:250,61:257,62:265,63:272,64:280,65:290,66:300,67:307,68:315,69:325,
  70:335,71:345,72:355,73:365,74:375,75:387,76:400,77:412,78:425,79:437,
  80:450,81:462,82:475,83:487,84:500,85:515,86:530,87:545,88:560,89:580,
  90:600,91:615,92:630,93:650,94:670,95:690,96:710,97:730,98:750,99:775,
  100:800,101:825,102:850,103:875,104:900,105:925,106:950,107:975,108:1000,
};
const SPEED_INDEX_KMH = {
  J:100,K:110,L:120,M:130,N:140,P:150,Q:160,R:170,S:180,T:190,
  U:200,H:210,V:240,W:270,Y:300,Z:240,
};
const EU_GRADES = {
  A:{ bg:'#006d2c', text:'#fff' }, B:{ bg:'#31a354', text:'#fff' },
  C:{ bg:'#74c476', text:'#000' }, D:{ bg:'#f7dc6f', text:'#000' },
  E:{ bg:'#f0a500', text:'#000' }, F:{ bg:'#e34a33', text:'#fff' },
  G:{ bg:'#b30000', text:'#fff' },
};
const GRADE_ORDER = ['A','B','C','D','E','F','G'];
const TIPO_COLOR = { AUTO:'#3b82f6', CAMIONETA:'#8b5cf6', CAMION:'#f59e0b', MOTO:'#ec4899' };
const fmt = (v) => v ? `S/ ${parseFloat(v).toFixed(2)}` : '—';
const fmtNum = (v, unit='') => v != null ? `${Number(v).toLocaleString()}${unit}` : '—';
const sinDatos = <span style={{ fontSize:12, color:'var(--color-text-muted)' }}>Sin datos</span>;

function getKgCarga(prod) {
  if (prod.cargaMaxNeumatico) return prod.cargaMaxNeumatico;
  const n = parseInt(prod.indice_carga);
  return !isNaN(n) ? (LOAD_INDEX_KG[n] || null) : null;
}
function getKmh(prod) {
  if (prod.velocidadMaxKmh) return prod.velocidadMaxKmh;
  const letra = prod.velocidad_max ? String(prod.velocidad_max).toUpperCase() : null;
  return letra ? (SPEED_INDEX_KMH[letra] || null) : null;
}
function stockTotal(prod) { return prod.stocks?.reduce((a,s) => a + s.cantidad, 0) || 0; }

// Devuelve el Set de índices ganadores (mejor valor) para una métrica.
// Vacío si no hay comparación real (menos de 2 con datos) o si todos empatan.
function calcWinners(values, modo) {
  if (!modo) return new Set();
  if (modo === 'grade') {
    const idx = (g) => { const k = GRADE_ORDER.indexOf(String(g).toUpperCase()); return k < 0 ? 99 : k; };
    const present = values.map((v,i) => ({ k: (v==null||v==='') ? 99 : idx(v), i })).filter(o => o.k < 99);
    if (present.length < 2) return new Set();
    const best = Math.min(...present.map(o => o.k));
    const w = new Set(present.filter(o => o.k === best).map(o => o.i));
    return w.size === present.length ? new Set() : w;
  }
  const nums = values.map((v,i) => ({ n: Number(v), i })).filter(o => o.n != null && !isNaN(o.n) && (values[o.i] != null && values[o.i] !== ''));
  if (nums.length < 2) return new Set();
  const best = modo === 'lower' ? Math.min(...nums.map(o => o.n)) : Math.max(...nums.map(o => o.n));
  const w = new Set(nums.filter(o => o.n === best).map(o => o.i));
  return w.size === nums.length ? new Set() : w;
}

function GradeBadge({ grade, size = 28 }) {
  const g = grade ? String(grade).toUpperCase() : null;
  const c = (g && EU_GRADES[g]) ? EU_GRADES[g] : { bg:'#e2e8f0', text:'#94a3b8' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:size, height:size, borderRadius:6, background:c.bg, color:c.text, fontSize:size*0.46, fontWeight:900, flexShrink:0 }}>
      {g || '?'}
    </span>
  );
}

const gradeRender = (campo) => (p) => p?.[campo]
  ? <div style={{ display:'flex', alignItems:'center', gap:6 }}><GradeBadge grade={p[campo]} /><span style={{ fontSize:12 }}>Grado {p[campo]}</span></div>
  : sinDatos;

function Celda({ children, win, noData, minW }) {
  const bg = win === true ? '#f0fdf4' : win === 'tie' ? '#eff6ff' : 'transparent';
  return (
    <td style={{ padding:'9px 12px', borderLeft:'1px solid var(--color-border)', background:bg, minWidth:minW, verticalAlign:'middle' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, opacity: noData ? 0.4 : 1 }}>
        {win === true  && <span style={{ fontSize:13, flexShrink:0 }}>✅</span>}
        {win === 'tie' && <span style={{ fontSize:12, flexShrink:0 }}>🤝</span>}
        {children}
      </div>
    </td>
  );
}

export default function ComparadorModal({ ids = [], onClose }) {
  const results = useQueries({
    queries: ids.map(id => ({ queryKey:['producto', id], queryFn:() => productosApi.obtener(id), enabled:!!id })),
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const isLoading = results.some(r => r.isLoading);
  const productos = results.map(r => r.data).filter(Boolean);
  const N = productos.length;

  // ── Definición de métricas (en orden, con secciones) ──
  const metrics = [
    { sec:'💰 Precio' },
    { label:'Precio venta', modo:'lower',
      get:p => { const x = p.precioOferta || p.precioRegular; return x ? parseFloat(x) : null; },
      render:p => { const pr = p.precioOferta || p.precioRegular; return <div><div style={{ fontSize:14, fontWeight:900 }}>{fmt(pr)}</div>{p.precioOferta && <div style={{ fontSize:10, color:'#dc2626', textDecoration:'line-through' }}>{fmt(p.precioRegular)}</div>}</div>; } },

    { sec:'🏷️ Etiqueta EU — Rendimiento certificado' },
    { label:'Combustible',       modo:'grade', get:p => p.eficienciaCombustible || null, render:gradeRender('eficienciaCombustible') },
    { label:'Frenado en mojado', modo:'grade', get:p => p.eficienciaFrenado || null,     render:gradeRender('eficienciaFrenado') },
    { label:'Nivel de ruido',    modo:'lower', get:p => p.nivelRuido || null,
      render:p => p.nivelRuido ? <span style={{ fontSize:13, fontWeight:700 }}>🔊 {p.nivelRuido} dB</span> : sinDatos },

    { sec:'⚙️ Rendimiento Técnico' },
    { label:'Carga máx / neu.', modo:'higher', get:p => getKgCarga(p),
      render:p => { const k = getKgCarga(p); return <div><span style={{ fontSize:13, fontWeight:700 }}>{k ? fmtNum(k,' kg') : '—'}</span>{p.indice_carga && <span style={{ fontSize:10, color:'var(--color-text-muted)', marginLeft:4 }}>índice {p.indice_carga}</span>}</div>; } },
    { label:'Carga total (4 neu.)', modo:'higher', get:p => { const k = getKgCarga(p); return k ? k*4 : null; },
      render:p => { const k = getKgCarga(p); return <span style={{ fontSize:13, fontWeight:700 }}>{k ? fmtNum(k*4,' kg') : '—'}</span>; } },
    { label:'Velocidad máxima', modo:'higher', get:p => getKmh(p),
      render:p => { const k = getKmh(p); return <div><span style={{ fontSize:13, fontWeight:700 }}>{k ? `${k} km/h` : '—'}</span>{p.velocidad_max && <span style={{ fontSize:10, color:'var(--color-text-muted)', marginLeft:4 }}>índice {p.velocidad_max}</span>}</div>; } },

    { sec:'📍 Disponibilidad' },
    { label:'Stock total', modo:'higher', get:p => stockTotal(p),
      render:p => { const s = stockTotal(p); return <span style={{ fontSize:14, fontWeight:900, color: s>10?'#16a34a':s>0?'#f97316':'#dc2626' }}>{s} uds</span>; } },
  ];

  // Stock por sede (dinámico: unión de sedes de todos los productos)
  const sedeCods = [...new Set(productos.flatMap(p => (p.stocks||[]).map(s => s.sede?.codigoLocal)).filter(Boolean))].sort();
  sedeCods.forEach(cod => {
    const nombre = (productos.map(p => p.stocks?.find(s => s.sede?.codigoLocal === cod)?.sede?.nombre).find(Boolean) || cod);
    metrics.push({
      label: `${cod} ${String(nombre).split(' ').slice(0,2).join(' ')}`,
      modo:'higher',
      get: p => p.stocks?.find(s => s.sede?.codigoLocal === cod)?.cantidad ?? 0,
      render: p => { const n = p.stocks?.find(s => s.sede?.codigoLocal === cod)?.cantidad ?? 0; return <span style={{ fontSize:13, fontWeight:700, color: n>0?'#16a34a':'#dc2626' }}>{n} uds</span>; },
    });
  });

  metrics.push(
    { sec:'🌍 Garantía y Origen' },
    { label:'Garantía',         modo:null, get:p => p.garantia || null,        render:p => <span style={{ fontSize:13 }}>{p.garantia || '—'}</span> },
    { label:'País fabricación', modo:null, get:p => p.paisFabricacion || null, render:p => <span style={{ fontSize:13 }}>{p.paisFabricacion || '—'}</span> },
    { label:'Origen de marca',  modo:null, get:p => p.origenMarca || null,     render:p => <span style={{ fontSize:13 }}>{p.origenMarca || '—'}</span> },
  );

  // Calcular ganadores por métrica y ventajas por producto
  const winnersPerMetric = {};
  const wins = new Array(N).fill(0);
  let totalCats = 0;
  metrics.forEach((m, mi) => {
    if (!m.modo) return;
    const w = calcWinners(productos.map(m.get), m.modo);
    winnersPerMetric[mi] = w;
    if (w.size > 0) { totalCats++; w.forEach(i => { wins[i] += 1; }); }
  });
  const maxWins = wins.length ? Math.max(...wins) : 0;
  const bestIdxs = wins.map((w,i) => (w === maxWins && maxWins > 0) ? i : -1).filter(i => i >= 0);
  const uniqueBest = bestIdxs.length === 1 ? bestIdxs[0] : -1;

  const minW = 150;
  const anchoModal = Math.min(typeof window !== 'undefined' ? window.innerWidth * 0.96 : 1100, 220 + N * (minW + 30));

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:12, backdropFilter:'blur(3px)' }} onClick={onClose}>
      <div style={{ background:'var(--color-surface)', borderRadius:16, width:'100%', maxWidth:anchoModal, maxHeight:'93dvh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>

        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--color-border)', background:'var(--color-bg)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ fontSize:20 }}>⚖️</span>
          <span style={{ fontSize:15, fontWeight:800, flex:1 }}>Comparar Neumáticos {N > 0 && `(${N})`}</span>
          <button onClick={onClose} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-surface)', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>

        {isLoading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}><LoadingSpinner /></div>
        ) : (
          <div style={{ overflow:'auto', flex:1 }}>
            <table style={{ borderCollapse:'collapse', minWidth:'100%' }}>
              <thead>
                <tr style={{ background:'var(--color-bg)' }}>
                  <th style={{ minWidth:150, padding:'12px', borderBottom:'2px solid var(--color-border)', borderRight:'1px solid var(--color-border)', position:'sticky', left:0, background:'var(--color-bg)', zIndex:1 }} />
                  {productos.map((p, i) => {
                    const tc = TIPO_COLOR[p.tipo] || '#64748b';
                    const esMejor = i === uniqueBest;
                    const esEmpate = bestIdxs.length > 1 && bestIdxs.includes(i);
                    return (
                      <th key={i} style={{ minWidth:minW, padding:'14px 14px', borderBottom:'2px solid var(--color-border)', borderLeft:'1px solid var(--color-border)', textAlign:'left', verticalAlign:'top' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:tc+'20', color:tc, fontWeight:700 }}>{p.tipo}</span>
                          {esMejor && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'#f0fdf4', color:'#16a34a', fontWeight:700, border:'1px solid #bbf7d0' }}>🏆 MEJOR</span>}
                          {esEmpate && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'#eff6ff', color:'#1d4ed8', fontWeight:700, border:'1px solid #bfdbfe' }}>🤝 EMPATE</span>}
                        </div>
                        <div style={{ fontSize:14, fontWeight:900, lineHeight:1.2 }}>{p.marca}</div>
                        <div style={{ fontSize:12, color:'var(--color-text-muted)', marginTop:2 }}>{p.nombreComercial}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--color-primary)', marginTop:4 }}>{p.medida}</div>
                        <div style={{ fontSize:12, color:'var(--color-text-muted)', marginTop:4 }}>{wins[i]} ventaja{wins[i] !== 1 ? 's' : ''}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, mi) => {
                  if (m.sec) {
                    return (
                      <tr key={mi}>
                        <td colSpan={N + 1} style={{ padding:'10px 12px 6px', fontSize:11, fontWeight:800, color:'var(--color-primary)', textTransform:'uppercase', letterSpacing:1, background:'var(--color-bg)', borderBottom:'2px solid #f5c400' }}>
                          {m.sec}
                        </td>
                      </tr>
                    );
                  }
                  const w = winnersPerMetric[mi] || new Set();
                  const empate = w.size > 1;
                  return (
                    <tr key={mi} style={{ borderBottom:'1px solid var(--color-border)' }}>
                      <td style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:.5, background:'var(--color-bg)', whiteSpace:'nowrap', borderRight:'1px solid var(--color-border)', position:'sticky', left:0, zIndex:1 }}>
                        {m.label}
                      </td>
                      {productos.map((p, i) => {
                        const val = m.get(p);
                        const noData = val == null || val === '';
                        const win = w.has(i) ? (empate ? 'tie' : true) : false;
                        return <Celda key={i} win={win} noData={noData} minW={minW}>{m.render(p)}</Celda>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {N >= 2 && (
              <div style={{ padding:'16px 18px', borderTop:'2px solid #f5c400', background:'#fffbeb' }}>
                <div style={{ fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'#92400e', marginBottom:6 }}>💬 Argumento para el cliente</div>
                <div style={{ fontSize:13, color:'#78350f', lineHeight:1.6 }}>
                  {uniqueBest >= 0 ? (
                    <>La <strong>{productos[uniqueBest].marca} {productos[uniqueBest].medida}</strong> es la mejor opción: gana en <strong>{wins[uniqueBest]} de {totalCats}</strong> categorías comparadas.
                    {productos[uniqueBest].eficienciaFrenado === 'A' && ' Su frenado en mojado grado A puede marcar la diferencia en una emergencia.'}</>
                  ) : (
                    <>Las llantas están muy parejas; la decisión depende del presupuesto del cliente y su prioridad de uso.</>
                  )}
                  {' '}Recuerda validar que la medida sea compatible con el vehículo del cliente.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
