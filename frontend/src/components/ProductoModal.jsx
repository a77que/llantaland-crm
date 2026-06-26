import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productosApi } from '../services/api';
import { dimensionesMedida } from '../utils/medida';
import LoadingSpinner from './common/LoadingSpinner';

// ── Tablas de referencia ──────────────────────────────────────────────────────
const LOAD_INDEX_KG = {
  60:250,61:257,62:265,63:272,64:280,65:290,66:300,67:307,68:315,69:325,
  70:335,71:345,72:355,73:365,74:375,75:387,76:400,77:412,78:425,79:437,
  80:450,81:462,82:475,83:487,84:500,85:515,86:530,87:545,88:560,89:580,
  90:600,91:615,92:630,93:650,94:670,95:690,96:710,97:730,98:750,99:775,
  100:800,101:825,102:850,103:875,104:900,105:925,106:950,107:975,108:1000,
  109:1030,110:1060,111:1090,112:1120,113:1150,114:1180,115:1215,116:1250,
  117:1285,118:1320,119:1360,120:1400,
};

const SPEED_INDEX_KMH = {
  J:100,K:110,L:120,M:130,N:140,P:150,Q:160,R:170,S:180,T:190,
  U:200,H:210,V:240,W:270,Y:300,Z:240,ZR:240,
};

const SPEED_SCALE = [
  { key:'Q', kmh:160, label:'Q' },
  { key:'R', kmh:170, label:'R' },
  { key:'S', kmh:180, label:'S' },
  { key:'T', kmh:190, label:'T' },
  { key:'H', kmh:210, label:'H' },
  { key:'V', kmh:240, label:'V' },
  { key:'W', kmh:270, label:'W' },
  { key:'Y', kmh:300, label:'Y' },
];

const SPEED_CATEGORY = (kmh) => {
  if (!kmh) return null;
  if (kmh <= 160) return { label:'Baja velocidad', tip:'Uso urbano o camiones ligeros.', color:'#94a3b8' };
  if (kmh <= 180) return { label:'Estándar', tip:'Apto para uso ciudad y carretera nacional.', color:'#3b82f6' };
  if (kmh <= 210) return { label:'Alto rendimiento', tip:'Apto para autopista y manejo sport. El más vendido.', color:'#8b5cf6' };
  if (kmh <= 240) return { label:'Sport', tip:'Para vehículos de alto rendimiento.', color:'#f59e0b' };
  return { label:'Superdeportivo', tip:'Velocidades extremas. Para autos de competición.', color:'#dc2626' };
};

const LOAD_CATEGORY = (kg) => {
  if (!kg) return null;
  if (kg < 400) return { label:'Liviano', tip:'Para autos pequeños y utilitarios.' };
  if (kg < 600) return { label:'Estándar', tip:'Para sedanes, hatchbacks y SUV compactos.' };
  if (kg < 800) return { label:'Reforzado', tip:'Para SUV, pickup y vehículos pesados.' };
  return { label:'Heavy Duty', tip:'Para camiones, vans y vehículos de carga.' };
};

const TIPO_COLOR = { AUTO:'#3b82f6', CAMIONETA:'#8b5cf6', CAMION:'#f59e0b', MOTO:'#ec4899' };
const fmt = (v) => v ? `S/ ${parseFloat(v).toFixed(2)}` : null;

const EU_GRADES = {
  A:{ bg:'#006d2c', text:'#fff', label:'Excelente' },
  B:{ bg:'#31a354', text:'#fff', label:'Muy buena' },
  C:{ bg:'#74c476', text:'#000', label:'Buena' },
  D:{ bg:'#f7dc6f', text:'#000', label:'Aceptable' },
  E:{ bg:'#f0a500', text:'#000', label:'Regular' },
  F:{ bg:'#e34a33', text:'#fff', label:'Baja' },
  G:{ bg:'#b30000', text:'#fff', label:'Deficiente' },
};

