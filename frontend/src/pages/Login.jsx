import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

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
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#080808',
      backgroundImage: `repeating-linear-gradient(92deg, transparent 0px, transparent 3px, rgba(255,255,255,.004) 3px, rgba(255,255,255,.004) 4px)`,
      padding: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Línea amarilla superior — igual a la web */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #f5c400, #ffd400, #f5c400)', zIndex: 10 }} />
      {/* Resplandor de fondo */}
      <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,196,0,.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Card */}
      <div style={{
        background: '#141414',
        border: '1px solid #242424',
        borderTop: '3px solid #f5c400',
        borderRadius: 12,
        padding: '40px 32px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,.8)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="https://llantaland.com/OsoLogoSVG.svg"
            alt="Llantaland"
            style={{ height: 56, marginBottom: 12 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div style={{
            fontFamily: "'Black Ops One', sans-serif",
            fontSize: 26,
            color: '#f5c400',
            letterSpacing: 2,
          }}>
            LLANTALAND
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 4,
            color: '#888',
            textTransform: 'uppercase',
            marginTop: 4,
          }}>
            Sistema CRM
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 700,
              color: '#888', marginBottom: 7,
              textTransform: 'uppercase', letterSpacing: 1.5,
              fontFamily: "'Barlow Condensed', sans-serif",
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="correo@llantaland.com"
              style={{
                width: '100%', padding: '11px 14px',
                background: '#1a1a1a', border: '1.5px solid #303030',
                borderRadius: 8, fontSize: 15, color: '#f0ede8',
                outline: 'none', transition: 'border-color .2s',
              }}
              onFocus={e => e.target.style.borderColor = '#f5c400'}
              onBlur={e => e.target.style.borderColor = '#303030'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 700,
              color: '#888', marginBottom: 7,
              textTransform: 'uppercase', letterSpacing: 1.5,
              fontFamily: "'Barlow Condensed', sans-serif",
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%', padding: '11px 14px',
                background: '#1a1a1a', border: '1.5px solid #303030',
                borderRadius: 8, fontSize: 15, color: '#f0ede8',
                outline: 'none', transition: 'border-color .2s',
              }}
              onFocus={e => e.target.style.borderColor = '#f5c400'}
              onBlur={e => e.target.style.borderColor = '#303030'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              background: loading ? '#d4a900' : '#f5c400',
              color: '#000', border: 'none', borderRadius: 8,
              fontSize: 15, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: 2, textTransform: 'uppercase',
              transition: 'background .2s',
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar →'}
          </button>
        </form>
      </div>
    </div>
  );
}
