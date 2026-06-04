import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productosApi, sedesApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useIsMobile } from '../hooks/useIsMobile';

const fmt   = (v) => v ? `S/ ${parseFloat(v).toFixed(2)}` : '—';
const fmtPct = (v) => v ? `${parseFloat(v).toFixed(0)}%` : '—';

// Columnas fijas del sistema
const COLUMNAS_FIJAS = [
  { key: 'medida',          label: 'Medida',          group: 'Producto',  required: true },
  { key: 'marca',           label: 'Marca',           group: 'Producto',  required: true },
  { key: 'nombreComercial', label: 'Nombre Comercial', group: 'Producto' },
  { key: 'grupo',           label: 'Grupo',           group: 'Producto' },
  { key: 'precioRegular',   label: 'Precio Regular',  group: 'Precios' },
  { key: 'precioOferta',    label: 'Precio Oferta',   group: 'Precios' },
  { key: 'descuentoMaximo', label: 'Descuento Máx.',  group: 'Precios' },
  { key: 'garantia',        label: 'Garantía',        group: 'Técnico' },
  { key: 'fichaTecnica',    label: 'Ficha Técnica',   group: 'Técnico' },
  { key: 'stockTotal',      label: 'Stock Total',     group: 'Stock' },
  { key: 'stock_L0',        label: 'Almacén Central', group: 'Stock' },
  { key: 'stock_L1',        label: 'Santa Anita',     group: 'Stock' },
  { key: 'stock_L2',        label: 'Surco',           group: 'Stock' },
  { key: 'stock_L3',        label: 'Surquillo',       group: 'Stock' },
  { key: 'stock_L4',        label: 'Miraflores',      group: 'Stock' },
  { key: 'stock_L5',        label: 'Pueblo Libre',    group: 'Stock' },
  { key: 'sku',             label: 'SKU',             group: 'Producto' },
  { key: 'tipo',            label: 'Tipo',            group: 'Producto' },
];

const STORAGE_KEY = 'inventario_columnas_v2';
const STORAGE_CUSTOM_KEY = 'inventario_columnas_custom';

const defaultVisible = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  return COLUMNAS_FIJAS.filter(c => ['medida','marca','nombreComercial','grupo','precioRegular','precioOferta','descuentoMaximo','stockTotal','stock_L0','stock_L1','stock_L2','stock_L3','stock_L4','stock_L5'].includes(c.key)).map(c => c.key);
};

function getStockLocal(producto, codigoLocal) {
  return producto.stocks?.find(s => s.sede?.codigoLocal === codigoLocal)?.cantidad ?? 0;
}

function getCellValue(prod, key) {
  if (key.startsWith('stock_')) {
    const cod = key.replace('stock_', '').toUpperCase();
    return getStockLocal(prod, cod);
  }
  if (key === 'stockTotal') return prod.stocks?.reduce((a, s) => a + s.cantidad, 0) ?? 0;
  if (key === 'precioRegular') return fmt(prod.precioRegular);
  if (key === 'precioOferta')  return fmt(prod.precioOferta);
  if (key === 'descuentoMaximo') return fmtPct(prod.descuentoMaximo);
  if (key === 'camposExtra' || (prod.camposExtra && key in prod.camposExtra)) {
    return prod.camposExtra?.[key] ?? '—';
  }
  return prod[key] ?? '—';
}

function StockCell({ value }) {
  const color = value > 10 ? '#16a34a' : value > 3 ? '#ca8a04' : value > 0 ? '#f97316' : '#dc2626';
  return <span style={{ fontWeight: 700, color }}>{value}</span>;
}

