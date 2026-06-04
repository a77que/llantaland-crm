import React, { useState } from 'react';
import ImportadorStock from '../components/ImportadorStock/ImportadorStock';
import ActualizarStock from '../components/ImportadorStock/ActualizarStock';

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
  { id: 'importar',  icon: '📥', label: 'Importar productos',  desc: 'Crea o actualiza productos completos desde Excel/CSV' },
  { id: 'actualizar', icon: '🔄', label: 'Actualizar stock/precios', desc: 'Actualiza campos específicos de productos existentes' },
];

export default function Importar() {
  const [tab, setTab] = useState('actualizar');

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.title}>Gestión masiva de inventario</div>
        <div style={S.sub}>Importa nuevos productos o actualiza precios y stock de los existentes desde un archivo Excel o CSV.</div>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'importar'  && <ImportadorStock />}
      {tab === 'actualizar' && <ActualizarStock />}
    </div>
  );
}
