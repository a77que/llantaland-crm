import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productosApi, sedesApi, stockApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useIsMobile } from '../hooks/useIsMobile';
import ProductoModal from '../components/ProductoModal';
import ComparadorModal from '../components/ComparadorModal';

const fmt   = (v) => v ? `S/ ${parseFloat(v).toFixed(2)}` : '—';
const fmtPct = (v) => v ? `${parseFloat(v).toFixed(0)}%` : '—';

function parseMedida(medida) {
  const m = String(medida || '').match(/(\d{3})[\s/]?(\d{2,3})[\s/]?[Rr][\s]?(\d{2,3})/);
  if (!m) return { ancho: null, perfil: null, radio: null };
  return { ancho: parseInt(m[1]), perfil: parseInt(m[2]), radio: parseInt(m[3]) };
}

// Columnas fijas del sistema
const COLUMNAS_FIJAS = [
  { key: 'medida',          label: 'Medida',          group: 'Producto',  required: true },
  { key: 'ancho',           label: 'Ancho (mm)',       group: 'Medida' },
  { key: 'perfil',          label: 'Perfil (%)',       group: 'Medida' },
  { key: 'radio',           label: 'Radio (R)',        group: 'Medida' },
  { key: 'marca',           label: 'Marca',           group: 'Producto',  required: true },
  { key: 'nombreComercial', label: 'Nombre Comercial', group: 'Producto' },
  { key: 'grupo',           label: 'Grupo',           group: 'Producto' },
  { key: 'precioRegular',   label: 'Precio Regular',  group: 'Precios' },
  { key: 'precioOferta',    label: 'Precio Oferta',   group: 'Precios' },
  { key: 'descuentoMaximo', label: 'Descuento Máx.',  group: 'Precios' },
  { key: 'garantia',        label: 'Garantía',        group: 'Técnico' },
  { key: 'fichaTecnica',    label: 'Ficha Técnica',   group: 'Técnico' },
  { key: 'indice_carga',    label: 'Indice Carga',    group: 'Tecnico' },
  { key: 'cargaMaxNeumatico', label: 'Carga Max. kg', group: 'Tecnico' },
  { key: 'velocidad_max',   label: 'Indice Vel.',     group: 'Tecnico' },
  { key: 'velocidadMaxKmh', label: 'Vel. Max. km/h',  group: 'Tecnico' },
  { key: 'eficienciaCombustible', label: 'Combustible EU', group: 'Etiqueta EU' },
  { key: 'eficienciaFrenado', label: 'Frenado EU',    group: 'Etiqueta EU' },
  { key: 'nivelRuido',      label: 'Ruido dB',         group: 'Etiqueta EU' },
  { key: 'paisFabricacion', label: 'Pais Fabricacion', group: 'Origen' },
  { key: 'origenMarca',     label: 'Origen Marca',     group: 'Origen' },
  { key: 'stockTotal',      label: 'Stock Total',     group: 'Stock' },
  // Las columnas de stock por almacén (stock_LX) se generan dinámicamente desde las sedes
  { key: 'sku',             label: 'SKU',             group: 'Producto' },
  { key: 'tipo',            label: 'Tipo',            group: 'Producto' },
];

const STORAGE_KEY = 'inventario_columnas_v2';
const STORAGE_CUSTOM_KEY = 'inventario_columnas_custom';
const STORAGE_STOCK_KNOWN = 'inventario_stock_known'; // almacenes ya vistos (para mostrar los nuevos automáticamente)

// Columnas visibles por defecto (sin stock por almacén; esas se agregan dinámicamente al cargar sedes)
const defaultVisible = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  return [
    'medida','ancho','perfil','radio',
    'marca','nombreComercial','grupo','precioRegular','precioOferta','descuentoMaximo',
    'indice_carga','velocidad_max','cargaMaxNeumatico','velocidadMaxKmh',
    'eficienciaCombustible','eficienciaFrenado','nivelRuido','paisFabricacion','origenMarca',
    'stockTotal',
  ];
};

function getStockLocal(producto, codigoLocal) {
  return producto.stocks?.find(s => s.sede?.codigoLocal === codigoLocal)?.cantidad ?? 0;
}

