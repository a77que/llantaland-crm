import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const S = {
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 12 },
  badge: (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c + '20', color: c }),
  btn: (c) => ({ padding: '6px 14px', background: c, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }),
};

export default function AdminDescuentos() {
  const qc = useQueryClient();
  const [soloHoy, setSoloHoy] = useState(true);
  const [soloNoLeidos, setSoloNoLeidos] = useState(true);

  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas-desc', { soloHoy, soloNoLeidos }],
    queryFn: () => adminApi.descuentos({ fecha: soloHoy ? 'hoy' : undefined, leida: soloNoLeidos ? false : undefined }),
  });

  const marcarMutation = useMutation({
    mutationFn: (id) => adminApi.marcarLeido(id),
    onSuccess: () => { qc.invalidateQueries(['alertas-desc']); qc.invalidateQueries(['admin-descuentos-count']); },
    onError: (e) => toast.error(e?.error || 'Error'),
  });

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Descuentos del día</h1>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 13 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={soloHoy} onChange={(e) => setSoloHoy(e.target.checked)} />
          Solo hoy
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={soloNoLeidos} onChange={(e) => setSoloNoLeidos(e.target.checked)} />
          Solo no leídos
        </label>
      </div>

      {isLoading ? <LoadingSpinner fullPage /> : (
        <>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>{alertas?.length || 0} alertas</div>
          {alertas?.map((a) => (
            <div key={a.id} style={{ ...S.card, opacity: a.leida ? 0.6 : 1, borderLeft: a.leida ? '4px solid #e2e8f0' : '4px solid #e63946' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{a.clienteNombre}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>{a.productoResumen}</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={S.badge('#e63946')}>
                      {a.descuentoTipo === 'PORCENTAJE' ? `${a.descuentoValor}%` : `S/ ${parseFloat(a.descuentoValor).toFixed(2)}`} descuento
                    </span>
                    <span style={S.badge('#16a34a')}>Ahorro: S/ {parseFloat(a.montoAhorrado).toFixed(2)}</span>
                    {a.motivo && <span style={S.badge('#64748b')}>"{a.motivo}"</span>}
                    <span style={S.badge('#2563eb')}>{a.usuario?.nombre}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>{new Date(a.createdAt).toLocaleString('es-PE')}</div>
                </div>
                {!a.leida && (
                  <button style={S.btn('#64748b')} onClick={() => marcarMutation.mutate(a.id)}>
                    ✓ Marcar leído
                  </button>
                )}
              </div>
            </div>
          ))}
          {!alertas?.length && <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Sin alertas de descuento</div>}
        </>
      )}
    </div>
  );
}
