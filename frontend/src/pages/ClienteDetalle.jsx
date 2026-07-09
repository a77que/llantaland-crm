import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { leadsApi, cotizacionesApi, ventasApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';
import { BotonWhatsApp, BotonEnviarPdfWhatsApp, abrirAsync as abrirPdf } from '../components/WhatsAppButtons';

const PASO_OPCIONES = [
  'nuevo','esperando_medida','esperando_version_auto','info_tecnica',
  'esperando_datos_cliente','esperando_eleccion_llanta','esperando_distrito',
  'esperando_eleccion_b','esperando_local_destino','esperando_confirmacion',
  'cotizado','completado','opt_out',
];
const PASO_LABEL = {
  nuevo:'Nuevo', esperando_medida:'Esperando medida', esperando_version_auto:'Versión auto',
  info_tecnica:'Info técnica', esperando_datos_cliente:'Datos cliente',
  esperando_eleccion_marca:'Eligiendo marca', esperando_eleccion_llanta:'Eligiendo llanta', esperando_distrito:'Eligiendo distrito',
  esperando_eleccion_b:'Eligiendo local', esperando_local_destino:'Local destino',
  esperando_confirmacion:'Confirmando', cotizado:'Cotizado', completado:'Completado', opt_out:'Opt-out',
};
const PASO_COLOR = {
  nuevo:'#64748b', esperando_medida:'#f59e0b', esperando_version_auto:'#f59e0b',
  info_tecnica:'#f59e0b', esperando_datos_cliente:'#3b82f6', esperando_eleccion_marca:'#3b82f6', esperando_eleccion_llanta:'#3b82f6',
  esperando_distrito:'#8b5cf6', esperando_eleccion_b:'#8b5cf6', esperando_local_destino:'#8b5cf6',
  esperando_confirmacion:'#f97316', cotizado:'#f97316', completado:'#22c55e', opt_out:'#ef4444',
};
const RANKING_ICON  = { caliente:'🔥', tibio:'🌡️', frio:'❄️' };
const RANKING_COLOR = { caliente:'#ef4444', tibio:'#f59e0b', frio:'#3b82f6' };
const ESTADO_VENTA  = { PENDIENTE:'#f59e0b', COMPLETADA:'#16a34a', ANULADA:'#dc2626' };
const ESTADO_COT    = { BORRADOR:'#64748b', ENVIADA:'#3b82f6', ACEPTADA:'#16a34a', RECHAZADA:'#dc2626', CONVERTIDA:'#8b5cf6' };
const fmt = (v) => `S/ ${parseFloat(v||0).toFixed(2)}`;
const badge = (color) => ({ display:'inline-block', padding:'2px 9px', borderRadius:10, fontSize:11, fontWeight:700, background:color+'22', color });

function InfoCard({ titulo, children }) {
  return (
    <div style={{ background:'var(--color-surface)', borderRadius:10, padding:18, border:'1px solid var(--color-border)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--color-primary)', textTransform:'uppercase', letterSpacing:1, marginBottom:12, paddingBottom:8, borderBottom:'2px solid #f5c400' }}>{titulo}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{children}</div>
    </div>
  );
}
function InfoRow({ label, value, mono, bold, color }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
      <span style={{ fontSize:12, color:'var(--color-text-muted)', fontWeight:600, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:13, fontFamily:mono?'monospace':undefined, fontWeight:bold?700:500, color:color||'var(--color-text)', textAlign:'right' }}>{String(value)}</span>
    </div>
  );
}

