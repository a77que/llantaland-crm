import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { citasApi, cotizacionesApi } from '../services/api';
import { useCitasNotification } from '../context/CitasNotificationContext';
import { useIsMobile } from '../hooks/useIsMobile';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtHora(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  return `S/ ${parseFloat(v).toFixed(2)}`;
}

const RANKING_COLOR = { caliente: '#ef4444', tibio: '#f97316', frio: '#3b82f6' };
const RANKING_ICON  = { caliente: '🔥', tibio: '🌡️', frio: '❄️' };

const ESTADO_COT_COLOR = {
  BORRADOR: '#64748b', ENVIADA: '#3b82f6', ACEPTADA: '#22c55e',
  RECHAZADA: '#ef4444', CONVERTIDA: '#8b5cf6',
};

// ─── Modal Convertir a Cotización ────────────────────────────────────────────

function ModalCotizacion({ cita, onClose, onCreada, isMobile }) {
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

  const totalCalc = Math.max(0, parseFloat(form.precioUnit || 0) * parseInt(form.cantidad || 1) - parseFloat(form.descuento || 0));

  const inp = {
    width: '100%', padding: '9px 12px', fontSize: 14,
    border: '1.5px solid var(--color-border)', borderRadius: 8,
    background: 'var(--color-surface)', color: 'var(--color-text)',
  };
  const lbl = (txt) => (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
      {txt}
    </label>
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 500,
        display: 'flex',
        ...(isMobile
          ? { alignItems: 'flex-end' }
          : { alignItems: 'center', justifyContent: 'center', padding: 16 }),
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          width: '100%', overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
          ...(isMobile
            ? { borderRadius: '20px 20px 0 0', maxHeight: '94dvh', padding: '0 0 calc(env(safe-area-inset-bottom, 0px) + 16px)' }
            : { maxWidth: 580, borderRadius: 14, padding: 28, maxHeight: '92dvh' }),
        }}
        onClick={e => e.stopPropagation()}
      >
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
          </div>
        )}

        <div style={{ padding: isMobile ? '8px 16px 16px' : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>📋 Nueva Cotización</div>
            {!isMobile && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
            )}
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px', marginBottom: 18, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
            📱 Lead WhatsApp: <strong>{cita.telefono}</strong>
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
            Cliente
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px 14px', marginBottom: 14 }}>
            <div>{lbl('Nombre completo')}<input style={inp} value={form.nombreCliente} onChange={set('nombreCliente')} placeholder="Juan Pérez Gómez" /></div>
            <div>{lbl('DNI / CE')}<input style={inp} value={form.dniCe} onChange={set('dniCe')} placeholder="45678901" /></div>
            <div>{lbl('Teléfono')}<input style={inp} value={form.telefonoCliente} onChange={set('telefonoCliente')} /></div>
            <div>{lbl('Vehículo (marca modelo año)')}<input style={inp} value={`${form.marcaAuto} ${form.modeloAuto} ${form.anioAuto}`.trim()} onChange={e => { const p = e.target.value.split(' '); setForm(f => ({ ...f, marcaAuto: p[0]||'', modeloAuto: p.slice(1,-1).join(' ')||'', anioAuto: p[p.length-1]||'' })); }} placeholder="Toyota Corolla 2020" /></div>
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
            Llanta
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px 14px', marginBottom: 12 }}>
            <div>{lbl('Medida')}<input style={inp} value={form.medidaLlanta} onChange={set('medidaLlanta')} placeholder="195/65R15" /></div>
            <div>{lbl('Marca')}<input style={inp} value={form.marcaLlanta} onChange={set('marcaLlanta')} placeholder="Michelin" /></div>
            <div style={{ gridColumn: isMobile ? '1 / -1' : undefined }}>{lbl('Modelo')}<input style={inp} value={form.modeloLlanta} onChange={set('modeloLlanta')} placeholder="Energy E3" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 14px', marginBottom: 14 }}>
            <div>{lbl('Cantidad')}<input style={inp} type="number" min="1" value={form.cantidad} onChange={set('cantidad')} /></div>
            <div>{lbl('Precio unit. S/')}<input style={inp} type="number" min="0" value={form.precioUnit} onChange={set('precioUnit')} placeholder="380.00" /></div>
            <div>{lbl('Descuento S/')}<input style={inp} type="number" min="0" value={form.descuento} onChange={set('descuento')} placeholder="0" /></div>
          </div>

          {form.precioUnit && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>Total:</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#16a34a' }}>{fmtMoney(totalCalc)}</span>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            {lbl('Notas (instalación, garantía, etc.)')}
            <textarea style={{ ...inp, height: 56, resize: 'vertical' }} value={form.notas} onChange={set('notas')} placeholder="Incluye instalación, garantía de fábrica..." />
          </div>

          <button
            onClick={() => crearMut.mutate()}
            disabled={crearMut.isPending || !form.medidaLlanta || !form.precioUnit}
            style={{
              width: '100%', padding: isMobile ? '16px' : '13px',
              background: (!form.medidaLlanta || !form.precioUnit) ? 'var(--color-surface2)' : '#f5c400',
              color: (!form.medidaLlanta || !form.precioUnit) ? 'var(--color-text-muted)' : '#000',
              border: 'none', borderRadius: 10, fontSize: isMobile ? 16 : 15, fontWeight: 900, cursor: 'pointer',
            }}
          >
            {crearMut.isPending ? '⏳ Creando...' : '✅ Crear Cotización'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stock Badge ─────────────────────────────────────────────────────────────

function StockBadge({ stock, localElegido }) {
  if (stock === null || stock === undefined) {
    if (!localElegido) return <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>;
    return <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Sin info</span>;
  }
  const hayStock = stock > 0;
  return (
    <span style={{ fontWeight: 900, fontSize: 13, color: hayStock ? '#16a34a' : '#dc2626' }}>
      {hayStock ? `✅ ${stock} u.` : '❌ SIN STOCK'}
    </span>
  );
}

// ─── Celdas tabla ────────────────────────────────────────────────────────────
const TD = ({ children, style = {} }) => (
  <td style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-text)', ...style }}>
    {children}
  </td>
);
const TH = ({ children }) => (
  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg)' }}>
    {children}
  </th>
);

// ─── Cita Card (móvil) ───────────────────────────────────────────────────────

function CitaCard({ cita, onCotizar, isNueva }) {
  const localNombre = cita.localElegido?.Nombre || cita.localElegido?.nombre || cita.localElegido?.nombre_local || null;
  const rk = RANKING_COLOR[cita.ranking];

  return (
    <div style={{
      background: isNueva ? '#f0fdf4' : 'var(--color-surface)',
      borderRadius: 12,
      border: isNueva ? '1.5px solid #22c55e' : '1px solid var(--color-border)',
      borderLeft: `4px solid ${rk || 'var(--color-primary)'}`,
      padding: '14px 16px',
      marginBottom: 10,
    }}>
      {/* Fila 1: fecha + ranking + badge NUEVO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isNueva && (
            <span style={{ background: '#22c55e', color: '#fff', fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
              NUEVO
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {fmtFecha(cita.timestamp)} {fmtHora(cita.timestamp)}
          </span>
        </div>
        {cita.ranking && rk && (
          <span style={{ background: rk+'18', color: rk, border: `1px solid ${rk}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            {RANKING_ICON[cita.ranking]} {cita.ranking}
          </span>
        )}
      </div>

      {/* Fila 2: nombre + teléfono */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
          {cita.nombreCliente || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Sin nombre</span>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>{cita.telefono}</div>
      </div>

      {/* Fila 3: llanta + vehículo */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        {cita.medidaDetectada && (
          <span>🛞 <strong style={{ color: 'var(--color-text)' }}>{cita.medidaDetectada}</strong>{cita.marcaLlanta ? ` · ${cita.marcaLlanta}` : ''}</span>
        )}
        {cita.marcaAuto && <span>🚗 {cita.marcaAuto} {cita.modeloAuto || ''}</span>}
        {(cita.cantidadCalc || cita.cantidadLlantas) ? <span>×{cita.cantidadCalc || cita.cantidadLlantas} und.</span> : null}
      </div>

      {/* Fila 4: local/provincia + precio */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12.5 }}>
          {localNombre
            ? <span style={{ color: 'var(--color-text)' }}>📍 <strong>{localNombre}</strong></span>
            : cita.provinciaDestino
              ? <span style={{ color: '#f97316', fontWeight: 700 }}>🗺️ {cita.provinciaDestino}</span>
              : <span style={{ color: 'var(--color-text-muted)' }}>Sin local asignado</span>
          }
        </div>
        {(cita.precioTotalCalc || cita.precioUnitCalc) && (
          <span style={{ fontWeight: 800, fontSize: 15, color: '#16a34a' }}>
            {cita.precioTotalCalc ? fmtMoney(cita.precioTotalCalc) : `${fmtMoney(cita.precioUnitCalc)} c/u`}
          </span>
        )}
      </div>

      {/* Fila 5: cotización existente o botón cotizar */}
      {cita.cotizacion ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to={`/cotizaciones/${cita.cotizacion.id}`}
            style={{
              flex: 1, padding: '11px 14px', textAlign: 'center', textDecoration: 'none',
              background: (ESTADO_COT_COLOR[cita.cotizacion.estado] || 'var(--color-primary)') + '18',
              color: ESTADO_COT_COLOR[cita.cotizacion.estado] || 'var(--color-primary)',
              border: `1px solid ${(ESTADO_COT_COLOR[cita.cotizacion.estado] || 'var(--color-primary)') + '40'}`,
              borderRadius: 8, fontSize: 13, fontWeight: 700,
            }}
          >
            📋 {cita.cotizacion.numero} — {cita.cotizacion.estado}
          </Link>
          <button
            onClick={() => onCotizar(cita)}
            style={{ padding: '11px 14px', background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--color-text)', whiteSpace: 'nowrap' }}
          >
            + Nueva
          </button>
        </div>
      ) : (
        <button
          onClick={() => onCotizar(cita)}
          style={{ width: '100%', padding: '13px 14px', background: '#f5c400', color: '#000', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 900, cursor: 'pointer' }}
        >
          📋 Cotizar
        </button>
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function Citas() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { marcarTodosVistos, nuevasIds, count } = useCitasNotification();

  const [page, setPage]           = useState(1);
  const [q, setQ]                 = useState('');
  const [orderDir, setOrderDir]   = useState('desc');
  const [modalCita, setModalCita] = useState(null);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['citas', page, q, orderDir],
    queryFn: () => citasApi.listar({ page, limit: 30, q: q || undefined, orderBy: 'updatedAt', orderDir }),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (count > 0) marcarTodosVistos();
  }, []); // eslint-disable-line

  const citas      = data?.citas || [];
  const total      = data?.total || 0;
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
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: 'var(--color-text)' }}>📅 Citas</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>
            Clientes que eligieron local en Lima o indicaron provincia
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{total} registros</span>
          <button
            onClick={() => refetch()}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 12 }}
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
            flex: 1, minWidth: 0,
            background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 8,
            color: 'var(--color-text)', padding: '9px 12px', fontSize: 14,
          }}
        />
        <select
          value={orderDir}
          onChange={e => setOrderDir(e.target.value)}
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', padding: '9px 12px', fontSize: 13, flexShrink: 0 }}
        >
          <option value="desc">Más recientes</option>
          <option value="asc">Más antiguos</option>
        </select>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>Cargando citas...
        </div>
      ) : isError ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#dc2626' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
          Error al cargar las citas.
          <br />
          <button onClick={() => refetch()} style={{ marginTop: 12, padding: '8px 16px', background: '#f5c400', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Reintentar</button>
        </div>
      ) : citas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#000' }}>
          <div style={{ fontSize: 44 }}>📅</div>
          <div style={{ marginTop: 12, fontWeight: 600, fontSize: 15 }}>No hay citas registradas aún</div>
          <div style={{ fontSize: 12, marginTop: 6, color: '#444' }}>Aparecerán cuando un cliente elija un local en Lima o indique una provincia.</div>
        </div>
      ) : isMobile ? (

        /* ── Tarjetas móvil ── */
        <div>
          {citas.map((c) => (
            <CitaCard
              key={c.id}
              cita={c}
              onCotizar={setModalCita}
              isNueva={nuevasIds.has(c.id)}
            />
          ))}
        </div>

      ) : (

        /* ── Tabla desktop ── */
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', fontSize: 13, minWidth: 1600 }}>
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
                const esNueva     = nuevasIds.has(c.id);
                const localNombre = c.localElegido?.Nombre || c.localElegido?.nombre || c.localElegido?.nombre_local || null;
                const localDir    = c.localElegido?.Direccion || c.localElegido?.direccion || c.localElegido?.direccion_local || null;
                const rk          = RANKING_COLOR[c.ranking];

                return (
                  <tr
                    key={c.id}
                    style={{
                      background: esNueva ? '#f0fdf4' : i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface2)',
                      outline: esNueva ? '2px solid #22c55e' : 'none',
                      outlineOffset: '-1px',
                    }}
                    onMouseEnter={e => { if (!esNueva) e.currentTarget.style.background = 'var(--color-bg)'; }}
                    onMouseLeave={e => { if (!esNueva) e.currentTarget.style.background = i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface2)'; }}
                  >
                    <TD>
                      <div style={{ fontWeight: 600 }}>{fmtFecha(c.timestamp)}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{fmtHora(c.timestamp)}</div>
                      {esNueva && <span style={{ background: '#22c55e', color: '#fff', borderRadius: 4, fontSize: 8, fontWeight: 900, padding: '1px 4px', display: 'inline-block', marginTop: 2 }}>NUEVO</span>}
                    </TD>
                    <TD><span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{c.telefono}</span></TD>
                    <TD style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ fontWeight: 600 }}>{c.nombreCliente || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Sin nombre</span>}</span>
                    </TD>
                    <TD><span style={{ color: 'var(--color-text-muted)' }}>{c.dniCe || '—'}</span></TD>
                    <TD><span style={{ color: 'var(--color-text-muted)' }}>{c.marcaAuto || '—'}</span></TD>
                    <TD><span style={{ color: 'var(--color-text-muted)' }}>{c.modeloAuto || '—'}</span></TD>
                    <TD><span style={{ color: 'var(--color-text-muted)' }}>{c.anioAuto || '—'}</span></TD>
                    <TD><span style={{ fontWeight: 700 }}>{c.medidaDetectada || '—'}</span></TD>
                    <TD>{c.marcaLlanta || '—'}</TD>
                    <TD style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.modeloLlanta || '—'}</TD>
                    <TD style={{ textAlign: 'center' }}><span style={{ fontWeight: 700 }}>{c.cantidadCalc || c.cantidadLlantas || '—'}</span></TD>
                    <TD><span style={{ fontWeight: 600 }}>{c.precioUnitCalc ? fmtMoney(c.precioUnitCalc) : '—'}</span></TD>
                    <TD><span style={{ color: '#16a34a', fontWeight: 800 }}>{c.precioTotalCalc ? fmtMoney(c.precioTotalCalc) : '—'}</span></TD>
                    <TD>
                      <span style={{
                        background: c.tipoVenta === 'CRM' ? '#ede9fe' : '#dcfce7',
                        color: c.tipoVenta === 'CRM' ? '#7c3aed' : '#16a34a',
                        border: `1px solid ${c.tipoVenta === 'CRM' ? '#c4b5fd' : '#86efac'}`,
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                      }}>
                        {c.tipoVenta === 'CRM' ? '💻 CRM' : '📱 WhatsApp'}
                      </span>
                    </TD>
                    <TD style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {localNombre ? <span style={{ fontWeight: 600 }}>{localNombre}</span> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </TD>
                    <TD style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>{localDir || '—'}</span>
                    </TD>
                    <TD>
                      {c.provinciaDestino
                        ? <span style={{ color: '#f97316', fontWeight: 700 }}>🗺️ {c.provinciaDestino}</span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </TD>
                    <TD><StockBadge stock={c.stockEnLocal} localElegido={c.localElegido} /></TD>
                    <TD>
                      {c.ranking && rk ? (
                        <span style={{ background: rk+'18', color: rk, border: `1px solid ${rk}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          {RANKING_ICON[c.ranking]} {c.ranking}
                        </span>
                      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </TD>
                    <TD>
                      {c.cotizacion ? (
                        <Link to={`/cotizaciones/${c.cotizacion.id}`} style={{ color: ESTADO_COT_COLOR[c.cotizacion.estado] || 'var(--color-primary)', fontWeight: 700, fontSize: 12 }}>
                          {c.cotizacion.numero}
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)' }}>{c.cotizacion.estado}</span>
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>Sin cotización</span>
                      )}
                    </TD>
                    <TD>
                      <button
                        onClick={() => setModalCita(c)}
                        style={{ background: '#f5c400', color: '#000', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
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
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 16px', color: page === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: page === 1 ? 'default' : 'pointer', fontSize: 13 }}
          >← Anterior</button>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: '36px' }}>{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 16px', color: page === totalPages ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 13 }}
          >Siguiente →</button>
        </div>
      )}

      {/* Modal cotización */}
      {modalCita && (
        <ModalCotizacion
          cita={modalCita}
          onClose={() => setModalCita(null)}
          onCreada={handleCotizacionCreada}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
