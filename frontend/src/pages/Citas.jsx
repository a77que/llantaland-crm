import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { citasApi, cotizacionesApi } from '../services/api';
import { useCitasNotification } from '../context/CitasNotificationContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtFecha(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtHora(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  return `S/ ${parseFloat(v).toFixed(2)}`;
}

const RANKING_STYLE = {
  caliente: { bg: 'rgba(239,68,68,.18)', color: '#ef4444', border: '1px solid rgba(239,68,68,.35)' },
  tibio:    { bg: 'rgba(249,115,22,.18)', color: '#f97316', border: '1px solid rgba(249,115,22,.35)' },
  frio:     { bg: 'rgba(59,130,246,.18)', color: '#3b82f6', border: '1px solid rgba(59,130,246,.35)' },
};
const RANKING_ICON = { caliente: '🔥', tibio: '🌡️', frio: '❄️' };

const ESTADO_COT_COLOR = {
  BORRADOR:'#64748b', ENVIADA:'#3b82f6', ACEPTADA:'#22c55e',
  RECHAZADA:'#ef4444', CONVERTIDA:'#8b5cf6',
};

// ─── Modal Convertir a Cotización ────────────────────────────────────────────

function ModalCotizacion({ cita, onClose, onCreada }) {
  const [form, setForm] = useState({
    nombreCliente:   cita.nombreCliente  || '',
    telefonoCliente: cita.telefono       || '',
    dniCe:           cita.dniCe          || '',
    marcaAuto:       cita.marcaAuto      || '',
    modeloAuto:      cita.modeloAuto     || '',
    anioAuto:        cita.anioAuto       || '',
    medidaLlanta:    cita.medidaDetectada|| '',
    marcaLlanta:     cita.marcaLlanta    || '',
    modeloLlanta:    cita.modeloLlanta   || '',
    cantidad:        cita.cantidadCalc   || cita.cantidadLlantas || 1,
    precioUnit:      cita.precioUnitCalc || cita.precioLlanta    || '',
    descuento:       '',
    notas:           '',
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const crearMut = useMutation({
    mutationFn: () => cotizacionesApi.crear({ ...form, leadId: cita.id }),
    onSuccess: (data) => {
      toast.success(`Cotización ${data.numero} creada`);
      onCreada(data);
      onClose();
    },
    onError: (e) => toast.error(e?.error || 'Error al crear cotización'),
  });

  const inp = {
    width: '100%', padding: '8px 11px', fontSize: 13,
    border: '1.5px solid #2a2a2a', borderRadius: 8,
    background: '#111', color: '#fff',
  };
  const lbl = (txt) => (
    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
      {txt}
    </label>
  );
  const grp = { marginBottom: 10 };

  const totalCalc = Math.max(0, parseFloat(form.precioUnit || 0) * parseInt(form.cantidad || 1) - parseFloat(form.descuento || 0));

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 580, maxHeight: '92dvh', overflowY: 'auto', padding: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Black Ops One', sans-serif", fontSize: 16, color: '#f5c400' }}>
            📋 Nueva Cotización
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#888', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Fuente */}
        <div style={{ background: 'rgba(245,196,0,.07)', border: '1px solid rgba(245,196,0,.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 18, fontSize: 12, color: '#f5c400', fontFamily: "'Barlow Condensed', sans-serif" }}>
          📱 Lead WhatsApp: <strong>{cita.telefono}</strong>
        </div>

        {/* Sección Cliente */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#f5c400', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, borderBottom: '1px solid #2a2a2a', paddingBottom: 6 }}>
          Cliente
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: 14 }}>
          <div style={grp}>{lbl('Nombre completo')}<input style={inp} value={form.nombreCliente} onChange={set('nombreCliente')} placeholder="Juan Pérez Gómez" /></div>
          <div style={grp}>{lbl('DNI / CE')}<input style={inp} value={form.dniCe} onChange={set('dniCe')} placeholder="45678901" /></div>
          <div style={grp}>{lbl('Teléfono')}<input style={inp} value={form.telefonoCliente} onChange={set('telefonoCliente')} /></div>
          <div style={grp}>{lbl('Vehículo (marca modelo año)')}<input style={inp} value={`${form.marcaAuto} ${form.modeloAuto} ${form.anioAuto}`.trim()} onChange={e => { const p = e.target.value.split(' '); setForm(f => ({ ...f, marcaAuto: p[0]||'', modeloAuto: p.slice(1,-1).join(' ')||'', anioAuto: p[p.length-1]||'' })); }} placeholder="Toyota Corolla 2020" /></div>
        </div>

        {/* Sección Producto */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#f5c400', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, borderBottom: '1px solid #2a2a2a', paddingBottom: 6 }}>
          Llanta
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 14px', marginBottom: 10 }}>
          <div style={grp}>{lbl('Medida')}<input style={inp} value={form.medidaLlanta} onChange={set('medidaLlanta')} placeholder="195/65R15" /></div>
          <div style={grp}>{lbl('Marca')}<input style={inp} value={form.marcaLlanta} onChange={set('marcaLlanta')} placeholder="Michelin" /></div>
          <div style={grp}>{lbl('Modelo')}<input style={inp} value={form.modeloLlanta} onChange={set('modeloLlanta')} placeholder="Energy E3" /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 14px', marginBottom: 14 }}>
          <div style={grp}>{lbl('Cantidad')}<input style={inp} type="number" min="1" value={form.cantidad} onChange={set('cantidad')} /></div>
          <div style={grp}>{lbl('Precio unit. S/')}<input style={inp} type="number" min="0" value={form.precioUnit} onChange={set('precioUnit')} placeholder="380.00" /></div>
          <div style={grp}>{lbl('Descuento S/')}<input style={inp} type="number" min="0" value={form.descuento} onChange={set('descuento')} placeholder="0" /></div>
        </div>

        {/* Total */}
        {form.precioUnit && (
          <div style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 8, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 700 }}>Total:</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#22c55e' }}>{fmtMoney(totalCalc)}</span>
          </div>
        )}

        {/* Notas */}
        <div style={{ marginBottom: 20 }}>
          {lbl('Notas (instalación, garantía, etc.)')}
          <textarea style={{ ...inp, height: 56, resize: 'vertical' }} value={form.notas} onChange={set('notas')} placeholder="Incluye instalación, garantía de fábrica..." />
        </div>

        <button
          onClick={() => crearMut.mutate()}
          disabled={crearMut.isPending || !form.medidaLlanta || !form.precioUnit}
          style={{
            width: '100%', padding: '13px',
            background: (!form.medidaLlanta || !form.precioUnit) ? '#1a1a1a' : '#f5c400',
            color: (!form.medidaLlanta || !form.precioUnit) ? '#555' : '#000',
            border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 900, cursor: 'pointer',
          }}
        >
          {crearMut.isPending ? '⏳ Creando...' : '✅ Crear Cotización'}
        </button>
      </div>
    </div>
  );
}

// ─── Stock Badge ─────────────────────────────────────────────────────────────

function StockBadge({ stock, localElegido }) {
  if (stock === null || stock === undefined) {
    if (!localElegido) return <span style={{ color: 'rgba(255,255,255,.25)', fontSize: 12 }}>—</span>;
    return <span style={{ color: 'rgba(255,255,255,.35)', fontSize: 12 }}>Sin info</span>;
  }
  const hayStock = stock > 0;
  return (
    <span style={{ fontWeight: 900, fontSize: 13, color: hayStock ? '#22c55e' : '#ef4444' }}>
      {hayStock ? `✅ ${stock} u.` : '❌ SIN STOCK'}
    </span>
  );
}

// ─── Celda compacta ──────────────────────────────────────────────────────────
const TD = ({ children, style = {} }) => (
  <td style={{ padding: '8px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap', borderBottom: '1px solid #1a1a1a', ...style }}>
    {children}
  </td>
);
const TH = ({ children }) => (
  <th style={{ padding: '9px 10px', textAlign: 'left', color: '#f5c400', fontWeight: 700, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid #f5c400', background: '#0a0a0a' }}>
    {children}
  </th>
);

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function Citas() {
  const qc = useQueryClient();
  const { marcarTodosVistos, nuevasIds, count } = useCitasNotification();

  const [page, setPage]     = useState(1);
  const [q, setQ]           = useState('');
  const [orderDir, setOrderDir] = useState('desc');
  const [modalCita, setModalCita] = useState(null);  // cita para convertir

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['citas', page, q, orderDir],
    queryFn: () => citasApi.listar({ page, limit: 30, q: q || undefined, orderBy: 'updatedAt', orderDir }),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (count > 0) marcarTodosVistos();
  }, []); // eslint-disable-line

  const citas = data?.citas || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 30);

  const handleCotizacionCreada = () => {
    qc.invalidateQueries(['citas']);
    qc.invalidateQueries(['cotizaciones']);
  };

  return (
    <div style={{ maxWidth: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Black Ops One', sans-serif", fontSize: 22, color: '#f5c400', margin: 0 }}>
            📅 Citas
          </h1>
          <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 12, margin: '4px 0 0', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
            Clientes que eligieron local en Lima o indicaron provincia — en proceso de confirmar visita
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
          style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 13 }}
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
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #1e1e1e' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", minWidth: 1600 }}>
            <thead>
              <tr>
                <TH>Fecha</TH>
                <TH>Teléfono</TH>
                <TH>Nombre Cliente</TH>
                <TH>Documento</TH>
                <TH>Marca Auto</TH>
                <TH>Modelo Auto</TH>
                <TH>Año</TH>
                <TH>Medida Llanta</TH>
                <TH>Marca Llanta</TH>
                <TH>Modelo Llanta</TH>
                <TH>Cant.</TH>
                <TH>P. Unit</TH>
                <TH>P. Total</TH>
                <TH>Tipo Venta</TH>
                <TH>Local Instalación</TH>
                <TH>Dirección</TH>
                <TH>Provincia</TH>
                <TH>Stock</TH>
                <TH>Ranking</TH>
                <TH>Cotización</TH>
                <TH>Acción</TH>
              </tr>
            </thead>
            <tbody>
              {citas.map((c, i) => {
                const esNueva      = nuevasIds.has(c.id);
                const localNombre  = c.localElegido?.nombre || c.localElegido?.nombre_local || null;
                const localDir     = c.localElegido?.direccion || c.localElegido?.direccion_local || null;
                const rk           = RANKING_STYLE[c.ranking];

                return (
                  <tr
                    key={c.id}
                    style={{
                      background: esNueva
                        ? 'rgba(34,197,94,.06)'
                        : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,196,0,.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = esNueva ? 'rgba(34,197,94,.06)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)'}
                  >
                    {/* Fecha / Hora */}
                    <TD>
                      <div style={{ color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>{fmtFecha(c.timestamp)}</div>
                      <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>{fmtHora(c.timestamp)}</div>
                      {esNueva && <span style={{ background: '#22c55e', color: '#000', borderRadius: 4, fontSize: 8, fontWeight: 900, padding: '1px 4px' }}>NUEVO</span>}
                    </TD>

                    {/* Teléfono */}
                    <TD>
                      <span style={{ color: '#f5c400', fontWeight: 700 }}>{c.telefono}</span>
                    </TD>

                    {/* Nombre */}
                    <TD style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {c.nombreCliente || <span style={{ color: 'rgba(255,255,255,.25)', fontStyle: 'italic' }}>Sin nombre</span>}
                      </span>
                    </TD>

                    {/* Documento */}
                    <TD>
                      <span style={{ color: 'rgba(255,255,255,.7)' }}>{c.dniCe || '—'}</span>
                    </TD>

                    {/* Marca Auto */}
                    <TD><span style={{ color: 'rgba(255,255,255,.7)' }}>{c.marcaAuto || '—'}</span></TD>

                    {/* Modelo Auto */}
                    <TD><span style={{ color: 'rgba(255,255,255,.7)' }}>{c.modeloAuto || '—'}</span></TD>

                    {/* Año Auto */}
                    <TD><span style={{ color: 'rgba(255,255,255,.7)' }}>{c.anioAuto || '—'}</span></TD>

                    {/* Medida */}
                    <TD><span style={{ color: '#fff', fontWeight: 700 }}>{c.medidaDetectada || '—'}</span></TD>

                    {/* Marca Llanta */}
                    <TD><span style={{ color: 'rgba(255,255,255,.8)' }}>{c.marcaLlanta || '—'}</span></TD>

                    {/* Modelo Llanta */}
                    <TD style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: 'rgba(255,255,255,.8)' }}>{c.modeloLlanta || '—'}</span>
                    </TD>

                    {/* Cantidad */}
                    <TD style={{ textAlign: 'center' }}>
                      <span style={{ color: '#fff', fontWeight: 700 }}>{c.cantidadCalc || c.cantidadLlantas || '—'}</span>
                    </TD>

                    {/* Precio Unit */}
                    <TD>
                      <span style={{ color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>
                        {c.precioUnitCalc ? fmtMoney(c.precioUnitCalc) : '—'}
                      </span>
                    </TD>

                    {/* Precio Total */}
                    <TD>
                      <span style={{ color: '#f5c400', fontWeight: 800 }}>
                        {c.precioTotalCalc ? fmtMoney(c.precioTotalCalc) : '—'}
                      </span>
                    </TD>

                    {/* Tipo Venta */}
                    <TD>
                      <span style={{
                        background: c.tipoVenta === 'CRM' ? 'rgba(139,92,246,.2)' : 'rgba(34,197,94,.15)',
                        color: c.tipoVenta === 'CRM' ? '#8b5cf6' : '#22c55e',
                        border: `1px solid ${c.tipoVenta === 'CRM' ? 'rgba(139,92,246,.4)' : 'rgba(34,197,94,.3)'}`,
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                      }}>
                        {c.tipoVenta === 'CRM' ? '💻 CRM' : '📱 WhatsApp'}
                      </span>
                    </TD>

                    {/* Local Instalación */}
                    <TD style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {localNombre
                        ? <span style={{ color: '#fff', fontWeight: 600 }}>{localNombre}</span>
                        : <span style={{ color: 'rgba(255,255,255,.25)', fontStyle: 'italic' }}>—</span>}
                    </TD>

                    {/* Dirección */}
                    <TD style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: 'rgba(255,255,255,.6)' }}>{localDir || '—'}</span>
                    </TD>

                    {/* Provincia */}
                    <TD>
                      {c.provinciaDestino
                        ? <span style={{ color: '#f97316', fontWeight: 700 }}>🗺️ {c.provinciaDestino}</span>
                        : <span style={{ color: 'rgba(255,255,255,.25)' }}>—</span>}
                    </TD>

                    {/* Stock */}
                    <TD>
                      <StockBadge stock={c.stockEnLocal} localElegido={c.localElegido} />
                    </TD>

                    {/* Ranking */}
                    <TD>
                      {c.ranking && rk ? (
                        <span style={{ background: rk.bg, color: rk.color, border: rk.border, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          {RANKING_ICON[c.ranking]} {c.ranking}
                        </span>
                      ) : <span style={{ color: 'rgba(255,255,255,.25)' }}>—</span>}
                    </TD>

                    {/* Cotización existente */}
                    <TD>
                      {c.cotizacion ? (
                        <Link
                          to={`/cotizaciones/${c.cotizacion.id}`}
                          style={{ color: ESTADO_COT_COLOR[c.cotizacion.estado] || '#f5c400', fontWeight: 700, textDecoration: 'none', fontSize: 12 }}
                        >
                          {c.cotizacion.numero}
                          <span style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.45)' }}>
                            {c.cotizacion.estado}
                          </span>
                        </Link>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,.2)', fontSize: 11 }}>Sin cotización</span>
                      )}
                    </TD>

                    {/* Acción */}
                    <TD>
                      <button
                        onClick={() => setModalCita(c)}
                        style={{
                          background: '#f5c400', color: '#000',
                          border: 'none', borderRadius: 6,
                          padding: '5px 10px', fontSize: 11, fontWeight: 800,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        📋 Cotizar
                      </button>
                    </TD>
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
            style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: 6, padding: '7px 14px', color: page === 1 ? '#444' : '#fff', cursor: page === 1 ? 'default' : 'pointer' }}
          >← Anterior</button>
          <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, lineHeight: '34px' }}>{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: 6, padding: '7px 14px', color: page === totalPages ? '#444' : '#fff', cursor: page === totalPages ? 'default' : 'pointer' }}
          >Siguiente →</button>
        </div>
      )}

      {/* Modal cotización */}
      {modalCita && (
        <ModalCotizacion
          cita={modalCita}
          onClose={() => setModalCita(null)}
          onCreada={handleCotizacionCreada}
        />
      )}
    </div>
  );
}
