import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ventasApi, sunatApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const S = {
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14, textTransform: 'uppercase' },
  btn: (c) => ({ padding: '8px 16px', background: c, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }),
  badge: (c) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: c + '20', color: c }),
};

const ESTADO_COLORS = { PENDIENTE: '#ca8a04', COMPLETADA: '#16a34a', ANULADA: '#dc2626' };

export default function VentaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: venta, isLoading } = useQuery({
    queryKey: ['venta', id],
    queryFn: () => ventasApi.obtener(id),
  });

  const pdfMutation = useMutation({
    mutationFn: () => ventasApi.generarPdf(id),
    onSuccess: (data) => { toast.success('PDF generado'); window.open(data.pdfUrl, '_blank'); qc.invalidateQueries(['venta', id]); },
    onError: (e) => toast.error(e?.error || 'Error'),
  });

  const facturarMutation = useMutation({
    mutationFn: () => sunatApi.emitir(id),
    onSuccess: (data) => toast(data.mensaje || 'Procesando...'),
    onError: (e) => toast.error(e?.error || 'Error'),
  });

  if (isLoading) return <LoadingSpinner fullPage />;
  if (!venta) return <div>Venta no encontrada</div>;

  const nombre = venta.cliente?.razonSocial || `${venta.cliente?.nombre || ''} ${venta.cliente?.apellidos || ''}`.trim();

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(-1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>{venta.numero}</h1>
        <span style={S.badge(ESTADO_COLORS[venta.estado] || '#64748b')}>{venta.estado}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={S.btn('#64748b')} onClick={() => pdfMutation.mutate()} disabled={pdfMutation.isPending}>📄 PDF</button>
          <button style={S.btn('#1a3c5e')} onClick={() => facturarMutation.mutate()} disabled={facturarMutation.isPending}>
            🧾 {facturarMutation.isPending ? 'Procesando...' : 'Emitir comprobante'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Cliente</div>
            <div style={{ fontSize: 14 }}>
              <strong>{nombre}</strong><br />
              {venta.cliente?.tipoDoc}: {venta.cliente?.numDoc}<br />
              Cel: {venta.cliente?.celular || '—'}<br />
              {venta.cliente?.email}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Productos vendidos</div>
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
                {venta.items?.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{item.producto?.marca} {item.producto?.modelo}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.producto?.medida} • {item.sede?.nombre}</div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{item.cantidad}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>S/ {parseFloat(item.precioUnit).toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>S/ {parseFloat(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Comprobantes */}
          {venta.comprobantes?.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>Comprobantes SUNAT</div>
              {venta.comprobantes.map((c) => (
                <div key={c.id} style={{ fontSize: 13, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 8 }}>
                  <strong>{c.tipo}</strong> {c.serie}-{c.correlativo} — Estado: {c.estado}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Totales</div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Subtotal (base)</span><span>S/ {parseFloat(venta.subtotal).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>IGV 18%</span><span>S/ {parseFloat(venta.igv).toFixed(2)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, borderTop: '2px solid var(--color-border)', paddingTop: 8, marginTop: 4 }}>
                <span>TOTAL</span><span style={{ color: 'var(--color-primary)' }}>S/ {parseFloat(venta.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Información</div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Vendedor: </span>{venta.usuario?.nombre}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Fecha: </span>{new Date(venta.createdAt).toLocaleDateString('es-PE')}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Método de pago: </span>{venta.metodoPago || '—'}</div>
              {venta.cotizacion && <div><span style={{ color: 'var(--color-text-muted)' }}>De cotización: </span>{venta.cotizacion.numero}</div>}
              {venta.pdfUrl && <a href={venta.pdfUrl} target="_blank" rel="noopener" style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>Ver PDF →</a>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
