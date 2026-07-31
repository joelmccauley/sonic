import { apiClient } from './client';
import type { Shift } from '@/types';

export const shiftsApi = {
  getAll: (params?: { userId?: number; startDate?: string; endDate?: string }) =>
    apiClient.get<{ shifts: Shift[] }>('/shifts', { params }),
  getActive: () => apiClient.get<Shift | null>('/shifts/active'),
  clockIn: (cashDrawer?: number) => apiClient.post<Shift>('/shifts/clock-in', { cashDrawer }),
  clockOut: (closingCash?: number, notes?: string) => apiClient.patch<Shift>('/shifts/clock-out', { closingCash, notes }),
  update: (id: number, data: { closingCash?: number; notes?: string; clockOut?: string }) =>
    apiClient.patch<Shift>(`/shifts/${id}`, data),
};
