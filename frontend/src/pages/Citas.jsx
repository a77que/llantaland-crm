import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { citasApi } from '../services/api';
import { useCitasNotification } from '../context/CitasNotificationContext';

const PASO_LABEL = {
  lima_lista:             'Eligiendo local Lima',
  esperando_datos_cliente:'Dando sus datos',
  esperando_confirmacion: 'Confirmando cita',
  completado:             'Completado',
};

const PASO_COLOR = {
  lima_lista:             '#f5c400',
  esperando_datos_cliente:'#f97316',
  esperando_confirmacion: '#3b82f6',
  completado:             '#22c55e',
};

const RANKING_STYLE = {
  caliente: { background: 'rgba(239,68,68,.18)', color: '#ef4444', border: '1px solid rgba(239,68,68,.35)' },
  tibio:    { background: 'rgba(249,115,22,.18)', color: '#f97316', border: '1px solid rgba(249,115,22,.35)' },
  frio:     { background: 'rgba(59,130,246,.18)', color: '#3b82f6', border: '1px solid rgba(59,130,246,.35)' },
};

const RANKING_ICON = { caliente: '🔥', tibio: '🌡️', frio: '❄️' };

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function StockBadge({ stock, localElegido }) {
  if (stock === null || stock === undefined) {
    if (!localElegido) return <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 12 }}>—</span>;
    return <span style={{ color: 'rgba(255,255,255,.35)', fontSize: 12 }}>Sin info</span>;
  }
  const hayStock = stock > 0;
  return (
    <span style={{
      fontWeight: 900,
      fontSize: 13,
      color: hayStock ? '#22c55e' : '#ef4444',
      letterSpacing: 0.5,
    }}>
      {hayStock
        ? `✅ ${stock} unid.`
        : '❌ SIN STOCK'}
    </span>
  );
}

