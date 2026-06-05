import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { leadsApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';

const PASO_LABEL = {
  nuevo:'Nuevo', esperando_medida:'Esperando medida', esperando_version_auto:'Versión auto',
  info_tecnica:'Info técnica', esperando_datos_cliente:'Datos cliente',
  esperando_eleccion_llanta:'Eligiendo llanta', esperando_distrito:'Eligiendo distrito',
  esperando_eleccion_b:'Eligiendo local', esperando_local_destino:'Local destino',
  esperando_confirmacion:'Confirmando', completado:'Completado', opt_out:'Opt-out',
};
const PASO_COLOR = {
  nuevo:'#64748b', esperando_medida:'#f59e0b', esperando_version_auto:'#f59e0b',
  info_tecnica:'#f59e0b', esperando_datos_cliente:'#3b82f6', esperando_eleccion_llanta:'#3b82f6',
  esperando_distrito:'#8b5cf6', esperando_eleccion_b:'#8b5cf6', esperando_local_destino:'#8b5cf6',
  esperando_confirmacion:'#f97316', completado:'#22c55e', opt_out:'#ef4444',
};
const RANKING_ICON  = { caliente:'🔥', tibio:'🌡️', frio:'❄️' };
const RANKING_COLOR = { caliente:'#ef4444', tibio:'#f59e0b', frio:'#3b82f6' };
const badge = (color) => ({ display:'inline-block', padding:'2px 9px', borderRadius:10, fontSize:11, fontWeight:700, background:color+'22', color });

export default function Clientes() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const q    = searchParams.get('q')    || '';
  const paso = searchParams.get('paso') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const setParam = (key, val) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    return next;
  }, { replace: true });

  const { data, isLoading } = useQuery({
    queryKey: ['clientes-lista', { q, paso, page }],
    queryFn: () => leadsApi.listar({ q, paso, page, limit: 50 }),
    keepPreviousData: true,
  });

  const { data: resumen } = useQuery({
    queryKey: ['leads-resumen'],
    queryFn: leadsApi.resumen,
  });

  const clientes = data?.leads || [];
  const total    = data?.total || 0;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize: isMobile?18:22, fontWeight:700 }}>Clientes</div>
          <div style={{ fontSize:12, color:'var(--color-text-muted)', marginTop:2 }}>{total} clientes registrados vía WhatsApp</div>
        </div>
      </div>

      {resumen && (
        <div style={{ display:'flex', gap:10, marginBottom:16, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
          {[
            { num:resumen.total, label:'Total',      color:'var(--color-primary)' },
            { num:resumen.hoy,   label:'Hoy',        color:'#3b82f6' },
            ...(resumen.porRanking||[]).filter(r=>r.ranking).map(r=>({ num:r._count, label:`${RANKING_ICON[r.ranking]} ${r.ranking}`, color:RANKING_COLOR[r.ranking] })),
            ...(resumen.porPaso||[]).filter(p=>p.pasoActual==='completado').map(p=>({ num:p._count, label:'Completados', color:'#22c55e' })),
          ].map((s,i) => (
            <div key={i} style={{ flexShrink:0, background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:10, padding:'10px 16px', textAlign:'center', minWidth:80 }}>
              <div style={{ fontSize: isMobile?20:22, fontWeight:800, color:s.color }}>{s.num}</div>
              <div style={{ fontSize:10, color:'var(--color-text-muted)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <input
          style={{ flex:'1 1 180px', padding:'10px 14px', fontSize:14, border:'1.5px solid var(--color-border)', borderRadius:10, background:'var(--color-surface)', color:'var(--color-text)', minWidth:0 }}
          placeholder="Buscar por teléfono o nombre..."
          value={q} onChange={e => setParam('q', e.target.value)}
        />
        <select
          style={{ padding:'10px 12px', fontSize:13, border:'1.5px solid var(--color-border)', borderRadius:10, background:'var(--color-surface)', color:'var(--color-text)' }}
          value={paso} onChange={e => setParam('paso', e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(PASO_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--color-text-muted)' }}>⏳ Cargando...</div>
      ) : clientes.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--color-text-muted)' }}>
          <div style={{ fontSize:44 }}>👥</div>
          <div style={{ marginTop:12, fontWeight:600 }}>Sin clientes aún</div>
          <div style={{ fontSize:12, marginTop:6 }}>Se registran automáticamente cuando envían su primer mensaje por WhatsApp.</div>
        </div>
      ) : isMobile ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {clientes.map(c => (
            <Link key={c.id} to={`/clientes/${c.id}`} style={{ textDecoration:'none' }}>
              <div style={{ background:'var(--color-surface)', borderRadius:12, padding:'13px 15px', border:'1px solid var(--color-border)', borderLeft:`4px solid ${PASO_COLOR[c.pasoActual]||'#64748b'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:14 }}>{c.nombreCliente||c.telefono}</span>
                  <span style={badge(PASO_COLOR[c.pasoActual]||'#64748b')}>{PASO_LABEL[c.pasoActual]||c.pasoActual}</span>
                </div>
                {c.nombreCliente && <div style={{ fontSize:12, color:'var(--color-text-muted)', marginBottom:4 }}>📞 {c.telefono}</div>}
                <div style={{ display:'flex', gap:10, fontSize:12, color:'var(--color-text-muted)' }}>
                  {c.medidaDetectada && <span>🛞 {c.medidaDetectada}</span>}
                  {c.ranking && <span style={{ color:RANKING_COLOR[c.ranking] }}>{RANKING_ICON[c.ranking]} {c.ranking}</span>}
                  <span style={{ marginLeft:'auto' }}>{new Date(c.updatedAt).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit'})}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', background:'var(--color-surface)', borderRadius:10, overflow:'hidden', boxShadow:'var(--shadow)' }}>
            <thead>
              <tr>{['Cliente','Teléfono','Vehículo','Medida','Estado','Ranking','Último contacto','Acciones'].map(h=>(
                <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', background:'var(--color-bg)', borderBottom:'1px solid var(--color-border)', whiteSpace:'nowrap' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} onMouseEnter={e=>e.currentTarget.style.background='var(--color-bg)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <td style={{ padding:'11px 14px', fontWeight:600 }}>{c.nombreCliente||<span style={{color:'var(--color-text-muted)',fontWeight:400}}>Sin nombre</span>}</td>
                  <td style={{ padding:'11px 14px', fontSize:13 }}>{c.telefono}</td>
                  <td style={{ padding:'11px 14px', fontSize:13, color:'var(--color-text-muted)' }}>{[c.marcaAuto,c.modeloAuto,c.anioAuto].filter(Boolean).join(' ')||'—'}</td>
                  <td style={{ padding:'11px 14px', fontSize:13 }}>{c.medidaDetectada||'—'}</td>
                  <td style={{ padding:'11px 14px' }}><span style={badge(PASO_COLOR[c.pasoActual]||'#64748b')}>{PASO_LABEL[c.pasoActual]||c.pasoActual}</span></td>
                  <td style={{ padding:'11px 14px' }}>{c.ranking?<span style={{color:RANKING_COLOR[c.ranking],fontWeight:700}}>{RANKING_ICON[c.ranking]} {c.ranking}</span>:'—'}</td>
                  <td style={{ padding:'11px 14px', fontSize:12, color:'var(--color-text-muted)' }}>{new Date(c.updatedAt).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{ padding:'11px 14px' }}>
                    <Link to={`/clientes/${c.id}`} style={{ padding:'5px 12px', background:'#0f0f0f', color:'#f5c400', borderRadius:6, fontSize:11, fontWeight:700, border:'1px solid #f5c40040', whiteSpace:'nowrap' }}>Ver ficha →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16 }}>
          <button onClick={()=>setSearchParams(p=>{const n=new URLSearchParams(p);n.set('page',String(Math.max(1,page-1)));return n;},{replace:true})} disabled={page===1} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', fontSize:13, fontWeight:600 }}>← Anterior</button>
          <span style={{ padding:'8px 14px', fontSize:13, color:'var(--color-text-muted)' }}>Pág. {page}</span>
          <button onClick={()=>setSearchParams(p=>{const n=new URLSearchParams(p);n.set('page',String(page+1));return n;},{replace:true})} disabled={clientes.length<50} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', fontSize:13, fontWeight:600 }}>Siguiente →</button>
        </div>
      )}
    </div>
  );
}
