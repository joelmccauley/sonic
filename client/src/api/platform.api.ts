import axios from 'axios';
import { usePlatformAdminStore } from '@/store/platformAdminStore';

export type PlatformPlanTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type PlatformSubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export interface PlatformOrganization {
  id: number;
  name: string;
  slug: string;
  email: string;
  phone?: string | null;
  planTier: PlatformPlanTier;
  subscriptionStatus: PlatformSubscriptionStatus;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  isActive: boolean;
  createdAt: string;
  usersCount: number;
  orders30d: number;
  sales30d: number;
  mrr: number;
  lastOrderAt?: string | null;
}

export interface PlatformOverview {
  summary: {
    totalOrganizations: number;
    activeOrganizations: number;
    trialingOrganizations: number;
    pastDueOrganizations: number;
    canceledOrganizations: number;
    newOrganizations30d: number;
    totalUsers: number;
    totalOrders30d: number;
    totalSales30d: number;
    monthlyRecurringRevenue: number;
    planCounts: Record<PlatformPlanTier, number>;
  };
  organizations: PlatformOrganization[];
}

const platformClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

platformClient.interceptors.request.use((config) => {
  const token = usePlatformAdminStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

platformClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      usePlatformAdminStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export const platformApi = {
  login: (email: string, password: string) =>
    platformClient.post<{ token: string; admin: { email: string } }>('/platform/auth/login', { email, password }),
  getOverview: () => platformClient.get<PlatformOverview>('/platform/admin/overview'),
  updateOrganization: (id: number, data: Partial<Pick<PlatformOrganization, 'isActive' | 'planTier' | 'subscriptionStatus'>>) =>
    platformClient.patch(`/platform/admin/organizations/${id}`, data),
};
