import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientesApi } from '../services/api';
import DocLookup from '../components/DocLookup/DocLookup';

const S = {
  card: { background: '#fff', borderRadius: 10, padding: 24, boxShadow: 'var(--shadow)', border: '1px solid var(--color-border)', maxWidth: 680 },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 20 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' },
  group: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' },
  input: { padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13 },
  select: { padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13 },
  btns: { display: 'flex', gap: 10, marginTop: 24 },
  btnPrimary: { padding: '10px 22px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnSecondary: { padding: '10px 22px', background: '#fff', color: 'var(--color-text)', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
};

export default function ClienteNuevo() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    tipoDoc: 'DNI', numDoc: '', nombre: '', apellidos: '', razonSocial: '',
    celular: '', email: '', direccion: '', canalOrigen: 'TIENDA', apiRawJson: null,
  });

  const handleLookupResult = (datos, rawJson) => {
    setForm((f) => ({
      ...f,
      nombre: datos.nombre || f.nombre,
      apellidos: datos.apellidos || f.apellidos,
      razonSocial: datos.razonSocial || f.razonSocial,
      direccion: datos.direccion || f.direccion,
      apiRawJson: rawJson,
    }));
  };

  const mutation = useMutation({
    mutationFn: () => clientesApi.crear({ ...form, crmEstado: 'COMPLETO' }),
    onSuccess: (data) => { toast.success('Cliente creado'); navigate(`/clientes/${data.id}`); },
    onError: (e) => toast.error(e?.error || 'Error al crear cliente'),
  });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Volver</button>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Nuevo Cliente</h1>
      </div>

      <div style={S.card}>
        <div style={S.title}>Identificación</div>

        <DocLookup
          tipoDoc={form.tipoDoc}
          numDoc={form.numDoc}
          onTipoChange={(v) => setForm((f) => ({ ...f, tipoDoc: v, numDoc: '' }))}
          onNumDocChange={(v) => setForm((f) => ({ ...f, numDoc: v }))}
          onResult={handleLookupResult}
        />

        <div style={{ ...S.grid, marginTop: 20 }}>
          <div style={S.group}>
            <label style={S.label}>Nombre(s)</label>
            <input style={S.input} value={form.nombre} onChange={set('nombre')} placeholder="Nombres" />
          </div>
          <div style={S.group}>
            <label style={S.label}>Apellidos</label>
            <input style={S.input} value={form.apellidos} onChange={set('apellidos')} placeholder="Apellidos" />
          </div>
          <div style={{ ...S.group, gridColumn: '1 / -1' }}>
            <label style={S.label}>Razón Social (si es empresa)</label>
            <input style={S.input} value={form.razonSocial} onChange={set('razonSocial')} placeholder="Razón social" />
          </div>
          <div style={S.group}>
            <label style={S.label}>Celular</label>
            <input style={S.input} value={form.celular} onChange={set('celular')} placeholder="9XXXXXXXX" />
          </div>
          <div style={S.group}>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" value={form.email} onChange={set('email')} placeholder="correo@email.com" />
          </div>
          <div style={{ ...S.group, gridColumn: '1 / -1' }}>
            <label style={S.label}>Dirección</label>
            <input style={S.input} value={form.direccion} onChange={set('direccion')} placeholder="Dirección completa" />
          </div>
          <div style={S.group}>
            <label style={S.label}>Canal de origen</label>
            <select style={S.select} value={form.canalOrigen} onChange={set('canalOrigen')}>
              <option value="TIENDA">Tienda</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="WEB">Web</option>
              <option value="N8N">n8n / Bot</option>
            </select>
          </div>
        </div>

        <div style={S.btns}>
          <button style={S.btnPrimary} onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Crear cliente'}
          </button>
          <button style={S.btnSecondary} onClick={() => navigate(-1)}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
