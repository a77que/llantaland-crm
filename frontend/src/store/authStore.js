import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      setAuth: (token, usuario) => set({ token, usuario }),
      logout: () => set({ token: null, usuario: null }),
    }),
    {
      name: 'llantaland-auth',
      partialize: ({ token, usuario }) => ({ token, usuario }),
      merge: (saved, current) => ({
        ...current,
        token: saved?.token ?? null,
        usuario: saved?.usuario ?? null,
      }),
    }
  )
);