function getCellValue(prod, key) {
  if (key === 'ancho')  { const p = parseMedida(prod.medida); return p.ancho  ?? '—'; }
  if (key === 'perfil') { const p = parseMedida(prod.medida); return p.perfil ?? '—'; }
  if (key === 'radio')  { const p = parseMedida(prod.medida); return p.radio  ?? '—'; }
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
const TIPO_ICONO = { texto:'📝', numero:'🔢', select:'📋', fecha:'📅', booleano:'✅' };
const TIPO_LABEL = { texto:'Texto', numero:'Número', select:'Opciones', fecha:'Fecha', booleano:'Sí/No' };

function GestorColumnas({ visibles, onToggle, onCrear, onEliminar, customCols, columnasFijas, onClose }) {
  const [nuevaCol, setNuevaCol] = useState('');
  const [tipoNuevaCol, setTipoNuevaCol] = useState('texto');
  const [opcionesNuevaCol, setOpcionesNuevaCol] = useState('');
  const cols = columnasFijas || COLUMNAS_FIJAS;
  const groups = [...new Set(cols.map(c => c.group))];

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
              {cols.filter(c => c.group === group).map(col => (
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
                    <span style={{ fontSize:12, fontWeight:600 }}>{col.label}</span>
                    <span style={{ fontSize:10, padding:'1px 6px', borderRadius:6, background:'#8b5cf620', color:'#8b5cf6', fontWeight:700 }}>
                      {TIPO_ICONO[col.tipo||'texto']} {TIPO_LABEL[col.tipo||'texto']}
                    </span>
                  </label>
                  <button
                    onClick={() => onEliminar(col)}
                    style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'2px 8px', fontSize:11, color:'#dc2626', cursor:'pointer' }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Crear nueva columna */}
        <div style={{ borderTop:'1px solid var(--color-border)', paddingTop:16 }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:10, color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:1 }}>Agregar columna personalizada</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <input
              value={nuevaCol}
              onChange={e => setNuevaCol(e.target.value)}
              placeholder="Nombre de la columna (ej: Proveedor, Origen, Temporada)"
              style={{ padding:'9px 12px', border:'1.5px solid var(--color-border)', borderRadius:8, fontSize:13, background:'var(--color-surface)', color:'var(--color-text)' }}
            />
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', letterSpacing:1, whiteSpace:'nowrap' }}>Tipo de dato:</div>
              <select
                value={tipoNuevaCol}
                onChange={e => setTipoNuevaCol(e.target.value)}
                style={{ flex:1, padding:'8px 10px', border:'1.5px solid var(--color-border)', borderRadius:8, fontSize:13, background:'var(--color-surface)', color:'var(--color-text)' }}
              >
                <option value="texto">📝 Texto libre</option>
                <option value="numero">🔢 Número</option>
                <option value="select">📋 Lista de opciones</option>
                <option value="fecha">📅 Fecha</option>
                <option value="booleano">✅ Sí / No</option>
              </select>
            </div>
            {tipoNuevaCol === 'select' && (
              <input
                value={opcionesNuevaCol}
                onChange={e => setOpcionesNuevaCol(e.target.value)}
                placeholder="Opciones separadas por coma (ej: Rojo,Verde,Azul)"
                style={{ padding:'8px 12px', border:'1.5px solid #f5c40060', borderRadius:8, fontSize:13, background:'#fffbeb', color:'var(--color-text)' }}
              />
            )}
            <button
              onClick={() => {
                if (!nuevaCol.trim()) return;
                const opciones = tipoNuevaCol === 'select' ? opcionesNuevaCol.split(',').map(o=>o.trim()).filter(Boolean) : [];
                onCrear(nuevaCol.trim(), tipoNuevaCol, opciones);
                setNuevaCol(''); setOpcionesNuevaCol('');
              }}
              disabled={!nuevaCol.trim() || (tipoNuevaCol==='select' && !opcionesNuevaCol.trim())}
              style={{ padding:'9px 16px', background:'#f5c400', color:'#000', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}
            >+ Agregar columna</button>
          </div>
          <div style={{ fontSize:11, color:'var(--color-text-muted)', marginTop:6 }}>Aparecerá en todas las llantas para registrar esa información.</div>
        </div>
      </div>
    </div>
  );
}

const GRUPO_OPCIONES = ['Excelente', 'Muy Buena', 'Buena'];  // debe coincidir con n8n
const GRUPO_COLOR = { 'Excelente': '#16a34a', 'Muy Buena': '#3b82f6', 'Buena': '#f59e0b' };

// ── Celda editable inline ─────────────────────────────────────────────────────
function CeldaEditable({ value, prodId, campo, onSave, isCustom, colDef, marcas = [], tipos = [] }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value === '—' ? '' : String(value || ''));
  const ref = useRef();

  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const save = (newVal) => {
    const v = newVal !== undefined ? newVal : val;
    setEditing(false);
    if (String(v) !== String(value === '—' ? '' : value || '')) {
      onSave(prodId, campo, v, isCustom);
    }
  };

  // Grupo — dropdown fijo
  if (campo === 'grupo') {
    const color = GRUPO_COLOR[value] || 'var(--color-text-muted)';
    if (editing) {
      return (
        <select ref={ref} value={val} autoFocus
          onChange={e => { setVal(e.target.value); save(e.target.value); }}
          onBlur={() => setEditing(false)}
          style={{ width:'100%', padding:'2px 6px', fontSize:12, border:'1.5px solid #f5c400', borderRadius:4, background:'#fffbeb', outline:'none' }}>
          <option value="">— Sin grupo —</option>
          {GRUPO_OPCIONES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <span onClick={() => setEditing(true)} title="Clic para editar"
        style={{ cursor:'pointer', display:'block', minHeight:20, fontWeight:600, color }}>
        {value === '—' ? <span style={{ color:'var(--color-text-muted)', fontWeight:400 }}>— Clic para asignar</span> : value}
      </span>
    );
  }

  // Marca — dropdown con todas las marcas del sistema
  if (campo === 'marca') {
    if (editing) {
      return (
        <select ref={ref} value={val} autoFocus
          onChange={e => { setVal(e.target.value); save(e.target.value); }}
          onBlur={() => setEditing(false)}
          style={{ width:'100%', padding:'2px 6px', fontSize:12, border:'1.5px solid #f5c400', borderRadius:4, background:'#fffbeb', outline:'none' }}>
          <option value="">— Sin marca —</option>
          {marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      );
    }
    return (
      <span onClick={() => setEditing(true)} title="Clic para editar"
        style={{ cursor:'pointer', display:'block', minHeight:20, fontWeight:700 }}>
        {value === '—' ? <span style={{ color:'var(--color-text-muted)', fontWeight:400 }}>— Clic para asignar</span> : value}
      </span>
    );
  }

  // Tipo — texto libre con sugerencias (no limitado a opciones fijas)
  if (campo === 'tipo') {
    const tipoColor = { AUTO: '#3b82f6', CAMIONETA: '#8b5cf6', CAMION: '#f59e0b', MOTO: '#ec4899' };
    const sugerencias = [...new Set(['AUTO', 'CAMIONETA', 'CAMION', 'MOTO', ...tipos])];
    if (editing) {
      return (
        <>
          <input ref={ref} list={`tipos-dl-${prodId}`} value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={() => save()}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="AUTO, SUV, VAN..."
            style={{ width:'100%', padding:'2px 6px', fontSize:12, border:'1.5px solid #f5c400', borderRadius:4, background:'#fffbeb', outline:'none' }}
          />
          <datalist id={`tipos-dl-${prodId}`}>
            {sugerencias.map(t => <option key={t} value={t} />)}
          </datalist>
        </>
      );
    }
    return (
      <span onClick={() => setEditing(true)} title="Clic para editar"
        style={{ cursor:'pointer', display:'block', minHeight:20, fontWeight:600, color: tipoColor[value] || 'var(--color-text)' }}>
        {value === '—' ? <span style={{ color:'var(--color-text-muted)', fontWeight:400 }}>— Clic para asignar</span> : value}
      </span>
    );
  }

  // Columna custom tipo select
  if (isCustom && colDef?.tipo === 'select' && colDef?.opciones?.length > 0) {
    if (editing) {
      return (
        <select ref={ref} value={val} autoFocus
          onChange={e => { setVal(e.target.value); save(e.target.value); }}
          onBlur={() => setEditing(false)}
          style={{ width:'100%', padding:'2px 6px', fontSize:12, border:'1.5px solid #f5c400', borderRadius:4, background:'#fffbeb', outline:'none' }}>
          <option value="">— Elegir —</option>
          {colDef.opciones.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <span onClick={() => setEditing(true)} title="Clic para elegir"
        style={{ cursor:'pointer', display:'block', minHeight:20, padding:'1px 2px' }}>
        {value === '—' ? <span style={{ color:'var(--color-text-muted)' }}>— Elegir</span> : value}
      </span>
    );
  }

  // Tipo booleano
  if (isCustom && colDef?.tipo === 'booleano') {
    const isTrue = value === 'true' || value === true || value === 'Sí';
    return (
      <span onClick={() => save(isTrue ? 'No' : 'Sí')} title="Clic para cambiar"
        style={{ cursor:'pointer', display:'block', fontWeight:700, color: isTrue ? '#16a34a' : '#dc2626' }}>
        {value === '—' ? '—' : isTrue ? '✅ Sí' : '❌ No'}
      </span>
    );
  }

  // Stock por local — input numérico con display coloreado
  if (campo.startsWith('stock_')) {
    if (editing) {
      return (
        <input ref={ref} type="number" min="0" value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => save()}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          style={{ width:'100%', padding:'2px 6px', fontSize:12, border:'1.5px solid #f5c400', borderRadius:4, background:'#fffbeb', outline:'none' }}
        />
      );
    }
    const num = typeof value === 'number' ? value : parseInt(value) || 0;
    return (
      <span onClick={() => setEditing(true)} title="Clic para editar" style={{ cursor:'pointer', display:'block', minHeight:20 }}>
        <StockCell value={num} />
      </span>
    );
  }

  // Input genérico (texto, número, fecha)
  const inputType = isCustom && colDef?.tipo === 'numero' ? 'number' : isCustom && colDef?.tipo === 'fecha' ? 'date' : 'text';

  if (editing) {
    return (
      <input ref={ref} type={inputType} value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => save()}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        style={{ width:'100%', padding:'2px 6px', fontSize:12, border:'1.5px solid #f5c400', borderRadius:4, background:'#fffbeb', outline:'none' }}
      />
    );
  }

  return (
    <span onClick={() => setEditing(true)} title="Clic para editar"
      style={{ cursor:'text', display:'block', minHeight:20, padding:'1px 2px', borderRadius:3, color: value === '—' || value === 0 ? 'var(--color-text-muted)' : undefined }}
    >
      {value === 0 ? <StockCell value={0} /> : String(value)}
    </span>
  );
}

// ── Columnas que se pueden ordenar y su campo API ──────────────────────────────
const SORTABLE = {
  medida: 'medida', marca: 'marca', nombreComercial: 'nombreComercial',
  grupo: 'grupo', precioRegular: 'precioRegular', precioOferta: 'precioOferta',
  descuentoMaximo: 'descuentoMaximo', garantia: 'garantia', sku: 'sku', tipo: 'tipo',
  indice_carga: 'indice_carga', velocidad_max: 'velocidad_max',
  cargaMaxNeumatico: 'cargaMaxNeumatico', velocidadMaxKmh: 'velocidadMaxKmh',
  eficienciaCombustible: 'eficienciaCombustible', eficienciaFrenado: 'eficienciaFrenado',
  nivelRuido: 'nivelRuido', paisFabricacion: 'paisFabricacion', origenMarca: 'origenMarca',
};

// ── Aplicar valor masivo con input inteligente según campo ────────────────────
function MassBulkApply({ columnasVisibles, customCols, seleccionados, setCambiosMasivos, marcas = [], tipos = [] }) {
  const [campo, setCampo] = useState('grupo');
  const [sedeLocal, setSedeLocal] = useState('');
  const [valor, setValor] = useState('');

  // Stock cols visibles — para el sub-selector de local
  const stockCols = columnasVisibles.filter(c => c.key.startsWith('stock_'));

  // Columnas editables: sin stock individual (se agrupan bajo __stock__)
  const editableCols = [
    ...columnasVisibles.filter(c => c.key !== 'medida' && c.key !== 'stockTotal' && !c.key.startsWith('stock_')),
    ...(stockCols.length > 0 ? [{ key: '__stock__', label: 'Stock' }] : []),
  ];

  const colDef = customCols.find(c => c.key === campo);
  const isGrupo       = campo === 'grupo';
  const isTipo        = campo === 'tipo';
  const isMarca       = campo === 'marca';
  const isStockGroup  = campo === '__stock__';
  const isSelectCustom = colDef?.tipo === 'select' && colDef?.opciones?.length > 0;
  const isBool  = colDef?.tipo === 'booleano';
  const isNum   = colDef?.tipo === 'numero' || ['precioRegular','precioOferta','descuentoMaximo'].includes(campo) || isStockGroup;
  const isFecha = colDef?.tipo === 'fecha';

  const aplicar = () => {
    const realCampo = isStockGroup ? sedeLocal : campo;
    if (!realCampo || (!valor && !isBool)) return;
    setCambiosMasivos(prev => {
      const next = { ...prev };
      seleccionados.forEach(id => { next[id] = { ...(next[id]||{}), [realCampo]: valor }; });
      return next;
    });
    toast.success(`Aplicado a ${seleccionados.length} llantas`);
    setValor('');
  };

  const inp = { padding:'6px 10px', borderRadius:6, fontSize:12, border:'1px solid #555', background:'#1a1a1a', color:'#f0ede8' };

  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
      {/* Selector de campo */}
      <select value={campo} onChange={e => { setCampo(e.target.value); setValor(''); setSedeLocal(''); }} style={{ ...inp }}>
        {editableCols.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>

      {/* Sub-selector de local cuando campo es Stock */}
      {isStockGroup && (
        <select value={sedeLocal} onChange={e => { setSedeLocal(e.target.value); setValor(''); }} style={{ ...inp, width:150 }}>
          <option value="">— Elegir local —</option>
          {stockCols.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      )}

      {/* Input según tipo de campo */}
      {isMarca ? (
        <select value={valor} onChange={e => setValor(e.target.value)} style={{ ...inp, width:160 }}>
          <option value="">— Elegir marca —</option>
          {marcas.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      ) : isGrupo ? (
        <select value={valor} onChange={e => setValor(e.target.value)} style={{ ...inp, width:130 }}>
          <option value="">— Elegir —</option>
          {GRUPO_OPCIONES.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : isTipo ? (
        <>
          <input
            list="tipos-dl-masivo" value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder="AUTO, SUV..."
            style={{ ...inp, width:130 }}
            onKeyDown={e => { if (e.key === 'Enter') aplicar(); }}
          />
          <datalist id="tipos-dl-masivo">
            {[...new Set(['AUTO','CAMIONETA','CAMION','MOTO', ...tipos])].map(t => <option key={t} value={t} />)}
          </datalist>
        </>
      ) : isSelectCustom ? (
        <select value={valor} onChange={e => setValor(e.target.value)} style={{ ...inp, width:130 }}>
          <option value="">— Elegir —</option>
          {colDef.opciones.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : isBool ? (
        <select value={valor} onChange={e => setValor(e.target.value)} style={{ ...inp, width:100 }}>
          <option value="">— Elegir —</option>
          <option value="Sí">✅ Sí</option>
          <option value="No">❌ No</option>
        </select>
      ) : (!isStockGroup || sedeLocal) ? (
        <input
          value={valor} onChange={e => setValor(e.target.value)}
          type={isNum ? 'number' : isFecha ? 'date' : 'text'}
          min={isStockGroup ? 0 : undefined}
          placeholder={isStockGroup ? 'Cantidad...' : 'Nuevo valor...'}
          style={{ ...inp, width:110 }}
          onKeyDown={e => { if (e.key === 'Enter') aplicar(); }}
        />
      ) : null}

      <button
        onClick={aplicar}
        disabled={!campo || (!valor && !isBool) || (isStockGroup && !sedeLocal)}
        style={{ padding:'6px 12px', background:'#f5c400', color:'#000', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}
      >Aplicar</button>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Inventario() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();

  // Estado en URL — preserva búsqueda al volver desde detalle
  const [searchParams, setSearchParams] = useSearchParams();
  const q      = searchParams.get('q')      || '';
  const tipo   = searchParams.get('tipo')   || '';
  const page   = parseInt(searchParams.get('page')  || '1');
  const sortBy = searchParams.get('sortBy') || '';
  const sortDir= searchParams.get('sortDir')|| 'asc';

  const setParam = (key, val) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val) next.set(key, val); else next.delete(key);
      if (key !== 'page') next.set('page', '1'); // reset page on filter change
      return next;
    }, { replace: true });
  };

  const [visibles, setVisibles] = useState(defaultVisible);
  const [customCols, setCustomCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_CUSTOM_KEY) || '[]'); } catch { return []; }
  });
  const [showGestor, setShowGestor] = useState(false);
  // Modal de detalle y comparador
  const [modalProdId, setModalProdId] = useState(null);
  const [comparar, setComparar] = useState([]); // varios IDs para comparar
  const [verComparador, setVerComparador] = useState(false);
  // Edición masiva
  const [modoEdicion, setModoEdicion] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]);
  const [cambiosMasivos, setCambiosMasivos] = useState({});
  const [guardandoMasivo, setGuardandoMasivo] = useState(false);
  const [eliminandoMasivo, setEliminandoMasivo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['productos', { q, tipo, page, sortBy, sortDir }],
    queryFn: () => productosApi.listar({ q, tipo, page, limit: 50, orderBy: sortBy, orderDir: sortDir }),
    keepPreviousData: true,
  });

  const { data: sedesData = [] } = useQuery({
    queryKey: ['sedes'],
    queryFn: sedesApi.listar,
    staleTime: Infinity,
  });

  const { data: marcasList = [] } = useQuery({
    queryKey: ['marcas'],
    queryFn: productosApi.marcas,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tiposList = [] } = useQuery({
    queryKey: ['tipos'],
    queryFn: productosApi.tipos,
    staleTime: 5 * 60 * 1000,
  });

  const sedesMap = useMemo(() => {
    const m = {};
    sedesData.forEach(s => { if (s.codigoLocal) m[s.codigoLocal] = s.id; });
    return m;
  }, [sedesData]);

  // Función para ordenar al hacer clic en cabecera
  const handleSort = (colKey) => {
    const apiField = SORTABLE[colKey];
    if (!apiField) return; // columnas no ordenables (stock, custom)
    if (sortBy === apiField) {
      // Mismo campo → alternar dirección
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('sortDir', sortDir === 'asc' ? 'desc' : 'asc');
        next.set('page', '1');
        return next;
      }, { replace: true });
    } else {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('sortBy', apiField);
        next.set('sortDir', 'asc');
        next.set('page', '1');
        return next;
      }, { replace: true });
    }
  };

  const productos = data?.data || [];
  const total = data?.total || 0;

  // Columnas de stock por almacén — generadas dinámicamente desde las sedes activas
  const stockCols = useMemo(
    () => sedesData.filter(s => s.codigoLocal).map(s => ({ key: `stock_${s.codigoLocal}`, label: s.nombre, group: 'Stock' })),
    [sedesData]
  );

  // Columnas del sistema (fijas) con las de stock insertadas justo después de "Stock Total"
  const columnasSistema = useMemo(() => {
    const out = [];
    for (const c of COLUMNAS_FIJAS) {
      out.push(c);
      if (c.key === 'stockTotal') out.push(...stockCols);
    }
    return out;
  }, [stockCols]);

  // Mostrar automáticamente los almacenes nuevos (y recordar los ya vistos para no reponer los ocultados)
  useEffect(() => {
    if (!stockCols.length) return;
    const sedeKeys = stockCols.map(c => c.key);
    let known = [];
    try { known = JSON.parse(localStorage.getItem(STORAGE_STOCK_KNOWN) || '[]'); } catch { /* */ }
    const faltan = sedeKeys.filter(k => !known.includes(k) && !visibles.includes(k));
    if (faltan.length) {
      setVisibles(v => { const next = [...new Set([...v, ...faltan])]; localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next; });
    }
    const nuevoKnown = [...new Set([...known, ...sedeKeys])];
    if (nuevoKnown.length !== known.length) localStorage.setItem(STORAGE_STOCK_KNOWN, JSON.stringify(nuevoKnown));
  }, [stockCols]); // eslint-disable-line react-hooks/exhaustive-deps

  // Todas las columnas (sistema + stock dinámico + personalizadas)
  const todasColumnas = [
    ...columnasSistema,
    ...customCols.map(c => ({ ...c, group: 'Personalizado' })),
  ];
  const columnasVisibles = todasColumnas.filter(c => visibles.includes(c.key));

  const toggleColumna = (key) => {
    const col = columnasSistema.find(c => c.key === key);
    if (col?.required) return;
    setVisibles(v => {
      const next = v.includes(key) ? v.filter(k => k !== key) : [...v, key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const crearColumna = (nombre, tipo = 'texto', opciones = []) => {
    const key = 'custom_' + nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (customCols.find(c => c.key === key)) { toast.error('Ya existe esa columna'); return; }
    const newCol = { key, label: nombre, tipo, opciones };
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
      } else if (campo.startsWith('stock_')) {
        const codigoLocal = campo.replace('stock_', '').toUpperCase();
        const sedeId = sedesMap[codigoLocal];
        if (!sedeId) throw new Error('Sede no encontrada');
        await stockApi.actualizar(prodId, sedeId, { cantidad: parseInt(valor) || 0 });
      } else {
        let v = valor;
        if (['precioRegular','precioOferta','descuentoMaximo'].includes(campo)) {
          v = valor ? parseFloat(String(valor).replace('S/ ','').replace('%','')) : null;
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
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={() => setShowGestor(true)}
            style={{ padding:'8px 14px', border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            ⚙️ Columnas
          </button>
          <button
            onClick={() => { setModoEdicion(m => !m); setCambiosMasivos({}); setSeleccionados([]); }}
            style={{ padding:'8px 14px', border:`2px solid ${modoEdicion ? '#f5c400' : 'var(--color-border)'}`, borderRadius:8, background: modoEdicion ? '#fffbeb' : 'var(--color-surface)', color: modoEdicion ? '#b45309' : 'var(--color-text)', fontSize:13, fontWeight:700, cursor:'pointer' }}
          >
            {modoEdicion ? '✏️ Modo edición ON' : '✏️ Edición masiva'}
          </button>
          <Link to="/importar" style={{ padding:'8px 14px', background:'#f5c400', color:'#000', borderRadius:8, fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
            📂 {isMobile ? '' : 'Importar'}
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <input
          style={{ flex:'1 1 180px', padding:'9px 14px', fontSize:14, border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', color:'var(--color-text)', minWidth:0 }}
          placeholder="Medida, marca, SKU..."
          value={q} onChange={e => setParam('q', e.target.value)}
        />
        <select
          style={{ padding:'9px 12px', fontSize:13, border:'1.5px solid var(--color-border)', borderRadius:8, background:'var(--color-surface)', color:'var(--color-text)' }}
          value={tipo} onChange={e => setParam('tipo', e.target.value)}
        >
          <option value="">Todos</option>
          {(tiposList.length > 0 ? tiposList : ['AUTO', 'CAMIONETA', 'CAMION', 'MOTO']).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
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
              <tr style={{ background:'#1a2234' }}>
                <th style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#f5c400', whiteSpace:'nowrap', position:'sticky', left:0, background:'#1a2234', zIndex:2, minWidth: modoEdicion ? 50 : 100, letterSpacing:.5, textTransform:'uppercase' }}>
                  {modoEdicion ? (
                    <input type="checkbox"
                      checked={seleccionados.length === productos.length && productos.length > 0}
                      onChange={() => setSeleccionados(s => s.length === productos.length ? [] : productos.map(p=>p.id))}
                      style={{ width:16, height:16, accentColor:'#f5c400', cursor:'pointer' }}
                      title="Seleccionar todos"
                    />
                  ) : 'Acciones'}
                </th>
                {columnasVisibles.map(col => {
                  const isSortable = !!SORTABLE[col.key];
                  const isActive   = sortBy === SORTABLE[col.key];
                  const icon = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : (isSortable ? ' ⇅' : '');
                  const groupColors = { Precios:'#34d399', Técnico:'#a78bfa', Stock:'#60a5fa', Producto:'rgba(255,255,255,.75)', Personalizado:'#fb923c' };
                  const groupColor = groupColors[col.group] || 'rgba(255,255,255,.75)';
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700,
                        color: isActive ? '#f5c400' : groupColor,
                        whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:.5,
                        borderLeft:'1px solid rgba(255,255,255,.08)',
                        cursor: isSortable ? 'pointer' : 'default',
                        userSelect:'none',
                        background: isActive ? 'rgba(245,196,0,.12)' : undefined,
                        transition:'background .15s',
                      }}
                      title={isSortable ? `Ordenar por ${col.label}` : col.group}
                    >
                      {col.label}
                      <span style={{ opacity: isActive ? 1 : 0.5, fontSize:10 }}>{icon}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {productos.map((prod, idx) => {
                const isSel = seleccionados.includes(prod.id);
                const rowBg = isSel ? '#fffbeb' : idx%2===0 ? 'var(--color-surface)' : 'var(--color-bg)';
                return (
                  <tr key={prod.id} style={{ background: rowBg, borderBottom:'1px solid var(--color-border)', outline: isSel ? '2px solid #f5c400' : 'none', outlineOffset:'-1px' }}>
                    {/* Acciones — sticky */}
                    <td style={{ padding:'6px 8px', position:'sticky', left:0, background:rowBg, zIndex:1, borderRight:'2px solid var(--color-border)', whiteSpace:'nowrap' }}>
                      {modoEdicion ? (
                        <input type="checkbox" checked={isSel}
                          onChange={() => setSeleccionados(s => isSel ? s.filter(id=>id!==prod.id) : [...s, prod.id])}
                          style={{ width:16, height:16, accentColor:'#f5c400', cursor:'pointer' }}
                        />
                      ) : (
                        <button onClick={() => setModalProdId(prod.id)} style={{ fontSize:11, padding:'4px 10px', background:'#1a2234', color:'#f5c400', borderRadius:6, fontWeight:700, whiteSpace:'nowrap', border:'1px solid #f5c400', cursor:'pointer' }}>
                          Ver
                        </button>
                      )}
                    </td>
                    {columnasVisibles.map(col => {
                      // En modo edición masiva usar el valor pendiente si existe
                      const rawOriginal = getCellValue(prod, col.key);
                      const rawPendiente = cambiosMasivos[prod.id]?.[col.key];
                      const raw = rawPendiente !== undefined ? rawPendiente : rawOriginal;
                      const hasCambio = rawPendiente !== undefined && String(rawPendiente) !== String(rawOriginal === '—' ? '' : rawOriginal || '');

                      const isStockTotal = col.key === 'stockTotal';
                      const isCustom = col.key.startsWith('custom_');
                      const isEditable = col.key !== 'medida' && !isStockTotal;

                      // En modo edición masiva: guardar en estado local
                      const onSaveMasivo = (prodId, campo, valor, isC) => {
                        setCambiosMasivos(prev => ({
                          ...prev,
                          [prodId]: { ...(prev[prodId]||{}), [campo]: valor },
                        }));
                      };

                      return (
                        <td key={col.key} style={{ padding:'6px 12px', borderLeft:'1px solid var(--color-border)', whiteSpace:'nowrap', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', background: hasCambio ? '#fffbeb' : undefined }}>
                          {isStockTotal ? (
                            <StockCell value={typeof raw === 'number' ? raw : parseInt(raw)||0} />
                          ) : (isEditable && modoEdicion) ? (
                            <CeldaEditable
                              value={raw} prodId={prod.id} campo={col.key}
                              onSave={onSaveMasivo}
                              isCustom={isCustom}
                              colDef={isCustom ? customCols.find(c=>c.key===col.key) : null}
                              marcas={marcasList}
                              tipos={tiposList}
                            />
                          ) : col.key.startsWith('stock_') ? (
                            <StockCell value={typeof raw === 'number' ? raw : parseInt(raw)||0} />
                          ) : (
                            <span style={{ fontWeight: col.key==='medida'?700:undefined }}>
                              {raw}
                            </span>
                          )}
                          {hasCambio && <span style={{ fontSize:9, color:'#f59e0b', marginLeft:3 }}>●</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {total > 50 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16 }}>
          <button onClick={() => setSearchParams(p => { const n=new URLSearchParams(p); n.set('page', String(Math.max(1,page-1))); return n; }, {replace:true})} disabled={page===1} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', fontSize:13, fontWeight:600 }}>← Anterior</button>
          <span style={{ padding:'8px 14px', fontSize:13, color:'var(--color-text-muted)' }}>Pág. {page}</span>
          <button onClick={() => setSearchParams(p => { const n=new URLSearchParams(p); n.set('page', String(page+1)); return n; }, {replace:true})} disabled={productos.length<50} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid var(--color-border)', background:'var(--color-surface)', fontSize:13, fontWeight:600 }}>Siguiente →</button>
        </div>
      )}

      {/* Gestor de columnas */}
      {showGestor && (
        <GestorColumnas
          visibles={visibles} onToggle={toggleColumna}
          onCrear={crearColumna} onEliminar={eliminarColumna}
          customCols={customCols} columnasFijas={columnasSistema} onClose={() => setShowGestor(false)}
        />
      )}

      {/* Barra flotante de edición masiva */}
      {modoEdicion && (
        <div style={{
          position:'fixed', bottom: 80, left:'50%', transform:'translateX(-50%)',
          background:'#0f0f0f', border:'2px solid #f5c400', borderRadius:12,
          padding:'12px 20px', display:'flex', alignItems:'center', gap:14,
          boxShadow:'0 8px 32px rgba(0,0,0,.5)', zIndex:200, whiteSpace:'nowrap',
        }}>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.8)' }}>
            {seleccionados.length > 0 ? (
              <><span style={{ color:'#f5c400', fontWeight:700 }}>{seleccionados.length}</span> seleccionados</>
            ) : (
              <span style={{ color:'#888' }}>Selecciona filas para editar en masa</span>
            )}
            {Object.keys(cambiosMasivos).length > 0 && (
              <span style={{ marginLeft:10, color:'#f59e0b' }}>
                · <span style={{ fontWeight:700 }}>{Object.values(cambiosMasivos).reduce((a,v)=>a+Object.keys(v).length,0)}</span> cambios pendientes
              </span>
            )}
          </div>

          {/* Aplicar campo a seleccionados */}
          {seleccionados.length > 0 && <MassBulkApply
            columnasVisibles={columnasVisibles}
            customCols={customCols}
            seleccionados={seleccionados}
            setCambiosMasivos={setCambiosMasivos}
            marcas={marcasList}
            tipos={tiposList}
          />}

          {/* Eliminar seleccionados */}
          {seleccionados.length > 0 && (
            <button
              disabled={eliminandoMasivo}
              onClick={async () => {
                const detalle = seleccionados.slice(0, 5)
                  .map(id => { const p = productos.find(pr => pr.id === id); return p ? `• ${p.marca} ${p.medida} (${p.sku})` : null; })
                  .filter(Boolean).join('\n');
                const extra = seleccionados.length > 5 ? `\n...y ${seleccionados.length - 5} más` : '';
                if (!window.confirm(`⚠️ ¿Eliminar ${seleccionados.length} llanta(s) del catálogo?\n\n${detalle}${extra}\n\nDejarán de aparecer en el inventario y cotizaciones (el historial de ventas se conserva).`)) return;
                setEliminandoMasivo(true);
                try {
                  const r = await productosApi.eliminarMasivo(seleccionados);
                  qc.invalidateQueries(['productos']);
                  setSeleccionados([]);
                  setCambiosMasivos({});
                  toast.success(`🗑️ ${r.eliminados} llanta(s) eliminadas del catálogo`);
                } catch (e) {
                  toast.error(e?.error || 'Error al eliminar');
                } finally {
                  setEliminandoMasivo(false);
                }
              }}
              style={{ padding:'8px 14px', background:'transparent', color:'#f87171', border:'2px solid #dc2626', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}
            >
              {eliminandoMasivo ? '⏳ Eliminando...' : `🗑️ Eliminar (${seleccionados.length})`}
            </button>
          )}

          {Object.keys(cambiosMasivos).length > 0 && (
            <button
              disabled={guardandoMasivo}
              onClick={async () => {
                setGuardandoMasivo(true);
                let ok = 0;
                for (const [prodId, cambios] of Object.entries(cambiosMasivos)) {
                  const regularFields = {};
                  const customFields = {};
                  const stockFields = {};
                  for (const [campo, valor] of Object.entries(cambios)) {
                    if (campo.startsWith('custom_')) {
                      customFields[campo] = valor;
                    } else if (campo.startsWith('stock_')) {
                      stockFields[campo] = valor;
                    } else {
                      let v = valor;
                      if (['precioRegular','precioOferta','descuentoMaximo'].includes(campo)) {
                        v = valor ? parseFloat(String(valor).replace('S/ ','').replace('%','')) : null;
                      }
                      regularFields[campo] = v;
                    }
                  }
                  if (Object.keys(regularFields).length > 0) {
                    await productosApi.actualizar(prodId, regularFields).catch(() => {});
                    ok += Object.keys(regularFields).length;
                  }
                  if (Object.keys(customFields).length > 0) {
                    const prod = productos.find(p => p.id === prodId);
                    const camposExtra = { ...(prod?.camposExtra || {}), ...customFields };
                    await productosApi.actualizar(prodId, { camposExtra }).catch(() => {});
                    ok += Object.keys(customFields).length;
                  }
                  for (const [campo, valor] of Object.entries(stockFields)) {
                    const codigoLocal = campo.replace('stock_', '').toUpperCase();
                    const sedeId = sedesMap[codigoLocal];
                    if (sedeId) {
                      await stockApi.actualizar(prodId, sedeId, { cantidad: parseInt(valor) || 0 }).catch(() => {});
                      ok++;
                    }
                  }
                }
                qc.invalidateQueries(['productos']);
                setCambiosMasivos({});
                setSeleccionados([]);
                setGuardandoMasivo(false);
                toast.success(`✅ ${ok} cambios guardados`);
              }}
              style={{ padding:'8px 18px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:800, cursor:'pointer' }}
            >
              {guardandoMasivo ? '⏳ Guardando...' : `💾 Guardar ${Object.values(cambiosMasivos).reduce((a,v)=>a+Object.keys(v).length,0)} cambios`}
            </button>
          )}

          <button
            onClick={() => { setModoEdicion(false); setCambiosMasivos({}); setSeleccionados([]); }}
            style={{ padding:'6px 12px', background:'#dc2626', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}
          >✕ Salir</button>
        </div>
      )}

      {/* Badge comparación activa — se pueden marcar VARIAS llantas */}
      {comparar.length >= 1 && !modalProdId && !verComparador && (
        <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', background:'#1a2234', border:'2px solid #f59e0b', borderRadius:12, padding:'10px 18px', display:'flex', alignItems:'center', gap:12, zIndex:300, boxShadow:'0 8px 24px rgba(0,0,0,.4)', whiteSpace:'nowrap' }}>
          <span style={{ fontSize:13, color:'#f59e0b', fontWeight:700 }}>📌 {comparar.length} marcada{comparar.length !== 1 ? 's' : ''}{comparar.length < 2 ? ' — marca otra para comparar' : ''}</span>
          {comparar.length >= 2 && <button onClick={() => setVerComparador(true)} style={{ padding:'4px 11px', borderRadius:6, border:'2px solid #f59e0b', background:'#f59e0b', color:'#000', cursor:'pointer', fontSize:12, fontWeight:800 }}>⚖️ Comparar ({comparar.length})</button>}
          <button onClick={() => setComparar([])} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #f59e0b', background:'transparent', color:'#f59e0b', cursor:'pointer', fontSize:12, fontWeight:700 }}>✕ Cancelar</button>
        </div>
      )}

      {modalProdId && (
        <ProductoModal
          prodId={modalProdId}
          onClose={() => setModalProdId(null)}
          comparar={comparar}
          onVerComparacion={() => { setModalProdId(null); setVerComparador(true); }}
          setComparar={(fn) => {
            const next = typeof fn === 'function' ? fn(comparar) : fn;
            setComparar(next);
          }}
        />
      )}

      {verComparador && comparar.length >= 2 && !modalProdId && (
        <ComparadorModal ids={comparar} onClose={() => { setVerComparador(false); setComparar([]); }} />
      )}
    </div>
  );
}
