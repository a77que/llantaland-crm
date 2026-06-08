import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi, ventasApi, leadsApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LoadingSpinner from '../components/common/LoadingSpinner';

function MetricCard({ icon, value, label, link, color = 'var(--color-primary)' }) {
  const content = (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 12,
      padding: '16px 18px',
      boxShadow: 'var(--shadow)',
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: color + '15',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value ?? '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
      </div>
    </div>
  );
  return link ? <Link to={link} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['resumen-hoy'],
    queryFn: () => { const hoy = new Date().toISOString().split('T')[0]; return adminApi.resumen({ desde: hoy, hasta: hoy }); },
    enabled: isAdmin,
  });

  const { data: ventasRecientes } = useQuery({
    queryKey: ['ventas-recientes'],
    queryFn: () => ventasApi.listar({ limit: 5, page: 1 }),
  });

  const { data: leadsResumen } = useQuery({
    queryKey: ['leads-resumen-dash'],
    queryFn: leadsApi.resumen,
    refetchInterval: 30_000,
  });

  const { data: stockAlertas } = useQuery({
    queryKey: ['stock-critico'],
    queryFn: () => adminApi.stockCritico(),
    enabled: isAdmin,
  });

  if (isLoading && isAdmin) return <LoadingSpinner fullPage />;

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: isMobile ? 10 : 14,
    marginBottom: 20,
  };

  const sectionStyle = {
    background: 'var(--color-surface)',
    borderRadius: 12,
    padding: isMobile ? '14px 14px' : '18px 20px',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--color-border)',
    marginBottom: 14,
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Métricas de ventas */}
      {isAdmin && resumen && (
        <div style={gridStyle}>
          <MetricCard icon="💰" value={fmt(resumen.ventas?.total)}  label="Ventas hoy"    link="/ventas"  color="#16a34a" />
          <MetricCard icon="🧾" value={resumen.ventas?.cantidad}    label="Órdenes hoy"   link="/ventas"  color="#3b82f6" />
          {Array.isArray(stockAlertas) && stockAlertas.length > 0 &&
            <MetricCard icon="⚠️" value={stockAlertas.length} label="Stock crítico" link="/admin/stock" color="#dc2626" />}
        </div>
      )}

      {/* Métricas de leads WhatsApp */}
      {leadsResumen && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>
            WhatsApp hoy
          </div>
          <div style={gridStyle}>
            <MetricCard icon="📱" value={leadsResumen.hoy}         label="Leads hoy"     link="/leads"  color="#8b5cf6" />
            <MetricCard icon="🔥" value={leadsResumen.leads?.calientes ?? leadsResumen.porRanking?.find(r => r.ranking === 'caliente')?._count ?? 0} label="Calientes" link="/leads?cards=caliente" color="#ef4444" />
            <MetricCard icon="✅" value={leadsResumen.leads?.completados ?? leadsResumen.porPaso?.find(p => p.pasoActual === 'completado')?._count ?? 0} label="Completados" link="/leads?cards=completados" color="#16a34a" />
            <MetricCard icon="⏳" value={leadsResumen.porPaso?.find(p => p.pasoActual === 'esperando_confirmacion')?._count ?? 0} label="Confirmando" link="/leads?paso=esperando_confirmacion" color="#f97316" />
          </div>
        </>
      )}

      {/* Accesos rápidos — especialmente útiles en móvil */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>
        Accesos rápidos
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { to: '/leads',      icon: '📱', label: 'Ver Leads',    color: '#8b5cf6' },
          { to: '/inventario', icon: '🛞', label: 'Inventario',   color: '#3b82f6' },
          { to: '/ventas',     icon: '💰', label: 'Ventas',       color: '#16a34a' },
          { to: '/importar',   icon: '📂', label: 'Importar',     color: '#f59e0b' },
        ].map(({ to, icon, label, color }) => (
          <Link key={to} to={to} style={{
            background: 'var(--color-surface)', border: `1.5px solid ${color}30`,
            borderRadius: 12, padding: '14px 12px', textAlign: 'center',
            textDecoration: 'none', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 26 }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
          </Link>
        ))}
      </div>

      {/* Últimas ventas */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>Últimas ventas</div>
          <Link to="/ventas" style={{ fontSize: 12, color: 'var(--color-primary-light)', fontWeight: 600 }}>Ver todas →</Link>
        </div>

        {isMobile ? (
          /* Cards en móvil */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ventasRecientes?.data?.map(v => (
              <Link key={v.id} to={`/ventas/${v.id}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 8,
                textDecoration: 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light)' }}>{v.numero}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {v.lead?.nombreCliente || v.nombreCliente || v.usuario?.nombre}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(v.precioTotal || v.total)}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8,
                    background: (v.estado === 'COMPLETADA' ? '#16a34a' : v.estado === 'ANULADA' ? '#dc2626' : '#ca8a04') + '20',
                    color: v.estado === 'COMPLETADA' ? '#16a34a' : v.estado === 'ANULADA' ? '#dc2626' : '#ca8a04',
                  }}>{v.estado}</span>
                </div>
              </Link>
            )) || <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}>Sin ventas registradas</div>}
          </div>
        ) : (
          /* Tabla en desktop */
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['N°', 'Cliente', 'Llanta', 'Total', 'Estado'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', borderBottom: '2px solid var(--color-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ventasRecientes?.data?.map(v => (
                <tr key={v.id}>
                  <td style={{ padding: '9px 10px' }}><Link to={`/ventas/${v.id}`} style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>{v.numero}</Link></td>
                  <td style={{ padding: '9px 10px' }}>{v.lead?.nombreCliente || v.nombreCliente || '—'}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--color-text-muted)' }}>{v.medidaLlanta || '—'}</td>
                  <td style={{ padding: '9px 10px' }}><strong>{fmt(v.precioTotal || v.total)}</strong></td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                      background: (v.estado === 'COMPLETADA' ? '#16a34a' : v.estado === 'ANULADA' ? '#dc2626' : '#ca8a04') + '20',
                      color: v.estado === 'COMPLETADA' ? '#16a34a' : v.estado === 'ANULADA' ? '#dc2626' : '#ca8a04',
                    }}>{v.estado}</span>
                  </td>
                </tr>
              )) || <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Sin ventas registradas</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
