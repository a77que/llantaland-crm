import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { useIsMobile } from '../../hooks/useIsMobile';

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const title = PAGE_TITLES[location.pathname]
    || (location.pathname.startsWith('/inventario') ? 'Inventario' : 'Llantaland CRM');

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>

      {/* Overlay para cerrar drawer en móvil */}
      {isMobile && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
            zIndex: 200, backdropFilter: 'blur(1px)',
          }}
        />
      )}

      <Sidebar
        isMobile={isMobile}
        drawerOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <div style={{
        marginLeft: isMobile ? 0 : 'var(--sidebar-width)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}>
        <Topbar
          title={title}
          isMobile={isMobile}
          onMenuClick={() => setDrawerOpen(true)}
        />

        <main style={{
          flex: 1,
          padding: isMobile ? '16px 12px' : '24px',
          paddingBottom: isMobile ? `calc(var(--bottom-nav-height) + var(--safe-bottom) + 16px)` : '24px',
          background: 'var(--color-bg)',
          overflowX: 'hidden',
        }}>
          <Outlet />
        </main>
      </div>

      {/* Barra de navegación inferior — solo móvil */}
      {isMobile && <BottomNav />}
    </div>
  );
}
