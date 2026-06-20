import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productosApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';
import LoadingSpinner from '../components/common/LoadingSpinner';

const MOTIVO_LABEL = {
  limite_velocidad: 'Límite de velocidad de la IA (reintenta en un momento)',
  sin_respuesta: 'La IA no respondió a tiempo',
  sin_campos: 'La IA no logró determinar los datos de esta llanta',
  sin_ia: 'No hay IA activa/configurada',
  excepcion: 'Error de conexión',
  desconocido: 'No se pudo completar',
};

export default function CompletarIA() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [q, setQ] = useState('');
  const [progreso, setProgreso] = useState(null); // { total, hechas, exitosos }
  const [fallos, setFallos] = useState([]);        // detalle de las que no se pudieron

  const { data, isLoading } = useQuery({ queryKey: ['incompletos'], queryFn: productosApi.incompletos });

  const unaMut = useMutation({
    mutationFn: (id) => productosApi.enriquecer(id),
    onSuccess: (r) => {
      toast.success(r?.mensaje || 'Completado con IA');
      qc.invalidateQueries({ queryKey: ['incompletos'] });
      qc.invalidateQueries({ queryKey: ['productos'] });
    },
    onError: (e) => toast.error(e?.error || 'No se pudo completar con IA'),
  });

  const items = (data?.items || []).filter(i => {
    if (!q) return true;
    return `${i.marca} ${i.modelo} ${i.medida} ${i.sku}`.toLowerCase().includes(q.toLowerCase());
  });

  const rellenarTodas = async (idsArg) => {
    let ids = (idsArg && idsArg.length ? idsArg : (data?.items || []).map(i => i.id)).slice();
    if (!ids.length) return;
    const sleep = (ms) => new Promise(s => setTimeout(s, ms));
    const total = ids.length;
    let exitosos = 0, hechas = 0, reintentos = 0;
    const fallosAll = [];
    setFallos([]);
    setProgreso({ total, hechas: 0, exitosos: 0 });
    try {
      while (ids.length) {
        let r;
        try {
          r = await productosApi.enriquecerMasivo(ids);
        } catch (e) {
          // Sin clave de IA → detener con mensaje claro
          if (String(e?.error || '').toLowerCase().includes('ia configurada')) {
            toast.error('No hay clave de IA configurada (Admin → Config APIs).'); break;
          }
          // Error de red/timeout → reintentar el mismo lote (hasta 4 veces) sin perder avance
          reintentos++;
          if (reintentos > 4) { toast('La IA está saturada; reintenta en unos minutos. Avance guardado.', { icon: '⏸️' }); break; }
          await sleep(4000);
          continue;
        }
        reintentos = 0;
        exitosos += r.exitosos || 0;
        hechas += r.procesados || 0;
        if (Array.isArray(r.fallos)) fallosAll.push(...r.fallos);
        ids = ids.slice(r.procesados || 0);
        setProgreso({ total, hechas, exitosos });
        if (!r.procesados) break;
        if (r.rate) await sleep(2500); // si la IA marcó límite, pausa extra
      }
      setFallos(fallosAll);
      toast.success(`Completadas ${exitosos} de ${total}.${fallosAll.length ? ` ${fallosAll.length} no se pudieron (ver detalle abajo).` : ''}`);
    } finally {
      setProgreso(null);
      qc.invalidateQueries({ queryKey: ['incompletos'] });
      qc.invalidateQueries({ queryKey: ['productos'] });
    }
  };

  if (isLoading) return <LoadingSpinner fullPage />;

  const corriendo = !!progreso;
  const btn = (bg, color = '#fff') => ({ padding: '8px 14px', borderRadius: 8, border: 'none', background: bg, color, fontSize: 13, fontWeight: 700, cursor: corriendo ? 'wait' : 'pointer', whiteSpace: 'nowrap' });

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>🤖 Rellenar ficha con IA</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Llantas con datos técnicos incompletos. Complétalos uno por uno o todos en automático.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn(items.length || corriendo ? '#6366f1' : '#94a3b8')} disabled={corriendo || !(data?.items || []).length} onClick={() => rellenarTodas()}>
            {corriendo ? `Rellenando… ${progreso.hechas}/${progreso.total}` : `🤖 Rellenar todas (${(data?.items || []).length})`}
          </button>
          <Link to="/inventario" style={{ ...btn('var(--color-surface)', 'var(--color-text)'), border: '1px solid var(--color-border)', textDecoration: 'none' }}>← Inventario</Link>
        </div>
      </div>

      {/* Resumen / progreso */}
      <div style={{ background: corriendo ? '#eef2ff' : '#fffbeb', border: `1px solid ${corriendo ? '#c7d2fe' : '#fde68a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, fontWeight: 600, color: corriendo ? '#3730a3' : '#92400e' }}>
        {corriendo
          ? `Procesando con IA… ${progreso.hechas} de ${progreso.total} (✅ ${progreso.exitosos} completadas). No cierres esta pestaña.`
          : `${data?.total ?? 0} llanta(s) con ficha incompleta.`}
      </div>

      {/* Detalle de las que fallaron + reintentar */}
      {!corriendo && fallos.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#b91c1c' }}>⚠️ {fallos.length} no se pudieron completar</div>
            <button style={btn('#dc2626')} onClick={() => rellenarTodas(fallos.map(f => f.id))}>🔁 Reintentar las que fallaron</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {fallos.map((f, i) => (
              <div key={f.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 12, padding: '4px 0', borderBottom: '1px solid #fee2e2' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <strong>{f.marca || ''} {f.modelo || ''}</strong> {f.medida || ''} {f.sku ? <span style={{ color: 'var(--color-text-muted)' }}>({f.sku})</span> : ''}
                </span>
                <span style={{ color: '#b45309', fontWeight: 600, whiteSpace: 'nowrap' }}>{MOTIVO_LABEL[f.motivo] || f.motivo || 'No se pudo'}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            La mayoría se resuelve reintentando (el límite de velocidad de la IA es la causa más común). Las que digan "no logró determinar los datos" suelen ser modelos poco conocidos: complétalas a mano o usa otra IA (cambia la prioridad en Config APIs).
          </div>
        </div>
      )}

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar marca, modelo, medida o SKU…"
        style={{ width: '100%', padding: '9px 14px', fontSize: 14, border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text)', marginBottom: 12, boxSizing: 'border-box' }} />

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 42 }}>✅</div>
          <div style={{ marginTop: 10, fontWeight: 600 }}>Todas las llantas tienen su ficha completa</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(it => {
            const cargando = unaMut.isPending && unaMut.variables === it.id;
            return (
              <div key={it.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{it.marca} · {it.modelo || '(sin modelo)'} <span style={{ color: 'var(--color-primary)' }}>{it.medida}</span></div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace', marginBottom: 5 }}>{it.sku}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>Faltan:</span>
                    {it.faltanLabels.map(f => <span key={f} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>{f}</span>)}
                  </div>
                </div>
                <button onClick={() => unaMut.mutate(it.id)} disabled={unaMut.isPending || corriendo}
                  style={{ padding: '9px 14px', borderRadius: 9, border: 'none', background: cargando ? '#94a3b8' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {cargando ? '⏳ Consultando…' : '🤖 Rellenar con IA'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
