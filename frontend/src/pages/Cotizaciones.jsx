import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { cotizacionesApi } from '../services/api';
import { BotonWhatsApp, BotonEnviarPdfWhatsApp } from '../components/WhatsAppButtons';
import { useIsMobile } from '../hooks/useIsMobile';
import { useIsMobileOrTablet } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';

const ESTADO_COLOR = {
  BORRADOR: '#64748b', ENVIADA: '#3b82f6', ACEPTADA: '#16a34a',
  RECHAZADA: '#dc2626', CONVERTIDA: '#8b5cf6',
};
const ESTADO_ICON = { BORRADOR:'📝', ENVIADA:'📤', ACEPTADA:'✅', RECHAZADA:'❌', CONVERTIDA:'💰' };
const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;
const badge = (color) => ({ display:'inline-block', padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:700, background:color+'20', color });

function ModalNuevaCotizacion({ onClose, onCreada, leadData }) {
  const isMobile = useIsMobileOrTablet();
  const [form, setForm] = useState({
    nombreCliente: leadData?.nombreCliente || '',
    telefonoCliente: leadData?.telefono || '',
    dniCe: leadData?.dniCe || '',
    marcaAuto: leadData?.marcaAuto || '',
    modeloAuto: leadData?.modeloAuto || '',
    anioAuto: leadData?.anioAuto || '',
    medidaLlanta: leadData?.medidaDetectada || '',
    marcaLlanta: leadData?.marcaLlanta || '',
    modeloLlanta: leadData?.modeloLlanta || '',
    cantidad: 4, precioUnit: leadData?.precioLlanta || '', descuento: '', notas: '',
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const crearMut = useMutation({
    mutationFn: () => cotizacionesApi.crear({ ...form, leadId: leadData?.id }),
    onSuccess: (data) => { toast.success(`Cotización ${data.numero} creada`); onCreada(data); onClose(); },
    onError: (e) => toast.error(e?.error || 'Error al crear'),
  });

  const inp = { width:'100%', padding:'9px 12px', fontSize:14, border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', color:'var(--color-text)' };
  const lbl = (txt) => <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{txt}</label>;
  const totalCalc = Math.max(0, parseFloat(form.precioUnit||0) * parseInt(form.cantidad||1) - parseFloat(form.descuento||0));

  return (
    <div
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:500, display:'flex',
        ...(isMobile ? { alignItems:'flex-end' } : { alignItems:'center', justifyContent:'center', padding:16 }),
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:'var(--color-surface)', width:'100%', overflowY:'auto',
          boxShadow:'var(--shadow-lg)',
          ...(isMobile
            ? { borderRadius:'20px 20px 0 0', maxHeight:'94dvh', padding:'0 0 calc(env(safe-area-inset-bottom, 0px) + 16px)' }
            : { borderRadius:14, maxWidth:560, maxHeight:'92dvh', padding:28 }),
        }}
        onClick={e=>e.stopPropagation()}
      >
        {isMobile && (
          <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'var(--color-border)' }} />
          </div>
        )}
        <div style={{ padding: isMobile ? '8px 16px 16px' : 0 }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700 }}>Nueva Cotización</div>
          {!isMobile && <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'var(--color-text-muted)', cursor:'pointer', padding:'4px 8px' }}>✕</button>}
        </div>

        <div style={{ fontSize:11, fontWeight:700, color:'#d4a900', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, borderBottom:'2px solid #f5c400', paddingBottom:5 }}>Cliente</div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'12px 14px', marginBottom:16 }}>
          <div>{lbl('Nombre')}<input style={inp} value={form.nombreCliente} onChange={set('nombreCliente')} placeholder="Juan Pérez" /></div>
          <div>{lbl('Teléfono')}<input style={inp} value={form.telefonoCliente} onChange={set('telefonoCliente')} placeholder="51987654321" /></div>
          <div>{lbl('DNI / CE')}<input style={inp} value={form.dniCe} onChange={set('dniCe')} placeholder="45678901" /></div>
          <div>{lbl('Vehículo (marca modelo)')}<input style={inp} value={`${form.marcaAuto||''} ${form.modeloAuto||''}`.trim()} onChange={e => { const p=e.target.value.split(' '); setForm(f=>({...f, marcaAuto:p[0]||'', modeloAuto:p.slice(1).join(' ')||''})); }} placeholder="Toyota Corolla" /></div>
        </div>

        <div style={{ fontSize:11, fontWeight:700, color:'#d4a900', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, borderBottom:'2px solid #f5c400', paddingBottom:5 }}>Producto</div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap:'12px 14px', marginBottom:14 }}>
          <div>{lbl('Medida')}<input style={inp} value={form.medidaLlanta} onChange={set('medidaLlanta')} placeholder="195/65R15" /></div>
          <div>{lbl('Marca')}<input style={inp} value={form.marcaLlanta} onChange={set('marcaLlanta')} placeholder="Michelin" /></div>
          <div style={{ gridColumn: isMobile ? '1 / -1' : undefined }}>{lbl('Modelo')}<input style={inp} value={form.modeloLlanta} onChange={set('modeloLlanta')} placeholder="Energy E3" /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px 14px', marginBottom:14 }}>
          <div>{lbl('Cantidad')}<input style={inp} type="number" min="1" value={form.cantidad} onChange={set('cantidad')} /></div>
          <div>{lbl('Precio unit. (S/)')}<input style={inp} type="number" value={form.precioUnit} onChange={set('precioUnit')} placeholder="380.00" /></div>
          <div>{lbl('Descuento (S/)')}<input style={inp} type="number" value={form.descuento} onChange={set('descuento')} placeholder="0" /></div>
        </div>

        {form.precioUnit && (
          <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 16px', marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>Total:</span>
            <span style={{ fontSize:20, fontWeight:900, color:'#16a34a' }}>{fmt(totalCalc)}</span>
          </div>
        )}

        <div style={{ marginBottom:20 }}>
          {lbl('Notas')}
          <textarea style={{ ...inp, height:60, resize:'vertical' }} value={form.notas} onChange={set('notas')} placeholder="Incluye instalación, garantía de fábrica..." />
        </div>

        <button
          onClick={() => crearMut.mutate()}
          disabled={crearMut.isPending || !form.medidaLlanta || !form.precioUnit}
          style={{ width:'100%', padding: isMobile ? '16px' : '13px', background: (!form.medidaLlanta||!form.precioUnit) ? '#e2e8f0' : '#f5c400', color:'#000', border:'none', borderRadius:10, fontSize: isMobile ? 16 : 15, fontWeight:900, cursor:'pointer' }}
        >
          {crearMut.isPending ? '⏳ Creando...' : '✅ Crear Cotización'}
        </button>
        </div>
      </div>
    </div>
  );
}

