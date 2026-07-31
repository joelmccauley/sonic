import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlatformAdminState {
  token: string | null;
  email: string | null;
  isAuthenticated: boolean;
  login: (token: string, email: string) => void;
  logout: () => void;
}

export const usePlatformAdminStore = create<PlatformAdminState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      isAuthenticated: false,
      login: (token, email) => set({ token, email, isAuthenticated: true }),
      logout: () => set({ token: null, email: null, isAuthenticated: false }),
    }),
    {
      name: 'sonicpos-platform-admin-auth',
      partialize: (state) => ({
        token: state.token,
        email: state.email,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
