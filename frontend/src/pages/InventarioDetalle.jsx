import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productosApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const S = {
  layout: { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 },
  card: { background: '#fff', borderRadius: 10, padding: 20, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' },
  field: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 },
  label: { color: 'var(--color-text-muted)', fontWeight: 600 },
  value: { color: 'var(--color-text)', fontWeight: 500 },
  specGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 },
  spec: { background: '#f8fafc', borderRadius: 8, padding: '10px 14px' },
  specLabel: { fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' },
  specValue: { fontSize: 16, fontWeight: 800, color: 'var(--color-primary)', marginTop: 2 },
  stockBar: (pct) => ({
    height: 8, borderRadius: 4,
    background: pct > 50 ? '#16a34a' : pct > 20 ? '#ca8a04' : '#dc2626',
    width: `${Math.min(100, pct)}%`, minWidth: 4, transition: 'width .4s',
  }),
};

export default function InventarioDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notaTexto, setNotaTexto] = useState('');
  const [imgFile, setImgFile] = useState(null);
  const [imgPortada, setImgPortada] = useState(false);

  const { data: prod, isLoading } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => productosApi.obtener(id),
  });

  const notaMutation = useMutation({
    mutationFn: () => productosApi.agregarNota(id, notaTexto),
    onSuccess: () => { toast.success('Nota agregada'); setNotaTexto(''); qc.invalidateQueries(['producto', id]); },
    onError: (e) => toast.error(e?.error || 'Error'),
  });

  const imgMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('imagen', imgFile);
      fd.append('esPortada', imgPortada ? 'true' : 'false');
      return productosApi.subirImagen(id, fd);
    },
    onSuccess: () => { toast.success('Imagen subida'); setImgFile(null); qc.invalidateQueries(['producto', id]); },
    onError: (e) => toast.error(e?.error || 'Error'),
  });

  if (isLoading) return <LoadingSpinner fullPage />;
  if (!prod) return <div>Producto no encontrado</div>;

  const portada = prod.imagenes?.find((i) => i.esPortada) || prod.imagenes?.[0];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>{prod.marca} {prod.modelo} — {prod.medida}</h1>
      </div>

      <div style={S.layout}>
        {/* Columna izquierda */}
        <div>
          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ height: 240, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80 }}>
              {portada ? <img src={portada.url} alt={prod.marca} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '🛞'}
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>SKU: {prod.sku}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>S/ {parseFloat(prod.precio).toFixed(2)}</div>
              {prod.descripcion && <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>{prod.descripcion}</div>}
            </div>
          </div>

          {/* Galería */}
          <div style={S.card}>
            <div style={S.cardTitle}>Galería de imágenes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {prod.imagenes?.map((img) => (
                <img key={img.id} src={img.url} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: img.esPortada ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }} />
              ))}
              {!prod.imagenes?.length && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sin imágenes</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="file" accept="image/*" onChange={(e) => setImgFile(e.target.files[0])} style={{ fontSize: 12 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <input type="checkbox" checked={imgPortada} onChange={(e) => setImgPortada(e.target.checked)} />
                Portada
              </label>
              <button
                onClick={() => imgMutation.mutate()}
                disabled={!imgFile || imgMutation.isPending}
                style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer' }}
              >
                {imgMutation.isPending ? 'Subiendo...' : '↑ Subir'}
              </button>
            </div>
          </div>
        </div>

        {/* Columna derecha */}
        <div>
          {/* Especificaciones */}
          <div style={S.card}>
            <div style={S.cardTitle}>Especificaciones técnicas</div>
            <div style={S.specGrid}>
              {prod.indice_carga && <div style={S.spec}><div style={S.specLabel}>Índice de carga</div><div style={S.specValue}>{prod.indice_carga}</div></div>}
              {prod.velocidad_max && <div style={S.spec}><div style={S.specLabel}>Velocidad máx.</div><div style={S.specValue}>{prod.velocidad_max}</div></div>}
              {prod.ancho_mm && <div style={S.spec}><div style={S.specLabel}>Ancho (mm)</div><div style={S.specValue}>{prod.ancho_mm}</div></div>}
              {prod.aro && <div style={S.spec}><div style={S.specLabel}>Aro</div><div style={S.specValue}>R{prod.aro}</div></div>}
              {prod.tipo_terreno && <div style={S.spec}><div style={S.specLabel}>Terreno</div><div style={S.specValue}>{prod.tipo_terreno}</div></div>}
              {prod.garantia && <div style={S.spec}><div style={S.specLabel}>Garantía</div><div style={S.specValue}>{prod.garantia}</div></div>}
            </div>
          </div>

          {/* Stock por sede */}
          <div style={S.card}>
            <div style={S.cardTitle}>Stock por sede</div>
            {prod.stocks?.map((s) => {
              const pct = (s.cantidad / (s.stockMinimo * 4)) * 100;
              return (
                <div key={s.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.sede?.nombre}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: s.cantidad <= s.stockMinimo ? '#dc2626' : 'var(--color-text)' }}>
                      {s.cantidad} uds {s.cantidad <= s.stockMinimo && '⚠️'}
                    </span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={S.stockBar(pct)} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Mínimo: {s.stockMinimo} uds</div>
                </div>
              );
            })}
          </div>

          {/* Notas */}
          <div style={S.card}>
            <div style={S.cardTitle}>Notas del equipo</div>
            <div style={{ marginBottom: 14 }}>
              {prod.notas?.map((n) => (
                <div key={n.id} style={{ padding: '10px 12px', background: '#fefce8', borderRadius: 8, marginBottom: 8, border: '1px solid #fde047' }}>
                  <div style={{ fontSize: 13 }}>{n.texto}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{n.usuario?.nombre} • {new Date(n.createdAt).toLocaleDateString('es-PE')}</div>
                </div>
              ))}
              {!prod.notas?.length && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin notas</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={notaTexto}
                onChange={(e) => setNotaTexto(e.target.value)}
                placeholder="Agregar nota..."
                style={{ flex: 1, padding: '8px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13 }}
              />
              <button
                onClick={() => notaMutation.mutate()}
                disabled={!notaTexto.trim() || notaMutation.isPending}
                style={{ padding: '8px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
