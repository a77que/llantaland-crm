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
      background: '#0f0f0f',
      borderBottom: '1px solid #1e1e1e',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '0 14px' : '0 24px',
      position: 'sticky', top: 0, zIndex: 50,
      boxShadow: '0 2px 12px rgba(0,0,0,.5)',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 0, minWidth: 0 }}>
        {isMobile && (
          <button
            onClick={onMenuClick}
            style={{
              background: 'none', border: 'none', padding: '6px 4px',
              fontSize: 20, lineHeight: 1, color: '#f5c400', flexShrink: 0,
            }}
            aria-label="Abrir menú"
          >
            ☰
          </button>
        )}
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: isMobile ? 16 : 17,
          fontWeight: 700, letterSpacing: 1,
          color: '#f0ede8', textTransform: 'uppercase',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {isAdmin && stockCount > 0 && (
          <Link to="/admin/stock" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: isMobile ? '5px 10px' : '5px 12px',
            borderRadius: 6,
            background: 'rgba(227,0,15,.1)',
            border: '1px solid rgba(227,0,15,.3)',
            fontSize: 12, fontWeight: 700, color: '#e3000f',
            whiteSpace: 'nowrap',
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: .5,
          }}>
            ⚠️ {isMobile ? '' : 'Stock crítico'}
            <span style={{
              background: '#e3000f', color: '#fff', borderRadius: 10,
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