function FormEditar({ cliente, onGuardado, onCancel }) {
  const [form, setForm] = useState({
    nombreCliente:    cliente.nombreCliente    || '',
    dniCe:            cliente.dniCe            || '',
    marcaAuto:        cliente.marcaAuto        || '',
    modeloAuto:       cliente.modeloAuto       || '',
    anioAuto:         cliente.anioAuto         || '',
    medidaDetectada:  cliente.medidaDetectada  || '',
    marcaLlanta:      cliente.marcaLlanta      || '',
    modeloLlanta:     cliente.modeloLlanta     || '',
    distritoCliente:  cliente.distritoCliente  || '',
    provinciaDestino: cliente.provinciaDestino || '',
    ranking:          cliente.ranking          || '',
    pasoActual:       cliente.pasoActual       || 'nuevo',
    fechaCita:        cliente.fechaCita        || '',
    estadoLogistica:  cliente.estadoLogistica  || '',
    cantidadLlantas:  cliente.cantidadLlantas  || 4,
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const inp = { width:'100%', padding:'9px 12px', fontSize:14, border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', color:'var(--color-text)' };
  const lbl = (txt) => <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>{txt}</label>;
  const G2 = ({ children }) => <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 16px', marginBottom:16 }}>{children}</div>;
  const F = ({ l, k, type='text', opts }) => (
    <div>
      {lbl(l)}
      {opts
        ? <select style={inp} value={form[k]} onChange={set(k)}>
            {opts.map(([v,t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        : <input style={inp} type={type} value={form[k]} onChange={set(k)} />
      }
    </div>
  );

  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color:'#f5c400', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, borderBottom:'2px solid #f5c400', paddingBottom:5 }}>Datos personales</div>
      <G2><F l="Nombre completo" k="nombreCliente" /><F l="DNI / CE" k="dniCe" /></G2>

      <div style={{ fontSize:11, fontWeight:700, color:'#f5c400', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, borderBottom:'2px solid #f5c400', paddingBottom:5 }}>Vehículo</div>
      <G2>
        <F l="Marca auto" k="marcaAuto" /><F l="Modelo auto" k="modeloAuto" />
        <F l="Año" k="anioAuto" type="number" /><F l="Distrito" k="distritoCliente" />
        <F l="Provincia destino" k="provinciaDestino" />
      </G2>

      <div style={{ fontSize:11, fontWeight:700, color:'#f5c400', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, borderBottom:'2px solid #f5c400', paddingBottom:5 }}>Llanta de interés</div>
      <G2>
        <F l="Medida" k="medidaDetectada" /><F l="Marca llanta" k="marcaLlanta" />
        <F l="Modelo llanta" k="modeloLlanta" /><F l="Cantidad" k="cantidadLlantas" type="number" />
      </G2>

      <div style={{ fontSize:11, fontWeight:700, color:'#f5c400', textTransform:'uppercase', letterSpacing:1.5, marginBottom:10, borderBottom:'2px solid #f5c400', paddingBottom:5 }}>Estado</div>
      <G2>
        <F l="Paso actual" k="pasoActual" opts={PASO_OPCIONES.map(p=>[p,PASO_LABEL[p]||p])} />
        <F l="Ranking" k="ranking" opts={[['','Sin ranking'],['caliente','🔥 Caliente'],['tibio','🌡️ Tibio'],['frio','❄️ Frío']]} />
        <F l="Fecha cita" k="fechaCita" /><F l="Estado logística" k="estadoLogistica" />
      </G2>

      <div style={{ display:'flex', gap:10 }}>
        <button onClick={() => onGuardado(form)} style={{ flex:1, padding:'11px', background:'#f5c400', color:'#000', border:'none', borderRadius:8, fontSize:14, fontWeight:800, cursor:'pointer' }}>💾 Guardar</button>
        <button onClick={onCancel} style={{ padding:'11px 18px', border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', fontSize:13, cursor:'pointer' }}>Cancelar</button>
      </div>
    </div>
  );
}

export default function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('info');
  const [editando, setEditando] = useState(false);

  const { data: c, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => leadsApi.obtener(id),
  });

  const actualizarMut = useMutation({
    mutationFn: (data) => leadsApi.actualizar(id, data),
    onSuccess: () => { toast.success('Cliente actualizado'); setEditando(false); qc.invalidateQueries(['cliente', id]); qc.invalidateQueries(['clientes-lista']); },
    onError: (e) => toast.error(e?.error || 'Error al guardar'),
  });

  const eliminarMut = useMutation({
    mutationFn: () => leadsApi.eliminar(id),
    onSuccess: (resp) => {
      toast.success(resp?.mensaje || 'Cliente eliminado');
      navigate('/clientes');
    },
    onError: (e) => toast.error(e?.error || 'Error al eliminar'),
  });

  const confirmarEliminar = () => {
    const nombre = c?.nombreCliente || c?.telefono;
    if (window.confirm(`⚠️ ¿Eliminar a "${nombre}"?\n\nSus ventas y cotizaciones quedarán sin cliente asignado.\n\nEsta acción no se puede deshacer.`)) {
      eliminarMut.mutate();
    }
  };

  if (isLoading) return <div style={{ padding:24, textAlign:'center', color:'var(--color-text-muted)' }}>⏳ Cargando...</div>;
  if (!c)        return <div style={{ padding:24 }}>Cliente no encontrado</div>;

  const local  = c.localInstalacion || c.localAsignado;
  const nCots  = c.cotizaciones?.length  || 0;
  const nVentas = c.ventas?.length       || 0;
  const nMsgs  = c.historial?.length     || 0;
  const totalComprado = (c.ventas||[]).reduce((s,v)=>s+parseFloat(v.precioTotal||0),0);

  // Citas: la del propio lead + las que tengan fecha de instalación desde cotizaciones
  const citasCot = (c.cotizaciones||[]).filter(q => q.fechaInstalacion || q.fechaCita);
  const tieneCitaLead = c.fechaInstalacion || c.fechaCita || c.localInstalacion || c.localAsignado;
  const nCitas = (tieneCitaLead ? 1 : 0) + citasCot.length;

  // "Comprando ahora": tiene un producto de interés y aún no convirtió en venta
  const comprandoAhora = (c.medidaDetectada || c.marcaLlanta) && c.pasoActual !== 'completado';

  const irACotizar = () => navigate('/cotizaciones/nueva', { state: {
    leadId: c.id,
    cliente: { nombre: c.nombreCliente, telefono: c.telefono, dniCe: c.dniCe },
    vehiculo: { marca: c.marcaAuto, modelo: c.modeloAuto, anio: c.anioAuto },
    medida: c.medidaDetectada || '',
  } });

  const TABS = [
    { id:'info',   label:'📋 Información' },
    { id:'hist',   label:`💬 Chat (${nMsgs})` },
    { id:'cots',   label:`📄 Cotizaciones (${nCots})` },
    { id:'ventas', label:`💰 Ventas (${nVentas})` },
    { id:'citas',  label:`📅 Citas (${nCitas})` },
  ];

  return (
    <div style={{ maxWidth:860, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:16, flexWrap:'wrap' }}>
        <button onClick={()=>navigate(-1)} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-surface)', cursor:'pointer', fontSize:13, flexShrink:0 }}>← Volver</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:isMobile?17:20, fontWeight:700 }}>{c.nombreCliente||c.telefono}</span>
            <span style={badge(PASO_COLOR[c.pasoActual]||'#64748b')}>{PASO_LABEL[c.pasoActual]||c.pasoActual}</span>
            {c.ranking && <span style={{ fontWeight:700, color:RANKING_COLOR[c.ranking] }}>{RANKING_ICON[c.ranking]} {c.ranking}</span>}
          </div>
          <div style={{ fontSize:13, color:'var(--color-text-muted)', marginTop:3 }}>
            📞 {c.telefono} · Registrado {new Date(c.timestamp).toLocaleDateString('es-PE')}
            {nVentas > 0 && <span style={{ marginLeft:12, color:'#16a34a', fontWeight:700 }}>💰 {fmt(totalComprado)} en compras</span>}
          </div>
        </div>
        {!editando && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <BotonWhatsApp telefono={c.telefono} label="WhatsApp" size="lg" />
            <button onClick={()=>setEditando(true)} style={{ padding:'8px 16px', border:'1.5px solid #f5c400', borderRadius:8, background:'#fffbeb', color:'#d4a900', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              ✏️ Editar
            </button>
            {isAdmin && (
              <button
                onClick={confirmarEliminar}
                disabled={eliminarMut.isPending}
                style={{ padding:'8px 14px', border:'1px solid #fecaca', borderRadius:8, background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:700, cursor:'pointer' }}
                title="Eliminar cliente"
              >
                {eliminarMut.isPending ? '⏳' : '🗑️ Eliminar'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Comprando ahora / en proceso */}
      {!editando && (
        <div style={{ background: comprandoAhora ? '#fffbeb' : 'var(--color-surface)', border:`1.5px solid ${comprandoAhora ? '#fde68a' : 'var(--color-border)'}`, borderRadius:12, padding:'14px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:800, color: comprandoAhora ? '#b45309' : 'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>
              🛒 {comprandoAhora ? 'Comprando ahora / en proceso' : 'Sin compra en proceso'}
            </div>
            {comprandoAhora ? (
              <div style={{ fontSize:14, fontWeight:600 }}>
                {c.medidaDetectada && <span>🛞 {c.medidaDetectada}</span>}
                {c.marcaLlanta && <span> · {c.marcaLlanta} {c.modeloLlanta||''}</span>}
                {c.cantidadLlantas && <span> · ×{c.cantidadLlantas}</span>}
                {c.precioLlanta && <span style={{ color:'#16a34a' }}> · {fmt(c.precioLlanta)}</span>}
                <span style={{ marginLeft:8, fontSize:11, color:'var(--color-text-muted)' }}>({PASO_LABEL[c.pasoActual]||c.pasoActual})</span>
              </div>
            ) : (
              <div style={{ fontSize:13, color:'var(--color-text-muted)' }}>Genera una cotización nueva para este cliente cuando quieras.</div>
            )}
          </div>
          <button onClick={irACotizar} style={{ padding:'11px 18px', background:'#16a34a', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>
            📋 Generar cotización
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--color-border)', marginBottom:20, overflowX:'auto', scrollbarWidth:'none' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>{setTab(t.id);setEditando(false);}} style={{
            padding:'10px 14px', border:'none', background:'none', cursor:'pointer',
            fontSize:12.5, fontWeight:tab===t.id?700:500,
            color:tab===t.id?'var(--color-primary)':'var(--color-text-muted)',
            borderBottom:tab===t.id?'2px solid #f5c400':'2px solid transparent',
            marginBottom:-2, whiteSpace:'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* INFORMACIÓN */}
      {tab==='info' && (
        editando ? (
          <div style={{ background:'var(--color-surface)', borderRadius:12, padding:20, border:'1px solid var(--color-border)' }}>
            <FormEditar cliente={c} onGuardado={actualizarMut.mutate} onCancel={()=>setEditando(false)} />
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:14 }}>
            <InfoCard titulo="👤 Datos del cliente">
              <InfoRow label="Nombre"         value={c.nombreCliente} />
              <InfoRow label="Teléfono"       value={c.telefono}  mono />
              <InfoRow label="DNI / CE"       value={c.dniCe} />
              <InfoRow label="Primer contacto" value={new Date(c.timestamp).toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'})} />
            </InfoCard>
            <InfoCard titulo="🚗 Vehículo">
              <InfoRow label="Marca"    value={c.marcaAuto} />
              <InfoRow label="Modelo"   value={c.modeloAuto} />
              <InfoRow label="Año"      value={c.anioAuto} />
              <InfoRow label="Distrito" value={c.distritoCliente} />
              <InfoRow label="Provincia" value={c.provinciaDestino} />
            </InfoCard>
            <InfoCard titulo="🛞 Llanta de interés">
              <InfoRow label="Medida"    value={c.medidaDetectada} bold />
              <InfoRow label="Marca"     value={c.marcaLlanta} />
              <InfoRow label="Modelo"    value={c.modeloLlanta} />
              <InfoRow label="Cantidad"  value={c.cantidadLlantas} />
              {c.precioLlanta && <InfoRow label="Precio" value={fmt(c.precioLlanta)} color="#16a34a" bold />}
            </InfoCard>
            <InfoCard titulo="📍 Estado y logística">
              <InfoRow label="Paso actual"   value={PASO_LABEL[c.pasoActual]} />
              <InfoRow label="Agente humano" value={c.humanTakeover?.agenteActivo?'✅ Activo':'🤖 Bot'} />
              {local && <InfoRow label="Local asignado" value={local?.Nombre||local?.nombre} />}
              <InfoRow label="Fecha cita"    value={c.fechaCita} />
              <InfoRow label="Logística"     value={c.estadoLogistica} />
            </InfoCard>
          </div>
        )
      )}

      {/* CONVERSACIÓN */}
      {tab==='hist' && (
        <div style={{ background:'var(--color-surface)', borderRadius:12, padding:20, border:'1px solid var(--color-border)' }}>
          {!nMsgs ? (
            <div style={{ textAlign:'center', padding:40, color:'var(--color-text-muted)' }}>Sin mensajes registrados</div>
          ) : (
            <div style={{ maxHeight:isMobile?'60dvh':520, overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
              {c.historial.map((m,i) => (
                <div key={i} style={{
                  maxWidth:'84%', alignSelf:m.rol==='bot'?'flex-end':'flex-start',
                  background:m.rol==='bot'?'var(--color-primary)':'var(--color-bg)',
                  color:m.rol==='bot'?'#fff':'var(--color-text)',
                  padding:'9px 13px', borderRadius:12,
                  borderBottomRightRadius:m.rol==='bot'?3:12,
                  borderBottomLeftRadius: m.rol==='bot'?12:3,
                  fontSize:13,
                }}>
                  <div style={{ fontSize:9, opacity:.65, marginBottom:3 }}>
                    {m.rol==='bot'?'🤖 Bot':'👤 Cliente'} · {new Date(m.timestamp).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}
                    {m.pasoActual && <span style={{marginLeft:8,opacity:.7}}>— {PASO_LABEL[m.pasoActual]||m.pasoActual}</span>}
                  </div>
                  {m.mensaje}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COTIZACIONES */}
      {tab==='cots' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!nCots ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--color-text-muted)' }}><div style={{fontSize:36}}>📄</div><div style={{marginTop:10,fontWeight:600}}>Sin cotizaciones</div></div>
          ) : c.cotizaciones.map(q => (
            <div key={q.id} style={{ background:'var(--color-surface)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)', borderLeft:`4px solid ${ESTADO_COT[q.estado]||'#64748b'}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontWeight:700, color:'var(--color-primary)' }}>{q.numero}</span>
                <span style={badge(ESTADO_COT[q.estado]||'#64748b')}>{q.estado}</span>
              </div>
              {q.medidaLlanta && <div style={{ fontSize:13, color:'var(--color-text-muted)', marginBottom:6 }}>🛞 {q.medidaLlanta} {q.marcaLlanta||''} × {q.cantidad}</div>}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontWeight:800, fontSize:16, color:'#16a34a' }}>{fmt(q.precioTotal)}</span>
                <div style={{ display:'flex', gap:8, alignItems:'center', fontSize:12, color:'var(--color-text-muted)' }}>
                  <span>{q.usuario?.nombre} · {new Date(q.createdAt).toLocaleDateString('es-PE')}</span>
                  {q.venta && <Link to={`/ventas/${q.venta.id}`} style={{ padding:'3px 10px', background:'#8b5cf620', color:'#8b5cf6', border:'1px solid #8b5cf640', borderRadius:6, fontSize:11, fontWeight:700 }}>Ver venta →</Link>}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <Link to={`/cotizaciones/${q.id}`} style={{ padding:'7px 12px', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:8, fontSize:12, fontWeight:700, color:'var(--color-text)' }}>👁️ Ver</Link>
                <button onClick={()=>abrirPdf(()=>cotizacionesApi.generarPdf(q.id))} style={{ padding:'7px 12px', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', color:'var(--color-text)' }}>📄 PDF</button>
                {c.telefono && <BotonEnviarPdfWhatsApp telefono={c.telefono} tipo="cotización" pdfFn={()=>cotizacionesApi.generarPdf(q.id)} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VENTAS */}
      {tab==='ventas' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {!nVentas ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--color-text-muted)' }}><div style={{fontSize:36}}>💰</div><div style={{marginTop:10,fontWeight:600}}>Sin ventas registradas</div></div>
          ) : (
            <>
              {c.ventas.map(v => (
                <div key={v.id} style={{ background:'var(--color-surface)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)', borderLeft:`4px solid ${ESTADO_VENTA[v.estado]||'#64748b'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <Link to={`/ventas/${v.id}`} style={{ fontWeight:700, color:'var(--color-primary)', fontSize:14 }}>{v.numero}</Link>
                    <span style={badge(ESTADO_VENTA[v.estado]||'#64748b')}>{v.estado}</span>
                  </div>
                  {v.medidaLlanta && <div style={{ fontSize:13, color:'var(--color-text-muted)', marginBottom:6 }}>🛞 {v.medidaLlanta} {v.marcaLlanta||''} × {v.cantidad} {v.fechaCita&&<span style={{marginLeft:8}}>📅 {v.fechaCita}</span>}</div>}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <span style={{ fontWeight:900, fontSize:18, color:'#16a34a' }}>{fmt(v.precioTotal)}</span>
                    <span style={{ fontSize:12, color:'var(--color-text-muted)' }}>{v.usuario?.nombre} · {new Date(v.createdAt).toLocaleDateString('es-PE')}</span>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <Link to={`/ventas/${v.id}`} style={{ padding:'7px 12px', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:8, fontSize:12, fontWeight:700, color:'var(--color-text)' }}>👁️ Ver</Link>
                    <button onClick={()=>abrirPdf(()=>ventasApi.generarPdf(v.id))} style={{ padding:'7px 12px', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', color:'var(--color-text)' }}>📄 PDF</button>
                    {c.telefono && <BotonEnviarPdfWhatsApp telefono={c.telefono} tipo="comprobante" pdfFn={()=>ventasApi.generarPdf(v.id)} />}
                  </div>
                </div>
              ))}
              <div style={{ background:'var(--color-primary)', borderRadius:10, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ color:'rgba(255,255,255,.8)', fontSize:13, fontWeight:600 }}>Total invertido</span>
                <span style={{ color:'#f5c400', fontSize:22, fontWeight:900 }}>{fmt(totalComprado)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* CITAS */}
      {tab==='citas' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {nCitas === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'var(--color-text-muted)' }}><div style={{fontSize:36}}>📅</div><div style={{marginTop:10,fontWeight:600}}>Sin citas registradas</div></div>
          ) : (
            <>
              {tieneCitaLead && (
                <div style={{ background:'var(--color-surface)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)', borderLeft:'4px solid #f59e0b' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontWeight:700 }}>🗓️ Cita actual</span>
                    {c.estadoCita && <span style={badge(c.estadoCita==='ENTREGADO'?'#16a34a':c.estadoCita==='ATENDIDO'?'#f59e0b':'#3b82f6')}>{c.estadoCita}</span>}
                  </div>
                  <div style={{ fontSize:13, color:'var(--color-text)', display:'flex', flexDirection:'column', gap:3 }}>
                    {(local?.Nombre||local?.nombre) && <span>📍 {local.Nombre||local.nombre}</span>}
                    {c.fechaInstalacion && <span>📅 {new Date(c.fechaInstalacion).toLocaleDateString('es-PE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}{c.horaInstalacion?` · ${c.horaInstalacion}`:''}</span>}
                    {!c.fechaInstalacion && c.fechaCita && <span>📅 {c.fechaCita}</span>}
                    {c.medidaDetectada && <span style={{ color:'var(--color-text-muted)' }}>🛞 {c.medidaDetectada} {c.marcaLlanta||''}</span>}
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                    <BotonWhatsApp telefono={c.telefono} label="WhatsApp" />
                  </div>
                </div>
              )}
              {citasCot.map(q => (
                <div key={q.id} style={{ background:'var(--color-surface)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--color-border)', borderLeft:`4px solid ${ESTADO_COT[q.estado]||'#64748b'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                    <span style={{ fontWeight:700, color:'var(--color-primary)' }}>{q.numero}</span>
                    <span style={badge(ESTADO_COT[q.estado]||'#64748b')}>{q.estado}</span>
                  </div>
                  <div style={{ fontSize:13, color:'var(--color-text)' }}>
                    📅 {q.fechaInstalacion ? new Date(q.fechaInstalacion).toLocaleDateString('es-PE',{weekday:'long',day:'2-digit',month:'2-digit'}) : q.fechaCita}{q.horaInstalacion?` · ${q.horaInstalacion}`:''}
                    {q.medidaLlanta && <span style={{ color:'var(--color-text-muted)' }}> · 🛞 {q.medidaLlanta}</span>}
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                    <Link to={`/cotizaciones/${q.id}`} style={{ padding:'7px 12px', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:8, fontSize:12, fontWeight:700, color:'var(--color-text)' }}>👁️ Ver</Link>
                    <button onClick={()=>abrirPdf(()=>cotizacionesApi.generarPdf(q.id))} style={{ padding:'7px 12px', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', color:'var(--color-text)' }}>📄 PDF</button>
                    {c.telefono && <BotonEnviarPdfWhatsApp telefono={c.telefono} tipo="cita" pdfFn={()=>cotizacionesApi.generarPdf(q.id)} />}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
