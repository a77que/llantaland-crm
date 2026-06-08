import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ventasApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useIsMobile } from '../hooks/useIsMobile';

const ESTADO_COLOR = { PENDIENTE: '#ca8a04', COMPLETADA: '#16a34a', ANULADA: '#dc2626' };
const TIPO_ICON   = { whatsapp: '📱', tienda: '🏪', web: '🌐' };
const RANKING_ICON = { caliente: '🔥', tibio: '🌡️', frio: '❄️' };
const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;

function Campo({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--color-text)', fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 10, padding: 20, border: '1px solid var(--color-border)', marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #f5c400' }}>
        {titulo}
      </div>
      {children}
    </div>
  );
}

export default function VentaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data: venta, isLoading } = useQuery({
    queryKey: ['venta', id],
    queryFn: () => ventasApi.obtener(id),
  });

  const pdfMut = useMutation({
    mutationFn: () => ventasApi.generarPdf(id),
    onSuccess: (data) => {
      toast.success('PDF generado');
      if (data?.pdfUrl) window.open(data.pdfUrl, '_blank');
    },
    onError: (e) => toast.error(e?.error || 'Error al generar PDF'),
  });

  if (isLoading) return <LoadingSpinner fullPage />;
  if (!venta) return <div style={{ padding: 24 }}>Venta no encontrada</div>;

  const local = venta.localInstalacion;
  const gridStyle = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0 20px' };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: isMobile ? 0 : '0 4px' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(-1)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <h1 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700 }}>{venta.numero}</h1>
          <span style={{ fontSize: 14 }}>{TIPO_ICON[venta.tipoVenta] || ''}</span>
          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: (ESTADO_COLOR[venta.estado] || '#64748b') + '20', color: ESTADO_COLOR[venta.estado] || '#64748b' }}>
            {venta.estado}
          </span>
          {venta.rankingLead && <span style={{ fontSize: 14 }}>{RANKING_ICON[venta.rankingLead]}</span>}
        </div>
        <button
          onClick={() => pdfMut.mutate()}
          disabled={pdfMut.isPending}
          style={{ padding: '8px 16px', background: '#f5c400', color: '#000', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {pdfMut.isPending ? '⏳ Generando...' : '📄 Descargar PDF'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 14 }}>
        <div>
          {/* Cliente */}
          <Seccion titulo="👤 Datos del cliente">
            <div style={gridStyle}>
              <Campo label="Nombre" value={venta.nombreCliente} />
              <Campo label="DNI / CE" value={venta.dniCe} mono />
              <Campo label="Teléfono" value={venta.telefonoCliente} />
              <Campo label="Vehículo" value={[venta.marcaAuto, venta.modeloAuto, venta.anioAuto].filter(Boolean).join(' ')} />
            </div>
          </Seccion>

          {/* Llanta */}
          <Seccion titulo="🛞 Producto vendido">
            <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-primary)', marginBottom: 6 }}>
                {venta.medidaLlanta}
                {venta.marcaLlanta && <span style={{ fontWeight: 500, marginLeft: 10, color: 'var(--color-text-muted)', fontSize: 14 }}>{venta.marcaLlanta} {venta.modeloLlanta || ''}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 10 }}>
                <div style={{ textAlign: 'center', padding: '10px 8px', background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6' }}>{venta.cantidad}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Unidades</div>
                </div>
                <div style={{ textAlign: 'center', padding: '10px 8px', background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(venta.precioUnit)}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Precio unit.</div>
                </div>
                <div style={{ textAlign: 'center', padding: '10px 8px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{fmt(venta.precioTotal)}</div>
                  <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>Total</div>
                </div>
              </div>
            </div>
          </Seccion>

          {/* Logística */}
          {(local || venta.fechaCita || venta.estadoLogistica) && (
            <Seccion titulo="📍 Instalación y logística">
              <div style={gridStyle}>
                <Campo label="Local de instalación" value={local?.Nombre || local?.nombre} />
                <Campo label="Dirección" value={local?.Direccion || local?.direccion || venta.direccionLocal} />
                <Campo label="Fecha de cita" value={venta.fechaCita} />
                <Campo label="Estado logística" value={venta.estadoLogistica} />
                <Campo label="Provincia destino" value={venta.provinciaDestino} />
                <Campo label="Tipo" value={venta.esTraslado ? 'Traslado entre tiendas' : 'Stock directo'} />
              </div>
            </Seccion>
          )}

          {/* Items de inventario (si existen) */}
          {venta.items?.length > 0 && (
            <Seccion titulo="📦 Items de inventario">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)' }}>
                    {['Producto', 'Sede', 'Cant.', 'P.Unit', 'Subtotal'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {venta.items.map(item => (
                    <tr key={item.id}>
                      <td style={{ padding: '9px 10px' }}>{item.producto?.marca} {item.producto?.nombreComercial || ''}<br /><span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.producto?.medida}</span></td>
                      <td style={{ padding: '9px 10px', fontSize: 12 }}>{item.sede?.nombre}</td>
                      <td style={{ padding: '9px 10px' }}>{item.cantidad}</td>
                      <td style={{ padding: '9px 10px' }}>{fmt(item.precioUnit)}</td>
                      <td style={{ padding: '9px 10px', fontWeight: 700 }}>{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Seccion>
          )}
        </div>

        {/* Panel derecho */}
        <div>
          <Seccion titulo="ℹ️ Información">
            <Campo label="Número" value={venta.numero} mono />
            <Campo label="Canal" value={venta.tipoVenta === 'whatsapp' ? '📱 WhatsApp' : venta.tipoVenta === 'tienda' ? '🏪 Tienda' : venta.tipoVenta} />
            <Campo label="Caso" value={venta.caso ? `Caso ${venta.caso}` : null} />
            <Campo label="Ranking lead" value={venta.rankingLead ? `${RANKING_ICON[venta.rankingLead]} ${venta.rankingLead}` : null} />
            <Campo label="Vendedor" value={venta.usuario?.nombre} />
            <Campo label="Fecha" value={new Date(venta.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })} />
          </Seccion>

          {/* Total grande */}
          <div style={{ background: 'var(--color-primary)', borderRadius: 10, padding: '18px 20px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Total venta</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#f5c400' }}>{fmt(venta.precioTotal)}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>{venta.cantidad} unid. × {fmt(venta.precioUnit)}</div>
          </div>

          {/* Comprobantes */}
          {venta.comprobantes?.length > 0 && (
            <Seccion titulo="🧾 Comprobantes SUNAT">
              {venta.comprobantes.map(c => (
                <div key={c.id} style={{ padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--color-border)', fontSize: 13 }}>
                  <strong>{c.tipo}</strong> {c.serie}-{c.correlativo}
                  <span style={{ float: 'right', fontSize: 11, color: 'var(--color-text-muted)' }}>{c.estado}</span>
                </div>
              ))}
            </Seccion>
          )}
        </div>
      </div>
    </div>
  );
}
