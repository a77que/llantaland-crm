import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { leadsApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';

const PASO_LABEL = {
  nuevo:'Nuevo', esperando_medida:'Esperando medida', esperando_version_auto:'Versión auto',
  info_tecnica:'Info técnica', esperando_datos_cliente:'Datos cliente',
  esperando_eleccion_marca:'Eligiendo marca', esperando_eleccion_llanta:'Eligiendo llanta', esperando_distrito:'Eligiendo distrito',
  esperando_eleccion_b:'Eligiendo local', esperando_local_destino:'Local destino',
  esperando_confirmacion:'Confirmando', completado:'Completado', opt_out:'Opt-out',
};
const PASO_COLOR = {
  nuevo:'#64748b', esperando_medida:'#f59e0b', esperando_version_auto:'#f59e0b',
  info_tecnica:'#f59e0b', esperando_datos_cliente:'#3b82f6', esperando_eleccion_marca:'#3b82f6', esperando_eleccion_llanta:'#3b82f6',
  esperando_distrito:'#8b5cf6', esperando_eleccion_b:'#8b5cf6', esperando_local_destino:'#8b5cf6',
  esperando_confirmacion:'#f97316', completado:'#22c55e', opt_out:'#ef4444',
};
const RANKING_ICON  = { caliente:'🔥', tibio:'🌡️', frio:'❄️' };
const RANKING_COLOR = { caliente:'#ef4444', tibio:'#f59e0b', frio:'#3b82f6' };
const badge = (color) => ({ display:'inline-block', padding:'2px 9px', borderRadius:10, fontSize:11, fontWeight:700, background:color+'22', color });

// Columnas ordenables → campo API
const SORTABLE = {
  nombreCliente:'nombreCliente', telefono:'telefono', medidaDetectada:'medidaDetectada',
  marcaAuto:'marcaAuto', pasoActual:'pasoActual', ranking:'ranking',
  updatedAt:'updatedAt', fechaCita:'fechaCita',
};

// ── Modal edición rápida ──────────────────────────────────────────────────────
function ModalEditar({ cliente, onClose, onGuardado }) {
  const [form, setForm] = useState({
    nombreCliente:   cliente.nombreCliente   || '',
    dniCe:           cliente.dniCe           || '',
    marcaAuto:       cliente.marcaAuto       || '',
    modeloAuto:      cliente.modeloAuto      || '',
    anioAuto:        cliente.anioAuto        || '',
    medidaDetectada: cliente.medidaDetectada || '',
    marcaLlanta:     cliente.marcaLlanta     || '',
    distritoCliente: cliente.distritoCliente || '',
    pasoActual:      cliente.pasoActual      || 'nuevo',
    ranking:         cliente.ranking         || '',
    fechaCita:       cliente.fechaCita       || '',
    estadoLogistica: cliente.estadoLogistica || '',
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const inp = {
    width:'100%', padding:'8px 12px', fontSize:13,
    border:'1.5px solid var(--color-border)', borderRadius:8,
    background:'var(--color-surface)', color:'var(--color-text)',
  };
  const lbl = (txt) => (
    <label style={{ display:'block', fontSize:10, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>{txt}</label>
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--color-surface)', borderRadius:14, width:'100%', maxWidth:520, maxHeight:'92dvh', overflowY:'auto', padding:24 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700 }}>Editar cliente</div>
            <div style={{ fontSize:12, color:'var(--color-text-muted)' }}>📞 {cliente.telefono}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--color-text-muted)' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px' }}>
          <div style={{ gridColumn:'span 2' }}>{lbl('Nombre completo')}<input style={inp} value={form.nombreCliente} onChange={set('nombreCliente')} placeholder="Juan Pérez" /></div>
          <div>{lbl('DNI / CE')}<input style={inp} value={form.dniCe} onChange={set('dniCe')} /></div>
          <div>{lbl('Medida llanta')}<input style={inp} value={form.medidaDetectada} onChange={set('medidaDetectada')} placeholder="195/65R15" /></div>
          <div>{lbl('Marca auto')}<input style={inp} value={form.marcaAuto} onChange={set('marcaAuto')} /></div>
          <div>{lbl('Modelo auto')}<input style={inp} value={form.modeloAuto} onChange={set('modeloAuto')} /></div>
          <div>{lbl('Año')}<input style={inp} type="number" value={form.anioAuto} onChange={set('anioAuto')} /></div>
          <div>{lbl('Distrito')}<input style={inp} value={form.distritoCliente} onChange={set('distritoCliente')} /></div>
          <div>{lbl('Marca llanta')}<input style={inp} value={form.marcaLlanta} onChange={set('marcaLlanta')} /></div>
          <div>{lbl('Fecha cita')}<input style={inp} value={form.fechaCita} onChange={set('fechaCita')} /></div>
          <div>
            {lbl('Paso actual')}
            <select style={inp} value={form.pasoActual} onChange={set('pasoActual')}>
              {Object.entries(PASO_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            {lbl('Ranking')}
            <select style={inp} value={form.ranking} onChange={set('ranking')}>
              <option value="">Sin ranking</option>
              <option value="caliente">🔥 Caliente</option>
              <option value="tibio">🌡️ Tibio</option>
              <option value="frio">❄️ Frío</option>
            </select>
          </div>
          <div style={{ gridColumn:'span 2' }}>{lbl('Estado logística')}<input style={inp} value={form.estadoLogistica} onChange={set('estadoLogistica')} /></div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button
            onClick={() => onGuardado(form)}
            style={{ flex:1, padding:'11px', background:'#f5c400', color:'#000', border:'none', borderRadius:8, fontSize:14, fontWeight:800, cursor:'pointer' }}
          >💾 Guardar cambios</button>
          <button onClick={onClose} style={{ padding:'11px 18px', border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Clientes() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const q      = searchParams.get('q')       || '';
  const paso   = searchParams.get('paso')    || '';
  const page   = parseInt(searchParams.get('page')    || '1');
  const sortBy = searchParams.get('sortBy')  || 'updatedAt';
  const sortDir= searchParams.get('sortDir') || 'desc';

  const [editCliente, setEditCliente] = useState(null);

  const setParam = (key, val) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    return next;
  }, { replace: true });

  const handleSort = (colKey) => {
    const field = SORTABLE[colKey];
    if (!field) return;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (sortBy === field) {
        next.set('sortDir', sortDir === 'asc' ? 'desc' : 'asc');
      } else {
        next.set('sortBy', field);
        next.set('sortDir', 'desc');
      }
      next.set('page', '1');
      return next;
    }, { replace: true });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['clientes-lista', { q, paso, page, sortBy, sortDir }],
    queryFn: () => leadsApi.listar({ q, paso, page, limit: 50, orderBy: sortBy, orderDir: sortDir }),
    keepPreviousData: true,
  });

  const { data: resumen } = useQuery({
    queryKey: ['leads-resumen'],
    queryFn: leadsApi.resumen,
  });

  const { isAdmin } = useAuth();

  const actualizarMut = useMutation({
    mutationFn: ({ id, data }) => leadsApi.actualizar(id, data),
    onSuccess: () => {
      toast.success('Cliente actualizado');
      setEditCliente(null);
      qc.invalidateQueries(['clientes-lista']);
      qc.invalidateQueries(['cliente']);
    },
    onError: (e) => toast.error(e?.error || 'Error al guardar'),
  });

  const eliminarMut = useMutation({
    mutationFn: (id) => leadsApi.eliminar(id),
    onSuccess: (resp) => {
      toast.success(resp?.mensaje || 'Cliente eliminado');
      qc.invalidateQueries(['clientes-lista']);
      qc.invalidateQueries(['leads-resumen']);
    },
    onError: (e) => toast.error(e?.error || 'Error al eliminar'),
  });

  const confirmarEliminar = (cliente) => {
    const nombre = cliente.nombreCliente || cliente.telefono;
    if (window.confirm(`⚠️ ¿Eliminar a "${nombre}"?\n\nSus ventas y cotizaciones quedarán sin cliente asignado.\n\nEsta acción no se puede deshacer.`)) {
      eliminarMut.mutate(cliente.id);
    }
  };

  const clientes = data?.leads || [];
  const total    = data?.total || 0;

  const SortTh = ({ colKey, label, style: extraStyle }) => {
    const field = SORTABLE[colKey];
    const isActive = field && sortBy === field;
    const icon = field ? (isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅') : '';
    return (
      <th
        onClick={() => handleSort(colKey)}
        style={{
          textAlign:'left', padding:'10px 14px', fontSize:11, fontWeight:700,
          color: isActive ? '#f5c400' : 'var(--color-text-muted)',
          textTransform:'uppercase', background:'var(--color-bg)',
          borderBottom:'1px solid var(--color-border)', whiteSpace:'nowrap',
          cursor: field ? 'pointer' : 'default', userSelect:'none',
          background: isActive ? '#fffbeb' : 'var(--color-bg)',
          ...extraStyle,
        }}
        title={field ? `Ordenar por ${label}` : undefined}
      >
        {label}<span style={{ opacity: isActive ? 1 : 0.4, fontSize:10 }}>{icon}</span>
      </th>
    );
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize: isMobile?18:22, fontWeight:700 }}>Clientes</div>
          <div style={{ fontSize:12, color:'var(--color-text-muted)', marginTop:2 }}>{total} clientes · ordenado por {sortBy} {sortDir==='asc'?'↑':'↓'}</div>
        </div>
      </div>

      {/* Stats */}
      {resumen && (
        <div style={{ display:'flex', gap:10, marginBottom:16, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
          {[
            { num:resumen.total, label:'Total',      color:'var(--color-primary)' },
            { num:resumen.hoy,   label:'Hoy',        color:'#3b82f6' },
            ...(resumen.porRanking||[]).filter(r=>r.ranking).map(r=>({ num:r._count, label:`${RANKING_ICON[r.ranking]} ${r.ranking}`, color:RANKING_COLOR[r.ranking] })),
            ...(resumen.porPaso||[]).filter(p=>p.pasoActual==='completado').map(p=>({ num:p._count, label:'Completados', color:'#22c55e' })),
          ].map((s,i) => (
            <div key={i} style={{ flexShrink:0, background:'var(--color-surface)', border:'1px solid var(--color-border)', borderRadius:10, padding:'10px 16px', textAlign:'center', minWidth:80 }}>
              <div style={{ fontSize: isMobile?18:22, fontWeight:800, color:s.color }}>{s.num}</div>
              <div style={{ fontSize:10, color:'var(--color-text-muted)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
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

      {/* Lista */}
      {isLoading ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--color-text-muted)' }}>⏳ Cargando...</div>
      ) : clientes.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--color-text-muted)' }}>
          <div style={{ fontSize:44 }}>👥</div>
          <div style={{ marginTop:12, fontWeight:600 }}>Sin clientes aún</div>
          <div style={{ fontSize:12, marginTop:6 }}>Se registran automáticamente cuando envían su primer mensaje por WhatsApp.</div>
        </div>
      ) : isMobile ? (
        /* Cards móvil */
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {clientes.map(c => (
            <div key={c.id} style={{ background:'var(--color-surface)', borderRadius:12, padding:'13px 15px', border:'1px solid var(--color-border)', borderLeft:`4px solid ${PASO_COLOR[c.pasoActual]||'#64748b'}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontWeight:700, fontSize:14 }}>{c.nombreCliente||c.telefono}</span>
                <span style={badge(PASO_COLOR[c.pasoActual]||'#64748b')}>{PASO_LABEL[c.pasoActual]||c.pasoActual}</span>
              </div>
              {c.nombreCliente && <div style={{ fontSize:12, color:'var(--color-text-muted)', marginBottom:4 }}>📞 {c.telefono}</div>}
              <div style={{ display:'flex', gap:10, fontSize:12, color:'var(--color-text-muted)', marginBottom:8 }}>
                {c.medidaDetectada && <span>🛞 {c.medidaDetectada}</span>}
                {c.ranking && <span style={{ color:RANKING_COLOR[c.ranking] }}>{RANKING_ICON[c.ranking]} {c.ranking}</span>}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setEditCliente(c)} style={{ flex:1, padding:'6px', border:'1.5px solid #f5c400', borderRadius:7, background:'#fffbeb', color:'#d4a900', fontSize:12, fontWeight:700, cursor:'pointer' }}>✏️ Editar</button>
                <Link to={`/clientes/${c.id}`} style={{ flex:1, padding:'6px', border:'1px solid var(--color-border)', borderRadius:7, background:'#0f0f0f', color:'#f5c400', fontSize:12, fontWeight:700, textAlign:'center' }}>Ver →</Link>
                {isAdmin && (
                  <button onClick={() => confirmarEliminar(c)} style={{ padding:'6px 10px', border:'1px solid #fecaca', borderRadius:7, background:'#fef2f2', color:'#dc2626', fontSize:12, fontWeight:700, cursor:'pointer' }}>🗑️</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Tabla desktop con columnas ordenables */
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', background:'var(--color-surface)', borderRadius:10, overflow:'hidden', boxShadow:'var(--shadow)' }}>
            <thead>
              <tr>
                <SortTh colKey="nombreCliente" label="Cliente" />
                <SortTh colKey="telefono" label="Teléfono" />
                <SortTh colKey="marcaAuto" label="Vehículo" />
                <SortTh colKey="medidaDetectada" label="Medida" />
                <SortTh colKey="pasoActual" label="Estado" />
                <SortTh colKey="ranking" label="Ranking" />
                <SortTh colKey="fechaCita" label="Cita" />
                <SortTh colKey="updatedAt" label="Actualizado" />
                <th style={{ textAlign:'left', padding:'10px 14px', fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', background:'var(--color-bg)', borderBottom:'1px solid var(--color-border)', whiteSpace:'nowrap' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--color-bg)'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <td style={{ padding:'10px 14px', fontWeight:600 }}>{c.nombreCliente||<span style={{color:'var(--color-text-muted)',fontWeight:400}}>Sin nombre</span>}</td>
                  <td style={{ padding:'10px 14px', fontSize:13 }}>{c.telefono}</td>
                  <td style={{ padding:'10px 14px', fontSize:13, color:'var(--color-text-muted)' }}>{[c.marcaAuto,c.modeloAuto,c.anioAuto].filter(Boolean).join(' ')||'—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:13 }}>{c.medidaDetectada||'—'}</td>
                  <td style={{ padding:'10px 14px' }}><span style={badge(PASO_COLOR[c.pasoActual]||'#64748b')}>{PASO_LABEL[c.pasoActual]||c.pasoActual}</span></td>
                  <td style={{ padding:'10px 14px' }}>{c.ranking?<span style={{color:RANKING_COLOR[c.ranking],fontWeight:700}}>{RANKING_ICON[c.ranking]} {c.ranking}</span>:'—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--color-text-muted)' }}>{c.fechaCita||'—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--color-text-muted)' }}>{new Date(c.updatedAt).toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{ padding:'10px 14px', whiteSpace:'nowrap' }}>
                    <button
                      onClick={() => setEditCliente(c)}
                      style={{ padding:'4px 12px', border:'1.5px solid #f5c400', borderRadius:6, background:'#fffbeb', color:'#d4a900', fontSize:11, fontWeight:700, cursor:'pointer', marginRight:6 }}
                    >✏️ Editar</button>
                    <Link to={`/clientes/${c.id}`} style={{ padding:'4px 12px', background:'#0f0f0f', color:'#f5c400', borderRadius:6, fontSize:11, fontWeight:700, border:'1px solid #f5c40040', marginRight: isAdmin ? 6 : 0 }}>Ver →</Link>
                    {isAdmin && (
                      <button onClick={() => confirmarEliminar(c)} style={{ padding:'4px 10px', border:'1px solid #fecaca', borderRadius:6, background:'#fef2f2', color:'#dc2626', fontSize:11, fontWeight:700, cursor:'pointer' }} title="Eliminar cliente">🗑️</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {total > 50 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16 }}>
          <button onClick={()=>setSearchParams(p=>{const n=new URLSearchParams(p);n.set('page',String(Math.max(1,page-1)));return n;},{replace:true})} disabled={page===1} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', fontSize:13, fontWeight:600 }}>← Anterior</button>
          <span style={{ padding:'8px 14px', fontSize:13, color:'var(--color-text-muted)' }}>Pág. {page}</span>
          <button onClick={()=>setSearchParams(p=>{const n=new URLSearchParams(p);n.set('page',String(page+1));return n;},{replace:true})} disabled={clientes.length<50} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', fontSize:13, fontWeight:600 }}>Siguiente →</button>
        </div>
      )}

      {/* Modal edición rápida */}
      {editCliente && (
        <ModalEditar
          cliente={editCliente}
          onClose={() => setEditCliente(null)}
          onGuardado={(data) => actualizarMut.mutate({ id: editCliente.id, data })}
        />
      )}
    </div>
  );
}