const EU_FUEL_TIPS = {
  A:'Hasta 7.5% menos combustible que grado G. Ideal para clientes que manejan mucho.',
  B:'Muy eficiente. Casi igual que A a menor precio.',
  C:'Eficiencia media-alta. Buen balance para uso diario.',
  D:'Consumo por encima del promedio. Aceptable para recorridos cortos.',
  E:'Consume notoriamente más. Comparar con opciones A-C disponibles.',
  F:'Alto consumo. Solo si el precio es muy conveniente.',
  G:'Mayor consumo del mercado. No recomendado si hay alternativas.',
};

const EU_BRAKE_TIPS = {
  A:'Frena hasta 18 m antes que grado E en lluvia. El argumento más poderoso de seguridad.',
  B:'Excelente frenada en mojado. Diferencia mínima con A.',
  C:'Buena respuesta en lluvia. Seguro para uso normal.',
  D:'Distancia de frenada 6-10 m mayor que A. Adecuado en condiciones secas.',
  E:'Hasta 18 m más para detenerse en lluvia vs A. Importante informar al cliente.',
  F:'Frenada deficiente en mojado. Riesgo alto.',
  G:'No recomendado para zonas con lluvia frecuente.',
};

function noiseColor(db) {
  if (!db) return '#94a3b8';
  if (db <= 67) return '#16a34a';
  if (db <= 71) return '#84cc16';
  if (db <= 74) return '#eab308';
  return '#dc2626';
}

function noiseLabel(db) {
  if (!db) return null;
  if (db <= 67) return { label:'Silencioso', tip:'Como una conversación normal. Ideal para viajes largos y clientes sensibles al ruido.', waves:1 };
  if (db <= 71) return { label:'Moderado', tip:'Perceptible a velocidad constante. Promedio del mercado.', waves:2 };
  if (db <= 74) return { label:'Perceptible', tip:'Algo ruidoso en autopista. Informar al cliente si compra para uso frecuente en carretera.', waves:3 };
  return { label:'Ruidoso', tip:'Puede resultar cansador en viajes largos. Considerar alternativas más silenciosas.', waves:3 };
}

const TECH_FIELDS = [
  'indice_carga','velocidad_max','garantia','cargaMaxNeumatico','velocidadMaxKmh',
  'eficienciaCombustible','eficienciaFrenado','nivelRuido','paisFabricacion','origenMarca',
  'fichaTecnica',
];

const FIELD_LABELS = {
  indice_carga:'Índice de carga', velocidad_max:'Índice de velocidad', garantia:'Garantía',
  cargaMaxNeumatico:'Carga máx. (kg)', velocidadMaxKmh:'Velocidad máx. (km/h)',
  eficienciaCombustible:'Eficiencia combustible', eficienciaFrenado:'Frenado en mojado',
  nivelRuido:'Nivel de ruido', paisFabricacion:'País de fabricación', origenMarca:'Origen de marca',
  fichaTecnica:'Ficha técnica',
};

const parseMedida = (medida) => dimensionesMedida(medida);

// ── Sub-componentes ───────────────────────────────────────────────────────────

