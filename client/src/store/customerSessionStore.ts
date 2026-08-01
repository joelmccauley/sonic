import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Customer } from '@/types';

interface CustomerSessionState {
  token: string | null;
  customer: Customer | null;
  isAuthenticated: boolean;
  login: (token: string, customer: Customer) => void;
  logout: () => void;
}

export const useCustomerSessionStore = create<CustomerSessionState>()(
  persist(
    (set) => ({
      token: null,
      customer: null,
      isAuthenticated: false,
      login: (token, customer) => set({ token, customer, isAuthenticated: true }),
      logout: () => set({ token: null, customer: null, isAuthenticated: false }),
    }),
    {
      name: 'sonicpos-customer-session',
      partialize: (state) => ({
        token: state.token,
        customer: state.customer,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
