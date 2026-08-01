import { apiClient } from './client';

export const settingsApi = {
  getAll: () => apiClient.get<Record<string, string>>('/settings'),
  getPublic: () => apiClient.get<Record<string, string>>('/settings/public'),
  getStoreStatus: () => apiClient.get<{ isActive: boolean }>('/settings/store-status'),
  update: (data: Record<string, string>) => apiClient.put('/settings', data),
  removeLogo: () => apiClient.put('/settings', { logo_url: '' }),
  updateStoreStatus: (isActive: boolean) => apiClient.patch('/settings/store-status', { isActive }),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return apiClient.post<{ url: string }>('/settings/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
