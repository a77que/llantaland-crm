import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cotizacionesApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const S = {
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14, textTransform: 'uppercase' },
  btn: (c) => ({ padding: '8px 16px', background: c, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }),
  badge: (c) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: c + '20', color: c }),
};

export default function CotizacionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: cot, isLoading } = useQuery({
    queryKey: ['cotizacion', id],
    queryFn: () => cotizacionesApi.obtener(id),
  });

  const pdfMutation = useMutation({
    mutationFn: () => cotizacionesApi.generarPdf(id),
    onSuccess: (data) => { toast.success('PDF generado'); window.open(data.pdfUrl, '_blank'); qc.invalidateQueries(['cotizacion', id]); },
    onError: (e) => toast.error(e?.error || 'Error'),
  });

  const convertirMutation = useMutation({
    mutationFn: () => cotizacionesApi.convertir(id),
    onSuccess: (data) => { toast.success('Convertida a venta'); navigate(`/ventas/${data.id}`); },
    onError: (e) => toast.error(e?.error || 'Error'),
  });

  const waMutation = useMutation({
    mutationFn: () => cotizacionesApi.whatsapp(id),
    onSuccess: () => { toast.success('Marcado como enviado por WhatsApp'); qc.invalidateQueries(['cotizacion', id]); },
  });

  if (isLoading) return <LoadingSpinner fullPage />;
  if (!cot) return <div>Cotización no encontrada</div>;

  const ESTADO_COLORS = { BORRADOR: '#64748b', ENVIADA: '#2563eb', ACEPTADA: '#16a34a', RECHAZADA: '#dc2626', VENCIDA: '#9ca3af' };
  const nombre = cot.cliente?.razonSocial || `${cot.cliente?.nombre || ''} ${cot.cliente?.apellidos || ''}`.trim();

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(-1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>{cot.numero}</h1>
        <span style={S.badge(ESTADO_COLORS[cot.estado] || '#64748b')}>{cot.estado}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={S.btn('#64748b')} onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}>📄 PDF</button>
          {!cot.whatsappEnviado && <button style={S.btn('#25d366')} onClick={() => waMutation.mutate()}>📱 WhatsApp</button>}
          {cot.estado !== 'ACEPTADA' && cot.estado !== 'RECHAZADA' && (
            <button style={S.btn('#16a34a')} onClick={() => convertirMutation.mutate()} disabled={convertirMutation.isPending}>
              💰 Convertir a venta
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Datos del cliente</div>
            <div style={{ fontSize: 14 }}>
              <strong>{nombre}</strong><br />
              {cot.cliente?.tipoDoc}: {cot.cliente?.numDoc}<br />
              Cel: {cot.cliente?.celular || '—'}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Productos</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Producto</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Cant.</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>P. Unit.</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cot.items?.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{item.producto?.marca} {item.producto?.modelo}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.producto?.medida} • SKU: {item.producto?.sku}</div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{item.cantidad}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>S/ {parseFloat(item.precioUnit).toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>S/ {parseFloat(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Resumen</div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Subtotal (base)</span><span>S/ {parseFloat(cot.subtotal).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>IGV 18%</span><span>S/ {parseFloat(cot.igv).toFixed(2)}</span></div>
              {cot.descuentoValor && parseFloat(cot.descuentoValor) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>Descuento ({cot.descuentoTipo === 'PORCENTAJE' ? `${cot.descuentoValor}%` : 'S/' + cot.descuentoValor})</span>
                  <span>{cot.descuentoMotivo}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, borderTop: '2px solid var(--color-border)', paddingTop: 8, marginTop: 4 }}>
                <span>TOTAL</span><span style={{ color: 'var(--color-primary)' }}>S/ {parseFloat(cot.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Info</div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Vendedor: </span>{cot.usuario?.nombre}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Creada: </span>{new Date(cot.createdAt).toLocaleDateString('es-PE')}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>WhatsApp: </span>{cot.whatsappEnviado ? '✅ Enviado' : '—'}</div>
              {cot.pdfUrl && <a href={cot.pdfUrl} target="_blank" rel="noopener" style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>Ver PDF →</a>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
