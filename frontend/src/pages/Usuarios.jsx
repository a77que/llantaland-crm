import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usuariosApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';

const S = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', background: '#f8fafc', borderBottom: '2px solid var(--color-border)' },
  td: { padding: '11px 16px', borderBottom: '1px solid var(--color-border)' },
  btnPrimary: { padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  btnGhost: { padding: '6px 10px', borderRadius: 7, border: '1px solid var(--color-border)', background: '#fff', color: '#0f172a', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  input: { padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, width: '100%' },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 16 },
  modal: { background: '#fff', borderRadius: 12, padding: 24, width: 420, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.3)' },
};

const rolBadge = (rol) => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
  background: rol === 'ADMIN' ? '#fef3c7' : '#e0e7ff', color: rol === 'ADMIN' ? '#92400e' : '#3730a3',
});

export default function Usuarios() {
  const qc = useQueryClient();
  const { usuario: actual } = useAuth();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'VENDEDOR' });

  const { data: usuarios, isLoading } = useQuery({ queryKey: ['usuarios'], queryFn: usuariosApi.listar });

  const crear = useMutation({
    mutationFn: () => usuariosApi.crear(form),
    onSuccess: () => { toast.success('Usuario creado'); setModal(false); setForm({ nombre: '', email: '', password: '', rol: 'VENDEDOR' }); qc.invalidateQueries({ queryKey: ['usuarios'] }); },
    onError: (e) => toast.error(e?.error || 'No se pudo crear el usuario'),
  });

  const actualizar = useMutation({
    mutationFn: ({ id, data }) => usuariosApi.actualizar(id, data),
    onSuccess: () => { toast.success('Usuario actualizado'); qc.invalidateQueries({ queryKey: ['usuarios'] }); },
    onError: (e) => toast.error(e?.error || 'No se pudo actualizar'),
  });

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));
  const submit = (e) => { e.preventDefault(); crear.mutate(); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Usuarios</h1>
        <button style={S.btnPrimary} onClick={() => setModal(true)}>+ Crear usuario</button>
      </div>

      {isLoading ? <LoadingSpinner fullPage /> : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Nombre</th>
              <th style={S.th}>Email</th>
              <th style={S.th}>Rol</th>
              <th style={S.th}>Estado</th>
              <th style={S.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios?.map((u) => {
              const esYo = u.id === actual?.id;
              return (
                <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
                  <td style={S.td}>{u.nombre} {esYo && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>(tú)</span>}</td>
                  <td style={S.td}>{u.email}</td>
                  <td style={S.td}><span style={rolBadge(u.rol)}>{u.rol}</span></td>
                  <td style={S.td}>{u.activo ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Activo</span> : <span style={{ color: '#dc2626', fontWeight: 600 }}>Inactivo</span>}</td>
                  <td style={{ ...S.td, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button style={S.btnGhost} disabled={esYo || actualizar.isPending}
                      onClick={() => actualizar.mutate({ id: u.id, data: { rol: u.rol === 'ADMIN' ? 'VENDEDOR' : 'ADMIN' } })}>
                      {u.rol === 'ADMIN' ? '↓ Hacer vendedor' : '↑ Hacer admin'}
                    </button>
                    <button style={{ ...S.btnGhost, color: u.activo ? '#dc2626' : '#16a34a' }} disabled={esYo || actualizar.isPending}
                      onClick={() => actualizar.mutate({ id: u.id, data: { activo: !u.activo } })}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!usuarios?.length && <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Sin usuarios</td></tr>}
          </tbody>
        </table>
      )}

      {modal && (
        <div style={S.overlay} onClick={() => setModal(false)}>
          <form style={S.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginTop: 0, marginBottom: 18 }}>Crear usuario</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Nombre completo</label>
              <input style={S.input} value={form.nombre} onChange={set('nombre')} required />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Email</label>
              <input style={S.input} type="email" value={form.email} onChange={set('email')} required />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Contraseña (mín. 6 caracteres)</label>
              <input style={S.input} type="password" value={form.password} onChange={set('password')} minLength={6} required />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Rol</label>
              <select style={S.input} value={form.rol} onChange={set('rol')}>
                <option value="VENDEDOR">Vendedor</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" style={S.btnGhost} onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" style={S.btnPrimary} disabled={crear.isPending}>{crear.isPending ? 'Creando…' : 'Crear usuario'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
