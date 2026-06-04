import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { useIsMobile, useIsTablet } from '../../hooks/useIsMobile';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/leads': 'Leads WhatsApp',
  '/inventario': 'Inventario',
  '/ventas': 'Ventas',
  '/facturacion': 'Facturación',
  '/admin/stock': 'Stock Crítico',
  '/importar': 'Importar / Actualizar',
  '/config/apis': 'Configuración',
};

export default function Layout() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTablet && !isMobile);

  const title = PAGE_TITLES[location.pathname]
    || (location.pathname.startsWith('/inventario') ? 'Inventario' : 'Llantaland CRM');

  // Tablet: sidebar colapsado por defecto (solo iconos)
  const sidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 56 : 240);

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>

      {/* Overlay drawer móvil */}
      {isMobile && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
            zIndex: 200, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <Sidebar
        isMobile={isMobile}
        isTablet={isTablet && !isMobile}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        drawerOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <div style={{
        marginLeft: isMobile ? 0 : sidebarWidth,
        flex: 1, display: 'flex', flexDirection: 'column',
        minWidth: 0,
        transition: 'margin-left .25s ease',
      }}>
        <Topbar
          title={title}
          isMobile={isMobile}
          isTablet={isTablet && !isMobile}
          onMenuClick={() => isMobile ? setDrawerOpen(true) : setSidebarCollapsed(c => !c)}
        />

        <main style={{
          flex: 1,
          padding: isMobile ? '14px 12px' : isTablet ? '18px 16px' : '24px',
          paddingBottom: isMobile
            ? `calc(var(--bottom-nav-height) + var(--safe-bottom) + 14px)`
            : '24px',
          background: '#080808',
          overflowX: 'hidden',
        }}>
          <Outlet />
        </main>
      </div>

      {/* Bottom nav solo en móvil */}
      {isMobile && <BottomNav />}
    </div>
  );
}
