import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { patronApi } from '../services/api';
import { useIsMobile } from '../hooks/useIsMobile';

const INP_STYLE = { width: '100%', padding: '9px 12px', fontSize: 14, border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text)' };
const PERSONAJE_ICON = { PATRON: '🤵', PATRONA: '👸', OSO_MARIACHI: '🐻' };
const PERSONAJE_LABEL = { PATRON: 'Patrón', PATRONA: 'Patrona', OSO_MARIACHI: 'Oso Mariachi' };
const AGREGADO_LABEL = { RAMO_FLORES: 'Ramo de flores', CHOCOLATES: 'Chocolates', PELUCHE: 'Peluche', OTRO: 'Otro regalo' };

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{titulo}</div>
      {children}
    </div>
  );
}

/* ─── Personajes (catálogo fijo, solo precio/descripción/activo editable) ─── */
function PersonajesPanel() {
  const qc = useQueryClient();
  const { data: personajes = [], isLoading } = useQuery({ queryKey: ['patron-personajes'], queryFn: patronApi.personajes });
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});

  const mut = useMutation({
    mutationFn: ({ id, data }) => patronApi.actualizarPersonaje(id, data),
    onSuccess: () => { toast.success('Personaje actualizado'); qc.invalidateQueries(['patron-personajes']); setEditId(null); },
    onError: (e) => toast.error(e?.error || 'Error al guardar'),
  });

  const abrirEdicion = (p) => { setEditId(p.id); setForm({ precioBase: p.precioBase, descripcion: p.descripcion || '', activo: p.activo }); };

  if (isLoading) return <div style={{ color: 'var(--color-text-muted)' }}>⏳ Cargando...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
      {personajes.map(p => (
        <div key={p.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, opacity: p.activo ? 1 : 0.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22 }}>{PERSONAJE_ICON[p.nombre]}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{PERSONAJE_LABEL[p.nombre] || p.nombre}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>{p.descripcion || 'Sin descripción'}</div>
            </div>
            <button onClick={() => abrirEdicion(p)} style={{ padding: '5px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✏️ Editar</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 800, color: '#16a34a' }}>S/ {parseFloat(p.precioBase).toFixed(2)}</div>

          {editId === p.id && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)' }}>PRECIO BASE</label>
              <input style={INP_STYLE} type="number" value={form.precioBase} onChange={e => setForm(f => ({ ...f, precioBase: e.target.value }))} />
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginTop: 8, display: 'block' }}>DESCRIPCIÓN</label>
              <input style={INP_STYLE} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13 }}>
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                Activo
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => mut.mutate({ id: p.id, data: form })} disabled={mut.isPending} style={{ flex: 1, padding: '8px', background: '#f5c400', color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}>Guardar</button>
                <button onClick={() => setEditId(null)} style={{ padding: '8px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Distritos de cobertura (costo aprox. de movilidad) ─── */
function DistritosPanel() {
  const qc = useQueryClient();
  const { data: distritos = [], isLoading } = useQuery({ queryKey: ['patron-distritos'], queryFn: patronApi.distritos });
  const [nuevo, setNuevo] = useState({ distrito: '', costoTransporteAprox: '' });

  const crear = useMutation({
    mutationFn: () => patronApi.crearDistrito(nuevo),
    onSuccess: () => { toast.success('Distrito agregado'); qc.invalidateQueries(['patron-distritos']); setNuevo({ distrito: '', costoTransporteAprox: '' }); },
    onError: (e) => toast.error(e?.error || 'Error al guardar'),
  });

  const eliminar = useMutation({
    mutationFn: (id) => patronApi.eliminarDistrito(id),
    onSuccess: () => { toast.success('Distrito eliminado'); qc.invalidateQueries(['patron-distritos']); },
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input style={{ ...INP_STYLE, flex: '2 1 160px' }} placeholder="Distrito (ej. Miraflores)" value={nuevo.distrito} onChange={e => setNuevo(n => ({ ...n, distrito: e.target.value }))} />
        <input style={{ ...INP_STYLE, flex: '1 1 120px' }} type="number" placeholder="Costo aprox S/" value={nuevo.costoTransporteAprox} onChange={e => setNuevo(n => ({ ...n, costoTransporteAprox: e.target.value }))} />
        <button onClick={() => crear.mutate()} disabled={crear.isPending || !nuevo.distrito} style={{ padding: '9px 18px', background: '#f5c400', color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}>+ Agregar</button>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>⏳ Cargando...</div>
      ) : distritos.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Sin distritos configurados — el flujo de WhatsApp dará un costo genérico hasta que agregues distritos.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {distritos.map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
              <span style={{ fontWeight: 600 }}>{d.distrito}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>{d.costoTransporteAprox ? `S/ ${parseFloat(d.costoTransporteAprox).toFixed(2)}` : 'Sin costo definido'}</span>
                <button onClick={() => eliminar.mutate(d.id)} style={{ background: 'none', border: 'none', color: '#e3000f', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Agregados de regalo (ramo, chocolates, peluches, etc.) ─── */
function AgregadosPanel() {
  const qc = useQueryClient();
  const { data: agregados = [], isLoading } = useQuery({ queryKey: ['patron-agregados'], queryFn: patronApi.agregados });
  const [nuevo, setNuevo] = useState({ nombre: '', tipo: 'RAMO_FLORES', precio: '' });

  const crear = useMutation({
    mutationFn: () => patronApi.crearAgregado(nuevo),
    onSuccess: () => { toast.success('Agregado creado'); qc.invalidateQueries(['patron-agregados']); setNuevo({ nombre: '', tipo: 'RAMO_FLORES', precio: '' }); },
    onError: (e) => toast.error(e?.error || 'Error al guardar'),
  });

  const eliminar = useMutation({
    mutationFn: (id) => patronApi.eliminarAgregado(id),
    onSuccess: () => { toast.success('Agregado eliminado'); qc.invalidateQueries(['patron-agregados']); },
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input style={{ ...INP_STYLE, flex: '2 1 160px' }} placeholder="Nombre (ej. Ramo de rosas)" value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} />
        <select style={{ ...INP_STYLE, flex: '1 1 140px' }} value={nuevo.tipo} onChange={e => setNuevo(n => ({ ...n, tipo: e.target.value }))}>
          {Object.entries(AGREGADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input style={{ ...INP_STYLE, flex: '1 1 100px' }} type="number" placeholder="Precio S/" value={nuevo.precio} onChange={e => setNuevo(n => ({ ...n, precio: e.target.value }))} />
        <button onClick={() => crear.mutate()} disabled={crear.isPending || !nuevo.nombre || !nuevo.precio} style={{ padding: '9px 18px', background: '#f5c400', color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}>+ Agregar</button>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>⏳ Cargando...</div>
      ) : agregados.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Sin agregados de regalo configurados.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {agregados.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, opacity: a.activo ? 1 : 0.5 }}>
              <span><strong>{a.nombre}</strong> <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>({AGREGADO_LABEL[a.tipo] || a.tipo})</span></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>S/ {parseFloat(a.precio).toFixed(2)}</span>
                <button onClick={() => eliminar.mutate(a.id)} style={{ background: 'none', border: 'none', color: '#e3000f', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PersonajesAgregados() {
  const isMobile = useIsMobile();

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700 }}>Personajes y Agregados</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Catálogo del negocio "El Patrón" — shows, distritos de cobertura y regalos adicionales</div>
      </div>

      <Seccion titulo="🎭 Personajes (shows)">
        <PersonajesPanel />
      </Seccion>

      <Seccion titulo="🗺️ Distritos de cobertura (costo aprox. de movilidad)">
        <DistritosPanel />
      </Seccion>

      <Seccion titulo="🎁 Agregados de regalo">
        <AgregadosPanel />
      </Seccion>
    </div>
  );
}
