import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Organization } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  login: (user: User, token: string, organization?: Organization | null) => void;
  logout: () => void;
  lockScreen: () => void;
  updateUser: (user: Partial<User>) => void;
  setOrganization: (org: Organization | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      organization: null,
      isAuthenticated: false,
      isLocked: false,

      login: (user, token, organization = null) =>
        set({ user, token, organization, isAuthenticated: true, isLocked: false }),

      logout: () => {
        set({ user: null, token: null, organization: null, isAuthenticated: false, isLocked: false });
      },

      lockScreen: () => set({ isLocked: true }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setOrganization: (org) => set({ organization: org }),
    }),
    {
      name: 'sonicpos-auth',
      partialise: (state) => ({ user: state.user, token: state.token, organization: state.organization, isAuthenticated: state.isAuthenticated }),
    } as any
  )
);
