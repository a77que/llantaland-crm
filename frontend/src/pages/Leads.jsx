import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { leadsApi, cotizacionesApi } from '../services/api';
import { BotonWhatsApp } from '../components/WhatsAppButtons';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLeadsNotification } from '../context/LeadsNotificationContext';
import { useAuth } from '../hooks/useAuth';

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
  esperando_eleccion_marca: 'Eligiendo marca',
  esperando_eleccion_llanta: 'Eligiendo llanta',
  esperando_distrito: 'Eligiendo distrito',
  esperando_eleccion_b: 'Eligiendo local',
  esperando_local_destino: 'Local destino',
  esperando_confirmacion: 'Confirmando',
  cotizado: 'Cotizado',
  completado: 'Completado',
  opt_out: 'Opt-out',
};

const PASO_COLOR = {
  nuevo: '#64748b', esperando_medida: '#f59e0b', esperando_version_auto: '#f59e0b',
  info_tecnica: '#f59e0b', esperando_datos_cliente: '#3b82f6', esperando_eleccion_marca: '#3b82f6', esperando_eleccion_llanta: '#3b82f6',
  esperando_distrito: '#8b5cf6', esperando_eleccion_b: '#8b5cf6', esperando_local_destino: '#8b5cf6',
  esperando_confirmacion: '#f97316', cotizado: '#f97316', completado: '#22c55e', opt_out: '#ef4444',
};

const RANKING_COLOR = { caliente: '#ef4444', tibio: '#f59e0b', frio: '#3b82f6' };
const RANKING_ICON  = { caliente: '🔥', tibio: '🌡️', frio: '❄️' };

// Etiqueta legible de cada tarjeta de contador, para el aviso de filtros activos
const etiquetaTarjeta = (key) =>
  key === 'hoy' ? 'Hoy'
  : key === 'ayer' ? 'Ayer'
  : key === 'no_desea' ? '❌ No desea nada'
  : key === 'con_cotizacion' ? '✅ Con cotización'
  : key === 'sin_cotizacion' ? '⏳ Sin cotización'
  : RANKING_ICON[key] ? `${RANKING_ICON[key]} ${key}` : key;

const badge = (color) => ({ display: 'inline-block', padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + '22', color });
const pill  = (color) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: color + '18', color, border: `1px solid ${color}40` });

// Destino del lead: provincia siempre manda (nunca convive con un local de
// Lima real, ver localValido() en el backend); si no hay provincia, se
// muestra la tienda de Lima elegida cuando existe.
function destinoDe(lead) {
  if (lead.provinciaDestino) return { tipo: 'provincia', texto: lead.provinciaDestino };
  const local = lead.localInstalacion || lead.localAsignado;
  const nombre = local?.Nombre || local?.nombre;
  if (nombre) return { tipo: 'lima', texto: nombre };
  return null;
}

function DestinoBadge({ lead }) {
  const d = destinoDe(lead);
  if (!d) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  return d.tipo === 'provincia'
    ? <span style={{ color: '#c2410c', fontWeight: 700, fontSize: 12.5 }}>🗺️ {d.texto}</span>
    : <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 12.5 }}>🏪 {d.texto}</span>;
}

