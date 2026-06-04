import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { clientesApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const S = {
  toolbar: { display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' },
  input: { padding: '8px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, flex: 1, minWidth: 200 },
  select: { padding: '8px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '2px solid var(--color-border)' },
  td: { padding: '11px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)', verticalAlign: 'middle' },
  badge: (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c + '20', color: c }),
};

const CANAL_COLORS = { WHATSAPP: '#25d366', TIENDA: '#2563eb', WEB: '#8b5cf6', N8N: '#f59e0b' };
const ESTADO_COLORS = { COMPLETO: '#16a34a', PENDIENTE: '#ca8a04' };

export default function Clientes() {
  const [q, setQ] = useState('');
  const [canal, setCanal] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['clientes', { q, canal, estado, page }],
    queryFn: () => clientesApi.listar({ q, canal, estado, page, limit: 25 }),
    keepPreviousData: true,
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Clientes</h1>
        <Link to="/clientes/nuevo" style={{ padding: '9px 18px', background: 'var(--color-primary)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          + Nuevo cliente
        </Link>
      </div>

      <div style={S.toolbar}>
        <input style={S.input} placeholder="Buscar por nombre, DNI, celular, email..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select style={S.select} value={canal} onChange={(e) => { setCanal(e.target.value); setPage(1); }}>
          <option value="">Todos los canales</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="TIENDA">Tienda</option>
          <option value="WEB">Web</option>
          <option value="N8N">n8n/Bot</option>
        </select>
        <select style={S.select} value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
          <option value="">Todos</option>
          <option value="COMPLETO">Completo</option>
          <option value="PENDIENTE">Pendiente</option>
        </select>
      </div>

      {isLoading ? <LoadingSpinner fullPage /> : (
        <>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10 }}>{data?.total || 0} clientes</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Cliente</th>
                <th style={S.th}>Doc.</th>
                <th style={S.th}>Celular</th>
                <th style={S.th}>Canal</th>
                <th style={S.th}>Estado</th>
                <th style={S.th}>Cotiz. / Ventas</th>
                <th style={S.th}>Registrado</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((c) => {
                const nombre = c.razonSocial || `${c.nombre || ''} ${c.apellidos || ''}`.trim() || '—';
                return (
                  <tr key={c.id}>
                    <td style={S.td}>
                      <Link to={`/clientes/${c.id}`} style={{ color: 'var(--color-primary-light)', fontWeight: 600 }}>{nombre}</Link>
                      {c.email && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.email}</div>}
                    </td>
                    <td style={S.td}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.tipoDoc}: {c.numDoc}</span></td>
                    <td style={S.td}>{c.celular || '—'}</td>
                    <td style={S.td}><span style={S.badge(CANAL_COLORS[c.canalOrigen] || '#64748b')}>{c.canalOrigen}</span></td>
                    <td style={S.td}><span style={S.badge(ESTADO_COLORS[c.crmEstado] || '#64748b')}>{c.crmEstado}</span></td>
                    <td style={S.td} style={{ ...S.td, textAlign: 'center' }}>{c._count?.cotizaciones || 0} / {c._count?.ventas || 0}</td>
                    <td style={S.td}>{new Date(c.createdAt).toLocaleDateString('es-PE')}</td>
                  </tr>
                );
              })}
              {!data?.data?.length && (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: 'var(--color-text-muted)' }}>Sin clientes</td></tr>
              )}
            </tbody>
          </table>

          {data?.total > 25 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)', cursor: 'pointer' }}>← Anterior</button>
              <span style={{ padding: '6px 12px', fontSize: 13 }}>Pág. {page} de {Math.ceil(data.total / 25)}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 25 >= data.total} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)', cursor: 'pointer' }}>Siguiente →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
