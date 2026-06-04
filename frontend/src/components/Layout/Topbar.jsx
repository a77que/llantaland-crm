import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function Topbar({ title = '', isMobile, onMenuClick }) {
  const { isAdmin } = useAuth();

  const { data: stockAlertas } = useQuery({
    queryKey: ['stock-critico-count'],
    queryFn: () => adminApi.stockCritico(),
    enabled: isAdmin,
    refetchInterval: 120_000,
  });

  const stockCount = Array.isArray(stockAlertas) ? stockAlertas.length : 0;

  return (
    <header style={{
      height: 'var(--topbar-height)',
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '0 14px' : '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: 'var(--shadow)',
      gap: 12,
    }}>
      {/* Izquierda: hamburger (móvil) + título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 0, minWidth: 0 }}>
        {isMobile && (
          <button
            onClick={onMenuClick}
            style={{
              background: 'none', border: 'none', padding: '6px 4px',
              fontSize: 22, lineHeight: 1, color: 'var(--color-primary)', flexShrink: 0,
            }}
            aria-label="Abrir menú"
          >
            ☰
          </button>
        )}
        <span style={{
          fontSize: isMobile ? 15 : 16, fontWeight: 700,
          color: 'var(--color-text)', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title}
        </span>
      </div>

      {/* Derecha: alertas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {isAdmin && stockCount > 0 && (
          <Link
            to="/admin/stock"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: isMobile ? '6px 10px' : '5px 12px',
              borderRadius: 20, background: '#fef2f2',
              border: '1px solid #fecaca', fontSize: 12, fontWeight: 600, color: '#dc2626',
              whiteSpace: 'nowrap',
            }}
          >
            ⚠️{isMobile ? '' : ' Stock crítico'}
            <span style={{
              background: '#dc2626', color: '#fff', borderRadius: 10,
              fontSize: 10, fontWeight: 700, padding: '1px 6px', marginLeft: 2,
            }}>
              {stockCount}
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}
