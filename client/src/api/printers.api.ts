import { apiClient } from './client';
import type { Printer } from '@/types';

export const printersApi = {
  getAll: () => apiClient.get<Printer[]>('/printers'),
  create: (data: { name: string; type: string; ipAddress?: string; port?: number }) => apiClient.post<Printer>('/printers', data),
  update: (id: number, data: Partial<Printer>) => apiClient.put<Printer>(`/printers/${id}`, data),
  setDefault: (id: number) => apiClient.patch(`/printers/${id}/default`),
  test: (id: number) => apiClient.post(`/printers/${id}/test`),
  delete: (id: number) => apiClient.delete(`/printers/${id}`),
};
