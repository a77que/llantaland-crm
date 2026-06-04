import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { sedesApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';

const TIPO_COLOR  = { TIENDA: '#3b82f6', ALMACEN: '#f59e0b' };
const TIPO_ICON   = { TIENDA: '🏪', ALMACEN: '🏭' };

function ModalSede({ sede, onClose, onGuardado }) {
  const [form, setForm] = useState(sede || {
    codigoLocal: '', nombre: '', tipo: 'TIENDA',
    distrito: '', direccion: '', telefono: '',
    email: '', horario: '', encargado: '',
    latitud: '', longitud: '', activo: true,
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.checked }));

  const mut = useMutation({
    mutationFn: () => sede
      ? sedesApi.actualizar(sede.id, form)
      : sedesApi.crear(form),
    onSuccess: (data) => { toast.success(sede ? 'Almacén actualizado' : 'Almacén creado'); onGuardado(data); onClose(); },
    onError: (e) => toast.error(e?.error || 'Error al guardar'),
  });

  const inp = { width:'100%', padding:'9px 12px', fontSize:14, border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', color:'var(--color-text)' };
  const lbl = (txt, req) => <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{txt}{req && <span style={{ color:'#e3000f' }}> *</span>}</label>;
  const G = ({ children, half }) => <div style={{ gridColumn: half ? 'span 1' : 'span 2' }}>{children}</div>;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--color-surface)', borderRadius:14, width:'100%', maxWidth:600, maxHeight:'92dvh', overflowY:'auto', padding:28 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700 }}>{sede ? 'Editar Almacén' : 'Nuevo Almacén'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--color-text-muted)' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 16px' }}>
          {!sede && (
            <G half>{lbl('Código Local (L0-L5)', true)}<input style={inp} value={form.codigoLocal} onChange={set('codigoLocal')} placeholder="L0, L1, L2..." maxLength={3} /></G>
          )}
          <G>{lbl('Nombre', true)}<input style={inp} value={form.nombre} onChange={set('nombre')} placeholder="Tienda Miraflores" /></G>
          <G half>
            {lbl('Tipo')}
            <select style={inp} value={form.tipo} onChange={set('tipo')}>
              <option value="TIENDA">🏪 Tienda</option>
              <option value="ALMACEN">🏭 Almacén</option>
            </select>
          </G>
          <G half>{lbl('Distrito')}<input style={inp} value={form.distrito||''} onChange={set('distrito')} placeholder="Miraflores" /></G>
          <G>{lbl('Dirección')}<input style={inp} value={form.direccion||''} onChange={set('direccion')} placeholder="Av. Larco 654, Miraflores" /></G>
          <G half>{lbl('Teléfono')}<input style={inp} value={form.telefono||''} onChange={set('telefono')} placeholder="+51 01 445-5678" /></G>
          <G half>{lbl('Email')}<input style={inp} type="email" value={form.email||''} onChange={set('email')} placeholder="tienda@llantaland.com" /></G>
          <G>{lbl('Horario')}<input style={inp} value={form.horario||''} onChange={set('horario')} placeholder="Lun-Sab 8am-7pm, Dom 9am-2pm" /></G>
          <G>{lbl('Encargado')}<input style={inp} value={form.encargado||''} onChange={set('encargado')} placeholder="Juan Pérez" /></G>
          <G half>{lbl('Latitud')}<input style={inp} value={form.latitud||''} onChange={set('latitud')} placeholder="-12.1191" /></G>
          <G half>{lbl('Longitud')}<input style={inp} value={form.longitud||''} onChange={set('longitud')} placeholder="-77.0282" /></G>
        </div>

        <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:8 }}>
          <input type="checkbox" id="activo" checked={form.activo} onChange={setCheck('activo')} style={{ width:16, height:16, accentColor:'#f5c400' }} />
          <label htmlFor="activo" style={{ fontSize:13, fontWeight:600 }}>Local activo (visible para n8n y vendedores)</label>
        </div>

        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !form.nombre || (!sede && !form.codigoLocal)}
          style={{ width:'100%', marginTop:20, padding:'12px', background:'#f5c400', color:'#000', border:'none', borderRadius:8, fontSize:15, fontWeight:900, cursor:'pointer' }}
        >
          {mut.isPending ? '⏳ Guardando...' : '💾 Guardar Almacén'}
        </button>
      </div>
    </div>
  );
}

