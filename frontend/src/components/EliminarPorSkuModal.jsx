import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productosApi } from '../services/api';

export default function EliminarPorSkuModal({ onClose }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState(null);

  const mut = useMutation({
    mutationFn: (skus) => productosApi.eliminarPorSku(skus),
    onSuccess: (data) => {
      setResultado(data);
      if (data.eliminados.length) {
        toast.success(`${data.eliminados.length} producto(s) eliminado(s)`);
        qc.invalidateQueries({ queryKey: ['productos'] });
      } else {
        toast('No se eliminó ningún producto', { icon: '⚠️' });
      }
    },
    onError: (e) => toast.error(e?.error || 'No se pudo eliminar'),
  });

  const skusParseados = texto.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);

  const Lista = ({ label, items, color, bg }) => items.length > 0 && (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 4 }}>{label} ({items.length})</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 110, overflowY: 'auto' }}>
        {items.map(s => <span key={s} style={{ background: bg, color, border: `1px solid ${color}33`, borderRadius: 6, padding: '2px 8px', fontSize: 11.5, fontFamily: 'monospace' }}>{s}</span>)}
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 14, padding: 20, width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🗑️ Eliminar productos por SKU</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--color-text-muted)' }}>×</button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 10 }}>
          Escribe o pega varios SKUs separados por coma, espacio o salto de línea. Se eliminan del catálogo (eliminación lógica; conservan su historial de ventas).
        </div>
        <textarea value={texto} onChange={e => { setTexto(e.target.value); setResultado(null); }} rows={6}
          placeholder={'LLT-001\nLLT-002, LLT-003'}
          style={{ width: '100%', boxSizing: 'border-box', padding: 12, border: '1.5px solid var(--color-border)', borderRadius: 10, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, fontFamily: 'monospace', resize: 'vertical' }} />
        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', margin: '6px 2px' }}>{skusParseados.length} SKU(s) detectado(s)</div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
          <button onClick={() => mut.mutate(skusParseados)} disabled={mut.isPending || skusParseados.length === 0}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: skusParseados.length ? '#dc2626' : '#94a3b8', color: '#fff', fontSize: 13, fontWeight: 800, cursor: skusParseados.length ? 'pointer' : 'default' }}>
            {mut.isPending ? 'Eliminando…' : `Eliminar ${skusParseados.length || ''}`}
          </button>
        </div>

        {resultado && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Resultado ({resultado.total} SKU consultado(s))</div>
            <Lista label="✅ Eliminados" items={resultado.eliminados} color="#16a34a" bg="#f0fdf4" />
            <Lista label="➖ Ya estaban eliminados" items={resultado.yaInactivos} color="#b45309" bg="#fffbeb" />
            <Lista label="❌ No encontrados" items={resultado.noEncontrados} color="#dc2626" bg="#fef2f2" />
            {resultado.eliminados.length === 0 && resultado.yaInactivos.length === 0 && resultado.noEncontrados.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Sin resultados.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
