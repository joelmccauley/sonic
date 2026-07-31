import { apiClient } from './client';
import type { Table, TableStatus } from '@/types';

export const tablesApi = {
  getAll: (section?: string) =>
    apiClient.get<Table[]>('/tables', { params: section ? { section } : {} }),

  getSections: () => apiClient.get<string[]>('/tables/sections'),

  get: (id: number) => apiClient.get<Table>(`/tables/${id}`),

  create: (data: Partial<Table>) => apiClient.post<Table>('/tables', data),

  update: (id: number, data: Partial<Table>) => apiClient.put<Table>(`/tables/${id}`, data),

  updateStatus: (id: number, status: TableStatus) =>
    apiClient.patch<Table>(`/tables/${id}/status`, { status }),

  delete: (id: number) => apiClient.delete(`/tables/${id}`),
};
