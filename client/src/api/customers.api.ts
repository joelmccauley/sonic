import { apiClient } from './client';
import type { Customer } from '@/types';

export const customersApi = {
  getAll: (params?: { search?: string }) => apiClient.get<Customer[]>('/customers', { params }),
  getById: (id: number) => apiClient.get<Customer>(`/customers/${id}`),
  create: (data: { firstName: string; lastName?: string; phone?: string; email?: string }) => apiClient.post<Customer>('/customers', data),
  update: (id: number, data: Partial<Customer>) => apiClient.put<Customer>(`/customers/${id}`, data),
  addLoyaltyPoints: (id: number, points: number) => apiClient.post(`/customers/${id}/loyalty`, { points }),
};
