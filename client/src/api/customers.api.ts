import { apiClient } from './client';
import type { Customer, Order } from '@/types';

export interface CustomerListResponse {
  customers: Customer[];
  total: number;
}

export interface CustomerCampaignDraft {
  audience: 'all' | 'email' | 'text' | 'opted-in';
  subject?: string;
  message: string;
}

export const customersApi = {
  list: (params?: { limit?: number; offset?: number }) => apiClient.get<CustomerListResponse>('/customers', { params }),
  search: (q: string) => apiClient.get<Customer[]>('/customers/search', { params: { q } }),
  get: (id: number) => apiClient.get<Customer>(`/customers/${id}`),
  create: (data: Partial<Customer> & { firstName: string }) => apiClient.post<Customer>('/customers', data),
  update: (id: number, data: Partial<Customer>) => apiClient.put<Customer>(`/customers/${id}`, data),
  orders: (id: number) => apiClient.get<Order[]>(`/customers/${id}/orders`),
  points: (id: number, points: number) => apiClient.post<Customer>(`/customers/${id}/points`, { points }),
};
