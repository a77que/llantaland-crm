import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { token, usuario, setAuth, logout, businessType, setBusinessType } = useAuthStore();
  return {
    token,
    usuario,
    isAuthenticated: !!token,
    isAdmin: usuario?.rol === 'ADMIN',
    setAuth,
    logout,
    businessType,
    setBusinessType,
  };
}
