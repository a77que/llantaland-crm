import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export const API = (process.env.EXPO_PUBLIC_API_URL || 'https://crm.llantaland.com').replace(/\/$/, '');
const TOKEN_KEY = 'lll_token';

type Usuario = { id: string; nombre: string; email: string; rol: string };

type AuthState = {
  token: string | null;
  usuario: Usuario | null;
  cargando: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  usuario: null,
  cargando: true,
  init: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        const r = await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
        if (r.ok) { const d = await r.json(); set({ token, usuario: d.usuario || d }); }
        else await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch (e) { /* sin sesión */ }
    set({ cargando: false });
  },
  login: async (email, password) => {
    const r = await fetch(API + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || 'Credenciales incorrectas');
    }
    const d = await r.json();
    await SecureStore.setItemAsync(TOKEN_KEY, d.token);
    set({ token: d.token, usuario: d.usuario });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, usuario: null });
  },
}));

// Fetch autenticado contra el CRM.
export async function api(path: string, opts: any = {}) {
  const token = useAuth.getState().token;
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(opts.headers || {}) },
  });
  if (r.status === 401) { await useAuth.getState().logout(); throw new Error('Sesión expirada'); }
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Error ' + r.status); }
  return r.json();
}
