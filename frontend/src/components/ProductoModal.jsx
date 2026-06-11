import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productosApi } from '../services/api';
import LoadingSpinner from './common/LoadingSpinner';

const TIPO_COLOR = { AUTO: '#3b82f6', CAMIONETA: '#8b5cf6', CAMION: '#f59e0b', MOTO: '#ec4899' };
const fmt = (v) => v ? `S/ ${parseFloat(v).toFixed(2)}` : null;

const EU_GRADES = {
  A: { bg: '#006d2c', text: '#fff', label: 'Excelente' },
  B: { bg: '#31a354', text: '#fff', label: 'Muy buena' },
  C: { bg: '#74c476', text: '#000', label: 'Buena' },
  D: { bg: '#f7dc6f', text: '#000', label: 'Aceptable' },
  E: { bg: '#f0a500', text: '#000', label: 'Regular' },
  F: { bg: '#e34a33', text: '#fff', label: 'Baja' },
  G: { bg: '#b30000', text: '#fff', label: 'Deficiente' },
};

const TECH_FIELDS = [
  'indice_carga', 'velocidad_max', 'garantia',
  'cargaMaxNeumatico', 'velocidadMaxKmh',
  'eficienciaCombustible', 'eficienciaFrenado', 'nivelRuido',
  'paisFabricacion', 'origenMarca',
];

function noiseColor(db) {
  if (!db) return '#94a3b8';
  if (db <= 67) return '#16a34a';
  if (db <= 71) return '#84cc16';
  if (db <= 74) return '#eab308';
  return '#dc2626';
}