export default function Citas() {
  const { marcarVisto, marcarTodosVistos, nuevasIds, count } = useCitasNotification();

  const [page, setPage]   = useState(1);
  const [q, setQ]         = useState('');
  const [orderDir, setOrderDir] = useState('desc');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['citas', page, q, orderDir],
    queryFn: () => citasApi.listar({ page, limit: 30, q: q || undefined, orderBy: 'updatedAt', orderDir }),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  // Marcar todos como vistos cuando se entra a la página
  useEffect(() => {
    if (count > 0) marcarTodosVistos();
  }, []); // eslint-disable-line

  const citas = data?.citas || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 30);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Black Ops One', sans-serif", fontSize: 22, color: '#f5c400', margin: 0 }}>
            📅 Citas WhatsApp
          </h1>
          <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 12, margin: '4px 0 0', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
            Clientes que eligieron local o provincia y están en proceso de confirmar visita
          </p>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 12 }}>{total} registros</span>
          <button
            onClick={() => refetch()}
            style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: 6, padding: '6px 12px', color: '#888', cursor: 'pointer', fontSize: 12 }}
          >
            {isFetching ? '⟳' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Buscar por teléfono, nombre o DNI..."
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          style={{
            flex: 1, minWidth: 200,
            background: '#111', border: '1px solid #2a2a2a', borderRadius: 8,
            color: '#fff', padding: '8px 12px', fontSize: 13,
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        />
        <select
          value={orderDir}
          onChange={e => setOrderDir(e.target.value)}
          style={{
            background: '#111', border: '1px solid #2a2a2a', borderRadius: 8,
            color: '#fff', padding: '8px 12px', fontSize: 13,
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          <option value="desc">Más recientes primero</option>
          <option value="asc">Más antiguos primero</option>
        </select>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,.35)' }}>Cargando citas...</div>
      ) : citas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,.35)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15 }}>
          No hay citas registradas aún
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif" }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f5c400' }}>
                {['Cliente', 'Contacto', 'Llanta', 'Local / Provincia', 'Stock', 'Paso', 'Ranking', 'Actualizado'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#f5c400', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {citas.map((c, i) => {
                const esNueva = nuevasIds.has(c.id);
                const localNombre = c.localElegido?.nombre || c.localElegido?.nombre_local || null;
                const localCodigo = c.localElegido?.codigoLocal || c.localElegido?.codigo_local || null;
                return (
                  <tr
                    key={c.id}
                    onClick={() => esNueva && marcarVisto(c.id)}
                    style={{
                      borderBottom: '1px solid #1a1a1a',
                      background: esNueva
                        ? 'rgba(34,197,94,.06)'
                        : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)',
                      cursor: 'default',
                      transition: 'background .2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,196,0,.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = esNueva ? 'rgba(34,197,94,.06)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)'}
                  >
                    {/* Cliente */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {esNueva && (
                          <span style={{
                            background: '#22c55e', color: '#000', borderRadius: 4,
                            fontSize: 9, fontWeight: 800, padding: '1px 5px', letterSpacing: 1,
                          }}>NUEVO</span>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: 13 }}>
                            {c.nombreCliente || <span style={{ color: 'rgba(255,255,255,.3)', fontStyle: 'italic' }}>Sin nombre</span>}
                          </div>
                          {c.dniCe && (
                            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>DNI/CE: {c.dniCe}</div>
                          )}
                          {c.marcaAuto && (
                            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>
                              {c.marcaAuto} {c.modeloAuto} {c.anioAuto}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contacto */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <div style={{ color: '#f5c400', fontWeight: 600 }}>{c.telefono}</div>
                    </td>

                    {/* Llanta */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      {c.medidaDetectada ? (
                        <div>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{c.medidaDetectada}</div>
                          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 12 }}>
                            {[c.marcaLlanta, c.modeloLlanta].filter(Boolean).join(' ')}
                          </div>
                          {c.cantidadLlantas > 1 && (
                            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>x{c.cantidadLlantas}</div>
                          )}
                          {c.precioLlanta && (
                            <div style={{ color: '#f5c400', fontSize: 12, fontWeight: 700 }}>
                              S/ {parseFloat(c.precioLlanta).toFixed(2)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,.25)', fontStyle: 'italic', fontSize: 12 }}>Sin medida</span>
                      )}
                    </td>

                    {/* Local / Provincia */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', maxWidth: 180 }}>
                      {localNombre ? (
                        <div>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: 13 }}>{localNombre}</div>
                          {localCodigo && (
                            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>{localCodigo}</div>
                          )}
                          {c.localElegido?.distrito && (
                            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 11 }}>{c.localElegido.distrito}</div>
                          )}
                        </div>
                      ) : c.provinciaDestino ? (
                        <div>
                          <div style={{ fontWeight: 700, color: '#f97316', fontSize: 13 }}>🗺️ {c.provinciaDestino}</div>
                          {c.distritoCliente && (
                            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 11 }}>{c.distritoCliente}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,.25)', fontStyle: 'italic', fontSize: 12 }}>Eligiendo...</span>
                      )}
                    </td>

                    {/* Stock */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <StockBadge stock={c.stockEnLocal} localElegido={c.localElegido} />
                    </td>

                    {/* Paso */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      <span style={{
                        background: `${PASO_COLOR[c.pasoActual] || '#888'}22`,
                        color: PASO_COLOR[c.pasoActual] || '#888',
                        border: `1px solid ${PASO_COLOR[c.pasoActual] || '#888'}44`,
                        borderRadius: 6, padding: '3px 8px',
                        fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                      }}>
                        {PASO_LABEL[c.pasoActual] || c.pasoActual}
                      </span>
                    </td>

                    {/* Ranking */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                      {c.ranking ? (
                        <span style={{
                          ...RANKING_STYLE[c.ranking],
                          borderRadius: 6, padding: '3px 8px',
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {RANKING_ICON[c.ranking]} {c.ranking}
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,.25)', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Fecha */}
                    <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 12 }}>{fmt(c.updatedAt)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: 6, padding: '7px 14px', color: page === 1 ? '#444' : '#fff', cursor: page === 1 ? 'default' : 'pointer', fontSize: 13 }}
          >← Anterior</button>
          <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, lineHeight: '34px' }}>
            {page} / {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: 6, padding: '7px 14px', color: page === totalPages ? '#444' : '#fff', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 13 }}
          >Siguiente →</button>
        </div>
      )}
    </div>
  );
}
