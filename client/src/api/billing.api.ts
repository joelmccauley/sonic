import { apiClient } from './client';
import type { PlanInfo, PlanTier, SubscriptionStatus } from '@/types';

export interface SubscriptionInfo {
  id: number;
  name: string;
  slug: string;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  hasPaymentMethod: boolean;
  plan: { name: string; price: number; tagline: string };
  stripeEnabled: boolean;
}

export const billingApi = {
  getPlans: () => apiClient.get<{ plans: PlanInfo[]; stripeEnabled: boolean }>('/billing/plans'),

  getSubscription: () => apiClient.get<SubscriptionInfo>('/billing/subscription'),

  checkout: (planTier: PlanTier) =>
    apiClient.post<{ url?: string; mock?: boolean; organization?: { planTier: PlanTier; subscriptionStatus: SubscriptionStatus } }>(
      '/billing/checkout',
      { planTier }
    ),

  portal: () => apiClient.post<{ url: string }>('/billing/portal'),
};
