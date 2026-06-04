import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV = [
  { section: null,         to: '/',           label: 'Dashboard',          icon: '📊', exact: true },
  { section: 'WhatsApp',   to: '/leads',       label: 'Leads WhatsApp',     icon: '📱' },
  { section: 'Inventario', to: '/inventario',  label: 'Inventario',         icon: '🛞' },
  { section: 'Ventas',     to: '/ventas',      label: 'Ventas',             icon: '💰' },
  { section: 'Admin',      to: '/admin/stock', label: 'Stock Crítico',      icon: '⚠️', adminOnly: true },
  { section: 'Admin',      to: '/importar',    label: 'Importar / Actualizar', icon: '📂', adminOnly: true },
  { section: 'Admin',      to: '/config/apis', label: 'Config APIs',        icon: '⚙️', adminOnly: true },
];

export default function Sidebar({ isMobile, drawerOpen, onClose }) {
  const { usuario, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  const links = isAdmin ? NAV : NAV.filter(l => !l.adminOnly);

  // Agrupar por sección
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

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      background: '#0a0a0a',
      borderRight: '1px solid #1e1e1e',
      display: 'flex',
      flexDirection: 'column',
      ...(isMobile ? {
        position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 300,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
        boxShadow: drawerOpen ? '4px 0 24px rgba(0,0,0,.8)' : 'none',
      } : {
        position: 'fixed', top: 0, left: 0, height: '100vh',
      }),
    }}>

      {/* Logo */}
      <div style={{
        padding: '18px 16px 14px',
        borderBottom: '1px solid #1e1e1e',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="https://llantaland.com/OsoLogoSVG.svg"
            alt="logo"
            style={{ height: 32 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div>
            <div style={{
              fontFamily: "'Black Ops One', sans-serif",
              fontSize: 15, color: '#f5c400', letterSpacing: 1.5,
            }}>
              LLANTALAND
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 9, color: '#555', letterSpacing: 2,
              textTransform: 'uppercase',
            }}>
              CRM v2.0
            </div>
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} style={{
            background: '#1a1a1a', border: '1px solid #303030',
            borderRadius: 6, padding: '5px 9px', color: '#888', fontSize: 16,
          }}>✕</button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {sections.map((sec, si) => (
          <div key={si}>
            {sec.label && (
              <div style={{
                padding: '10px 16px 4px',
                fontSize: 9, fontWeight: 700,
                color: '#444',
                textTransform: 'uppercase', letterSpacing: 2,
                fontFamily: "'Barlow Condensed', sans-serif",
              }}>
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
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: isMobile ? '13px 16px' : '9px 16px',
                  color: isActive ? '#f5c400' : '#666',
                  fontSize: 13.5,
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  letterSpacing: .5,
                  background: isActive ? 'rgba(245,196,0,.07)' : 'transparent',
                  borderLeft: isActive ? '3px solid #f5c400' : '3px solid transparent',
                  transition: 'all .15s',
                  textDecoration: 'none',
                })}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{l.icon}</span>
                <span>{l.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1e1e1e' }}>
        <div style={{ fontSize: 11, marginBottom: 8 }}>
          <span style={{ color: '#f5c400', fontWeight: 700, fontSize: 12 }}>{usuario?.nombre}</span>
          <span style={{ display: 'block', color: '#555', marginTop: 1, letterSpacing: 1, fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>{usuario?.rol}</span>
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '7px',
          background: 'rgba(227,0,15,.1)',
          border: '1px solid rgba(227,0,15,.3)',
          borderRadius: 6, color: '#e3000f',
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: 1, textTransform: 'uppercase',
        }}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
