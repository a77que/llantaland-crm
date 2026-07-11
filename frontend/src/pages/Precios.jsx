import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productosApi, adminApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import LoadingSpinner from '../components/common/LoadingSpinner';

const soles = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? '—' : `S/ ${Number(v).toFixed(2)}`;

const normalizarNombre = (s) => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

// "Traslado" sí se suma al precio de oferta como cualquier otro costo: va
// incluido en el precio de cada llanta (si se lleva 1, se cobra completo).
// El descuento por llevar varias (o por haber stock en la tienda elegida) se
// calcula aparte, en la cotización, sobre este mismo monto ya incluido.
function calcCostos(prov, costos) {
  const base = Number(prov) || 0;
  let total = 0;
  const detalle = [];
  for (const c of costos) {
    if (c.activo === false) continue;
    const nombre = normalizarNombre(c.nombre);
    const val = Number(c.valor) || 0;
    let monto = c.tipo === 'porcentaje' ? base * val / 100 : val;
    // "Ganancia" tiene un piso en S/: si el % calculado da menos, se usa el piso.
    if (nombre === 'ganancia' && c.montoMinimo !== null && c.montoMinimo !== undefined && c.montoMinimo !== '') {
      const min = Number(c.montoMinimo) || 0;
      if (monto < min) monto = min;
    }
    if (monto) { total += monto; detalle.push(`${c.nombre}: S/ ${monto.toFixed(2)}`); }
  }
  return { total, detalle };
}

// Columnas backend-sortables (campo real en BD)
const BACKEND_SORT = {
  marca:                  'marca',
  precioProveedor:        'precioProveedor',
  precioOferta:           'precioOferta',
  precioReferencialVenta: 'precioReferencialVenta',
};

// Columnas calculadas en el frontend — requieren cargar todos los productos
const CLIENT_SORT = new Set(['costoTotal', 'diferencia', 'pct']);

