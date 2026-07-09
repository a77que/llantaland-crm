import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productosApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useIsMobile } from '../hooks/useIsMobile';

const TIPO_COLOR = { AUTO: '#3b82f6', CAMIONETA: '#8b5cf6', CAMION: '#f59e0b', MOTO: '#ec4899' };
const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;

const EU_GRADES = {
  A: { bg: '#006d2c', text: '#fff' }, B: { bg: '#31a354', text: '#fff' },
  C: { bg: '#74c476', text: '#000' }, D: { bg: '#f7dc6f', text: '#000' },
  E: { bg: '#f0a500', text: '#000' }, F: { bg: '#e34a33', text: '#fff' },
  G: { bg: '#b30000', text: '#fff' },
};
function GradeBadge({ grade }) {
  const g = grade ? String(grade).toUpperCase() : null;
  const c = (g && EU_GRADES[g]) ? EU_GRADES[g] : { bg: '#e2e8f0', text: '#94a3b8' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:6, background:c.bg, color:c.text, fontSize:14, fontWeight:900, boxShadow:`0 1px 4px ${c.bg}88` }}>
      {g || '?'}
    </span>
  );
}
function noiseColor(db) {
  if (!db) return '#94a3b8';
  if (db <= 67) return '#16a34a';
  if (db <= 71) return '#84cc16';
  if (db <= 74) return '#eab308';
  return '#dc2626';
}
const TECH_FIELDS = ['indice_carga','velocidad_max','garantia','cargaMaxNeumatico','velocidadMaxKmh','eficienciaCombustible','eficienciaFrenado','nivelRuido','paisFabricacion','origenMarca'];
const FIELD_LABELS = { indice_carga:'Índice de carga', velocidad_max:'Índice de velocidad', garantia:'Garantía', cargaMaxNeumatico:'Carga máx. (kg)', velocidadMaxKmh:'Velocidad máx. (km/h)', eficienciaCombustible:'Eficiencia combustible', eficienciaFrenado:'Frenado en mojado', nivelRuido:'Nivel de ruido', paisFabricacion:'País de fabricación', origenMarca:'Origen de marca' };

function Seccion({ titulo, children }) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 10, padding: 20, border: '1px solid var(--color-border)', marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #f5c400' }}>
        {titulo}
      </div>
      {children}
    </div>
  );
}