function EUGradeCard({ grade, label, tips, icon }) {
  const g = grade ? String(grade).toUpperCase() : null;
  const colors = (g && EU_GRADES[g]) ? EU_GRADES[g] : null;
  const tip = g ? tips[g] : null;
  const allGrades = ['A','B','C','D','E','F','G'];

  return (
    <div style={{ flex:1, minWidth:180 }}>
      {/* Label */}
      <div style={{ fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:6 }}>{icon} {label}</div>

      {/* Badge + escala */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        {/* Badge grande */}
        <div style={{
          width:48, height:48, borderRadius:10, flexShrink:0,
          background: colors ? colors.bg : '#e2e8f0',
          color: colors ? colors.text : '#94a3b8',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:24, fontWeight:900,
          boxShadow: colors ? `0 3px 10px ${colors.bg}66` : 'none',
        }}>
          {g || '?'}
        </div>

        {/* Mini escala A→G */}
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', gap:2, marginBottom:3 }}>
            {allGrades.map(grd => {
              const gc = EU_GRADES[grd];
              const isActive = grd === g;
              return (
                <div key={grd} style={{
                  flex:1, height:isActive ? 22 : 16, borderRadius:3,
                  background: isActive ? gc.bg : gc.bg + '35',
                  color: isActive ? gc.text : gc.bg,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize: isActive ? 10 : 9, fontWeight: isActive ? 900 : 600,
                  border: isActive ? `2px solid ${gc.bg}` : 'none',
                  transition:'height .15s',
                }}>
                  {grd}
                </div>
              );
            })}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'var(--color-text-muted)', paddingLeft:1, paddingRight:1 }}>
            <span>+ Mejor</span><span>Peor +</span>
          </div>
        </div>
      </div>

      {/* Tip de venta */}
      {tip && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:7, padding:'6px 10px', fontSize:11, color:'#166534', lineHeight:1.5 }}>
          💡 {tip}
        </div>
      )}
      {!g && (
        <div style={{ background:'#f8fafc', border:'1px solid var(--color-border)', borderRadius:7, padding:'6px 10px', fontSize:11, color:'var(--color-text-muted)' }}>
          Sin datos — usa el botón IA para completar.
        </div>
      )}
    </div>
  );
}

function NoiseSectionCard({ db }) {
  const color = noiseColor(db);
  const info = db ? noiseLabel(db) : null;
  const waves = info?.waves || 0;

  return (
    <div style={{ flex:1, minWidth:140 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:6 }}>🔊 Nivel de Ruido</div>

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        {/* Badge */}
        <div style={{
          width:48, height:48, borderRadius:10, flexShrink:0,
          background: db ? color + '18' : '#e2e8f0',
          border: `2px solid ${db ? color : '#cbd5e1'}`,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{ fontSize:13, fontWeight:900, color: db ? color : '#94a3b8', lineHeight:1 }}>{db || '?'}</div>
          {db && <div style={{ fontSize:9, color:'var(--color-text-muted)' }}>dB</div>}
        </div>

        {/* Escala visual */}
        <div style={{ flex:1 }}>
          {[
            { max:67, label:'≤67 dB', color:'#16a34a', tip:'Silencioso' },
            { max:71, label:'68–71', color:'#84cc16', tip:'Moderado' },
            { max:74, label:'72–74', color:'#eab308', tip:'Perceptible' },
            { max:999, label:'≥75 dB', color:'#dc2626', tip:'Ruidoso' },
          ].map((row, i) => {
            const isActive = db && (
              i === 0 ? db <= 67 :
              i === 1 ? db >= 68 && db <= 71 :
              i === 2 ? db >= 72 && db <= 74 :
              db >= 75
            );
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                <div style={{ width:8, height:8, borderRadius:2, background: isActive ? row.color : row.color + '35', border: isActive ? `2px solid ${row.color}` : 'none', flexShrink:0 }} />
                <div style={{ fontSize:9, color: isActive ? row.color : 'var(--color-text-muted)', fontWeight: isActive ? 800 : 500 }}>
                  {row.label} — {row.tip}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize:8, color:'var(--color-text-muted)', marginTop:3 }}>{'🔈'.repeat(waves) || '—'} {info?.label || ''}</div>
        </div>
      </div>

      {info?.tip && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:7, padding:'6px 10px', fontSize:11, color:'#166534', lineHeight:1.5 }}>
          💡 {info.tip}
        </div>
      )}
    </div>
  );
}

