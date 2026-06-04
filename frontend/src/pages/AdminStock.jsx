import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const S = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '2px solid var(--color-border)' },
  td: { padding: '11px 16px', borderBottom: '1px solid var(--color-border)' },
};

export default function AdminStock() {
  const { data: alertas, isLoading } = useQuery({
    queryKey: ['stock-critico'],
    queryFn: adminApi.stockCritico,
  });

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Alertas de Stock Crítico</h1>

      {isLoading ? <LoadingSpinner fullPage /> : (
        <>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>{alertas?.length || 0} alertas activas</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Producto</th>
                <th style={S.th}>Sede</th>
                <th style={S.th}>Stock actual</th>
                <th style={S.th}>Stock mínimo</th>
                <th style={S.th}>Diferencia</th>
                <th style={S.th}>Fecha alerta</th>
              </tr>
            </thead>
            <tbody>
              {alertas?.map((a) => (
                <tr key={a.id} style={{ borderLeft: '3px solid #dc2626' }}>
                  <td style={S.td}>
                    <Link to={`/inventario/${a.productoId}`} style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>
                      {a.producto?.marca} {a.producto?.medida}
                    </Link>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.producto?.sku}</div>
                  </td>
                  <td style={S.td}>{a.sede?.nombre}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: '#dc2626' }}>{a.cantidadActual} uds</td>
                  <td style={S.td}>{a.stockMinimo} uds</td>
                  <td style={{ ...S.td, fontWeight: 700, color: '#dc2626' }}>−{a.stockMinimo - a.cantidadActual} uds</td>
                  <td style={S.td}>{new Date(a.createdAt).toLocaleDateString('es-PE')}</td>
                </tr>
              ))}
              {!alertas?.length && (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: 'var(--color-text-muted)', padding: 40 }}>✅ Sin alertas de stock crítico</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
