import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLeadsNotification } from '../../context/LeadsNotificationContext';

const TABS = [
  { to: '/',             icon: '📊', label: 'Inicio',  exact: true },
  { to: '/leads',        icon: '📱', label: 'Leads'           },
  { to: '/cotizaciones', icon: '📋', label: 'Cotiz.'          },
  { to: '/ventas',       icon: '💰', label: 'Ventas'          },
  { to: '/inventario',   icon: '🛞', label: 'Stock'           },
];

export default function BottomNav() {
  const { isAdmin } = useAuth();
  const { count: leadsCount } = useLeadsNotification();
  const tabs = isAdmin ? TABS : TABS.filter(t => !t.adminOnly);

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 'calc(var(--bottom-nav-height) + var(--safe-bottom))',
      paddingBottom: 'var(--safe-bottom)',
      background: 'var(--color-surface)',
      borderTop: '2px solid #f5c400',
      display: 'flex', zIndex: 100,
      boxShadow: '0 -4px 20px rgba(0,0,0,.6)',
    }}>
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.exact}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, fontSize: 10,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: isActive ? 700 : 500,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: isActive ? '#d4a900' : 'var(--color-text-muted)',
            background: 'none', border: 'none',
            textDecoration: 'none', paddingTop: 6,
            transition: 'color .15s',
            position: 'relative',
          })}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 28, height: 2,
                  background: '#f5c400',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <span style={{
                  fontSize: 22,
                  transition: 'transform .15s',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}>
                  {tab.icon}
                </span>
                {tab.to === '/leads' && leadsCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -8,
                    background: '#ef4444', color: '#fff',
                    borderRadius: 10, minWidth: 16, height: 16,
                    fontSize: 9, fontWeight: 800, lineHeight: 1,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px',
                    animation: 'pulse 1.5s infinite',
                  }}>
                    {leadsCount > 9 ? '9+' : leadsCount}
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
