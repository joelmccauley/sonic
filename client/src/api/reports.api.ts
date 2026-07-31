import { apiClient } from './client';
import type { DailySummary } from '@/types';

export const reportsApi = {
  getSales: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get('/reports/sales', { params }),
  getHourlySales: (date?: string) =>
    apiClient.get('/reports/sales/hourly', { params: date ? { date } : {} }),
  getItems: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get('/reports/items', { params }),
  getEmployees: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get('/reports/employees', { params }),
  getPayments: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get('/reports/payments', { params }),
  getDiscounts: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get('/reports/discounts', { params }),
  getDailySummary: () => apiClient.get<DailySummary>('/reports/summary'),
  getAnalytics: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get('/reports/analytics', { params }),
};
