import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { token, usuario, setAuth, logout } = useAuthStore();
  return {
    token,
    usuario,
    isAuthenticated: !!token,
    isAdmin: usuario?.rol === 'ADMIN',
    setAuth,
    logout,
  };
}
