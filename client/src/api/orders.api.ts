import { apiClient } from './client';
import type { Order, OrderType, OrderStatus } from '@/types';

export const ordersApi = {
  getAll: (params?: { status?: OrderStatus; type?: OrderType; date?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ orders: Order[]; total: number }>('/orders', { params }),

  getOpen: () => apiClient.get<Order[]>('/orders/open'),

  getKDS: () => apiClient.get<Order[]>('/orders/kds'),

  get: (id: number) => apiClient.get<Order>(`/orders/${id}`),

  create: (data: {
    type: OrderType;
    tableId?: number;
    guestCount?: number;
    customerName?: string;
    customerPhone?: string;
    customerId?: number;
    notes?: string;
  }) => apiClient.post<Order>('/orders', data),

  update: (id: number, data: Partial<Order>) => apiClient.put<Order>(`/orders/${id}`, data),

  updateStatus: (id: number, status: OrderStatus) =>
    apiClient.patch<Order>(`/orders/${id}/status`, { status }),

  addItem: (
    orderId: number,
    data: {
      menuItemId: number;
      quantity?: number;
      notes?: string;
      course?: number;
      modifiers?: { modifierId: number; price: number }[];
    }
  ) => apiClient.post(`/orders/${orderId}/items`, data),

  updateItem: (
    orderId: number,
    itemId: number,
    data: { quantity?: number; notes?: string; course?: number }
  ) => apiClient.put(`/orders/${orderId}/items/${itemId}`, data),

  voidItem: (orderId: number, itemId: number, reason?: string) =>
    apiClient.delete(`/orders/${orderId}/items/${itemId}`, { data: { reason } }),

  sendToKitchen: (id: number) => apiClient.post<Order>(`/orders/${id}/send`),

  transfer: (id: number, tableId: number) =>
    apiClient.post<Order>(`/orders/${id}/transfer`, { tableId }),

  split: (id: number, itemIds: number[]) =>
    apiClient.post<{ original: Order; split: Order }>(`/orders/${id}/split`, { itemIds }),

  applyDiscount: (id: number, discountId: number, managerPin?: string) =>
    apiClient.post<Order>(`/orders/${id}/discount`, { discountId, managerPin }),

  removeDiscount: (id: number, discountId: number) =>
    apiClient.delete<Order>(`/orders/${id}/discount/${discountId}`),

  void: (id: number, reason?: string) =>
    apiClient.delete<Order>(`/orders/${id}/void`, { data: { reason } }),

  getReceipt: (id: number) =>
    apiClient.get<{ order: Order; settings: Record<string, string> }>(`/orders/${id}/receipt`),
};
