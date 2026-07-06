import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cotizacionesApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { BotonWhatsApp, BotonEnviarPdfWhatsApp } from '../components/WhatsAppButtons';
import { useIsMobile } from '../hooks/useIsMobile';

const ESTADO_COLORS = { BORRADOR: '#64748b', ENVIADA: '#2563eb', ACEPTADA: '#16a34a', RECHAZADA: '#dc2626', CONVERTIDA: '#8b5cf6' };
const ESTADO_ICON = { BORRADOR: '📝', ENVIADA: '📤', ACEPTADA: '✅', RECHAZADA: '❌', CONVERTIDA: '💰' };
const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function fmtDiaFecha(d) {
  if (!d) return null;
  const f = new Date(d); if (isNaN(f)) return null;
  return `${DIAS[f.getDay()]} ${f.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

const S = {
  card: { background: 'var(--color-surface)', borderRadius: 10, padding: 20, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14, textTransform: 'uppercase' },
  btn: (c) => ({ padding: '8px 16px', background: c, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }),
  badge: (c) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: c + '20', color: c }),
  input: { width: '100%', padding: '8px 10px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, background: 'var(--color-surface)', color: 'var(--color-text)' },
  label: { fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, display: 'block' },
};

function itemsDe(cot) {
  if (Array.isArray(cot.items) && cot.items.length > 0) return cot.items;
  return [{ medida: cot.medidaLlanta, marca: cot.marcaLlanta, modelo: cot.modeloLlanta, cantidad: cot.cantidad || 1, precioUnit: parseFloat(cot.precioUnit || 0) }];
}

// ── Modal Denegar ──
function ModalDenegar({ cot, onClose, onConfirmar }) {
  const [motivo, setMotivo] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, maxWidth: 420, width: '100%', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>❌ Denegar {cot.numero}</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>El motivo es obligatorio: indica por qué se deniega esta cotización.</div>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus placeholder="Ej: precio alto, eligió otra marca, no concretó..."
          style={{ width: '100%', height: 90, resize: 'vertical', padding: '10px 12px', fontSize: 14, border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text)' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--color-text)' }}>Cancelar</button>
          <button onClick={() => onConfirmar(motivo)} disabled={!motivo.trim()} style={{ flex: 1, padding: '11px', background: motivo.trim() ? '#dc2626' : 'var(--color-surface2)', color: motivo.trim() ? '#fff' : 'var(--color-text-muted)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: motivo.trim() ? 'pointer' : 'default' }}>Denegar</button>
        </div>
      </div>
    </div>
  );
}

export default function CotizacionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [editando, setEditando] = useState(false);
  const [denegar, setDenegar] = useState(false);
  const [form, setForm] = useState(null);

  const { data: cot, isLoading } = useQuery({
    queryKey: ['cotizacion', id],
    queryFn: () => cotizacionesApi.obtener(id),
  });

  const pdfMutation = useMutation({
    mutationFn: () => cotizacionesApi.generarPdf(id),
    onSuccess: (data) => { window.open(data.pdfUrl, '_blank'); },
    onError: (e) => toast.error(e?.error || 'Error al generar PDF'),
  });

  const convertirMutation = useMutation({
    mutationFn: () => cotizacionesApi.convertirAVenta(id),
    onSuccess: (data) => { toast.success('Convertida a venta'); navigate(`/ventas/${data.ventaId}`); },
    onError: (e) => toast.error(e?.error || 'Error al convertir'),
  });

  const guardarMutation = useMutation({
    mutationFn: (payload) => cotizacionesApi.actualizar(id, payload),
    onSuccess: () => { toast.success('Cotización actualizada'); qc.invalidateQueries(['cotizacion', id]); qc.invalidateQueries(['cotizaciones']); setEditando(false); },
    onError: (e) => toast.error(e?.error || 'Error al actualizar'),
  });

  const denegarMutation = useMutation({
    mutationFn: (motivo) => cotizacionesApi.actualizar(id, { estado: 'RECHAZADA', motivoRechazo: motivo }),
    onSuccess: () => { toast.success('Cotización denegada'); qc.invalidateQueries(['cotizacion', id]); qc.invalidateQueries(['cotizaciones']); setDenegar(false); },
    onError: (e) => toast.error(e?.error || 'Error al denegar'),
  });

  if (isLoading) return <LoadingSpinner fullPage />;
  if (!cot) return <div style={{ padding: 24 }}>Cotización no encontrada</div>;

  const items = itemsDe(cot);
  const diaFecha = fmtDiaFecha(cot.fechaInstalacion);
  const local = cot.localInstalacion;
  const localNombre = local?.Nombre || local?.nombre || null;
  const editable = !['RECHAZADA', 'CONVERTIDA'].includes(cot.estado);

  // ── Iniciar edición ──
  const empezarEdicion = () => {
    setForm({
      nombreCliente: cot.nombreCliente || '', telefonoCliente: cot.telefonoCliente || '', dniCe: cot.dniCe || '',
      marcaAuto: cot.marcaAuto || '', modeloAuto: cot.modeloAuto || '', anioAuto: cot.anioAuto || '',
      descuento: cot.descuento ? String(cot.descuento) : '', notas: cot.notas || '',
      items: items.map(it => ({ ...it })),
    });
    setEditando(true);
  };
  const setF = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setItem = (i, k, v) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { medida: '', marca: '', modelo: '', cantidad: 4, precioUnit: 0 }] }));
  const delItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const guardar = () => {
    if (!form.items.length) { toast.error('Agrega al menos una llanta'); return; }
    guardarMutation.mutate({
      nombreCliente: form.nombreCliente, telefonoCliente: form.telefonoCliente, dniCe: form.dniCe,
      marcaAuto: form.marcaAuto, modeloAuto: form.modeloAuto, anioAuto: form.anioAuto ? parseInt(form.anioAuto) : null,
      descuento: form.descuento || 0, notas: form.notas,
      items: form.items.map(it => ({ ...it, cantidad: parseInt(it.cantidad) || 1, precioUnit: parseFloat(it.precioUnit) || 0 })),
    });
  };

  const totalEdit = form ? form.items.reduce((a, it) => a + (parseFloat(it.precioUnit) || 0) * (parseInt(it.cantidad) || 1), 0) - parseFloat(form.descuento || 0) : 0;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(-1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>{cot.numero}</h1>
        <span style={S.badge(ESTADO_COLORS[cot.estado] || '#64748b')}>{ESTADO_ICON[cot.estado]} {cot.estado}</span>
      </div>

      {/* Barra de acciones */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button style={S.btn('#64748b')} onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}>📄 PDF</button>
        {cot.telefonoCliente && <BotonWhatsApp telefono={cot.telefonoCliente} label="WhatsApp" size="lg" />}
        {cot.telefonoCliente && <BotonEnviarPdfWhatsApp telefono={cot.telefonoCliente} tipo="cotización" pdfFn={() => cotizacionesApi.generarPdf(id)} size="lg" />}
        {editable && !editando && <button style={S.btn('#2563eb')} onClick={empezarEdicion}>✏️ Editar</button>}
        {editable && !cot.venta && <button style={S.btn('#16a34a')} onClick={() => { if (window.confirm(`¿Convertir ${cot.numero} a venta?`)) convertirMutation.mutate(); }} disabled={convertirMutation.isPending}>💰 Convertir a venta</button>}
        {editable && <button style={S.btn('#dc2626')} onClick={() => setDenegar(true)}>🚫 Denegar</button>}
        {cot.venta && <button style={S.btn('#8b5cf6')} onClick={() => navigate(`/ventas/${cot.venta.id}`)}>Ver venta {cot.venta.numero} →</button>}
      </div>

      {/* Motivo de rechazo */}
      {cot.estado === 'RECHAZADA' && cot.motivoRechazo && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
          <strong style={{ color: '#dc2626' }}>❌ Motivo de la denegación:</strong> <span style={{ color: 'var(--color-text)' }}>{cot.motivoRechazo}</span>
        </div>
      )}

      <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        <div>
          {/* Cliente */}
          <div style={S.card}>
            <div style={S.cardTitle}>Datos del cliente</div>
            {!editando ? (
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                <strong>{cot.nombreCliente || 'Sin nombre'}</strong><br />
                {cot.dniCe && <>DNI/CE: {cot.dniCe}<br /></>}
                {cot.telefonoCliente && <>Tel: {cot.telefonoCliente}<br /></>}
                {[cot.marcaAuto, cot.modeloAuto, cot.anioAuto].filter(Boolean).length > 0 && <>🚗 {[cot.marcaAuto, cot.modeloAuto, cot.anioAuto].filter(Boolean).join(' ')}</>}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div><label style={S.label}>Nombre / Razón social</label><input style={S.input} value={form.nombreCliente} onChange={setF('nombreCliente')} /></div>
                <div><label style={S.label}>Teléfono</label><input style={S.input} value={form.telefonoCliente} onChange={setF('telefonoCliente')} /></div>
                <div><label style={S.label}>DNI / CE</label><input style={S.input} value={form.dniCe} onChange={setF('dniCe')} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 6 }}>
                  <div><label style={S.label}>Marca auto</label><input style={S.input} value={form.marcaAuto} onChange={setF('marcaAuto')} /></div>
                  <div><label style={S.label}>Modelo</label><input style={S.input} value={form.modeloAuto} onChange={setF('modeloAuto')} /></div>
                  <div><label style={S.label}>Año</label><input style={S.input} value={form.anioAuto} onChange={setF('anioAuto')} /></div>
                </div>
              </div>
            )}
          </div>

          {/* Llantas */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ ...S.cardTitle, marginBottom: 0 }}>Llantas</div>
              {editando && <button onClick={addItem} style={{ padding: '5px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Agregar llanta</button>}
            </div>
            {!editando ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Llanta</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Cant.</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>P. Unit.</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '10px' }}><div style={{ fontWeight: 600 }}>{it.marca} {it.modelo || ''}</div><div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{it.medida}{it.sku ? ` • ${it.sku}` : ''}</div></td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>{it.cantidad}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{fmt(it.precioUnit)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{fmt((parseFloat(it.precioUnit) || 0) * (parseInt(it.cantidad) || 1))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.items.map((it, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1.3fr 1.3fr 1fr 70px 90px 30px', gap: 6, alignItems: 'end', padding: 10, background: 'var(--color-bg)', borderRadius: 8 }}>
                    <div><label style={S.label}>Marca</label><input style={S.input} value={it.marca || ''} onChange={e => setItem(i, 'marca', e.target.value)} /></div>
                    <div><label style={S.label}>Modelo</label><input style={S.input} value={it.modelo || ''} onChange={e => setItem(i, 'modelo', e.target.value)} /></div>
                    <div><label style={S.label}>Medida</label><input style={S.input} value={it.medida || ''} onChange={e => setItem(i, 'medida', e.target.value)} /></div>
                    <div><label style={S.label}>Cant.</label><input style={S.input} type="number" min={1} value={it.cantidad} onChange={e => setItem(i, 'cantidad', e.target.value)} /></div>
                    <div><label style={S.label}>P. Unit.</label><input style={S.input} type="number" min={0} value={it.precioUnit} onChange={e => setItem(i, 'precioUnit', e.target.value)} /></div>
                    <button onClick={() => delItem(i)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 18, cursor: 'pointer', paddingBottom: 6 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas / descuento (edición) */}
          {editando && (
            <div style={S.card}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '160px 1fr', gap: 12 }}>
                <div><label style={S.label}>Descuento S/</label><input style={S.input} type="number" min={0} value={form.descuento} onChange={setF('descuento')} /></div>
                <div><label style={S.label}>Notas</label><input style={S.input} value={form.notas} onChange={setF('notas')} /></div>
              </div>
            </div>
          )}

          {/* Cita */}
          {(diaFecha || localNombre) && !editando && (
            <div style={S.card}>
              <div style={S.cardTitle}>🗓️ Cita de instalación</div>
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                {localNombre && <>📍 <strong>{localNombre}</strong><br /></>}
                {diaFecha && <>{diaFecha}{cot.horaInstalacion ? ` a las ${cot.horaInstalacion}` : ''}</>}
                {cot.provinciaDestino && <><br />🗺️ {cot.provinciaDestino}</>}
              </div>
            </div>
          )}
        </div>

        {/* Resumen lateral */}
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Resumen</div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!editando && cot.descuento && parseFloat(cot.descuento) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Descuento</span><span>- {fmt(cot.descuento)}</span></div>
              )}
              {!editando && cot.cargoAdicional && parseFloat(cot.cargoAdicional) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}><span>Recargo (tarjeta/traslado)</span><span>+ {fmt(cot.cargoAdicional)}</span></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, borderTop: '2px solid var(--color-border)', paddingTop: 8 }}>
                <span>TOTAL</span><span style={{ color: 'var(--color-primary)' }}>{fmt(editando ? totalEdit : cot.precioTotal)}</span>
              </div>
            </div>
            {editando && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setEditando(false)} style={{ flex: 1, padding: '10px', background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--color-text)' }}>Cancelar</button>
                <button onClick={guardar} disabled={guardarMutation.isPending} style={{ flex: 1, padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{guardarMutation.isPending ? 'Guardando...' : '💾 Guardar'}</button>
              </div>
            )}
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Info</div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Vendedor: </span>{cot.usuario?.nombre || '—'}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Creada: </span>{new Date(cot.createdAt).toLocaleDateString('es-PE')}</div>
            </div>
          </div>
        </div>
      </div>

      {denegar && <ModalDenegar cot={cot} onClose={() => setDenegar(false)} onConfirmar={(m) => denegarMutation.mutate(m)} />}
    </div>
  );
}
