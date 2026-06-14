import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { citasApi, cotizacionesApi, sedesApi } from '../services/api';
import { useCitasNotification } from '../context/CitasNotificationContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { BotonWhatsApp, BotonEnviarPdfWhatsApp } from '../components/WhatsAppButtons';

// Genera y abre el PDF de la cotización vinculada a la cita
async function abrirPdfCotizacion(cotId) {
  try {
    const r = await cotizacionesApi.generarPdf(cotId);
    if (r?.pdfUrl) window.open(r.pdfUrl, '_blank');
  } catch (e) { toast.error(e?.error || 'No se pudo generar el PDF'); }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function fmtFecha(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtHora(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}
function fmtDiaFecha(d) {
  if (!d) return null;
  const f = new Date(d);
  if (isNaN(f)) return null;
  return `${DIAS[f.getDay()]} ${f.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}`;
}
function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  return `S/ ${parseFloat(v).toFixed(2)}`;
}
function toDateInput(d) {
  if (!d) return '';
  const f = new Date(d);
  if (isNaN(f)) return '';
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

const RANKING_COLOR = { caliente: '#ef4444', tibio: '#f97316', frio: '#3b82f6' };
const RANKING_ICON  = { caliente: '🔥', tibio: '🌡️', frio: '❄️' };

const ESTADO_COT_COLOR = {
  BORRADOR: '#64748b', ENVIADA: '#3b82f6', ACEPTADA: '#22c55e',
  RECHAZADA: '#ef4444', CONVERTIDA: '#8b5cf6',
};

const ESTADO_CITA = {
  RECIBIDO:  { label: 'Recibido',  color: '#3b82f6', icon: '📥' },
  ATENDIDO:  { label: 'Atendido',  color: '#f59e0b', icon: '🗓️' },
  ENTREGADO: { label: 'Entregado', color: '#16a34a', icon: '✅' },
};

function localNombreDe(cita) {
  const l = cita.localElegido;
  return l?.Nombre || l?.nombre || l?.nombre_local || null;
}

// ─── Columnas configurables ──────────────────────────────────────────────────

const COLUMNAS = [
  { key: 'estadoCita',     label: 'Estado',        sort: 'estadoCita' },
  { key: 'instalacion',    label: 'Instalación',   sort: 'fechaInstalacion' },
  { key: 'fecha',          label: 'Recibido',      sort: 'timestamp' },
  { key: 'telefono',       label: 'Teléfono',      sort: 'telefono' },
  { key: 'nombreCliente',  label: 'Cliente',       sort: 'nombreCliente', required: true },
  { key: 'documento',      label: 'Documento' },
  { key: 'vehiculo',       label: 'Vehículo' },
  { key: 'medida',         label: 'Medida' },
  { key: 'marcaLlanta',    label: 'Marca Llanta' },
  { key: 'cantidad',       label: 'Cant.' },
  { key: 'precioTotal',    label: 'P. Total' },
  { key: 'tipoVenta',      label: 'Origen' },
  { key: 'localInst',      label: 'Local' },
  { key: 'provincia',      label: 'Provincia' },
  { key: 'stock',          label: 'Stock' },
  { key: 'ranking',        label: 'Ranking' },
  { key: 'cotizacion',     label: 'Cotización' },
  { key: 'accion',         label: 'Acción',        required: true },
];
const STORAGE_COLS = 'citas_columnas_v1';
const defaultCols = () => {
  try { const s = localStorage.getItem(STORAGE_COLS); if (s) return JSON.parse(s); } catch { /* */ }
  return ['estadoCita', 'instalacion', 'fecha', 'telefono', 'nombreCliente', 'vehiculo', 'medida', 'cantidad', 'precioTotal', 'tipoVenta', 'localInst', 'stock', 'cotizacion', 'accion'];
};

// ─── Modal Agendar cita ──────────────────────────────────────────────────────

function ModalAgendar({ cita, sedes, onClose, onGuardada, isMobile }) {
  const [fecha, setFecha] = useState(toDateInput(cita.fechaInstalacion));
  const [hora, setHora]   = useState(cita.horaInstalacion || '');
  const [localId, setLocalId] = useState(cita.localElegido?.ID || cita.localElegido?.id || '');

  const guardarMut = useMutation({
    mutationFn: () => {
      const sede = sedes?.find(s => s.id === localId || s.codigoLocal === localId);
      const local = sede ? { ID: sede.codigoLocal, Nombre: sede.nombre, Direccion: sede.direccion || '', Distrito: sede.distrito || '' } : undefined;
      return citasApi.actualizar(cita.id, {
        fechaInstalacion: fecha || null,
        horaInstalacion: hora || null,
        localInstalacion: local,
        estadoCita: fecha ? 'ATENDIDO' : undefined,
      });
    },
    onSuccess: () => { toast.success('Cita agendada'); onGuardada(); onClose(); },
    onError: (e) => toast.error(e?.error || 'Error al agendar'),
  });

  const inp = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text)' };
  const lbl = (t) => <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{t}</label>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 600, display: 'flex', ...(isMobile ? { alignItems: 'flex-end' } : { alignItems: 'center', justifyContent: 'center', padding: 16 }) }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', width: '100%', boxShadow: 'var(--shadow-lg)', ...(isMobile ? { borderRadius: '20px 20px 0 0', padding: '20px 16px calc(env(safe-area-inset-bottom,0px) + 20px)' } : { maxWidth: 440, borderRadius: 14, padding: 26 }) }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>🗓️ Agendar instalación</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--color-text-muted)', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          {cita.nombreCliente || cita.telefono} · {cita.medidaDetectada || 'sin medida'}
        </div>
        <div style={{ marginBottom: 14 }}>{lbl('Tienda de instalación')}
          <select style={inp} value={localId} onChange={e => setLocalId(e.target.value)}>
            <option value="">— Elegir tienda —</option>
            {(sedes || []).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 12, marginBottom: 20 }}>
          <div>{lbl('Fecha')}<input type="date" style={inp} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
          <div>{lbl('Hora')}<input type="time" style={inp} value={hora} onChange={e => setHora(e.target.value)} /></div>
        </div>
        {fecha && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
            📌 {fmtDiaFecha(fecha)}{hora ? ` a las ${hora}` : ''} — la cita pasará a <strong>Atendido</strong>
          </div>
        )}
        <button onClick={() => guardarMut.mutate()} disabled={guardarMut.isPending || !fecha}
          style={{ width: '100%', padding: 13, background: !fecha ? 'var(--color-surface2)' : '#16a34a', color: !fecha ? 'var(--color-text-muted)' : '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: fecha ? 'pointer' : 'default' }}>
          {guardarMut.isPending ? '⏳ Guardando...' : '✅ Guardar cita'}
        </button>
      </div>
    </div>
  );
}

