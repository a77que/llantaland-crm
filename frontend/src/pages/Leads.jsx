import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { leadsApi, cotizacionesApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Sonido de notificación con Web Audio API ──────────────────────────────────
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Acorde de dos tonos: primera nota + segunda nota
    const notas = [
      { freq: 880, start: 0,   dur: 0.15 },
      { freq: 1320, start: 0.15, dur: 0.2  },
    ];
    notas.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch { /* silencia si el navegador no soporta AudioContext */ }
}

// Columnas ordenables en Leads
const SORTABLE_LEADS = {
  telefono:'telefono', nombreCliente:'nombreCliente', medidaDetectada:'medidaDetectada',
  pasoActual:'pasoActual', ranking:'ranking', fechaCita:'fechaCita', updatedAt:'updatedAt',
};

const PASO_LABEL = {
  nuevo: 'Nuevo',
  esperando_medida: 'Esperando medida',
  esperando_version_auto: 'Versión auto',
  info_tecnica: 'Info técnica',
  esperando_datos_cliente: 'Datos cliente',
  esperando_eleccion_llanta: 'Eligiendo llanta',
  esperando_distrito: 'Eligiendo distrito',
  esperando_eleccion_b: 'Eligiendo local',
  esperando_local_destino: 'Local destino',
  esperando_confirmacion: 'Confirmando',
  completado: 'Completado',
  opt_out: 'Opt-out',
};

const PASO_COLOR = {
  nuevo: '#64748b', esperando_medida: '#f59e0b', esperando_version_auto: '#f59e0b',
  info_tecnica: '#f59e0b', esperando_datos_cliente: '#3b82f6', esperando_eleccion_llanta: '#3b82f6',
  esperando_distrito: '#8b5cf6', esperando_eleccion_b: '#8b5cf6', esperando_local_destino: '#8b5cf6',
  esperando_confirmacion: '#f97316', completado: '#22c55e', opt_out: '#ef4444',
};

const RANKING_COLOR = { caliente: '#ef4444', tibio: '#f59e0b', frio: '#3b82f6' };
const RANKING_ICON  = { caliente: '🔥', tibio: '🌡️', frio: '❄️' };

const badge = (color) => ({ display: 'inline-block', padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + '22', color });
const pill  = (color) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: color + '18', color, border: `1px solid ${color}40` });

