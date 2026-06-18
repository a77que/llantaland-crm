import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productosApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';
import LoadingSpinner from '../components/common/LoadingSpinner';

const COLS = [
  { key: 'miniatura', label: 'Miniatura' },
  { key: 'sku', label: 'SKU' },
  { key: 'medida', label: 'Medida' },
  { key: 'estado', label: 'Estado' },
];

function Card({ icon, value, label, color }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
}

export default function ImagenesStock() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const fileRef = useRef(null);
  const [target, setTarget] = useState(null);     // { ids:[], label }
  const [q, setQ] = useState('');
  const [soloFaltan, setSoloFaltan] = useState(false);
  const [expandido, setExpandido] = useState({}); // key -> bool
  const [sel, setSel] = useState({});              // key -> Set(ids)
  const [cols, setCols] = useState(new Set(['miniatura', 'medida', 'estado']));

  const { data, isLoading } = useQuery({ queryKey: ['grupos-imagen'], queryFn: productosApi.gruposImagen });

  const subir = useMutation({
    mutationFn: ({ file, ids }) => {
      const fd = new FormData();
      fd.append('imagen', file);
      fd.append('ids', JSON.stringify(ids));
      return productosApi.subirImagenMultiple(fd);
    },
    onSuccess: (r) => {
      toast.success(`Imagen aplicada a ${r?.actualizados ?? 0} llanta(s)`);
      qc.invalidateQueries({ queryKey: ['grupos-imagen'] });
      qc.invalidateQueries({ queryKey: ['productos'] });
      setSel({});
    },
    onError: (e) => toast.error(e?.error || 'No se pudo subir la imagen'),
  });

  const pedirArchivo = (ids, label) => {
    if (!ids?.length) { toast.error('Selecciona al menos una llanta'); return; }
    setTarget({ ids, label });
    fileRef.current.value = '';
    fileRef.current.click();
  };
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (file && target) subir.mutate({ file, ids: target.ids });
  };

  const toggleSel = (key, id) => setSel(prev => {
    const s = new Set(prev[key] || []);
    s.has(id) ? s.delete(id) : s.add(id);
    return { ...prev, [key]: s };
  });
  const toggleCol = (k) => setCols(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });

  if (isLoading) return <LoadingSpinner fullPage />;

  const grupos = (data?.grupos || []).filter(g => {
    if (soloFaltan && g.conImagen >= g.total) return false;
    if (q) { const t = `${g.marca} ${g.modelo}`.toLowerCase(); if (!t.includes(q.toLowerCase())) return false; }
    return true;
  });
  const tot = data?.totales || {};

  const btn = (bg, color = '#fff') => ({ padding: '7px 12px', borderRadius: 8, border: 'none', background: bg, color, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>🖼️ Imágenes del Stock</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sube una foto y aplícala a todo el modelo (marca + modelo) o a las llantas que elijas. La foto se toma de tu computadora.</div>
        </div>
        <Link to="/inventario" style={{ ...btn('var(--color-surface)', 'var(--color-text)'), border: '1px solid var(--color-border)', textDecoration: 'none' }}>← Inventario</Link>
      </div>

      {/* Resumen — qué falta */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        <Card icon="📦" value={tot.grupos ?? 0} label="Grupos (marca+modelo)" color="#3b82f6" />
        <Card icon="⏳" value={tot.gruposSinImagen ?? 0} label="Grupos sin imagen" color="#f59e0b" />
        <Card icon="🛞" value={tot.llantasSinImagen ?? 0} label="Llantas sin imagen" color="#dc2626" />
        <Card icon="✅" value={(tot.grupos ?? 0) - (tot.gruposIncompletos ?? 0)} label="Grupos completos" color="#16a34a" />
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar marca o modelo…"
          style={{ flex: '1 1 220px', padding: '9px 14px', fontSize: 14, border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text)', minWidth: 0 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 12px', border: `1.5px solid ${soloFaltan ? '#f59e0b' : 'var(--color-border)'}`, borderRadius: 8, background: soloFaltan ? '#fffbeb' : 'var(--color-surface)' }}>
          <input type="checkbox" checked={soloFaltan} onChange={e => setSoloFaltan(e.target.checked)} style={{ accentColor: '#f59e0b' }} /> Solo los que faltan
        </label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
          <span>Columnas:</span>
          {COLS.map(c => (
            <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
              <input type="checkbox" checked={cols.has(c.key)} onChange={() => toggleCol(c.key)} style={{ accentColor: '#f5c400' }} />{c.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>{grupos.length} grupo(s)</div>

      {/* Lista de grupos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {grupos.map(g => {
          const completo = g.conImagen >= g.total;
          const abierto = !!expandido[g.key];
          const selSet = sel[g.key] || new Set();
          return (
            <div key={g.key} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, borderLeft: `4px solid ${completo ? '#16a34a' : '#f59e0b'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 52, height: 52, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  {g.imagenUrl ? <img src={g.imagenUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 24 }}>🛞</span>}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{g.marca} · {g.modelo}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {g.total} llanta(s) · {completo ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✅ con imagen</span> : <span style={{ color: '#b45309', fontWeight: 700 }}>⏳ {g.conImagen}/{g.total} con imagen</span>}
                  </div>
                </div>
                <button style={btn('#16a34a')} onClick={() => pedirArchivo(g.llantas.map(l => l.id), `${g.marca} ${g.modelo}`)} disabled={subir.isPending}>
                  📤 Subir imagen al grupo
                </button>
                <button style={{ ...btn('var(--color-surface)', 'var(--color-text)'), border: '1px solid var(--color-border)' }} onClick={() => setExpandido(p => ({ ...p, [g.key]: !p[g.key] }))}>
                  {abierto ? 'Ocultar' : `Ver ${g.total}`}
                </button>
              </div>

              {abierto && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{selSet.size} seleccionada(s)</span>
                    <button style={btn('#2563eb')} disabled={!selSet.size || subir.isPending} onClick={() => pedirArchivo([...selSet], `${g.marca} ${g.modelo} (selección)`)}>
                      📤 Subir a seleccionadas
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                          <th style={{ padding: '4px 6px', width: 28 }}></th>
                          {cols.has('miniatura') && <th style={{ padding: '4px 6px' }}>Img</th>}
                          {cols.has('sku') && <th style={{ padding: '4px 6px' }}>SKU</th>}
                          {cols.has('medida') && <th style={{ padding: '4px 6px' }}>Medida</th>}
                          {cols.has('estado') && <th style={{ padding: '4px 6px' }}>Estado</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {g.llantas.map(l => (
                          <tr key={l.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '4px 6px' }}><input type="checkbox" checked={selSet.has(l.id)} onChange={() => toggleSel(g.key, l.id)} style={{ accentColor: '#2563eb' }} /></td>
                            {cols.has('miniatura') && <td style={{ padding: '4px 6px' }}>{l.imagenUrl ? <img src={l.imagenUrl} alt="" style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--color-border)' }} /> : '—'}</td>}
                            {cols.has('sku') && <td style={{ padding: '4px 6px', fontFamily: 'monospace', fontSize: 11 }}>{l.sku}</td>}
                            {cols.has('medida') && <td style={{ padding: '4px 6px', fontWeight: 600 }}>{l.medida}</td>}
                            {cols.has('estado') && <td style={{ padding: '4px 6px' }}>{l.imagenUrl ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✅</span> : <span style={{ color: '#b45309', fontWeight: 700 }}>⏳ falta</span>}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {grupos.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Sin grupos que mostrar.</div>}
      </div>
    </div>
  );
}
