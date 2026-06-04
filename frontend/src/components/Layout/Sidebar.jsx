import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV = [
  { section: null,          to: '/',          label: 'Dashboard',         icon: '📊', exact: true },
  { section: 'WhatsApp',    to: '/leads',      label: 'Leads WhatsApp',    icon: '📱' },
  { section: 'Inventario',  to: '/inventario', label: 'Inventario',        icon: '🛞' },
  { section: 'Ventas',      to: '/ventas',     label: 'Ventas',            icon: '💰' },
  { section: 'Admin',       to: '/admin/stock',label: 'Stock Crítico',     icon: '⚠️', adminOnly: true },
  { section: 'Admin',       to: '/importar',   label: 'Importar / Actualizar', icon: '📂', adminOnly: true },
  { section: 'Admin',       to: '/config/apis',label: 'Config APIs',       icon: '⚙️', adminOnly: true },
];

export default function Sidebar({ isMobile, drawerOpen, onClose }) {
  const { usuario, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const links = isAdmin ? NAV : NAV.filter(l => !l.adminOnly);

  // Agrupar por sección (sentinel para que el primer item siempre cree grupo)
  const sections = [];
  let currentSection = undefined;
  links.forEach(l => {
    if (l.section !== currentSection) {
      currentSection = l.section;
      sections.push({ label: l.section, items: [l] });
    } else {
      sections[sections.length - 1].items.push(l);
    }
  });

  const sidebarStyle = {
    width: 'var(--sidebar-width)',
    minHeight: '100vh',
    background: 'var(--color-primary)',
    display: 'flex',
    flexDirection: 'column',
    ...(isMobile ? {
      position: 'fixed',
      top: 0, left: 0,
      height: '100%',
      zIndex: 300,
      transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
      boxShadow: drawerOpen ? 'var(--shadow-lg)' : 'none',
    } : {
      position: 'fixed',
      top: 0, left: 0,
      height: '100vh',
    }),
  };

  return (
    <aside style={sidebarStyle} className={drawerOpen ? 'slide-in' : ''}>
      {/* Logo + cerrar (móvil) */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid rgba(255,255,255,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>🛞</span>
          <div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>Llantaland</div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 10 }}>CRM v2.0</div>
          </div>
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 18, lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {sections.map((sec, si) => (
          <div key={si}>
            {sec.label && (
              <div style={{ padding: '10px 16px 4px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.8px' }}>
                {sec.label}
              </div>
            )}
            {sec.items.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.exact}
                onClick={isMobile ? onClose : undefined}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: isMobile ? '13px 16px' : '10px 16px',
                  color: isActive ? '#fff' : 'rgba(255,255,255,.72)',
                  fontSize: 13.5, fontWeight: isActive ? 700 : 500,
                  background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
                  borderLeft: isActive ? '3px solid #e63946' : '3px solid transparent',
                  transition: 'all .15s',
                  textDecoration: 'none',
                })}
              >
                <span style={{ fontSize: 17, width: 22, textAlign: 'center' }}>{l.icon}</span>
                <span>{l.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer usuario */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, marginBottom: 8 }}>
          <strong style={{ color: '#fff', fontSize: 12 }}>{usuario?.nombre}</strong>
          <span style={{ display: 'block', marginTop: 1 }}>{usuario?.rol}</span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '8px', background: 'rgba(230,57,70,.2)',
            border: '1px solid rgba(230,57,70,.4)', borderRadius: 6,
            color: '#ff6b7a', fontSize: 12, fontWeight: 600,
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