/* ─── Modal / Drawer detalle ──────────────────────────────────── */
function LeadDetalle({ lead, onClose, isMobile }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // La conversación se refresca sola: mantener la vista en el último mensaje.
  const chatRef = useRef(null);
  const nMensajes = lead.historial?.length || 0;
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [nMensajes]);

  const noDeseaMutation = useMutation({
    mutationFn: () => leadsApi.noDesea(lead.id),
    onSuccess: () => {
      toast.success('Marcado: el cliente no desea nada');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-resumen'] });
      onClose();
    },
    onError: () => toast.error('No se pudo marcar el lead'),
  });

  const deshacerNoDeseaMutation = useMutation({
    mutationFn: () => leadsApi.deshacerNoDesea(lead.id),
    onSuccess: () => {
      toast.success('Se deshizo la marca de "no desea"');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] });
    },
    onError: () => toast.error('No se pudo deshacer la marca'),
  });

  const confirmarNoDesea = () => {
    if (window.confirm(`¿Confirmas que ${lead.nombreCliente || lead.telefono} no desea nada?\n\nSe marcará como descartado y su paso se reiniciará al inicio (si vuelve a escribir por WhatsApp, el bot empezará de cero).`)) {
      noDeseaMutation.mutate();
    }
  };

  if (!lead) return null;

  // Abrir el flujo completo de cotización con los datos del lead precargados (desde cualquier paso).
  // Si el lead es de provincia, nunca hay un local de Lima real que precargar
  // (aunque llegue un objeto vacío heredado del bot) — evita que se active
  // "generar cita" con una tienda fantasma para un envío a provincia.
  const localBruto = lead.localInstalacion || lead.localAsignado;
  const local = (!lead.provinciaDestino && (localBruto?.Nombre || localBruto?.nombre)) ? localBruto : null;
  const crearCotizacion = () => {
    onClose();
    navigate('/cotizaciones/nueva', { state: {
      leadId: lead.id,
      cliente: { nombre: lead.nombreCliente, telefono: lead.telefono, dniCe: lead.dniCe },
      vehiculo: { marca: lead.marcaAuto, modelo: lead.modeloAuto, anio: lead.anioAuto },
      medida: lead.medidaDetectada || '',
      llanta: { marca: lead.marcaLlanta || '', modelo: lead.modeloLlanta || '', cantidad: lead.cantidadLlantas || 4 },
      sede: local ? { codigoLocal: local.ID || local.codigoLocal, nombre: local.Nombre || local.nombre } : null,
      provinciaDestino: lead.provinciaDestino || null,
    } });
  };
  const destino = destinoDe(lead);

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
      width: '100%', maxWidth: 980,
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
          {/* Estado de cotización (atendido / en espera) */}
          {(() => {
            const tc = (lead.cotizaciones?.length || lead._count?.cotizaciones || 0) > 0;
            return (
              <div style={{ background: tc ? '#dcfce7' : '#fef3c7', border: `1px solid ${tc ? '#86efac' : '#fde68a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{tc ? '✅' : '⏳'}</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: tc ? '#15803d' : '#b45309' }}>
                  {tc ? 'Este lead YA tiene cotización generada' : 'EN ESPERA — aún sin cotización, genérala'}
                </span>
              </div>
            );
          })()}
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

          {/* Cuerpo: en desktop, columna de info a la izquierda + chat completo
              al costado derecho (para que el vendedor vea la conversación sin
              tener que bajar hasta el final del modal). En móvil se apila. */}
          <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: isMobile ? undefined : '1fr 340px', gap: isMobile ? 0 : 24, alignItems: 'start' }}>
          <div>
          {/* Estado */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={badge(PASO_COLOR[lead.pasoActual] || '#64748b')}>{PASO_LABEL[lead.pasoActual] || lead.pasoActual}</span>
            {lead.ranking && <span style={pill(RANKING_COLOR[lead.ranking])}>{RANKING_ICON[lead.ranking]} {lead.ranking}</span>}
            {lead.humanTakeover?.agenteActivo && <span style={badge('#8b5cf6')}>👤 Agente humano</span>}
            {lead.descartadoEn && (
              <span style={badge('#6b7280')} title={`Marcado el ${new Date(lead.descartadoEn).toLocaleString('es-PE')}`}>
                ❌ No desea nada
              </span>
            )}
          </div>

          {/* Datos en grid — 1 col en móvil, 2 col en desktop */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0 16px' }}>
            <Field label="DNI / CE" value={lead.dniCe} />
            <Field label="Vehículo" value={[lead.marcaAuto, lead.modeloAuto, lead.anioAuto].filter(Boolean).join(' ')} />
            <Field label="Medida llanta" value={lead.medidaDetectada} />
            <Field label="Precio" value={lead.precioLlanta ? `S/ ${parseFloat(lead.precioLlanta).toFixed(2)}` : null} />
            <Field label="Distrito" value={lead.distritoCliente} />
            <Field label={destino?.tipo === 'provincia' ? 'Provincia destino' : 'Local asignado'} value={destino ? destino.texto : '—'} />
            <Field label="Fecha cita" value={lead.fechaCita} />
            <Field label="Logística" value={lead.estadoLogistica} />
          </div>

          {/* Botones acción — arriba del flujo para acceso inmediato en móvil.
              En móvil se separan en 2 filas (primaria: cotizar+WhatsApp /
              secundaria: ver cotizaciones + no-desea) para que no queden 4
              botones apretados en una sola fila angosta. */}
          {(() => {
            const cots = [...(lead.cotizaciones || [])].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            const tieneCot = cots.length > 0;
            const verCotizacion = () => { onClose(); navigate(`/cotizaciones/${cots[0].id}`); };

            const noDeseaBtn = lead.descartadoEn ? (
              <button
                onClick={() => deshacerNoDeseaMutation.mutate()}
                disabled={deshacerNoDeseaMutation.isPending}
                style={{ flex: isMobile ? 1 : undefined, padding:'13px 16px', background:'var(--color-bg)', color:'#6b7280', border:'1.5px solid var(--color-border)', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer' }}
              >
                ↩️ Deshacer "no desea"
              </button>
            ) : (
              <button
                onClick={confirmarNoDesea}
                disabled={noDeseaMutation.isPending}
                style={{ flex: isMobile ? 1 : undefined, padding:'13px 16px', background:'#fee2e2', color:'#b91c1c', border:'1.5px solid #fecaca', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer' }}
              >
                ❌ Cliente no desea nada
              </button>
            );

            const verCotizacionesBtn = (
              <button onClick={() => { navigate('/cotizaciones'); onClose(); }} style={{ flex: isMobile ? 1 : undefined, padding:'13px 16px', background:'var(--color-bg)', color:'var(--color-text)', border:'1.5px solid var(--color-border)', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Ver cotizaciones →
              </button>
            );

            return (
              <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {tieneCot ? (
                    <button onClick={verCotizacion} style={{ flex:1, padding:'13px 16px', background:'#16a34a', color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:900, cursor:'pointer' }}>
                      👁️ Ver Cotización
                    </button>
                  ) : (
                    <button onClick={crearCotizacion} style={{ flex:1, padding:'13px 16px', background:'#f5c400', color:'#000', border:'none', borderRadius:10, fontSize:15, fontWeight:900, cursor:'pointer' }}>
                      📋 Crear Cotización
                    </button>
                  )}
                  <BotonWhatsApp telefono={lead.telefono} label="WhatsApp" size="lg" />
                  {!isMobile && verCotizacionesBtn}
                  {!isMobile && noDeseaBtn}
                </div>
                {isMobile && (
                  <div style={{ display:'flex', gap:10 }}>
                    {verCotizacionesBtn}
                    {noDeseaBtn}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Flujo del cliente */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Flujo del cliente
            </div>
            {/* Paso actual destacado */}
            <div style={{
              background: (PASO_COLOR[lead.pasoActual] || '#64748b') + '15',
              border: `1.5px solid ${PASO_COLOR[lead.pasoActual] || '#64748b'}`,
              borderRadius: 10, padding: '10px 14px', marginBottom: 10,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 3 }}>PASO ACTUAL</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: PASO_COLOR[lead.pasoActual] || '#64748b' }}>
                {PASO_LABEL[lead.pasoActual] || lead.pasoActual || '—'}
              </div>
            </div>
            {/* Timeline de transiciones de paso */}
            {lead.historial?.length > 0 && (() => {
              const pasoHist = lead.historial.reduce((acc, m) => {
                if (!m.pasoActual) return acc;
                const last = acc[acc.length - 1];
                if (!last || last.paso !== m.pasoActual) acc.push({ paso: m.pasoActual, ts: m.timestamp });
                return acc;
              }, []);
              return pasoHist.length > 0 && (
                <div style={{ borderLeft: '2px solid var(--color-border)', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pasoHist.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PASO_COLOR[p.paso] || '#64748b', flexShrink: 0, marginTop: 5 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: PASO_COLOR[p.paso] || 'var(--color-text)' }}>
                          {PASO_LABEL[p.paso] || p.paso}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {new Date(p.ts).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          </div>

          {/* Chat completo (columna derecha en desktop, al final en móvil) —
              todo lo que el cliente escribió y lo que el bot le respondió,
              para que el vendedor esté al tanto de cómo va la conversación
              sin salir del modal. */}
          <div style={isMobile ? { marginTop: 12 } : { position: 'sticky', top: 0, maxHeight: 'calc(90vh - 56px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>💬 CONVERSACIÓN {nMensajes > 0 ? `(${nMensajes} mensajes)` : ''}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '1px 8px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                EN VIVO
              </span>
            </div>
            {lead.historial?.length > 0 ? (
              <div ref={chatRef} style={{
                flex: isMobile ? undefined : 1,
                maxHeight: isMobile ? 340 : undefined,
                overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
                background: 'var(--color-bg)', borderRadius: 10, padding: 10,
                border: '1px solid var(--color-border)',
              }}>
                {lead.historial.map((m, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: 10, fontSize: 12.5, maxWidth: '88%',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    alignSelf: m.rol === 'bot' ? 'flex-end' : 'flex-start',
                    background: m.rol === 'bot' ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: m.rol === 'bot' ? '#fff' : 'var(--color-text)',
                    border: m.rol === 'bot' ? 'none' : '1px solid var(--color-border)',
                  }}>
                    <div style={{ fontSize: 9, opacity: .65, marginBottom: 2 }}>
                      {m.rol === 'bot' ? '🤖 BOT' : '🧑 CLIENTE'} · {new Date(m.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {m.mensaje}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 10, border: '1px dashed var(--color-border)' }}>
                Sin mensajes todavía.
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Card individual para lista móvil ────────────────────────── */
function LeadCard({ lead, onClick, isNuevo }) {
  const destino = destinoDe(lead);
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
      {/* Estado de cotización / descartado */}
      {(() => {
        if (lead.descartadoEn) {
          return (
            <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, marginBottom: 8, background: '#e5e7eb', color: '#4b5563' }}>
              ❌ No desea nada
            </div>
          );
        }
        const tc = (lead._count?.cotizaciones || lead.cotizaciones?.length || 0) > 0;
        return (
          <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999, marginBottom: 8, background: tc ? '#dcfce7' : '#fef3c7', color: tc ? '#15803d' : '#b45309' }}>
            {tc ? '✅ Con cotización' : '⏳ Sin cotización'}
          </div>
        );
      })()}
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
        {destino && <span>{destino.tipo === 'provincia' ? '🗺️' : '📍'} {destino.texto}</span>}
        {lead.fechaCita && <span>📅 {lead.fechaCita}</span>}
      </div>

      {/* Fila 3: precio + hora */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
        {lead.precioLlanta
          ? <span style={{ fontWeight: 700, color: '#16a34a' }}>S/ {parseFloat(lead.precioLlanta).toFixed(2)}</span>
          : <span />
        }
        <span style={{ color: 'var(--color-text-muted)' }}>
          {new Date(lead.timestamp).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
  const hoy     = searchParams.get('hoy') === '1';
  const cardsParam = searchParams.get('cards') || '';
  const page    = parseInt(searchParams.get('page')    || '1');
  const sortBy  = searchParams.get('sortBy')  || 'updatedAt';
  const sortDir = searchParams.get('sortDir') || 'desc';
  // 'pendientes' (default) = oculta cotizados y marcados "no desea" — solo lo que falta atender.
  // 'todos' = pestaña nueva sin ese filtro, con las mismas herramientas de búsqueda/filtro.
  const vista   = searchParams.get('vista')   || 'pendientes';

  const [selectedId, setSelectedId] = useState(null);

  // Notificaciones globales — estado compartido con Sidebar y BottomNav
  const { nuevosIds, marcarVisto } = useLeadsNotification();
  const { businessType } = useAuth();

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

  // Filtro rápido por tarjetas de contador (Total/Hoy/Ayer/Tibio/Caliente/Frío/Completados).
  // Selección MÚLTIPLE: cada tarjeta activa viaja en el param `cards` (lista separada
  // por comas) y el backend las combina entre sí con OR — ej. "ayer" + "caliente"
  // muestra juntos los leads de ayer Y todos los calientes, sin importar la fecha.
  const tarjetasActivas = new Set(cardsParam.split(',').map(s => s.trim()).filter(Boolean));

  const alternarTarjeta = (key) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (key === 'total') {
      // 'Total' = sin filtro de tarjetas: quita cualquier selección previa
      next.delete('cards');
    } else {
      const activas = new Set(tarjetasActivas);
      if (activas.has(key)) activas.delete(key); else activas.add(key);
      if (activas.size) next.set('cards', Array.from(activas).join(',')); else next.delete('cards');
    }
    next.set('page', '1');
    return next;
  }, { replace: true });

  const limpiarTarjetas = () => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.delete('cards');
    next.set('page', '1');
    return next;
  }, { replace: true });

  // Cada pestaña arranca con los filtros limpios — evita que un filtro de
  // búsqueda/paso/tarjeta activo en una pestaña oculte leads inesperadamente
  // al cambiar a la otra.
  const cambiarVista = (nuevaVista) => setSearchParams(() => {
    const next = new URLSearchParams();
    next.set('vista', nuevaVista);
    next.set('page', '1');
    return next;
  }, { replace: true });

  const { data, isLoading } = useQuery({
    queryKey: ['leads', businessType, { q, paso, ranking, hoy, cards: cardsParam, page, sortBy, sortDir, vista }],
    queryFn: () => leadsApi.listar({ q, paso, ranking, hoy: hoy ? '1' : undefined, cards: cardsParam || undefined, pendientes: vista === 'pendientes' ? '1' : undefined, page, limit: 50, orderBy: sortBy, orderDir: sortDir }),
    placeholderData: (prev) => prev,
    refetchInterval: 20_000,  // re-consultar cada 20s para detectar nuevos leads
  });

  const { data: resumen } = useQuery({
    queryKey: ['leads-resumen', businessType],
    queryFn: leadsApi.resumen,
    refetchInterval: 20_000,
  });

  const { data: leadDetalle } = useQuery({
    queryKey: ['lead', selectedId],
    queryFn: () => leadsApi.obtener(selectedId),
    enabled: !!selectedId,
    // La conversación con el bot se sigue en vivo mientras el modal esté abierto.
    refetchInterval: selectedId ? 5_000 : false,
    refetchIntervalInBackground: false,
  });

  const leads = data?.leads || [];
  const total = data?.total || 0;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>Leads WhatsApp</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{total} leads {vista === 'pendientes' ? 'por atender' : 'registrados'}</div>
        </div>
      </div>

      {/* Pestañas: "Por atender" (limpia cotizados y "no desea") vs "Todos los leads" */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
        {[
          { key: 'pendientes', label: '🧹 Por atender' },
          { key: 'todos',      label: '📁 Todos los leads' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => cambiarVista(t.key)}
            style={{
              flex: isMobile ? 1 : undefined,
              padding: isMobile ? '10px 8px' : '10px 16px', fontSize: isMobile ? 12.5 : 13, fontWeight: 700, cursor: 'pointer',
              background: 'none', border: 'none',
              borderBottom: vista === t.key ? '2.5px solid #f5c400' : '2.5px solid transparent',
              color: vista === t.key ? 'var(--color-text)' : 'var(--color-text-muted)',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats — scroll horizontal en móvil. Click filtra la lista por esa categoría */}
      {resumen && (
        <div style={{
          display: 'flex', gap: 10, marginBottom: 16,
          overflowX: 'auto', paddingBottom: 4,
          scrollbarWidth: 'none',
        }}>
          {[
            { num: resumen.total, label: 'Total', color: 'var(--color-primary)', key: 'total' },
            { num: resumen.hoy,   label: 'Hoy',   color: '#3b82f6', key: 'hoy' },
            { num: resumen.ayer,  label: 'Ayer',  color: '#6366f1', key: 'ayer' },
            ...(vista === 'pendientes'
              ? (resumen.porRanking || []).filter(r => r.ranking).map(r => ({
                  num: r._count, label: `${RANKING_ICON[r.ranking]} ${r.ranking}`, color: RANKING_COLOR[r.ranking], key: r.ranking,
                }))
              : [
                  { num: resumen.noDesea ?? 0,       label: '❌ No desea nada',  color: '#6b7280', key: 'no_desea' },
                  { num: resumen.conCotizacion ?? 0, label: '✅ Con cotización', color: '#16a34a', key: 'con_cotizacion' },
                  { num: resumen.sinCotizacion ?? 0, label: '⏳ Sin cotización', color: '#f59e0b', key: 'sin_cotizacion' },
                ]),
          ].map((s, i) => {
            const activa = s.key !== 'total' && tarjetasActivas.has(s.key);
            return (
              <div key={i}
                onClick={() => alternarTarjeta(s.key)}
                title={activa ? 'Filtro activo — clic para quitarlo, clic en otra tarjeta para combinar' : `Filtrar lista por: ${s.label} (se puede combinar con otras tarjetas)`}
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  background: activa ? (s.color + '1a') : 'var(--color-surface)',
                  border: activa ? `1.5px solid ${s.color}` : '1px solid var(--color-border)',
                  boxShadow: activa ? `0 0 0 3px ${s.color}30` : undefined,
                  borderRadius: 10, padding: isMobile ? '10px 14px' : '12px 18px', textAlign: 'center',
                  minWidth: isMobile ? 80 : 100,
                  cursor: 'pointer',
                  transition: 'box-shadow .15s, border-color .15s, background .15s',
                }}
              >
                {activa && (
                  <button
                    onClick={(e) => { e.stopPropagation(); alternarTarjeta(s.key); }}
                    title="Quitar esta tarjeta del filtro"
                    style={{
                      position: 'absolute', top: -7, right: -7,
                      width: 20, height: 20, borderRadius: '50%',
                      background: s.color, color: '#fff', border: '2px solid var(--color-surface)',
                      fontSize: 10, fontWeight: 900, lineHeight: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, cursor: 'pointer',
                    }}
                  >✕</button>
                )}
                <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: s.color }}>{s.num}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Aviso de filtros activos por tarjetas (selección múltiple → combinadas con OR) */}
      {tarjetasActivas.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--color-bg)', border: '1px dashed var(--color-border)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12.5,
          color: 'var(--color-text-muted)',
        }}>
          <span>🔎 Mostrando: <strong style={{ color: 'var(--color-text)' }}>
            {Array.from(tarjetasActivas).map(etiquetaTarjeta).join('  +  ')}
          </strong></span>
          <button onClick={limpiarTarjetas} style={{
            marginLeft: 'auto', background: 'none', border: '1px solid var(--color-border)',
            borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '3px 9px',
            color: 'var(--color-text-muted)', cursor: 'pointer',
          }}>✕ Quitar filtros</button>
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
            <LeadCard key={lead.id} lead={lead} isNuevo={nuevosIds.has(lead.id) && !((lead._count?.cotizaciones || 0) > 0)} onClick={() => { setSelectedId(lead.id); marcarVisto(lead.id); }} />
          ))}
        </div>
      ) : (
        /* Vista tabla en desktop */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <thead>
              <tr>
                {[
                  { k:null,             label:'Cotización' },
                  { k:'telefono',       label:'Teléfono' },
                  { k:null,             label:'Lima / Provincia' },
                  { k:'medidaDetectada',label:'Medida' },
                  { k:'pasoActual',     label:'Paso' },
                  { k:'ranking',        label:'Ranking' },
                  { k:'fechaCita',      label:'Cita' },
                  { k:null,             label:'1er mensaje' },
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
                const tieneCot = (lead._count?.cotizaciones || 0) > 0;
                // "Nuevo" es por dispositivo (localStorage); si ya tiene cotización (atendido,
                // dato del servidor) no se resalta como nuevo en NINGÚN dispositivo → consistente.
                const isNuevo = nuevosIds.has(lead.id) && !tieneCot;
                return (
                  <tr key={lead.id}
                    style={{ cursor: 'pointer', background: isNuevo ? '#fff8e1' : '', outline: isNuevo ? '2px solid #f5c400' : 'none', outlineOffset: '-1px' }}
                    onClick={() => { setSelectedId(lead.id); marcarVisto(lead.id); }}
                    onMouseEnter={e => { if (!isNuevo) e.currentTarget.style.background = 'var(--color-bg)'; }}
                    onMouseLeave={e => { if (!isNuevo) e.currentTarget.style.background = ''; }}>
                    <td style={{ padding: '11px 14px', background: lead.descartadoEn ? '#e5e7eb' : (tieneCot ? '#dcfce7' : '#fef3c7'), borderLeft: `4px solid ${lead.descartadoEn ? '#9ca3af' : (tieneCot ? '#16a34a' : '#f59e0b')}` }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: lead.descartadoEn ? '#4b5563' : (tieneCot ? '#15803d' : '#b45309'), whiteSpace: 'nowrap' }}>
                        {lead.descartadoEn ? '❌ No desea nada' : (tieneCot ? '✅ Con cotización' : '⏳ Sin cotización')}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>
                      {isNuevo && <span style={{ background: '#f5c400', color: '#000', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 8, marginRight: 6, letterSpacing: 1 }}>🔔 NUEVO</span>}
                      {lead.telefono}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}><DestinoBadge lead={lead} /></td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>{lead.medidaDetectada || '—'}</td>
                    <td style={{ padding: '11px 14px' }}><span style={badge(PASO_COLOR[lead.pasoActual] || '#64748b')}>{PASO_LABEL[lead.pasoActual] || lead.pasoActual}</span></td>
                    <td style={{ padding: '11px 14px' }}>{lead.ranking ? <span style={pill(RANKING_COLOR[lead.ranking])}>{RANKING_ICON[lead.ranking]} {lead.ranking}</span> : '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>{lead.fechaCita || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(lead.timestamp).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
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