// ── Gestor de columnas ────────────────────────────────────────────────────────
function GestorColumnas({ visibles, onToggle, onCrear, onEliminar, customCols, onClose }) {
  const [nuevaCol, setNuevaCol] = useState('');
  const groups = [...new Set(COLUMNAS_FIJAS.map(c => c.group))];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'var(--color-surface)', borderRadius:14, width:'100%', maxWidth:520, maxHeight:'90dvh', overflowY:'auto', padding:28 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700 }}>Gestionar Columnas</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--color-text-muted)' }}>✕</button>
        </div>

        {/* Columnas del sistema agrupadas */}
        {groups.map(group => (
          <div key={group} style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#f5c400', textTransform:'uppercase', letterSpacing:1.5, marginBottom:8, borderBottom:'1px solid var(--color-border)', paddingBottom:4 }}>{group}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {COLUMNAS_FIJAS.filter(c => c.group === group).map(col => (
                <label key={col.key} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:'var(--color-bg)', cursor:col.required?'default':'pointer', opacity:col.required?.5:1 }}>
                  <input
                    type="checkbox"
                    checked={visibles.includes(col.key)}
                    disabled={col.required}
                    onChange={() => onToggle(col.key)}
                    style={{ width:14, height:14, accentColor:'#f5c400' }}
                  />
                  <span style={{ fontSize:12, fontWeight:500 }}>{col.label}</span>
                  {col.required && <span style={{ fontSize:10, color:'var(--color-text-muted)' }}>(fija)</span>}
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Columnas personalizadas */}
        {customCols.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#8b5cf6', textTransform:'uppercase', letterSpacing:1.5, marginBottom:8, borderBottom:'1px solid var(--color-border)', paddingBottom:4 }}>Columnas Personalizadas</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {customCols.map(col => (
                <div key={col.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', borderRadius:8, background:'var(--color-bg)', border:'1px solid #8b5cf620' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                    <input type="checkbox" checked={visibles.includes(col.key)} onChange={() => onToggle(col.key)} style={{ width:14, height:14, accentColor:'#8b5cf6' }} />
                    <span style={{ fontSize:12, fontWeight:500 }}>{col.label}</span>
                  </label>
                  <button
                    onClick={() => onEliminar(col)}
                    style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'2px 8px', fontSize:11, color:'#dc2626', cursor:'pointer' }}
                  >✕ Eliminar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Crear nueva columna */}
        <div style={{ borderTop:'1px solid var(--color-border)', paddingTop:16 }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:1 }}>Agregar columna personalizada</div>
          <div style={{ display:'flex', gap:8 }}>
            <input
              value={nuevaCol}
              onChange={e => setNuevaCol(e.target.value)}
              placeholder="Nombre de la columna (ej: Proveedor)"
              style={{ flex:1, padding:'8px 12px', border:'1.5px solid var(--color-border)', borderRadius:8, fontSize:13, background:'var(--color-surface)', color:'var(--color-text)' }}
              onKeyDown={e => { if (e.key==='Enter' && nuevaCol.trim()) { onCrear(nuevaCol.trim()); setNuevaCol(''); } }}
            />
            <button
              onClick={() => { if (nuevaCol.trim()) { onCrear(nuevaCol.trim()); setNuevaCol(''); } }}
              disabled={!nuevaCol.trim()}
              style={{ padding:'8px 16px', background:'#f5c400', color:'#000', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}
            >+ Agregar</button>
          </div>
          <div style={{ fontSize:11, color:'var(--color-text-muted)', marginTop:6 }}>La columna aparecerá en todas las llantas para ingresar información adicional.</div>
        </div>
      </div>
    </div>
  );
}

