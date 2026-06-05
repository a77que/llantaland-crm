import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV = [
  { section: null,         to: '/',             label: 'Dashboard',             icon: '📊', exact: true },
  { section: 'WhatsApp',   to: '/leads',         label: 'Leads WhatsApp',        icon: '📱' },
  { section: 'Ventas',     to: '/cotizaciones',  label: 'Cotizaciones',          icon: '📋' },
  { section: 'Ventas',     to: '/ventas',        label: 'Ventas',                icon: '💰' },
  { section: 'Inventario', to: '/inventario',    label: 'Catálogo Llantas',      icon: null, imgIcon: 'https://llantaland.com/OsoLogoSVG.svg' },
  { section: 'Inventario', to: '/almacenes',     label: 'Almacenes',             icon: '🏪' },
  { section: 'Admin',      to: '/admin/stock',   label: 'Stock Crítico',         icon: '⚠️', adminOnly: true },
  { section: 'Admin',      to: '/importar',      label: 'Importar / Actualizar', icon: '📂', adminOnly: true },
  { section: 'Admin',      to: '/config/apis',   label: 'Config APIs',           icon: '⚙️', adminOnly: true },
];

export default function Sidebar({ isMobile, isTablet, collapsed, onToggleCollapse, drawerOpen, onClose }) {
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

  const width = isMobile ? 240 : (collapsed ? 56 : 240);

  return (
    <aside style={{
      width,
      minWidth: width,
      background: '#0a0a0a',
      borderRight: '1px solid #1e1e1e',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width .25s ease, min-width .25s ease',
      ...(isMobile ? {
        position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 300,
        width: 240, minWidth: 240,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
        boxShadow: drawerOpen ? '4px 0 24px rgba(0,0,0,.8)' : 'none',
      } : {
        position: 'fixed', top: 0, left: 0, height: '100vh',
      }),
    }}>

      {/* Logo */}
      <div style={{
        padding: collapsed && !isMobile ? '16px 0' : '16px',
        borderBottom: '1px solid #1e1e1e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
        minHeight: 60,
      }}>
        {(!collapsed || isMobile) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="https://llantaland.com/OsoLogoSVG.svg"
              alt="logo"
              style={{ height: 30 }}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div>
              <div style={{ fontFamily: "'Black Ops One', sans-serif", fontSize: 14, color: '#f5c400', letterSpacing: 1.5 }}>
                LLANTALAND
              </div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, color: 'rgba(255,255,255,.35)', letterSpacing: 2, textTransform: 'uppercase' }}>
                CRM v2.0
              </div>
            </div>
          </div>
        )}

        {/* Ícono colapsado */}
        {collapsed && !isMobile && (
          <img src="https://llantaland.com/OsoLogoSVG.svg" alt="logo" style={{ height: 28 }}
            onError={e => { e.target.style.display = 'none'; }} />
        )}

        {/* Botón cerrar/colapsar */}
        {isMobile ? (
          <button onClick={onClose} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: 6, padding: '5px 9px', color: '#888', fontSize: 16 }}>✕</button>
        ) : isTablet && (
          <button onClick={onToggleCollapse} style={{ background: 'none', border: 'none', color: '#555', fontSize: 16, cursor: 'pointer', padding: 4 }}>
            {collapsed ? '→' : '←'}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {sections.map((sec, si) => (
          <div key={si}>
            {sec.label && !collapsed && (
              <div style={{
                padding: '10px 16px 4px', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.35)',
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
                title={collapsed && !isMobile ? l.label : undefined}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  gap: 10,
                  padding: collapsed && !isMobile ? '12px 0' : isMobile ? '13px 16px' : '9px 16px',
                  color: isActive ? '#f5c400' : 'rgba(255,255,255,.82)',
                  fontSize: 13.5,
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  letterSpacing: .5,
                  background: isActive ? 'rgba(245,196,0,.07)' : 'transparent',
                  borderLeft: collapsed && !isMobile ? 'none' : isActive ? '3px solid #f5c400' : '3px solid transparent',
                  borderRight: collapsed && !isMobile && isActive ? '3px solid #f5c400' : 'none',
                  transition: 'all .15s',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                })}
              >
                {l.imgIcon ? (
                  <img
                    src={l.imgIcon}
                    alt=""
                    style={{ width: collapsed && !isMobile ? 22 : 18, height: collapsed && !isMobile ? 22 : 18, flexShrink: 0, filter: 'brightness(0) invert(1) opacity(0.8)' }}
                    onError={e => { e.target.style.display='none'; }}
                  />
                ) : (
                  <span style={{ fontSize: collapsed && !isMobile ? 20 : 16, flexShrink: 0 }}>{l.icon}</span>
                )}
                {(!collapsed || isMobile) && <span>{l.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: collapsed && !isMobile ? '12px 0' : '12px 16px', borderTop: '1px solid #1e1e1e', textAlign: collapsed && !isMobile ? 'center' : 'left' }}>
        {(!collapsed || isMobile) ? (
          <>
            <div style={{ fontSize: 11, marginBottom: 8 }}>
              <span style={{ color: '#f5c400', fontWeight: 700, fontSize: 12 }}>{usuario?.nombre}</span>
              <span style={{ display: 'block', color: 'rgba(255,255,255,.35)', marginTop: 1, letterSpacing: 1, fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase' }}>{usuario?.rol}</span>
            </div>
            <button onClick={handleLogout} style={{
              width: '100%', padding: '7px',
              background: 'rgba(227,0,15,.1)', border: '1px solid rgba(227,0,15,.25)',
              borderRadius: 6, color: '#e3000f', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, textTransform: 'uppercase',
            }}>Cerrar sesión</button>
          </>
        ) : (
          <button onClick={handleLogout} title="Cerrar sesión" style={{ background: 'none', border: 'none', color: '#e3000f', fontSize: 18, cursor: 'pointer' }}>⏻</button>
        )}
      </div>
    </aside>
  );
}