export default function Cotizaciones() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const { businessType } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', businessType, { estado, page }],
    queryFn: () => cotizacionesApi.listar({ estado, page, limit: 25 }),
    keepPreviousData: true,
  });

  const pdfMut = useMutation({
    mutationFn: (id) => cotizacionesApi.generarPdf(id),
    onSuccess: (d) => { if (d?.pdfUrl) window.open(d.pdfUrl, '_blank'); },
    onError: (e) => toast.error(e?.error || 'Error PDF'),
  });

  const convertirMut = useMutation({
    mutationFn: (id) => cotizacionesApi.convertirAVenta(id),
    onSuccess: (d) => { toast.success(`✅ Venta ${d.numero} creada`); qc.invalidateQueries(['cotizaciones']); navigate(`/ventas/${d.ventaId}`); },
    onError: (e) => toast.error(e?.error || 'Error al convertir'),
  });

  const cots = data?.data || [];
  const total = data?.total || 0;

  const FILTROS = [
    ['', 'Todas'], ['BORRADOR','📝 Borrador'],
    ['ACEPTADA','✅ Aceptada'], ['RECHAZADA','❌ Rechazada'], ['CONVERTIDA','💰 Convertida'],
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight:700 }}>Cotizaciones</div>
          <div style={{ fontSize:12, color:'var(--color-text-muted)', marginTop:2 }}>{total} cotizaciones</div>
        </div>
        <button onClick={() => navigate('/cotizaciones/nueva')} style={{ padding:'10px 20px', background:'#f5c400', color:'#000', border:'none', borderRadius:10, fontSize:14, fontWeight:800, cursor:'pointer' }}>
          + Nueva Cotización
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {FILTROS.map(([val, lbl]) => (
          <button key={val} onClick={() => { setEstado(val); setPage(1); }} style={{
            padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer',
            background: estado === val ? 'var(--color-primary)' : 'var(--color-surface)',
            color: estado === val ? '#000' : 'var(--color-text-muted)',
            border: `1.5px solid ${estado===val ? 'var(--color-primary)' : 'var(--color-border)'}`,
          }}>{lbl}</button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign:'center', padding:48, color:'var(--color-text-muted)' }}>⏳ Cargando...</div>
      ) : cots.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--color-text-muted)' }}>
          <div style={{ fontSize:44 }}>📋</div>
          <div style={{ marginTop:12, fontWeight:600 }}>Sin cotizaciones{estado ? ` en estado ${estado}` : ''}</div>
          <button onClick={() => navigate('/cotizaciones/nueva')} style={{ marginTop:16, padding:'10px 24px', background:'#f5c400', color:'#000', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' }}>
            Crear primera cotización
          </button>
        </div>
      ) : isMobile ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {cots.map(c => (
            <div key={c.id} style={{ background:'var(--color-surface)', borderRadius:12, padding:'14px 16px', border:`1px solid var(--color-border)`, borderLeft:`4px solid ${ESTADO_COLOR[c.estado]}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontWeight:700, color:'var(--color-primary)' }}>{c.numero}</span>
                <span style={badge(ESTADO_COLOR[c.estado])}>{ESTADO_ICON[c.estado]} {c.estado}</span>
              </div>
              <div style={{ fontSize:13, marginBottom:4 }}>{c.nombreCliente||'—'}</div>
              <div style={{ fontSize:12, color:'var(--color-text-muted)', marginBottom:8 }}>
                {c.medidaLlanta && <span>🛞 {c.medidaLlanta} {c.marcaLlanta||''} × {c.cantidad}</span>}
                {Array.isArray(c.items) && c.items.length > 1 && <span style={{ marginLeft:6, color:'var(--color-primary)', fontWeight:700 }}>+{c.items.length - 1} llanta(s) más</span>}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:800, fontSize:16, color:'#16a34a' }}>{fmt(c.precioTotal)}</span>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <button onClick={() => navigate(`/cotizaciones/${c.id}`)} style={{ padding:'10px 14px', fontSize:13, border:'none', borderRadius:8, background:'var(--color-primary)', color:'#000', fontWeight:700, cursor:'pointer' }}>👁️ Ver</button>
                  <button onClick={() => pdfMut.mutate(c.id)} style={{ padding:'10px 14px', fontSize:13, border:'1px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', cursor:'pointer' }}>📄 PDF</button>
                  {c.telefonoCliente && <BotonWhatsApp telefono={c.telefonoCliente} label="WhatsApp" style={{ padding:'10px 14px', fontSize:13 }} />}
                  {c.telefonoCliente && <BotonEnviarPdfWhatsApp telefono={c.telefonoCliente} tipo="cotización" pdfFn={() => cotizacionesApi.generarPdf(c.id)} style={{ padding:'10px 14px', fontSize:13 }} />}
                  {!c.venta && !['RECHAZADA','CONVERTIDA'].includes(c.estado) && (
                    <button onClick={() => { if(window.confirm('¿Convertir a venta?')) convertirMut.mutate(c.id); }} style={{ padding:'10px 14px', fontSize:13, background:'#f5c400', color:'#000', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer' }}>💰 Venta</button>
                  )}
                  {c.venta && <Link to={`/ventas/${c.venta.id}`} style={{ padding:'10px 14px', fontSize:13, background:'#8b5cf620', color:'#8b5cf6', border:'1px solid #8b5cf640', borderRadius:8, fontWeight:700, display:'inline-block' }}>Ver venta</Link>}
                </div>
              </div>
              <div style={{ fontSize:11, color:'var(--color-text-muted)', marginTop:6 }}>Vendedor: {c.usuario?.nombre} · {new Date(c.createdAt).toLocaleDateString('es-PE')}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', background:'var(--color-surface)', borderRadius:10, overflow:'hidden', boxShadow:'var(--shadow)' }}>
            <thead>
              <tr>{['N° Cotización','Cliente','Llanta','Cant.','Total','Estado','Vendedor','Fecha','Acciones'].map(h=>(
                <th key={h} style={{ textAlign:'left', padding:'10px 12px', fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', background:'var(--color-bg)', borderBottom:'1px solid var(--color-border)', whiteSpace:'nowrap' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {cots.map(c => (
                <tr key={c.id} onMouseEnter={e=>e.currentTarget.style.background='var(--color-bg)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <td style={{ padding:'10px 12px', fontWeight:700, color:'var(--color-primary)', fontSize:13 }}>{c.numero}</td>
                  <td style={{ padding:'10px 12px', fontSize:13 }}>
                    <div>{c.nombreCliente||'—'}</div>
                    {c.telefonoCliente && <div style={{ fontSize:11, color:'var(--color-text-muted)' }}>{c.telefonoCliente}</div>}
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:13 }}>
                    {c.medidaLlanta && <div style={{ fontWeight:600 }}>{c.medidaLlanta}</div>}
                    {c.marcaLlanta && <div style={{ fontSize:11, color:'var(--color-text-muted)' }}>{c.marcaLlanta} {c.modeloLlanta||''}</div>}
                    {Array.isArray(c.items) && c.items.length > 1 && <div style={{ fontSize:10, color:'var(--color-primary)', fontWeight:700 }}>+{c.items.length - 1} más</div>}
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:13, textAlign:'center' }}>{c.cantidad}</td>
                  <td style={{ padding:'10px 12px', fontWeight:700, color:'#16a34a' }}>{fmt(c.precioTotal)}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={badge(ESTADO_COLOR[c.estado])}>{ESTADO_ICON[c.estado]} {c.estado}</span>
                    {c.estado==='RECHAZADA' && c.motivoRechazo && <div style={{ fontSize:10, color:'#dc2626', marginTop:3, maxWidth:140, whiteSpace:'normal' }} title={c.motivoRechazo}>{c.motivoRechazo.slice(0,40)}{c.motivoRechazo.length>40?'…':''}</div>}
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:13 }}>{c.usuario?.nombre}</td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'var(--color-text-muted)' }}>{new Date(c.createdAt).toLocaleDateString('es-PE')}</td>
                  <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                    <button onClick={()=>navigate(`/cotizaciones/${c.id}`)} style={{ padding:'4px 10px', fontSize:11, border:'1px solid var(--color-primary)', borderRadius:6, background:'var(--color-primary)', color:'#000', cursor:'pointer', fontWeight:700, marginRight:4 }}>👁️ Ver</button>
                    <button onClick={()=>pdfMut.mutate(c.id)} style={{ padding:'4px 10px', fontSize:11, border:'1px solid var(--color-border)', borderRadius:6, background:'var(--color-surface)', cursor:'pointer', marginRight:4 }}>📄 PDF</button>
                    {c.telefonoCliente && <span style={{ marginRight:4, display:'inline-flex' }}><BotonWhatsApp telefono={c.telefonoCliente} label="" /></span>}
                    {c.telefonoCliente && <span style={{ marginRight:4, display:'inline-flex' }}><BotonEnviarPdfWhatsApp telefono={c.telefonoCliente} tipo="cotización" pdfFn={() => cotizacionesApi.generarPdf(c.id)} /></span>}
                    {!c.venta && !['RECHAZADA','CONVERTIDA'].includes(c.estado) && (
                      <button onClick={()=>{if(window.confirm(`¿Convertir ${c.numero} a venta?`))convertirMut.mutate(c.id);}}
                        style={{ padding:'4px 10px', fontSize:11, background:'#f5c400', color:'#000', border:'none', borderRadius:6, fontWeight:700, cursor:'pointer' }}>
                        💰 Convertir a venta
                      </button>
                    )}
                    {c.venta && <Link to={`/ventas/${c.venta.id}`} style={{ marginLeft:4, padding:'4px 10px', fontSize:11, background:'#8b5cf620', color:'#8b5cf6', border:'1px solid #8b5cf640', borderRadius:6, fontWeight:700 }}>Ver {c.venta.numero}</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 25 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16 }}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', fontSize:13, fontWeight:600 }}>← Anterior</button>
          <span style={{ padding:'8px 14px', fontSize:13, color:'var(--color-text-muted)' }}>Pág. {page}</span>
          <button onClick={()=>setPage(p=>p+1)} disabled={cots.length<25} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', fontSize:13, fontWeight:600 }}>Siguiente →</button>
        </div>
      )}

      {modal && <ModalNuevaCotizacion onClose={()=>setModal(false)} onCreada={()=>qc.invalidateQueries(['cotizaciones'])} />}
    </div>
  );
}