function GradeBadge({ grade, label, size = 52 }) {
  const g = grade ? String(grade).toUpperCase() : null;
  const colors = (g && EU_GRADES[g]) ? EU_GRADES[g] : null;
  return (
    <div style={{ textAlign: 'center', minWidth: size + 12 }}>
      <div style={{
        width: size, height: size, borderRadius: 10, margin: '0 auto',
        background: colors ? colors.bg : '#e2e8f0',
        color: colors ? colors.text : '#94a3b8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.46, fontWeight: 900, letterSpacing: -1,
        boxShadow: colors ? `0 2px 8px ${colors.bg}66` : 'none',
      }}>
        {g || '?'}
      </div>
      <div style={{ fontSize: 10, marginTop: 5, color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</div>
      {colors && <div style={{ fontSize: 9, color: colors.bg, fontWeight: 700 }}>{colors.label}</div>}
    </div>
  );
}

function NoiseBadge({ db }) {
  const color = noiseColor(db);
  const waves = !db ? 1 : db <= 67 ? 1 : db <= 71 ? 2 : 3;
  return (
    <div style={{ textAlign: 'center', minWidth: 64 }}>
      <div style={{
        width: 52, height: 52, borderRadius: 10, margin: '0 auto',
        background: db ? color + '20' : '#e2e8f0',
        border: `2px solid ${db ? color : '#cbd5e1'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 1,
      }}>
        <div style={{ fontSize: 18 }}>🔊</div>
        <div style={{ fontSize: 11, fontWeight: 900, color: db ? color : '#94a3b8', lineHeight: 1 }}>
          {db ? `${db}` : '?'}
        </div>
      </div>
      <div style={{ fontSize: 10, marginTop: 5, color: 'var(--color-text-muted)', fontWeight: 600 }}>Ruido</div>
      {db && <div style={{ fontSize: 9, color, fontWeight: 700 }}>{db} dB · {'🔈'.repeat(waves)}</div>}
    </div>
  );
}

function SpecRow({ label, value, unit }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{value}{unit ? <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 3 }}>{unit}</span> : ''}</span>
    </div>
  );
}

export default function ProductoModal({ prodId, onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: prod, isLoading } = useQuery({
    queryKey: ['producto', prodId],
    queryFn: () => productosApi.obtener(prodId),
    enabled: !!prodId,
  });

  const aiMut = useMutation({
    mutationFn: () => productosApi.enriquecer(prodId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['producto', prodId] });
      qc.invalidateQueries({ queryKey: ['productos'] });
      toast.success(data?.mensaje || 'Información completada con IA');
    },
    onError: (e) => toast.error(e?.error || 'Error al conectar con IA'),
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const tipoColor = prod ? (TIPO_COLOR[prod.tipo] || '#64748b') : '#64748b';
  const stockTotal = prod?.stocks?.reduce((a, s) => a + s.cantidad, 0) || 0;
  const camposFaltantes = prod ? TECH_FIELDS.filter(f => !prod[f] && prod[f] !== 0).length : 0;
  const camposExtra = prod?.camposExtra ? Object.entries(prod.camposExtra) : [];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--color-surface)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg)', flexShrink: 0 }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>🛞</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {prod ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {prod.marca} {prod.nombreComercial || ''}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>{prod.medida}</span>
                  <span style={{ padding: '1px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: tipoColor + '20', color: tipoColor }}>{prod.tipo}</span>
                  {prod.grupo && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{prod.grupo}</span>}
                </div>
              </>
            ) : <div style={{ height: 36 }} />}
          </div>
          <button
            onClick={onClose}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>
          ) : !prod ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Producto no encontrado</div>
          ) : (
            <>
              {/* EU Label */}
              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-primary)', marginBottom: 12 }}>🏷️ Etiqueta EU de Neumáticos</div>
                <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <GradeBadge grade={prod.eficienciaCombustible} label="Efic. Combustible" />
                  <GradeBadge grade={prod.eficienciaFrenado} label="Efic. Frenado" />
                  <NoiseBadge db={prod.nivelRuido} />
                </div>
              </div>

              {/* Especificaciones técnicas */}
              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-primary)', marginBottom: 8 }}>⚙️ Especificaciones Técnicas</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <div>
                    <SpecRow label="Índice de carga" value={prod.indice_carga} />
                    <SpecRow label="Índice de velocidad" value={prod.velocidad_max} />
                    <SpecRow label="Velocidad máxima" value={prod.velocidadMaxKmh} unit="km/h" />
                    <SpecRow label="Garantía" value={prod.garantia} />
                  </div>
                  <div>
                    <SpecRow label="Carga máx / neumático" value={prod.cargaMaxNeumatico} unit="kg" />
                    <SpecRow label="Carga total (4 neu.)" value={prod.cargaMaxNeumatico ? prod.cargaMaxNeumatico * 4 : null} unit="kg" />
                    <SpecRow label="País fabricación" value={prod.paisFabricacion} />
                    <SpecRow label="Origen de la marca" value={prod.origenMarca} />
                  </div>
                </div>
                {!prod.indice_carga && !prod.velocidad_max && !prod.cargaMaxNeumatico && !prod.garantia && !prod.paisFabricacion && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px 0' }}>Sin especificaciones técnicas — usa el botón IA para rellenarlas</div>
                )}
              </div>

              {/* Precios + Stock */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {/* Precios */}
                <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-primary)', marginBottom: 10 }}>💰 Precios</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-primary)' }}>{fmt(prod.precioRegular) || '—'}</div>
                  {prod.precioOferta && (
                    <div style={{ marginTop: 4, padding: '2px 8px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', fontSize: 13, fontWeight: 700, color: '#16a34a', display: 'inline-block' }}>
                      Oferta {fmt(prod.precioOferta)}
                    </div>
                  )}
                  {prod.descuentoMaximo && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Descuento máx. {parseFloat(prod.descuentoMaximo).toFixed(0)}%
                    </div>
                  )}
                  {prod.sku && <div style={{ marginTop: 8, fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>SKU: {prod.sku}</div>}
                </div>

                {/* Stock */}
                <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-primary)', marginBottom: 10 }}>📍 Stock Total</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: stockTotal > 10 ? '#16a34a' : stockTotal > 0 ? '#f97316' : '#dc2626' }}>
                    {stockTotal} <span style={{ fontSize: 13, fontWeight: 500 }}>uds</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {prod.stocks?.map(s => {
                      const color = s.cantidad <= s.stockMinimo ? '#dc2626' : s.cantidad <= s.stockMinimo * 2 ? '#f97316' : '#16a34a';
                      return (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>{s.sede?.codigoLocal} {s.sede?.nombre?.split(' ')[0]}</span>
                          <span style={{ fontWeight: 700, color }}>{s.cantidad}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Campos Extra */}
              {camposExtra.length > 0 && (
                <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--color-primary)', marginBottom: 8 }}>📋 Campos Adicionales</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                    {camposExtra.map(([k, v]) => (
                      <SpecRow key={k} label={k.replace(/_/g, ' ')} value={v} />
                    ))}
                  </div>
                </div>
              )}

              {/* Imagen */}
              {prod.imagenUrl && (
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <img src={prod.imagenUrl} alt="" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 10, objectFit: 'contain', border: '1px solid var(--color-border)' }} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {prod && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, background: 'var(--color-bg)', flexWrap: 'wrap' }}>
            {camposFaltantes > 0 && (
              <button
                onClick={() => aiMut.mutate()}
                disabled={aiMut.isPending}
                style={{ flex: 1, minWidth: 200, padding: '9px 14px', background: aiMut.isPending ? '#64748b' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: aiMut.isPending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              >
                {aiMut.isPending
                  ? <>⏳ Consultando IA...</>
                  : <>🤖 Completar {camposFaltantes} campo{camposFaltantes > 1 ? 's' : ''} con IA</>}
              </button>
            )}
            {camposFaltantes === 0 && (
              <div style={{ flex: 1, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✅ Ficha técnica completa</div>
            )}
            <button
              onClick={() => { onClose(); navigate(`/inventario/${prodId}`); }}
              style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Editar completo →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
