import { apiClient } from './client';
import type { Discount, DiscountType } from '@/types';

export const discountsApi = {
  getAll: () => apiClient.get<Discount[]>('/discounts'),
  create: (data: { name: string; type: DiscountType; value: number; requiresPin?: boolean; minOrder?: number; description?: string }) =>
    apiClient.post<Discount>('/discounts', data),
  update: (id: number, data: Partial<Discount>) => apiClient.put<Discount>(`/discounts/${id}`, data),
  toggle: (id: number) => apiClient.patch(`/discounts/${id}/toggle`),
  delete: (id: number) => apiClient.delete(`/discounts/${id}`),
};
