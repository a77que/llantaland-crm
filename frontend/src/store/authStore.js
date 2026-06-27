import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      businessType: 'llantas', // 'llantas' | 'patron'
      setAuth: (token, usuario) => set({ token, usuario }),
      logout: () => set({ token: null, usuario: null }),
      setBusinessType: (businessType) => set({ businessType }),
    }),
    { name: 'llantaland-auth' }
  )
);