function LoadSpeedSection({ indice_carga, velocidad_max, cargaMaxNeumatico, velocidadMaxKmh }) {
  const idxNum = indice_carga ? parseInt(indice_carga) : null;
  const kgPerTire = cargaMaxNeumatico || (idxNum ? LOAD_INDEX_KG[idxNum] : null);
  const kgTotal = kgPerTire ? kgPerTire * 4 : null;
  const loadCat = LOAD_CATEGORY(kgPerTire);

  const speedLetter = velocidad_max ? String(velocidad_max).toUpperCase() : null;
  const kmhValue = velocidadMaxKmh || (speedLetter ? SPEED_INDEX_KMH[speedLetter] : null);
  const speedCat = SPEED_CATEGORY(kmhValue);

  const speedIdx = SPEED_SCALE.findIndex(s => s.key === speedLetter);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

      {/* Índice de Carga */}
      <div style={{ background:'var(--color-bg)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)' }}>
        <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'var(--color-primary)', marginBottom:10 }}>⚖️ Índice de Carga</div>

        {indice_carga || kgPerTire ? (
          <>
            {/* Valor principal */}
            <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:4 }}>
              {indice_carga && <span style={{ fontSize:32, fontWeight:900, lineHeight:1 }}>{indice_carga}</span>}
              {kgPerTire && <span style={{ fontSize:14, color:'var(--color-text-muted)' }}>= <strong style={{ color:'var(--color-text)', fontSize:16 }}>{kgPerTire.toLocaleString()} kg</strong> / neu.</span>}
            </div>

            {/* Total 4 neumáticos */}
            {kgTotal && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:8, background:'#eff6ff', border:'1px solid #bfdbfe', marginBottom:10 }}>
                <span style={{ fontSize:12, color:'#1d4ed8' }}>🚗 Total 4 neumáticos:</span>
                <span style={{ fontSize:15, fontWeight:900, color:'#1d4ed8' }}>{kgTotal.toLocaleString()} kg</span>
              </div>
            )}

            {/* Categoría */}
            {loadCat && (
              <div style={{ fontSize:11, color:'var(--color-text-muted)', marginBottom:8 }}>
                <strong>Categoría:</strong> {loadCat.label} — {loadCat.tip}
              </div>
            )}

            {/* Mini tabla referencia */}
            <details style={{ marginTop:6 }}>
              <summary style={{ fontSize:11, color:'var(--color-primary)', cursor:'pointer', fontWeight:700 }}>Ver tabla de referencia ▾</summary>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
                {Object.entries(LOAD_INDEX_KG).filter(([k]) => parseInt(k) >= 75 && parseInt(k) <= 110).map(([idx, kg]) => (
                  <div key={idx} style={{
                    padding:'2px 4px', borderRadius:4, fontSize:10, textAlign:'center',
                    background: parseInt(idx) === idxNum ? '#1d4ed8' : 'var(--color-surface)',
                    color: parseInt(idx) === idxNum ? '#fff' : 'var(--color-text)',
                    fontWeight: parseInt(idx) === idxNum ? 900 : 400,
                    border: parseInt(idx) === idxNum ? '1px solid #1d4ed8' : '1px solid var(--color-border)',
                  }}>
                    {idx} = {kg}kg
                  </div>
                ))}
              </div>
            </details>
          </>
        ) : (
          <div style={{ fontSize:12, color:'var(--color-text-muted)' }}>Sin datos — usar botón IA.</div>
        )}
      </div>

      {/* Índice de Velocidad */}
      <div style={{ background:'var(--color-bg)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)' }}>
        <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'var(--color-primary)', marginBottom:10 }}>🏎️ Índice de Velocidad</div>

        {velocidad_max || kmhValue ? (
          <>
            {/* Valor principal */}
            <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:10 }}>
              {velocidad_max && <span style={{ fontSize:32, fontWeight:900, lineHeight:1 }}>{velocidad_max}</span>}
              {kmhValue && <span style={{ fontSize:14, color:'var(--color-text-muted)' }}>= <strong style={{ color:'var(--color-text)', fontSize:16 }}>{kmhValue} km/h</strong> máx.</span>}
            </div>

            {/* Escala visual */}
            <div style={{ marginBottom:10 }}>
              <div style={{ display:'flex', gap:2, marginBottom:2 }}>
                {SPEED_SCALE.map((s, i) => {
                  const isActive = s.key === speedLetter;
                  const isPast = speedIdx >= 0 && i <= speedIdx;
                  return (
                    <div key={s.key} style={{ flex:1, textAlign:'center' }}>
                      <div style={{
                        height: isActive ? 26 : 16, borderRadius:3, marginBottom:2,
                        background: isActive ? '#8b5cf6' : isPast ? '#8b5cf630' : '#e2e8f0',
                        border: isActive ? '2px solid #8b5cf6' : 'none',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        transition:'height .15s',
                      }}>
                        <span style={{ fontSize:9, fontWeight: isActive ? 900 : 600, color: isActive ? '#fff' : '#64748b' }}>{s.key}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:8, color:'var(--color-text-muted)' }}>
                <span>160 km/h</span><span>300 km/h</span>
              </div>
            </div>

            {/* Categoría */}
            {speedCat && (
              <div style={{ padding:'6px 10px', borderRadius:7, border:`1px solid ${speedCat.color}33`, background:`${speedCat.color}10` }}>
                <div style={{ fontSize:12, fontWeight:800, color:speedCat.color }}>{speedCat.label}</div>
                <div style={{ fontSize:11, color:'var(--color-text-muted)', marginTop:2 }}>{speedCat.tip}</div>
              </div>
            )}

            {/* Tabla completa */}
            <details style={{ marginTop:8 }}>
              <summary style={{ fontSize:11, color:'var(--color-primary)', cursor:'pointer', fontWeight:700 }}>Ver tabla completa ▾</summary>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
                {Object.entries(SPEED_INDEX_KMH).map(([letra, kmh]) => (
                  <div key={letra} style={{
                    padding:'3px 6px', borderRadius:4, fontSize:10, textAlign:'center',
                    background: letra === speedLetter ? '#8b5cf6' : 'var(--color-surface)',
                    color: letra === speedLetter ? '#fff' : 'var(--color-text)',
                    fontWeight: letra === speedLetter ? 900 : 400,
                    border: letra === speedLetter ? '1px solid #8b5cf6' : '1px solid var(--color-border)',
                  }}>
                    {letra} = {kmh} km/h
                  </div>
                ))}
              </div>
            </details>
          </>
        ) : (
          <div style={{ fontSize:12, color:'var(--color-text-muted)' }}>Sin datos — usar botón IA.</div>
        )}
      </div>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function ProductoModal({ prodId, onClose, comparar = [], setComparar = () => {}, ocultarGestion = false, onCotizar = null, onVerComparacion = () => {} }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: prod, isLoading } = useQuery({
    queryKey: ['producto', prodId],
    queryFn: () => productosApi.obtener(prodId),
    enabled: !!prodId,
  });

  const aiMut = useMutation({
    mutationFn: () => productosApi.enriquecer(prodId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['producto', prodId] });
      qc.invalidateQueries({ queryKey: ['productos'] });
      toast.success(data?.mensaje || 'Información completada con IA');
    },
    onError: (e) => toast.error(e?.error || 'Error al conectar con IA'),
  });

  const delMut = useMutation({
    mutationFn: () => productosApi.eliminar(prodId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['productos'] });
      toast.success(data?.mensaje || 'Llanta eliminada del catálogo');
      onClose();
    },
    onError: (e) => toast.error(e?.error || 'Error al eliminar'),
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const tipoColor = prod ? (TIPO_COLOR[prod.tipoVehiculo] || '#64748b') : '#64748b';
  const stockTotal = prod?.stocks?.reduce((a, s) => a + s.cantidad, 0) || 0;
  const medidaParts = prod ? parseMedida(prod.medida) : {};
  const camposFaltantesArr = prod ? TECH_FIELDS.filter(f => !prod[f] && prod[f] !== 0) : [];
  const camposFaltantes = camposFaltantesArr.length;
  const faltantesLabels = camposFaltantesArr.map(f => FIELD_LABELS[f] || f);
  const camposExtra = prod?.camposExtra ? Object.entries(prod.camposExtra) : [];

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:12, backdropFilter:'blur(3px)' }}
      onClick={onClose}
    >
      <div
        style={{ background:'var(--color-surface)', borderRadius:16, width:'100%', maxWidth:720, maxHeight:'93dvh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.45)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--color-border)', display:'flex', alignItems:'center', gap:12, background:'var(--color-bg)', flexShrink:0 }}>
          <div style={{ fontSize:26 }}>🛞</div>
          <div style={{ flex:1, minWidth:0 }}>
            {prod ? (
              <>
                <div style={{ fontSize:15, fontWeight:800, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {prod.marca} {prod.nombreComercial || ''}
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:3, flexWrap:'wrap' }}>
                  <span style={{ fontSize:13, fontWeight:800, color:'var(--color-primary)', background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:6, padding:'1px 8px' }}>{prod.medida}</span>
                  {medidaParts.ancho && (
                    <div style={{ textAlign:'center', padding:'2px 8px', borderRadius:6, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#1d4ed8', lineHeight:1.2 }}>{medidaParts.ancho} mm</div>
                      <div style={{ fontSize:9, fontWeight:600, color:'#3b82f6', letterSpacing:.3 }}>ANCHO</div>
                    </div>
                  )}
                  {medidaParts.perfil && (
                    <div style={{ textAlign:'center', padding:'2px 8px', borderRadius:6, background:'#f5f3ff', border:'1px solid #ddd6fe' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#6d28d9', lineHeight:1.2 }}>{medidaParts.perfil}%</div>
                      <div style={{ fontSize:9, fontWeight:600, color:'#8b5cf6', letterSpacing:.3 }}>PERFIL</div>
                    </div>
                  )}
                  {medidaParts.radio && (
                    <div style={{ textAlign:'center', padding:'2px 8px', borderRadius:6, background:'#fff7ed', border:'1px solid #fed7aa' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#c2410c', lineHeight:1.2 }}>R{medidaParts.radio}</div>
                      <div style={{ fontSize:9, fontWeight:600, color:'#ea580c', letterSpacing:.3 }}>RADIO</div>
                    </div>
                  )}
                  {prod.modelo && <span style={{ fontSize:11, color:'var(--color-text-muted)' }}>Modelo: <strong>{prod.modelo}</strong></span>}
                  {prod.runFlat != null && <span style={{ fontSize:10, fontWeight:700, padding:'1px 8px', borderRadius:6, background: prod.runFlat ? '#dcfce7' : '#f1f5f9', color: prod.runFlat ? '#15803d' : '#64748b' }}>{prod.runFlat ? '✓ Run-Flat' : 'Sin Run-Flat'}</span>}
                  {prod.tipoLlanta && <span style={{ fontSize:10, fontWeight:700, padding:'1px 8px', borderRadius:6, background:'#fef9c3', color:'#854d0e' }}>🛞 {prod.tipoLlanta}</span>}
                  {prod.tipoVehiculo && <span style={{ fontSize:10, fontWeight:700, padding:'1px 8px', borderRadius:6, background:tipoColor+'20', color:tipoColor }}>🚗 {prod.tipoVehiculo}</span>}
                  {prod.grupo && <span style={{ fontSize:11, color:'var(--color-text-muted)' }}>{prod.grupo}</span>}
                  {prod.garantia && <span style={{ fontSize:11, color:'var(--color-text-muted)' }}>🛡️ {prod.garantia}</span>}
                </div>
              </>
            ) : <div style={{ height:36 }} />}
          </div>
          <button onClick={onClose} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-surface)', cursor:'pointer', fontSize:16, flexShrink:0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY:'auto', flex:1, padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
          {isLoading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:40 }}><LoadingSpinner /></div>
          ) : !prod ? (
            <div style={{ textAlign:'center', padding:40, color:'var(--color-text-muted)' }}>Producto no encontrado</div>
          ) : (
            <>
              {/* ── Etiqueta EU ── */}
              <div style={{ background:'var(--color-bg)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)' }}>
                <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'var(--color-primary)', marginBottom:12 }}>🏷️ Etiqueta EU de Neumáticos</div>
                <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                  <EUGradeCard grade={prod.eficienciaCombustible} label="Eficiencia de Combustible" tips={EU_FUEL_TIPS} icon="⛽" />
                  <EUGradeCard grade={prod.eficienciaFrenado} label="Eficiencia de Frenado (mojado)" tips={EU_BRAKE_TIPS} icon="🌧️" />
                  <NoiseSectionCard db={prod.nivelRuido} />
                </div>
              </div>

              {/* ── Índice de carga y velocidad ── */}
              <LoadSpeedSection
                indice_carga={prod.indice_carga}
                velocidad_max={prod.velocidad_max}
                cargaMaxNeumatico={prod.cargaMaxNeumatico}
                velocidadMaxKmh={prod.velocidadMaxKmh}
              />

              {/* ── Origen + Precios + Stock ── */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                {/* Origen */}
                <div style={{ background:'var(--color-bg)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)' }}>
                  <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'var(--color-primary)', marginBottom:10 }}>🌍 Origen</div>
                  {prod.paisFabricacion && <div style={{ marginBottom:6 }}><div style={{ fontSize:10, color:'var(--color-text-muted)' }}>Fabricado en</div><div style={{ fontWeight:700, fontSize:13 }}>{prod.paisFabricacion}</div></div>}
                  {prod.origenMarca && <div style={{ marginBottom:6 }}><div style={{ fontSize:10, color:'var(--color-text-muted)' }}>Origen de la marca</div><div style={{ fontWeight:700, fontSize:13 }}>{prod.origenMarca}</div></div>}
                  {!prod.paisFabricacion && !prod.origenMarca && <div style={{ fontSize:12, color:'var(--color-text-muted)' }}>Sin datos</div>}
                </div>

                {/* Precios */}
                <div style={{ background:'var(--color-bg)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)' }}>
                  <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'var(--color-primary)', marginBottom:10 }}>💰 Precio</div>
                  <div style={{ fontSize:20, fontWeight:900, color:'var(--color-primary)' }}>{fmt(prod.precioRegular) || '—'}</div>
                  {prod.precioOferta && <div style={{ marginTop:4, padding:'2px 8px', background:'#f0fdf4', borderRadius:6, border:'1px solid #bbf7d0', fontSize:12, fontWeight:700, color:'#16a34a', display:'inline-block' }}>Oferta {fmt(prod.precioOferta)}</div>}
                  {prod.descuentoMaximo && <div style={{ marginTop:6, fontSize:11, color:'var(--color-text-muted)' }}>Dcto. máx. {parseFloat(prod.descuentoMaximo).toFixed(0)}%</div>}
                  {prod.sku && <div style={{ marginTop:8, fontSize:9, color:'var(--color-text-muted)', fontFamily:'monospace' }}>SKU: {prod.sku}</div>}
                </div>

                {/* Stock */}
                <div style={{ background:'var(--color-bg)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)' }}>
                  <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'var(--color-primary)', marginBottom:10 }}>📍 Stock</div>
                  <div style={{ fontSize:22, fontWeight:900, color: stockTotal > 10 ? '#16a34a' : stockTotal > 0 ? '#f97316' : '#dc2626' }}>
                    {stockTotal} <span style={{ fontSize:12, fontWeight:500 }}>uds</span>
                  </div>
                  <div style={{ marginTop:6 }}>
                    {prod.stocks?.map(s => {
                      const color = s.cantidad <= s.stockMinimo ? '#dc2626' : s.cantidad <= s.stockMinimo*2 ? '#f97316' : '#16a34a';
                      return (
                        <div key={s.id} style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:2 }}>
                          <span style={{ color:'var(--color-text-muted)' }}>{s.sede?.nombre || s.sede?.codigoLocal}</span>
                          <span style={{ fontWeight:700, color }}>{s.cantidad}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Ficha técnica */}
              {prod.fichaTecnica && (
                <div style={{ background:'var(--color-bg)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)' }}>
                  <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'var(--color-primary)', marginBottom:10 }}>📄 Ficha Técnica</div>
                  <div style={{ fontSize:13, color:'var(--color-text)', lineHeight:1.75, whiteSpace:'pre-wrap' }}>{prod.fichaTecnica}</div>
                </div>
              )}

              {/* Campos extra */}
              {camposExtra.length > 0 && (
                <div style={{ background:'var(--color-bg)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)' }}>
                  <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1, color:'var(--color-primary)', marginBottom:8 }}>📋 Campos Adicionales</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px' }}>
                    {camposExtra.map(([k, v]) => (
                      <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid var(--color-border)', fontSize:12 }}>
                        <span style={{ color:'var(--color-text-muted)' }}>{k.replace(/_/g,' ')}</span>
                        <span style={{ fontWeight:600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {prod.imagenUrl && (
                <div style={{ textAlign:'center' }}>
                  <img src={prod.imagenUrl} alt="" style={{ maxHeight:140, maxWidth:'100%', borderRadius:10, objectFit:'contain', border:'1px solid var(--color-border)' }} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {prod && (
          <div style={{ padding:'12px 16px', borderTop:'1px solid var(--color-border)', display:'flex', gap:8, alignItems:'center', flexShrink:0, background:'var(--color-bg)', flexWrap:'wrap' }}>
            {/* Datos faltantes — solo informativo. El rellenado con IA se hace al EDITAR el producto. */}
            {camposFaltantes > 0 ? (
              <div style={{ flex:1, minWidth:180, fontSize:11.5, color:'#92400e', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:9, padding:'8px 11px', lineHeight:1.45 }}>
                🤖 <strong>Faltan {camposFaltantes} dato{camposFaltantes !== 1 ? 's' : ''}:</strong> {faltantesLabels.join(', ')}.
                <span style={{ display:'block', opacity:.85, marginTop:2 }}>Se completan con IA al <em>editar</em> el producto (botón “Editar →”).</span>
              </div>
            ) : (
              <div style={{ fontSize:12, color:'#16a34a', fontWeight:700 }}>✅ Ficha técnica completa</div>
            )}

            {/* Botones comparar — se pueden marcar VARIAS llantas (no solo 2) */}
            {(() => {
              const estaEnComparar = comparar.includes(prodId);
              const marcadas = comparar.length;
              return (
                <>
                  <button
                    onClick={() => setComparar(prev => estaEnComparar ? prev.filter(id => id !== prodId) : [...prev, prodId])}
                    style={estaEnComparar
                      ? { padding:'9px 12px', borderRadius:9, border:'2px solid #16a34a', background:'#f0fdf4', color:'#166534', cursor:'pointer', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }
                      : { padding:'9px 12px', borderRadius:9, border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text)', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}
                  >
                    {estaEnComparar ? '✅ Marcada · Quitar' : '📌 Marcar para comparar'}
                  </button>
                  {marcadas >= 2 && (
                    <button
                      onClick={() => onVerComparacion()}
                      style={{ padding:'9px 12px', borderRadius:9, border:'2px solid #f59e0b', background:'#fffbeb', color:'#92400e', cursor:'pointer', fontSize:12, fontWeight:800, whiteSpace:'nowrap' }}
                    >
                      ⚖️ Comparar ({marcadas})
                    </button>
                  )}
                </>
              );
            })()}

            {/* Crear cotización con esta llanta */}
            <button
              onClick={() => {
                if (onCotizar) { onCotizar(prod); }              // dentro de CotizacionNueva: seleccionar la llanta
                else { onClose(); navigate('/cotizaciones/nueva', { state: { llantaId: prodId } }); } // desde inventario: abrir cotización nueva
              }}
              style={{ padding:'9px 14px', borderRadius:9, border:'none', background:'#16a34a', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:800, whiteSpace:'nowrap' }}
            >
              📋 Cotizar esta llanta
            </button>

            {/* Editar — la edición, el rellenado con IA y eliminar están dentro de la edición del producto */}
            {!ocultarGestion && (
              <button
                onClick={() => { onClose(); navigate(`/inventario/${prodId}`); }}
                style={{ padding:'9px 14px', borderRadius:9, border:'none', background:'#f5c400', color:'#000', cursor:'pointer', fontSize:12, fontWeight:800, whiteSpace:'nowrap' }}
              >
                ✏️ Editar producto →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
