import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
const TIPO_COLOR = { AUTO:'#3b82f6', CAMIONETA:'#8b5cf6', CAMION:'#f59e0b', MOTO:'#ec4899' };
const fmt = (v) => v ? `S/ ${parseFloat(v).toFixed(2)}` : '—';
const fmtNum = (v, unit='') => v != null ? `${Number(v).toLocaleString()}${unit}` : '—';

// Determina qué columna gana: 1, 2, 'tie', o null (no comparable)
function ganador(v1, v2, modo) {
  if (v1 == null && v2 == null) return null;
  if (v1 == null) return 2;
  if (v2 == null) return 1;
  if (modo === 'lower')  return v1 < v2 ? 1 : v1 > v2 ? 2 : 'tie';
  if (modo === 'higher') return v1 > v2 ? 1 : v1 < v2 ? 2 : 'tie';
  if (modo === 'grade') {
    const order = ['A','B','C','D','E','F','G'];
    const i1 = order.indexOf(String(v1).toUpperCase());
    const i2 = order.indexOf(String(v2).toUpperCase());
    if (i1 < 0 && i2 < 0) return null;
    if (i1 < 0) return 2;
    if (i2 < 0) return 1;
    return i1 < i2 ? 1 : i1 > i2 ? 2 : 'tie';
  }
  return null;
}

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

function GradeBadge({ grade, size = 30 }) {
  const g = grade ? String(grade).toUpperCase() : null;
  const c = (g && EU_GRADES[g]) ? EU_GRADES[g] : { bg:'#e2e8f0', text:'#94a3b8' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:size, height:size, borderRadius:6, background:c.bg, color:c.text, fontSize:size*0.46, fontWeight:900, flexShrink:0 }}>
      {g || '?'}
    </span>
  );
}

// ── Celda de comparación ──────────────────────────────────────────────────────
function CeldaComp({ children, win, noData }) {
  const bg = win === true ? '#f0fdf4' : win === 'tie' ? '#eff6ff' : 'transparent';
  const border = win === true ? '2px solid #16a34a' : win === 'tie' ? '2px solid #3b82f6' : '1px solid var(--color-border)';
  return (
    <td style={{ padding:'10px 14px', borderLeft:'1px solid var(--color-border)', background:bg, border, borderRadius:0, position:'relative', verticalAlign:'middle' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, opacity: noData ? 0.35 : 1 }}>
        {win === true  && <span style={{ fontSize:14, flexShrink:0 }}>✅</span>}
        {win === 'tie' && <span style={{ fontSize:12, flexShrink:0 }}>🤝</span>}
        {children}
      </div>
    </td>
  );
}

// ── Sección de filas ──────────────────────────────────────────────────────────
function FilaComp({ label, v1, v2, modo, render1, render2 }) {
  const g = ganador(v1, v2, modo);
  const noData1 = v1 == null;
  const noData2 = v2 == null;
  return (
    <tr style={{ borderBottom:'1px solid var(--color-border)' }}>
      <td style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:.5, background:'var(--color-bg)', whiteSpace:'nowrap', borderRight:'1px solid var(--color-border)' }}>
        {label}
      </td>
      <CeldaComp win={g === 1 ? true : g === 'tie' ? 'tie' : false} noData={noData1}>
        {render1 ? render1 : <span style={{ fontSize:13, fontWeight:600 }}>{noData1 ? '—' : String(v1)}</span>}
      </CeldaComp>
      <CeldaComp win={g === 2 ? true : g === 'tie' ? 'tie' : false} noData={noData2}>
        {render2 ? render2 : <span style={{ fontSize:13, fontWeight:600 }}>{noData2 ? '—' : String(v2)}</span>}
      </CeldaComp>
    </tr>
  );
}