export default function Almacenes() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'nuevo' | sede_obj

  const { data: sedes = [], isLoading } = useQuery({
    queryKey: ['sedes'],
    queryFn: sedesApi.listar,
  });

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight:700 }}>Almacenes & Tiendas</div>
          <div style={{ fontSize:12, color:'var(--color-text-muted)', marginTop:2 }}>{sedes.length} locales configurados</div>
        </div>
        <button
          onClick={() => setModal('nuevo')}
          style={{ padding:'10px 20px', background:'#f5c400', color:'#000', border:'none', borderRadius:10, fontSize:14, fontWeight:800, cursor:'pointer' }}
        >
          + Nuevo local
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--color-text-muted)' }}>⏳ Cargando...</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))', gap:14 }}>
          {sedes.map(sede => (
            <div key={sede.id} style={{
              background:'var(--color-surface)', borderRadius:12,
              border:`1px solid var(--color-border)`,
              borderTop:`4px solid ${TIPO_COLOR[sede.tipo] || '#64748b'}`,
              overflow:'hidden',
              opacity: sede.activo ? 1 : 0.6,
            }}>
              {/* Header card */}
              <div style={{ padding:'16px 18px 12px', borderBottom:'1px solid var(--color-border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:18 }}>{TIPO_ICON[sede.tipo]}</span>
                      <span style={{ fontSize:16, fontWeight:700 }}>{sede.nombre}</span>
                      {!sede.activo && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:6, background:'#fef2f2', color:'#dc2626', fontWeight:700 }}>INACTIVO</span>}
                    </div>
                    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                      <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:6, background: TIPO_COLOR[sede.tipo]+'20', color: TIPO_COLOR[sede.tipo] }}>
                        {sede.codigoLocal}
                      </span>
                      <span style={{ fontSize:12, color:'var(--color-text-muted)' }}>{sede.tipo}</span>
                      {sede._count?.stocks !== undefined && (
                        <span style={{ fontSize:12, color:'var(--color-text-muted)' }}>🛞 {sede._count.stocks} SKUs</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setModal(sede)}
                    style={{ padding:'6px 14px', border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-bg)', fontSize:12, fontWeight:600, cursor:'pointer' }}
                  >
                    ✏️ Editar
                  </button>
                </div>
              </div>

              {/* Info */}
              <div style={{ padding:'12px 18px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px', fontSize:13 }}>
                {sede.direccion && (
                  <div style={{ gridColumn:'span 2' }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase' }}>📍 Dirección</span>
                    <div style={{ marginTop:2 }}>{sede.direccion}</div>
                  </div>
                )}
                {sede.telefono && (
                  <div>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase' }}>📞 Teléfono</span>
                    <div style={{ marginTop:2 }}><a href={`tel:${sede.telefono}`} style={{ color:'var(--color-primary)', fontWeight:600 }}>{sede.telefono}</a></div>
                  </div>
                )}
                {sede.email && (
                  <div>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase' }}>✉️ Email</span>
                    <div style={{ marginTop:2 }}><a href={`mailto:${sede.email}`} style={{ color:'var(--color-primary)' }}>{sede.email}</a></div>
                  </div>
                )}
                {sede.horario && (
                  <div style={{ gridColumn:'span 2' }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase' }}>🕐 Horario</span>
                    <div style={{ marginTop:2 }}>{sede.horario}</div>
                  </div>
                )}
                {sede.encargado && (
                  <div>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase' }}>👤 Encargado</span>
                    <div style={{ marginTop:2, fontWeight:600 }}>{sede.encargado}</div>
                  </div>
                )}
                {sede.distrito && (
                  <div>
                    <span style={{ fontSize:10, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase' }}>🗺️ Distrito</span>
                    <div style={{ marginTop:2 }}>{sede.distrito}</div>
                  </div>
                )}
                {!sede.direccion && !sede.telefono && !sede.horario && (
                  <div style={{ gridColumn:'span 2', color:'var(--color-text-muted)', fontSize:12, fontStyle:'italic' }}>
                    Sin información de contacto — haz clic en Editar para completar.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ModalSede
          sede={modal === 'nuevo' ? null : modal}
          onClose={() => setModal(null)}
          onGuardado={() => qc.invalidateQueries(['sedes'])}
        />
      )}
    </div>
  );
}
