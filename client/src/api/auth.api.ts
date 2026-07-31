import { apiClient } from './client';
import type { User, Organization, PlanTier } from '@/types';

export interface AuthResponse {
  token: string;
  user: User;
  organization: Organization;
}

export const authApi = {
  login: (username: string, password: string, storeCode?: string) =>
    apiClient.post<AuthResponse>('/auth/login', { username, password, storeCode: storeCode || undefined }),

  loginPin: (username: string, pin: string, storeCode?: string) =>
    apiClient.post<AuthResponse>('/auth/login-pin', { username, pin, storeCode: storeCode || undefined }),

  signup: (data: {
    restaurantName: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    planTier: PlanTier;
  }) => apiClient.post<AuthResponse>('/auth/signup', data),

  googleAuth: (credential: string, extra?: { restaurantName?: string; planTier?: PlanTier }) =>
    apiClient.post<AuthResponse>('/auth/google', { credential, ...extra }),

  getMe: () => apiClient.get<User & { organization: Organization | null }>('/auth/me'),

  getStoreInfo: (slug: string) =>
    apiClient.get<{
      slug: string;
      name: string;
      logoUrl: string | null;
      staff: Array<{ username: string; firstName: string; lastName: string; role: string; imageUrl?: string }>;
    }>(`/auth/store/${encodeURIComponent(slug)}`),

  logout: () => apiClient.post('/auth/logout'),

  refresh: () => apiClient.post<{ token: string }>('/auth/refresh'),
};
