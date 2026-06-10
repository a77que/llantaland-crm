import React, { useState } from 'react';
import toast from 'react-hot-toast';
import ImportadorStock from '../components/ImportadorStock/ImportadorStock';
import ActualizarStock from '../components/ImportadorStock/ActualizarStock';
import { importarApi } from '../services/api';

const S = {
  page: { padding: 24 },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--color-text-muted)' },
  tabs: { display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--color-border)' },
  tab: (active) => ({
    padding: '10px 22px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
    border: 'none', background: 'none',
    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
    borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    marginBottom: -2, transition: 'color .15s',
  }),
};

const TABS = [
  { id: 'importar',   icon: '📥', label: 'Importar productos',       desc: 'Crea o actualiza productos completos desde Excel/CSV' },
  { id: 'actualizar', icon: '🔄', label: 'Actualizar stock/precios',  desc: 'Actualiza campos específicos de productos existentes' },
];

function useDescarga(fn, filename) {
  const [cargando, setCargando] = useState(false);
  const descargar = async () => {
    setCargando(true);
    try {
      const blob = await fn();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar');
    } finally {
      setCargando(false);
    }
  };
  return { descargar, cargando };
}

export default function Importar() {
  const [tab, setTab] = useState('actualizar');
  const template  = useDescarga(importarApi.template,         'plantilla_productos_llantaland.xlsx');
  const exportar  = useDescarga(importarApi.exportarCatalogo, `catalogo_llantaland_${new Date().toISOString().slice(0,10)}.xlsx`);

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div style={S.header}>
          <div style={S.title}>Gestión masiva de inventario</div>
          <div style={S.sub}>Importa nuevos productos o actualiza precios y stock desde Excel o CSV.</div>
        </div>

        {/* Botones de descarga */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={template.descargar}
            disabled={template.cargando}
            style={{ padding: '8px 14px', background: 'var(--color-surface)', border: '1.5px solid #3b82f6', borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {template.cargando ? '⏳' : '📋'} {template.cargando ? 'Generando...' : 'Plantilla de carga'}
          </button>
          <button
            onClick={exportar.descargar}
            disabled={exportar.cargando}
            style={{ padding: '8px 14px', background: '#16a34a', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {exportar.cargando ? '⏳' : '⬇️'} {exportar.cargando ? 'Exportando...' : 'Exportar catálogo'}
          </button>
        </div>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'importar'   && <ImportadorStock />}
      {tab === 'actualizar' && <ActualizarStock />}
    </div>
  );
}