// ─── Modal Convertir a Cotización (existente) ────────────────────────────────

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
    onSuccess: (data) => { toast.success(`Cotización ${data.numero} creada`); onCreada(data); onClose(); },
    onError: (e) => toast.error(e?.error || 'Error al crear cotización'),
  });

  const totalCalc = Math.max(0, parseFloat(form.precioUnit || 0) * parseInt(form.cantidad || 1) - parseFloat(form.descuento || 0));
  const inp = { width: '100%', padding: '9px 12px', fontSize: 14, border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text)' };
  const lbl = (txt) => <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{txt}</label>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 500, display: 'flex', ...(isMobile ? { alignItems: 'flex-end' } : { alignItems: 'center', justifyContent: 'center', padding: 16 }) }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', width: '100%', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', ...(isMobile ? { borderRadius: '20px 20px 0 0', maxHeight: '94dvh', padding: '0 0 calc(env(safe-area-inset-bottom, 0px) + 16px)' } : { maxWidth: 580, borderRadius: 14, padding: 28, maxHeight: '92dvh' }) }} onClick={e => e.stopPropagation()}>
        {isMobile && <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}><div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)' }} /></div>}
        <div style={{ padding: isMobile ? '8px 16px 16px' : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>📋 Nueva Cotización</div>
            {!isMobile && <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px 8px' }}>✕</button>}
          </div>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px', marginBottom: 18, fontSize: 12, color: '#92400e', fontWeight: 600 }}>📱 Lead: <strong>{cita.telefono}</strong></div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px 14px', marginBottom: 14 }}>
            <div>{lbl('Nombre completo')}<input style={inp} value={form.nombreCliente} onChange={set('nombreCliente')} /></div>
            <div>{lbl('DNI / CE')}<input style={inp} value={form.dniCe} onChange={set('dniCe')} /></div>
            <div>{lbl('Teléfono')}<input style={inp} value={form.telefonoCliente} onChange={set('telefonoCliente')} /></div>
            <div>{lbl('Vehículo')}<input style={inp} value={`${form.marcaAuto} ${form.modeloAuto} ${form.anioAuto}`.trim()} onChange={e => { const p = e.target.value.split(' '); setForm(f => ({ ...f, marcaAuto: p[0]||'', modeloAuto: p.slice(1,-1).join(' ')||'', anioAuto: p[p.length-1]||'' })); }} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px 14px', marginBottom: 12 }}>
            <div>{lbl('Medida')}<input style={inp} value={form.medidaLlanta} onChange={set('medidaLlanta')} /></div>
            <div>{lbl('Marca')}<input style={inp} value={form.marcaLlanta} onChange={set('marcaLlanta')} /></div>
            <div style={{ gridColumn: isMobile ? '1 / -1' : undefined }}>{lbl('Modelo')}<input style={inp} value={form.modeloLlanta} onChange={set('modeloLlanta')} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 14px', marginBottom: 14 }}>
            <div>{lbl('Cantidad')}<input style={inp} type="number" min="1" value={form.cantidad} onChange={set('cantidad')} /></div>
            <div>{lbl('Precio unit. S/')}<input style={inp} type="number" min="0" value={form.precioUnit} onChange={set('precioUnit')} /></div>
            <div>{lbl('Descuento S/')}<input style={inp} type="number" min="0" value={form.descuento} onChange={set('descuento')} /></div>
          </div>
          {form.precioUnit && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>Total:</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#16a34a' }}>{fmtMoney(totalCalc)}</span>
            </div>
          )}
          <div style={{ marginBottom: 20 }}>{lbl('Notas')}<textarea style={{ ...inp, height: 56, resize: 'vertical' }} value={form.notas} onChange={set('notas')} /></div>
          <button onClick={() => crearMut.mutate()} disabled={crearMut.isPending || !form.medidaLlanta || !form.precioUnit}
            style={{ width: '100%', padding: isMobile ? '16px' : '13px', background: (!form.medidaLlanta || !form.precioUnit) ? 'var(--color-surface2)' : '#f5c400', color: (!form.medidaLlanta || !form.precioUnit) ? 'var(--color-text-muted)' : '#000', border: 'none', borderRadius: 10, fontSize: isMobile ? 16 : 15, fontWeight: 900, cursor: 'pointer' }}>
            {crearMut.isPending ? '⏳ Creando...' : '✅ Crear Cotización'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StockBadge({ stock, localElegido }) {
  if (stock === null || stock === undefined) {
    return <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{localElegido ? 'Sin info' : '—'}</span>;
  }
  return <span style={{ fontWeight: 900, fontSize: 13, color: stock > 0 ? '#16a34a' : '#dc2626' }}>{stock > 0 ? `✅ ${stock} u.` : '❌ SIN STOCK'}</span>;
}

function EstadoCitaBadge({ estado }) {
  const e = ESTADO_CITA[estado] || ESTADO_CITA.RECIBIDO;
  return <span style={{ background: e.color + '18', color: e.color, border: `1px solid ${e.color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{e.icon} {e.label}</span>;
}

// ─── Tarjeta móvil ───────────────────────────────────────────────────────────

function CitaCard({ cita, onCotizar, onAgendar, isNueva }) {
  const localNombre = localNombreDe(cita);
  const rk = RANKING_COLOR[cita.ranking];
  const diaFecha = fmtDiaFecha(cita.fechaInstalacion);

  return (
    <div style={{ background: isNueva ? '#f0fdf4' : 'var(--color-surface)', borderRadius: 12, border: isNueva ? '1.5px solid #22c55e' : '1px solid var(--color-border)', borderLeft: `4px solid ${rk || 'var(--color-primary)'}`, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <EstadoCitaBadge estado={cita.estadoCitaCalc} />
        {cita.ranking && rk && <span style={{ background: rk+'18', color: rk, border: `1px solid ${rk}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{RANKING_ICON[cita.ranking]} {cita.ranking}</span>}
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{cita.nombreCliente || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Sin nombre</span>}</div>
        <div style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>{cita.telefono}</div>
      </div>
      {diaFecha && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 12.5, color: '#92400e', fontWeight: 700 }}>
          🗓️ {diaFecha}{cita.horaInstalacion ? ` · ${cita.horaInstalacion}` : ''}{localNombre ? ` · ${localNombre}` : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        {cita.medidaDetectada && <span>🛞 <strong style={{ color: 'var(--color-text)' }}>{cita.medidaDetectada}</strong>{cita.marcaLlanta ? ` · ${cita.marcaLlanta}` : ''}</span>}
        {cita.marcaAuto && <span>🚗 {cita.marcaAuto} {cita.modeloAuto || ''}</span>}
        {(cita.cantidadCalc || cita.cantidadLlantas) ? <span>×{cita.cantidadCalc || cita.cantidadLlantas}</span> : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12.5 }}>{localNombre ? <>📍 <strong>{localNombre}</strong></> : cita.provinciaDestino ? <span style={{ color: '#f97316', fontWeight: 700 }}>🗺️ {cita.provinciaDestino}</span> : <span style={{ color: 'var(--color-text-muted)' }}>Sin local</span>}</span>
        {(cita.precioTotalCalc || cita.precioUnitCalc) && <span style={{ fontWeight: 800, fontSize: 15, color: '#16a34a' }}>{cita.precioTotalCalc ? fmtMoney(cita.precioTotalCalc) : `${fmtMoney(cita.precioUnitCalc)} c/u`}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => onAgendar(cita)} style={{ flex: 1, padding: '11px', background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--color-text)' }}>🗓️ Agendar</button>
        {cita.cotizacion ? (
          <Link to={`/cotizaciones/${cita.cotizacion.id}`} style={{ flex: 1, padding: '11px', textAlign: 'center', textDecoration: 'none', background: (ESTADO_COT_COLOR[cita.cotizacion.estado] || 'var(--color-primary)') + '18', color: ESTADO_COT_COLOR[cita.cotizacion.estado] || 'var(--color-primary)', border: `1px solid ${(ESTADO_COT_COLOR[cita.cotizacion.estado] || 'var(--color-primary)')}40`, borderRadius: 8, fontSize: 13, fontWeight: 700 }}>📋 {cita.cotizacion.numero}</Link>
        ) : (
          <button onClick={() => onCotizar(cita)} style={{ flex: 1, padding: '11px', background: '#f5c400', color: '#000', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 900, cursor: 'pointer' }}>📋 Cotizar</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <BotonWhatsApp telefono={cita.telefono} label="WhatsApp" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} />
        {cita.cotizacion && <button onClick={() => abrirPdfCotizacion(cita.cotizacion.id)} style={{ flex: 1, padding: '10px', background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--color-text)' }}>📄 PDF</button>}
        {cita.cotizacion && <BotonEnviarPdfWhatsApp telefono={cita.telefono} tipo="cotización" pdfFn={() => cotizacionesApi.generarPdf(cita.cotizacion.id)} style={{ flex: 1, justifyContent: 'center', padding: '10px' }} />}
      </div>
    </div>
  );
}

// ─── Gestor de columnas ──────────────────────────────────────────────────────

function GestorColumnas({ visibles, onToggle, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, width: '100%', maxWidth: 440, maxHeight: '85dvh', overflowY: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Mostrar / ocultar columnas</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {COLUMNAS.map(c => (
            <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--color-bg)', cursor: c.required ? 'default' : 'pointer', opacity: c.required ? 0.5 : 1 }}>
              <input type="checkbox" checked={visibles.includes(c.key)} disabled={c.required} onChange={() => onToggle(c.key)} style={{ width: 14, height: 14, accentColor: '#f5c400' }} />
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{c.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Citas() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { marcarTodosVistos, nuevasIds, count } = useCitasNotification();

  const [page, setPage]         = useState(1);
  const [q, setQ]               = useState('');
  const [orderBy, setOrderBy]   = useState('updatedAt');
  const [orderDir, setOrderDir] = useState('desc');
  const [filtro, setFiltro]     = useState({ rango: '', estado: '' }); // cards
  const [modalCita, setModalCita]   = useState(null);
  const [modalAgendar, setModalAgendar] = useState(null);
  const [showGestor, setShowGestor] = useState(false);
  const [visibles, setVisibles] = useState(defaultCols);

  const { data: sedes = [] } = useQuery({ queryKey: ['sedes'], queryFn: sedesApi.listar, staleTime: Infinity });

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['citas', page, q, orderBy, orderDir, filtro],
    queryFn: () => citasApi.listar({ page, limit: 30, q: q || undefined, orderBy, orderDir, rango: filtro.rango || undefined, estado: filtro.estado || undefined }),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  useEffect(() => { if (count > 0) marcarTodosVistos(); }, []); // eslint-disable-line

  const citas      = data?.citas || [];
  const total      = data?.total || 0;
  const totalPages = Math.ceil(total / 30);

  const colsVisibles = useMemo(() => COLUMNAS.filter(c => visibles.includes(c.key)), [visibles]);

  const toggleCol = (key) => {
    const col = COLUMNAS.find(c => c.key === key);
    if (col?.required) return;
    setVisibles(v => { const next = v.includes(key) ? v.filter(k => k !== key) : [...v, key]; localStorage.setItem(STORAGE_COLS, JSON.stringify(next)); return next; });
  };

  const handleSort = (col) => {
    if (!col.sort) return;
    if (orderBy === col.sort) setOrderDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setOrderBy(col.sort); setOrderDir('asc'); }
    setPage(1);
  };

  const onCambio = () => { qc.invalidateQueries(['citas']); qc.invalidateQueries(['cotizaciones']); };

  const setCard = (patch) => { setFiltro(f => ({ ...f, ...patch })); setPage(1); };

  const CARDS = [
    { label: 'Todas',     active: !filtro.rango && !filtro.estado, onClick: () => setFiltro({ rango: '', estado: '' }), color: '#1a2234' },
    { label: '📆 Hoy',    active: filtro.rango === 'hoy',    onClick: () => setCard({ rango: filtro.rango === 'hoy' ? '' : 'hoy' }),    color: '#0ea5e9' },
    { label: '⏭️ Mañana', active: filtro.rango === 'manana', onClick: () => setCard({ rango: filtro.rango === 'manana' ? '' : 'manana' }), color: '#6366f1' },
    { label: '📥 Recibido',  active: filtro.estado === 'RECIBIDO',  onClick: () => setCard({ estado: filtro.estado === 'RECIBIDO' ? '' : 'RECIBIDO' }),   color: '#3b82f6' },
    { label: '🗓️ Atendido',  active: filtro.estado === 'ATENDIDO',  onClick: () => setCard({ estado: filtro.estado === 'ATENDIDO' ? '' : 'ATENDIDO' }),   color: '#f59e0b' },
    { label: '✅ Entregado', active: filtro.estado === 'ENTREGADO', onClick: () => setCard({ estado: filtro.estado === 'ENTREGADO' ? '' : 'ENTREGADO' }), color: '#16a34a' },
  ];

  const renderCelda = (c, key) => {
    const localNombre = localNombreDe(c);
    const localDir = c.localElegido?.Direccion || c.localElegido?.direccion || null;
    const rk = RANKING_COLOR[c.ranking];
    switch (key) {
      case 'estadoCita': return <EstadoCitaBadge estado={c.estadoCitaCalc} />;
      case 'instalacion': {
        const df = fmtDiaFecha(c.fechaInstalacion);
        return df ? <div><div style={{ fontWeight: 700, color: '#b45309' }}>{df}</div>{c.horaInstalacion && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.horaInstalacion}</div>}</div> : <span style={{ color: 'var(--color-text-muted)' }}>— sin agendar</span>;
      }
      case 'fecha': return <div><div style={{ fontWeight: 600 }}>{fmtFecha(c.timestamp)}</div><div style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{fmtHora(c.timestamp)}</div></div>;
      case 'telefono': return <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{c.telefono}</span>;
      case 'nombreCliente': return <span style={{ fontWeight: 600 }}>{c.nombreCliente || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Sin nombre</span>}</span>;
      case 'documento': return <span style={{ color: 'var(--color-text-muted)' }}>{c.dniCe || '—'}</span>;
      case 'vehiculo': return <span style={{ color: 'var(--color-text-muted)' }}>{[c.marcaAuto, c.modeloAuto, c.anioAuto].filter(Boolean).join(' ') || '—'}</span>;
      case 'medida': return <span style={{ fontWeight: 700 }}>{c.medidaDetectada || '—'}</span>;
      case 'marcaLlanta': return c.marcaLlanta || '—';
      case 'cantidad': return <span style={{ fontWeight: 700 }}>{c.cantidadCalc || c.cantidadLlantas || '—'}</span>;
      case 'precioTotal': return <span style={{ color: '#16a34a', fontWeight: 800 }}>{c.precioTotalCalc ? fmtMoney(c.precioTotalCalc) : '—'}</span>;
      case 'tipoVenta': return <span style={{ background: c.tipoVenta === 'CRM' ? '#ede9fe' : '#dcfce7', color: c.tipoVenta === 'CRM' ? '#7c3aed' : '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{c.tipoVenta === 'CRM' ? '💻 CRM' : '📱 WA'}</span>;
      case 'localInst': return localNombre ? <span style={{ fontWeight: 600 }}>{localNombre}</span> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
      case 'provincia': return c.provinciaDestino ? <span style={{ color: '#f97316', fontWeight: 700 }}>🗺️ {c.provinciaDestino}</span> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
      case 'stock': return <StockBadge stock={c.stockEnLocal} localElegido={c.localElegido} />;
      case 'ranking': return c.ranking && rk ? <span style={{ background: rk+'18', color: rk, border: `1px solid ${rk}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{RANKING_ICON[c.ranking]} {c.ranking}</span> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
      case 'cotizacion': return c.cotizacion ? <Link to={`/cotizaciones/${c.cotizacion.id}`} style={{ color: ESTADO_COT_COLOR[c.cotizacion.estado] || 'var(--color-primary)', fontWeight: 700, fontSize: 12 }}>{c.cotizacion.numero}<span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)' }}>{c.cotizacion.estado}</span></Link> : <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>Sin cotización</span>;
      case 'accion': return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setModalAgendar(c)} title="Agendar" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer' }}>🗓️</button>
          <button onClick={() => setModalCita(c)} style={{ background: '#f5c400', color: '#000', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>📋 Cotizar</button>
          <BotonWhatsApp telefono={c.telefono} label="" />
          {c.cotizacion && <button onClick={() => abrirPdfCotizacion(c.cotizacion.id)} title="Crear PDF" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer' }}>📄</button>}
          {c.cotizacion && <BotonEnviarPdfWhatsApp telefono={c.telefono} tipo="cotización" pdfFn={() => cotizacionesApi.generarPdf(c.cotizacion.id)} style={{ padding: '5px 8px' }} />}
        </div>
      );
      default: return null;
    }
  };

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>📅 Citas</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 2 }}>Instalaciones programadas y leads por atender</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{total} registros</span>
          {!isMobile && <button onClick={() => setShowGestor(true)} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>⚙️ Columnas</button>}
          <button onClick={() => refetch()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 12 }}>{isFetching ? '⟳' : 'Actualizar'}</button>
        </div>
      </div>

      {/* Cards filtro */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {CARDS.map(c => (
          <button key={c.label} onClick={c.onClick} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: c.active ? c.color : 'var(--color-surface)', color: c.active ? '#fff' : 'var(--color-text-muted)', border: `1.5px solid ${c.active ? c.color : 'var(--color-border)'}` }}>{c.label}</button>
        ))}
      </div>

      {/* Búsqueda */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Buscar por teléfono, nombre o DNI..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: 0, background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', padding: '9px 12px', fontSize: 14 }} />
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}><div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>Cargando citas...</div>
      ) : isError ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#dc2626' }}><div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>Error al cargar.<br /><button onClick={() => refetch()} style={{ marginTop: 12, padding: '8px 16px', background: '#f5c400', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Reintentar</button></div>
      ) : citas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}><div style={{ fontSize: 44 }}>📅</div><div style={{ marginTop: 12, fontWeight: 600, fontSize: 15 }}>No hay citas con este filtro</div></div>
      ) : isMobile ? (
        <div>{citas.map(c => <CitaCard key={c.id} cita={c} onCotizar={setModalCita} onAgendar={setModalAgendar} isNueva={nuevasIds.has(c.id)} />)}</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', fontSize: 13, minWidth: colsVisibles.length * 110 }}>
            <thead>
              <tr>
                {colsVisibles.map(col => {
                  const active = orderBy === col.sort;
                  return (
                    <th key={col.key} onClick={() => handleSort(col)} title={col.sort ? `Ordenar por ${col.label}` : col.label}
                      style={{ padding: '10px 12px', textAlign: 'left', color: active ? '#f5c400' : 'var(--color-text-muted)', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid var(--color-border)', background: active ? 'rgba(245,196,0,.1)' : 'var(--color-bg)', cursor: col.sort ? 'pointer' : 'default', userSelect: 'none' }}>
                      {col.label}{col.sort && <span style={{ opacity: active ? 1 : 0.4, fontSize: 10 }}>{active ? (orderDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {citas.map((c, i) => {
                const esNueva = nuevasIds.has(c.id);
                return (
                  <tr key={c.id} style={{ background: esNueva ? '#f0fdf4' : i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface2)', outline: esNueva ? '2px solid #22c55e' : 'none', outlineOffset: '-1px' }}>
                    {colsVisibles.map(col => (
                      <td key={col.key} style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                        {renderCelda(c, col.key)}
                      </td>
                    ))}
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
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 16px', color: page === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: page === 1 ? 'default' : 'pointer', fontSize: 13 }}>← Anterior</button>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: '36px' }}>{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 16px', color: page === totalPages ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 13 }}>Siguiente →</button>
        </div>
      )}

      {modalCita && <ModalCotizacion cita={modalCita} onClose={() => setModalCita(null)} onCreada={onCambio} isMobile={isMobile} />}
      {modalAgendar && <ModalAgendar cita={modalAgendar} sedes={sedes} onClose={() => setModalAgendar(null)} onGuardada={onCambio} isMobile={isMobile} />}
      {showGestor && <GestorColumnas visibles={visibles} onToggle={toggleCol} onClose={() => setShowGestor(false)} />}
    </div>
  );
}
