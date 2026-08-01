// Activity API for the My Activity dashboard.
import { apiClient } from './client';
import type { Role } from '@/types';

export interface ActivityFocusCard {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
}

export interface ActivityFeedItem {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  timeLabel: string;
  tone: 'success' | 'info' | 'warning' | 'error' | 'neutral';
}

export interface ActivityOverview {
  role: Role;
  scopeLabel: string;
  summary: {
    completed7d: number;
    created7d: number;
    updated7d: number;
    dueSoon: number;
  };
  focusCards: ActivityFocusCard[];
  workstream: { label: string; value: number; color: string }[];
  feed: ActivityFeedItem[];
  meta: {
    openOrders: number;
    paidToday: number;
    openToday: number;
    totalSalesToday: number;
    totalTipsToday: number;
    lowInventoryCount: number;
    activeShiftMinutes: number;
  };
}

export type ActivityDetailMetric = 'needs-attention' | 'open-checks' | 'paid-today' | 'sales-today';

export interface ActivityDetailItem {
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  amountLabel?: string | null;
  tipLabel?: string;
  timeLabel: string;
}

export interface ActivityDetailSection {
  id: string;
  title: string;
  items: ActivityDetailItem[];
}

export interface ActivityDetail {
  metric: ActivityDetailMetric;
  title: string;
  description: string;
  summary: {
    count: number;
    totalAmount: number;
  };
  sections: ActivityDetailSection[];
}

export const activityApi = {
  getOverview: () => apiClient.get<ActivityOverview>('/activity/overview'),
  getDetail: (metric: ActivityDetailMetric) => apiClient.get<ActivityDetail>(`/activity/details/${metric}`),
};