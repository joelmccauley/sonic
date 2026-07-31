import type { PlanTier } from '@/types';

/** Mirrors server-side plan feature flags (server/src/config/plans.ts). */
export const PLAN_FEATURES: Record<PlanTier, Record<string, boolean>> = {
  STARTER: {
    pos: true,
    floorPlan: true,
    menuManagement: true,
    basicReports: true,
    kds: false,
    inventory: false,
    discounts: false,
    customers: false,
    advancedReports: false,
    auditLog: false,
    multiPrinter: false,
    prioritySupport: false,
  },
  PROFESSIONAL: {
    pos: true,
    floorPlan: true,
    menuManagement: true,
    basicReports: true,
    kds: true,
    inventory: true,
    discounts: true,
    customers: true,
    advancedReports: false,
    auditLog: false,
    multiPrinter: true,
    prioritySupport: false,
  },
  ENTERPRISE: {
    pos: true,
    floorPlan: true,
    menuManagement: true,
    basicReports: true,
    kds: true,
    inventory: true,
    discounts: true,
    customers: true,
    advancedReports: true,
    auditLog: true,
    multiPrinter: true,
    prioritySupport: true,
  },
};

export function hasFeature(tier: PlanTier | undefined | null, feature: string): boolean {
  if (!tier) return true; // fail open in UI; the API enforces the real gate
  return PLAN_FEATURES[tier]?.[feature] ?? false;
}
