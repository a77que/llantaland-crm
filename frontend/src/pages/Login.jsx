import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a3c5e 0%, #0f2236 100%)' },
  card: { background: '#fff', borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 400, boxShadow: '0 20px 40px rgba(0,0,0,.3)' },
  logo: { textAlign: 'center', marginBottom: 28 },
  logoIcon: { fontSize: 48 },
  logoText: { fontSize: 24, fontWeight: 800, color: 'var(--color-primary)', marginTop: 6 },
  logoSub: { color: 'var(--color-text-muted)', fontSize: 13 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 14, outline: 'none', transition: 'border-color .2s' },
  group: { marginBottom: 18 },
  btn: { width: '100%', padding: '12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, usuario } = await authApi.login({ email, password });
      setAuth(token, usuario);
      navigate('/');
    } catch (err) {
      toast.error(err?.error || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoIcon}>🛞</div>
          <div style={S.logoText}>Llantaland</div>
          <div style={S.logoSub}>Sistema CRM</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={S.group}>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="correo@llantaland.pe" autoFocus />
          </div>
          <div style={S.group}>
            <label style={S.label}>Contraseña</label>
            <input style={S.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <button style={S.btn} disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
      </div>
    </div>
  );
}
