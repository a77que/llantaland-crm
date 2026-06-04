import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { productosApi, sedesApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useIsMobile } from '../hooks/useIsMobile';

const TIPO_COLOR = { AUTO: '#3b82f6', CAMIONETA: '#8b5cf6', CAMION: '#f59e0b', MOTO: '#ec4899' };

function StockIndicator({ stocks, isMobile }) {
  const total = stocks?.reduce((a, s) => a + s.cantidad, 0) || 0;
  const color = total > 20 ? '#16a34a' : total > 5 ? '#ca8a04' : '#dc2626';
  if (isMobile) {
    return <span style={{ fontSize: 12, fontWeight: 700, color }}>{total} uds</span>;
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Stock</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{total} uds</span>
      </div>
      <div style={{ background: '#e2e8f0', borderRadius: 3, height: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${Math.min(100, (total / 50) * 100)}%`, minWidth: 4 }} />
      </div>
    </div>
  );
}

export default function Inventario() {
  const isMobile = useIsMobile();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['productos', { q, tipo, page }],
    queryFn: () => productosApi.listar({ q, tipo, page, limit: isMobile ? 20 : 24 }),
    keepPreviousData: true,
  });

  const productos = data?.data || [];
  const total = data?.total || 0;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700 }}>Inventario</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{total} productos</div>
        </div>
        <Link to="/importar" style={{
          padding: isMobile ? '8px 14px' : '9px 18px',
          background: 'var(--color-primary)', color: '#fff',
          borderRadius: 10, fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          📂 {isMobile ? '' : 'Importar'}
        </Link>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          style={{ flex: '1 1 160px', padding: '10px 14px', fontSize: 14, border: '1.5px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface)', color: 'var(--color-text)', minWidth: 0 }}
          placeholder="Medida, marca, SKU..."
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
        />
        <select
          style={{ padding: '10px 12px', fontSize: 13, border: '1.5px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface)', color: 'var(--color-text)' }}
          value={tipo}
          onChange={e => { setTipo(e.target.value); setPage(1); }}
        >
          <option value="">Todos</option>
          <option value="AUTO">Auto</option>
          <option value="CAMIONETA">Camioneta</option>
          <option value="CAMION">Camión</option>
          <option value="MOTO">Moto</option>
        </select>
      </div>

      {isLoading ? <LoadingSpinner fullPage /> : (
        <>
          {isMobile ? (
            /* ── Lista compacta en móvil ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {productos.map(prod => (
                <Link key={prod.id} to={`/inventario/${prod.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'var(--color-surface)', borderRadius: 12,
                    padding: '12px 14px', border: '1px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    borderLeft: `4px solid ${TIPO_COLOR[prod.tipo] || '#64748b'}`,
                  }}>
                    {/* Icono / imagen */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 8,
                      background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, flexShrink: 0, overflow: 'hidden',
                    }}>
                      {prod.imagenUrl
                        ? <img src={prod.imagenUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : '🛞'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prod.marca} {prod.nombreComercial || prod.modelo || ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600, marginTop: 1 }}>
                        {prod.medida}
                        <span style={{ marginLeft: 8, fontSize: 10, padding: '1px 6px', borderRadius: 8, background: (TIPO_COLOR[prod.tipo] || '#64748b') + '20', color: TIPO_COLOR[prod.tipo] || '#64748b', fontWeight: 700 }}>{prod.tipo}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1, fontFamily: 'monospace' }}>{prod.sku}</div>
                    </div>

                    {/* Precio + stock */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-primary)' }}>
                        S/ {parseFloat(prod.precioRegular).toFixed(0)}
                      </div>
                      {prod.precioOferta && (
                        <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>
                          Oferta S/ {parseFloat(prod.precioOferta).toFixed(0)}
                        </div>
                      )}
                      <StockIndicator stocks={prod.stocks} isMobile />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            /* ── Grid de cards en desktop ── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {productos.map(prod => (
                <Link key={prod.id} to={`/inventario/${prod.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--color-surface)', borderRadius: 12, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', overflow: 'hidden', transition: 'box-shadow .2s' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
                  >
                    <div style={{ height: 140, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
                      {prod.imagenUrl ? <img src={prod.imagenUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🛞'}
                    </div>
                    <div style={{ padding: 14 }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{prod.sku}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{prod.marca} {prod.nombreComercial || prod.modelo}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, marginTop: 2 }}>{prod.medida}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-primary)' }}>S/ {parseFloat(prod.precioRegular).toFixed(2)}</div>
                          {prod.precioOferta && <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Oferta S/ {parseFloat(prod.precioOferta).toFixed(2)}</div>}
                        </div>
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: (TIPO_COLOR[prod.tipo] || '#64748b') + '20', color: TIPO_COLOR[prod.tipo] || '#64748b', fontWeight: 700 }}>{prod.tipo}</span>
                      </div>
                      <div style={{ marginTop: 10 }}><StockIndicator stocks={prod.stocks} isMobile={false} /></div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {total > 20 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 13, fontWeight: 600 }}>← Anterior</button>
              <span style={{ padding: '9px 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>Pág. {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 13, fontWeight: 600 }}>Siguiente →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