/* ─── Modal / Drawer detalle ──────────────────────────────────── */
function LeadDetalle({ lead, onClose, isMobile }) {
  const navigate = useNavigate();
  if (!lead) return null;

  const crearCotizacion = async () => {
    try {
      const data = await cotizacionesApi.crear({
        leadId:          lead.id,
        telefonoCliente: lead.telefono,
        nombreCliente:   lead.nombreCliente,
        dniCe:           lead.dniCe,
        marcaAuto:       lead.marcaAuto,
        modeloAuto:      lead.modeloAuto,
        anioAuto:        lead.anioAuto,
        medidaLlanta:    lead.medidaDetectada,
        marcaLlanta:     lead.marcaLlanta,
        modeloLlanta:    lead.modeloLlanta,
        cantidad:        lead.cantidadLlantas || 4,
        precioUnit:      lead.precioLlanta || '',
      });
      toast.success(`Cotización ${data.numero} creada`);
      onClose();
      navigate('/cotizaciones');
    } catch (e) {
      toast.error(e?.error || 'Error al crear cotización');
    }
  };
  const local = lead.localInstalacion || lead.localAsignado;
  const localNombre = local?.Nombre || local?.nombre || '—';

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 400,
    background: 'rgba(0,0,0,.5)',
    display: 'flex',
    ...(isMobile
      ? { alignItems: 'flex-end' }
      : { alignItems: 'center', justifyContent: 'center', padding: 20 }),
  };

  const boxStyle = {
    background: 'var(--color-surface)',
    overflowY: 'auto',
    ...(isMobile ? {
      width: '100%',
      maxHeight: '92dvh',
      borderRadius: '20px 20px 0 0',
      padding: '0 0 calc(var(--safe-bottom) + 16px)',
    } : {
      width: '100%', maxWidth: 660,
      maxHeight: '90vh',
      borderRadius: 14,
      padding: 28,
    }),
  };

  const Field = ({ label, value }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--color-text)' }}>{value || '—'}</div>
    </div>
  );

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        {/* Handle bar en móvil */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
          </div>
        )}

        <div style={{ padding: isMobile ? '8px 16px 16px' : 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: isMobile ? 17 : 19, fontWeight: 700 }}>
                {lead.nombreCliente || lead.telefono}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>{lead.telefono}</div>
            </div>
            {!isMobile && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--color-text-muted)', padding: 4 }}>✕</button>
            )}
          </div>

          {/* Estado */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={badge(PASO_COLOR[lead.pasoActual] || '#64748b')}>{PASO_LABEL[lead.pasoActual] || lead.pasoActual}</span>
            {lead.ranking && <span style={pill(RANKING_COLOR[lead.ranking])}>{RANKING_ICON[lead.ranking]} {lead.ranking}</span>}
            {lead.humanTakeover?.agenteActivo && <span style={badge('#8b5cf6')}>👤 Agente humano</span>}
          </div>

          {/* Datos en grid 2 col */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Field label="DNI / CE" value={lead.dniCe} />
            <Field label="Vehículo" value={[lead.marcaAuto, lead.modeloAuto, lead.anioAuto].filter(Boolean).join(' ')} />
            <Field label="Medida llanta" value={lead.medidaDetectada} />
            <Field label="Precio" value={lead.precioLlanta ? `S/ ${parseFloat(lead.precioLlanta).toFixed(2)}` : null} />
            <Field label="Distrito" value={lead.distritoCliente} />
            <Field label="Local asignado" value={localNombre} />
            <Field label="Fecha cita" value={lead.fechaCita} />
            <Field label="Logística" value={lead.estadoLogistica} />
          </div>

          {/* Botones acción */}
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            <button onClick={crearCotizacion} style={{ flex:1, padding:'11px 16px', background:'#f5c400', color:'#000', border:'none', borderRadius:10, fontSize:14, fontWeight:800, cursor:'pointer' }}>
              📋 Crear Cotización
            </button>
            <button onClick={() => { navigate('/cotizaciones'); onClose(); }} style={{ padding:'11px 16px', background:'var(--color-bg)', color:'var(--color-text)', border:'1.5px solid var(--color-border)', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer' }}>
              Ver cotizaciones →
            </button>
          </div>

          {/* Historial */}
          {lead.historial?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--color-text-muted)' }}>
                CONVERSACIÓN ({lead.historial.length} mensajes)
              </div>
              <div style={{ maxHeight: isMobile ? 220 : 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lead.historial.map((m, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: 10, fontSize: 12.5, maxWidth: '86%',
                    alignSelf: m.rol === 'bot' ? 'flex-end' : 'flex-start',
                    background: m.rol === 'bot' ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: m.rol === 'bot' ? '#fff' : 'var(--color-text)',
                  }}>
                    <div style={{ fontSize: 9, opacity: .65, marginBottom: 2 }}>
                      {m.rol.toUpperCase()} · {new Date(m.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {m.mensaje}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Card individual para lista móvil ────────────────────────── */
function LeadCard({ lead, onClick, isNuevo }) {
  const local = lead.localInstalacion || lead.localAsignado;
  const localNombre = local?.Nombre || local?.nombre;
  const color = PASO_COLOR[lead.pasoActual] || '#64748b';

  return (
    <div
      onClick={onClick}
      style={{
        background: isNuevo ? '#fff8e1' : 'var(--color-surface)',
        borderRadius: 12,
        padding: '14px 16px',
        border: isNuevo ? '2px solid #f5c400' : '1px solid var(--color-border)',
        borderLeft: `4px solid ${isNuevo ? '#f5c400' : color}`,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transition: 'box-shadow .15s',
        marginBottom: 10,
        boxShadow: isNuevo ? '0 0 12px rgba(245,196,0,.35)' : undefined,
      }}
    >
      {/* Fila 1: teléfono + ranking + paso + badge NUEVO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isNuevo && (
            <span style={{ background: '#f5c400', color: '#000', fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 10, letterSpacing: 1, textTransform: 'uppercase', animation: 'pulse 1.5s infinite' }}>
              🔔 NUEVO
            </span>
          )}
          <span style={{ fontWeight: 700, fontSize: 15 }}>{lead.nombreCliente || lead.telefono}</span>
          {lead.ranking && <span style={{ fontSize: 15 }}>{RANKING_ICON[lead.ranking]}</span>}
        </div>
        <span style={badge(color)}>{PASO_LABEL[lead.pasoActual] || lead.pasoActual}</span>
      </div>

      {/* Fila 2: detalles secundarios */}
      <div style={{ display: 'flex', gap: 12, fontSize: 12.5, color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
        {lead.nombreCliente && <span>📞 {lead.telefono}</span>}
        {lead.medidaDetectada && <span>🛞 {lead.medidaDetectada}</span>}
        {[lead.marcaAuto, lead.modeloAuto].filter(Boolean).length > 0 && (
          <span>🚗 {[lead.marcaAuto, lead.modeloAuto].filter(Boolean).join(' ')}</span>
        )}
        {localNombre && <span>📍 {localNombre}</span>}
        {lead.fechaCita && <span>📅 {lead.fechaCita}</span>}
      </div>

      {/* Fila 3: precio + hora */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
        {lead.precioLlanta
          ? <span style={{ fontWeight: 700, color: '#16a34a' }}>S/ {parseFloat(lead.precioLlanta).toFixed(2)}</span>
          : <span />
        }
        <span style={{ color: 'var(--color-text-muted)' }}>
          {new Date(lead.updatedAt).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

/* ─── Página principal ─────────────────────────────────────────── */
export default function Leads() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const q       = searchParams.get('q')       || '';
  const paso    = searchParams.get('paso')    || '';
  const ranking = searchParams.get('ranking') || '';
  const page    = parseInt(searchParams.get('page')    || '1');
  const sortBy  = searchParams.get('sortBy')  || 'updatedAt';
  const sortDir = searchParams.get('sortDir') || 'desc';

  const [selectedId, setSelectedId] = useState(null);
  const [nuevosIds, setNuevosIds] = useState(new Set()); // IDs de leads nuevos (no vistos)
  const seenIdsRef = useRef(null); // Set de IDs ya vistos — persiste sin re-render

  // Inicializar seenIds desde localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('leads_seen_ids') || '[]');
      seenIdsRef.current = new Set(saved);
    } catch {
      seenIdsRef.current = new Set();
    }
  }, []);

  // Marcar un lead como visto (clic en él)
  const marcarVisto = useCallback((id) => {
    if (seenIdsRef.current) {
      seenIdsRef.current.add(id);
      // Guardar en localStorage (máx 1000 IDs para no crecer indefinidamente)
      const arr = [...seenIdsRef.current].slice(-1000);
      localStorage.setItem('leads_seen_ids', JSON.stringify(arr));
    }
    setNuevosIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const setParam = (key, val) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    return next;
  }, { replace: true });

  const handleSort = (colKey) => {
    const field = SORTABLE_LEADS[colKey];
    if (!field) return;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (sortBy === field) {
        next.set('sortDir', sortDir === 'asc' ? 'desc' : 'asc');
      } else {
        next.set('sortBy', field);
        next.set('sortDir', 'desc');
      }
      next.set('page', '1');
      return next;
    }, { replace: true });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['leads', { q, paso, ranking, page, sortBy, sortDir }],
    queryFn: () => leadsApi.listar({ q, paso, ranking, page, limit: 50, orderBy: sortBy, orderDir: sortDir }),
    keepPreviousData: true,
    refetchInterval: 20_000,  // re-consultar cada 20s para detectar nuevos leads
    onSuccess: (newData) => {
      if (!seenIdsRef.current) return;
      const nuevos = (newData?.leads || []).filter(l => !seenIdsRef.current.has(l.id));
      if (nuevos.length > 0) {
        setNuevosIds(prev => {
          const next = new Set(prev);
          nuevos.forEach(l => next.add(l.id));
          return next;
        });
        // Solo sonar si la página está visible y hay leads realmente nuevos (no primera carga)
        if (seenIdsRef.current.size > 0 && document.visibilityState !== 'hidden') {
          playNotificationSound();
          toast(`📱 ${nuevos.length} nuevo${nuevos.length > 1 ? 's' : ''} lead${nuevos.length > 1 ? 's' : ''} de WhatsApp`, {
            icon: '🔔', duration: 4000,
            style: { background: '#0f0f0f', color: '#f5c400', border: '1px solid #f5c400', fontWeight: 700 },
          });
        }
      }
    },
  });

  const { data: resumen } = useQuery({
    queryKey: ['leads-resumen'],
    queryFn: leadsApi.resumen,
    refetchInterval: 20_000,
  });

  const { data: leadDetalle } = useQuery({
    queryKey: ['lead', selectedId],
    queryFn: () => leadsApi.obtener(selectedId),
    enabled: !!selectedId,
  });

  const leads = data?.leads || [];
  const total = data?.total || 0;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>Leads WhatsApp</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{total} leads registrados</div>
        </div>
      </div>

      {/* Stats — scroll horizontal en móvil */}
      {resumen && (
        <div style={{
          display: 'flex', gap: 10, marginBottom: 16,
          overflowX: 'auto', paddingBottom: 4,
          scrollbarWidth: 'none',
        }}>
          {[
            { num: resumen.total, label: 'Total', color: 'var(--color-primary)' },
            { num: resumen.hoy,   label: 'Hoy',   color: '#3b82f6' },
            ...(resumen.porRanking || []).filter(r => r.ranking).map(r => ({
              num: r._count, label: `${RANKING_ICON[r.ranking]} ${r.ranking}`, color: RANKING_COLOR[r.ranking],
            })),
            ...(resumen.porPaso || []).filter(p => p.pasoActual === 'completado').map(p => ({
              num: p._count, label: 'Completados', color: '#22c55e',
            })),
          ].map((s, i) => (
            <div key={i} style={{
              flexShrink: 0,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 10, padding: isMobile ? '10px 14px' : '12px 18px', textAlign: 'center',
              minWidth: isMobile ? 80 : 100,
            }}>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: s.color }}>{s.num}</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          style={{
            flex: '1 1 160px', padding: '10px 14px', fontSize: 14,
            border: '1.5px solid var(--color-border)', borderRadius: 10,
            background: 'var(--color-surface)', color: 'var(--color-text)',
            minWidth: 0,
          }}
          placeholder="Buscar teléfono, nombre..."
          value={q}
          onChange={e => setParam('q', e.target.value)}
        />
        <select
          style={{
            flex: '1 1 140px', padding: '10px 12px', fontSize: 13,
            border: '1.5px solid var(--color-border)', borderRadius: 10,
            background: 'var(--color-surface)', color: 'var(--color-text)',
          }}
          value={paso}
          onChange={e => setParam('paso', e.target.value)}
        >
          <option value="">Todos los pasos</option>
          {Object.entries(PASO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          style={{
            flex: '0 0 auto', padding: '10px 12px', fontSize: 13,
            border: '1.5px solid var(--color-border)', borderRadius: 10,
            background: 'var(--color-surface)', color: 'var(--color-text)',
          }}
          value={ranking}
          onChange={e => setParam('ranking', e.target.value)}
        >
          <option value="">Ranking</option>
          <option value="caliente">🔥 Caliente</option>
          <option value="tibio">🌡️ Tibio</option>
          <option value="frio">❄️ Frío</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>Cargando leads...
        </div>
      ) : leads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 44 }}>📱</div>
          <div style={{ marginTop: 12, fontWeight: 600 }}>Sin leads aún</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Se crean automáticamente desde el flujo de WhatsApp.</div>
        </div>
      ) : isMobile ? (
        /* Vista cards en móvil */
        <div>
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} isNuevo={nuevosIds.has(lead.id)} onClick={() => { setSelectedId(lead.id); marcarVisto(lead.id); }} />
          ))}
        </div>
      ) : (
        /* Vista tabla en desktop */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <thead>
              <tr>
                {[
                  { k:'telefono',       label:'Teléfono' },
                  { k:'nombreCliente',  label:'Cliente' },
                  { k:'medidaDetectada',label:'Medida' },
                  { k:'pasoActual',     label:'Paso' },
                  { k:'ranking',        label:'Ranking' },
                  { k:null,             label:'Local' },
                  { k:'fechaCita',      label:'Cita' },
                  { k:'updatedAt',      label:'Actualizado' },
                ].map(({ k, label }) => {
                  const field = k ? SORTABLE_LEADS[k] : null;
                  const isActive = field && sortBy === field;
                  const icon = field ? (isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅') : '';
                  return (
                    <th key={label}
                      onClick={() => k && handleSort(k)}
                      style={{
                        padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                        color: isActive ? '#f5c400' : 'var(--color-text-muted)',
                        textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)',
                        background: isActive ? '#fffbeb' : 'var(--color-bg)',
                        whiteSpace: 'nowrap', cursor: field ? 'pointer' : 'default', userSelect: 'none',
                      }}
                      title={field ? `Ordenar por ${label}` : undefined}
                    >
                      {label}<span style={{ opacity: isActive ? 1 : 0.4, fontSize: 10 }}>{icon}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => {
                const local = lead.localInstalacion || lead.localAsignado;
                const isNuevo = nuevosIds.has(lead.id);
                return (
                  <tr key={lead.id}
                    style={{ cursor: 'pointer', background: isNuevo ? '#fff8e1' : '', outline: isNuevo ? '2px solid #f5c400' : 'none', outlineOffset: '-1px' }}
                    onClick={() => { setSelectedId(lead.id); marcarVisto(lead.id); }}
                    onMouseEnter={e => { if (!isNuevo) e.currentTarget.style.background = 'var(--color-bg)'; }}
                    onMouseLeave={e => { if (!isNuevo) e.currentTarget.style.background = ''; }}>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>
                      {isNuevo && <span style={{ background: '#f5c400', color: '#000', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 8, marginRight: 6, letterSpacing: 1 }}>🔔 NUEVO</span>}
                      {lead.telefono}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>{lead.nombreCliente || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>{lead.medidaDetectada || '—'}</td>
                    <td style={{ padding: '11px 14px' }}><span style={badge(PASO_COLOR[lead.pasoActual] || '#64748b')}>{PASO_LABEL[lead.pasoActual] || lead.pasoActual}</span></td>
                    <td style={{ padding: '11px 14px' }}>{lead.ranking ? <span style={pill(RANKING_COLOR[lead.ranking])}>{RANKING_ICON[lead.ranking]} {lead.ranking}</span> : '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>{local?.Nombre || local?.nombre || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>{lead.fechaCita || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(lead.updatedAt).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {total > 50 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
          <button style={{ padding: '8px 18px', border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', fontSize: 13, fontWeight: 600 }} onClick={() => setSearchParams(p => { const n=new URLSearchParams(p); n.set('page',String(Math.max(1,page-1))); return n; }, {replace:true})} disabled={page === 1}>← Anterior</button>
          <span style={{ padding: '8px 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>Pág {page}</span>
          <button style={{ padding: '8px 18px', border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', fontSize: 13, fontWeight: 600 }} onClick={() => setSearchParams(p => { const n=new URLSearchParams(p); n.set('page',String(page+1)); return n; }, {replace:true})} disabled={leads.length < 50}>Siguiente →</button>
        </div>
      )}

      {/* Detalle */}
      {selectedId && (
        <LeadDetalle
          lead={leadDetalle}
          onClose={() => setSelectedId(null)}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
