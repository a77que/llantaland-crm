import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const TABS = [
  { to: '/',          icon: '📊', label: 'Inicio',    exact: true },
  { to: '/leads',     icon: '📱', label: 'Leads'              },
  { to: '/inventario',icon: '🛞', label: 'Stock'              },
  { to: '/ventas',    icon: '💰', label: 'Ventas'             },
  { to: '/importar',  icon: '📂', label: 'Más', adminOnly: true },
];

export default function BottomNav() {
  const { isAdmin } = useAuth();
  const tabs = isAdmin ? TABS : TABS.filter(t => !t.adminOnly);
  // Si no es admin, agregar una pestaña de config básica
  const finalTabs = tabs;

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      height: 'calc(var(--bottom-nav-height) + var(--safe-bottom))',
      paddingBottom: 'var(--safe-bottom)',
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      zIndex: 100,
      boxShadow: '0 -2px 12px rgba(0,0,0,.08)',
    }}>
      {finalTabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.exact}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            fontSize: 10,
            fontWeight: isActive ? 700 : 500,
            color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            textDecoration: 'none',
            paddingTop: 6,
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
                  width: 32, height: 3,
                  background: 'var(--color-primary)',
                  borderRadius: '0 0 3px 3px',
                }} />
              )}
              <span style={{
                fontSize: 22,
                transition: 'transform .15s',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
