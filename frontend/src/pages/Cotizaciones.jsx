import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { cotizacionesApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const S = {
  toolbar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  select: { padding: '8px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '2px solid var(--color-border)' },
  td: { padding: '11px 16px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'middle' },
  badge: (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c + '20', color: c }),
};

const ESTADO_COLORS = { BORRADOR: '#64748b', ENVIADA: '#2563eb', ACEPTADA: '#16a34a', RECHAZADA: '#dc2626', VENCIDA: '#9ca3af' };

export default function Cotizaciones() {
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['cotizaciones', { estado, page }],
    queryFn: () => cotizacionesApi.listar({ estado, page, limit: 25 }),
    keepPreviousData: true,
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Cotizaciones</h1>
        <Link to="/cotizaciones/nueva" style={{ padding: '9px 18px', background: '#16a34a', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          + Nueva cotización
        </Link>
      </div>

      <div style={S.toolbar}>
        <select style={S.select} value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
          <option value="">Todos los estados</option>
          <option value="BORRADOR">Borrador</option>
          <option value="ENVIADA">Enviada</option>
          <option value="ACEPTADA">Aceptada</option>
          <option value="RECHAZADA">Rechazada</option>
          <option value="VENCIDA">Vencida</option>
        </select>
      </div>

      {isLoading ? <LoadingSpinner fullPage /> : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>N° Cotización</th>
              <th style={S.th}>Cliente</th>
              <th style={S.th}>Vendedor</th>
              <th style={S.th}>Items</th>
              <th style={S.th}>Total</th>
              <th style={S.th}>Estado</th>
              <th style={S.th}>WhatsApp</th>
              <th style={S.th}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((c) => {
              const nombre = c.cliente?.razonSocial || `${c.cliente?.nombre || ''} ${c.cliente?.apellidos || ''}`.trim();
              return (
                <tr key={c.id}>
                  <td style={S.td}><Link to={`/cotizaciones/${c.id}`} style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>{c.numero}</Link></td>
                  <td style={S.td}>{nombre || '—'}</td>
                  <td style={S.td}>{c.usuario?.nombre}</td>
                  <td style={S.td} style={{ ...S.td, textAlign: 'center' }}>{c._count?.items || 0}</td>
                  <td style={S.td}><strong>S/ {parseFloat(c.total).toFixed(2)}</strong></td>
                  <td style={S.td}><span style={S.badge(ESTADO_COLORS[c.estado] || '#64748b')}>{c.estado}</span></td>
                  <td style={S.td}>{c.whatsappEnviado ? '✅' : '—'}</td>
                  <td style={S.td}>{new Date(c.createdAt).toLocaleDateString('es-PE')}</td>
                </tr>
              );
            })}
            {!data?.data?.length && (
              <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: 'var(--color-text-muted)' }}>Sin cotizaciones</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
