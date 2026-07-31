import { apiClient } from './client';

export const settingsApi = {
  getAll: () => apiClient.get<Record<string, string>>('/settings'),
  getPublic: () => apiClient.get<Record<string, string>>('/settings/public'),
  update: (data: Record<string, string>) => apiClient.put('/settings', data),
  removeLogo: () => apiClient.put('/settings', { logo_url: '' }),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return apiClient.post<{ url: string }>('/settings/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
