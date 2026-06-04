import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { sunatApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const S = {
  card: { background: '#fff', borderRadius: 10, padding: 24, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 16 },
  pendingBanner: { background: '#fefce8', border: '2px solid #fde047', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' },
  group: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' },
  input: { padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13 },
  select: { padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13 },
  btn: { padding: '10px 22px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 16 },
};

export default function Facturacion() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery({ queryKey: ['sunat-config'], queryFn: sunatApi.getConfig });

  const [form, setForm] = useState({
    rucEmpresa: '', razonSocialEmpresa: '', pse: '', pseApiKey: '', pseApiUrl: '',
    seriesBoleta: 'B001', seriesFactura: 'F001',
  });

  const [initialized, setInitialized] = React.useState(false);
  if (config && !initialized) { setForm((f) => ({ ...f, ...config })); setInitialized(true); }

  const saveMutation = useMutation({
    mutationFn: () => sunatApi.saveConfig(form),
    onSuccess: () => { toast.success('Configuración guardada'); qc.invalidateQueries(['sunat-config']); },
    onError: (e) => toast.error(e?.error || 'Error'),
  });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const { data: comprobantes } = useQuery({
    queryKey: ['comprobantes'],
    queryFn: () => sunatApi.comprobantes({ limit: 10 }),
  });

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Facturación SUNAT</h1>

      <div style={S.pendingBanner}>
        <span style={{ fontSize: 28 }}>🔧</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Módulo en configuración</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
            Configure los datos de su empresa y el PSE (Proveedor de Servicios Electrónicos) para habilitar la emisión de boletas y facturas electrónicas.
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Datos de la empresa</div>
        <div style={S.grid}>
          <div style={S.group}>
            <label style={S.label}>RUC</label>
            <input style={S.input} value={form.rucEmpresa} onChange={set('rucEmpresa')} placeholder="20XXXXXXXXX" maxLength={11} />
          </div>
          <div style={S.group}>
            <label style={S.label}>Razón Social</label>
            <input style={S.input} value={form.razonSocialEmpresa} onChange={set('razonSocialEmpresa')} placeholder="Llantaland S.A.C." />
          </div>
          <div style={S.group}>
            <label style={S.label}>Serie Boleta</label>
            <input style={S.input} value={form.seriesBoleta} onChange={set('seriesBoleta')} placeholder="B001" />
          </div>
          <div style={S.group}>
            <label style={S.label}>Serie Factura</label>
            <input style={S.input} value={form.seriesFactura} onChange={set('seriesFactura')} placeholder="F001" />
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Proveedor de Servicios Electrónicos (PSE)</div>
        <div style={S.grid}>
          <div style={S.group}>
            <label style={S.label}>PSE</label>
            <select style={S.select} value={form.pse} onChange={set('pse')}>
              <option value="">Seleccionar PSE...</option>
              <option value="NUBEFACT">Nubefact</option>
              <option value="APISUNAT">ApiSunat</option>
              <option value="GREENTER">Greenter (libre)</option>
            </select>
          </div>
          <div style={S.group}>
            <label style={S.label}>API Key del PSE</label>
            <input style={S.input} type="password" value={form.pseApiKey} onChange={set('pseApiKey')} placeholder="•••••••••" />
          </div>
          <div style={{ ...S.group, gridColumn: '1 / -1' }}>
            <label style={S.label}>URL del PSE</label>
            <input style={S.input} value={form.pseApiUrl} onChange={set('pseApiUrl')} placeholder="https://api.nubefact.com/api/v1" />
          </div>
        </div>

        <button style={S.btn} onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Guardando...' : '💾 Guardar configuración'}
        </button>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Últimos comprobantes</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Tipo', 'Serie-Correlativo', 'Estado', 'Fecha'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comprobantes?.data?.length ? comprobantes.data.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 12px' }}>{c.tipo}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{c.serie}-{c.correlativo}</td>
                <td style={{ padding: '10px 12px' }}>{c.estado}</td>
                <td style={{ padding: '10px 12px' }}>{new Date(c.fechaEmision).toLocaleDateString('es-PE')}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Sin comprobantes emitidos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