function SeccionHeader({ titulo }) {
  return (
    <tr>
      <td colSpan={3} style={{ padding:'10px 12px 6px', fontSize:11, fontWeight:800, color:'var(--color-primary)', textTransform:'uppercase', letterSpacing:1, background:'var(--color-bg)', borderBottom:'2px solid #f5c400' }}>
        {titulo}
      </td>
    </tr>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function ComparadorModal({ ids, onClose }) {
  const [id1, id2] = ids;

  const { data: p1, isLoading: l1 } = useQuery({ queryKey:['producto', id1], queryFn:() => productosApi.obtener(id1), enabled:!!id1 });
  const { data: p2, isLoading: l2 } = useQuery({ queryKey:['producto', id2], queryFn:() => productosApi.obtener(id2), enabled:!!id2 });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const isLoading = l1 || l2;

  const kg1 = p1 ? getKgCarga(p1) : null;
  const kg2 = p2 ? getKgCarga(p2) : null;
  const kmh1 = p1 ? getKmh(p1) : null;
  const kmh2 = p2 ? getKmh(p2) : null;
  const st1 = p1 ? stockTotal(p1) : null;
  const st2 = p2 ? stockTotal(p2) : null;

  const precio1 = p1?.precioOferta || p1?.precioRegular;
  const precio2 = p2?.precioOferta || p2?.precioRegular;

  // Resumen de cuántas gana cada uno
  const checks = [
    ganador(precio1 ? parseFloat(precio1) : null, precio2 ? parseFloat(precio2) : null, 'lower'),
    ganador(p1?.eficienciaCombustible, p2?.eficienciaCombustible, 'grade'),
    ganador(p1?.eficienciaFrenado, p2?.eficienciaFrenado, 'grade'),
    ganador(p1?.nivelRuido, p2?.nivelRuido, 'lower'),
    ganador(kg1, kg2, 'higher'),
    ganador(kmh1, kmh2, 'higher'),
    ganador(st1, st2, 'higher'),
  ];
  const wins1 = checks.filter(g => g === 1).length;
  const wins2 = checks.filter(g => g === 2).length;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center', padding:12, backdropFilter:'blur(3px)' }} onClick={onClose}>
      <div style={{ background:'var(--color-surface)', borderRadius:16, width:'100%', maxWidth:780, maxHeight:'93dvh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--color-border)', background:'var(--color-bg)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ fontSize:20 }}>⚖️</span>
          <span style={{ fontSize:15, fontWeight:800, flex:1 }}>Comparar Neumáticos</span>
          <button onClick={onClose} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-surface)', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>

        {isLoading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}><LoadingSpinner /></div>
        ) : (
          <div style={{ overflowY:'auto', flex:1 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              {/* Cabecera de cada llanta */}
              <thead>
                <tr style={{ background:'var(--color-bg)' }}>
                  <th style={{ width:'22%', padding:'12px', borderBottom:'2px solid var(--color-border)', borderRight:'1px solid var(--color-border)' }} />
                  {[p1, p2].map((p, i) => {
                    const tc = p ? (TIPO_COLOR[p.tipo] || '#64748b') : '#64748b';
                    const ganaPuntaje = i === 0 ? wins1 : wins2;
                    const pierdeEl = i === 0 ? wins2 : wins1;
                    return (
                      <th key={i} style={{ padding:'14px 16px', borderBottom:'2px solid var(--color-border)', borderLeft:'1px solid var(--color-border)', textAlign:'left', verticalAlign:'top' }}>
                        {p ? (
                          <>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:tc+'20', color:tc, fontWeight:700 }}>{p.tipo}</span>
                              {ganaPuntaje > pierdeEl && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'#f0fdf4', color:'#16a34a', fontWeight:700, border:'1px solid #bbf7d0' }}>🏆 MEJOR OPCIÓN</span>}
                              {ganaPuntaje === pierdeEl && ganaPuntaje > 0 && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'#eff6ff', color:'#1d4ed8', fontWeight:700, border:'1px solid #bfdbfe' }}>🤝 EMPATE</span>}
                            </div>
                            <div style={{ fontSize:14, fontWeight:900, lineHeight:1.2 }}>{p.marca}</div>
                            <div style={{ fontSize:12, color:'var(--color-text-muted)', marginTop:2 }}>{p.nombreComercial}</div>
                            <div style={{ fontSize:13, fontWeight:700, color:'var(--color-primary)', marginTop:4 }}>{p.medida}</div>
                            <div style={{ fontSize:12, color:'var(--color-text-muted)', marginTop:4 }}>
                              {ganaPuntaje} ventaja{ganaPuntaje !== 1 ? 's' : ''} · {pierdeEl} en contra
                            </div>
                          </>
                        ) : <span style={{ color:'var(--color-text-muted)' }}>—</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {/* PRECIOS */}
                <SeccionHeader titulo="💰 Precio" />
                <FilaComp
                  label="Precio venta"
                  v1={precio1 ? parseFloat(precio1) : null}
                  v2={precio2 ? parseFloat(precio2) : null}
                  modo="lower"
                  render1={<div><div style={{ fontSize:14, fontWeight:900 }}>{fmt(precio1)}</div>{p1?.precioOferta && <div style={{ fontSize:10, color:'#dc2626', textDecoration:'line-through' }}>{fmt(p1?.precioRegular)}</div>}</div>}
                  render2={<div><div style={{ fontSize:14, fontWeight:900 }}>{fmt(precio2)}</div>{p2?.precioOferta && <div style={{ fontSize:10, color:'#dc2626', textDecoration:'line-through' }}>{fmt(p2?.precioRegular)}</div>}</div>}
                />

                {/* ETIQUETA EU */}
                <SeccionHeader titulo="🏷️ Etiqueta EU — Rendimiento certificado" />
                <FilaComp
                  label="Combustible"
                  v1={p1?.eficienciaCombustible} v2={p2?.eficienciaCombustible} modo="grade"
                  render1={p1?.eficienciaCombustible ? <div style={{ display:'flex', alignItems:'center', gap:6 }}><GradeBadge grade={p1.eficienciaCombustible} /><span style={{ fontSize:12 }}>Grado {p1.eficienciaCombustible}</span></div> : <span style={{ fontSize:12, color:'var(--color-text-muted)' }}>Sin datos</span>}
                  render2={p2?.eficienciaCombustible ? <div style={{ display:'flex', alignItems:'center', gap:6 }}><GradeBadge grade={p2.eficienciaCombustible} /><span style={{ fontSize:12 }}>Grado {p2.eficienciaCombustible}</span></div> : <span style={{ fontSize:12, color:'var(--color-text-muted)' }}>Sin datos</span>}
                />
                <FilaComp
                  label="Frenado en mojado"
                  v1={p1?.eficienciaFrenado} v2={p2?.eficienciaFrenado} modo="grade"
                  render1={p1?.eficienciaFrenado ? <div style={{ display:'flex', alignItems:'center', gap:6 }}><GradeBadge grade={p1.eficienciaFrenado} /><span style={{ fontSize:12 }}>Grado {p1.eficienciaFrenado}</span></div> : <span style={{ fontSize:12, color:'var(--color-text-muted)' }}>Sin datos</span>}
                  render2={p2?.eficienciaFrenado ? <div style={{ display:'flex', alignItems:'center', gap:6 }}><GradeBadge grade={p2.eficienciaFrenado} /><span style={{ fontSize:12 }}>Grado {p2.eficienciaFrenado}</span></div> : <span style={{ fontSize:12, color:'var(--color-text-muted)' }}>Sin datos</span>}
                />
                <FilaComp
                  label="Nivel de ruido"
                  v1={p1?.nivelRuido} v2={p2?.nivelRuido} modo="lower"
                  render1={p1?.nivelRuido ? <span style={{ fontSize:13, fontWeight:700 }}>🔊 {p1.nivelRuido} dB</span> : <span style={{ fontSize:12, color:'var(--color-text-muted)' }}>Sin datos</span>}
                  render2={p2?.nivelRuido ? <span style={{ fontSize:13, fontWeight:700 }}>🔊 {p2.nivelRuido} dB</span> : <span style={{ fontSize:12, color:'var(--color-text-muted)' }}>Sin datos</span>}
                />

                {/* RENDIMIENTO */}
                <SeccionHeader titulo="⚙️ Rendimiento Técnico" />
                <FilaComp
                  label="Carga máx / neu."
                  v1={kg1} v2={kg2} modo="higher"
                  render1={<div><span style={{ fontSize:13, fontWeight:700 }}>{kg1 ? fmtNum(kg1,' kg') : '—'}</span>{p1?.indice_carga && <span style={{ fontSize:10, color:'var(--color-text-muted)', marginLeft:4 }}>índice {p1.indice_carga}</span>}</div>}
                  render2={<div><span style={{ fontSize:13, fontWeight:700 }}>{kg2 ? fmtNum(kg2,' kg') : '—'}</span>{p2?.indice_carga && <span style={{ fontSize:10, color:'var(--color-text-muted)', marginLeft:4 }}>índice {p2.indice_carga}</span>}</div>}
                />
                <FilaComp
                  label="Carga total (4 neu.)"
                  v1={kg1 ? kg1*4 : null} v2={kg2 ? kg2*4 : null} modo="higher"
                  render1={<span style={{ fontSize:13, fontWeight:700 }}>{kg1 ? fmtNum(kg1*4,' kg') : '—'}</span>}
                  render2={<span style={{ fontSize:13, fontWeight:700 }}>{kg2 ? fmtNum(kg2*4,' kg') : '—'}</span>}
                />
                <FilaComp
                  label="Velocidad máxima"
                  v1={kmh1} v2={kmh2} modo="higher"
                  render1={<div><span style={{ fontSize:13, fontWeight:700 }}>{kmh1 ? `${kmh1} km/h` : '—'}</span>{p1?.velocidad_max && <span style={{ fontSize:10, color:'var(--color-text-muted)', marginLeft:4 }}>índice {p1.velocidad_max}</span>}</div>}
                  render2={<div><span style={{ fontSize:13, fontWeight:700 }}>{kmh2 ? `${kmh2} km/h` : '—'}</span>{p2?.velocidad_max && <span style={{ fontSize:10, color:'var(--color-text-muted)', marginLeft:4 }}>índice {p2.velocidad_max}</span>}</div>}
                />

                {/* DISPONIBILIDAD */}
                <SeccionHeader titulo="📍 Disponibilidad" />
                <FilaComp
                  label="Stock total"
                  v1={st1} v2={st2} modo="higher"
                  render1={<span style={{ fontSize:14, fontWeight:900, color: st1 > 10 ? '#16a34a' : st1 > 0 ? '#f97316' : '#dc2626' }}>{st1} uds</span>}
                  render2={<span style={{ fontSize:14, fontWeight:900, color: st2 > 10 ? '#16a34a' : st2 > 0 ? '#f97316' : '#dc2626' }}>{st2} uds</span>}
                />
                {/* Stock por sede */}
                {(p1?.stocks?.length > 0 || p2?.stocks?.length > 0) && (() => {
                  const allSedes = [...new Set([...(p1?.stocks||[]), ...(p2?.stocks||[])].map(s => s.sede?.codigoLocal))].sort();
                  return allSedes.map(cod => {
                    const s1 = p1?.stocks?.find(s => s.sede?.codigoLocal === cod);
                    const s2 = p2?.stocks?.find(s => s.sede?.codigoLocal === cod);
                    const n1 = s1?.cantidad ?? 0;
                    const n2 = s2?.cantidad ?? 0;
                    const nombre = s1?.sede?.nombre || s2?.sede?.nombre || cod;
                    return (
                      <FilaComp key={cod}
                        label={`${cod} ${nombre?.split(' ').slice(0,2).join(' ')}`}
                        v1={n1} v2={n2} modo="higher"
                        render1={<span style={{ fontSize:13, fontWeight:700, color: n1>0?'#16a34a':'#dc2626' }}>{n1} uds</span>}
                        render2={<span style={{ fontSize:13, fontWeight:700, color: n2>0?'#16a34a':'#dc2626' }}>{n2} uds</span>}
                      />
                    );
                  });
                })()}

                {/* GARANTÍA Y ORIGEN */}
                <SeccionHeader titulo="🌍 Garantía y Origen" />
                <FilaComp label="Garantía" v1={p1?.garantia} v2={p2?.garantia} modo={null}
                  render1={<span style={{ fontSize:13 }}>{p1?.garantia || '—'}</span>}
                  render2={<span style={{ fontSize:13 }}>{p2?.garantia || '—'}</span>}
                />
                <FilaComp label="País fabricación" v1={p1?.paisFabricacion} v2={p2?.paisFabricacion} modo={null}
                  render1={<span style={{ fontSize:13 }}>{p1?.paisFabricacion || '—'}</span>}
                  render2={<span style={{ fontSize:13 }}>{p2?.paisFabricacion || '—'}</span>}
                />
                <FilaComp label="Origen de marca" v1={p1?.origenMarca} v2={p2?.origenMarca} modo={null}
                  render1={<span style={{ fontSize:13 }}>{p1?.origenMarca || '—'}</span>}
                  render2={<span style={{ fontSize:13 }}>{p2?.origenMarca || '—'}</span>}
                />
              </tbody>
            </table>

            {/* Recomendación final */}
            {p1 && p2 && (
              <div style={{ padding:'16px 18px', borderTop:'2px solid #f5c400', background:'#fffbeb' }}>
                <div style={{ fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'#92400e', marginBottom:6 }}>💬 Argumento para el cliente</div>
                <div style={{ fontSize:13, color:'#78350f', lineHeight:1.6 }}>
                  {wins1 > wins2 && <>La <strong>{p1.marca} {p1.medida}</strong> gana en {wins1} de {wins1+wins2} categorías comparadas. {p1.eficienciaFrenado === 'A' && 'El frenado en mojado grado A puede marcar la diferencia en caso de emergencia. '}{p1.nivelRuido && p1.nivelRuido < (p2.nivelRuido || 99) && 'Es más silenciosa para mayor confort en carretera. '}</>}
                  {wins2 > wins1 && <>La <strong>{p2.marca} {p2.medida}</strong> gana en {wins2} de {wins1+wins2} categorías comparadas. {p2.eficienciaFrenado === 'A' && 'El frenado en mojado grado A puede marcar la diferencia en caso de emergencia. '}{p2.nivelRuido && p2.nivelRuido < (p1.nivelRuido || 99) && 'Es más silenciosa para mayor confort en carretera. '}</>}
                  {wins1 === wins2 && <>Ambas llantas están empatadas en rendimiento. La decisión depende del presupuesto del cliente y prioridades de uso.</>}
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
