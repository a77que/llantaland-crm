import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi, ventasApi, leadsApi, citasApi, cotizacionesApi, clientesApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile, useIsTablet } from '../hooks/useIsMobile';
import LoadingSpinner from '../components/common/LoadingSpinner';

const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;
const num = (v) => (v ?? 0).toLocaleString('es-PE');

// Estilos de hover/animación inyectados una sola vez
const DASH_CSS = `
.dash-card{transition:transform .15s ease, box-shadow .15s ease;}
.dash-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.10);}
.dash-action:hover{transform:translateY(-2px);}
@keyframes dashIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
.dash-anim{animation:dashIn .25s ease both;}
`;

function Kpi({ icon, value, label, to, color }) {
  const inner = (
    <div className="dash-card" style={{
      position: 'relative', overflow: 'hidden',
      background: 'var(--color-surface)', borderRadius: 16, padding: '16px 16px 16px 18px',
      boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', gap: 14, height: '100%',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <div style={{
        width: 46, height: 46, borderRadius: 13, background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 23, fontWeight: 800, color, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{value ?? '—'}</div>
        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

const estadoColor = (e) => ({
  COMPLETADA: '#16a34a', ACEPTADA: '#16a34a', CONVERTIDA: '#0ea5e9',
  ANULADA: '#dc2626', RECHAZADA: '#dc2626', DENEGADA: '#dc2626',
  BORRADOR: '#ca8a04', PENDIENTE: '#ca8a04',
}[e] || '#64748b');

function Badge({ children }) {
  const c = estadoColor(children);
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: c + '20', color: c, whiteSpace: 'nowrap' }}>{children}</span>;
}

export default function Dashboard() {
  const { isAdmin, usuario } = useAuth();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['resumen-hoy'],
    queryFn: () => { const hoy = new Date().toISOString().split('T')[0]; return adminApi.resumen({ desde: hoy, hasta: hoy }); },
    enabled: isAdmin,
  });
  const { data: ventasRecientes } = useQuery({ queryKey: ['ventas-recientes'], queryFn: () => ventasApi.listar({ limit: 5, page: 1 }) });
  const { data: cotsRecientes } = useQuery({ queryKey: ['cots-recientes'], queryFn: () => cotizacionesApi.listar({ limit: 5, page: 1 }) });
  const { data: clientesData } = useQuery({ queryKey: ['clientes-total'], queryFn: () => clientesApi.listar({ limit: 1, page: 1 }) });
  const { data: citasData } = useQuery({ queryKey: ['citas-dash'], queryFn: () => citasApi.listar({ limit: 1, page: 1 }) });
  const { data: leadsResumen } = useQuery({ queryKey: ['leads-resumen-dash'], queryFn: leadsApi.resumen, refetchInterval: 30_000 });
  const { data: stockAlertas } = useQuery({ queryKey: ['stock-critico'], queryFn: () => adminApi.stockCritico(), enabled: isAdmin });

  if (isLoading && isAdmin) return <LoadingSpinner fullPage />;

  const calientes = leadsResumen?.leads?.calientes ?? leadsResumen?.porRanking?.find(r => r.ranking === 'caliente')?._count ?? 0;
  const citasTotal = citasData?.total ?? 0;
  const cotsTotal = cotsRecientes?.total ?? 0;
  const clientesTotal = clientesData?.total ?? 0;

  // KPIs
  const kpis = [];
  if (isAdmin) {
    kpis.push({ icon: '💰', value: fmt(resumen?.ventas?.total), label: 'Ventas hoy', to: '/ventas', color: '#16a34a' });
    kpis.push({ icon: '🧾', value: num(resumen?.ventas?.cantidad), label: 'Órdenes hoy', to: '/ventas', color: '#0ea5e9' });
  }
  kpis.push({ icon: '📱', value: num(leadsResumen?.hoy ?? leadsResumen?.leads?.hoy), label: 'Leads hoy', to: '/leads', color: '#8b5cf6' });
  kpis.push({ icon: '🔥', value: num(calientes), label: 'Leads calientes', to: '/leads?cards=caliente', color: '#ef4444' });
  kpis.push({ icon: '📅', value: num(citasTotal), label: 'Citas', to: '/citas', color: '#f59e0b' });
  kpis.push({ icon: '📋', value: num(cotsTotal), label: 'Cotizaciones', to: '/cotizaciones', color: '#6366f1' });
  kpis.push({ icon: '👥', value: num(clientesTotal), label: 'Clientes', to: '/clientes', color: '#14b8a6' });
  if (isAdmin) kpis.push({ icon: '⚠️', value: num(stockAlertas?.length), label: 'Stock crítico', to: '/admin/stock', color: '#dc2626' });

  // Accesos rápidos
  const actions = [
    { to: '/cotizaciones/nueva', icon: '➕', label: 'Nueva cotización', color: '#6366f1' },
    { to: '/leads', icon: '📱', label: 'Leads', color: '#8b5cf6' },
    { to: '/citas', icon: '📅', label: 'Citas', color: '#f59e0b' },
    { to: '/clientes', icon: '👥', label: 'Clientes', color: '#14b8a6' },
    { to: '/inventario', icon: '🛞', label: 'Inventario', color: '#0ea5e9' },
    ...(isAdmin ? [
      { to: '/admin/stock', icon: '⚠️', label: 'Stock crítico', color: '#dc2626' },
      { to: '/admin/usuarios', icon: '👤', label: 'Usuarios', color: '#64748b' },
      { to: '/importar', icon: '📂', label: 'Importar', color: '#f97316' },
    ] : []),
  ];

  const kpiCols = isMobile ? 2 : isTablet ? 3 : 4;
  const actCols = isMobile ? 2 : isTablet ? 3 : 4;
  const stack = isMobile || isTablet;

  const grid = (cols, gap = 12) => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap });
  const section = {
    background: 'var(--color-surface)', borderRadius: 16, padding: isMobile ? 14 : 18,
    boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)',
  };
  const sectionHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 };
  const sectionTitle = { fontSize: 14, fontWeight: 800, color: 'var(--color-primary)' };
  const verTodas = { fontSize: 12, color: 'var(--color-primary-light)', fontWeight: 700, textDecoration: 'none' };
  const label = { fontSize: 11, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '.6px', margin: '4px 0 10px' };

  const hoy = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <style>{DASH_CSS}</style>

      {/* Encabezado */}
      <div className="dash-anim" style={{
        borderRadius: 18, padding: isMobile ? '18px 18px' : '22px 26px', marginBottom: 18,
        background: 'linear-gradient(120deg, #0a0a0a 0%, #1a1a1a 60%, #2a2300 100%)',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 2, color: '#f5c400', textTransform: 'uppercase' }}>
          {hoy}
        </div>
        <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, marginTop: 2 }}>
          Hola, {usuario?.nombre?.split(' ')[0] || 'bienvenido'} 👋
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>
          Resumen de Llantaland CRM {isAdmin ? '· vista administrador' : '· vista vendedor'}
        </div>
      </div>

      {/* KPIs */}
      <div className="dash-anim" style={{ ...grid(kpiCols), marginBottom: 20 }}>
        {kpis.map((k, i) => <Kpi key={i} {...k} />)}
      </div>

      {/* Accesos rápidos */}
      <div style={label}>Accesos rápidos</div>
      <div style={{ ...grid(actCols, 10), marginBottom: 22 }}>
        {actions.map(({ to, icon, label: l, color }) => (
          <Link key={to} to={to} className="dash-action" style={{
            background: 'var(--color-surface)', border: `1.5px solid ${color}35`, borderRadius: 14,
            padding: '15px 10px', textAlign: 'center', textDecoration: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            transition: 'transform .15s ease',
          }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{l}</span>
          </Link>
        ))}
      </div>

      {/* Listas: ventas + cotizaciones */}
      <div style={{ display: 'grid', gridTemplateColumns: stack ? '1fr' : '1fr 1fr', gap: 14 }}>
        {/* Últimas ventas */}
        <div style={section}>
          <div style={sectionHead}>
            <div style={sectionTitle}>Últimas ventas</div>
            <Link to="/ventas" style={verTodas}>Ver todas →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ventasRecientes?.data?.length ? ventasRecientes.data.map(v => (
              <Link key={v.id} to={`/ventas/${v.id}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 10, textDecoration: 'none', gap: 10,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light)' }}>{v.numero || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.lead?.nombreCliente || v.nombreCliente || v.usuario?.nombre || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{fmt(v.precioTotal || v.total)}</div>
                  <Badge>{v.estado}</Badge>
                </div>
              </Link>
            )) : <div style={{ textAlign: 'center', padding: 22, color: 'var(--color-text-muted)', fontSize: 13 }}>Sin ventas registradas</div>}
          </div>
        </div>

        {/* Últimas cotizaciones */}
        <div style={section}>
          <div style={sectionHead}>
            <div style={sectionTitle}>Últimas cotizaciones</div>
            <Link to="/cotizaciones" style={verTodas}>Ver todas →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cotsRecientes?.data?.length ? cotsRecientes.data.map(c => (
              <Link key={c.id} to={`/cotizaciones/${c.id}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 10, textDecoration: 'none', gap: 10,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light)' }}>{c.numero || `#${String(c.id).slice(-6)}`}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.lead?.nombreCliente || c.nombreCliente || c.cliente?.nombre || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{fmt(c.total || c.precioTotal)}</div>
                  <Badge>{c.estado}</Badge>
                </div>
              </Link>
            )) : <div style={{ textAlign: 'center', padding: 22, color: 'var(--color-text-muted)', fontSize: 13 }}>Sin cotizaciones</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