// ── Celda editable inline ─────────────────────────────────────────────────────
function CeldaEditable({ value, prodId, campo, onSave, isCustom }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value === '—' ? '' : String(value || ''));
  const ref = useRef();

  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (String(val) !== String(value === '—' ? '' : value || '')) {
      onSave(prodId, campo, val, isCustom);
    }
  };

  if (editing) {
    return (
      <input
        ref={ref} value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        style={{ width:'100%', padding:'2px 6px', fontSize:12, border:'1.5px solid #f5c400', borderRadius:4, background:'#fffbeb', outline:'none' }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Clic para editar"
      style={{ cursor:'text', display:'block', minHeight:20, padding:'1px 2px', borderRadius:3, color: value === '—' || value === 0 ? 'var(--color-text-muted)' : undefined }}
    >
      {value === 0 ? <StockCell value={0} /> : String(value)}
    </span>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Inventario() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [page, setPage] = useState(1);
  const [visibles, setVisibles] = useState(defaultVisible);
  const [customCols, setCustomCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_CUSTOM_KEY) || '[]'); } catch { return []; }
  });
  const [showGestor, setShowGestor] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['productos', { q, tipo, page }],
    queryFn: () => productosApi.listar({ q, tipo, page, limit: 50 }),
    keepPreviousData: true,
  });

  const productos = data?.data || [];
  const total = data?.total || 0;

  // Todas las columnas (fijas + custom)
  const todasColumnas = [
    ...COLUMNAS_FIJAS,
    ...customCols.map(c => ({ ...c, group: 'Personalizado' })),
  ];
  const columnasVisibles = todasColumnas.filter(c => visibles.includes(c.key));

  const toggleColumna = (key) => {
    const col = COLUMNAS_FIJAS.find(c => c.key === key);
    if (col?.required) return;
    setVisibles(v => {
      const next = v.includes(key) ? v.filter(k => k !== key) : [...v, key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const crearColumna = (nombre) => {
    const key = 'custom_' + nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (customCols.find(c => c.key === key)) { toast.error('Ya existe esa columna'); return; }
    const newCol = { key, label: nombre };
    const updated = [...customCols, newCol];
    setCustomCols(updated);
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(updated));
    setVisibles(v => { const next = [...v, key]; localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next; });
    toast.success(`Columna "${nombre}" creada`);
  };

  const eliminarColumna = (col) => {
    // Verificar si algún producto tiene dato en esta columna
    const conDatos = productos.filter(p => p.camposExtra?.[col.key]);
    if (conDatos.length > 0) {
      if (!window.confirm(`⚠️ ${conDatos.length} producto(s) tienen datos en "${col.label}". ¿Eliminar la columna y borrar esos datos?`)) return;
      // Borrar datos en productos con esta columna
      conDatos.forEach(p => {
        const camposExtra = { ...p.camposExtra };
        delete camposExtra[col.key];
        productosApi.actualizar(p.id, { camposExtra });
      });
    }
    const updated = customCols.filter(c => c.key !== col.key);
    setCustomCols(updated);
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(updated));
    setVisibles(v => { const next = v.filter(k => k !== col.key); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next; });
    qc.invalidateQueries(['productos']);
    toast.success(`Columna "${col.label}" eliminada`);
  };

  const guardarCelda = async (prodId, campo, valor, isCustom) => {
    try {
      if (isCustom) {
        const prod = productos.find(p => p.id === prodId);
        const camposExtra = { ...(prod?.camposExtra || {}), [campo]: valor };
        await productosApi.actualizar(prodId, { camposExtra });
      } else {
        let v = valor;
        if (['precioRegular','precioOferta','descuentoMaximo'].includes(campo)) {
          v = valor ? parseFloat(valor.replace('S/ ','').replace('%','')) : null;
        }
        await productosApi.actualizar(prodId, { [campo]: v });
      }
      qc.invalidateQueries(['productos']);
      toast.success('Guardado');
    } catch { toast.error('Error al guardar'); }
  };

  const TIPO_COLOR = { AUTO: '#3b82f6', CAMIONETA: '#8b5cf6', CAMION: '#f59e0b', MOTO: '#ec4899' };

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight:700 }}>Inventario</div>
          <div style={{ fontSize:12, color:'var(--color-text-muted)', marginTop:2 }}>{total} productos · {columnasVisibles.length} columnas visibles</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={() => setShowGestor(true)}
            style={{ padding:'8px 16px', border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
          >
            ⚙️ Columnas
          </button>
          <Link to="/importar" style={{ padding:'8px 16px', background:'#f5c400', color:'#000', borderRadius:8, fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
            📂 {isMobile ? '' : 'Importar'}
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <input
          style={{ flex:'1 1 180px', padding:'9px 14px', fontSize:14, border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', color:'var(--color-text)', minWidth:0 }}
          placeholder="Medida, marca, SKU..."
          value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
        />
        <select
          style={{ padding:'9px 12px', fontSize:13, border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', color:'var(--color-text)' }}
          value={tipo} onChange={e => { setTipo(e.target.value); setPage(1); }}
        >
          <option value="">Todos</option>
          <option value="AUTO">Auto</option>
          <option value="CAMIONETA">Camioneta</option>
          <option value="CAMION">Camión</option>
          <option value="MOTO">Moto</option>
        </select>
      </div>

      {isLoading ? <LoadingSpinner fullPage /> : productos.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--color-text-muted)' }}>
          <div style={{ fontSize:44 }}>🛞</div>
          <div style={{ marginTop:12, fontWeight:600 }}>Sin productos</div>
        </div>
      ) : (
        /* ── Tabla responsiva ── */
        <div style={{ overflowX:'auto', borderRadius:10, boxShadow:'var(--shadow)', border:'1px solid var(--color-border)' }}>
          <table style={{ borderCollapse:'collapse', background:'var(--color-surface)', fontSize:12.5, minWidth: columnasVisibles.length * 110 }}>
            <thead>
              <tr style={{ background:'var(--color-primary)' }}>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#f5c400', whiteSpace:'nowrap', position:'sticky', left:0, background:'var(--color-primary)', zIndex:2, minWidth:100 }}>Acciones</th>
                {columnasVisibles.map(col => (
                  <th key={col.key} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'rgba(255,255,255,.85)', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:.5, borderLeft:'1px solid rgba(255,255,255,.1)' }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productos.map((prod, idx) => (
                <tr key={prod.id} style={{ background: idx%2===0 ? 'var(--color-surface)' : 'var(--color-bg)', borderBottom:'1px solid var(--color-border)' }}>
                  {/* Acciones — sticky */}
                  <td style={{ padding:'8px 10px', position:'sticky', left:0, background: idx%2===0 ? 'var(--color-surface)' : 'var(--color-bg)', zIndex:1, borderRight:'2px solid var(--color-border)' }}>
                    <Link to={`/inventario/${prod.id}`} style={{ fontSize:11, padding:'3px 8px', background:'var(--color-primary)', color:'#f5c400', borderRadius:6, fontWeight:700, whiteSpace:'nowrap' }}>
                      Ver →
                    </Link>
                  </td>
                  {columnasVisibles.map(col => {
                    const raw = getCellValue(prod, col.key);
                    const isStock = col.key.startsWith('stock_') || col.key === 'stockTotal';
                    const isCustom = col.key.startsWith('custom_');
                    const isEditable = !['medida','marca','stockTotal'].includes(col.key) && !col.key.startsWith('stock_');

                    return (
                      <td key={col.key} style={{ padding:'6px 12px', borderLeft:'1px solid var(--color-border)', whiteSpace:'nowrap', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis' }}>
                        {isStock ? (
                          <StockCell value={typeof raw === 'number' ? raw : parseInt(raw)||0} />
                        ) : isEditable ? (
                          <CeldaEditable
                            value={raw} prodId={prod.id} campo={col.key}
                            onSave={guardarCelda} isCustom={isCustom}
                          />
                        ) : (
                          <span style={{ color: col.key==='tipo' ? TIPO_COLOR[raw] : undefined, fontWeight: col.key==='medida'?700:undefined }}>
                            {raw}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {total > 50 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16 }}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', fontSize:13, fontWeight:600 }}>← Anterior</button>
          <span style={{ padding:'8px 14px', fontSize:13, color:'var(--color-text-muted)' }}>Pág. {page}</span>
          <button onClick={()=>setPage(p=>p+1)} disabled={productos.length<50} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', fontSize:13, fontWeight:600 }}>Siguiente →</button>
        </div>
      )}

      {/* Gestor de columnas */}
      {showGestor && (
        <GestorColumnas
          visibles={visibles}
          onToggle={toggleColumna}
          onCrear={crearColumna}
          onEliminar={eliminarColumna}
          customCols={customCols}
          onClose={() => setShowGestor(false)}
        />
      )}
    </div>
  );
}
