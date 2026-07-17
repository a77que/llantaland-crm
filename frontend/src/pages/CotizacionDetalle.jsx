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
  const [denegar, setDenegar] = useState(false);

  const { data: cot, isLoading } = useQuery({
    queryKey: ['cotizacion', id],
    queryFn: () => cotizacionesApi.obtener(id),
  });

  const pdfMutation = useMutation({
    mutationFn: () => cotizacionesApi.generarPdf(id),
    onError: (e) => toast.error(e?.error || 'Error al generar PDF'),
  });
  // Abre la pestaña ANTES de esperar el PDF (dentro del gesto del usuario) para
  // que el navegador no la bloquee como pop-up; se redirige cuando está listo.
  const verPdf = () => {
    const win = window.open('', '_blank');
    pdfMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (!data?.pdfUrl) { if (win && !win.closed) win.close(); return; }
        if (win && !win.closed) win.location.href = data.pdfUrl;
        else window.location.href = data.pdfUrl;
      },
      onError: () => { if (win && !win.closed) win.close(); },
    });
  };

  const convertirMutation = useMutation({
    mutationFn: () => cotizacionesApi.convertirAVenta(id),
    onSuccess: (data) => { toast.success('Convertida a venta'); navigate(`/ventas/${data.ventaId}`); },
    onError: (e) => toast.error(e?.error || 'Error al convertir'),
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
        <button style={S.btn('#64748b')} onClick={verPdf} disabled={pdfMutation.isPending}>📄 PDF</button>
        {cot.telefonoCliente && <BotonWhatsApp telefono={cot.telefonoCliente} label="WhatsApp" size="lg" />}
        {cot.telefonoCliente && <BotonEnviarPdfWhatsApp telefono={cot.telefonoCliente} tipo="cotización" pdfFn={() => cotizacionesApi.generarPdf(id)} size="lg" />}
        {editable && <button style={S.btn('#2563eb')} onClick={() => navigate(`/cotizaciones/${id}/editar`)}>✏️ Editar</button>}
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

      {/* minmax(0, 1fr) en vez de 1fr: evita que la tabla de llantas empuje
          la columna de resumen fuera de pantalla en anchos de laptop. */}
      <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>
        <div>
          {/* Cliente */}
          <div style={S.card}>
            <div style={S.cardTitle}>Datos del cliente</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
              <strong>{cot.nombreCliente || 'Sin nombre'}</strong><br />
              {cot.dniCe && <>DNI/CE: {cot.dniCe}<br /></>}
              {cot.telefonoCliente && <>Tel: {cot.telefonoCliente}<br /></>}
              {[cot.marcaAuto, cot.modeloAuto, cot.anioAuto].filter(Boolean).length > 0 && <>🚗 {[cot.marcaAuto, cot.modeloAuto, cot.anioAuto].filter(Boolean).join(' ')}</>}
            </div>
          </div>

          {/* Llantas */}
          <div style={S.card}>
            <div style={S.cardTitle}>Llantas</div>
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
          </div>

          {cot.notas && (
            <div style={S.card}>
              <div style={S.cardTitle}>Notas</div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--color-text)' }}>{cot.notas}</div>
            </div>
          )}

          {/* Cita */}
          {(diaFecha || localNombre || cot.provinciaDestino) && (
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
              {cot.descuento && parseFloat(cot.descuento) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Descuento</span><span>- {fmt(cot.descuento)}</span></div>
              )}
              {cot.cargoAdicional && parseFloat(cot.cargoAdicional) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}><span>Recargo (tarjeta/traslado)</span><span>+ {fmt(cot.cargoAdicional)}</span></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, borderTop: '2px solid var(--color-border)', paddingTop: 8 }}>
                <span>TOTAL</span><span style={{ color: 'var(--color-primary)' }}>{fmt(cot.precioTotal)}</span>
              </div>
            </div>
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
