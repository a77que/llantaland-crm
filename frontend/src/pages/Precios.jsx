import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productosApi, adminApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';
import LoadingSpinner from '../components/common/LoadingSpinner';

const soles = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? '—' : `S/ ${Number(v).toFixed(2)}`;

// Precio de venta = precio proveedor + suma de costos activos (fijos y %).
function calcCostos(prov, costos) {
  const base = Number(prov) || 0;
  let total = 0;
  const detalle = [];
  for (const c of costos) {
    if (c.activo === false) continue;
    const val = Number(c.valor) || 0;
    const monto = c.tipo === 'porcentaje' ? base * val / 100 : val;
    if (monto) { total += monto; detalle.push(`${c.nombre}: S/ ${monto.toFixed(2)}`); }
  }
  return { total, detalle };
}

export default function Precios() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [costos, setCostos] = useState([]);
  const [costosDirty, setCostosDirty] = useState(false);
  const [edits, setEdits] = useState({}); // { [id]: { precioProveedor, precioReferencialVenta } }

  // ── Costos globales ──
  const { data: costosData, isLoading: loadingCostos } = useQuery({ queryKey: ['costos-venta'], queryFn: adminApi.getCostos });
  useEffect(() => {
    if (!costosData) return;
    setCostos((costosData.items && costosData.items.length ? costosData.items : (costosData.sugeridos || []))
      .map(c => ({ nombre: c.nombre, tipo: c.tipo || 'fijo', valor: c.valor ?? 0, activo: c.activo !== false })));
  }, [costosData]);

  const guardarCostos = useMutation({
    mutationFn: () => adminApi.saveCostos(costos),
    onSuccess: () => { toast.success('Costos guardados'); setCostosDirty(false); qc.invalidateQueries({ queryKey: ['costos-venta'] }); },
    onError: () => toast.error('No se pudieron guardar los costos'),
  });

  const setCosto = (i, patch) => { setCostos(cs => cs.map((c, j) => j === i ? { ...c, ...patch } : c)); setCostosDirty(true); };
  const addCosto = () => { setCostos(cs => [...cs, { nombre: '', tipo: 'fijo', valor: 0, activo: true }]); setCostosDirty(true); };
  const delCosto = (i) => { setCostos(cs => cs.filter((_, j) => j !== i)); setCostosDirty(true); };

  // ── Productos ──
  const { data, isLoading } = useQuery({
    queryKey: ['precios-productos', q, page],
    queryFn: () => productosApi.listar({ q: q || undefined, page, limit: 50, orderBy: 'marca', orderDir: 'asc' }),
    keepPreviousData: true,
  });
  const productos = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  const guardarPrecio = useMutation({
    mutationFn: ({ id, campo, valor }) => productosApi.actualizar(id, { [campo]: valor === '' ? null : valor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['precios-productos'] }),
    onError: () => toast.error('No se pudo guardar el precio'),
  });

  const valorActual = (prod, campo) => {
    const e = edits[prod.id];
    if (e && campo in e) return e[campo];
    const v = prod[campo];
    return v === null || v === undefined ? '' : String(v);
  };
  const onEdit = (id, campo, valor) => setEdits(s => ({ ...s, [id]: { ...s[id], [campo]: valor } }));
  const onBlurGuardar = (prod, campo) => {
    const nuevo = valorActual(prod, campo);
    const viejo = prod[campo] === null || prod[campo] === undefined ? '' : String(prod[campo]);
    if (nuevo === viejo) return;
    guardarPrecio.mutate({ id: prod.id, campo, valor: nuevo === '' ? '' : Number(nuevo) });
  };

  if (isLoading && !data) return <LoadingSpinner fullPage />;

  const inp = { width: 90, padding: '6px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, textAlign: 'right' };
  const th = { padding: '9px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--color-text-muted)', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' };
  const td = { padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontSize: 13, whiteSpace: 'nowrap' };

  const filaCalculo = (prod) => {
    const prov = valorActual(prod, 'precioProveedor');
    const ref = valorActual(prod, 'precioReferencialVenta');
    const { total: costoTotal, detalle } = calcCostos(prov, costos);
    const venta = (Number(prov) || 0) + costoTotal;
    const tieneRef = ref !== '' && !isNaN(Number(ref));
    const dif = tieneRef ? Number(ref) - venta : null;
    const pct = (tieneRef && venta > 0) ? (dif / venta) * 100 : null;
    const col = dif === null ? 'var(--color-text-muted)' : dif >= 0 ? '#16a34a' : '#dc2626';
    return { prov, ref, costoTotal, detalle, venta, dif, pct, col, tieneRef };
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>🧮 Precios y Margen</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Calcula el precio de venta desde el precio proveedor + costos, y compáralo con el precio de mercado.</div>
        </div>
        <Link to="/inventario" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>← Inventario</Link>
      </div>

      {/* ── Configuración de costos globales ── */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>⚙️ Costos que se suman al precio proveedor</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addCosto} style={{ padding: '7px 12px', borderRadius: 8, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-text)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>+ Agregar costo</button>
            <button onClick={() => guardarCostos.mutate()} disabled={!costosDirty || guardarCostos.isPending}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: costosDirty ? '#16a34a' : '#94a3b8', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: costosDirty ? 'pointer' : 'default' }}>
              {guardarCostos.isPending ? 'Guardando…' : '💾 Guardar costos'}
            </button>
          </div>
        </div>
        {loadingCostos ? <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Cargando…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {costos.length === 0 && <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Sin costos. Agrega IGV, instalación, traslado, etc.</div>}
            {costos.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={c.nombre} onChange={e => setCosto(i, { nombre: e.target.value })} placeholder="Nombre (ej. IGV)"
                  style={{ flex: 1, minWidth: 130, padding: '6px 10px', border: '1.5px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13 }} />
                <select value={c.tipo} onChange={e => setCosto(i, { tipo: e.target.value })}
                  style={{ padding: '6px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13 }}>
                  <option value="fijo">Monto S/</option>
                  <option value="porcentaje">% sobre proveedor</option>
                </select>
                <input type="number" step="0.01" value={c.valor} onChange={e => setCosto(i, { valor: e.target.value })}
                  style={{ width: 90, padding: '6px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, textAlign: 'right' }} />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 18 }}>{c.tipo === 'porcentaje' ? '%' : 'S/'}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={c.activo !== false} onChange={e => setCosto(i, { activo: e.target.checked })} /> activo
                </label>
                <button onClick={() => delCosto(i)} title="Eliminar" style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: 16, cursor: 'pointer' }}>🗑️</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>Los porcentajes se calculan sobre el precio proveedor. Estos costos aplican a todas las llantas.</div>
      </div>

      {/* Búsqueda */}
      <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Buscar marca, modelo, medida o SKU…"
        style={{ width: '100%', padding: '9px 14px', fontSize: 14, border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text)', marginBottom: 12, boxSizing: 'border-box' }} />

      {/* Tabla / cards */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {productos.map(prod => {
            const f = filaCalculo(prod);
            return (
              <div key={prod.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{prod.marca} · {prod.nombreComercial || '—'} <span style={{ color: 'var(--color-primary)' }}>{prod.medida}</span></div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace', marginBottom: 8 }}>{prod.sku}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Precio proveedor<br />
                    <input type="number" step="0.01" value={valorActual(prod, 'precioProveedor')} onChange={e => onEdit(prod.id, 'precioProveedor', e.target.value)} onBlur={() => onBlurGuardar(prod, 'precioProveedor')} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} /></label>
                  <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Precio referencial<br />
                    <input type="number" step="0.01" value={valorActual(prod, 'precioReferencialVenta')} onChange={e => onEdit(prod.id, 'precioReferencialVenta', e.target.value)} onBlur={() => onBlurGuardar(prod, 'precioReferencialVenta')} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} /></label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Costos: <strong>{soles(f.costoTotal)}</strong></span>
                  <span>Venta: <strong style={{ color: '#1d4ed8' }}>{soles(f.venta)}</strong></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 13, fontWeight: 800, color: f.col }}>
                  <span>Dif: {f.dif === null ? '—' : soles(f.dif)}</span>
                  <span>{f.pct === null ? '' : `${f.pct >= 0 ? '+' : ''}${f.pct.toFixed(1)}%`}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)' }}>
            <thead>
              <tr>
                <th style={th}>Producto</th>
                <th style={{ ...th, textAlign: 'right' }}>Precio proveedor</th>
                <th style={{ ...th, textAlign: 'right' }}>Costos</th>
                <th style={{ ...th, textAlign: 'right' }}>Precio venta</th>
                <th style={{ ...th, textAlign: 'right' }}>Precio referencial</th>
                <th style={{ ...th, textAlign: 'right' }}>Diferencia</th>
                <th style={{ ...th, textAlign: 'right' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(prod => {
                const f = filaCalculo(prod);
                return (
                  <tr key={prod.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{prod.marca} · {prod.nombreComercial || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}><span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{prod.medida}</span> · <span style={{ fontFamily: 'monospace' }}>{prod.sku}</span></div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <input type="number" step="0.01" value={valorActual(prod, 'precioProveedor')} onChange={e => onEdit(prod.id, 'precioProveedor', e.target.value)} onBlur={() => onBlurGuardar(prod, 'precioProveedor')} placeholder="0.00" style={inp} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--color-text-muted)' }} title={f.detalle.join('\n') || 'Sin costos'}>{soles(f.costoTotal)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#1d4ed8' }}>{soles(f.venta)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <input type="number" step="0.01" value={valorActual(prod, 'precioReferencialVenta')} onChange={e => onEdit(prod.id, 'precioReferencialVenta', e.target.value)} onBlur={() => onBlurGuardar(prod, 'precioReferencialVenta')} placeholder="mercado" style={inp} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: f.col }}>{f.dif === null ? '—' : soles(f.dif)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>
                      {f.pct === null ? <span style={{ color: 'var(--color-text-muted)' }}>—</span> : (
                        <span style={{ background: f.col + '18', color: f.col, padding: '3px 8px', borderRadius: 999, fontSize: 12 }}>{f.pct >= 0 ? '▲ +' : '▼ '}{f.pct.toFixed(1)}%</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {productos.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>No hay productos con ese filtro.</div>}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: page === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: page === 1 ? 'default' : 'pointer' }}>← Anterior</button>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: '36px' }}>{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: page === totalPages ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: page === totalPages ? 'default' : 'pointer' }}>Siguiente →</button>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 14 }}>
        <strong>Diferencia</strong> = precio referencial (mercado) − precio de venta calculado. En <span style={{ color: '#16a34a', fontWeight: 700 }}>verde</span> cuando el mercado está por encima (tienes margen); en <span style={{ color: '#dc2626', fontWeight: 700 }}>rojo</span> cuando tu precio supera al de mercado.
      </div>
    </div>
  );
}
