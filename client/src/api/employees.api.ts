import { apiClient } from './client';
import type { User, Role } from '@/types';

export const employeesApi = {
  getAll: () => apiClient.get<User[]>('/employees'),
  getProfiles: () => apiClient.get<Pick<User, 'id' | 'username' | 'firstName' | 'lastName' | 'role'>[]>('/employees/profiles'),
  get: (id: number) => apiClient.get<User>(`/employees/${id}`),
  create: (data: Partial<User> & { pin: string; password: string }) =>
    apiClient.post<User>('/employees', data),
  update: (id: number, data: Partial<User>) => apiClient.put<User>(`/employees/${id}`, data),
  toggle: (id: number) => apiClient.patch(`/employees/${id}/toggle`),
  changePin: (id: number, pin: string) => apiClient.patch(`/employees/${id}/pin`, { pin }),
  changeRole: (id: number, role: Role) => apiClient.patch(`/employees/${id}/role`, { role }),
  delete: (id: number) => apiClient.delete(`/employees/${id}`),
};
