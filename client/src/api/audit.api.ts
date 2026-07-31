import { apiClient } from './client';
import type { AuditLog } from '@/types';

export const auditApi = {
  getLogs: (params?: { action?: string; entity?: string; startDate?: string; endDate?: string; limit?: number }) =>
    apiClient.get<{ logs: AuditLog[]; total: number }>('/audit', { params }),
  exportCsv: (params?: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    window.open(`/api/audit/export?${qs}`, '_blank');
  },
};
