import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productosApi } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';

const S = {
  card: { background: '#fff', borderRadius: 10, border: '1px solid var(--color-border)', overflow: 'hidden', marginTop: 12 },
  compact: { border: '1.5px solid var(--color-primary)', borderRadius: 10 },
  imgBox: (compact) => ({ height: compact ? 120 : 200, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 48 : 72, position: 'relative' }),
  img: { width: '100%', height: '100%', objectFit: 'contain' },
  body: (compact) => ({ padding: compact ? '12px 14px' : '16px 20px' }),
  sku: { fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace', letterSpacing: '.5px' },
  nombre: (compact) => ({ fontSize: compact ? 14 : 17, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }),
  medida: { fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginTop: 2 },
  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  badge: (c) => ({ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c + '20', color: c }),
  specGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 12 },
  spec: { background: '#f8fafc', borderRadius: 8, padding: '8px 12px' },
  specLabel: { fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' },
  specVal: { fontSize: 14, fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 },
  precio: { fontSize: 20, fontWeight: 900, color: 'var(--color-primary)', marginTop: 10 },
  stockRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--color-border)' },
  stockBar: (pct) => ({ height: 5, borderRadius: 3, background: pct > 50 ? '#16a34a' : pct > 20 ? '#ca8a04' : '#dc2626', width: `${Math.min(100, pct)}%`, minWidth: 4 }),
  nota: { padding: '8px 10px', background: '#fefce8', borderRadius: 6, marginBottom: 6, border: '1px solid #fde047', fontSize: 12 },
};

function StockItem({ stock }) {
  const pct = (stock.cantidad / ((stock.stockMinimo || 5) * 4)) * 100;
  return (
    <div>
      <div style={S.stockRow}>
        <span style={{ fontWeight: 600 }}>{stock.sede?.nombre}</span>
        <span style={{ fontWeight: 700, color: stock.cantidad <= (stock.stockMinimo || 5) ? '#dc2626' : 'var(--color-text)' }}>
          {stock.cantidad} uds {stock.cantidad <= (stock.stockMinimo || 5) ? '⚠️' : ''}
        </span>
      </div>
      <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
        <div style={S.stockBar(pct)} />
      </div>
    </div>
  );
}

/**
 * Props:
 *   productoId — ID del producto
 *   compact — muestra versión reducida (para selector de cotización)
 */
export default function FichaLlanta({ productoId, compact = false }) {
  const qc = useQueryClient();
  const [notaTexto, setNotaTexto] = useState('');
  const [imgFile, setImgFile] = useState(null);
  const [showGallery, setShowGallery] = useState(false);

  const { data: prod, isLoading } = useQuery({
    queryKey: ['producto', productoId],
    queryFn: () => productosApi.obtener(productoId),
    enabled: !!productoId,
  });

  const notaMutation = useMutation({
    mutationFn: () => productosApi.agregarNota(productoId, notaTexto),
    onSuccess: () => { toast.success('Nota agregada'); setNotaTexto(''); qc.invalidateQueries(['producto', productoId]); },
  });

  const imgMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('imagen', imgFile);
      return productosApi.subirImagen(productoId, fd);
    },
    onSuccess: () => { toast.success('Imagen subida'); setImgFile(null); qc.invalidateQueries(['producto', productoId]); },
  });

  if (!productoId) return null;
  if (isLoading) return <LoadingSpinner size={24} />;
  if (!prod) return null;

  const portada = prod.imagenes?.find((i) => i.esPortada) || prod.imagenes?.[0];
  const stockTotal = prod.stocks?.reduce((a, s) => a + s.cantidad, 0) || 0;

  return (
    <div style={{ ...(compact ? S.compact : S.card) }}>
      <div style={S.imgBox(compact)}>
        {portada ? <img src={portada.url} alt={prod.marca} style={S.img} /> : '🛞'}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={S.badge('#2563eb')}>{prod.tipo}</span>
          {prod.tipo_terreno && <span style={S.badge('#8b5cf6')}>{prod.tipo_terreno}</span>}
          {prod.garantia && <span style={S.badge('#16a34a')}>{prod.garantia}</span>}
        </div>
      </div>

      <div style={S.body(compact)}>
        <div style={S.sku}>SKU: {prod.sku}</div>
        <div style={S.nombre(compact)}>{prod.marca} {prod.modelo}</div>
        <div style={S.medida}>{prod.medida}</div>

        {prod.descripcion && !compact && <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>{prod.descripcion}</div>}

        <div style={S.badgeRow}>
          <span style={S.badge(stockTotal > 10 ? '#16a34a' : stockTotal > 0 ? '#ca8a04' : '#dc2626')}>
            Stock total: {stockTotal} uds
          </span>
        </div>

        <div style={S.precio}>S/ {parseFloat(prod.precio).toFixed(2)} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)' }}>incl. IGV</span></div>

        {/* Specs técnicas */}
        {!compact && (prod.indice_carga || prod.velocidad_max || prod.ancho_mm || prod.aro) && (
          <div style={S.specGrid}>
            {prod.indice_carga && <div style={S.spec}><div style={S.specLabel}>Índice carga</div><div style={S.specVal}>{prod.indice_carga}</div></div>}
            {prod.velocidad_max && <div style={S.spec}><div style={S.specLabel}>Vel. máx.</div><div style={S.specVal}>{prod.velocidad_max}</div></div>}
            {prod.ancho_mm && <div style={S.spec}><div style={S.specLabel}>Ancho</div><div style={S.specVal}>{prod.ancho_mm}mm</div></div>}
            {prod.aro && <div style={S.spec}><div style={S.specLabel}>Aro</div><div style={S.specVal}>R{prod.aro}</div></div>}
          </div>
        )}

        {/* Stock por sede */}
        {prod.stocks?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>Stock por sede</div>
            {prod.stocks.map((s) => <StockItem key={s.id} stock={s} />)}
          </div>
        )}

        {/* Galería e imágenes — solo full */}
        {!compact && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Galería</div>
              <button onClick={() => setShowGallery(!showGallery)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--color-primary-light)', cursor: 'pointer' }}>
                {showGallery ? 'Ocultar' : 'Ver fotos'}
              </button>
            </div>
            {showGallery && (
              <div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {prod.imagenes?.map((img) => (
                    <img key={img.id} src={img.url} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: img.esPortada ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="file" accept="image/*" onChange={(e) => setImgFile(e.target.files[0])} style={{ fontSize: 11 }} />
                  <button onClick={() => imgMutation.mutate()} disabled={!imgFile || imgMutation.isPending}
                    style={{ padding: '5px 10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                    ↑ Subir
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notas — solo full */}
        {!compact && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>Notas del equipo</div>
            {prod.notas?.map((n) => <div key={n.id} style={S.nota}>{n.texto}<span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{n.usuario?.nombre}</span></div>)}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input value={notaTexto} onChange={(e) => setNotaTexto(e.target.value)} placeholder="Agregar nota..."
                style={{ flex: 1, padding: '6px 10px', border: '1.5px solid var(--color-border)', borderRadius: 6, fontSize: 12 }} />
              <button onClick={() => notaMutation.mutate()} disabled={!notaTexto.trim() || notaMutation.isPending}
                style={{ padding: '6px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                Agregar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
