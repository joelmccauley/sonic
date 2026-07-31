import { create } from 'zustand';
import type { Order, CartItem, CartModifier } from '@/types';
import { v4 as uuid } from 'crypto';

// Simple UUID without dependency
function tempId(): string {
  return Math.random().toString(36).slice(2, 11);
}

interface OrderState {
  // Active order being worked on (for POS screen)
  activeOrderId: number | null;
  activeOrder: Order | null;
  
  // Cart items for current order
  cart: CartItem[];

  // Selected table
  selectedTableId: number | null;

  // KDS order status tracking
  kdsOrders: Order[];

  setActiveOrder: (order: Order | null) => void;
  setSelectedTable: (tableId: number | null) => void;
  clearCart: () => void;
  addToCart: (item: Omit<CartItem, 'tempId'>) => void;
  removeFromCart: (tempId: string) => void;
  updateCartItemQuantity: (tempId: string, quantity: number) => void;
  updateCartItemNotes: (tempId: string, notes: string) => void;
  setKDSOrders: (orders: Order[]) => void;
  updateKDSOrder: (order: Order) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  activeOrderId: null,
  activeOrder: null,
  cart: [],
  selectedTableId: null,
  kdsOrders: [],

  setActiveOrder: (order) =>
    set({ activeOrder: order, activeOrderId: order?.id ?? null, cart: [] }),

  setSelectedTable: (tableId) => set({ selectedTableId: tableId }),

  clearCart: () => set({ cart: [] }),

  addToCart: (item) =>
    set((state) => ({
      cart: [...state.cart, { ...item, tempId: tempId() }],
    })),

  removeFromCart: (tempId) =>
    set((state) => ({ cart: state.cart.filter((i) => i.tempId !== tempId) })),

  updateCartItemQuantity: (tempId, quantity) =>
    set((state) => ({
      cart: state.cart.map((i) => (i.tempId === tempId ? { ...i, quantity } : i)),
    })),

  updateCartItemNotes: (tempId, notes) =>
    set((state) => ({
      cart: state.cart.map((i) => (i.tempId === tempId ? { ...i, notes } : i)),
    })),

  setKDSOrders: (orders) => set({ kdsOrders: orders }),

  updateKDSOrder: (order) =>
    set((state) => {
      const exists = state.kdsOrders.find((o) => o.id === order.id);
      if (!exists) return { kdsOrders: [...state.kdsOrders, order] };
      
      // Remove if fully completed
      if (['PAID', 'VOIDED', 'READY'].includes(order.status)) {
        return { kdsOrders: state.kdsOrders.filter((o) => o.id !== order.id) };
      }
      
      return { kdsOrders: state.kdsOrders.map((o) => (o.id === order.id ? order : o)) };
    }),
}));