export default function InventarioDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [imgFile, setImgFile] = useState(null);

  const { data: prod, isLoading } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => productosApi.obtener(id),
  });

  const imgMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('imagen', imgFile);
      return productosApi.subirImagen(id, fd);
    },
    onSuccess: () => { toast.success('Imagen actualizada'); setImgFile(null); qc.invalidateQueries(['producto', id]); },
    onError: (e) => toast.error(e?.error || 'Error'),
  });

  const aiMut = useMutation({
    mutationFn: () => productosApi.enriquecer(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['producto', id] });
      toast.success(data?.mensaje || 'Información completada con IA');
    },
    onError: (e) => toast.error(e?.error || 'Error al conectar con IA'),
  });

  const delMut = useMutation({
    mutationFn: () => productosApi.eliminar(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['productos'] });
      toast.success(data?.mensaje || 'Llanta eliminada del catálogo');
      navigate('/inventario');
    },
    onError: (e) => toast.error(e?.error || 'Error al eliminar'),
  });

  // Llantas hermanas (misma medida + marca) para compartir imagen
  const { data: hermanas } = useQuery({
    queryKey: ['hermanas-img', id],
    queryFn: () => productosApi.hermanasImagen(id),
    enabled: !!id,
  });
  const [selHermanas, setSelHermanas] = useState(null);
  useEffect(() => {
    if (hermanas?.sinImagen && selHermanas === null) {
      setSelHermanas(new Set(hermanas.sinImagen.map(h => h.id)));
    }
  }, [hermanas, selHermanas]);

  const aplicarImgMut = useMutation({
    mutationFn: ({ imagenUrl, ids }) => productosApi.aplicarImagen({ imagenUrl, ids }),
    onSuccess: (r) => {
      toast.success(`Imagen aplicada a ${r?.actualizados ?? 0} llanta(s)`);
      qc.invalidateQueries({ queryKey: ['producto', id] });
      qc.invalidateQueries({ queryKey: ['hermanas-img', id] });
      qc.invalidateQueries({ queryKey: ['productos'] });
      setSelHermanas(null);
    },
    onError: (e) => toast.error(e?.error || 'Error al aplicar imagen'),
  });

  if (isLoading) return <LoadingSpinner fullPage />;
  if (!prod) return <div style={{ padding: 24 }}>Producto no encontrado</div>;

  const tipoColor = TIPO_COLOR[prod.tipoVehiculo] || '#64748b';
  const stockTotal = prod.stocks?.reduce((a, s) => a + s.cantidad, 0) || 0;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(-1)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h1 style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, flex: 1 }}>
          {prod.marca} {prod.nombreComercial || ''}
          <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 500, color: 'var(--color-primary)' }}>{prod.medida}</span>
        </h1>
        {prod.tipoVehiculo && <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: tipoColor + '20', color: tipoColor }}>{prod.tipoVehiculo}</span>}
        <button
          onClick={() => {
            if (window.confirm(`⚠️ ¿Eliminar esta llanta del catálogo?\n\n${prod.marca} ${prod.nombreComercial || ''} ${prod.medida} (${prod.sku})\n\nDejará de aparecer en el inventario y cotizaciones (el historial de ventas se conserva).`)) {
              delMut.mutate();
            }
          }}
          disabled={delMut.isPending}
          style={{ padding: '7px 14px', borderRadius: 8, border: '2px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
        >
          {delMut.isPending ? '⏳ Eliminando...' : '🗑️ Eliminar'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 14 }}>
        {/* Columna imagen + precios */}
        <div>
          {/* Imagen */}
          <div style={{ background: 'var(--color-surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)', marginBottom: 14 }}>
            <div style={{ height: 200, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72 }}>
              {prod.imagenUrl
                ? <img src={prod.imagenUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : '🛞'}
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>SKU: {prod.sku}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>{fmt(prod.precioOferta)}</div>
              {prod.precioRegular && (
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                  Regular: {fmt(prod.precioRegular)}
                </div>
              )}
              {/* Subir imagen */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Cambiar imagen</div>
                <input type="file" accept="image/*" onChange={e => setImgFile(e.target.files[0])} style={{ fontSize: 12, marginBottom: 6, width: '100%' }} />
                <button
                  onClick={() => imgMut.mutate()}
                  disabled={!imgFile || imgMut.isPending}
                  style={{ width: '100%', padding: '7px', background: '#f5c400', color: '#000', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {imgMut.isPending ? 'Subiendo...' : '↑ Subir imagen'}
                </button>
              </div>
            </div>
          </div>

          {/* Esta imagen aplica a llantas hermanas sin foto → propagar */}
          {prod.imagenUrl && hermanas?.sinImagen?.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#92400e', marginBottom: 4 }}>🖼️ Esta imagen aplica a {hermanas.sinImagen.length} llanta(s) igual(es)</div>
              <div style={{ fontSize: 11.5, color: '#92400e', marginBottom: 8 }}>Misma medida y marca, solo cambia el nombre. Marca las que quieras actualizar:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 170, overflowY: 'auto', marginBottom: 10 }}>
                {hermanas.sinImagen.map(h => (
                  <label key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!selHermanas?.has(h.id)} onChange={() => setSelHermanas(prev => { const n = new Set(prev); n.has(h.id) ? n.delete(h.id) : n.add(h.id); return n; })} style={{ accentColor: '#f5c400', width: 15, height: 15 }} />
                    <span><strong>{h.nombreComercial || h.sku}</strong> · {h.medida} <span style={{ color: 'var(--color-text-muted)' }}>({h.sku})</span></span>
                  </label>
                ))}
              </div>
              <button
                disabled={!selHermanas?.size || aplicarImgMut.isPending}
                onClick={() => aplicarImgMut.mutate({ imagenUrl: prod.imagenUrl, ids: [...selHermanas] })}
                style={{ width: '100%', padding: '9px', background: (!selHermanas?.size || aplicarImgMut.isPending) ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
              >
                {aplicarImgMut.isPending ? 'Aplicando…' : `✅ Aceptar — aplicar a ${selHermanas?.size || 0} llanta(s)`}
              </button>
            </div>
          )}

          {/* No tiene imagen pero una hermana sí → usarla aquí */}
          {!prod.imagenUrl && hermanas?.conImagen?.length > 0 && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#1d4ed8', marginBottom: 8 }}>🖼️ Una llanta igual ya tiene foto — úsala aquí</div>
              {hermanas.conImagen.slice(0, 1).map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={h.imagenUrl} alt="" style={{ width: 54, height: 54, objectFit: 'contain', background: '#fff', borderRadius: 8, border: '1px solid var(--color-border)' }} />
                  <div style={{ flex: 1, fontSize: 12 }}>{h.nombreComercial || h.sku} · {h.medida}</div>
                  <button onClick={() => aplicarImgMut.mutate({ imagenUrl: h.imagenUrl, ids: [prod.id] })} disabled={aplicarImgMut.isPending}
                    style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Usar foto
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Etiqueta EU */}
          <Seccion titulo="🏷️ Etiqueta EU">
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <GradeBadge grade={prod.eficienciaCombustible} />
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>Combustible</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <GradeBadge grade={prod.eficienciaFrenado} />
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>Frenado</div>
              </div>
              {prod.nivelRuido && (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius:6, background: noiseColor(prod.nivelRuido) + '22', border:`1px solid ${noiseColor(prod.nivelRuido)}`, fontSize:13, fontWeight:800, color: noiseColor(prod.nivelRuido) }}>
                    🔊 {prod.nivelRuido} dB
                  </span>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>Ruido</div>
                </div>
              )}
            </div>
          </Seccion>

          {/* Info técnica */}
          <Seccion titulo="⚙️ Especificaciones">
            {prod.modelo && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Modelo: </span><strong>{prod.modelo}</strong></div>}
            {prod.runFlat != null && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Run-Flat: </span><strong>{prod.runFlat ? 'Sí' : 'No'}</strong></div>}
            {prod.tipoLlanta && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tipo de llanta: </span><strong>{prod.tipoLlanta}</strong></div>}
            {prod.tipoVehiculo && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tipo de vehículo: </span><strong>{prod.tipoVehiculo}</strong></div>}
            {prod.grupo && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Grupo: </span><strong>{prod.grupo}</strong></div>}
            {prod.indice_carga && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Índice carga: </span><strong>{prod.indice_carga}</strong></div>}
            {prod.velocidad_max && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Veloc. máx: </span><strong>{prod.velocidad_max}</strong></div>}
            {prod.cargaMaxNeumatico && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Carga máx/neu.: </span><strong>{prod.cargaMaxNeumatico} kg</strong></div>}
            {prod.cargaMaxNeumatico && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Carga total (4): </span><strong>{prod.cargaMaxNeumatico * 4} kg</strong></div>}
            {prod.velocidadMaxKmh && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Veloc. máx: </span><strong>{prod.velocidadMaxKmh} km/h</strong></div>}
            {prod.garantia && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Garantía: </span><strong>{prod.garantia}</strong></div>}
            {prod.paisFabricacion && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>País fab.: </span><strong>{prod.paisFabricacion}</strong></div>}
            {prod.origenMarca && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Origen marca: </span><strong>{prod.origenMarca}</strong></div>}
            {(() => {
              const faltan = TECH_FIELDS.filter(f => !prod[f] && prod[f] !== 0);
              if (faltan.length === 0) return <div style={{ marginTop: 8, fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✅ Ficha técnica completa</div>;
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 11px', marginBottom: 8, lineHeight: 1.45 }}>
                    <strong>Faltan {faltan.length} dato{faltan.length !== 1 ? 's' : ''}:</strong> {faltan.map(f => FIELD_LABELS[f] || f).join(', ')}.
                  </div>
                  <button
                    onClick={() => aiMut.mutate()}
                    disabled={aiMut.isPending}
                    style={{ width: '100%', padding: '9px', background: aiMut.isPending ? '#64748b' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: aiMut.isPending ? 'wait' : 'pointer' }}
                  >
                    {aiMut.isPending ? '⏳ Consultando IA...' : `🤖 Rellenar ${faltan.length} campos con IA`}
                  </button>
                </div>
              );
            })()}
          </Seccion>
        </div>

        {/* Columna stock + cotización */}
        <StockCotizacion prod={prod} stockTotal={stockTotal} />
      </div>
    </div>
  );
}

function StockCotizacion({ prod, stockTotal }) {
  const [sedeModal, setSedeModal] = useState(null);

  const oferta  = parseFloat(prod.precioOferta)  || 0;
  const regular = parseFloat(prod.precioRegular)  || 0;
  const descMax = parseFloat(prod.descuentoMaximo) || 0;

  const todasLasSedes = useMemo(() =>
    [...(prod.stocks || [])].sort((a, b) => b.cantidad - a.cantidad),
  [prod.stocks]);

  const fmt = (v) => `S/ ${parseFloat(v || 0).toFixed(2)}`;

  const stockColor = (s) =>
    s.cantidad <= 0 ? '#dc2626' :
    s.cantidad <= s.stockMinimo ? '#f97316' :
    s.cantidad <= s.stockMinimo * 2 ? '#eab308' : '#16a34a';

  return (
    <div>
      {/* ── Stock total badge ── */}
      <div style={{
        background: stockTotal > 10 ? '#f0fdf4' : stockTotal > 0 ? '#fff7ed' : '#fef2f2',
        borderRadius: 10, padding: '14px 18px',
        border: `1px solid ${stockTotal > 10 ? '#bbf7d0' : stockTotal > 0 ? '#fed7aa' : '#fecaca'}`,
        marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: 1 }}>Stock total</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: stockTotal > 10 ? '#16a34a' : stockTotal > 0 ? '#f97316' : '#dc2626' }}>{stockTotal} uds</div>
        </div>
        <div style={{ fontSize: 40 }}>{stockTotal > 10 ? '✅' : stockTotal > 0 ? '⚠️' : '❌'}</div>
      </div>

      {/* ── Precios rápidos ── */}
      {(oferta > 0 || regular > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {regular > 0 && (
            <div style={{ background: 'var(--color-surface)', borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>Regular</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>{fmt(regular)}</div>
            </div>
          )}
          <div style={{ background: oferta > 0 ? '#f0fdf4' : 'var(--color-surface)', borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: oferta > 0 ? '1.5px solid #bbf7d0' : '1px solid var(--color-border)', gridColumn: regular > 0 ? undefined : '1 / -1' }}>
            <div style={{ fontSize: 9, color: oferta > 0 ? '#16a34a' : 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>Oferta</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: oferta > 0 ? '#16a34a' : 'var(--color-text)' }}>{fmt(oferta > 0 ? oferta : regular)}</div>
          </div>
        </div>
      )}

      {/* ── Sedes clickeables ── */}
      <Seccion titulo="📍 Stock por tienda / almacén — haz clic para cotizar">
        {todasLasSedes.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin stock registrado en ninguna sede</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todasLasSedes.map(s => {
            const col  = stockColor(s);
            const pct  = Math.min(100, (s.cantidad / Math.max(s.stockMinimo * 4, 20)) * 100);
            const sinStock = s.cantidad <= 0;
            return (
              <button
                key={s.id}
                onClick={() => setSedeModal(s)}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: sinStock ? 'var(--color-bg)' : 'var(--color-bg)',
                  border: `1.5px solid ${col}50`,
                  borderRadius: 10, padding: '11px 14px',
                  opacity: sinStock ? .65 : 1,
                  transition: 'border-color .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = col; e.currentTarget.style.boxShadow = `0 2px 12px ${col}30`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${col}50`; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sinStock ? 0 : 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{s.sede?.nombre}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, background: 'var(--color-surface)', color: 'var(--color-text-muted)', fontFamily: 'monospace', border: '1px solid var(--color-border)' }}>{s.sede?.codigoLocal}</span>
                    {s.sede?.distrito && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{s.sede.distrito}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 900, color: col }}>{sinStock ? 'Sin stock' : `${s.cantidad} uds`}</span>
                    <span style={{ fontSize: 11, color: col, fontWeight: 700 }}>→</span>
                  </div>
                </div>
                {!sinStock && (
                  <div style={{ background: '#e2e8f0', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: col, width: `${pct}%`, minWidth: 4 }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Haz clic en una tienda para ver el detalle y cotizar desde esa ubicación
        </div>
      </Seccion>

      {/* ── Modal de cotización por sede ── */}
      {sedeModal && (
        <ModalCotizacion
          sede={sedeModal}
          prod={prod}
          oferta={oferta}
          regular={regular}
          descMax={descMax}
          onClose={() => setSedeModal(null)}
        />
      )}
    </div>
  );
}

function ModalCotizacion({ sede, prod, oferta, regular, descMax, onClose }) {
  const [qty, setQty] = useState(() => {
    const n = Math.min(4, sede.cantidad > 0 ? sede.cantidad : 4);
    return n > 0 ? n : 1;
  });

  // Cerrar con ESC
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const precioMinimo = oferta > 0 && descMax > 0 ? oferta * (1 - descMax / 100) : null;
  const col  = sede.cantidad <= 0 ? '#dc2626' : sede.cantidad <= sede.stockMinimo ? '#f97316' : sede.cantidad <= sede.stockMinimo * 2 ? '#eab308' : '#16a34a';
  const pct  = Math.min(100, (sede.cantidad / Math.max(sede.stockMinimo * 4, 20)) * 100);
  const sinStock = sede.cantidad <= 0;

  const fmtN = (v) => Number(v || 0).toFixed(2);
  const totalOferta  = oferta  * qty;
  const totalRegular = regular * qty;

  const cubre = !sinStock && (sede.cantidad >= qty
    ? '✅ Esta sede puede cubrir el pedido'
    : `⚠️ Solo ${sede.cantidad} uds aquí (faltan ${qty - sede.cantidad})`);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--color-surface)', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text)' }}>{sede.sede?.nombre}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--color-bg)', color: 'var(--color-text-muted)', fontFamily: 'monospace', border: '1px solid var(--color-border)' }}>{sede.sede?.codigoLocal}</span>
              {sede.sede?.distrito && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>📍 {sede.sede.distrito}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 11px', fontSize: 16, cursor: 'pointer', color: 'var(--color-text)', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Producto ── */}
          <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>{prod.marca} {prod.nombreComercial || ''}</span>
            <span style={{ marginLeft: 8, color: 'var(--color-primary)', fontWeight: 700 }}>{prod.medida}</span>
            <span style={{ marginLeft: 8, color: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'monospace' }}>{prod.sku}</span>
          </div>

          {/* ── Stock en esta sede ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: .8, marginBottom: 8 }}>Stock disponible en esta sede</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: col }}>{sede.cantidad}</div>
              <div style={{ fontSize: 14, color: col, fontWeight: 700 }}>unidades</div>
            </div>
            {!sinStock && (
              <>
                <div style={{ background: '#e2e8f0', borderRadius: 4, height: 7, overflow: 'hidden', marginBottom: 5 }}>
                  <div style={{ height: '100%', borderRadius: 4, background: col, width: `${pct}%`, minWidth: 6, transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Stock mínimo configurado: {sede.stockMinimo} uds</div>
              </>
            )}
            {sinStock && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 13, color: '#dc2626', fontWeight: 700, border: '1px solid #fecaca' }}>
                ❌ Sin stock disponible en esta sede
              </div>
            )}
          </div>

          {/* ── Precios ── */}
          {(oferta > 0 || regular > 0) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: .8, marginBottom: 8 }}>Precios</div>
              <div style={{ display: 'grid', gridTemplateColumns: regular > 0 && oferta > 0 ? '1fr 1fr' : '1fr', gap: 8 }}>
                {regular > 0 && (
                  <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>Precio regular</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>S/ {fmtN(regular)}</div>
                  </div>
                )}
                {oferta > 0 && (
                  <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: '1.5px solid #bbf7d0' }}>
                    <div style={{ fontSize: 9, color: '#16a34a', textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>🏷️ Precio oferta</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>S/ {fmtN(oferta)}</div>
                  </div>
                )}
              </div>
              {descMax > 0 && precioMinimo && (
                <div style={{ marginTop: 8, background: '#eff6ff', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#1d4ed8' }}>
                  <span>Desc. máx. permitido: <strong>{descMax}%</strong></span>
                  <span style={{ fontWeight: 800 }}>Precio mín: S/ {fmtN(precioMinimo)}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Calculadora ── */}
          {oferta > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: .8, marginBottom: 10 }}>Calculadora de cotización</div>

              {/* Selector cantidad */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => setQty(n)} style={{
                    padding: '7px 15px', borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    border: qty === n ? '2px solid #f5c400' : '1.5px solid var(--color-border)',
                    background: qty === n ? 'rgba(245,196,0,.12)' : 'var(--color-bg)',
                    color: qty === n ? '#f5c400' : 'var(--color-text)',
                  }}>{n}</button>
                ))}
                <input
                  type="number" min="1" max="999" value={qty}
                  onChange={e => { const v = parseInt(e.target.value); if (v > 0) setQty(v); }}
                  style={{ width: 68, padding: '7px 8px', borderRadius: 7, fontSize: 14, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', textAlign: 'center' }}
                />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>llantas</span>
              </div>

              {/* Tabla */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--color-bg)', borderRadius: 8, overflow: 'hidden' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Concepto</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>× 1</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>× {qty}</th>
                  </tr>
                </thead>
                <tbody>
                  {regular > 0 && (
                    <tr>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)', textDecoration: 'line-through', borderBottom: '1px solid var(--color-border)' }}>Precio regular</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)', textDecoration: 'line-through', borderBottom: '1px solid var(--color-border)' }}>S/ {fmtN(regular)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)', textDecoration: 'line-through', fontWeight: 700, borderBottom: '1px solid var(--color-border)' }}>S/ {fmtN(totalRegular)}</td>
                    </tr>
                  )}
                  <tr style={{ background: 'rgba(22,163,74,.07)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#16a34a', borderBottom: precioMinimo ? '1px solid var(--color-border)' : 'none' }}>🏷️ Precio oferta</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a', borderBottom: precioMinimo ? '1px solid var(--color-border)' : 'none' }}>S/ {fmtN(oferta)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#16a34a', fontSize: 16, borderBottom: precioMinimo ? '1px solid var(--color-border)' : 'none' }}>S/ {fmtN(totalOferta)}</td>
                  </tr>
                  {precioMinimo && (
                    <tr style={{ background: 'rgba(29,78,216,.05)' }}>
                      <td style={{ padding: '8px 12px', color: '#1d4ed8', fontSize: 12 }}>Con desc. máx. ({descMax}%)</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1d4ed8', fontSize: 12 }}>S/ {fmtN(precioMinimo)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8' }}>S/ {fmtN(precioMinimo * qty)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Ahorro */}
              {regular > 0 && oferta > 0 && regular > oferta && (
                <div style={{ marginTop: 10, padding: '9px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13, color: '#16a34a', fontWeight: 700, textAlign: 'center' }}>
                  💚 Ahorro vs. precio regular: <strong>S/ {fmtN(totalRegular - totalOferta)}</strong>
                </div>
              )}

              {/* ¿Cubre el pedido? */}
              {cubre && (
                <div style={{ marginTop: 8, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center', background: sede.cantidad >= qty ? 'rgba(22,163,74,.08)' : 'rgba(249,115,22,.08)', color: sede.cantidad >= qty ? '#16a34a' : '#f97316', border: `1px solid ${sede.cantidad >= qty ? '#bbf7d0' : '#fed7aa'}` }}>
                  {cubre}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
