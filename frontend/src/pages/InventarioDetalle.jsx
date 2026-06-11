import React, { useState } from 'react';
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

  if (isLoading) return <LoadingSpinner fullPage />;
  if (!prod) return <div style={{ padding: 24 }}>Producto no encontrado</div>;

  const tipoColor = TIPO_COLOR[prod.tipo] || '#64748b';
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
        <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: tipoColor + '20', color: tipoColor }}>{prod.tipo}</span>
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
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-primary)' }}>{fmt(prod.precioRegular)}</div>
              {prod.precioOferta && (
                <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                  Oferta: {fmt(prod.precioOferta)}
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
            {prod.grupo && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Grupo: </span><strong>{prod.grupo}</strong></div>}
            {prod.indice_carga && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Índice carga: </span><strong>{prod.indice_carga}</strong></div>}
            {prod.velocidad_max && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Veloc. máx: </span><strong>{prod.velocidad_max}</strong></div>}
            {prod.cargaMaxNeumatico && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Carga máx/neu.: </span><strong>{prod.cargaMaxNeumatico} kg</strong></div>}
            {prod.cargaMaxNeumatico && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Carga total (4): </span><strong>{prod.cargaMaxNeumatico * 4} kg</strong></div>}
            {prod.velocidadMaxKmh && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Veloc. máx: </span><strong>{prod.velocidadMaxKmh} km/h</strong></div>}
            {prod.garantia && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Garantía: </span><strong>{prod.garantia}</strong></div>}
            {prod.paisFabricacion && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>País fab.: </span><strong>{prod.paisFabricacion}</strong></div>}
            {prod.origenMarca && <div style={{ marginBottom: 8 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Origen marca: </span><strong>{prod.origenMarca}</strong></div>}
            {TECH_FIELDS.filter(f => prod[f] !== null && prod[f] !== undefined && prod[f] !== '').length < TECH_FIELDS.length && (
              <button
                onClick={() => aiMut.mutate()}
                disabled={aiMut.isPending}
                style={{ marginTop: 8, width: '100%', padding: '9px', background: aiMut.isPending ? '#64748b' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: aiMut.isPending ? 'wait' : 'pointer' }}
              >
                {aiMut.isPending ? '⏳ Consultando IA...' : `🤖 Rellenar ${TECH_FIELDS.filter(f => !prod[f] && prod[f] !== 0).length} campos con IA`}
              </button>
            )}
          </Seccion>
        </div>

        {/* Columna stock */}
        <div>
          {/* Stock total badge */}
          <div style={{ background: stockTotal > 10 ? '#f0fdf4' : stockTotal > 0 ? '#fff7ed' : '#fef2f2', borderRadius: 10, padding: '14px 18px', border: `1px solid ${stockTotal > 10 ? '#bbf7d0' : stockTotal > 0 ? '#fed7aa' : '#fecaca'}`, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: 1 }}>Stock total</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: stockTotal > 10 ? '#16a34a' : stockTotal > 0 ? '#f97316' : '#dc2626' }}>{stockTotal} uds</div>
            </div>
            <div style={{ fontSize: 40 }}>{stockTotal > 10 ? '✅' : stockTotal > 0 ? '⚠️' : '❌'}</div>
          </div>

          {/* Stock por sede */}
          <Seccion titulo="📍 Stock por local">
            {prod.stocks?.length > 0 ? prod.stocks.map(s => {
              const pct = Math.min(100, (s.cantidad / Math.max(s.stockMinimo * 4, 20)) * 100);
              const color = s.cantidad <= s.stockMinimo ? '#dc2626' : s.cantidad <= s.stockMinimo * 2 ? '#f97316' : '#16a34a';
              return (
                <div key={s.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{s.sede?.nombre}</span>
                      <span style={{ marginLeft: 8, fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#f1f5f9', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{s.sede?.codigoLocal}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color }}>
                      {s.cantidad} uds
                      {s.cantidad <= s.stockMinimo && <span style={{ marginLeft: 4, fontSize: 12 }}>⚠️</span>}
                    </span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: color, width: `${pct}%`, minWidth: 4, transition: 'width .3s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>Mínimo: {s.stockMinimo} uds — {s.sede?.distrito}</div>
                </div>
              );
            }) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sin stock registrado</div>
            )}
          </Seccion>
        </div>
      </div>
    </div>
  );
}
