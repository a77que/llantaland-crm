import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ventasApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';

const ESTADO_COLOR = { PENDIENTE: '#ca8a04', COMPLETADA: '#16a34a', ANULADA: '#dc2626' };
const TIPO_ICON = { whatsapp: '📱', tienda: '🏪', web: '🌐' };

const badge = (color) => ({ display: 'inline-block', padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + '22', color });
const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;

export default function Ventas() {
  const isMobile = useIsMobile();
  const [estado, setEstado] = useState('');
  const [tipoVenta, setTipoVenta] = useState('');
  const [page, setPage] = useState(1);
  const { businessType } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['ventas', businessType, { estado, tipoVenta, page }],
    queryFn: () => ventasApi.listar({ estado, tipoVenta, page, limit: 25 }),
    keepPreviousData: true,
  });

  const ventas = data?.data || [];
  const total = data?.total || 0;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700 }}>Ventas</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{total} registros</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select
          style={{ flex: '1 1 130px', padding: '10px 12px', fontSize: 13, border: '1.5px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface)', color: 'var(--color-text)' }}
          value={estado}
          onChange={e => { setEstado(e.target.value); setPage(1); }}
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="COMPLETADA">Completada</option>
          <option value="ANULADA">Anulada</option>
        </select>
        <select
          style={{ flex: '1 1 130px', padding: '10px 12px', fontSize: 13, border: '1.5px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface)', color: 'var(--color-text)' }}
          value={tipoVenta}
          onChange={e => { setTipoVenta(e.target.value); setPage(1); }}
        >
          <option value="">Todos los canales</option>
          <option value="whatsapp">📱 WhatsApp</option>
          <option value="tienda">🏪 Tienda</option>
        </select>
      </div>

      {isLoading ? <LoadingSpinner fullPage /> : ventas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 44 }}>💰</div>
          <div style={{ marginTop: 12, fontWeight: 600 }}>Sin ventas registradas</div>
        </div>
      ) : isMobile ? (
        /* ── Cards en móvil ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ventas.map(v => {
            const color = ESTADO_COLOR[v.estado] || '#64748b';
            const clienteNombre = v.lead?.nombreCliente || v.nombreCliente || '—';
            return (
              <Link key={v.id} to={`/ventas/${v.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--color-surface)', borderRadius: 12,
                  padding: '13px 15px', border: '1px solid var(--color-border)',
                  borderLeft: `4px solid ${color}`,
                }}>
                  {/* Fila 1 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light)' }}>{v.numero}</span>
                      <span style={{ marginLeft: 8, fontSize: 14 }}>{TIPO_ICON[v.tipoVenta] || ''}</span>
                    </div>
                    <span style={badge(color)}>{v.estado}</span>
                  </div>

                  {/* Fila 2: cliente + llanta */}
                  <div style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 4 }}>
                    {clienteNombre !== '—' && <span>👤 {clienteNombre}</span>}
                    {v.medidaLlanta && <span style={{ marginLeft: clienteNombre !== '—' ? 12 : 0 }}>🛞 {v.medidaLlanta}</span>}
                    {v.marcaLlanta && <span style={{ marginLeft: 8, color: 'var(--color-text-muted)', fontSize: 12 }}>{v.marcaLlanta}</span>}
                  </div>

                  {/* Fila 3: precio + fecha + vendedor */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#16a34a' }}>{fmt(v.precioTotal || v.total)}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {v.usuario?.nombre} · {new Date(v.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>

                  {/* Cita si existe */}
                  {v.fechaCita && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>
                      📅 Cita: {v.fechaCita}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* ── Tabla en desktop ── */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <thead>
              <tr>
                {['N° Venta', 'Canal', 'Cliente', 'Llanta', 'Precio', 'Estado', 'Vendedor', 'Fecha'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ventas.map(v => (
                <tr key={v.id}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '11px 14px' }}>
                    <Link to={`/ventas/${v.id}`} style={{ color: 'var(--color-primary-light)', fontWeight: 700, fontSize: 13 }}>{v.numero}</Link>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 16 }}>{TIPO_ICON[v.tipoVenta] || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13 }}>{v.lead?.nombreCliente || v.nombreCliente || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13 }}>
                    {v.medidaLlanta ? <span>{v.medidaLlanta} <span style={{ color: 'var(--color-text-muted)' }}>{v.marcaLlanta || ''}</span></span> : '—'}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13 }}><strong>{fmt(v.precioTotal || v.total)}</strong></td>
                  <td style={{ padding: '11px 14px' }}><span style={badge(ESTADO_COLOR[v.estado] || '#64748b')}>{v.estado}</span></td>
                  <td style={{ padding: '11px 14px', fontSize: 13 }}>{v.usuario?.nombre}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(v.createdAt).toLocaleDateString('es-PE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 25 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 13, fontWeight: 600 }}>← Anterior</button>
          <span style={{ padding: '9px 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>Pág. {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={ventas.length < 25} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 13, fontWeight: 600 }}>Siguiente →</button>
        </div>
      )}
    </div>
  );
}