export default function Precios() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('marca');
  const [sortDir, setSortDir] = useState('asc');
  const [costos, setCostos] = useState([]);
  const [costosDirty, setCostosDirty] = useState(false);
  const [edits, setEdits] = useState({});
  const [filtroDif, setFiltroDif] = useState('todos'); // 'todos' | 'verde'

  const isClientSort = CLIENT_SORT.has(sortBy);
  // El filtro "solo diferencia positiva" es calculado en frontend, igual que
  // ordenar por columnas calculadas: necesita cargar todo el catálogo.
  const forzarTodos = isClientSort || filtroDif === 'verde';

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  // ── Costos globales ──
  const { data: costosData, isLoading: loadingCostos } = useQuery({ queryKey: ['costos-venta'], queryFn: adminApi.getCostos });
  useEffect(() => {
    if (!costosData) return;
    setCostos((costosData.items && costosData.items.length ? costosData.items : (costosData.sugeridos || []))
      .map(c => ({ nombre: c.nombre, tipo: c.tipo || 'fijo', valor: c.valor ?? 0, montoMinimo: c.montoMinimo ?? '', activo: c.activo !== false, obligatorio: c.obligatorio === true })));
  }, [costosData]);

  // Al guardar costos se recalcula precioOferta de TODO el catálogo — un cambio
  // en IGV/Instalación/Ganancia/etc. afecta a todos los productos a la vez.
  const guardarCostos = useMutation({
    mutationFn: async () => {
      await adminApi.saveCostos(costos);
      return productosApi.recalcularPrecioOferta();
    },
    onSuccess: (data) => {
      toast.success(`Costos guardados — precio oferta recalculado en ${data?.actualizados ?? 0} productos`);
      setCostosDirty(false);
      qc.invalidateQueries({ queryKey: ['costos-venta'] });
      qc.invalidateQueries({ queryKey: ['precios-productos'] });
    },
    onError: (e) => toast.error(e?.error || 'No se pudieron guardar los costos'),
  });

  const setCosto = (i, patch) => { setCostos(cs => cs.map((c, j) => j === i ? { ...c, ...patch } : c)); setCostosDirty(true); };
  const addCosto = () => { setCostos(cs => [...cs, { nombre: '', tipo: 'fijo', valor: 0, activo: true, obligatorio: false }]); setCostosDirty(true); };
  const delCosto = (i) => {
    if (costos[i]?.obligatorio) return; // IGV/Instalación/Ganancia no se pueden eliminar
    setCostos(cs => cs.filter((_, j) => j !== i));
    setCostosDirty(true);
  };

  // ── Sync precio regular (admin, una sola vez para productos existentes) ──
  const syncMutation = useMutation({
    mutationFn: () => productosApi.sincronizarPrecioRegular(),
    onSuccess: (data) => {
      toast.success(`Precio regular generado para ${data.actualizados} productos en Inventario`);
      qc.invalidateQueries({ queryKey: ['precios-productos'] });
    },
    onError: () => toast.error('Error al generar precios regulares'),
  });

  // ── Productos ──
  const { data, isLoading, isError } = useQuery({
    queryKey: ['precios-productos', q, forzarTodos ? 'all' : page, sortBy, sortDir, filtroDif],
    queryFn: () => productosApi.listar({
      q: q || undefined,
      page: forzarTodos ? 1 : page,
      all: forzarTodos ? 'true' : undefined,
      noStocks: forzarTodos ? 'true' : undefined,  // evita JOIN costoso al cargar todos para ordenar/filtrar
      limit: forzarTodos ? undefined : 50,
      orderBy: isClientSort ? 'marca' : (BACKEND_SORT[sortBy] || 'marca'),
      orderDir: isClientSort ? 'asc' : sortDir,
    }),
    placeholderData: keepPreviousData,
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

  // filaCalculo usa valorActual (incluye edits no guardados) para mostrar en pantalla.
  // precioOferta YA NO es un campo editable: se calcula en vivo = precioProveedor +
  // costos activos (IGV, Instalación, Ganancia, etc.), igual que lo hará el backend
  // al guardar precioProveedor.
  const filaCalculo = (prod) => {
    const prov   = valorActual(prod, 'precioProveedor');
    const ref    = valorActual(prod, 'precioReferencialVenta');
    const { total: costoTotal, detalle } = calcCostos(prov, costos);
    const provNum = Number(prov) || 0;
    const oferta = provNum > 0 ? String(Math.round((provNum + costoTotal) * 100) / 100) : '';
    const tieneOferta = oferta !== '' && !isNaN(Number(oferta)) && Number(oferta) > 0;
    const tieneRef    = ref !== '' && !isNaN(Number(ref));
    const dif  = (tieneOferta && tieneRef) ? Number(ref) - Number(oferta) : null;
    const pct  = (dif !== null && Number(oferta) > 0) ? (dif / Number(oferta)) * 100 : null;
    const col  = dif === null ? 'var(--color-text-muted)' : dif >= 0 ? '#16a34a' : '#dc2626';
    return { prov, oferta, ref, costoTotal, detalle, dif, pct, col, tieneOferta, tieneRef };
  };

  // sortFila usa valores brutos de BD (no edits) para que el orden sea estable.
  // La oferta se recalcula en vivo (proveedor + costos), igual que filaCalculo,
  // en vez de leer prod.precioOferta: ese campo guardado puede estar desactualizado
  // en productos importados que nunca pasaron por un guardado/recálculo manual.
  const sortFila = (prod) => {
    const prov   = Number(prod.precioProveedor) || 0;
    const ref    = Number(prod.precioReferencialVenta) || 0;
    const { total: costoTotal } = calcCostos(prov, costos);
    const oferta = prov > 0 ? Math.round((prov + costoTotal) * 100) / 100 : 0;
    const diferencia = (oferta > 0 && ref > 0) ? ref - oferta : null;
    const pct        = (diferencia !== null && oferta > 0) ? (diferencia / oferta) * 100 : null;
    return { costoTotal, diferencia, pct };
  };

  // Orden client-side: solo aplica cuando sortBy es columna calculada
  const productosSorted = useMemo(() => {
    if (!isClientSort || productos.length === 0) return productos;
    const NEG_INF = sortDir === 'asc' ? Infinity : -Infinity;
    return [...productos].sort((a, b) => {
      const fa = sortFila(a);
      const fb = sortFila(b);
      const va = fa[sortBy] ?? NEG_INF;
      const vb = fb[sortBy] ?? NEG_INF;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [productos, sortBy, sortDir, costos, isClientSort]); // eslint-disable-line

  // Filtro "solo diferencia positiva (verde)": referencial >= precio oferta.
  const productosMostrados = useMemo(() => {
    if (filtroDif !== 'verde') return productosSorted;
    return productosSorted.filter(p => {
      const { diferencia } = sortFila(p);
      return diferencia !== null && diferencia >= 0;
    });
  }, [productosSorted, filtroDif, costos]); // eslint-disable-line

  if (isLoading && !data) return <LoadingSpinner fullPage />;
  if (isError && !data) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>Error al cargar los productos. Recarga la página.</div>;

  const inp = { width: 90, padding: '6px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, textAlign: 'right' };
  const td  = { padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontSize: 13, whiteSpace: 'nowrap' };

  const ThSort = ({ col, label, align = 'right' }) => {
    const active = sortBy === col;
    const arrow  = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅';
    return (
      <th
        onClick={() => handleSort(col)}
        title={`Ordenar por ${label}`}
        style={{
          padding: '9px 10px',
          textAlign: align,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: .5,
          color: active ? '#f5c400' : 'var(--color-text-muted)',
          borderBottom: `2px solid ${active ? '#f5c400' : 'var(--color-border)'}`,
          background: active ? 'rgba(245,196,0,.05)' : 'var(--color-surface)',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'color .15s, border-color .15s, background .15s',
        }}
      >
        {label}<span style={{ opacity: active ? 1 : 0.4, fontSize: 10 }}>{arrow}</span>
      </th>
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>🧮 Precios y Margen</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            El precio oferta se calcula solo (precio proveedor + costos activos). El precio regular (+5%) se genera al hacer clic en "Sincronizar precio regular".
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              title="Recalcula el precio regular (precio oferta +5%) para todos los productos del catálogo"
              style={{ padding: '7px 11px', borderRadius: 7, border: '1px solid #6366f130', background: 'rgba(99,102,241,.08)', color: '#818cf8', fontSize: 11.5, fontWeight: 700, cursor: syncMutation.isPending ? 'default' : 'pointer', opacity: syncMutation.isPending ? .6 : 1 }}>
              {syncMutation.isPending ? '⏳…' : '🔄 Sincronizar precio regular'}
            </button>
          )}
          <Link to="/inventario" style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>← Inventario</Link>
        </div>
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
                  disabled={c.obligatorio} title={c.obligatorio ? 'Este concepto es obligatorio para el cálculo del precio y no se puede renombrar' : undefined}
                  style={{ flex: 1, minWidth: 130, padding: '6px 10px', border: '1.5px solid var(--color-border)', borderRadius: 6, background: c.obligatorio ? 'var(--color-bg)' : 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontWeight: c.obligatorio ? 700 : 400 }} />
                {c.obligatorio && <span title="Obligatorio para el cálculo del precio" style={{ fontSize: 14 }}>🔒</span>}
                <select value={c.tipo} onChange={e => setCosto(i, { tipo: e.target.value })}
                  style={{ padding: '6px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13 }}>
                  <option value="fijo">Monto S/</option>
                  <option value="porcentaje">% sobre proveedor</option>
                </select>
                <input type="number" step="0.01" value={c.valor} onChange={e => setCosto(i, { valor: e.target.value })}
                  style={{ width: 90, padding: '6px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, textAlign: 'right' }} />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 18 }}>{c.tipo === 'porcentaje' ? '%' : 'S/'}</span>
                {normalizarNombre(c.nombre) === 'ganancia' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)' }} title="Si el % calculado da menos que este monto, se cobra este monto en su lugar (piso de ganancia por llanta)">
                    mínimo
                    <input type="number" step="0.01" min="0" value={c.montoMinimo} onChange={e => setCosto(i, { montoMinimo: e.target.value })} placeholder="0.00"
                      style={{ width: 80, padding: '6px 8px', border: '1.5px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, textAlign: 'right' }} />
                    S/
                  </label>
                )}
                {c.obligatorio ? (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }} title="Los conceptos obligatorios siempre están activos">siempre activo</span>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={c.activo !== false} onChange={e => setCosto(i, { activo: e.target.checked })} /> activo
                  </label>
                )}
                {!c.obligatorio && (
                  <button onClick={() => delCosto(i)} title="Eliminar" style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: 16, cursor: 'pointer' }}>🗑️</button>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
          Los porcentajes se calculan sobre el precio proveedor. Estos costos aplican a todas las llantas.{' '}
          🔒 <strong>IGV, Instalación y Ganancia</strong> son obligatorios para calcular el precio oferta — puedes cambiar su monto/%, pero no renombrarlos ni eliminarlos. El resto de costos que agregues sí son libres de editar o quitar.{' '}
          El <strong>mínimo S/</strong> de Ganancia es un piso: si el % da menos que ese monto (ej. en llantas baratas), se cobra el mínimo en su lugar — así nunca ganas menos de eso por llanta.{' '}
          Si agregas un costo llamado <strong>"Traslado"</strong> (tipo Monto S/), sí se suma al precio oferta como cualquier otro costo — va incluido en el precio de cada llanta. El bot de WhatsApp y Nueva Cotización lo descuentan aparte cuando corresponde: completo si la tienda elegida ya tiene stock (no hace falta viaje), o desde la 2da unidad si el cliente lleva varias llantas (un solo viaje trae todas).
        </div>
      </div>

      {/* Búsqueda */}
      <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Buscar marca, modelo, medida o SKU…"
        style={{ width: '100%', padding: '9px 14px', fontSize: 14, border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text)', marginBottom: 12, boxSizing: 'border-box' }} />

      {/* Filtro por diferencia */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => { setFiltroDif('todos'); setPage(1); }}
          style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${filtroDif === 'todos' ? 'var(--color-primary)' : 'var(--color-border)'}`, background: filtroDif === 'todos' ? 'var(--color-primary)' : 'var(--color-surface)', color: filtroDif === 'todos' ? '#000' : 'var(--color-text-muted)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          📋 Mostrar todos
        </button>
        <button onClick={() => { setFiltroDif('verde'); setPage(1); }}
          style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${filtroDif === 'verde' ? '#16a34a' : 'var(--color-border)'}`, background: filtroDif === 'verde' ? '#16a34a' : 'var(--color-surface)', color: filtroDif === 'verde' ? '#fff' : 'var(--color-text-muted)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          🟢 Solo diferencia positiva
        </button>
      </div>

      {/* Aviso cuando se carga todo para ordenar/filtrar columnas calculadas */}
      {forzarTodos && (
        <div style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 6, padding: '6px 12px', marginBottom: 10 }}>
          ⚡ {isClientSort && (
            <>Ordenando por <strong>{sortBy === 'diferencia' ? 'Diferencia S/' : sortBy === 'pct' ? '% Margen' : 'Costos'}</strong> — </>
          )}
          {filtroDif === 'verde' && <>Filtrando solo diferencia positiva ({productosMostrados.length} de {total}) — </>}
          cargando todos los productos del catálogo ({total} productos).
        </div>
      )}

      {/* Tabla / cards */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {productosMostrados.map(prod => {
            const f = filaCalculo(prod);
            return (
              <div key={prod.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>{prod.marca} · {prod.nombreComercial || '—'} <span style={{ color: 'var(--color-primary)' }}>{prod.medida}</span></div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace', marginBottom: 8 }}>{prod.sku}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Precio proveedor<br />
                    <input type="number" step="0.01" value={valorActual(prod, 'precioProveedor')} onChange={e => onEdit(prod.id, 'precioProveedor', e.target.value)} onBlur={() => onBlurGuardar(prod, 'precioProveedor')} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} /></label>
                  <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Precio oferta 🔒<br />
                    <div title="Se calcula solo: precio proveedor + IGV + Instalación + Ganancia + otros costos activos" style={{ ...inp, width: '100%', boxSizing: 'border-box', background: 'var(--color-bg)', color: f.tieneOferta ? '#1d4ed8' : 'var(--color-text-muted)', fontWeight: 700 }}>{f.tieneOferta ? soles(f.oferta) : '—'}</div></label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Costos: <strong>{soles(f.costoTotal)}</strong></div>
                  <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Referencial<br />
                    <input type="number" step="0.01" value={valorActual(prod, 'precioReferencialVenta')} onChange={e => onEdit(prod.id, 'precioReferencialVenta', e.target.value)} onBlur={() => onBlurGuardar(prod, 'precioReferencialVenta')} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} /></label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, fontWeight: 800, color: f.col }}>
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
                <ThSort col="marca"                  label="Producto"            align="left" />
                <ThSort col="precioProveedor"        label="Precio proveedor"                 />
                <ThSort col="costoTotal"             label="Costos"                           />
                <ThSort col="precioOferta"           label="Precio oferta 🔒"                 />
                <ThSort col="precioReferencialVenta" label="Precio referencial"               />
                <ThSort col="diferencia"             label="Diferencia"                       />
                <ThSort col="pct"                    label="%"                                />
              </tr>
            </thead>
            <tbody>
              {productosMostrados.map(prod => {
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
                    <td style={{ ...td, textAlign: 'right' }} title="Se calcula solo: precio proveedor + IGV + Instalación + Ganancia + otros costos activos">
                      <span style={{ fontWeight: 700, color: f.tieneOferta ? '#1d4ed8' : 'var(--color-text-muted)' }}>{f.tieneOferta ? soles(f.oferta) : '—'}</span> <span style={{ fontSize: 11 }}>🔒</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <input type="number" step="0.01" value={valorActual(prod, 'precioReferencialVenta')} onChange={e => onEdit(prod.id, 'precioReferencialVenta', e.target.value)} onBlur={() => onBlurGuardar(prod, 'precioReferencialVenta')} placeholder="mercado" style={inp} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: f.col }}>{f.dif === null ? '—' : soles(f.dif)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>
                      {f.pct === null ? <span style={{ color: 'var(--color-text-muted)' }}>—</span> : (
                        <span style={{ background: f.col + '18', color: f.col, padding: '3px 8px', borderRadius: 999, fontSize: 12 }}>
                          {f.pct >= 0 ? '▲ +' : '▼ '}{f.pct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {productosMostrados.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>No hay productos con ese filtro.</div>
      )}

      {/* Paginación — solo cuando NO hay sort/filtro por columna calculada */}
      {!forzarTodos && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 18 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: page === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: page === 1 ? 'default' : 'pointer' }}>
            ← Anterior
          </button>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: page === totalPages ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: page === totalPages ? 'default' : 'pointer' }}>
            Siguiente →
          </button>
        </div>
      )}
      {forzarTodos && total > 0 && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 14 }}>
          Mostrando {productosMostrados.length} de {total} producto{total !== 1 ? 's' : ''} {filtroDif === 'verde' ? '(diferencia positiva)' : '(orden global)'}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 14 }}>
        <strong>Precio oferta 🔒</strong> = precio proveedor + IGV + Instalación + Ganancia + otros costos activos — se calcula solo, no se edita a mano. Al editar el precio proveedor se recalcula al instante; al guardar costos globales se recalcula para todo el catálogo.{' '}
        <strong>Sincronizar precio regular</strong> lleva ese precio oferta (+5%) a Inventario para todos los productos.{' '}
        <strong>Precio referencial</strong> = precio de mercado / competencia.{' '}
        <strong>Diferencia</strong> = precio referencial − precio oferta. En <span style={{ color: '#16a34a', fontWeight: 700 }}>verde</span> cuando el referencial supera tu precio oferta (estás por debajo del mercado); en <span style={{ color: '#dc2626', fontWeight: 700 }}>rojo</span> cuando tu precio oferta supera al referencial.
        Haz clic en cualquier columna para ordenar.
      </div>
    </div>
  );
}
